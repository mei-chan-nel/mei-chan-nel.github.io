import test from "node:test";
import assert from "node:assert/strict";
import lab, { rebalance, scaleSpread } from "./lab.mjs";
import { mean, variance, sd, quartiles, rng } from "../shared/math.mjs";

const near = (a, b, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) < tol, `${a} differs from ${b}`);

test("fixed-mean movement preserves the sum, even with saturated neighbours", () => {
  const examples = [
    { values: [0, 0, 90, 100], index: 0, target: 100 },
    { values: [0, 0, 0, 20], index: 3, target: 100 },
    { values: [90, 100, 100, 100], index: 0, target: 0 },
    { values: [-15, 10, 70, 100], index: 0, target: 100, min: -20 },
  ];
  for (const { values, index, target, min = 0 } of examples) {
    const next = rebalance(values, index, target, min, 100);
    near(mean(next), mean(values));
    assert.ok(next.every((v) => v >= min - 1e-8 && v <= 100 + 1e-8));
  }
  assert.deepEqual(rebalance([50], 0, 0), [50]);
});

test("repeated edits preserve a locked mean without accumulated boundary drift", () => {
  const random = rng(321),
    initial = lab.initial().points.map((p) => p.value),
    average = mean(initial);
  let values = [...initial];
  for (let i = 0; i < 500; i++) {
    values = rebalance(
      values,
      Math.floor(random() * values.length),
      random() * 100,
    );
    near(mean(values), average, 1e-7);
    assert.ok(values.every((v) => v >= -1e-7 && v <= 100 + 1e-7));
  }
});

test("doubling all deviations quadruples variance and doubles standard deviation", () => {
  const values = [50, 52, 54, 56, 58, 60, 60, 62, 64, 66, 68, 70];
  const scaled = scaleSpread(values, 2);
  near(scaled.factor, 2);
  near(mean(scaled.values), mean(values));
  near(variance(scaled.values), variance(values) * 4);
  near(sd(scaled.values), sd(values) * 2);
});

test("scaling stops at bounds instead of clipping and shifting the mean", () => {
  const values = [0, 20, 30, 90, 100],
    next = scaleSpread(values, 2.5);
  assert.ok(next.factor < 2.5);
  near(mean(next.values), mean(values));
  assert.ok(next.values.every((v) => v >= 0 && v <= 100));
  assert.deepEqual(scaleSpread([60, 60, 60], 2).values, [60, 60, 60]);
});

test("quartiles match the stated median-of-halves convention; variance definitions differ", () => {
  assert.deepEqual(quartiles([1, 2, 3, 4, 5]), { q1: 1.5, q2: 3, q3: 4.5 });
  assert.deepEqual(quartiles([1, 2, 3, 4]), { q1: 1.5, q2: 2.5, q3: 3.5 });
  const values = [2, 4, 6];
  near(variance(values, true), (variance(values) * 3) / 2);
});
