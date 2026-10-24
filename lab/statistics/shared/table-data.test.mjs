import test from "node:test";
import assert from "node:assert/strict";
import { applyTableRows } from "./table-data.mjs";
import { currentData } from "./data-model.mjs";
import { sampleState } from "./samples.mjs";
import histogram from "../histogram/lab.mjs";
import correlation from "../correlation/lab.mjs";
import sampling from "../sampling/lab.mjs";
import crosstab from "../crosstab/lab.mjs";
import series from "../time-series/lab.mjs";
import hypothesis from "../hypothesis-test/lab.mjs";
import probability from "../probability/lab.mjs";
import { normalizeExperiment } from "../sampling/model.mjs";
const cells = (data) => data.rows.map((row) => row.map(String));

test("table edits of a shifted histogram use visible values once and retain actual group names", () => {
  const state = {
    ...sampleState("histogram", histogram.initial(), 42),
    shiftB: 13,
  };
  const before = JSON.stringify(state),
    data = currentData("histogram", state),
    rows = cells(data);
  rows[0][0] = "-0.00000000123456789";
  const next = applyTableRows("histogram", state, data, rows);
  assert.equal(next.shiftB, 0);
  assert.equal(currentData("histogram", next).rows[0][0], -0.00000000123456789);
  assert.deepEqual(
    currentData("histogram", next).rows.slice(1),
    data.rows.slice(1),
  );
  assert.deepEqual(next.groupNames, state.groupNames);
  assert.equal(next.dataInfo.origin, "user");
  assert.equal(next.dataInfo.tableEdited, true);
  assert.equal(JSON.stringify(state), before);
});

test("adding and deleting table rows preserves precision, pairings and the original data", () => {
  const state = sampleState("correlation", correlation.initial(), 19),
    data = currentData("correlation", state),
    rows = cells(data);
  rows.splice(2, 1);
  rows.push(["1e-12", "9.123456789012345"]);
  const next = applyTableRows("correlation", state, data, rows);
  assert.equal(next.points.length, state.points.length);
  assert.deepEqual(next.points[2], {
    id: "u2",
    x: data.rows[3][0],
    y: data.rows[3][1],
  });
  assert.deepEqual(
    currentData("correlation", next).rows.at(-1),
    [1e-12, 9.123456789012345],
  );
  assert.deepEqual(currentData("correlation", state).rows, data.rows);
  assert.throws(() =>
    applyTableRows("correlation", state, data, [
      ["", "12"],
      ["1", "2"],
    ]),
  );
});

test("analyses reject incomplete or too-short table drafts without modifying valid state", () => {
  for (const [id, config] of [
    ["hypothesis-test", hypothesis],
    ["time-series", series],
  ]) {
    const state = sampleState(id, config.initial(), 11),
      data = currentData(id, state),
      before = JSON.stringify(state);
    assert.throws(() =>
      applyTableRows(
        id,
        state,
        data,
        cells(data).slice(0, id === "time-series" ? 23 : 1),
      ),
    );
    assert.throws(() =>
      applyTableRows(id, state, data, [...cells(data), [...cells(data)[0]]]),
    );
    assert.equal(JSON.stringify(state), before, id);
  }
});

test("table edits keep imported probability observations fixed and validate their domains", () => {
  for (const [mode, rows] of [
    ["coin", [["1"], ["0"], ["1"]]],
    ["binomial", [["0"], ["2"], ["3"]]],
    ["normal", [["-1.5"], ["3.25"]]],
  ]) {
    const state = { ...probability.initial(), mode },
      data = currentData("probability", state);
    const next = applyTableRows("probability", state, data, rows);
    assert.deepEqual(
      next.observed.values,
      rows.map((row) => Number(row[0])),
    );
    assert.deepEqual(
      currentData("probability", { ...next, p: 0.7 }).rows,
      rows.map((row) => [Number(row[0])]),
    );
    assert.equal(next.observed.mode, mode);
    const bad =
      mode === "coin"
        ? [["2"]]
        : mode === "binomial"
          ? [[String(next.n + 1)]]
          : [["NaN"]];
    assert.throws(() =>
      applyTableRows(
        "probability",
        next,
        currentData("probability", next),
        bad,
      ),
    );
  }
});

test("a shared project table preserves its group column separately from x and y", () => {
  const state = correlation.initial(),
    data = {
      name: "自分の記録",
      origin: "user",
      headers: ["気温", "消費量", "地域"],
      filename: "観測.csv",
      rows: [
        [12.5, 2, "東"],
        [16.5, 3, "西"],
      ],
    };
  const next = applyTableRows(
    "correlation",
    state,
    data,
    [
      ["12.5", "2", "東"],
      ["20.5", "4", "西"],
    ],
    true,
  );
  assert.deepEqual(
    next.points.map((p) => [p.x, p.y, p.group]),
    [
      [12.5, 2, "東"],
      [20.5, 4, "西"],
    ],
  );
  assert.equal(next.xLabel, "気温");
  assert.equal(next.yLabel, "消費量");
  assert.equal(next.dataInfo.filename, "観測.csv");
  assert.equal(next.dataInfo.name, "自分の記録");
});

test("changing population rows rebuilds the sampling experiment against the edited population", () => {
  const state = sampleState("sampling", sampling.initial(), 99),
    data = currentData("sampling", state);
  const next = normalizeExperiment(
    applyTableRows("sampling", state, data, [["-10"], ["10"]]),
  );
  assert.equal(next.customPopulation.length, 2);
  assert.equal(next.n, 2);
  assert.equal(next.trials, 1);
  assert.equal(next.history[0].mean, 0);
  assert.equal(next.history[0].low, 0);
  assert.equal(next.history[0].high, 0);
  assert.equal(next.groupNames, undefined);
  assert.deepEqual(currentData("sampling", next).rows, [[-10], [10]]);
});

test("invalid table cells identify the displayed row and cannot silently replace a group name", () => {
  const state = sampleState("histogram", histogram.initial(), 10);
  const data = currentData("histogram", state),
    rows = cells(data);
  rows[0][0] = "";
  assert.throws(() => applyTableRows("histogram", state, data, rows), /1行目/);
  rows[0][0] = "10";
  rows[0][1] = "";
  assert.throws(
    () => applyTableRows("histogram", state, data, rows),
    /1行目「集団」/,
  );
  const ab = sampleState("hypothesis-test", hypothesis.initial(), 13);
  assert.throws(
    () =>
      applyTableRows(
        "hypothesis-test",
        ab,
        currentData("hypothesis-test", ab),
        [
          ["A", "100", "10"],
          ["A", "100", "20"],
        ],
      ),
    /異なる名前/,
  );
});
