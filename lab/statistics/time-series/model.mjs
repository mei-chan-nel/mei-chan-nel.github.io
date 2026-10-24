import { mean, rng, normal } from "../shared/math.mjs";
export const MONTHS = 48;
export const SAMPLE_SOURCE =
  "教材用に作成した架空データ：文具通販店の月別注文件数（2022〜2025年）。";
// Spring purchases and autumn/year-end demand overlap with modest annual growth,
// correlated month-to-month noise and two one-off events. No real shop is implied.
export function createMonthlySeries({
  trend = 5,
  seasonal = 140,
  noise = 45,
  seed = 1729,
} = {}) {
  const random = rng(seed),
    shape = [
      -0.65, -0.85, 1.15, 0.8, -0.15, -0.4, -0.75, -0.3, 0.65, -0.05, 0.45,
      0.85,
    ],
    center = mean(shape);
  let disturbance = 0;
  return Array.from({ length: MONTHS }, (_, i) => {
    disturbance = 0.25 * disturbance + normal(random);
    const event = i === 19 ? 1.8 : i === 28 ? -1.5 : 0;
    return Math.max(
      1,
      Math.round(
        1200 +
          trend * i +
          seasonal * (shape[i % 12] - center) +
          noise * (disturbance + event),
      ),
    );
  });
}
export function trailingMovingAverage(values, period) {
  const k = Math.max(1, Math.min(values.length, Math.floor(period) || 1));
  return values.map((_, i) =>
    i + 1 < k ? null : mean(values.slice(i - k + 1, i + 1)),
  );
}
export function linearDetrend(values) {
  const n = values.length;
  if (!n) return [];
  const xm = (n - 1) / 2,
    ym = mean(values),
    xx = values.reduce((s, _, i) => s + (i - xm) ** 2, 0),
    slope = xx
      ? values.reduce((s, y, i) => s + (i - xm) * (y - ym), 0) / xx
      : 0;
  return values.map((y, i) => y - ym - slope * (i - xm));
}
// Conventional ACF: the same full-series mean and sum of squares at every lag.
export function autocorrelations(values, maxLag = 24, { detrend = true } = {}) {
  const source = detrend ? linearDetrend(values) : values,
    center = mean(source) ?? 0,
    d = source.map((x) => x - center),
    den = d.reduce((s, x) => s + x * x, 0),
    tolerance =
      Number.EPSILON ** 2 *
      Math.max(1, ...values.map((x) => x * x)) *
      values.length *
      100;
  return Array.from(
    {
      length:
        Math.min(
          Math.max(0, Math.floor(maxLag)),
          Math.max(0, values.length - 1),
        ) + 1,
    },
    (_, lag) =>
      den <= tolerance
        ? null
        : d.slice(lag).reduce((s, v, j) => s + v * d[j], 0) / den,
  );
}
// Classical additive decomposition, using a centered 2x12 moving average.
// The 12 seasonal effects are centered to sum to zero and never use the known
// synthetic generator, so imported data follow exactly the same analysis.
export function seasonalDecomposition(values) {
  const trend = values.map((_, i) =>
    i < 6 || i + 6 >= values.length
      ? null
      : (0.5 * values[i - 6] +
          values.slice(i - 5, i + 6).reduce((s, v) => s + v, 0) +
          0.5 * values[i + 6]) /
        12,
  );
  const buckets = Array.from({ length: 12 }, () => []);
  values.forEach((v, i) => {
    if (trend[i] !== null) buckets[i % 12].push(v - trend[i]);
  });
  if (buckets.some((b) => !b.length))
    return {
      trend,
      seasonal: Array(12).fill(null),
      adjusted: values.map(() => null),
    };
  const raw = buckets.map(mean),
    center = mean(raw),
    seasonal = raw.map((v) => v - center);
  return {
    trend,
    seasonal,
    adjusted: values.map((v, i) => v - seasonal[i % 12]),
  };
}
export function seriesIndicator(values, mode) {
  if (mode === "index")
    return values.map((y) =>
      values[0] > 0 && y !== null ? (y / values[0]) * 100 : null,
    );
  const lag = mode === "growth" ? 1 : 12;
  return values.map((y, i) =>
    i >= lag && values[i - lag] > 0 && y !== null
      ? (y / values[i - lag] - 1) * 100
      : null,
  );
}
export function initialSeriesState() {
  return {
    trend: 5,
    seasonal: 140,
    noise: 45,
    seed: 1729,
    period: 6,
    lag: 12,
    indicator: "yoy",
    indicatorSource: "raw",
    selected: 47,
  };
}
export function normalizeSeriesState(state = {}) {
  const integer = (v, defaultValue, low, high) =>
    Number.isFinite(Number(v))
      ? Math.max(low, Math.min(high, Math.round(Number(v))))
      : defaultValue;
  return {
    ...initialSeriesState(),
    ...state,
    period: integer(state.period, 6, 1, 24),
    lag: integer(state.lag, 12, 1, 24),
    selected: integer(state.selected, 47, 0, 47),
    indicator: ["growth", "yoy", "index"].includes(state.indicator)
      ? state.indicator
      : "yoy",
    indicatorSource: state.indicatorSource === "adjusted" ? "adjusted" : "raw",
  };
}
