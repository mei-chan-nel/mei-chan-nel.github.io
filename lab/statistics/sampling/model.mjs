import { mean, sd, rng } from "../shared/math.mjs?v=20261026-final-upgrade";

export function population(custom) {
  if (Array.isArray(custom))
    return custom.map((p, id) => ({ id, value: Number(p.value) }));
  const random = rng(841917);
  return Array.from({ length: 120 }, (_, id) => ({
    id,
    value: Math.max(
      0,
      Math.round(34 + (random() + random() + random() - 1.5) * 30),
    ),
  }));
}
const methodOf = (method) => (method === "with" ? "with" : "without");

export function finiteSE(values, n) {
  const size = values.length;
  if (!size || n < 1 || n > size) return NaN;
  if (size === 1 || n === size) return 0;
  return (sd(values) / Math.sqrt(n)) * Math.sqrt((size - n) / (size - 1));
}
export function samplingSE(values, n, method = "without") {
  if (!values.length || n < 1) return NaN;
  return methodOf(method) === "with"
    ? sd(values) / Math.sqrt(n)
    : finiteSE(values, n);
}

export function samplePopulation(people, n, method, seed, trial = 0) {
  const random = rng((Number(seed) + Math.imul(trial, 0x9e3779b9)) >>> 0);
  const count = Math.min(people.length, Math.max(1, Math.trunc(n)));
  if (methodOf(method) === "with")
    return Array.from(
      { length: count },
      () => people[Math.floor(random() * people.length)],
    );
  const pool = [...people];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
export function simulateSample(people, n, method, seed, trial = 0) {
  const sample = samplePopulation(people, n, method, seed, trial),
    values = people.map((p) => p.value),
    truth = mean(values);
  const center =
    methodOf(method) === "without" && sample.length === people.length
      ? truth
      : mean(sample.map((p) => p.value));
  const se = samplingSE(values, sample.length, method),
    low = center - 1.96 * se,
    high = center + 1.96 * se;
  return {
    mean: center,
    low,
    high,
    covers: low <= truth && truth <= high,
    indices: sample.map((p) => p.id),
  };
}

function cleanOptions(state) {
  const { groupNames, groupLabel, shiftB, sizeComparison, ...options } = state;
  options.method = methodOf(state.method);
  if (options.customPopulation)
    options.customPopulation = population(options.customPopulation);
  if (sizeComparison && options.compareN === undefined) {
    options.compareN = sizeComparison.sizes?.[1] || 40;
    options.compareSamples = true;
  }
  if (options.compareN !== undefined)
    options.compareN = Math.max(
      1,
      Math.min(
        population(options.customPopulation).length,
        Math.trunc(Number(options.compareN) || 40),
      ),
    );
  if (options.dataInfo)
    options.dataInfo = {
      ...options.dataInfo,
      columns: options.dataInfo.columns.slice(0, 1),
      baseline: options.dataInfo.baseline.map((r) => [r[0]]),
    };
  return options;
}
const signatureOf = (options) =>
  `replacement-v2/${options.n}/${options.method}/${options.seed}/${options.customPopulation ? JSON.stringify(options.customPopulation) : "sample"}`;
export function newExperiment(overrides = {}) {
  const options = cleanOptions({
    n: 20,
    method: "without",
    seed: 20261015,
    ...overrides,
  });
  const people = population(options.customPopulation);
  options.n = Math.min(
    people.length,
    Math.max(1, Math.trunc(Number(options.n) || 20)),
  );
  options.seed = Number.isFinite(Number(options.seed))
    ? Number(options.seed) >>> 0
    : 20261015;
  const { indices, ...result } = simulateSample(
    people,
    options.n,
    options.method,
    options.seed,
  );
  return {
    ...options,
    signature: signatureOf(options),
    trials: 1,
    history: [result],
    last: indices,
  };
}
export function normalizeExperiment(state) {
  const options = cleanOptions(state),
    people = population(options.customPopulation);
  options.n = Math.min(
    people.length,
    Math.max(1, Math.trunc(Number(options.n) || 20)),
  );
  options.seed = Number.isFinite(Number(options.seed))
    ? Number(options.seed) >>> 0
    : 20261015;
  const signature = signatureOf(options);
  if (
    state.signature !== signature ||
    !Array.isArray(state.history) ||
    !Array.isArray(state.last) ||
    !state.history.length
  )
    return newExperiment(options);
  return { ...options, signature };
}
export function addTrials(state, count, replay = false) {
  const current = normalizeExperiment(state),
    people = population(current.customPopulation),
    history = replay ? [] : [...current.history];
  const first = replay ? 0 : current.trials,
    end = Math.min(2000, first + Math.max(0, Math.trunc(count)));
  let last = current.last;
  for (let trial = first; trial < end; trial++) {
    const { indices, ...result } = simulateSample(
      people,
      current.n,
      current.method,
      current.seed,
      trial,
    );
    history.push(result);
    last = indices;
  }
  return { ...current, history, trials: end, last };
}

const niceStep = (rough) => {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= rough);
};
// Start close to the expected spread; only observed results can expand it.
// The same radius is always added to both sides of the fixed population mean.
export function samplingDomain(
  values,
  count,
  history = [],
  method = "without",
) {
  const truth = mean(values),
    sigma = sd(values),
    se = samplingSE(values, count, method);
  const initial = Math.max(
    se * 2.5,
    se === 0 ? Math.max(sigma * 0.15, 0.5) : 0,
    Math.abs(truth) * Number.EPSILON * 16,
    Number.EPSILON,
  );
  const quantum = niceStep(initial / 5);
  const needed = history.reduce(
    (r, item) =>
      Math.max(
        r,
        Math.abs(item.mean - truth) * 1.05,
        Math.abs(item.low - truth) * 1.05,
        Math.abs(item.high - truth) * 1.05,
      ),
    initial,
  );
  const radius = Math.ceil(needed / quantum) * quantum;
  return {
    truth,
    tick: niceStep(radius / 4),
    xmin: truth - radius,
    xmax: truth + radius,
  };
}

