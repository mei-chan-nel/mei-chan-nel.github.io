import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blankRow, branchMarkers, builderLines, builderSource, modelFromSource, modelFromDraft, newCommand, assertReady, validateBuilder, cloneWithIds, literal } from '../../../program-trace/studio/builder-model.js';
import { parseProgram } from '../../../program-trace/studio/parser.js';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
import { parseDocument, documentJSON, validateDraft, defaultInput } from '../../../program-trace/studio/documents.js';
import { encodeShare, decodeShare } from '../../../program-trace/studio/sharing.js';
import { ProgramStorage } from '../../../program-trace/studio/storage.js';
import { EXAMPLES, defaultParameters, sourceLines } from '../../../program-trace/examples.js';
import { samples } from '../../../program-trace/studio/samples.js';
const settings = { indexBase: 0, inputs: {} };
const draft = (model) => ({ version: 1, title: '作成途中', source: builderSource(model), settings, builder: model });
function execute(source, inputs = {}, options = settings) {
  const program = compile(source); let state = initialState(program, 123);
  while (!state.completed) { const next = program.instructions[state.pc]; state = step(program, state, options, next.kind === 'input' ? inputs[next.name] : undefined); }
  return { variables: state.variables, output: state.output, steps: state.steps };
}

test('all supported representative programs and samples become selectable rows without changing execution', () => {
  const cases = EXAMPLES.filter(item => item.number <= 15 && !['factorial', 'matrix'].includes(item.id)).map(item => ({ name: item.id,
    source: sourceLines(item, defaultParameters(item)).map(row => row.text).join('\n'), inputs: Object.fromEntries((item.inputs ?? []).map(field => [field.key, field.defaultValue])) }));
  cases.push(...samples.map(item => ({ name: item.name, source: item.draft.source })));
  for (const item of cases) {
    const model = validateBuilder(modelFromSource(item.source)); assertReady(model);
    assert.deepEqual(execute(builderSource(model), item.inputs), execute(item.source, item.inputs), item.name);
    assert.deepEqual(builderLines(modelFromSource(builderSource(model))).map(row => row.text), builderLines(model).map(row => row.text), item.name);
  }
});

test('nested loops, branches and else-if automatically get the correct closing markers', () => {
  const source = 'x = 0\ni を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n  もし i == 1 ならば：\n    x = x + 1\n  そうでなくもし i == 2 ならば：\n    x = x + 2\n  そうでなければ：\n    x = 9\n  表示する(x)\n表示する("終了")';
  const model = modelFromSource(source), rows = builderLines(model);
  assert.deepEqual(rows.map(row => row.markers), ['', '', '｜', '｜ ｜', '｜', '｜ ｜', '｜', '｜ ⎿', '⎿', '']);
  assert.equal(model.nodes[1].body[0].otherwise.kind, 'if'); assert.equal(model.nodes[1].body[0].otherwise.otherwise.kind, 'else');
  assert.deepEqual(execute(builderSource(model)).output, ['1', '3', '終了']);
  const last = modelFromSource('i を 1 から 1 まで 1 ずつ増やしながら繰り返す：\n  j を 1 から 1 まで 1 ずつ増やしながら繰り返す：\n    表示する(i, j)');
  assert.equal(builderLines(last).at(-1).markers, '⎿ ⎿');
});

test('import preserves inline/full comments, quoted markers, Japanese names, sequential assignments and chained matrix indices', () => {
  const source = '# はじめ\n名前 = "めい#｜⎿ちゃん", A = [[1, 2], [3, 4]] # 初期値\nもし A[1][0] == 3 ならば：\n  # 枝のメモ\n  A[0][1] = 8\n  # 枝の最後\nそうでなければ：\n  # 別の枝\n  A[0, 1] = 0\n# 最後\n表示する(名前, A) # 表示';
  const model = modelFromSource(source), source2 = builderSource(model);
  for (const comment of ['# はじめ', '# 初期値', '# 枝のメモ', '# 枝の最後', '# 別の枝', '# 最後', '# 表示']) assert.equal(source2.split(comment).length, 2, comment);
  assert.deepEqual(execute(source2), execute(source));
  const descending = modelFromSource('i を 5 から 1 まで 2 ずつ減らしながら繰り返す：\n  表示する(i)');
  assert.deepEqual(execute(builderSource(descending)).output, ['5', '3', '1']);
  assert.equal(newCommand('element', 1).assignments[0].target.indices[0].value, 1);
});

