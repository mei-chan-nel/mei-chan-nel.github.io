import test from 'node:test';
import assert from 'node:assert/strict';
import { readExpressionInput, expressionKind, normalizeExpressionInput } from '../../../program-trace/studio/expression-input.js';
import { draftFingerprint, emptyDraft, exportFilename } from '../../../program-trace/studio/document-actions.js';
import { modelFromSource, builderLines, builderSource, blankRow, validateBuilder } from '../../../program-trace/studio/builder-model.js';
import { builderContext } from '../../../program-trace/studio/builder-variables.js';
import { moveRow, dropDestination, rowMoveDestination, rowLocations } from '../../../program-trace/studio/builder-moves.js';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
import { builtinRegistry } from '../../../program-trace/studio/builtins.js';
import { readFile } from 'node:fs/promises';

const model = modelFromSource('x = 3\ny = 4\nData = [3, 5, 9]\nM = [[1, 2], [3, 4]]');
const context = builderContext(model, {}, 0);
const run = source => {
  const program = compile(source); let state = initialState(program, 17);
  while (!state.completed) state = step(program, state, { indexBase: 0, inputs: {} });
  return state;
};
test('keyboard expressions infer strings from quotes and allow only scalar values for scalar assignments', () => {
  for (const text of ['3', '"こんにちは"', 'x + y', 'Data[0] * 2', 'M[0, 1]', 'M[0][1]', '要素数(Data)', '乱数(1, 10, "整数")']) {
    assert.equal(expressionKind(readExpressionInput(text, context, 'scalar'), context), 'scalar', text);
  }
  for (const text of ['Data', '[1, 2]', 'M[0]', 'Data + 1', 'M[0] * 2']) assert.throws(() => readExpressionInput(text, context, 'scalar'), /配列/u, text);
});
test('array destinations accept matching arrays and matrix rows but reject mismatched or ragged shapes', () => {
  for (const text of ['[1, x + y]', 'Data', 'M[0]']) assert.equal(expressionKind(readExpressionInput(text, context, 'array'), context), 'array');
  assert.equal(expressionKind(readExpressionInput('[[1, x], [y, 4]]', context, 'matrix'), context), 'matrix');
  for (const text of ['[1, 2]', 'Data']) assert.throws(() => readExpressionInput(text, context, 'matrix'), /二次元配列/u);
  for (const text of ['[[1], [2, 3]]', '[1, [2]]', '[[[1]]]']) assert.throws(() => readExpressionInput(text, context), /配列/u);
});
test('function arguments and indexing are checked without calling random or evaluating learner programs', () => {
  assert.throws(() => readExpressionInput('要素数(x)', context), /配列/u);
  assert.throws(() => readExpressionInput('Data[0, 1]', context), /次元/u);
  assert.throws(() => readExpressionInput('Data[-1]', context), /整数/u);
  assert.throws(() => readExpressionInput('Data[1.5]', context), /整数/u);
  assert.throws(() => readExpressionInput('乱数(10, 1, "整数")', context), /範囲/u);
  assert.throws(() => readExpressionInput('乱数(1, 2, "文字列")', context), /乱数/u);
  const random = builtinRegistry.get('乱数'), original = random.invoke;
  // The built-in is frozen. A valid random expression must only produce an AST.
  assert.equal(readExpressionInput('乱数(x, y, "整数")', context).kind, 'call');
  assert.equal(random.invoke, original);
});
test('simple keyboard formatting is repaired while quoted content stays exact', () => {
  assert.equal(normalizeExpressionInput('  Ｘ ＋ ２ × ３  '), 'X + 2 * 3');
  assert.equal(readExpressionInput('“Ａ＋Ｂ＝Ｃ”', context).value, 'Ａ＋Ｂ＝Ｃ');
  assert.equal(readExpressionInput('＂こんにちは＂', context).value, 'こんにちは');
  assert.equal(readExpressionInput('“say "yes"”', context).value, 'say "yes"');
  assert.equal(normalizeExpressionInput('x ＝ ３ and "a=b" == "a=b"', true), 'x == 3 and "a=b" == "a=b"');
  assert.equal(readExpressionInput('x ＝ ３', context, 'scalar', true).operator, '==');
});
test('invalid typed syntax, undefined names, unquoted text and unsupported functions keep errors', () => {
  for (const text of ['x +', '(x + 2', 'こんにちは', 'missing + 1', 'x = 2', 'eval("1")', '表示する(1)', 'Data.length', '"閉じていない']) assert.throws(() => readExpressionInput(text, context, 'scalar'));
  assert.throws(() => readExpressionInput('Data[0]', { ...context, base: 1 }), /1 以上/u);
});
test('keyboard arithmetic survives builder serialization and step execution', () => {
  const next = structuredClone(model);
  next.nodes.push({ id: 'typed-result', comment: '', kind: 'assign', assignments: [{ target: { name: 'result', indices: [] }, expression: readExpressionInput('x + y * Data[0] + M[0, 1]', context, 'scalar') }] });
  assert.equal(run(builderSource(next)).variables.result, 17);
});
test('constant calculation mistakes and nonboolean conditions are rejected before applying a row', () => {
  for (const text of ['1 / 0', '"abc" * 2', '"abc" + 1', '2 ** 1024', 'Data[1 / 0]']) assert.throws(() => readExpressionInput(text, context, 'scalar'));
  for (const text of ['3', '"文字列"', 'x + 1', '要素数(Data)']) assert.throws(() => readExpressionInput(text, context, 'scalar', true), /比較式/u);
  assert.equal(readExpressionInput('偽 and 1 / 0 == 1', context, 'scalar', true).kind, 'binary');
  assert.equal(readExpressionInput('"合計" + "です"', context, 'scalar').kind, 'binary');
});
const nested = () => modelFromSource('sum = 0\ni を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n｜ j を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n⎿ ⎿ sum = sum + 1\n表示する(sum)');
test('reordering moves a complete nested block and preserves its execution', () => {
  const source = nested(), block = source.nodes[1], moved = moveRow(source, block.id, { index: 3, depth: 0 });
  assert.equal(source.nodes[1].id, block.id);
  assert.equal(moved.nodes[2].id, block.id); assert.equal(builderLines(moved).filter(line => line.depth > 0).length, 2);
  assert.equal(run(builderSource(moved)).variables.sum, 4);
  assert.equal(run(builderSource(moved)).output[0], '0');
});
test('drag destinations support multiple levels inward/outward and keep IDs unique', () => {
  const source = nested(), leaf = source.nodes[2], inner = source.nodes[1].body[0].body[0];
  const inward = dropDestination(source, leaf.id, inner.id, 'before', 2);
  assert.equal(inward.depth, 2);
  const moved = moveRow(source, leaf.id, inward);
  assert.equal(rowLocations(moved).get(leaf.id).depth, 2);
  const outward = dropDestination(moved, leaf.id, inner.id, 'after', 0);
  assert.equal(outward.depth, 0);
  const restored = moveRow(moved, leaf.id, outward);
  assert.equal(restored.nodes.at(-1).id, leaf.id);
  assert.equal(rowLocations(restored).size, rowLocations(source).size);
  validateBuilder(restored);
});
test('cycles, orphan branch moves and invalid destinations leave the source tree intact', () => {
  const source = nested(), before = builderSource(source), block = source.nodes[1], child = block.body[0];
  assert.throws(() => moveRow(source, block.id, { parentId: child.id, index: 0, depth: 2 }), /自身/u);
  assert.equal(dropDestination(source, block.id, child.id, 'after', 2), undefined);
  assert.throws(() => moveRow(source, source.nodes[0].id, { index: 99, depth: 0 }), /移動先/u);
  assert.throws(() => moveRow(source, source.nodes[0].id, { parentId: source.nodes[2].id, index: 0, depth: 1 }), /場所/u);
  assert.equal(builderSource(source), before);
  const branching = modelFromSource('x = 1\nもし x == 1 ならば：\n｜ 表示する("yes")\nそうでなければ：\n⎿ 表示する("no")'), branch = branching.nodes[1].otherwise;
  assert.throws(() => moveRow(branching, branch.id, { index: 0, depth: 0 }), /一緒/u);
  assert.equal(rowMoveDestination(branching, branch.id, 'up'), undefined);
});
test('if/elseif/else move together and a branch body can safely move outside its entire conditional', () => {
  const source = modelFromSource('x = 1\nもし x == 1 ならば：\n｜ 表示する("one")\nそうでなくもし x == 2 ならば：\n｜ 表示する("two")\nそうでなければ：\n⎿ 表示する("other")\n表示する("done")');
  const owner = source.nodes[1], moved = moveRow(source, owner.id, { index: 3, depth: 0 });
  assert.equal(moved.nodes.at(-1).otherwise.otherwise.kind, 'else');
  assert.deepEqual(run(builderSource(moved)).output, ['done', 'one']);
  const elseChild = owner.otherwise.otherwise.body[0], outer = rowMoveDestination(source, elseChild.id, 'outer');
  assert.equal(outer.depth, 0); assert.equal(outer.index, 2);
  const outside = moveRow(source, elseChild.id, outer); assert.equal(outside.nodes[2].id, elseChild.id);
});
test('row actions give valid adjacent and indentation moves and handle boundaries', () => {
  const source = nested(), first = source.nodes[0], last = source.nodes[2];
  assert.equal(rowMoveDestination(source, first.id, 'up'), undefined);
  assert.equal(rowMoveDestination(source, first.id, 'inner'), undefined);
  assert.equal(rowMoveDestination(source, last.id, 'down'), undefined);
  const up = rowMoveDestination(source, last.id, 'up'), reordered = moveRow(source, last.id, up);
  assert.equal(reordered.nodes[1].id, last.id);
  const inner = rowMoveDestination(source, last.id, 'inner');
  assert.equal(rowLocations(moveRow(source, last.id, inner)).get(last.id).depth, 1);
});
test('saved-state comparison ignores regenerated blank IDs, preserves unsaved edits and export names are safe', () => {
  const left = emptyDraft(), right = { ...emptyDraft(), builder: { version: 1, nodes: [blankRow()] } };
  assert.equal(draftFingerprint(left), draftFingerprint(right));
  assert.notEqual(draftFingerprint(left), draftFingerprint({ ...left, title: '名前を変更' }));
  assert.notEqual(draftFingerprint(left), draftFingerprint({ ...left, source: 'x = 1' }));
  assert.equal(exportFilename(' 私のプログラム '), '私のプログラム.studio.json');
  assert.equal(exportFilename('lesson.json'), 'lesson.json');
  assert.equal(exportFilename('../bad:name'), '.._bad_name.studio.json');
  assert.equal(exportFilename('CON.json'), 'program-CON.json');
  assert.ok(exportFilename('あ'.repeat(200)).length <= 120);
  assert.throws(() => exportFilename('   '), /ファイル名/u);
});
test('published editor markup has first-line plus, compact row-footer actions and new/export dialogs without obsolete sample controls', async () => {
  const page = await readFile(new URL('../../../program-trace/studio/index.html', import.meta.url), 'utf8');
  assert.match(page, /id="builder-first-plus"/u); assert.match(page, /id="new-dialog"/u); assert.match(page, /id="export-name"/u);
  assert.doesNotMatch(page, /sample-select|サンプルを使う/u);
  assert.ok(page.indexOf('row-dialog-footer') < page.indexOf('id="row-actions"'));
});
