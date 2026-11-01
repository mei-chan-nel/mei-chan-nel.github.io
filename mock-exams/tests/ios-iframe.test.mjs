import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bookFrameSrcdoc } from "../ui/book-srcdoc.mjs";

test("Safari input frames permit parent handlers but forbid frame scripts", () => {
  const app = readFileSync(new URL("../app.mjs", import.meta.url), "utf8");
  assert.equal(app.split('sandbox="allow-same-origin allow-scripts"').length - 1, 2);
  assert.ok(app.includes("frame.srcdoc = bookFrameSrcdoc(html, url);"));
  assert.ok(app.includes("other.srcdoc = bookFrameSrcdoc(html, url);"));
});

test("book srcdoc inserts a CSP before any embedded scripts and preserves relative asset URLs", () => {
  const html = '<!doctype html><html><head><title>問題</title></head><body><script>window.bad=true</script></body></html>';
  const result = bookFrameSrcdoc(html, "https://mei-chan-nel.com/mock-exams/exams/001/2/q1.html?x=1&y=2");
  assert.match(result, /<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">/);
  assert.match(result, /<base href="https:\/\/mei-chan-nel\.com\/mock-exams\/exams\/001\/2\/q1\.html\?x=1&amp;y=2">/);
  assert.ok(result.indexOf("Content-Security-Policy") < result.indexOf("<script>"));
});

test("book srcdoc rejects malformed documents without a head", () => {
  assert.throws(() => bookFrameSrcdoc("<body>no head</body>", "https://example.com/"));
});
