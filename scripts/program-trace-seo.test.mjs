import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXAMPLES, VIDEO_PROGRAMS } from "../program-trace/examples.js";
import { executionHref, traceRedirect } from "../program-trace/routing.js";

const library = "https://mei-chan-nel.com/program-trace/";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("一覧はindex、実行はJavaScriptの実行前からnoindexで、各入口にrobots指定が1つだけある", () => {
  const index = read("program-trace/index.html");
  const runner = read("program-trace/run.html");
  for (const [html, robots, canonical] of [[index, "index, follow", library], [runner, "noindex, follow", library + "run.html"]]) {
    const tags = [...html.matchAll(/<meta name="robots" content="([^"]+)"/g)];
    assert.equal(tags.length, 1);
    assert.equal(tags[0][1], robots);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`));
  }
  assert.ok(!index.includes('content="noindex'));
});

test("全代表問題・動画問題・比較用プログラムが同じnoindex実行入口を使う", () => {
  for (const program of [...EXAMPLES, ...VIDEO_PROGRAMS].flatMap(entry => [entry, ...(entry.alternatives ?? [])])) {
    const from = program.collection === "video" ? "examples" : "";
    const href = new URL(executionHref(program.id, from), library);
    assert.equal(href.pathname, "/program-trace/run.html");
    assert.equal(href.hash, `#${program.id}`);
    assert.equal(href.searchParams.get("from"), from || null);
    assert.equal(traceRedirect(href.href, program.id), null);
  }
});

test("旧実行URLは問題・比較用ID・遷移元を保持し、空または不明な実行URLは一覧へ戻す", () => {
  assert.equal(traceRedirect(library + "#addition", "addition"), library + "run.html#addition");
  assert.equal(traceRedirect(library + "index.html?from=programming-shortest-course#video-q-231", "video-q-231"), library + "run.html?from=programming-shortest-course#video-q-231");
  assert.equal(traceRedirect(library + "?from=examples#video-q-232-original", "video-q-232-original"), library + "run.html?from=examples#video-q-232-original");
  for (const suffix of ["run.html", "run.html?from=examples#missing", "run.html#examples"]) {
    assert.equal(traceRedirect(library + suffix, null), library);
  }
  assert.equal(traceRedirect(library, null), null);
  assert.equal(traceRedirect(library + "#examples", null), null);
});

test("サイトマップにはプログラム一覧だけを登録し、実行入口・条件・ハッシュを登録しない", () => {
  const traceUrls = [...read("sitemap.xml").matchAll(/<loc>([^<]*\/program-trace\/[^<]*)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(traceUrls, [library]);
  assert.ok(!read("sitemap.html").includes("program-trace/run.html"));
});