test('empty programs and unfinished nested branches are saveable but cannot run', async () => {
  const empty = { version: 1, nodes: [] }, loop = newCommand('for'), condition = newCommand('if'); loop.body.push(condition);
  condition.otherwise = { id: 'otherwise-test', kind: 'else', comment: '', body: [] };
  const incomplete = { version: 1, nodes: [loop] };
  for (const model of [empty, incomplete]) {
    const checked = validateDraft(draft(model)); assert.throws(() => assertReady(model), /空白.*設定/u);
    const file = parseDocument(documentJSON(checked)); assert.deepEqual(modelFromDraft(file), validateBuilder(model));
    const shared = await decodeShare(new URL(await encodeShare(checked, 'https://mei-chan-nel.com/program-trace/studio/')).hash);
    const withoutIds = value => JSON.parse(JSON.stringify(value, (key, item) => key === 'id' ? undefined : item));
    assert.deepEqual(withoutIds(modelFromDraft(shared)), withoutIds(validateBuilder(model)));
  }
  loop.body[0].body.push(newCommand('print')); loop.body[0].otherwise.body.push(newCommand('print')); assertReady(incomplete);
  const storageData = new Map(), storage = new ProgramStorage({ getItem: key => storageData.get(key) ?? null, setItem: (key, value) => storageData.set(key, value) });
  storage.saveDraft(draft(empty)); const record = storage.save(draft({ version: 1, nodes: [newCommand('if')] }));
  assert.deepEqual(modelFromDraft(storage.draft()), empty); assert.equal(storage.list()[0].id, record.id);
});

test('comments alone and empty else branches report the right row before execution', () => {
  const memo = newCommand('comment'); memo.text = 'メモ'; assert.throws(() => assertReady({ version: 1, nodes: [memo] }), /最初の処理/u);
  const model = modelFromSource('x = 1\nもし x == 1 ならば：\n  表示する(x)\nそうでなければ：\n  表示する(0)'); model.nodes[1].otherwise.body = [];
  assert.throws(() => assertReady(model), error => error.line === 4 && /内側.*空白行/u.test(error.message));
});

test('builder validation rejects corrupt or executable metadata and a mismatching source', () => {
  const model = { version: 1, nodes: [newCommand('assign')] };
  const change = edit => { const bad = structuredClone(model); edit(bad); assert.throws(() => validateBuilder(bad)); };
  change(bad => bad.nodes[0].kind = 'javascript');
  change(bad => bad.nodes[0].assignments[0].expression = { kind: 'call', name: 'eval', args: [literal('alert(1)')] });
  change(bad => bad.nodes[0].assignments[0].expression = { kind: 'call', name: '表示する', args: [] });
  change(bad => bad.nodes[0].assignments[0].expression = { kind: 'binary', operator: ';', left: literal(1), right: literal(2) });
  change(bad => bad.nodes[0].assignments[0].target.name = '__proto__');
  change(bad => bad.nodes[0].id = '<script>');
  change(bad => bad.nodes.push(structuredClone(bad.nodes[0])));
  change(bad => bad.nodes[0].assignments[0].expression = literal(Infinity));
  change(bad => bad.nodes[0].assignments[0].expression = literal({ injected: 1 }));
  change(bad => bad.nodes[0].comment = 'escape\nx = 10');
  assert.throws(() => validateBuilder({ version: 1, nodes: [{ id: 'stray-else', comment: '', kind: 'else', body: [] }] }));
  const deep = newCommand('for'); let tail = deep; for (let i = 0; i < 33; i++) { const next = newCommand('for'); tail.body.push(next); tail = next; }
  assert.throws(() => validateBuilder({ version: 1, nodes: [deep] }));
  assert.throws(() => validateDraft({ ...draft(model), source: 'x = 900' }), /一致/u);
  assert.throws(() => modelFromSource('定義する test(n)\n  定義する nested()\n    返す n'));
  // An unfinished draft has metadata as well as source. Never export a file the importer cannot read.
  const large = newCommand('array'); large.assignments[0].expression.items = Array.from({ length: 1000 }, () => ({ kind: 'binary', operator: '+', left: literal(0), right: literal(0), column: 1 }));
  assert.throws(() => documentJSON(draft({ version: 1, nodes: [large, newCommand('if')] })), /300KB/u);
});

