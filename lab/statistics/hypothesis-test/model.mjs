// Exact finite-binomial calculations. No normal approximation or random p-value.
export const MAX_N = 10000;
export function validateCounts(n, k, p) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_N || !Number.isInteger(k) || k < 0 || k > n)
    throw Error('総数は1〜10,000、該当数は0〜総数の整数にしてください。');
  if (!Number.isFinite(p) || p < 0 || p > 1) throw Error('基準の割合は0〜100%にしてください。');
}
const cache = new Map();
export function binomialModel(n, p) {
  validateCounts(n, 0, p);
  const key = `${n}/${p}`;
  if (cache.has(key)) return cache.get(key);
  const logMass = Array(n + 1).fill(-Infinity), mass = Array(n + 1).fill(0);
  if (p === 0 || p === 1) { mass[p * n] = 1; logMass[p * n] = 0; }
  else {
    const mode = Math.min(n, Math.floor((n + 1) * p)), odds = Math.log(p) - Math.log1p(-p);
    logMass[mode] = 0;
    for (let k = mode; k > 0; k--) logMass[k - 1] = logMass[k] + Math.log(k) - Math.log(n - k + 1) - odds;
    for (let k = mode; k < n; k++) logMass[k + 1] = logMass[k] + Math.log(n - k) - Math.log(k + 1) + odds;
    const logTotal = Math.log(logMass.reduce((s, v) => s + Math.exp(v), 0));
    for (let k = 0; k <= n; k++) { logMass[k] -= logTotal; mass[k] = Math.exp(logMass[k]); }
  }
  const center = n * p, distance = mass.map((_, k) => Math.abs(k - center));
  const order = mass.map((_, k) => k).sort((a, b) => distance[b] - distance[a]);
  const pValues = Array(n + 1); let total = 0;
  for (let i = 0; i < order.length;) {
    let j = i + 1;
    while (j < order.length && Math.abs(distance[order[j]] - distance[order[i]]) < 1e-9) j++;
    for (let t = i; t < j; t++) total += mass[order[t]];
    for (let t = i; t < j; t++) pValues[order[t]] = Math.min(1, total);
    i = j;
  }
  const result = { n, p, mass, logMass, pValues, center, sigma: Math.sqrt(n * p * (1 - p)) };
  if (cache.size >= 10) cache.delete(cache.keys().next().value);
  cache.set(key, result); return result;
}
export function exactTest(n, k, p, alpha = .05) {
  validateCounts(n, k, p);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) throw Error('有意水準は0と1の間にしてください。');
  const model = binomialModel(n, p), d = Math.abs(k - model.center);
  const tail = model.mass.map((_, x) => Math.abs(x - model.center) >= d - 1e-9);
  const logs = model.logMass.filter((_, i) => tail[i]);
  const maxLog = Math.max(...logs);
  const logP = maxLog === -Infinity ? -Infinity : maxLog + Math.log(logs.reduce((s, v) => s + Math.exp(v - maxLog), 0));
  const rejection = model.pValues.map(v => v <= alpha + 1e-12);
  return { ...model, k, alpha, tail, logP: Math.min(0, logP), pValue: Math.min(1, Math.exp(logP)), reject: model.pValues[k] <= alpha + 1e-12, rejection };
}
export function testPerformance(n, p0, p1, alpha) {
  validateCounts(n, 0, p1);
  const test = exactTest(n, Math.round(n * p0), p0, alpha), alternative = binomialModel(n, p1);
  const sum = mass => mass.reduce((s, v, i) => s + (test.rejection[i] ? v : 0), 0);
  const falsePositive = sum(test.mass), detected = sum(alternative.mass);
  return { ...test, alternative, falsePositive, detected, missed: Math.max(0, 1 - detected), hasAlternative: p0 !== p1 };
}
export function distributionBins(model, masks = [], observed = null, other = null) {
  const centers = [model.center, ...(other ? [other.center] : []), ...(observed === null ? [] : [observed])];
  const sd = Math.max(model.sigma, other?.sigma || 0, 1);
  const lo = model.n <= 100 ? 0 : Math.max(0, Math.floor(Math.min(...centers) - 4.5 * sd));
  const hi = model.n <= 100 ? model.n : Math.min(model.n, Math.ceil(Math.max(...centers) + 4.5 * sd));
  const width = Math.max(1, Math.ceil((hi - lo + 1) / 90)), bins = [];
  for (let a = lo; a <= hi; a += width) {
    const b = Math.min(hi, a + width - 1); let sum = 0, alt = 0;
    const selected = masks.map(() => 0);
    for (let k = a; k <= b; k++) {
      sum += model.mass[k]; alt += other?.mass[k] || 0;
      masks.forEach((m, i) => { if (m[k]) selected[i] += model.mass[k]; });
    }
    bins.push({ lo: a, hi: b, mass: sum, alternative: alt, selected });
  }
  return { lo, hi, width, bins };
}
