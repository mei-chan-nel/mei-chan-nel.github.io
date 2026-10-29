export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : null);
export const variance = (a, sample = false) => {
  const m = mean(a),
    d = a.length - (sample ? 1 : 0);
  return d > 0 ? sum(a.map((x) => (x - m) ** 2)) / d : null;
};
export const sd = (a, sample = false) => {
  const v = variance(a, sample);
  return v === null ? null : Math.sqrt(v);
};
export const median = (a) => {
  const b = [...a].sort((x, y) => x - y),
    n = b.length;
  return n
    ? (b[Math.floor((n - 1) / 2)] + b[Math.ceil((n - 1) / 2)]) / 2
    : null;
};
export const quartiles = (a) => {
  const b = [...a].sort((x, y) => x - y),
    n = b.length,
    h = Math.floor(n / 2);
  return {
    q1: n === 1 ? b[0] : median(b.slice(0, h)),
    q2: median(b),
    q3: n === 1 ? b[0] : median(b.slice(Math.ceil(n / 2))),
  };
};
export function regression(p) {
  const x = p.map((d) => d.x),
    y = p.map((d) => d.y),
    mx = mean(x),
    my = mean(y),
    xx = sum(x.map((v) => (v - mx) ** 2)),
    yy = sum(y.map((v) => (v - my) ** 2)),
    xy = sum(p.map((d) => (d.x - mx) * (d.y - my)));
  const slope = xx > 0 ? xy / xx : null,
    intercept = slope === null ? null : my - slope * mx;
  return {
    r: xx > 0 && yy > 0 ? clamp(xy / Math.sqrt(xx * yy), -1, 1) : null,
    slope,
    intercept,
    sse:
      slope === null
        ? null
        : sum(p.map((d) => (d.y - intercept - slope * d.x) ** 2)),
  };
}
export function histogram(values, width, start = 0) {
  if (!values.length || !Number.isFinite(width) || width <= 0) return [];
  const index = (v) => {
    const q = (v - start) / width;
    return Math.floor(q + 8 * Number.EPSILON * Math.max(1, Math.abs(q)));
  };
  const lo = index(Math.min(...values)),
    hi = index(Math.max(...values));
  if (hi - lo > 2000) return [];
  let acc = 0;
  return Array.from({ length: hi - lo + 1 }, (_, i) => {
    const j = lo + i,
      count = values.filter((v) => index(v) === j).length;
    acc += count;
    return {
      lo: start + j * width,
      hi: start + (j + 1) * width,
      count,
      relative: count / values.length,
      cumulative: acc / values.length,
    };
  });
}
export const rng = (seed) => {
  let a = (Number(seed) || 0) >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const normal = (random) =>
  Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) *
  Math.cos(2 * Math.PI * random());
export function normalCDF(x) {
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;
  const z = Math.abs(x),
    t = 1 / (1 + 0.2316419 * z),
    d = 0.3989422804014327 * Math.exp((-z * z) / 2),
    p =
      1 -
      d *
        t *
        (0.31938153 +
          t *
            (-0.356563782 +
              t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? p : 1 - p;
}
export function binomialPMF(n, p) {
  n = Math.max(0, Math.round(n));
  p = clamp(p, 0, 1);
  if (p === 0)
    return Array.from({ length: n + 1 }, (_, k) => (k === 0 ? 1 : 0));
  if (p === 1)
    return Array.from({ length: n + 1 }, (_, k) => (k === n ? 1 : 0));
  const logs = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) logs[i] = logs[i - 1] + Math.log(i);
  return Array.from({ length: n + 1 }, (_, k) =>
    Math.exp(
      logs[n] -
        logs[k] -
        logs[n - k] +
        k * Math.log(p) +
        (n - k) * Math.log1p(-p),
    ),
  );
}
export function lorenz(values) {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0))
    return null;
  const a = [...values].sort((a, b) => a - b),
    total = sum(a);
  if (total <= 0) return null;
  let s = 0;
  return [
    { x: 0, y: 0 },
    ...a.map((v, i) => ({ x: (i + 1) / a.length, y: (s += v) / total })),
  ];
}
export function gini(values) {
  const p = lorenz(values);
  return p
    ? clamp(
        1 - sum(p.slice(1).map((v, i) => (v.y + p[i].y) / values.length)),
        0,
        1,
      )
    : null;
}
export const fmt = (x, d = 2) =>
  x === null || x === undefined || !Number.isFinite(x)
    ? "—"
    : Number(x).toLocaleString("ja-JP", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