test('duplicating a nested block creates new unique ids for its entire branch tree', () => {
  const model = modelFromSource('もし 真 ならば：\n  i を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n    表示する(i)\nそうでなければ：\n  表示する(0)'), clone = cloneWithIds(model.nodes[0]);
  const combined = { version: 1, nodes: [model.nodes[0], clone] }; validateBuilder(combined);
  const ids = builderLines(combined).map(row => row.id); assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 10);
  const originalArgs = structuredClone(model.nodes[0].body[0].body[0].args); clone.body[0].body[0].args = [literal('変更')]; assert.deepEqual(model.nodes[0].body[0].body[0].args, originalArgs);
});

test('legacy source-only files and shares still work without builder metadata', async () => {
  const file = parseDocument(documentJSON(samples[0].draft)); assert.equal(file.builder, undefined);
  const model = modelFromDraft(file); assertReady(model); assert.deepEqual(execute(builderSource(model)).output, ['合計は7です。']);
  const url = await encodeShare(file, 'https://mei-chan-nel.com/program-trace/studio/'), restored = await decodeShare(new URL(url).hash);
  assert.equal(restored.builder, undefined); assert.deepEqual(execute(builderSource(modelFromDraft(restored))).output, ['合計は7です。']);
});

test('AI instructions remain discoverable and their example files import as editable runnable rows', async () => {
  const root = new URL('../../../program-trace/studio/', import.meta.url), page = await readFile(new URL('index.html', root), 'utf8');
  const head = page.split('</head>')[0], body = page.split('<body')[1];
  assert.match(head, /href="\.\/ai-guide\.json"/u); assert.match(head, /href="\.\/ai-guide\.md"/u); assert.match(head, /AI authoring contract/u);
  assert.doesNotMatch(body, /source-editor|writing-guide|editor-aside|random-helper|array-helper/u);
  const fileSpec = body.match(/<details id="file-spec"[^>]*>[\s\S]*?<\/details>/u)?.[0];
  assert.ok(fileSpec); assert.doesNotMatch(fileSpec.split('>')[0], /\bopen\b/u);
  assert.match(fileSpec, /href="\.\/ai-guide\.md"/u); assert.match(fileSpec, /href="\.\/ai-guide\.json"/u);
  for (const label of ['ブラウザ内に保存', 'ブラウザ内から読込', 'ファイルに書出', 'ファイルから読込']) assert.ok(body.includes(label));
  const schema = JSON.parse(await readFile(new URL('ai-guide.json', root), 'utf8'));
  assert.equal(schema.properties.format.const, 'mei-program-studio'); assert.ok(!('builder' in schema.properties));
  const expectedLastOutput = { '2つの値の合計': '合計は7です。', '年齢で分岐する': '成人です。', 'フィボナッチ数列（再帰）': 'F(9) = 34', '戻り値なしの関数': '処理を始めます。' };
  for (const example of schema.examples) {
    const file = parseDocument(JSON.stringify(example)); const model = modelFromDraft(file); assertReady(model);
    for (const name of parseProgram(file.source).inputNames) assert.deepEqual(file.settings.inputs[name], { ...defaultInput(), min: 0, max: 120 });
    const result = execute(builderSource(model), { age: 18 }, file.settings); assert.equal(result.output.at(-1), expectedLastOutput[example.title]);
  }
});
