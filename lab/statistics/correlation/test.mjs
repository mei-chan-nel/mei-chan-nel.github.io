import test from "node:test";
import assert from "node:assert/strict";
import lab, {
  residualSummary,
  trainingPoints,
  visiblePrediction,
  addRandomPoint,
  moveLineHandle,
  normalizeCorrelation,
} from "./lab.mjs";
import { regression } from "../shared/math.mjs";
import { validateDocument } from "../shared/validation.mjs";

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

test("the draggable prediction stays on its line and within both displayed axes", () => {
  const state = { ...lab.initial(), xMin: -5, xMax: 10, yMin: -3, yMax: 12 };
  for (const [m, b] of [
    [2, 1],
    [-3, 4],
    [0, 5],
    [1e-12, 3],
  ])
    for (const requested of [-100, 0, 5, 100]) {
      const p = visiblePrediction(state, m, b, requested);
      assert.ok(p.x >= state.xMin && p.x <= state.xMax);
      assert.ok(p.y >= state.yMin - 1e-10 && p.y <= state.yMax + 1e-10);
      near(p.y, m * p.x + b);
      near(p.x, Math.max(p.low, Math.min(p.high, requested)));
    }
  assert.equal(visiblePrediction(state, 0, 20), null);
  assert.equal(visiblePrediction(state, null, 2), null);
});

test("adding a point preserves the observations, uses a unique id and enforces the data limit", () => {
  const state = lab.initial(),
    before = JSON.stringify(state);
  const patch = addRandomPoint(state, () => 0.25);
  assert.equal(patch.points.length, state.points.length + 1);
  assert.deepEqual(patch.points.slice(0, -1), state.points);
  assert.equal(patch.points.at(-1).id, patch.selectedId);
  assert.ok(!state.points.some((p) => p.id === patch.selectedId));
  assert.ok(
    patch.points.at(-1).x >= state.xMin && patch.points.at(-1).x <= state.xMax,
  );
  assert.ok(
    patch.points.at(-1).y >= state.yMin && patch.points.at(-1).y <= state.yMax,
  );
  assert.equal(
    new Set(
      addRandomPoint({ ...state, ...patch }, () => 0.5).points.map((p) => p.id),
    ).size,
    patch.points.length + 1,
  );
  assert.equal(
    addRandomPoint({
      ...state,
      points: Array.from({ length: 300 }, (_, i) => ({
        id: String(i),
        x: i,
        y: i,
      })),
    }),
    null,
  );
  assert.equal(JSON.stringify(state), before);
});

test("line handles define their actual endpoints and remain finite even for steep lines", () => {
  for (const lineAnchors of [
    { left: { x: 1, y: 1 }, right: { x: 8, y: 8 } },
    { left: { x: 4.00001, y: 1 }, right: { x: 4.00002, y: 8 } },
  ]) {
    const state = {
      ...lab.initial(),
      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 10,
      lineAnchors,
    };
    for (const side of ["left", "right"]) {
      const patch = moveLineHandle(state, side, 5, 20);
      assert.ok(patch.lineAnchors.left.x < patch.lineAnchors.right.x);
      assert.ok(Number.isFinite(patch.manualSlope));
      for (const p of Object.values(patch.lineAnchors)) {
        assert.ok(p.y >= 0 && p.y <= 10);
        near(patch.manualSlope * p.x + patch.manualIntercept, p.y, 1e-7);
      }
    }
  }
});

test("saved observations survive normalization while obsolete modes and invalid holdouts are cleared", () => {
  const state = {
    ...lab.initial(),
    points: [
      { id: "a", x: 0, y: 1 },
      { id: "b", x: 2, y: 5 },
    ],
    selectedId: "a",
    excludeSelected: true,
    manual: true,
    mode: "delete",
    predictionX: 100,
  };
  const next = normalizeCorrelation(state);
  assert.deepEqual(next.points, state.points);
  assert.equal(next.mode, "move");
  assert.equal(next.excludeSelected, false);
  assert.equal(next.manual, false);
  const fit = regression(next.points),
    prediction = visiblePrediction(next, fit.slope, fit.intercept);
  near(next.predictionX, prediction.x);
});

test("a steep line caused by small x units remains valid when saving and restoring", () => {
  const state = {
    ...lab.initial(),
    points: [
      { id: "a", x: 1e-9, y: 0 },
      { id: "b", x: 2e-9, y: 1e6 },
    ],
    selectedId: "a",
    manual: true,
    manualSlope: 1e15,
    manualIntercept: -1e6,
    xMin: 0,
    xMax: 3e-9,
    yMin: 0,
    yMax: 1e6,
    predictionX: 1.5e-9,
    lineAnchors: { left: { x: 1e-9, y: 0 }, right: { x: 2e-9, y: 1e6 } },
  };
  const restored = validateDocument(
    JSON.parse(JSON.stringify({ version: 1, id: "correlation", state })),
    "correlation",
    lab.initial(),
  ).state;
  near(
    visiblePrediction(restored, restored.manualSlope, restored.manualIntercept)
      .y,
    500000,
    1e-8,
  );
  assert.throws(() =>
    validateDocument(
      {
        version: 1,
        id: "correlation",
        state: { ...state, manualSlope: Infinity },
      },
      "correlation",
      lab.initial(),
    ),
  );
});

test("clearing a selection restores all observations to fitting and can be saved without selecting a fallback point", () => {
  const state = { ...lab.initial(), excludeSelected: true, selectedId: "" };
  const cleared = normalizeCorrelation(state);
  assert.equal(cleared.selectedId, "");
  assert.equal(cleared.excludeSelected, false);
  assert.deepEqual(trainingPoints(cleared), state.points);
  validateDocument(
    { version: 1, id: "correlation", state: cleared },
    "correlation",
    lab.initial(),
  );
  assert.throws(() =>
    validateDocument(
      {
        version: 1,
        id: "correlation",
        state: { ...cleared, selectedId: "not-present" },
      },
      "correlation",
      lab.initial(),
    ),
  );
});
