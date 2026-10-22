import test from "node:test";
import assert from "node:assert/strict";
import { studioEditURL } from "../program-trace/studio-link.js";
import { EXAMPLES, defaultParameters } from "../program-trace/examples.js";
import { VIDEO_PROGRAMS, VIDEO_VARIANTS } from "../program-trace/video-programs.js";
import { decodeShare } from "../program-trace/studio/sharing.js";
import { modelFromDraft } from "../program-trace/studio/builder-model.js";
import { compile, initialState, step } from "../program-trace/studio/runtime.js";

const base = "https://mei-chan-nel.com/program-trace/run.html?from=examples#addition";
async function copied(example, parameters = defaultParameters(example)) {
  const url = new URL(await studioEditURL(example, parameters, base));
  assert.equal(url.pathname, "/program-trace/studio/share.html");
  assert.equal(url.search, "?edit=1");
  const draft = await decodeShare(url.hash);
  assert.equal(draft.title, example.title);
  modelFromDraft(draft); // Every transferred program must also be editable.
  return draft;
}
function execute(draft, inputs = {}) {
  const program = compile(draft.source);
  let state = initialState(program);
  while (!state.completed) {
    const instruction = program.instructions[state.pc];
    state = step(program, state, draft.settings, instruction.kind === "input" ? inputs[instruction.name] : undefined);
  }
  return state;
}

test("copy current values, then edit and execute without changing the original example", async () => {
  const example = EXAMPLES.find(entry => entry.id === "addition");
  const before = JSON.stringify(example), values = { x: 12, y: 30 };
  const draft = await copied(example, values);
  assert.deepEqual(execute(draft).output, ["合計は42です。"]);
  draft.source = draft.source.replace("x = 12", "x = 20");
  assert.deepEqual(execute(draft).output, ["合計は50です。"]);
  assert.deepEqual(values, { x: 12, y: 30 });
  assert.equal(JSON.stringify(example), before);
  assert.deepEqual(defaultParameters(example), { x: 3, y: 4 });
});

test("copy changed arrays, one-based matrices, external input conditions and recursive functions", async () => {
  const array = await copied(EXAMPLES.find(entry => entry.id === "array-swap"), { Data: [7, 8, 9] });
  assert.deepEqual(execute(array).variables.Data, [9, 8, 7]);
  const matrix = await copied(EXAMPLES.find(entry => entry.id === "matrix"), { rows: 2, columns: 3 });
  assert.equal(matrix.settings.indexBase, 1);
  assert.deepEqual(execute(matrix).variables.Kuku, [[1, 2, 3], [2, 4, 6]]);
  const input = await copied(EXAMPLES.find(entry => entry.id === "condition"));
  assert.equal(input.settings.inputs.age.min, 0);
  assert.equal(input.settings.inputs.age.max, 120);
  assert.deepEqual(execute(input, { age: 17 }).output, ["未成年です。"]);
  assert.deepEqual(execute(input, { age: 18 }).output, ["成人です。"]);
  const recursive = await copied(EXAMPLES.find(entry => entry.id === "factorial"), { n: 4 });
  assert.deepEqual(execute(recursive).output, ["24"]);
});

for (const example of [...EXAMPLES, ...VIDEO_PROGRAMS, ...VIDEO_VARIANTS]) {
  test(`Studio transfer: ${example.id}`, async () => {
    if ([307, 308, 328].includes(example.number) && example.collection === "video") {
      await assert.rejects(copied(example), /Studio|選択入力/u);
    } else {
      const draft = await copied(example);
      assert.doesNotThrow(() => compile(draft.source));
    }
  });
}
