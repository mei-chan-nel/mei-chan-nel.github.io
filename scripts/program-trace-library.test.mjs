import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXAMPLES, defaultParameters, sourceLines } from "../program-trace/examples.js";
import { cardMarkup } from "../program-trace/card-renderer.js";

const read = (path) => readFileSync(new URL(`../program-trace/${path}`, import.meta.url), "utf8");
const textContent = (html) => html.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[entity]);

test("最初のHTMLだけで代表15問の全コードが見え、実行画面には不要な一覧カードを含めない", () => {
  const index = read("index.html");
  const cards = [...index.matchAll(/<a class="example-card"[\s\S]*?<\/a>/g)].map(match => match[0]);
  assert.equal(cards.length, EXAMPLES.length);
  EXAMPLES.forEach((entry, index) => {
    assert.ok(cards[index].includes(`href="./run.html#${entry.id}"`));
    const lines = [...cards[index].matchAll(/<code class="source-code">([\s\S]*?)<\/code>/g)].map(match => textContent(match[1]));
    assert.deepEqual(lines, sourceLines(entry, defaultParameters(entry)).map(line => line.text));
  });
  assert.ok(!read("run.html").includes('class="example-card"'));
});

test("一覧カードの題名・文字列・条件式はHTMLとして実行されず、原文を表示する", () => {
  const entry = { ...EXAMPLES[0], title: '<img src=x onerror="alert(1)">', description: '<script>alert("x")</script>', category: '" onclick="alert(1)' };
  const source = '表示する("<script>alert(1)</script>", x < 10, "&")';
  const html = cardMarkup(entry, [{ line: 1, text: source }]);
  assert.ok(!/<(?:script|img)\b/i.test(html));
  assert.ok(!/\s(?:onerror|onclick)="/.test(html));
  const code = html.match(/<code class="source-code">([\s\S]*?)<\/code>/)[1];
  assert.equal(textContent(code), source);
});
