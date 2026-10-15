import { mean, sd, rng } from "../shared/math.mjs";

// An original, completely fictional finite population. Group is visible, not hidden.
export function population(custom) {
  if (Array.isArray(custom))
    return custom.map((p, id) => ({
      id,
      value: Number(p.value),
      frequent: Boolean(p.frequent),
    }));
  const random = rng(841917);
  return Array.from({ length: 120 }, (_, id) => {
    const frequent = id % 3 === 0;
    const minutes = Math.round(
      (frequent ? 52 : 24) + (random() + random() + random() - 1.5) * 24,
    );
    return { id, frequent, value: Math.max(0, minutes) };
  });
}

export function finiteSE(values, n) {
  const size = values.length;
  if (!size || n < 1 || n > size) return NaN;
  if (size === 1 || n === size) return 0;
  // sigma is population SD with divisor N. SRS is without replacement.
  return (sd(values) / Math.sqrt(n)) * Math.sqrt((size - n) / (size - 1));
}

export function samplePopulation(people, n, method, seed, trial = 0) {
  const random = rng((Number(seed) + Math.imul(trial, 0x9e3779b9)) >>> 0);
  const remaining = [...people];
  const sample = [];
  const count = Math.min(people.length, Math.max(1, Math.trunc(n)));
  for (let i = 0; i < count; i++) {
    // A weighted draw without replacement deliberately over-represents frequent users.
    const weight = (person) => (method === "biased" && person.frequent ? 7 : 1);
    const totalWeight = remaining.reduce(
      (total, person) => total + weight(person),
      0,
    );
    let target = random() * totalWeight;
    let selected = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      target -= weight(remaining[j]);
      if (target < 0) {
        selected = j;
        break;
      }
    }
    sample.push(remaining.splice(selected, 1)[0]);
  }
  return sample;
}

export function simulateSample(people, n, method, seed, trial = 0) {
  const sample = samplePopulation(people, n, method, seed, trial);
  const values = people.map((person) => person.value);
  const center = mean(sample.map((person) => person.value));
  const se = finiteSE(values, sample.length);
  const truth = mean(values);
  const low = center - 1.96 * se;
  const high = center + 1.96 * se;
  return {
    mean: center,
    low,
    high,
    covers: low <= truth && truth <= high,
    indices: sample.map((person) => person.id),
  };
}

export function newExperiment(overrides = {}) {
  const options = { n: 20, method: "random", seed: 20261015, ...overrides };
  const people = population(options.customPopulation);
  options.n = Math.min(people.length, Math.max(1, Math.trunc(options.n)));
  const first = simulateSample(people, options.n, options.method, options.seed);
  return {
    ...options,
    signature: `${options.n}/${options.method}/${options.seed}/${options.customPopulation ? JSON.stringify(options.customPopulation) : "sample"}`,
    trials: 1,
    history: [
      {
        mean: first.mean,
        low: first.low,
        high: first.high,
        covers: first.covers,
      },
    ],
    last: first.indices,
  };
}

export function normalizeExperiment(state) {
  const people = population(state.customPopulation);
  const n = Math.min(
    people.length,
    Math.max(1, Math.trunc(Number(state.n) || 20)),
  );
  const method = state.method === "biased" ? "biased" : "random";
  const seed = Number.isFinite(Number(state.seed))
    ? Number(state.seed) >>> 0
    : 20261015;
  const signature = `${n}/${method}/${seed}/${state.customPopulation ? JSON.stringify(state.customPopulation) : "sample"}`;
  if (!state.customPopulation && state.signature === `${n}/${method}/${seed}`)
    state = { ...state, signature };
  if (
    state.signature !== signature ||
    !Array.isArray(state.history) ||
    !Array.isArray(state.last) ||
    !state.history.length
  ) {
    return newExperiment({ ...state, n, method, seed });
  }
  return { ...state, n, method, seed };
}

export function addTrials(state, count, replay = false) {
  const current = normalizeExperiment(state);
  const people = population(current.customPopulation);
  const history = replay ? [] : [...current.history];
  const first = replay ? 0 : current.trials;
  const end = Math.min(2000, first + Math.max(0, Math.trunc(count)));
  let last = current.last;
  for (let trial = first; trial < end; trial++) {
    const result = simulateSample(
      people,
      current.n,
      current.method,
      current.seed,
      trial,
    );
    const { indices, ...summary } = result;
    history.push(summary);
    last = indices;
  }
  return { ...current, history, trials: end, last };
}
