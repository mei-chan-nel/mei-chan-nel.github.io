import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  variance,
  sd,
  median,
  quartiles,
  regression,
  histogram,
  rng,
  binomialPMF,
  normalCDF,
  gini,
  lorenz,
} from "./math.mjs";
import { validateDataset, defaultDataset } from "./data.mjs";
test("school quartiles exclude center and population/sample variances differ", () => {
  const a = [1, 2, 3, 4, 10];
  assert.equal(mean(a), 4);
  assert.equal(median(a), 3);
  assert.equal(variance(a), 10);
  assert.equal(variance(a, true), 12.5);
  assert.deepEqual(quartiles(a), { q1: 1.5, q2: 3, q3: 7 });
  assert.equal(sd([]), null);
});
test("OLS exact line and undefined zero variance", () => {
  assert.deepEqual(
    regression([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]),
    { r: 1, slope: 2, intercept: 0, sse: 0 },
  );
  assert.equal(
    regression([
      { x: 1, y: 2 },
      { x: 1, y: 4 },
    ]).slope,
    null,
  );
  assert.equal(
    regression([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]).r,
    null,
  );
});
test("histogram retains all negative/start-shift data and boundary counts", () => {
  const b = histogram([-2, -1, 0, 1, 2, 3], 2, 1);
  assert.equal(
    b.reduce((s, x) => s + x.count, 0),
    6,
  );
  assert.equal(b.at(-1).cumulative, 1);
  assert.deepEqual(
    histogram([0, 1, 2, 3], 2, 0).map((b) => b.count),
    [2, 2],
  );
  assert.equal(histogram([0.3], 0.1, 0)[0].lo, 0.30000000000000004);
});
test("reproducible PRNG and valid binomial degenerate/central distribution", () => {
  const a = rng(42),
    b = rng(42);
  assert.deepEqual(
    Array.from({ length: 20 }, a),
    Array.from({ length: 20 }, b),
  );
  assert.deepEqual(binomialPMF(2, 0.5), [0.25, 0.5, 0.25]);
  assert.deepEqual(binomialPMF(2, 0), [1, 0, 0]);
  assert.deepEqual(binomialPMF(2, 1), [0, 0, 1]);
  assert.ok(Math.abs(normalCDF(1) - normalCDF(-1) - 0.68268949) < 1e-6);
});
test("Lorenz normalized area and undefined all-zero total", () => {
  assert.equal(gini([10, 10, 10, 10]), 0);
  assert.equal(gini([0, 0, 0, 100]), 0.75);
  assert.equal(gini([0, 0]), null);
  assert.equal(lorenz([0, 0]), null);
  assert.deepEqual(lorenz([1, 1]).at(-1), { x: 1, y: 1 });
});
test("project data rejects nonfinite and preserves the published monthly pairs", () => {
  assert.equal(validateDataset(defaultDataset()).rows.length, 120);
  assert.throws(() =>
    validateDataset({
      name: "bad",
      rows: [
        { x: NaN, y: 2 },
        { x: 1, y: 2 },
      ],
    }),
  );
});
import { validateState, validateDocument } from "./validation.mjs";
import { number } from "./ui.mjs?v=20261024-ts-axis";
test("saved experiments validate types and escape all number attributes", () => {
  const template = { n: 2, rows: [{ id: "a", x: 1 }], reference: null };
  validateDocument(
    {
      version: 1,
      id: "lab",
      state: template,
      notes: { 0: "予想", done0: true },
    },
    "lab",
    template,
  );
  assert.throws(() =>
    validateState(
      { n: '2" onclick="alert(1)', rows: [], reference: null },
      template,
    ),
  );
  assert.throws(() =>
    validateDocument(
      { version: 1, id: "lab", state: template, snapshot: [] },
      "lab",
      template,
    ),
  );
  assert.throws(() =>
    validateDocument(
      { version: 1, id: "lab", state: template, notes: { 0: { bad: true } } },
      "lab",
      template,
    ),
  );
  assert.ok(
    number("n", "label", '0" onfocus="bad', 0, 1).includes(
      'value="0&quot; onfocus=&quot;bad"',
    ),
  );
});
