import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { grade } from "../engine/scoring.mjs";
import { decodeShare } from "../../program-trace/studio/sharing.js";
import {
  compile,
  initialState,
  step,
} from "../../program-trace/studio/runtime.js";
const root = new URL("../exams/002/1/", import.meta.url);
const exam = JSON.parse(readFileSync(new URL("exam.json", root)));
const qa = JSON.parse(readFileSync(new URL("source/qa.json", root)));
test("No.002 uses reviewed ordered pairs and unordered complete answers without partial credit", () => {
  assert.equal(grade(exam, qa.answers).points, 100);
  for (const c of qa.cases)
    assert.equal(grade(exam, c.answers).points, c.expectedTotal, c.name);
  assert.equal(exam.version, 1);
  assert.equal(exam.fields.length, 55);
  assert.equal(exam.scoring.length, 46);
});
test("No.002 completed programs are executable Studio links and reproduce 62 and 49 minutes", async () => {
  const html = readFileSync(new URL("screen/q3-solution.html", root), "utf8");
  const links = [
    ...html.matchAll(
      /<a\b[^>]+href="([^"]+)"[^>]+data-studio-program="([^"]+)"/g,
    ),
  ];
  assert.equal(links.length, 2);
  for (const [, url, id] of links) {
    const draft = await decodeShare(new URL(url, "https://example.org").hash);
    const program = compile(draft.source);
    let s = initialState(program, 1),
      count = 0;
    const target = draft.source
      .split("\n")
      .map((line, i) => [line.trim(), i + 1])
      .filter(([line]) => line === "r = i")
      .at(-1)?.[1];
    while (!s.completed && !s.error) {
      assert(s.steps < 2000);
      if (program.instructions[s.pc].line === target) count++;
      s = step(program, s, draft.settings);
    }
    assert.equal(s.error, undefined);
    assert.equal(draft.settings.indexBase, 1);
    if (id === "q3-fig2") {
      assert.deepEqual(s.variables.Junbi, [22, 18, 47, 29, 35]);
      assert.equal(s.variables.t, 62);
    } else {
      assert.deepEqual(s.variables.Junbi, [39, 23, 29, 29, 35]);
      assert.equal(s.variables.t, 49);
      assert.equal(count, 4);
      assert.deepEqual(s.output, [
        "部屋2の点検終了は28分",
        "部屋3の点検終了は34分",
        "部屋4の点検終了は39分",
        "部屋5の点検終了は44分",
        "部屋1の点検終了は49分",
      ]);
    }
  }
});
