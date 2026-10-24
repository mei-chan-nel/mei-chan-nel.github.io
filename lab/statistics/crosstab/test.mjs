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

import {
  recordsFor,
  aggregateRecords,
  labelsForRecords,
  tableValues,
  defaultLabels,
} from "./records.mjs";
import { applyData, currentData } from "../shared/data-model.mjs";
import { applyTableRows } from "../shared/table-data.mjs";

test("individual records round-trip through CSV data and aggregate exactly once per person", () => {
  const initial = makeInitial(),
    rows = recordsFor(initial);
  assert.equal(rows.length, 200);
  assert.deepEqual(aggregateRecords(rows, defaultLabels), initial.strata);
  const imported = applyData("crosstab", initial, {
    headers: ["課題難度", "方式", "結果"],
    rows,
    name: "記録",
  });
  assert.deepEqual(currentData("crosstab", imported).rows, rows);
  assert.deepEqual(normalizeState(imported).strata, initial.strata);
});
test("row, column and cell margins follow the same denominator rule, including empty margins", () => {
  const m = [
    [18, 2],
    [64, 16],
  ];
  assert.deepEqual(tableValues(m, "count"), [
    [18, 2, 20],
    [64, 16, 80],
    [82, 18, 100],
  ]);
  assert.deepEqual(tableValues(m, "row"), [
    [0.9, 0.1, 1],
    [0.8, 0.2, 1],
    [0.82, 0.18, 1],
  ]);
  assert.deepEqual(tableValues(m, "column"), [
    [18 / 82, 2 / 18, 0.2],
    [64 / 82, 16 / 18, 0.8],
    [1, 1, 1],
  ]);
  assert.deepEqual(tableValues(m, "cell"), [
    [0.18, 0.02, 0.2],
    [0.64, 0.16, 0.8],
    [0.82, 0.18, 1],
  ]);
  assert.equal(
    tableValues(
      [
        [0, 0],
        [2, 0],
      ],
      "row",
    )[0][2],
    null,
  );
  assert.equal(
    tableValues(
      [
        [0, 0],
        [2, 0],
      ],
      "column",
    )[2][1],
    null,
  );
});
test("adding, deleting or editing a person updates the table while preserving outcome order", () => {
  const initial = applyData("crosstab", makeInitial(), {
    headers: ["課題難度", "方式", "結果"],
    rows: [
      ["初級課題", "A方式", "未達成"],
      ["応用課題", "B方式", "達成"],
    ],
    name: "記録",
  });
  assert.deepEqual(initial.dataInfo.labels.outcomes, ["達成", "未達成"]);
  const data = currentData("crosstab", initial);
  const removed = applyTableRows("crosstab", initial, data, [data.rows[0]]);
  assert.deepEqual(removed.dataInfo.labels.outcomes, ["達成", "未達成"]);
  assert.deepEqual(matrixFor(removed.strata), [
    [0, 1],
    [0, 0],
  ]);
  const added = applyTableRows("crosstab", initial, data, [
    ...data.rows,
    ["初級課題", "A方式", "達成"],
  ]);
  assert.deepEqual(matrixFor(added.strata), [
    [1, 1],
    [1, 0],
  ]);
  const edited = applyTableRows("crosstab", initial, data, [
    ["初級課題", "A方式", "達成"],
    data.rows[1],
  ]);
  assert.deepEqual(matrixFor(edited.strata), [
    [1, 0],
    [1, 0],
  ]);
  assert.deepEqual(initial.records, data.rows, "input state remains unchanged");
});
test("individual records reject blank or third categories and support a ten-thousand-person round trip", () => {
  const input = (rows) =>
    applyData("crosstab", makeInitial(), {
      headers: ["課題難度", "方式", "結果"],
      rows,
      name: "記録",
    });
  assert.throws(() => input([["初級課題", "A方式", ""]]));
  assert.throws(() =>
    input([
      ["初級", "A", "達成"],
      ["応用", "A", "達成"],
      ["中級", "A", "達成"],
    ]),
  );
  const rows = Array.from({ length: 10000 }, (_, i) => [
    i % 2 ? "応用課題" : "初級課題",
    i % 3 ? "A方式" : "B方式",
    i % 5 ? "達成" : "未達成",
  ]);
  const s = input(rows);
  assert.equal(
    matrixFor(s.strata)
      .flat()
      .reduce((a, b) => a + b, 0),
    10000,
  );
  assert.deepEqual(currentData("crosstab", s).rows, rows);
  assert.deepEqual(
    labelsForRecords([["初級課題", "A方式", "未達成"]]).outcomes,
    ["達成", "未達成"],
  );
});
