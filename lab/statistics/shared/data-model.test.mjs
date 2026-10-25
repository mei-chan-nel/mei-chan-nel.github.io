import test from "node:test";
import assert from "node:assert/strict";
import { parseDelimited, serializeCSV } from "./csv.mjs";
import { applyData, currentData } from "./data-model.mjs";
import correlation from "../correlation/lab.mjs";
import summary from "../summary/lab.mjs";
import histogram from "../histogram/lab.mjs";
import crosstab from "../crosstab/lab.mjs";
import lorenz from "../lorenz/lab.mjs";
import sampling from "../sampling/lab.mjs";
import timeSeries from "../time-series/lab.mjs";
import hypothesis from "../hypothesis-test/lab.mjs";
import {
  normalizeExperiment,
  addTrials,
  finiteSE,
} from "../sampling/model.mjs";
import { validateDocument } from "./validation.mjs";
const input = (headers, rows, extra = {}) => ({
  name: "持込データ",
  filename: "observations.csv",
  headers,
  rows,
  ...extra,
});
test("CSV and spreadsheet TSV preserve quoted Japanese labels, commas, newlines, BOM and empty fields", () => {
  const h = ["気温,室内", "記録"],
    r = [
      ["36.5", 'a"b'],
      ["37", "複数\n行"],
    ];
  assert.deepEqual(parseDelimited("\uFEFF" + serializeCSV(h, r)), [h, ...r]);
  assert.deepEqual(parseDelimited("値\t班\r\n10\tA\r\n20\tB"), [
    ["値", "班"],
    ["10", "A"],
    ["20", "B"],
  ]);
  assert.deepEqual(parseDelimited("x,y\n1,\n2,3"), [
    ["x", "y"],
    ["1", ""],
    ["2", "3"],
  ]);
  assert.throws(() => parseDelimited('a,b\n"unclosed,3'));
});
test("two selected columns preserve values and labels; blank and nonfinite rows are rejected", () => {
  const s = applyData(
    "correlation",
    correlation.initial(),
    input(
      ["時間", "無関係", "点"],
      [
        ["1", "2", "30"],
        ["2", "4", "50"],
        ["3", "6", "70"],
      ],
      { x: 0, y: 2 },
    ),
  );
  assert.deepEqual(
    s.points.map((p) => [p.x, p.y]),
    [
      [1, 30],
      [2, 50],
      [3, 70],
    ],
  );
  assert.equal(s.yLabel, "点");
  assert.equal(currentData("correlation", s).origin, "user");
  assert.equal(currentData("correlation", s).edits, 0);
  s.points[0].y = 31;
  assert.equal(currentData("correlation", s).edits, 1);
  assert.throws(() =>
    applyData(
      "correlation",
      correlation.initial(),
      input(
        ["x", "y"],
        [
          ["1", ""],
          ["2", "3"],
        ],
      ),
    ),
  );
  assert.throws(() =>
    applyData(
      "correlation",
      correlation.initial(),
      input(
        ["x", "y"],
        [
          ["1", "Infinity"],
          ["2", "3"],
        ],
      ),
    ),
  );
});
test("one-column data and group mapping keep actual measured units", () => {
  const s = applyData(
    "summary",
    summary.initial(),
    input(["気温（℃）"], [["-2"], ["4"], ["7"]]),
  );
  assert.equal(s.label, "気温（℃）");
  assert.ok(s.min < -2);
  const h = applyData(
    "histogram",
    histogram.initial(),
    input(
      ["身長（cm）", "班"],
      [
        ["160", "東"],
        ["170", "西"],
        ["180", "西"],
      ],
      { x: 0, group: 1 },
    ),
  );
  assert.deepEqual(h.groupNames, ["東", "西"]);
  assert.deepEqual(
    h.rows.map((r) => r.group),
    ["A", "B", "B"],
  );
  assert.throws(() =>
    applyData(
      "histogram",
      histogram.initial(),
      input(
        ["値", "班"],
        [
          ["1", "A"],
          ["2", "B"],
          ["3", "C"],
        ],
        { x: 0, group: 1 },
      ),
    ),
  );
});
test("an imported finite population supports exact census and stable replay without using the default population", () => {
  const s = applyData(
    "sampling",
    sampling.initial(),
    input(
      ["値", "班"],
      [
        ["10", "北"],
        ["20", "北"],
        ["30", "南"],
        ["40", "南"],
      ],
      { x: 0, group: 1 },
    ),
  );
  const n = normalizeExperiment(s);
  assert.equal(n.n, 4);
  assert.equal(n.history[0].mean, 25);
  assert.equal(n.history[0].low, 25);
  assert.equal(finiteSE([10, 20, 30, 40], 4), 0);
  assert.deepEqual(addTrials(n, 10).history, addTrials(n, 10).history);
  validateDocument(
    { version: 1, id: "sampling", state: n },
    "sampling",
    sampling.initial(),
  );
});
test("cross-tab import maps named strata/methods and success counts without silently aggregating duplicate rows", () => {
  const data = input(
    ["地域", "方式", "合格", "不合格"],
    [
      ["東", "X", "9", "1"],
      ["東", "Y", "8", "2"],
      ["西", "X", "3", "7"],
      ["西", "Y", "2", "8"],
    ],
  );
  const s = applyData("crosstab", crosstab.initial(), data);
  assert.deepEqual(s.strata[0].counts, [
    [9, 1],
    [8, 2],
  ]);
  assert.deepEqual(s.dataInfo.labels.methods, ["X", "Y"]);
  assert.deepEqual(s.anchors, [
    [0.9, 0.8],
    [0.3, 0.2],
  ]);
  assert.throws(() =>
    applyData("crosstab", crosstab.initial(), {
      ...data,
      rows: [data.rows[0], data.rows[0], ...data.rows.slice(2)],
    }),
  );
});
test("income and one-sample counts enforce their statistical domains", () => {
  const s = applyData(
    "lorenz",
    lorenz.initial(),
    input(["月収（円）"], [["10000"], ["20000"], ["30000"]]),
  );
  assert.equal(s.incomeLabel, "月収（円）");
  assert.equal(s.from, 2);
  assert.equal(currentData("lorenz", s).headers[0], "月収（円）");
  assert.throws(() =>
    applyData("lorenz", lorenz.initial(), input(["所得"], [["-1"], ["2"]])),
  );
  const one = applyData("hypothesis-test", hypothesis.initial(), input(["参加者", "枚数", "正答"], [["P1", "100", "60"], ["P2", "100", "40"]]));
  assert.equal(one.participants[0].correct, 60);
  assert.equal(one.participants[0].trials, 100);
  assert.equal(one.participants.length, 2);
  assert.throws(() => applyData("hypothesis-test", hypothesis.initial(), input(["対象", "総数", "該当"], [["丸い種子", "100", "130"]])));
});
test("monthly imports preserve chronological data and reject gaps or unsupported lengths", () => {
  const rows = Array.from({ length: 48 }, (_, i) => [
    `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    String(100 + i),
  ]);
  const s = applyData(
    "time-series",
    timeSeries.initial(),
    input(["月", "売上（円）"], rows, { x: 1, date: 0 }),
  );
  assert.equal(s.monthLabels[0], "2020-01");
  assert.equal(s.customValues[47], 147);
  assert.equal(s.customLabel, "売上（円）");
  assert.throws(() =>
    applyData(
      "time-series",
      timeSeries.initial(),
      input(["月", "値"], rows.slice(0, 23), { x: 1, date: 0 }),
    ),
  );
  const bad = rows.map((r) => [...r]);
  bad[3][0] = "2020-06";
  assert.throws(() =>
    applyData(
      "time-series",
      timeSeries.initial(),
      input(["月", "値"], bad, { x: 1, date: 0 }),
    ),
  );
});
import { restoreInput } from "./data-model.mjs";
test("reset returns to the imported observations, including actual group names, instead of substituting teaching data", () => {
  const s = applyData(
    "histogram",
    histogram.initial(),
    input(
      ["温度", "場所"],
      [
        ["10", "外"],
        ["20", "内"],
        ["30", "内"],
      ],
      { x: 0, group: 1 },
    ),
  );
  s.rows[0].value = 15;
  s.shiftB = 7;
  const restored = restoreInput("histogram", s, histogram.initial());
  assert.deepEqual(
    restored.rows.map((r) => r.value),
    [10, 20, 30],
  );
  assert.deepEqual(restored.groupNames, ["外", "内"]);
  assert.equal(restored.shiftB, 0);
  assert.equal(restored.dataInfo.origin, "user");
});
test("outdated sampling signatures restart the experiment under the current method", () => {
  const old = addTrials(sampling.initial(), 20);
  old.signature = `${old.n}/${old.method}/${old.seed}`;
  const next = normalizeExperiment(old);
  assert.equal(next.trials, 1);
  assert.equal(next.method, "without");
  assert.equal(next.n, old.n);
});
test("a numeric population may include negative measurements and still gives an exact census", () => {
  const s = applyData(
    "sampling",
    sampling.initial(),
    input(["気温（℃）"], [["-10"], ["0"], ["10"], ["20"]]),
  );
  const n = normalizeExperiment(s);
  assert.equal(n.history[0].mean, 5);
  validateDocument(
    { version: 1, id: "sampling", state: n },
    "sampling",
    sampling.initial(),
  );
});
test("a series without dates uses relative month labels and does not invent calendar dates when restored", () => {
  const s = applyData(
    "time-series",
    timeSeries.initial(),
    input(
      ["売上"],
      Array.from({ length: 48 }, (_, i) => [String(i + 1)]),
      { x: 0, date: -1 },
    ),
  );
  assert.equal(currentData("time-series", s).rows[0][0], "1か月目");
  const restored = restoreInput("time-series", s, timeSeries.initial());
  assert.deepEqual(restored.customValues, s.customValues);
  assert.equal(restored.monthLabels[47], "48か月目");
});
