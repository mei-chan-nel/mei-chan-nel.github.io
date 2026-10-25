// One observation is one participant's accuracy, not one image judgement.
// This module is intentionally separate from the legacy binomial-count model.
import { normalCDF } from '../shared/math.mjs';
export const MAX_PARTICIPANTS = 10000;

function logGamma(z) {
  const c = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let a = .9999999999998099;
  for (let i = 0; i < c.length; i++) a += c[i] / (z + i + 1);
  const t = z + c.length - .5;
  return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(a);
}

function betaFraction(a, b, x) {
  const tiny = 1e-300;
  const nonzero = v => Math.abs(v) < tiny ? (v < 0 ? -tiny : tiny) : v;
  let c = 1, d = 1 / nonzero(1 - (a + b) * x / (a + 1)), h = d;
  for (let m = 1; m <= 1000; m++) {
    let aa = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 / nonzero(1 + aa * d);
    c = nonzero(1 + aa / c);
    h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 / nonzero(1 + aa * d);
    c = nonzero(1 + aa / c);
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) return h;
  }
  throw Error('不完全ベータ関数が収束しませんでした。');
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  const result = x < (a + 1) / (a + b + 2)
    ? front * betaFraction(a, b, x) / a
    : 1 - front * betaFraction(b, a, 1 - x) / b;
  return Math.max(0, Math.min(1, result));
}

function validateDf(df) {
  if (!Number.isInteger(df) || df < 1 || df >= MAX_PARTICIPANTS)
    throw Error('自由度は1〜9,999の整数にしてください。');
}

// Upper tail for |t|. Computing it directly avoids subtracting a tiny tail from 1.
export function studentTail(absT, df) {
  validateDf(df);
  if (typeof absT !== 'number' || Number.isNaN(absT) || absT < 0)
    throw Error('tの絶対値は0以上にしてください。');
  if (absT === Infinity) return 0;
  if (absT <= 1) return .5 * (1 - regularizedBeta(absT * absT / (df + absT * absT), .5, df / 2));
  return .5 * regularizedBeta(df / (df + absT * absT), df / 2, .5);
}

export function studentDensity(t, df) {
  validateDf(df);
  if (typeof t !== 'number' || Number.isNaN(t)) throw Error('tを確認してください。');
  return Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2)
    - .5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log1p(t * t / df));
}

// Critical |t| for a two-sided test. The same value defines its confidence interval.
export function studentCritical(alpha, df) {
  validateDf(df);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1)
    throw Error('有意水準は0より大きく1未満にしてください。');
  let lo = 0, hi = 1;
  while (studentTail(hi, df) > alpha / 2 && hi < 1e154) hi *= 2;
  if (studentTail(hi, df) > alpha / 2) throw Error('有意水準が小さすぎて棄却点を計算できません。');
  for (let i = 0; i < 90; i++) {
    const mid = lo + (hi - lo) / 2;
    if (studentTail(mid, df) > alpha / 2) lo = mid;
    else hi = mid;
  }
  return lo + (hi - lo) / 2;
}

export function participantScores(participants) {
  if (!Array.isArray(participants) || participants.length < 2 || participants.length > MAX_PARTICIPANTS)
    throw Error('参加者2〜10,000人分のデータを指定してください。');
  const ids = new Set();
  return Array.from(participants).map((p, i) => {
    if (!p || typeof p.id !== 'string' || !p.id.trim() || p.id.length > 100 || ids.has(p.id.trim()))
      throw Error(`${i + 1}行目の参加者番号は、重複のない100文字以内の文字列にしてください。`);
    ids.add(p.id.trim());
    if (!Number.isInteger(p.trials) || p.trials < 1 || p.trials > 10000 ||
        !Number.isInteger(p.correct) || p.correct < 0 || p.correct > p.trials)
      throw Error(`${i + 1}行目の判定枚数は1〜10,000、正答数は0〜判定枚数の整数にしてください。`);
    return p.correct / p.trials;
  });
}

