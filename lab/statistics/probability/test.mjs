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

import {
  createExperiment,
  normalizeLabState,
  startExperiment,
  experimentSummary,
  intervalComparison,
  validateSettings,
} from "./experiment.mjs";
test("one experiment supplies the same tosses and success counts to every reading", () => {
  const e = createExperiment(0.37, 20, 200, 42),
    d = experimentSummary(e);
  assert.deepEqual(e, createExperiment(0.37, 20, 200, 42));
  assert.equal(e.sets.length, 200);
  assert.ok(e.sets.every((row) => row.length === 20));
  assert.deepEqual(d.tosses, e.sets.flat());
  assert.deepEqual(
    d.outcomes,
    e.sets.map((row) => row.reduce((a, b) => a + b, 0)),
  );
  assert.equal(
    d.counts.reduce((a, b) => a + b, 0),
    200,
  );
  assert.equal(
    d.successes,
    d.outcomes.reduce((a, b) => a + b, 0),
  );
  assert.ok(Math.abs(d.mean / e.n - d.path.at(-1).y) < 1e-12);
  assert.ok(Math.abs(d.theory.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});
test("a new condition creates a new record and preserves prior observations", () => {
  const a = startExperiment(normalizeLabState(), 0.5, 20, 100, 42),
    before = JSON.stringify(a.experiments);
  const b = startExperiment(a, 0.2, 100, 100, 43);
  assert.equal(a.experiments.length, 1);
  assert.equal(JSON.stringify(a.experiments), before);
  assert.deepEqual(b.experiments[0], a.experiments[0]);
  assert.equal(b.experiments.length, 2);
  const selected = normalizeLabState({
    ...b,
    activeId: 1,
    intervalLow: 0,
    intervalHigh: 20,
  });
  assert.deepEqual(selected.experiments, b.experiments);
});
test("event proportions, binomial probabilities and continuity corrected normal areas agree with their definitions", () => {
  const e = createExperiment(0.5, 20, 200, 42),
    c = intervalComparison(e, 8, 12),
    d = experimentSummary(e);
  assert.equal(c.low, 7.5);
  assert.equal(c.high, 12.5);
  assert.equal(c.count, d.outcomes.filter((k) => k >= 8 && k <= 12).length);
  assert.equal(
    c.exact,
    d.theory.slice(8, 13).reduce((a, b) => a + b, 0),
  );
  assert.equal(
    c.normal.probability,
    normalInterval(10, Math.sqrt(5), 7.5, 12.5).probability,
  );
  assert.equal(
    c.normal.probability,
    normalInterval(0, 1, c.normal.zLow, c.normal.zHigh).probability,
  );
  assert.ok(c.adequate);
  assert.equal(intervalComparison(e, 0, 20).count, 200);
});
test("degenerate trials and poor normal approximations remain explicit", () => {
  for (const p of [0, 1])
    for (const n of [1, 200]) {
      const e = createExperiment(p, n, 100, 1),
        d = experimentSummary(e),
        c = intervalComparison(e, p * n, p * n);
      assert.equal(d.sigma, 0);
      assert.equal(c.normal, null);
      assert.equal(c.count, 100);
      assert.equal(c.exact, 1);
      assert.equal(d.counts[p * n], 100);
    }
  assert.equal(
    intervalComparison(createExperiment(0.02, 20, 100, 1), 0, 1).adequate,
    false,
  );
  assert.throws(() => validateSettings(0.5, 200, 101));
  assert.throws(() => validateSettings(0.5, 1, 0));
  assert.throws(() => validateSettings(1.01, 20, 100));
  assert.throws(() => validateSettings(0.5, 20.1, 100));
});
test("legacy uploaded values are retained as a separate exportable dataset", () => {
  const s = normalizeLabState({
    mode: "normal",
    observed: {
      mode: "normal",
      label: "身長（cm）",
      values: [151.5, 162.3, 180.2],
    },
    dataInfo: { name: "以前の測定" },
  });
  assert.deepEqual(s.legacyData.values, [151.5, 162.3, 180.2]);
  assert.equal(s.experiments.length, 0);
  const next = startExperiment(s, 0.5, 20, 100, 42);
  assert.deepEqual(next.legacyData, s.legacyData);
  assert.equal(next.observed, undefined);
});

test("the learning route stays fixed across legacy data kinds", async () => {
  const { learningViews, dataStep } = await import("../learning.mjs");
  for (const mode of ["coin", "binomial", "normal"]) {
    assert.equal(dataStep("probability").title, "実験の準備");
    assert.deepEqual(
      learningViews("probability", { mode }).map((v) => v.title),
      ["相対度数", "二項分布", "正規分布", "標準化"],
    );
  }
});
