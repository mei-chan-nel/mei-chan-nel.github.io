import test from "node:test";
import assert from "node:assert/strict";
import {
  createMonthlySeries,
  trailingMovingAverage,
  linearDetrend,
  autocorrelations,
  seasonalDecomposition,
  seriesIndicator,
  initialSeriesState,
  normalizeSeriesState,
} from "./model.mjs";
import { applyData, currentData } from "../shared/data-model.mjs";
import { sampleState } from "../shared/samples.mjs";
const close = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tol, `${actual} != ${expected}`);

test("monthly order sample has integer counts, a reproducible irregular annual cycle and a modest trend", () => {
  const v = createMonthlySeries();
  assert.equal(v.length, 48);
  assert.ok(v.every((v) => Number.isInteger(v) && v > 0));
  assert.deepEqual(v, createMonthlySeries());
  assert.notDeepEqual(v, createMonthlySeries({ seed: 43 }));
  assert.ok(autocorrelations(v)[12] > 0.4);
  assert.ok(
    v.slice(-12).reduce((a, b) => a + b, 0) >
      v.slice(0, 12).reduce((a, b) => a + b, 0),
  );
  for (let seed = 1; seed <= 100; seed++) {
    const s = sampleState("time-series", initialSeriesState(), seed),
      data = currentData("time-series", s);
    assert.ok(data.rows.every((r) => Number.isInteger(r[1])));
    assert.ok(autocorrelations(data.rows.map((r) => r[1]))[12] > 0.35);
  }
});
test("trailing average uses only the selected month and the previous k−1 months", () => {
  assert.deepEqual(trailingMovingAverage([2, 4, 6, 8], 3), [null, null, 4, 6]);
  assert.deepEqual(trailingMovingAverage([2, 4, 6], 1), [2, 4, 6]);
  assert.equal(
    trailingMovingAverage(
      Array.from({ length: 48 }, (_, i) => i),
      12,
    )[11],
    5.5,
  );
  assert.equal(
    trailingMovingAverage(
      Array.from({ length: 48 }, (_, i) => i),
      12,
    )[47],
    41.5,
  );
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
    createMonthlySeries(),
    Array.from({ length: 48 }, (_, i) => (i % 5 ? 0 : 100)),
  ]) {
    const before = [...values],
      d = seasonalDecomposition(values);
    close(
      d.adjusted.reduce((a, b) => a + b),
      values.reduce((a, b) => a + b),
    );
    for (let i = 0; i < 48; i++)
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
    47,
  );
});
