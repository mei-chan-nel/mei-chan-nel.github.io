import test from "node:test";
import assert from "node:assert/strict";
import { fromProgram, toProgram } from "../lab/flowchart/conversion.mjs";
import { FlowRunner } from "../lab/flowchart/runner.mjs";
import {
  emptyGraph,
  flowDocument,
  addNode,
  connect,
  displayNode,
  syntax,
  clone,
} from "../lab/flowchart/graph.mjs";
import { examples, exampleDocument } from "../lab/flowchart/examples.mjs";
import {
  compile,
  initialState,
  step,
  defaultInput,
} from "../lab/flowchart/studio.mjs";
import {
  encodeShare,
  decodeShare,
  documentJSON,
  parseDocument,
  FlowStorage,
  DRAFT_KEY,
} from "../lab/flowchart/documents.mjs";
import { traceDraft, toFlowURL } from "../lab/flowchart/bridge.mjs";
import { EXAMPLES, defaultParameters } from "../program-trace/examples.js";
import { VIDEO_PROGRAMS } from "../program-trace/video-programs.js";
import {
  compileProgram,
  createState,
  step as legacyStep,
} from "../program-trace/interpreter.js";
const draft = (source, settings = { indexBase: 0, inputs: {} }) => ({
  version: 1,
  title: "検証",
  source,
  settings,
});
function flow(d, values = {}) {
  const r = new FlowRunner(d.graph, 12345);
  let count = 0;
  while (!r.state.completed) {
    assert.ok(++count <= 10000, "must terminate");
    r.next(r.request ? values[r.request.name] : undefined);
  }
  return r;
}
function studio(d, values = {}) {
  const c = compile(d.source);
  let s = initialState(c, 12345),
    count = 0;
  while (!s.completed) {
    assert.ok(++count <= 10000);
    const n = c.instructions[s.pc];
    s = step(c, s, d.settings, n.kind === "input" ? values[n.name] : undefined);
  }
  return s;
}
const result = (s) => ({
  variables: JSON.parse(JSON.stringify(s.variables)),
  output: s.output,
  random: s.randomState,
});
for (const e of examples)
  test(`common runtime and round trip: ${e.id}`, () => {
    const d = exampleDocument(e.id),
      p = toProgram(d),
      r = flow(d, { 数: 4 });
    assert.deepEqual(
      result(r.state),
      result(studio(draft(e.source, d.graph.settings), { 数: 4 })),
    );
    assert.deepEqual(
      result(flow(fromProgram(p), { 数: 4 }).state),
      result(r.state),
    );
  });
for (const [name, source, settings, values] of [
  [
    "false branch",
    "x = -1\nもし x >= 0 ならば：\n  y = 1\nそうでなければ：\n  y = 2\n表示する(y)",
  ],
  [
    "empty iteration",
    "sum = 0\ni を 5 から 1 まで 1 ずつ増やしながら繰り返す：\n  sum = sum + i\n表示する(sum)",
  ],
  [
    "decreasing nested loops",
    "sum = 0\ni を 3 から 1 まで 1 ずつ減らしながら繰り返す：\n  j を 0 から 2 まで 1 ずつ増やしながら繰り返す：\n    sum = sum + i * j\n表示する(sum)",
  ],
  [
    "random and compound assignment",
    'x = 乱数(1, 6, "整数"), y = 乱数()\n表示する(x, y)',
  ],
  [
    "one based matrix",
    "Data = [[3, 4], [8, 9]]\nData[1, 2] = 7\n表示する(Data[1, 2])",
    { indexBase: 1, inputs: {} },
  ],
  [
    "array input",
    "Data = 【外部からの入力】\n表示する(要素数(Data))",
    {
      indexBase: 0,
      inputs: {
        Data: { ...defaultInput(), kind: "array", minLength: 2, maxLength: 4 },
      },
    },
    { Data: [2, 3, 4] },
  ],
  [
    "void function",
    '実行する(3)\n表示する("戻った")\n定義する 実行する(x)：\n  表示する(x)\n  返す',
  ],
  [
    "early return",
    "x = 判定(-1)\n表示する(x)\n定義する 判定(n)：\n  もし n < 0 ならば：\n    返す 0\n  返す 1",
  ],
])
  test(`semantic preservation: ${name}`, () => {
    const p = draft(source, settings),
      d = fromProgram(p),
      r = flow(d, values);
    assert.deepEqual(result(r.state), result(studio(p, values)));
    assert.deepEqual(result(studio(toProgram(d), values)), result(r.state));
  });
