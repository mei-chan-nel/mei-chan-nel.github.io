import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  grade,
  validateExam,
  calculateStats,
  normalize,
} from "../engine/scoring.mjs";
import {
  createAttempt,
  submit,
  pause,
  resume,
  elapsed,
  createReviewSnapshot,
  AttemptStore,
} from "../engine/attempt.mjs";
const exam = JSON.parse(
  readFileSync(new URL("../exams/001/1/exam.json", import.meta.url)),
);
const perfect = Object.fromEntries(
  exam.scoring.flatMap((u) =>
    u.fields.map((id, i) => [id, u.rule.patterns[0][i]]),
  ),
);
test("No.001 validates; all correct = 100, blank = 0, all wrong = 0", () => {
  assert.equal(validateExam(exam), true);
  assert.equal(exam.fields.length, 49);
  assert.equal(exam.scoring.length, 44);
  assert.equal(grade(exam, perfect).points, 100);
  assert.equal(grade(exam, {}).points, 0);
  const wrong = Object.fromEntries(
    exam.fields.map((f) => [
      f.id,
      f.type === "text"
        ? [...f.allowed].find((c) => c !== perfect[f.id])
        : f.choices.find((c) => c.value !== perfect[f.id]).value,
    ]),
  );
  assert.equal(grade(exam, wrong).points, 0);
});
test("ordered complete, unordered complete and duplicate marks", () => {
  assert.equal(grade(exam, { "q1-ウ": "5" }).points, 0);
  assert.equal(grade(exam, { "q2a-イ": "5", "q2a-ウ": "1" }).points, 3);
  assert.equal(grade(exam, { "q2a-イ": "1", "q2a-ウ": "1" }).points, 0);
  assert.equal(grade(exam, { "q4-エ": "3", "q4-オ": "0" }).points, 4);
  assert.equal(grade(exam, { "q1-カ": "1", "q1-キ": "2" }).points, 0);
});
test("stats key preserves order and partial blanks", () => {
  const r = grade(exam, { "q2a-イ": "5" });
  assert.equal(r.units.find((u) => u.id === "q2a-02").answerKey, "5|_");
  assert.equal(r.units.filter((u) => u.answered).length, 1);
});
test("generic partial credit, patterns, specific errors, conditional grading", () => {
  let e = structuredClone(exam),
    u = e.scoring[0];
  u.fields = ["q1-ア", "q1-イ"];
  u.maxPoints = 4;
  u.rule = {
    kind: "unordered-partial",
    patterns: [["0", "3"]],
    pointsByMatches: [0, 1, 4],
  };
  assert.equal(grade(e, { "q1-ア": "0", "q1-イ": "0" }).units[0].points, 1);
  assert.equal(grade(e, { "q1-ア": "3", "q1-イ": "0" }).units[0].points, 4);
  u.rule = {
    kind: "cases",
    cases: [
      { answers: ["0", "3"], points: 4 },
      { answers: ["0", "2"], points: 2 },
    ],
  };
  assert.equal(grade(e, { "q1-ア": "0", "q1-イ": "2" }).units[0].points, 2);
  u.rule = {
    kind: "conditional",
    when: { field: "q1-ケ", equals: "2" },
    then: {
      kind: "exact",
      patterns: [
        ["0", "3"],
        ["1", "2"],
      ],
    },
    else: { kind: "exact", patterns: [["2", "1"]] },
  };
  assert.equal(
    grade(e, { "q1-ア": "1", "q1-イ": "2", "q1-ケ": "2" }).units[0].points,
    4,
  );
});
test("invalid values rejected before grading", () => {
  assert.throws(() => grade(exam, { "q1-ア": "7" }));
  assert.throws(() => grade(exam, { "q1-エ": "G" }));
  assert.equal(normalize(exam.fields[2], "５"), "5");
});
test("partial grading and resume keep identity; revisions increase, review isolated", () => {
  const a = createAttempt(exam, "untimed", null, 1000);
  a.answers = { "q1-ア": "0", "q1-ウ": "5" };
  const id = a.id;
  submit(exam, a, 5000);
  assert.equal(a.elapsedMs, 4000);
  assert.equal(a.revision, 1);
  resume(a, false, 6000);
  assert.equal(a.id, id);
  assert.equal(a.showCorrectness, false);
  pause(a, 8000);
  assert.equal(elapsed(a), 6000);
  submit(exam, a, 8000);
  assert.equal(a.revision, 2);
  const original = JSON.stringify(a.result);
  const snapshot = createReviewSnapshot(a);
  assert.equal(snapshot.answers["q1-ア"], "0");
  assert.equal(snapshot.answers["q1-ウ"], "5");
  assert.ok(Object.isFrozen(snapshot.answers));
  assert.ok(Object.isFrozen(snapshot.result));
  assert.throws(() => {
    snapshot.answers["q1-ウ"] = "3";
  }, TypeError);
  assert.equal(snapshot.result.points, a.result.points);
  assert.equal(JSON.stringify(a.result), original);
  assert.equal(a.revision, 2);
});
test("storage backup recovery and write failure are explicit", () => {
  const m = new Map();
  const s = {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i],
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, v),
  };
  const store = new AttemptStore(s),
    a = createAttempt(exam, "untimed");
  store.save(a);
  a.answers = perfect;
  store.save(a);
  assert.equal(store.list().length, 1);
  m.set(
    [...m.keys()].find((k) => !k.endsWith("backup")),
    "broken",
  );
  assert.equal(store.load(a.id).id, a.id);
  const main = [...m.keys()].find((k) => !k.endsWith("backup"));
  m.delete(main);
  assert.equal(store.list()[0].id, a.id, "backup-only attempt remains visible");
  m.set(
    main + "-corrupt",
    JSON.stringify({
      schemaVersion: 1,
      id: a.id + "-corrupt",
      statsDelivery: [],
    }),
  );
  assert.equal(
    store.list().length,
    1,
    "one malformed record must not hide a valid backup",
  );
  s.setItem = () => {
    throw Error("quota");
  };
  assert.throws(() => store.save(a));
});
test("average cannot treat uncollected units as zero", () => {
  const s = calculateStats(exam, [
    { scoring_id: "q1-01", answered_count: 2, correct_count: 1, points_sum: 2 },
  ]);
  assert.equal(s.units[0].average, 1);
  assert.equal(s.total.points, null);
});
import { restoreAttempt } from "../engine/attempt.mjs";
test("history import recomputes score and rejects injected metadata", () => {
  const a = createAttempt(exam, "untimed");
  a.answers = perfect;
  submit(exam, a);
  a.result.points = "<img onerror=alert(1)>";
  assert.equal(restoreAttempt(exam, a).result.points, 100);
  a.createdAt = "malicious";
  assert.throws(() => restoreAttempt(exam, a));
});
