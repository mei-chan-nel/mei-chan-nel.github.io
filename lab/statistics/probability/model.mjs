import { rng, normal, normalCDF, binomialPMF } from "../shared/math.mjs";

export function coinExperiment(p, count, seed) {
  const random = rng(Number(seed) >>> 0);
  const path = [];
  const tosses = [];
  let successes = 0;
  for (let i = 0; i < count; i++) {
    const success = random() < p;
    if (success) successes++;
    tosses.push(success);
    path.push({ x: i + 1, y: successes / (i + 1) });
  }
  return { successes, path, tosses };
}

export function binomialExperiment(n, p, repetitions, seed) {
  const random = rng((Number(seed) ^ 0xa53a9b7d) >>> 0);
  const counts = Array(n + 1).fill(0);
  const outcomes = [];
  for (let repetition = 0; repetition < repetitions; repetition++) {
    let successes = 0;
    for (let trial = 0; trial < n; trial++) if (random() < p) successes++;
    counts[successes]++;
    outcomes.push(successes);
  }
  const theory = binomialPMF(n, p);
  const observedMean = repetitions
    ? counts.reduce((total, count, k) => total + k * count, 0) / repetitions
    : NaN;
  return { counts, theory, observedMean, outcomes };
}

export function normalInterval(mu, sigma, low, high) {
  if (!(sigma > 0) || low > high)
    return { probability: NaN, zLow: NaN, zHigh: NaN };
  const zLow = (low - mu) / sigma;
  const zHigh = (high - mu) / sigma;
  return {
    probability: Math.max(0, Math.min(1, normalCDF(zHigh) - normalCDF(zLow))),
    zLow,
    zHigh,
  };
}

export function normalDensity(x, mu = 0, sigma = 1) {
  return (
    Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
  );
}

export function normalizeState(state) {
  const bounded = (value, fallback, min, max) =>
    Math.min(
      max,
      Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback),
    );
  const measured = state.observed?.mode === "normal";
  const low = bounded(
    state.low,
    40,
    measured ? -1e7 : -200,
    measured ? 1e7 : 200,
  );
  const high = bounded(
    state.high,
    60,
    measured ? -1e7 : -200,
    measured ? 1e7 : 200,
  );
  return {
    mode: ["coin", "binomial", "normal"].includes(state.mode)
      ? state.mode
      : "coin",
    p: bounded(state.p, 0.5, 0, 1),
    n: Math.round(bounded(state.n, 12, 1, 40)),
    tossCount: Math.round(bounded(state.tossCount, 100, 0, 10000)),
    repetitions: Math.round(bounded(state.repetitions, 100, 0, 10000)),
    seed: bounded(state.seed, 20261015, 0, 4294967295) >>> 0,
    mu: bounded(state.mu, 50, measured ? -1e6 : -50, measured ? 1e6 : 100),
    sigma: bounded(state.sigma, 10, measured ? 1e-8 : 1, measured ? 2e6 : 30),
    low: Math.min(low, high),
    high: Math.max(low, high),
    early: Boolean(state.early),
    ...(state.dataInfo ? { dataInfo: state.dataInfo } : {}),
    ...(state.observed &&
    ["coin", "binomial", "normal"].includes(state.observed.mode) &&
    Array.isArray(state.observed.values)
      ? { observed: state.observed }
      : {}),
  };
}

export function observationValues(state) {
  if (state.observed?.mode === state.mode) return state.observed.values;
  if (state.mode === "coin")
    return coinExperiment(state.p, state.tossCount, state.seed).tosses.map(
      Number,
    );
  if (state.mode === "binomial")
    return binomialExperiment(state.n, state.p, state.repetitions, state.seed)
      .outcomes;
  const random = rng(state.seed);
  return Array.from(
    { length: 200 },
    () => state.mu + normal(random) * state.sigma,
  );
}
export function observedCoin(values) {
  let successes = 0;
  const path = values.map((v, i) => {
    successes += v;
    return { x: i + 1, y: successes / (i + 1) };
  });
  return { successes, path, tosses: values.map(Boolean) };
}
export function observedBinomial(n, p, values) {
  const counts = Array(n + 1).fill(0);
  values.forEach((v) => counts[v]++);
  return {
    counts,
    theory: binomialPMF(n, p),
    observedMean: values.reduce((a, b) => a + b, 0) / values.length,
    outcomes: values,
  };
}
