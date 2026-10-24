import {
  rng,
  binomialPMF,
  mean,
} from "../shared/math.mjs?v=20261024-probability-flow";
import {
  normalizeState,
  normalInterval,
} from "./model.mjs?v=20261024-probability-flow";
export const MAX_TOSSES = 20000;
export function validateSettings(p, n, repetitions) {
  if (!Number.isFinite(p) || p < 0 || p > 1)
    throw Error("表が出る確率は0〜1で指定してください。");
  if (!Number.isInteger(n) || n < 1 || n > 200)
    throw Error("1セットの投数は1〜200回の整数にしてください。");
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 1000)
    throw Error("セット数は1〜1,000の整数にしてください。");
  if (n * repetitions > MAX_TOSSES)
    throw Error("投数 × セット数は20,000回以内にしてください。");
}
export function createExperiment(p, n, repetitions, seed, id = 1) {
  validateSettings(p, n, repetitions);
  const random = rng(seed >>> 0);
  const sets = Array.from({ length: repetitions }, () =>
    Array.from({ length: n }, () => Number(random() < p)),
  );
  return { id, p, n, repetitions, seed: seed >>> 0, sets };
}
export function normalizeLabState(state = {}) {
  const experiments = Array.isArray(state.experiments) ? state.experiments : [];
  for (const e of experiments) {
    validateSettings(e.p, e.n, e.repetitions);
    if (
      !Number.isInteger(e.id) ||
      e.id < 1 ||
      !Array.isArray(e.sets) ||
      e.sets.length !== e.repetitions ||
      e.sets.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== e.n ||
          row.some((v) => v !== 0 && v !== 1),
      )
    )
      throw Error("保存した実験結果を確認してください。");
  }
  if (new Set(experiments.map((e) => e.id)).size !== experiments.length)
    throw Error("実験番号が重複しています。");
  const activeId = experiments.some((e) => e.id === state.activeId)
    ? state.activeId
    : experiments.at(-1)?.id || 0;
  const active = experiments.find((e) => e.id === activeId);
  const clamp = (v, f, lo, hi) =>
    Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : f;
  const n = Math.round(clamp(state.n, 20, 1, 200));
  const legacyData =
    state.legacyData ||
    (state.observed
      ? { ...state.observed, name: state.dataInfo?.name || "以前の保存データ" }
      : null);
  const { observed, ...legacy } = normalizeState({
    ...state,
    observed: undefined,
  });
  return {
    ...legacy,
    mode: "coin",
    p: clamp(state.p, 0.5, 0, 1),
    n,
    repetitions: Math.round(clamp(state.repetitions, 200, 1, 1000)),
    tossCount: 0,
    experiments,
    activeId,
    legacyData,
    early: !!state.early,
    intervalLow: Math.round(
      clamp(
        state.intervalLow,
        active
          ? Math.max(
              0,
              Math.ceil(
                active.n * active.p -
                  Math.sqrt(active.n * active.p * (1 - active.p)),
              ),
            )
          : 8,
        0,
        active?.n || n,
      ),
    ),
    intervalHigh: Math.round(
      clamp(
        state.intervalHigh,
        active
          ? Math.min(
              active.n,
              Math.floor(
                active.n * active.p +
                  Math.sqrt(active.n * active.p * (1 - active.p)),
              ),
            )
          : 12,
        0,
        active?.n || n,
      ),
    ),
  };
}
export const activeExperiment = (s) =>
  s.experiments?.find((e) => e.id === s.activeId) || null;
export function startExperiment(state, p, n, repetitions, seed) {
  const s = normalizeLabState(state),
    id = Math.max(0, ...s.experiments.map((e) => e.id)) + 1;
  const e = createExperiment(p, n, repetitions, seed, id),
    sigma = Math.sqrt(n * p * (1 - p));
  return normalizeLabState({
    ...s,
    p,
    n,
    repetitions,
    experiments: [...s.experiments, e],
    activeId: id,
    early: false,
    intervalLow: Math.max(0, Math.ceil(n * p - sigma)),
    intervalHigh: Math.min(n, Math.floor(n * p + sigma)),
    dataInfo: {
      name: `コインのモデル実験 ${id}`,
      origin: "model",
      columns: ["セット", "表の回数"],
      baseline: e.sets.map((row, i) => [i + 1, row.reduce((a, b) => a + b, 0)]),
    },
  });
}
const cache = new WeakMap();
export function experimentSummary(e) {
  if (cache.has(e)) return cache.get(e);
  const outcomes = e.sets.map((row) => row.reduce((a, b) => a + b, 0)),
    tosses = e.sets.flat(),
    counts = Array(e.n + 1).fill(0);
  outcomes.forEach((k) => counts[k]++);
  let successes = 0;
  const path = tosses.map((v, i) => {
    successes += v;
    return { x: i + 1, y: successes / (i + 1) };
  });
  const result = {
    outcomes,
    tosses,
    counts,
    path,
    successes,
    theory: binomialPMF(e.n, e.p),
    mean: mean(outcomes),
    mu: e.n * e.p,
    sigma: Math.sqrt(e.n * e.p * (1 - e.p)),
  };
  cache.set(e, result);
  return result;
}
export function intervalComparison(e, low, high) {
  const d = experimentSummary(e),
    a = Math.max(0, Math.min(e.n, Math.min(low, high))),
    b = Math.max(0, Math.min(e.n, Math.max(low, high)));
  const count = d.outcomes.filter((k) => k >= a && k <= b).length;
  const exact = d.theory.slice(a, b + 1).reduce((x, y) => x + y, 0);
  const normal =
    d.sigma > 0 ? normalInterval(d.mu, d.sigma, a - 0.5, b + 0.5) : null;
  return {
    a,
    b,
    count,
    observed: count / e.repetitions,
    exact,
    normal,
    low: a - 0.5,
    high: b + 0.5,
    adequate: e.n * e.p >= 5 && e.n * (1 - e.p) >= 5,
  };
}
