import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateExam } from "../engine/scoring.mjs";
import {
  catalogVersions,
  registerEntry,
} from "../../scripts/mock_exam_catalog.mjs";
const exam = JSON.parse(
  readFileSync(new URL("../exams/001/1/exam.json", import.meta.url)),
);
const entry = (id, version = 1) => ({
  id,
  version,
  title: `No.${id}`,
  manifest: `exams/${id}/${version}/exam.json`,
});

test("registering another exam or revision retains publication metadata and old versions", () => {
  const original = [{ ...entry("001"), publishedAt: "2026-10-28" }];
  const withSecond = registerEntry(original, entry("002"));
  const withNew = registerEntry(withSecond, entry("001", 2));
  assert.deepEqual(original, [{ ...entry("001"), publishedAt: "2026-10-28" }]);
  assert.equal(withNew[0].publishedAt, "2026-10-28");
  assert.deepEqual(withNew[0].versions, [
    { version: 1, manifest: "exams/001/1/exam.json" },
  ]);
  assert.deepEqual(
    catalogVersions(withNew).map((e) => [e.id, e.version]),
    [
      ["001", 2],
      ["001", 1],
      ["002", 1],
    ],
  );
  assert.deepEqual(registerEntry(withNew, entry("001", 2)), withNew);
  assert.throws(() => registerEntry(withNew, entry("001", 1)), /older version/);
  assert.throws(
    () => catalogVersions([entry("001"), entry("001")]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      catalogVersions([{ ...entry("001"), manifest: "exams/002/1/exam.json" }]),
    /path/,
  );
});

test("authoring mistakes fail before a learner starts or attempts RPC submission", () => {
  const mutations = [
    (e) => {
      e.version = 2147483648;
    },
    (e) => {
      e.fields[0].choices[0].value = "10";
    },
    (e) => {
      e.fields[2].maxLength = 2;
    },
    (e) => {
      e.fields[0].choices.push(e.fields[0].choices[0]);
    },
    (e) => {
      e.fields[0].sectionId = "q3";
    },
    (e) => {
      e.scoring[0].id = "採点1";
    },
    (e) => {
      e.scoring[0].question = 0;
    },
    (e) => {
      e.scoring[0].rule.patterns = [["F"]];
    },
    (e) => {
      e.scoring[0].rule.patterns = [["0", "1"]];
    },
    (e) => {
      e.scoring[0].rule.patterns = [[""]];
    },
    (e) => {
      e.scoring[0].maxPoints = 0.001;
    },
    (e) => {
      e.scoring[0].rule = {
        kind: "cases",
        cases: [{ answers: ["0"], points: 1 }],
      };
    },
    (e) => {
      e.scoring[0].rule = {
        kind: "conditional",
        when: { unit: "q1-02", atLeast: 1 },
        then: e.scoring[0].rule,
        else: e.scoring[0].rule,
      };
    },
    (e) => {
      e.scoring[0].rule = {
        kind: "conditional",
        when: { field: "q3-ア", equals: "1" },
        then: e.scoring[0].rule,
        else: e.scoring[0].rule,
      };
    },
  ];
  for (const mutate of mutations) {
    const data = structuredClone(exam);
    mutate(data);
    assert.throws(() => validateExam(data), mutate.toString());
  }
});

test("valid partial credit and same-section conditional rules remain supported", () => {
  const data = structuredClone(exam),
    pair = data.scoring.find((u) => u.id === "q2a-02");
  pair.rule = {
    kind: "unordered-partial",
    patterns: [["1", "5"]],
    pointsByMatches: [0, 1, 3],
  };
  const unit = data.scoring[1];
  unit.rule = {
    kind: "conditional",
    when: { unit: "q1-01", atLeast: 2 },
    then: {
      kind: "cases",
      cases: [
        { answers: ["3"], points: 2 },
        { answers: ["2"], points: 0.5 },
      ],
    },
    else: { kind: "exact", patterns: [["3"]] },
  };
  assert.equal(validateExam(data), true);
});
