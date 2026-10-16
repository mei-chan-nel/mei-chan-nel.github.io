import test from "node:test";
import assert from "node:assert/strict";
import { videoEntry, videoOrigin } from "../lab/flowchart/video-entry.mjs";
import { VIDEO_PROGRAMS } from "../program-trace/video-programs.js";
import { FlowRunner } from "../lab/flowchart/runner.mjs";
import { toProgram } from "../lab/flowchart/conversion.mjs";

test("video entry carries the selected program and its actual initial values", () => {
  const entry = videoEntry(
      "?question=video-q-231&from=programming-variables-arrays",
    ),
    document = entry.document(),
    runner = new FlowRunner(document.graph);
  assert.equal(
    document.title,
    VIDEO_PROGRAMS.find((e) => e.number === 231).title,
  );
  while (!runner.state.completed) runner.next();
  assert.equal(runner.state.variables.x, 3);
  assert.equal(runner.state.variables.y, 4);
  assert.equal(runner.state.variables.goukei, 7);
  assert.deepEqual(runner.state.output, ["合計は7です。"]);
  assert.ok(toProgram(document).source.length > 0);
});

test("return links stay on the original question and reject unrelated courses or arbitrary URLs", () => {
  for (const from of [
    "programming-variables-arrays",
    "programming-shortest-course",
  ]) {
    const entry = videoEntry(`?question=video-q-231&from=${from}`);
    assert.equal(entry.backHref, `../../archive/${from}.html#q-231`);
    assert.equal(
      entry.traceHref,
      `../../program-trace/run.html?from=${from}#video-q-231`,
    );
  }
  for (const from of [
    "https://example.com",
    "../../privacy",
    "programming-simulation",
    "programming-shortest-course",
  ]) {
    const entry = videoEntry(
      `?question=video-q-232&from=${encodeURIComponent(from)}`,
    );
    assert.equal(entry.from, "programming-variables-arrays");
    assert.equal(
      entry.backHref,
      "../../archive/programming-variables-arrays.html#q-232",
    );
  }
  assert.throws(
    () => videoEntry("?question=javascript:alert(1)"),
    /読み込めません/,
  );
  assert.throws(() => videoEntry("?question=video-q-999"), /読み込めません/);
  const variant = VIDEO_PROGRAMS.find((e) => e.number === 232).alternatives[0];
  assert.equal(videoOrigin(variant).question, "video-q-232");
});

test("unsupported video commands keep both the question and trace destinations available", () => {
  for (const number of [307, 308, 328]) {
    const entry = videoEntry(`?question=video-q-${number}`);
    assert.throws(() => entry.document(), /変換できません|実行できません/);
    assert.ok(entry.backHref.endsWith(`#q-${number}`));
    assert.ok(entry.traceHref.endsWith(`#video-q-${number}`));
  }
});
