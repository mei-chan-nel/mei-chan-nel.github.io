import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAttempt, submit } from "../engine/attempt.mjs";
import {
  historyRows,
  sliceResult,
  applyHistoryGrid,
  historyColumns,
  columnValues,
  filterKey,
  emptyGridState,
  migrateHistoryScopeFilter,
} from "../engine/history-grid.mjs";
const exam = JSON.parse(
  readFileSync(new URL("../exams/001/1/exam.json", import.meta.url)),
);
const full = createAttempt(exam, "untimed", null, 1000);
full.answers = { "q1-ア": "0", "q3-ア": "1" };
submit(exam, full, 10000);
const section = createAttempt(exam, "section", "q3", 2000);
section.answers = { "q3-ア": "1" };
submit(exam, section, 5000);
const paused = createAttempt(exam, "timed", null, 3000);
paused.startedAt = null;
paused.status = "paused";
const samples = [full, section, paused];
test("all keeps one row per attempt; full selects full attempts", () => {
  assert.equal(historyRows(samples, "all").length, 3);
  assert.equal(historyRows(samples, "full").length, 2);
  assert.deepEqual(
    historyRows(samples, "all").map((r) => r.sectionId),
    [null, null, null],
  );
});
test("section view includes five slices of each full attempt plus section practice", () => {
  const original = JSON.stringify(samples),
    rows = historyRows(samples, "section");
  assert.equal(rows.length, 11);
  const slices = rows.filter((r) => r.attempt.id === full.id);
  assert.equal(slices.length, 5);
  assert.ok(slices.every((r) => r.derived && r.duration === null));
  assert.ok(slices.every((r) => r.fullMode === "回ごと・時間制限なし"));
  assert.equal(
    slices.reduce((n, r) => n + r.points, 0),
    full.result.points,
  );
  for (const r of slices) {
    const s = full.result.sections.find((s) => s.id === r.sectionId);
    assert.equal(r.points, s.points);
    assert.equal(r.maxPoints, s.maxPoints);
    assert.equal(r.rate, (s.points / s.maxPoints) * 100);
  }
  assert.equal(rows.find((r) => r.attempt.id === section.id).duration, 3);
  assert.equal(JSON.stringify(samples), original);
});
test("saved scope filters retain both full time modes after relabelling", () => {
  const rows = historyRows(samples, "section"),
    state = emptyGridState();
  state.filters.scope = { values: [JSON.stringify("第3問（通し受験）")] };
  migrateHistoryScopeFilter(state, rows);
  assert.equal(applyHistoryGrid(rows, state).length, 2);
  assert.ok(
    applyHistoryGrid(rows, state).every(
      (r) => r.derived && r.sectionId === "q3",
    ),
  );
  const saved = JSON.stringify(state);
  migrateHistoryScopeFilter(state, rows);
  assert.equal(JSON.stringify(state), saved);
});
test("zero grade is distinct from ungraded and section slicing is immutable", () => {
  const rows = historyRows(samples, "section");
  assert.equal(
    rows.find((r) => r.attempt.id === full.id && r.sectionId === "q4").points,
    0,
  );
  assert.equal(rows.find((r) => r.attempt.id === paused.id).points, null);
  const copy = JSON.stringify(full.result),
    sliced = sliceResult(full.result, "q3");
  assert.equal(sliced.maxPoints, 25);
  assert.ok(sliced.units.every((u) => u.sectionId === "q3"));
  assert.equal(sliced.sections.length, 1);
  assert.equal(JSON.stringify(full.result), copy);
});
test("numeric ascending/descending sorts points as numbers and keeps missing last", () => {
  const rows = [2, 10, 0, null].map((points, i) => ({
    key: String(i),
    points,
    date: i,
  }));
  assert.deepEqual(
    applyHistoryGrid(rows, { sort: { key: "points", direction: "asc" } }).map(
      (r) => r.points,
    ),
    [0, 2, 10, null],
  );
  assert.deepEqual(
    applyHistoryGrid(rows, { sort: { key: "points", direction: "desc" } }).map(
      (r) => r.points,
    ),
    [10, 2, 0, null],
  );
});
test("values and numeric/date ranges combine with AND and inclusive bounds", () => {
  const rows = historyRows(samples, "all"),
    scope = historyColumns.find((c) => c.key === "scope"),
    state = emptyGridState();
  state.filters.points = { min: "0", max: "100" };
  state.filters.scope = { values: [filterKey(scope, rows[1])] };
  assert.deepEqual(
    applyHistoryGrid(rows, state).map((r) => r.attempt.id),
    [section.id],
  );
  state.filters.scope.values = [];
  assert.equal(applyHistoryGrid(rows, state).length, 0);
  const today = new Date(section.createdAt);
  const day = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  assert.equal(
    applyHistoryGrid(rows, { filters: { date: { min: day, max: day } } })
      .length,
    3,
  );
});
test("filter values distinguish different maxima, group dates, and numeric No. order", () => {
  const points = historyColumns.find((c) => c.key === "points"),
    date = historyColumns[0];
  assert.equal(
    columnValues(
      [
        { points: 2, maxPoints: 20 },
        { points: 2, maxPoints: 25 },
        { points: null, maxPoints: null },
      ],
      points,
    ).length,
    3,
  );
  assert.equal(columnValues(historyRows(samples), date).length, 1);
  assert.deepEqual(
    applyHistoryGrid(
      [
        { key: "a", exam: "010", date: 1 },
        { key: "b", exam: "002", date: 2 },
      ],
      { sort: { key: "exam", direction: "asc" } },
    ).map((r) => r.exam),
    ["002", "010"],
  );
});
