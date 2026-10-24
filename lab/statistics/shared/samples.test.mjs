import test from "node:test";
import assert from "node:assert/strict";
import { sampleState } from "./samples.mjs";
import { currentData, applyData } from "./data-model.mjs";
import {
  normalizeState,
  observationValues,
  observedCoin,
  observedBinomial,
} from "../probability/model.mjs";
import { validateDocument } from "./validation.mjs";
import { matrixFor, successRate } from "../crosstab/lab.mjs";
import { parseDelimited, serializeCSV } from "./csv.mjs";
import { labs } from "../catalog.mjs";
test("fresh samples vary by seed, remain reproducible and preserve a meaningful dataset for all nine labs", async () => {
  for (const [id] of labs) {
    const config = (await import(`../${id}/lab.mjs`)).default;
    const a = sampleState(id, config.initial(), 100),
      b = sampleState(id, config.initial(), 101);
    assert.deepEqual(a, sampleState(id, config.initial(), 100));
    const d = currentData(id, a);
    assert.ok(d.rows.length >= 2);
    assert.notDeepEqual(d.rows, currentData(id, b).rows, id);
    assert.ok(
      d.rows.every((r) =>
        r.every((v) => typeof v !== "number" || Number.isFinite(v)),
      ),
      id,
    );
    const csv = parseDelimited(serializeCSV(d.headers, d.rows));
    assert.equal(csv.length, d.rows.length + 1, id);
  }
});
test("generated cross-tabs consistently offer a Simpson reversal without invalid counts", async () => {
  const config = (await import("../crosstab/lab.mjs")).default;
  for (let seed = 0; seed < 100; seed++) {
    const s = sampleState("crosstab", config.initial(), seed);
    assert.ok(
      s.strata
        .flatMap((g) => g.counts.flat())
        .every((n) => Number.isInteger(n) && n >= 0),
    );
    assert.ok(
      s.strata.every(
        (_, i) =>
          successRate(matrixFor(s.strata, String(i)), 0) >
          successRate(matrixFor(s.strata, String(i)), 1),
      ),
    );
    assert.ok(
      successRate(matrixFor(s.strata, "all"), 0) <
        successRate(matrixFor(s.strata, "all"), 1),
    );
  }
});
test("CSV values for histogram are exactly the transformed observations shown in its graph", async () => {
  const config = (await import("../histogram/lab.mjs")).default;
  const s = sampleState("histogram", config.initial(), 1);
  const old = currentData("histogram", s).rows;
  const next = currentData("histogram", { ...s, shiftB: 10 }).rows;
  next.forEach((r, i) =>
    assert.equal(r[0], old[i][0] + (old[i][1] === "B" ? 10 : 0)),
  );
});
test("uploaded probability observations stay fixed when the theoretical model changes", () => {
  const base = normalizeState({});
  const s = applyData("probability", base, {
    headers: ["結果"],
    rows: [[1], [0], [1], [1]],
    x: 0,
    name: "自分のコイン",
  });
  assert.equal(observedCoin(observationValues(s)).successes, 3);
  assert.deepEqual(
    observationValues(normalizeState({ ...s, p: 0.1 })),
    [1, 0, 1, 1],
  );
  assert.equal(currentData("probability", s).origin, "user");
  validateDocument(
    { version: 1, id: "probability", state: s },
    "probability",
    base,
  );
  assert.throws(() =>
    applyData("probability", base, {
      headers: ["結果"],
      rows: [[2]],
      name: "bad",
    }),
  );
  const b = applyData(
    "probability",
    normalizeState({ mode: "binomial", n: 4 }),
    { headers: ["成功回数"], rows: [[0], [2], [4]], name: "sets" },
  );
  assert.deepEqual(
    observedBinomial(4, 0.5, observationValues(b)).counts,
    [1, 0, 1, 0, 1],
  );
  assert.throws(() =>
    applyData("probability", b, {
      headers: ["回数"],
      rows: [[5]],
      name: "bad",
    }),
  );
});
test("normal measurements initialize a model at their own scale and keep observed interval counts", () => {
  for (const values of [
    [160, 170, 180],
    [0.001, 0.002, 0.003],
    [100000, 200000, 300000],
  ]) {
    const base = normalizeState({ mode: "normal" });
    const s = normalizeState(
      applyData("probability", base, {
        headers: ["測定値"],
        rows: values.map((v) => [v]),
        name: "measurements",
      }),
    );
    assert.equal(s.mu, values[1]);
    assert.ok(s.sigma > 0);
    assert.deepEqual(observationValues(s), values);
    validateDocument(
      { version: 1, id: "probability", state: s },
      "probability",
      base,
    );
  }
});

test("replacing a population updates its numeric label instead of retaining the previous sample unit", async () => {
  const config = (await import("../sampling/lab.mjs")).default;
  const base = sampleState("sampling", config.initial(), 12);
  const next = applyData("sampling", base, {
    headers: ["気温（℃）", "地域"],
    rows: [
      [10, "東"],
      [20, "西"],
    ],
    name: "気温",
    x: 0,
    group: 1,
  });
  assert.deepEqual(currentData("sampling", next).headers, ["気温（℃）"]);
});

test("cross-tab, A/B and month labels retain the uploaded column names in CSV output", async () => {
  for (const [id, headers, rows, options] of [
    [
      "crosstab",
      ["課題難度", "学習方法", "結果"],
      [
        ["初級", "X", "合格"],
        ["初級", "Y", "不合格"],
        ["応用", "X", "不合格"],
        ["応用", "Y", "合格"],
      ],
      {},
    ],
    [
      "hypothesis-test",
      ["案内", "訪問数", "登録数"],
      [
        ["X", 100, 40],
        ["Y", 100, 60],
      ],
      {},
    ],
    [
      "time-series",
      ["年月", "来場数"],
      Array.from({ length: 48 }, (_, i) => [
        `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
        100 + i,
      ]),
      { x: 1, date: 0 },
    ],
  ]) {
    const config = (await import(`../${id}/lab.mjs`)).default;
    const next = applyData(id, config.initial(), {
      headers,
      rows,
      name: "持込",
      ...options,
    });
    assert.deepEqual(currentData(id, next).headers, headers, id);
  }
});
