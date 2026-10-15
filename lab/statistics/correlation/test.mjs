import test from "node:test";
import assert from "node:assert/strict";
import lab, { residualSummary, trainingPoints } from "./lab.mjs";
import { regression } from "../shared/math.mjs";

const near = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} differs from ${b}`);

test("least squares minimizes vertical residual squares and has zero residual sum", () => {
  const points = lab.initial().points,
    fit = regression(points);
  const best = residualSummary(points, fit.slope, fit.intercept);
  near(best.sse, fit.sse);
  near(
    best.residuals.reduce((s, p) => s + p.residual, 0),
    0,
  );
  near(best.rmse ** 2 * points.length, best.sse);
  for (const offset of [-0.5, -0.1, 0.1, 0.5]) {
    assert.ok(
      residualSummary(points, fit.slope + offset, fit.intercept).sse > best.sse,
    );
    assert.ok(
      residualSummary(points, fit.slope, fit.intercept + offset).sse > best.sse,
    );
  }
});

test("held-out observation does not influence its own prediction line", () => {
  const state = { ...lab.initial(), excludeSelected: true };
  const fit = regression(trainingPoints(state));
  const changed = {
    ...state,
    points: state.points.map((p) =>
      p.id === state.selectedId ? { ...p, y: p.y + 100 } : p,
    ),
  };
  const second = regression(trainingPoints(changed));
  near(fit.slope, second.slope);
  near(fit.intercept, second.intercept);
  assert.equal(trainingPoints(state).length, state.points.length - 1);
});

test("correlation is unit-invariant but undefined for a constant variable", () => {
  const points = lab.initial().points;
  near(
    regression(points).r,
    regression(points.map((p) => ({ x: p.x * 60 + 5, y: p.y / 100 }))).r,
  );
  assert.equal(
    regression([
      { x: 1, y: 2 },
      { x: 1, y: 5 },
    ]).slope,
    null,
  );
  assert.equal(
    regression([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ]).r,
    null,
  );
});

test("a high leverage outlier changes the fitted relationship materially", () => {
  const state = lab.initial(),
    original = regression(state.points);
  const changed = regression(
    state.points.map((p) =>
      p.id === state.selectedId ? { ...p, x: 112.8, y: 13.2 } : p,
    ),
  );
  assert.ok(changed.r < original.r - 0.3);
  assert.ok(changed.slope < original.slope * 0.6);
});
