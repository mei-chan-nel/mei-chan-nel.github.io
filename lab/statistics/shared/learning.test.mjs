import test from "node:test";
import assert from "node:assert/strict";
import { boxSummary } from "../summary/lab.mjs";
import { insight } from "./insights.mjs";
import correlation from "../correlation/lab.mjs";
import { newExperiment } from "../sampling/model.mjs";
test("school box plots use sample extremes by default, while 1.5IQR is a separate presentation of the same quartiles", () => {
  const values = [10, 11, 12, 13, 14, 15, 16, 100];
  const school = boxSummary(values),
    advanced = boxSummary(values, "iqr");
  assert.equal(school.lower, 10);
  assert.equal(school.upper, 100);
  assert.deepEqual(school.outliers, []);
  assert.equal(advanced.lower, 10);
  assert.equal(advanced.upper, 16);
  assert.deepEqual(advanced.outliers, [100]);
  assert.equal(school.q1, advanced.q1);
  assert.equal(school.q2, advanced.q2);
  assert.equal(school.q3, advanced.q3);
  assert.equal(boxSummary([1, 1, 1, 1, 1, 1, 1, 9]).upper, 9);
  assert.deepEqual(boxSummary([1, 1, 1, 1, 1, 1, 1, 9], "iqr").outliers, [9]);
});
test("correlation feedback uses the actual training set when validating a held-out point", () => {
  const state = {
    ...correlation.initial(),
    points: [
      { id: "a", x: 1, y: 1 },
      { id: "b", x: 2, y: 2 },
      { id: "c", x: 10, y: -10 },
    ],
    selectedId: "c",
    excludeSelected: true,
  };
  assert.match(insight("correlation", state), /学習用 2組の r=1\.000/);
  assert.doesNotMatch(insight("correlation", state), /現在 -/);
});
test("a without-replacement census is exact, while replacement does not imply a census", () => {
  const s = newExperiment({
    n: 3,
    method: "without",
    customPopulation: [
      { value: 10 },
      { value: 20 },
      { value: 80, frequent: true },
    ],
  });
  assert.match(insight("sampling", s), /全数調査/);
  assert.doesNotMatch(insight("sampling", s), /偏りが必ず/);
  const replacement = newExperiment({ ...s, method: "with" });
  assert.doesNotMatch(insight("sampling", replacement), /全数調査/);
});
