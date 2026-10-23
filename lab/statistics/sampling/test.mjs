import test from "node:test";
import assert from "node:assert/strict";
import {
  population,
  finiteSE,
  samplePopulation,
  simulateSample,
  newExperiment,
  addTrials,
  samplingDomain,
  experimentSummary,
} from "./model.mjs";

test("SRS is reproducible, without replacement, and becomes an exact census", () => {
  const people = population();
  const first = samplePopulation(people, 20, "random", 17);
  assert.deepEqual(first, samplePopulation(people, 20, "random", 17));
  assert.equal(new Set(first.map((person) => person.id)).size, 20);
  const result = simulateSample(people, 120, "random", 19);
  assert.equal(result.low, result.high);
  assert.equal(result.covers, true);
  assert.equal(
    finiteSE(
      people.map((person) => person.value),
      120,
    ),
    0,
  );
});

test("finite population correction uses sigma with divisor N", () => {
  assert.ok(Math.abs(finiteSE([0, 2], 1) - 1) < 1e-12);
  assert.equal(finiteSE([0, 2], 2), 0);
  assert.ok(Number.isNaN(finiteSE([0, 2], 3)));
});

test("repeated SRS estimates center near truth while biased selection shifts upward", () => {
  const people = population();
  const truth =
    people.reduce((total, person) => total + person.value, 0) / people.length;
  const simulate = (method) =>
    Array.from({ length: 1000 }, (_, trial) =>
      simulateSample(people, 15, method, 31, trial),
    );
  const average = (results) =>
    results.reduce((total, result) => total + result.mean, 0) / results.length;
  const randomResults = simulate("random");
  const randomAverage = average(randomResults);
  assert.ok(Math.abs(randomAverage - truth) < 0.8);
  assert.ok(average(simulate("biased")) > truth + 7);
  const experimentalSE = Math.sqrt(
    randomResults.reduce(
      (total, result) => total + (result.mean - randomAverage) ** 2,
      0,
    ) / 999,
  );
  assert.ok(
    Math.abs(
      experimentalSE /
        finiteSE(
          people.map((person) => person.value),
          15,
        ) -
        1,
    ) < 0.12,
  );
  const coverage =
    randomResults.filter((result) => result.covers).length /
    randomResults.length;
  assert.ok(coverage > 0.9 && coverage < 0.99);
});

test("replay matches all estimates and the last highlighted sample", () => {
  const experiment = addTrials(newExperiment(), 99);
  const replay = addTrials(experiment, experiment.trials, true);
  assert.deepEqual(replay, experiment);
  assert.equal(replay.history.length, 100);
});

test("a common centered axis contains every possible sample mean and reference interval", () => {
  const values = [-12, -2, 1, 8, 24];
  const truth = values.reduce((a, b) => a + b, 0) / values.length;
  for (let n = 1; n <= values.length; n++) {
    const d = samplingDomain(values, n),
      half = 1.96 * finiteSE(values, n);
    assert.ok(Math.abs((d.xmin + d.xmax) / 2 - truth) < 1e-12);
    for (let mask = 0; mask < 2 ** values.length; mask++) {
      const subset = values.filter((_, i) => mask & (1 << i));
      if (subset.length !== n) continue;
      const estimate = subset.reduce((a, b) => a + b, 0) / n;
      assert.ok(estimate - half > d.xmin);
      assert.ok(estimate + half < d.xmax);
    }
    for (const method of ["random", "biased"]) {
      const state = addTrials(
        newExperiment({
          customPopulation: values.map((value, i) => ({
            value,
            frequent: i % 2 === 0,
          })),
          n,
          method,
        }),
        99,
      );
      for (const result of state.history) {
        assert.ok(result.low >= d.xmin);
        assert.ok(result.high <= d.xmax);
      }
      assert.deepEqual(
        samplingDomain(values, n),
        d,
        "draw history and method never move the scale",
      );
    }
  }
  const constant = samplingDomain([0, 0], 2);
  assert.ok(constant.xmax > constant.xmin);
});

test("coverage and error summaries include every trial and distinguish misses", () => {
  const s = experimentSummary(
    [
      { mean: 2, low: 1, high: 3 },
      { mean: 5, low: 4, high: 6 },
      { mean: 3, low: 2, high: 4 },
    ],
    3,
  );
  assert.equal(s.covered, 2);
  assert.equal(s.missed, 1);
  assert.equal(s.coverage, 2 / 3);
  assert.equal(s.center, 10 / 3);
  assert.ok(Math.abs(s.rmse - Math.sqrt(5 / 3)) < 1e-12);
  assert.equal(experimentSummary([], 3).coverage, null);
  assert.equal(
    experimentSummary([{ mean: 3, low: 3, high: 3 }], 3).spread,
    null,
  );
});

test("decimal-valued censuses remain exact regardless of their randomized order", () => {
  const customPopulation = [0.1, 0.2, 0.4, 0.8].map((value, i) => ({
    value,
    frequent: i % 2 === 0,
  }));
  for (const method of ["random", "biased"]) {
    const s = addTrials(newExperiment({ customPopulation, n: 4, method }), 99);
    const truth = customPopulation.reduce((a, p) => a + p.value, 0) / 4;
    for (const r of s.history) {
      assert.equal(r.mean, truth);
      assert.equal(r.low, truth);
      assert.equal(r.high, truth);
      assert.equal(r.covers, true);
    }
    assert.equal(experimentSummary(s.history, truth).coverage, 1);
  }
});
