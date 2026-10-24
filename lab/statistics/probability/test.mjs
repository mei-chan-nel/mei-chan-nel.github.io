import test from "node:test";
import assert from "node:assert/strict";
import {
  coinExperiment,
  binomialExperiment,
  normalInterval,
  normalizeState,
} from "./model.mjs";

test("coin experiment is reproducible and appending trials preserves the prefix", () => {
  const short = coinExperiment(0.43, 100, 44);
  const long = coinExperiment(0.43, 1000, 44);
  assert.deepEqual(short, coinExperiment(0.43, 100, 44));
  assert.deepEqual(short.path, long.path.slice(0, 100));
  assert.equal(short.path.at(-1).y, short.successes / 100);
});

test("probability zero and one have exact degenerate outcomes", () => {
  assert.equal(coinExperiment(0, 100, 7).successes, 0);
  assert.equal(coinExperiment(1, 100, 7).successes, 100);
  for (const p of [0, 1]) {
    const result = binomialExperiment(20, p, 100, 7);
    assert.equal(result.counts[p * 20], 100);
    assert.equal(result.theory[p * 20], 1);
    assert.equal(
      result.theory.reduce((total, value) => total + value, 0),
      1,
    );
  }
});

test("binomial frequency has the expected mean and probabilities sum to one", () => {
  const result = binomialExperiment(20, 0.3, 10000, 99);
  assert.equal(
    result.counts.reduce((total, count) => total + count, 0),
    10000,
  );
  assert.ok(
    Math.abs(result.theory.reduce((total, value) => total + value, 0) - 1) <
      1e-10,
  );
  assert.ok(Math.abs(result.observedMean - 6) < 0.1);
});

test("standardization preserves normal interval probability", () => {
  const first = normalInterval(50, 10, 40, 60);
  const standardized = normalInterval(0, 1, -1, 1);
  assert.ok(Math.abs(first.probability - 0.682689492) < 1e-6);
  assert.equal(first.probability, standardized.probability);
  assert.equal(first.zLow, -1);
  assert.equal(normalInterval(50, 10, 50, 50).probability, 0);
  assert.ok(Number.isNaN(normalInterval(50, 0, 40, 60).probability));
});

test("imported interval endpoints are ordered and simulation size is bounded", () => {
  const state = normalizeState({
    low: 70,
    high: 30,
    tossCount: 1e8,
    sigma: -2,
  });
  assert.equal(state.low, 30);
  assert.equal(state.high, 70);
  assert.equal(state.tossCount, 10000);
  assert.equal(state.sigma, 1);
});
