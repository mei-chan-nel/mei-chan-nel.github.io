import test from "node:test";
import assert from "node:assert/strict";
import {
  population,
  finiteSE,
  samplePopulation,
  simulateSample,
  newExperiment,
  addTrials,
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
