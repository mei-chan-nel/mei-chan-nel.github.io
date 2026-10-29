import test from "node:test";
import assert from "node:assert/strict";
import { catalogProgress, sortCatalog } from "../engine/catalog.mjs";
const entries = ["001", "002", "003", "004"].map((id) => ({ id, version: 1 }));
const run = (examId, mode, sectionId, status, updatedAt = 100) => ({
  examId,
  examVersion: 1,
  mode,
  sectionIds:
    mode === "section" ? [sectionId] : ["q1", "q2a", "q2b", "q3", "q4"],
  status,
  result: status === "graded" ? { points: 5 } : null,
  createdAt: updatedAt,
  updatedAt,
});
test("full and per-section progress are separate for the same No.", () => {
  const h = [run("001", "section", "q3", "graded")];
  assert.equal(catalogProgress(entries[0], h, "full", "q3").status, "未受験");
  assert.equal(
    catalogProgress(entries[0], h, "section", "q1").status,
    "未受験",
  );
  assert.equal(
    catalogProgress(entries[0], h, "section", "q3").status,
    "採点済み",
  );
});
test("timed/untimed share full progress; resume prioritises an unfinished run", () => {
  const unfinished = run("001", "timed", null, "paused");
  const h = [unfinished, run("001", "untimed", null, "graded", 200)];
  assert.equal(catalogProgress(entries[0], h, "full").resume, unfinished);
  assert.equal(catalogProgress(entries[0], h, "full").status, "中断中");
});
test("a paused run after partial grading still offers resume", () => {
  const a = { ...run("001", "untimed", null, "paused"), result: { points: 3 } };
  assert.equal(catalogProgress(entries[0], [a], "full").resume, a);
});
test("discarded and old-version history do not mark current questions as taken", () => {
  const a = run("001", "untimed", null, "graded");
  assert.equal(
    catalogProgress(
      entries[0],
      [
        { ...a, discardedAt: 1000 },
        { ...a, examVersion: 2 },
      ],
      "full",
    ).status,
    "未受験",
  );
  assert.equal(
    catalogProgress(entries[0], [{ ...a, examVersion: "1.0.0" }], "full")
      .status,
    "採点済み",
  );
});
test("recommended puts unattempted and unfinished before graded, newest within status", () => {
  const h = [
    run("004", "timed", null, "graded"),
    run("002", "untimed", null, "paused"),
  ];
  assert.deepEqual(
    sortCatalog(entries, h, "full", "q1", "recommended").map((e) => e.id),
    ["003", "001", "002", "004"],
  );
  assert.deepEqual(
    entries.map((e) => e.id),
    ["001", "002", "003", "004"],
  );
});
test("newest and numeric order also work with future publication metadata", () => {
  const e = [
    { ...entries[0], publishedAt: "2026-10-28" },
    { ...entries[1], publishedAt: "2026-09-01" },
  ];
  assert.deepEqual(
    sortCatalog(e, [], "full", "q1", "newest").map((e) => e.id),
    ["001", "002"],
  );
  assert.deepEqual(
    sortCatalog([...e].reverse(), [], "full", "q1", "number").map((e) => e.id),
    ["001", "002"],
  );
});

test("interim grading stays resumable even with a graded status", () => {
  const a = {
    ...run("001", "untimed", null, "graded"),
    gradingKind: "interim",
  };
  assert.equal(catalogProgress(entries[0], [a], "full").resume, a);
});
