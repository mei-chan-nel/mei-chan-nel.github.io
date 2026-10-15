import test from "node:test";
import assert from "node:assert/strict";
import { parseRows, displayedRows, distribution } from "./lab.mjs";
test("raw rows accept negatives, explicit and omitted groups, and reject ambiguous data", () => {
  assert.deepEqual(
    parseRows("0,A\n-3 B\n2").map((r) => [r.value, r.group]),
    [
      [0, "A"],
      [-3, "B"],
      [2, "A"],
    ],
  );
  assert.throws(() => parseRows("x,A"));
  assert.throws(() => parseRows("3,C"));
  assert.throws(() => parseRows(""));
});
test("half-open histogram bins include values below anchor and preserve group totals", () => {
  const rows = parseRows("-5,A\n0,B\n5,A\n10,B\n10,B");
  const bins = distribution(rows, 5, 0);
  assert.deepEqual(
    bins.map((b) => [b.lo, b.count, b.a, b.b]),
    [
      [-5, 1, 1, 0],
      [0, 1, 0, 1],
      [5, 1, 1, 0],
      [10, 2, 0, 2],
    ],
  );
  assert.equal(
    bins.reduce((a, b) => a + b.count, 0),
    5,
  );
  assert.equal(bins.at(-1).cumulative, 1);
  assert.ok(Math.abs(bins.reduce((a, b) => a + b.relative, 0) - 1) < 1e-12);
});
test("shifting one group does not mutate source data or the other group", () => {
  const rows = parseRows("10,A\n20,B");
  assert.deepEqual(
    displayedRows({ rows, shiftB: -7 }).map((r) => r.value),
    [10, 13],
  );
  assert.equal(rows[1].value, 20);
});

test("decimal boundary values belong to the interval beginning at that boundary", () => {
  const bins = distribution(parseRows("0.1,A\n0.2,B\n0.3,A"), 0.1, 0);
  assert.deepEqual(
    bins.map((b) => b.count),
    [1, 1, 1],
  );
  assert.deepEqual(
    bins.map((b) => [b.a, b.b]),
    [
      [1, 0],
      [0, 1],
      [1, 0],
    ],
  );
});
