import test from "node:test";
import assert from "node:assert/strict";
import {
  makeInitial,
  normalizeState,
  matrixFor,
  cellSummary,
  successRate,
  equalCompositionRates,
  setComposition,
  editCount,
} from "./lab.mjs";

test("original strata give Simpson reversal: A higher within each stratum, B higher overall", () => {
  const state = makeInitial();
  assert.deepEqual(matrixFor(state.strata), [
    [42, 58],
    [68, 32],
  ]);
  for (const s of state.strata)
    assert.ok(successRate(s.counts, 0) > successRate(s.counts, 1));
  assert.ok(
    successRate(matrixFor(state.strata), 0) <
      successRate(matrixFor(state.strata), 1),
  );
});

test("row, column and cell ratios use their own exact denominators", () => {
  const matrix = matrixFor(makeInitial().strata);
  assert.deepEqual(cellSummary(matrix, 1, 0, "row"), {
    numerator: 68,
    denominator: 100,
    ratio: 0.68,
    count: false,
  });
  assert.equal(cellSummary(matrix, 1, 0, "column").denominator, 110);
  assert.equal(cellSummary(matrix, 1, 0, "column").ratio, 68 / 110);
  assert.equal(cellSummary(matrix, 1, 0, "cell").ratio, 68 / 200);
  assert.equal(cellSummary(matrix, 1, 0, "count").count, true);
});

test("empty denominators and missing strata remain undefined rather than becoming zero rates", () => {
  const matrix = [
    [0, 0],
    [0, 0],
  ];
  assert.equal(cellSummary(matrix, 0, 0, "row").ratio, null);
  assert.equal(successRate(matrix, 0), null);
  const state = makeInitial();
  state.strata[0].counts[0] = [0, 0];
  assert.equal(equalCompositionRates(state.strata, 0.5)[0], null);
  assert.equal(equalCompositionRates(state.strata, 0)[0], 0.3);
});

test("common-composition rates isolate the differing stratum proportions", () => {
  const rates = equalCompositionRates(makeInitial().strata, 0.5);
  assert.ok(Math.abs(rates[0] - 0.6) < 1e-12);
  assert.ok(Math.abs(rates[1] - 0.5) < 1e-12);
});

test("composition changes preserve group totals, integer counts, and stable anchor rates", () => {
  const initial = makeInitial();
  let state = initial;
  for (const share of [0, 99, 37, 100, 20]) {
    state = setComposition(state, 0, share);
    const cells = state.strata.flatMap((s) => s.counts[0]);
    assert.equal(
      cells.reduce((a, b) => a + b, 0),
      100,
    );
    assert.ok(cells.every((n) => Number.isInteger(n) && n >= 0));
  }
  assert.deepEqual(state.strata, initial.strata);
  assert.deepEqual(initial, makeInitial(), "source state is never mutated");
});

test("redistribution does not truncate a large editable table when concentrating everyone in one stratum", () => {
  const state = makeInitial();
  for (const s of state.strata) s.counts[0] = [10000, 10000];
  const redistributed = setComposition(setComposition(state, 0, 100), 0, 0);
  assert.equal(
    matrixFor(redistributed.strata)[0].reduce((a, b) => a + b),
    40000,
  );
});

test("direct count edits update redistribution anchors; both empty preserves last meaningful rate", () => {
  const initial = makeInitial();
  const edited = editCount(initial, 0, 0, 0, 2);
  assert.equal(edited.anchors[0][0], 0.5);
  const empty = editCount(editCount(edited, 0, 0, 0, 0), 0, 0, 1, 0);
  assert.equal(empty.anchors[0][0], 0);
  assert.deepEqual(initial, makeInitial());
});

test("state normalization enforces integer nonnegative counts and valid selections", () => {
  const normalized = normalizeState({
    strata: [
      {
        counts: [
          [-1, 4.5],
          [Infinity, 999999],
        ],
      },
    ],
    mode: "bad",
    selectedScope: "wrong",
  });
  assert.deepEqual(normalized.strata[0].counts, [
    [0, 5],
    [0, 999999],
  ]);
  assert.equal(normalized.mode, "row");
  assert.equal(normalized.selectedScope, "all");
});
