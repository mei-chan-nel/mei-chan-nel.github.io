import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const homeSource = readFileSync(new URL("assets/home-learning.js", rootUrl), "utf8");

function loadHomeModel() {
  const window = {};
  vm.runInNewContext(homeSource, {
    document: { querySelector: () => null },
    localStorage: { getItem: () => null },
    window,
  });
  return window.StudyAtlasHomeLearning;
}

function renderHomeSummary(localStorage) {
  const summaryNode = { textContent: "" };
  const context = {
    document: { querySelector: () => summaryNode },
    window: {},
  };
  if (localStorage !== undefined) {
    context.localStorage = localStorage;
  }
  vm.runInNewContext(homeSource, context);
  return summaryNode.textContent;
}

test("question history totals attempts and clamps invalid correct counts", () => {
  const { summarizeQuestionRecord } = loadHomeModel();
  const summary = summarizeQuestionRecord({
    v: 1,
    q: {
      first: [2, 1, 0, 100],
      second: [3, 9, 1, 400],
      invalid: [0, -2, 0, 0],
    },
  });

  assert.equal(JSON.stringify(summary), JSON.stringify({
    attempts: 5,
    correct: 4,
    rate: 80,
    summary: "これまで延べ5問に解答・正答率80％",
  }));
});

test("missing, malformed, and zero-attempt records are safe", () => {
  const { summarizeQuestionRecord } = loadHomeModel();
  assert.equal(summarizeQuestionRecord(null), null);
  assert.equal(summarizeQuestionRecord({ v: 2, q: {} }), null);
  assert.equal(summarizeQuestionRecord({ v: 1, q: { empty: [0, 0] } }), null);
  assert.equal(summarizeQuestionRecord({ v: 1, q: { invalid: "not-an-array", negative: [-2, 4] } }), null);
});

test("malformed, deleted, and unavailable browser storage use the safe fallback", () => {
  const fallback = "学習履歴はこのブラウザに保存されます";
  assert.equal(renderHomeSummary({ getItem: () => "{" }), fallback);
  assert.equal(renderHomeSummary({ getItem: () => null }), fallback);
  assert.equal(renderHomeSummary({ getItem: () => { throw new Error("blocked"); } }), fallback);
  assert.equal(renderHomeSummary(undefined), fallback);
});
