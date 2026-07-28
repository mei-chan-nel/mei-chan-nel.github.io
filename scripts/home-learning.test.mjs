import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const homeSource = readFileSync(new URL("assets/home-learning.js", rootUrl), "utf8");
const bookmarkSource = readFileSync(new URL("assets/lecture-bookmark.js", rootUrl), "utf8");

function loadHomeModel() {
  const window = {};
  vm.runInNewContext(homeSource, {
    document: { querySelector: () => null },
    encodeURIComponent,
    localStorage: { getItem: () => null },
    window,
  });
  return window.StudyAtlasHomeLearning;
}

test("resume candidate uses recency with explicit tie and unknown-time rules", () => {
  const { chooseCandidate } = loadHomeModel();
  const question = { kind: "question", updatedAt: 200 };
  const lecture = { kind: "lecture", updatedAt: 300 };

  assert.equal(chooseCandidate(question, lecture), lecture);
  assert.equal(chooseCandidate(question, { ...lecture, updatedAt: 200 }), question);
  assert.equal(chooseCandidate(question, { ...lecture, updatedAt: null }), question);
  assert.equal(chooseCandidate({ ...question, updatedAt: null }, lecture), lecture);
  assert.equal(chooseCandidate({ ...question, updatedAt: null }, { ...lecture, updatedAt: null }).kind, "question");
});

test("question candidate totals attempts and uses the latest answer timestamp", () => {
  const { summarizeQuestionRecord } = loadHomeModel();
  const candidate = summarizeQuestionRecord({
    v: 1,
    q: {
      first: [2, 1, 0, 100],
      second: [3, 3, 1, 400],
    },
  });

  assert.equal(candidate.updatedAt, 400);
  assert.equal(candidate.title, "前回の問題演習を続ける");
  assert.match(candidate.summary, /5問に回答・正答率 80%/);
});

test("legacy lecture bookmarks without updatedAt remain valid and resumable", () => {
  const stored = JSON.stringify({
    v: 1,
    fields: {
      network: {
        field: "network",
        sectionId: "network-dns",
        sectionTitle: "DNS",
        sectionIndex: 3,
      },
    },
  });
  const window = {};
  vm.runInNewContext(bookmarkSource, {
    Date,
    JSON,
    localStorage: {
      getItem: () => stored,
      setItem: () => {},
    },
    window,
  });
  const records = window.StudyAtlasLectureBookmarks.readAll();
  const { newestLectureCandidate } = loadHomeModel();
  const candidate = newestLectureCandidate(records);

  assert.equal(records.network.updatedAt, null);
  assert.equal(candidate.title, "ネットワークのDNSから読む");
  assert.equal(candidate.href, "./LectureNote/network.html#network-dns");
});
