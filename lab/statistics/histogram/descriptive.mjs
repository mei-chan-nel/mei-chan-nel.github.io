import { mean, quartiles, sum } from "../shared/math.mjs";

export function describe(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return null;
  const average = mean(sorted),
    q = quartiles(sorted);
  const iqr = q.q3 - q.q1;
  const lowerFence = q.q1 - 1.5 * iqr,
    upperFence = q.q3 + 1.5 * iqr;
  const inside = sorted.filter((x) => x >= lowerFence && x <= upperFence);
  const ss = sum(sorted.map((x) => (x - average) ** 2));
  return {
    n,
    sorted,
    sum: sum(sorted),
    mean: average,
    ...q,
    iqr,
    min: sorted[0],
    max: sorted.at(-1),
    lowerFence,
    upperFence,
    lower: inside[0] ?? sorted[0],
    upper: inside.at(-1) ?? sorted.at(-1),
    outliers: sorted.filter((x) => x < lowerFence || x > upperFence),
    ss,
    variance: ss / n,
    sampleVariance: n > 1 ? ss / (n - 1) : null,
  };
}

// Lanczos log-gamma and Lentz's beta fraction avoid subtracting a tiny F tail
// from 1. Used for the upper-tail probability of the classical ANOVA F test.
function logGamma(z) {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5)
    return (
      Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  z -= 1;
  let x = c[0];
  for (let i = 1; i < c.length; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
  );
}
function betaFraction(a, b, x) {
  const tiny = 1e-300;
  const safe = (v) => (Math.abs(v) < tiny ? (v < 0 ? -tiny : tiny) : v);
  let c = 1,
    d = 1 / safe(1 - ((a + b) * x) / (a + 1)),
    h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 / safe(1 + aa * d);
    c = safe(1 + aa / c);
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 / safe(1 + aa * d);
    c = safe(1 + aa / c);
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) return h;
  }
  throw Error("F分布の確率計算が収束しませんでした。");
}
function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log1p(-x),
  );
  const result =
    x < (a + 1) / (a + b + 2)
      ? (front * betaFraction(a, b, x)) / a
      : 1 - (front * betaFraction(b, a, 1 - x)) / b;
  return Math.max(0, Math.min(1, result));
}
export function fSurvival(f, dfBetween, dfWithin) {
  if (!(dfBetween > 0 && dfWithin > 0) || f < 0 || Number.isNaN(f)) return null;
  if (f === Infinity) return 0;
  if (dfBetween * f < dfWithin)
    return (
      1 -
      regularizedBeta(
        (dfBetween * f) / (dfWithin + dfBetween * f),
        dfBetween / 2,
        dfWithin / 2,
      )
    );
  return regularizedBeta(
    dfWithin / (dfWithin + dfBetween * f),
    dfWithin / 2,
    dfBetween / 2,
  );
}
export function oneWayAnova(rows) {
  const ids = [...new Set(rows.map((r) => r.group))];
  const groups = ids.map((group) => ({
    group,
    ...describe(rows.filter((r) => r.group === group).map((r) => r.value)),
  }));
  const total = describe(rows.map((r) => r.value));
  if (!total)
    return {
      groups,
      n: 0,
      k: 0,
      available: false,
      reason: "データがありません。",
    };
  const n = total.n,
    k = groups.length;
  const between = sum(groups.map((g) => g.n * (g.mean - total.mean) ** 2));
  const within = sum(groups.map((g) => g.ss));
  const dfBetween = k - 1,
    dfWithin = n - k;
  const msBetween = dfBetween > 0 ? between / dfBetween : null;
  const msWithin = dfWithin > 0 ? within / dfWithin : null;
  const available = k >= 2 && dfWithin > 0 && msWithin > 0;
  const reason =
    k < 2
      ? "分散分析には2群以上が必要です。"
      : dfWithin <= 0
        ? "群内の自由度が0です。各群に観測を追加してください。"
        : msWithin === 0
          ? "群内平方和が0のため、群内平均平方で割るF値は定義できません。"
          : "";
  const f = available ? msBetween / msWithin : null;
  return {
    groups,
    n,
    k,
    total,
    between,
    within,
    dfBetween,
    dfWithin,
    dfTotal: n - 1,
    msBetween,
    msWithin,
    f,
    p: available ? fSurvival(f, dfBetween, dfWithin) : null,
    available,
    reason,
  };
}
