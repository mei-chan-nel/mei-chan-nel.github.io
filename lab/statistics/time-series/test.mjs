import assert from "node:assert/strict";
import {
  createMonthlySeries,
  trailingMovingAverage,
  makeForecasts,
  evaluateForecast,
  seriesIndicator,
} from "./lab.mjs";

assert.deepEqual(trailingMovingAverage([2, 4, 6, 8], 3), [null, null, 4, 6]);
assert.deepEqual(trailingMovingAverage([2, 4, 6], 1), [2, 4, 6]);
assert.deepEqual(
  seriesIndicator([100, 110, 121], "growth").map((v) =>
    v === null ? null : Math.round(v),
  ),
  [null, 10, 10],
);
assert.deepEqual(seriesIndicator([100, 120], "index"), [100, 120]);
assert.deepEqual(seriesIndicator([0, 10], "growth"), [null, null]);
const yearly = Array.from({ length: 24 }, (_, i) => (i < 12 ? 100 : 120));
assert.equal(seriesIndicator(yearly, "yoy")[11], null);
assert.ok(Math.abs(seriesIndicator(yearly, "yoy")[12] - 20) < 1e-10);
const linear = Array.from({ length: 36 }, (_, i) => 10 + i * 2);
assert.deepEqual(makeForecasts(linear, 3, 3).trend, [82, 84, 86]);
assert.deepEqual(makeForecasts(linear, 3, 3).ma, [78, 78, 78]);
assert.deepEqual(makeForecasts(linear, 3, 3).last, [80, 80, 80]);
const predictable = createMonthlySeries({ trend: 2, seasonal: 32, noise: 0 });
const forecast = makeForecasts(predictable.slice(0, 36), 12).seasonal;
assert.ok(
  evaluateForecast(predictable.slice(36), forecast).mae < 1e-10,
  "A continuing noiseless seasonal process should be forecast exactly by annual drift.",
);
assert.deepEqual(evaluateForecast([10, 20], [12, 16]), {
  mae: 3,
  rmse: Math.sqrt(10),
  bias: -1,
});
assert.equal(evaluateForecast([], []).mae, null);
assert.deepEqual(
  createMonthlySeries({ seed: 42 }),
  createMonthlySeries({ seed: 42 }),
);
assert.notDeepEqual(
  createMonthlySeries({ seed: 42 }),
  createMonthlySeries({ seed: 43 }),
);
assert.ok(
  createMonthlySeries({ trend: -2, seasonal: 60, noise: 30 }).every(
    (v) => v >= 1,
  ),
);
console.log(
  "time-series: rolling window, indicators, forecast holdout, errors and seed replay passed",
);
