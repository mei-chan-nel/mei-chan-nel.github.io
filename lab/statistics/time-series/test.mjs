import test from "node:test";
import assert from "node:assert/strict";
import {
  seriesValues,
  householdSeries,
  seriesMonths,
  movingAverageWindow,
  centeredMovingAverage,
  linearDetrend,
  autocorrelations,
  seasonalDecomposition,
  seriesIndicator,
  initialSeriesState,
  normalizeSeriesState,
} from "./model.mjs";
import { applyData, currentData } from "../shared/data-model.mjs";
import { sampleState } from "../shared/samples.mjs";
import { validateDocument } from "../shared/validation.mjs";
const close = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tol, `${actual} != ${expected}`);

test("official ice-cream expenditure is an immutable 2016–2025 monthly extract with a strong annual cycle", () => {
  const v = seriesValues(),
    data = currentData(
      "time-series",
      sampleState("time-series", initialSeriesState(), 1),
    );
  assert.equal(v.length, 120);
  assert.equal(v[0], 464);
  assert.equal(v.at(-1), 834);
  assert.ok(v.every(Number.isInteger));
  assert.equal(data.rows[0][0], "2016-01");
  assert.equal(data.rows.at(-1)[0], "2025-12");
  assert.equal(data.headers[1], "支出金額（円）");
  assert.equal(data.citation.name, "総務省統計局「家計調査」");
  assert.ok(autocorrelations(v, 36)[12] > 0.85);
  assert.ok(autocorrelations(v, 36)[24] > 0.75);
  assert.ok(autocorrelations(v, 36)[36] > 0.6);
  assert.deepEqual(
    sampleState("time-series", initialSeriesState(), 1),
    sampleState("time-series", initialSeriesState(), 200),
  );
  assert.equal(initialSeriesState().selected, 60);
  v[0] = 0;
  assert.equal(seriesValues()[0], 464);
  const totals = [2023, 2024, 2025].map((y) =>
    data.rows
      .filter((r) => r[0].startsWith(String(y)))
      .reduce((s, r) => s + r[1], 0),
  );
  assert.deepEqual(totals, [11578, 12294, 13045]);
});
test("odd moving averages are centered on the selected month and keep both incomplete ends undefined", () => {
  assert.deepEqual(centeredMovingAverage([2, 4, 6, 8, 10], 3), [
    null,
    4,
    6,
    8,
    null,
  ]);
  assert.deepEqual(centeredMovingAverage([2, 4, 6], 1), [2, 4, 6]);
  assert.deepEqual(centeredMovingAverage([2, 4], 3), [null, null]);
});
test("even moving averages average adjacent windows and half-weight both endpoint months", () => {
  const v = [0, 10, 100, 1000, 10000],
    w = movingAverageWindow(v, 2, 2);
  assert.deepEqual(w.weights, [0.5, 1, 0.5]);
  assert.equal(w.start, 1);
  assert.equal(w.end, 3);
  assert.equal(w.value, 302.5);
  assert.equal(w.value, ((10 + 100) / 2 + (100 + 1000) / 2) / 2);
  assert.deepEqual(centeredMovingAverage([0, 2, 4, 6, 8, 10, 12], 4), [
    null,
    null,
    4,
    6,
    8,
    null,
    null,
  ]);
});
test("all supported widths preserve the timing of a linear trend and use exactly k total weight", () => {
  const v = Array.from({ length: 120 }, (_, i) => 100 + 2 * i);
  for (let k = 1; k <= 36; k++) {
    const ma = centeredMovingAverage(v, k);
    for (let i = 0; i < v.length; i++) {
      const w = movingAverageWindow(v, k, i);
      assert.equal(
        w.weights.reduce((s, w) => s + w, 0),
        k,
      );
      if (w.available) close(ma[i], v[i]);
      else assert.equal(ma[i], null);
    }
  }
});
test("a wider window need not remove an annual wave: 12 and 24 cancel it while 18 leaves it", () => {
  const v = Array.from(
      { length: 120 },
      (_, i) => 100 + 20 * Math.cos((2 * Math.PI * i) / 12),
    ),
    waves = [12, 18, 24].map((k) => centeredMovingAverage(v, k).slice(24, 96));
  for (const wave of [waves[0], waves[2]])
    assert.ok(wave.every((v) => Math.abs(v - 100) < 1e-10));
  assert.ok(Math.max(...waves[1]) - Math.min(...waves[1]) > 5);
});
test("detrending removes a straight line and is invariant under an added linear trend", () => {
  const v = Array.from(
    { length: 48 },
    (_, i) => 100 + 10 * Math.cos((2 * Math.PI * i) / 12),
  );
  const d = linearDetrend(v),
    shifted = linearDetrend(v.map((v, i) => v + 1000 + i * 13));
  for (let i = 0; i < 48; i++) close(d[i], shifted[i]);
  assert.ok(
    linearDetrend(Array.from({ length: 48 }, (_, i) => 10 + 2 * i)).every(
      (v) => Math.abs(v) < 1e-10,
    ),
  );
});
test("ACF uses the common full-series denominator, preserves negative lags and defines constant residuals as unavailable", () => {
  const values = [1, 2, 3, 4],
    a = autocorrelations(values, 3, { detrend: false });
  assert.deepEqual(a, [1, 0.25, -0.3, -0.45]);
  assert.ok(autocorrelations(Array(48).fill(0)).every((v) => v === null));
  assert.ok(autocorrelations(Array(48).fill(100)).every((v) => v === null));
  assert.ok(
    autocorrelations(Array.from({ length: 48 }, (_, i) => 100 + 10 * i)).every(
      (v) => v === null,
    ),
  );
  const annual = Array.from({ length: 48 }, (_, i) =>
    Math.cos((2 * Math.PI * i) / 12),
  );
  const acf = autocorrelations(annual, 24, { detrend: false });
  close(acf[12], 0.75);
  close(acf[24], 0.5);
  close(acf[6], -0.875);
});
test("additive decomposition recovers a known annual effect from observed values without using generator parameters", () => {
  const effects = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6],
    values = Array.from(
      { length: 48 },
      (_, i) => 100 + 2 * i + effects[i % 12],
    ),
    d = seasonalDecomposition(values);
  assert.equal(d.trend.slice(0, 6).filter((v) => v === null).length, 6);
  assert.equal(d.trend.slice(-6).filter((v) => v === null).length, 6);
  for (let i = 6; i < 42; i++) close(d.trend[i], 100 + 2 * i);
  for (let m = 0; m < 12; m++) close(d.seasonal[m], effects[m]);
  close(
    d.seasonal.reduce((a, b) => a + b),
    0,
  );
  for (let i = 0; i < 48; i++) close(d.adjusted[i], 100 + 2 * i);
});
test("seasonal adjustment preserves the total and reconstructs the original series, including zero counts", () => {
  for (const values of [
    Array(48).fill(0),
    Array(48).fill(23),
    seriesValues(),
    Array.from({ length: 48 }, (_, i) => (i % 5 ? 0 : 100)),
  ]) {
    const before = [...values],
      d = seasonalDecomposition(values);
    close(
      d.adjusted.reduce((a, b) => a + b),
      values.reduce((a, b) => a + b),
    );
    for (let i = 0; i < values.length; i++)
      close(d.adjusted[i] + d.seasonal[i % 12], values[i]);
    assert.deepEqual(values, before);
  }
});
test("growth and base-100 indices distinguish the comparison months and undefined denominators", () => {
  const v = Array.from({ length: 48 }, (_, i) => 100 + i * 10);
  close(seriesIndicator(v, "growth")[1], 10);
  assert.equal(seriesIndicator(v, "growth")[0], null);
  close(seriesIndicator(v, "yoy")[12], 120);
  assert.ok(
    seriesIndicator(v, "yoy")
      .slice(0, 12)
      .every((v) => v === null),
  );
  assert.deepEqual(seriesIndicator([100, 120, 80], "index"), [100, 120, 80]);
  assert.deepEqual(seriesIndicator([0, 10], "growth"), [null, null]);
  assert.deepEqual(seriesIndicator([0, 10], "index"), [null, null]);
  assert.deepEqual(seriesIndicator([-1, 10], "growth"), [null, null]);
});
test("48 consecutive imported months retain fractional precision and use the same decomposition", () => {
  const values = Array.from({ length: 48 }, (_, i) => 12.125 + i / 16),
    rows = values.map((v, i) => [
      `${2021 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, "0")}`,
      v,
    ]);
  const s = applyData("time-series", initialSeriesState(), {
    headers: ["月", "売上（万円）"],
    rows,
    x: 1,
    date: 0,
    name: "輸入データ",
  });
  assert.deepEqual(s.customValues, values);
  assert.deepEqual(currentData("time-series", s).rows, rows);
  assert.ok(
    seasonalDecomposition(s.customValues).adjusted.every(
      (v, i) => Math.abs(v - values[i]) < 1e-10,
    ),
  );
});
test("legacy series settings gain analysis fields while keeping the user data and selected month", () => {
  const customValues = Array.from({ length: 48 }, (_, i) => i + 0.25),
    s = normalizeSeriesState({
      period: 3,
      selected: 20,
      indicator: "index",
      customValues,
      forecast: "seasonal",
    });
  assert.equal(s.period, 3);
  assert.equal(s.selected, 20);
  assert.equal(s.lag, 12);
  assert.equal(s.indicatorSource, "raw");
  assert.deepEqual(s.customValues, customValues);
  assert.equal(
    normalizeSeriesState({ period: 0, selected: 100, lag: 40 }).period,
    1,
  );
  assert.equal(
    normalizeSeriesState({ period: 0, selected: 100, lag: 40 }).selected,
    100,
  );
});

