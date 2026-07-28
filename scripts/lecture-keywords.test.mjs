import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fields = ["society", "digital", "network", "statistics", "programming"];

function loadLecturePage(field) {
  const context = { window: { LECTURE_CONTENT: {} } };
  vm.runInNewContext(
    readFileSync(join(root, "LectureNote", `lecture-data-${field}.js`), "utf8"),
    context,
    { filename: `lecture-data-${field}.js` },
  );
  return context.window.LECTURE_CONTENT[field];
}

function keywordLinks(html) {
  return [...html.matchAll(/<a href="#([^"]+)" data-keyword-id="([^"]+)">/g)]
    .map((match) => ({ targetId: match[1], id: match[2] }));
}

test("all 120 lecture keywords preserve order and point directly to existing targets", () => {
  let total = 0;
  for (const field of fields) {
    const page = loadLecturePage(field);
    const html = readFileSync(join(root, "LectureNote", `${field}.html`), "utf8");
    const keywords = Array.from(page.keywordGroups, (group) => Array.from(group.keywords)).flat();
    const links = keywordLinks(html);
    const sectionOrder = new Map(page.sections.map((section, index) => [section.id, index]));
    const destinationOrder = keywords.map((keyword) => sectionOrder.get(keyword.sectionId));

    assert.deepEqual(
      links.map(({ id, targetId }) => `${id}|${targetId}`),
      keywords.map(({ id, targetId }) => `${id}|${targetId}`),
      `${field}: generated keyword link order changed`,
    );
    assert.ok(
      destinationOrder.every((order, index) => index === 0 || order >= destinationOrder[index - 1]),
      `${field}: keyword destinations move backward through lecture sections`,
    );
    for (const keyword of keywords) {
      assert.equal(
        (html.match(new RegExp(`id="${keyword.targetId}"`, "g")) || []).length,
        1,
        `${field}: ${keyword.id} must have exactly one destination`,
      );
    }
    total += keywords.length;
  }
  assert.equal(total, 120);
});

test("keyword click handling is a direct jump with no choice UI or bookmark mutation", () => {
  const source = readFileSync(join(root, "LectureNote", "lecture.js"), "utf8");
  const handlerStart = source.indexOf('learningGuide.querySelectorAll("[data-keyword-id]")');
  const handlerEnd = source.indexOf("const initialHash", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, `${basename("lecture.js")}: keyword handler not found`);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(handler, /navigateToHash\(link\.getAttribute\("href"\)\.slice\(1\)\)/);
  assert.doesNotMatch(handler, /bookmarkStore|\.write\(|data-keyword-sequential|keywordTools/);
  for (const obsolete of [
    "keyword-reading-tools",
    "ここから順番に読む",
    "キーワード確認中の操作",
    "data-keyword-section-link",
    "data-keyword-index-link",
  ]) {
    assert.equal(source.includes(obsolete), false, `obsolete keyword choice UI remains: ${obsolete}`);
  }
  assert.equal(
    (source.match(/bookmarkStore\?\.write\(/g) || []).length,
    1,
    "only the explicit section-bookmark action may write a lecture bookmark",
  );
});
