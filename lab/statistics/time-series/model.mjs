import { mean } from "../shared/math.mjs?v=20261026-final-upgrade";
import {
  householdSeries,
  householdMonths,
} from "./data.mjs?v=20261026-final-upgrade";
export {
  householdSeries,
  householdMonths,
} from "./data.mjs?v=20261026-final-upgrade";
export const MIN_MONTHS = 24;
export const MAX_MONTHS = 300;
export function seriesValues(state = {}) {
  return state.customValues || [...householdSeries.values];
}
export function seriesLength(state = {}) {
  return state.customValues?.length || householdSeries.values.length;
}
export function seriesMonths(state = {}) {
  return (
    state.monthLabels ||
    (state.customValues
      ? state.customValues.map((_, i) => `${i + 1}か月目`)
      : [...householdMonths])
  );
}
export function movingAverageWindow(values, period, index) {
  const k = Math.max(1, Math.floor(period) || 1),
    half = Math.floor(k / 2),
    even = k % 2 === 0;
  const start = index - half,
    end = index + half;
  const weights = Array.from({ length: end - start + 1 }, (_, j) =>
    even && (j === 0 || j === end - start) ? 0.5 : 1,
  );
  const available = start >= 0 && end < values.length;
  return {
    start,
    end,
    weights,
    denominator: k,
    available,
    value: available
      ? weights.reduce((sum, w, j) => sum + w * values[start + j], 0) / k
      : null,
  };
}
export function centeredMovingAverage(values, period) {
  return values.map((_, i) => movingAverageWindow(values, period, i).value);
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
  const trend = centeredMovingAverage(values, 12);
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
// A readable scale for changes and indices. Keep the neutral reference in view,
// without requiring zero for an index whose observations are far above zero.
export function indicatorScale(values, mode) {
  const baseline = mode === "index" ? 100 : 0;
  const finite = values.filter((v) => v !== null && Number.isFinite(v));
  const low = Math.min(baseline, ...finite),
    high = Math.max(baseline, ...finite);
  const span = high - low;
  const pad = span > 0 ? span * 0.08 : Math.max(1, Math.abs(baseline) * 0.05);
  const rough = (span + 2 * pad) / 6;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const factor = [1, 2, 2.5, 5, 10].reduce((best, candidate) =>
    Math.abs(Math.log(rough / (candidate * magnitude))) <
    Math.abs(Math.log(rough / (best * magnitude)))
      ? candidate
      : best,
  );
  const step = factor * magnitude;
  const clean = (v) => Number(v.toPrecision(12));
  const min = clean(Math.floor((low - pad) / step) * step);
  const max = clean(Math.ceil((high + pad) / step) * step);
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => clean(min + step * i),
  );
  const digits = Math.max(
    0,
    Math.min(10, Math.ceil(-Math.log10(step)) + (factor === 2.5 ? 1 : 0)),
  );
  return { min, max, step, ticks, digits, baseline };
}
export function initialSeriesState() {
  return {
    period: 6,
    lag: 12,
    indicator: "yoy",
    indicatorSource: "raw",
    selected: Math.floor(householdSeries.values.length / 2),
  };
}
export function normalizeSeriesState(state = {}) {
  const n = seriesLength(state),
    integer = (v, defaultValue, low, high) =>
      Number.isFinite(Number(v))
        ? Math.max(low, Math.min(high, Math.round(Number(v))))
        : defaultValue;
  return {
    ...initialSeriesState(),
    ...state,
    period: integer(state.period, 6, 1, Math.min(36, n - 1)),
    lag: integer(state.lag, 12, 1, Math.min(36, n - 1)),
    selected: integer(state.selected, Math.floor(n / 2), 0, n - 1),
    indicator: ["growth", "yoy", "index"].includes(state.indicator)
      ? state.indicator
      : "yoy",
    indicatorSource: state.indicatorSource === "adjusted" ? "adjusted" : "raw",
  };
}