test("variable imported lengths retain consecutive months and center their initial selection", () => {
  for (const n of [24, 25, 48, 120, 180, 300]) {
    const rows = Array.from({ length: n }, (_, i) => [
      `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
      10.125 + i / 16,
    ]);
    const s = applyData("time-series", initialSeriesState(), {
      headers: ["月", "金額（円）"],
      rows,
      x: 1,
      date: 0,
      name: "読込",
    });
    assert.equal(s.customValues.length, n);
    assert.deepEqual(currentData("time-series", s).rows, rows);
    assert.equal(currentData("time-series", s).citation, undefined);
    if (n !== 120) assert.equal(s.selected, Math.floor(n / 2));
  }
  const invalid = (n) =>
    Array.from({ length: n }, (_, i) => [`${i + 1}か月目`, 100]);
  for (const n of [23, 301])
    assert.throws(
      () =>
        applyData("time-series", initialSeriesState(), {
          headers: ["月", "値"],
          rows: invalid(n),
          x: 1,
          date: 0,
          name: "不正",
        }),
      /24〜300/,
    );
});

test("saved variable-length series require a date label for each observed month", () => {
  const rows = Array.from({ length: 120 }, (_, i) => [
    `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    100 + i,
  ]);
  const s = applyData("time-series", initialSeriesState(), {
    headers: ["月", "値"],
    rows,
    x: 1,
    date: 0,
    name: "確認用",
  });
  validateDocument(
    { version: 1, id: "time-series", state: s },
    "time-series",
    initialSeriesState(),
  );
  assert.throws(
    () =>
      validateDocument(
        {
          version: 1,
          id: "time-series",
          state: { ...s, monthLabels: s.monthLabels.slice(1) },
        },
        "time-series",
        initialSeriesState(),
      ),
    /月のラベル/,
  );
});

test("indicator scales retain the neutral value and all observations with readable, evenly spaced ticks", async () => {
  const { indicatorScale } = await import("./model.mjs");
  for (const mode of ["growth", "yoy", "index"]) {
    for (const input of [
      [null, -43.5, 21.125, 58.25],
      [0, 100, 400.75],
      [99.99, 100, 100.01],
      [0.00001, -0.00002, null],
      [100, 100],
      [null, null],
    ]) {
      const scale = indicatorScale(input, mode);
      assert.ok(scale.min < scale.max);
      assert.ok(scale.min < scale.baseline && scale.max > scale.baseline);
      assert.ok(scale.ticks.length >= 4 && scale.ticks.length <= 12);
      assert.ok(
        input
          .filter(Number.isFinite)
          .every((v) => v >= scale.min && v <= scale.max),
      );
      scale.ticks
        .slice(1)
        .forEach((v, i) => close(v - scale.ticks[i], scale.step));
    }
  }
});
test("seasonally adjusted indices use a tight range around their data instead of zero", async () => {
  const { indicatorScale } = await import("./model.mjs");
  const indices = seriesIndicator(
    seasonalDecomposition(seriesValues()).adjusted,
    "index",
  );
  const scale = indicatorScale(indices, "index");
  assert.equal(scale.baseline, 100);
  assert.ok(scale.min > 0);
  assert.ok(scale.ticks.includes(100));
  assert.ok(
    scale.max - scale.min < 1.5 * (Math.max(...indices) - Math.min(...indices)),
  );
});
