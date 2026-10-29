import test from "node:test";
import assert from "node:assert/strict";
import { redistribute, transfer, cumulativeRows } from "./lab.mjs";
import { gini, sum } from "../shared/math.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test("locked editing preserves total and proportions of other recipients", () => {
  const result = redistribute([10, 20, 30], 0, 30, true);
  close(sum(result), 60);
  assert.deepEqual(result, [30, 12, 18]);
  assert.deepEqual(redistribute([10, 0, 0], 0, 4, true), [4, 3, 3]);
  assert.deepEqual(redistribute([0, 0], 0, 10, true), [0, 0]);
  assert.deepEqual(redistribute([10, 20], 0, 100, true), [30, 0]);
});
test("transfers cannot create negative income and conserve total", () => {
  assert.deepEqual(transfer([10, 20], 0, 1, 99), [0, 30]);
  assert.deepEqual(transfer([10, 20], 0, 0, 5), [10, 20]);
  assert.deepEqual(redistribute([10, 20], 0, 50, false), [50, 20]);
});
test("same-Gini comparison has distinct cumulative curves", () => {
  const a = [0, 2, 2, 4],
    b = [1, 1, 1, 5];
  close(gini(a), 0.375);
  close(gini(b), 0.375);
  assert.notDeepEqual(
    cumulativeRows(a).map((r) => r.share),
    cumulativeRows(b).map((r) => r.share),
  );
  close(
    cumulativeRows(a).reduce((v, r) => v + r.area, 0),
    0.3125,
  );
});
test("zero total has no normalized cumulative income", () => {
  assert.equal(gini([0, 0]), null);
  assert.ok(
    cumulativeRows([0, 0]).every((r) => r.share === null && r.area === null),
  );
});