export function meanTest(scores, reference = .5, alpha = .05) {
  if (!Array.isArray(scores) || scores.length < 2 || scores.length > MAX_PARTICIPANTS ||
      Array.from(scores).some(v => !Number.isFinite(v) || v < 0 || v > 1))
    throw Error('参加者ごとの正答率を0〜1の数値で2〜10,000人分指定してください。');
  if (!Number.isFinite(reference) || reference < 0 || reference > 1)
    throw Error('基準の正答率を0〜1で指定してください。');
  const n = scores.length, df = n - 1;
  const critical = studentCritical(alpha, df);
  // Welford's algorithm avoids cancellation in the sample variance.
  let average = 0, m2 = 0;
  scores.forEach((v, i) => { const delta = v - average; average += delta / (i + 1); m2 += delta * (v - average); });
  const sd = Math.sqrt(Math.max(0, m2 / df)), se = sd / Math.sqrt(n), difference = average - reference;
  // A zero sample variance does not estimate sampling uncertainty. It is not
  // evidence of an infinitely precise population mean, even if all answers agree.
  if (sd === 0) return {n, df, mean: average, sd, se, difference, alpha, reference,
    valid: false, reason: '参加者の正答率がすべて同じため、ばらつきを推定できません。',
    t: null, pValue: null, critical: null, interval: null, reject: null};
  const t = difference / se, pValue = Math.min(1, 2 * studentTail(Math.abs(t), df));
  return {n, df, mean: average, sd, se, difference, alpha, reference, valid: true,
    t, pValue, critical, interval: [average - critical * se, average + critical * se],
    reject: pValue <= alpha};
}

const chiQuadratures = new Map();
function chiQuadrature(df) {
  if (chiQuadratures.has(df)) return chiQuadratures.get(df);
  const a = df / 2, h0 = Math.sqrt(2 / df);
  const lo = -12 * h0 - 64 / df, hi = 12 * h0 + 16 / df, count = 1200;
  const h = (hi - lo) / count, constant = a * Math.log(a) - a - logGamma(a);
  const points = Array.from({length: count + 1}, (_, i) => {
    const u = lo + i * h;
    // With U=log(V/df), V~chi-square(df), this is f_U(u)du.
    const weight = Math.exp(constant + a * (u - Math.expm1(u))) * h / 3 * (i === 0 || i === count ? 1 : i % 2 ? 4 : 2);
    return {scale: Math.exp(u / 2), weight};
  });
  const mass = points.reduce((total, p) => total + p.weight, 0);
  for (const p of points) p.weight /= mass;
  if (chiQuadratures.size > 8) chiQuadratures.clear();
  chiQuadratures.set(df, points);
  return points;
}

export function noncentralDensity(t, df, delta) {
  validateDf(df);
  if (!Number.isFinite(t) || !Number.isFinite(delta)) throw Error('分布の条件を確認してください。');
  if (delta === 0) return studentDensity(t, df);
  return chiQuadrature(df).reduce((total, p) => {
    const z = t * p.scale - delta;
    return total + p.weight * p.scale * Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  }, 0);
}

// Planning assumption: independent, normally distributed participant scores;
// the population SD is fixed to a chosen estimate. Under this assumption the
// SAME one-sample t rule has a noncentral t distribution when the mean differs.
export function meanTestPower(n, trueMean, populationSD, alpha = .05, reference = .5) {
  if (!Number.isInteger(n) || n < 30 || n > 1000 ||
      !Number.isFinite(trueMean) || trueMean < 0 || trueMean > 1 ||
      !Number.isFinite(reference) || reference < 0 || reference > 1 ||
      !Number.isFinite(populationSD) || populationSD <= 0 || populationSD > 1)
    throw Error('計画人数は30〜1,000人、正答率は0〜1、標準偏差は0より大きく1以下にしてください。');
  const df = n - 1, critical = studentCritical(alpha, df);
  const delta = (trueMean - reference) / (populationSD / Math.sqrt(n));
  const hasAlternative = trueMean !== reference;
  const detected = hasAlternative ? Math.max(0, Math.min(1, chiQuadrature(df).reduce((total, p) =>
    total + p.weight * (normalCDF(-critical * p.scale - delta) + normalCDF(delta - critical * p.scale)), 0))) : alpha;
  return {n, df, alpha, reference, trueMean, populationSD, delta, critical,
    hasAlternative, falsePositive: alpha, detected, missed: 1 - detected};
}
