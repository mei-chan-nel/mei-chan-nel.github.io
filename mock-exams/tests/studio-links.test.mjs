import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeShare } from "../../program-trace/studio/sharing.js";
import {
  compile,
  initialState,
  step,
} from "../../program-trace/studio/runtime.js";
const html = readFileSync(
  new URL("../exams/001/1/screen/q3-solution.html", import.meta.url),
  "utf8",
);
const links = [
  ...html.matchAll(/<a\b[^>]+data-studio-program="([^"]+)"[^>]*>/g),
].map(([tag, id]) => ({ id, href: tag.match(/href="([^"]+)"/)[1] }));
test("completed programs open in Studio with one-based indexes and run to the explained results", async () => {
  assert.deepEqual(
    links.map((l) => l.id),
    ["q3-fig2", "q3-fig4"],
  );
  for (const link of links) {
    assert.ok(link.href.startsWith("/program-trace/studio/share.html#v2."));
    const draft = await decodeShare(
      new URL(link.href, "https://example.org").hash,
    );
    assert.equal(draft.settings.indexBase, 1);
    const program = compile(draft.source),
      inputs = [1, 4];
    let state = initialState(program, 1),
      inputIndex = 0;
    while (!state.completed && !state.error) {
      assert.ok(state.steps < 300);
      const input =
        program.instructions[state.pc].kind === "input"
          ? inputs[inputIndex++]
          : undefined;
      state = step(program, state, draft.settings, input);
    }
    assert.equal(state.error, undefined);
    if (link.id === "q3-fig2") {
      assert.deepEqual(state.variables.Zaiko, [1, 0, 0]);
      assert.deepEqual(state.variables.Jotai, [1, 1, 0, 1, 0, 0, 0, 1]);
      assert.deepEqual(
        state.output,
        [1, 2, 4, 8].map((n) => `受付番号${n}の予約を確定する`),
      );
      assert.equal(inputIndex, 0);
    } else {
      assert.deepEqual(state.variables.Zaiko, [0, 0, 1]);
      assert.deepEqual(state.variables.Jotai, [2, 1, 1, 2, 0, 1, 1, 1]);
      assert.deepEqual(state.output, [
        "新たに確定した申込は2件",
        "新たに確定した申込は1件",
      ]);
      assert.equal(inputIndex, 2);
    }
  }
});