export function experimentSummary(history, truth) {
  const count = history.length;
  const constant =
    count > 0 && history.every((r) => r.mean === history[0].mean);
  const center = count
    ? constant
      ? history[0].mean
      : mean(history.map((r) => r.mean))
    : null;
  const covered = history.filter(
    (r) => r.low <= truth && truth <= r.high,
  ).length;
  return {
    count,
    center,
    error: count ? center - truth : null,
    spread:
      count > 1
        ? constant
          ? 0
          : sd(
              history.map((r) => r.mean),
              true,
            )
        : null,
    rmse: count
      ? Math.sqrt(mean(history.map((r) => (r.mean - truth) ** 2)))
      : null,
    covered,
    missed: count - covered,
    coverage: count ? covered / count : null,
  };
}

// Keep comparison settings optional so existing saved experiments still load.
export function comparisonSettings(state) {
  const size = population(state.customPopulation).length;
  const bounded = (value, fallback, min, max) =>
    Math.max(min, Math.min(max, Math.trunc(Number(value) || fallback)));
  return {
    sizes: [
      bounded(state.n, 20, 1, size),
      bounded(state.compareN ?? state.sizeComparison?.sizes?.[1], 40, 1, size),
    ],
    trials: bounded(state.trials, 1, 1, 2000),
  };
}

const comparisonCache = new Map();
export function compareSampleSizes(state) {
  const settings = comparisonSettings(state),
    people = population(state.customPopulation),
    values = people.map((p) => p.value),
    method = methodOf(state.method),
    seed = Number(state.seed) >>> 0;
  const key = JSON.stringify([values, method, seed, settings]);
  if (comparisonCache.has(key)) return comparisonCache.get(key);
  const truth = mean(values);
  const series = settings.sizes.map((n) => {
    const history = Array.from({ length: settings.trials }, (_, trial) => {
      // Reuse each trial's draw sequence: both sizes have identical conditions.
      const { indices, ...result } = simulateSample(
        people,
        n,
        method,
        seed,
        trial,
      );
      return result;
    });
    return {
      n,
      history,
      summary: experimentSummary(history, truth),
      se: samplingSE(values, n, method),
    };
  });
  const result = {
    ...settings,
    series,
    domain: samplingDomain(
      values,
      Math.min(...settings.sizes),
      series.flatMap((s) => s.history),
      method,
    ),
  };
  // Chart redraws and tab switches reuse results; bound retained experiments.
  if (comparisonCache.size >= 4)
    comparisonCache.delete(comparisonCache.keys().next().value);
  comparisonCache.set(key, result);
  return result;
}
