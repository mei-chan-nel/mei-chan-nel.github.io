import test from "node:test";
import assert from "node:assert/strict";
import { parseRows, displayedRows, distribution } from "./lab.mjs";
import { normalizeHistogram, stackedBars, niceWidth } from "./model.mjs";
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

test("stacked groups share a class interval and add to the combined count and relative frequency", () => {
  const bins = distribution(parseRows("0,A\n1,B\n2,B\n10,A\n11,B"), 10, 0);
  const bars = stackedBars(bins, 5, "split", "count");
  assert.deepEqual(
    bars.map((b) => [b.lo, b.hi, b.bottom, b.top]),
    [
      [0, 10, 0, 1],
      [0, 10, 1, 3],
      [10, 20, 0, 1],
      [10, 20, 1, 2],
    ],
  );
  const relative = stackedBars(bins, 5, "split", "relative");
  assert.equal(relative[1].top, 0.6);
  assert.equal(relative[3].top, 0.4);
  assert.ok(
    Math.abs(relative.reduce((sum, b) => sum + b.top - b.bottom, 0) - 1) <
      1e-12,
  );
});

test("legacy group offsets become actual editable observations exactly once", () => {
  const state = {
    rows: parseRows("10,A\n20,B\n30,B"),
    shiftB: -7,
    width: 10,
    start: 0,
    measure: "count",
  };
  const next = normalizeHistogram(state);
  assert.deepEqual(
    next.rows.map((r) => r.value),
    [10, 13, 23],
  );
  assert.equal(next.shiftB, 0);
  assert.deepEqual(normalizeHistogram(next), next);
  assert.equal(state.rows[1].value, 20);
  assert.equal(niceWidth(50), 10);
  assert.equal(niceWidth(0), 1);
  assert.equal(
    normalizeHistogram({
      ...state,
      rows: parseRows("10,A\n20,A"),
      mode: "split",
    }).mode,
    "combined",
  );
});