test("input validation, undo and deterministic random replay", () => {
  const p = draft("x = 【外部からの入力】\ny = 乱数()\n表示する(x,y)", {
      indexBase: 0,
      inputs: { x: { ...defaultInput(), min: 0, max: 5 } },
    }),
    r = new FlowRunner(fromProgram(p).graph, 12345);
  r.next();
  const before = clone(r.state);
  assert.ok(r.next());
  assert.deepEqual(r.state, before);
  assert.throws(() => r.next(6));
  assert.equal(r.history.length, 1);
  r.next(2);
  r.next();
  const random = r.state.variables.y;
  r.previous();
  r.next();
  assert.equal(r.state.variables.y, random);
  while (!r.state.completed) r.next();
  const end = clone(r.state);
  r.next();
  assert.equal(r.active, null);
  r.previous();
  assert.deepEqual(r.state, end);
  r.reset();
  assert.equal(r.history.length, 0);
  assert.deepEqual(r.state, initialState(r.compiled, 12345));
});
test("source outlets replace old wires and decision paths merge", () => {
  const g = emptyGraph(),
    p = addNode(g, "process", "main", 400, 180);
  connect(g, "n1", 0, p.id);
  assert.equal(g.edges.filter((e) => e.from === "n1").length, 1);
  assert.equal(g.edges[0].to, p.id);
  assert.throws(() => connect(g, p.id, 0, "n1"));
  const choice = addNode(g, "decision", "main", 400, 300);
  connect(g, choice.id, 0, "n2");
  connect(g, choice.id, 1, "n2");
  assert.doesNotThrow(() => flowDocument(g));
});
test("directed decision cycle runs but source conversion refuses unstructured jumps", () => {
  const g = emptyGraph(),
    init = addNode(g, "process", "main", 400, 160),
    choice = addNode(g, "decision", "main", 400, 300),
    inc = addNode(g, "process", "main", 180, 430);
  init.code = "x = 0";
  choice.code = "x < 3";
  inc.code = "x = x + 1";
  connect(g, "n1", 0, init.id);
  connect(g, init.id, 0, choice.id);
  connect(g, choice.id, 0, inc.id);
  connect(g, inc.id, 0, choice.id);
  connect(g, choice.id, 1, "n2");
  const d = flowDocument(g);
  assert.equal(flow(d).state.variables.x, 3);
  assert.throws(() => toProgram(d), /繰返し/);
});
test("incomplete exits, bad pairs, cross scope, oversized and executable syntax rejected", () => {
  const d = exampleDocument("sum");
  d.graph.edges = [];
  assert.throws(() => new FlowRunner(d.graph), /つないで/);
  d.graph.nodes.find((n) => n.type === "loopStart").pair = "n999";
  assert.throws(() => flowDocument(d.graph), /対/);
  const g = emptyGraph();
  g.scopes.push({ id: "f1", name: "計算", parameters: [] });
  const n = addNode(g, "process", "f1", 100, 100);
  assert.throws(() => connect(g, "n1", 0, n.id));
  n.code = "globalThis.alert(1)";
  assert.throws(() => syntax(g));
  assert.throws(() => parseDocument("x"));
  assert.throws(() => parseDocument(" ".repeat(300001)));
  assert.throws(() =>
    parseDocument(
      JSON.stringify({ format: "interactive-lab-flowchart", version: 99 }),
    ),
  );
});
test("comparison glyphs preserve string literal content; function named メイン allowed", () => {
  const n = { type: "decision", code: 'x == "== >="' };
  assert.equal(displayNode(n), 'x = "== >="？');
  assert.doesNotThrow(() =>
    fromProgram(
      draft("x = メイン()\n表示する(x)\n定義する メイン()：\n  返す 1"),
    ),
  );
});
test("large diagrams stay within coordinate bounds", () => {
  const d = fromProgram(
    draft(Array.from({ length: 110 }, (_, i) => `x = ${i}`).join("\n")),
  );
  assert.equal(d.graph.nodes.length, 112);
  assert.ok(d.graph.nodes.every((n) => Math.abs(n.y) <= 9000));
  assert.equal(flow(d).state.variables.x, 109);
});
test("JSON imports both formats and compressed links preserve settings and layout", async () => {
  const d = exampleDocument("input");
  d.graph.nodes[0].x += 48;
  assert.deepEqual(parseDocument(documentJSON(d)), d);
  assert.deepEqual(await decodeShare(await encodeShare(d)), d);
  const p = toProgram(d);
  assert.deepEqual(
    parseDocument(JSON.stringify({ format: "mei-program-studio", ...p })),
    fromProgram(p),
  );
  assert.deepEqual(
    await decodeShare(
      await toFlowURL(p, "https://mei-chan-nel.com/lab/flowchart/"),
    ),
    fromProgram(p),
  );
  await assert.rejects(() => decodeShare("#fc1.j.x"));
});
test("named saves and recovered draft keep independent snapshots", () => {
  const map = new Map(),
    storage = new FlowStorage({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    }),
    d = exampleDocument("addition");
  const one = storage.save(d);
  d.title = "変更";
  const two = storage.save(d);
  assert.notEqual(one.id, two.id);
  storage.save({ ...d, title: "上書き" }, one.id);
  assert.equal(storage.list().length, 2);
  assert.equal(storage.list()[0].document.title, "上書き");
  storage.saveDraft(d, two.id, JSON.stringify(d));
  assert.deepEqual(storage.draft().document, d);
  storage.remove(one.id);
  assert.equal(storage.list().length, 1);
  map.set(DRAFT_KEY, "corrupt");
  assert.throws(() => storage.draft());
});
// Exercise every existing representative/video problem, including current values
// and predefined matrices. Two incompatible input/plot formats give clear errors.
for (const e of [...EXAMPLES, ...VIDEO_PROGRAMS])
  test(`existing trace conversion: ${e.id}`, () => {
    const params = defaultParameters(e);
    if (e.id === "video-q-326") params.ninzu = 20;
    if (e.id === "video-q-290") params.kaitou = params.target;
    if (e.id === "video-q-330") params.営業終了時刻 = 120;
    if (["video-q-307", "video-q-308", "video-q-328"].includes(e.id)) {
      assert.throws(
        () => traceDraft(e, params),
        /変換できません|実行できません/,
      );
      return;
    }
    const p = traceDraft(e, params),
      d = fromProgram(p);
    assert.doesNotThrow(() => toProgram(d));
    const c = compileProgram(e.program, {
      initialVariables: e.initialize?.(params) ?? {},
      maxSteps: e.maxSteps,
    });
    let s = createState(c, { seed: 12345 }),
      count = 0;
    while (!s.completed) {
      if (++count > 10000) throw Error("legacy limit");
      const n = c.instructions[s.pc];
      s = legacyStep(c, s, params, {
        input:
          n.type === "input"
            ? (params[n.name] ?? n.field.defaultValue)
            : undefined,
      });
    }
    const inputValues = Object.fromEntries(
      (e.inputs ?? []).map((f) => [f.key, params[f.key] ?? f.defaultValue]),
    );
    let r;
    try {
      r = flow(d, inputValues);
    } catch (err) {
      if (/上限|ステップ|10000/.test(err.message) && s.steps > 5000) return;
      throw err;
    }
    assert.deepEqual(
      r.state.output,
      s.output.map((v) => v.text),
    );
  });
