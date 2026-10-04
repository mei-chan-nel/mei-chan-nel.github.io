import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow, branchMarkers, builderLines, builderSource, modelFromSource, modelFromDraft, newCommand, assertReady, validateBuilder } from '../../../program-trace/studio/builder-model.js';
import { expressionTokens, tokensExpression, insertToken, valueToken } from '../../../program-trace/studio/expression-tokens.js';
import { parseExpression, expressionText } from '../../../program-trace/studio/expressions.js';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
import { documentJSON, parseDocument } from '../../../program-trace/studio/documents.js';
import { encodeShare, decodeShare } from '../../../program-trace/studio/sharing.js';
import { builderContext } from '../../../program-trace/studio/builder-variables.js';
import { defaultInput } from '../../../program-trace/studio/documents.js';
const settings = { indexBase: 0, inputs: {} };
const run = source => {
  const program = compile(source); let state = initialState(program, 17);
  while (!state.completed) state = step(program, state, settings);
  return state;
};

test('imported arithmetic, strings, indexed arrays and calls survive conversion to selectable expression tokens', () => {
  for (const source of ['x + 2 * (y - 1)', '-(x ** 2) + 3', 'not (x < 10) or y == 2', 'A[0, i + 1]', 'A[0][1]', '[1, x + 2]', '[[1, 2], [3, 4]]', '要素数(A) - 1', '乱数(-2, 6, "整数")', '"めい#｜⎿ちゃん\\n"']) {
    const original = parseExpression(source), restored = tokensExpression(expressionTokens(original));
    assert.equal(expressionText(restored), expressionText(original), source);
  }
});

test('tap insertion and replacement keep operator precedence and never mutate the original tokens', () => {
  let tokens = [], cursor = 0;
  for (const token of [valueToken(parseExpression('2')), { text: '+' }, valueToken(parseExpression('3')), { text: '*' }, valueToken(parseExpression('4'))]) ({ tokens, cursor } = insertToken(tokens, token, cursor, null));
  const before = structuredClone(tokens), replacement = insertToken(tokens, valueToken(parseExpression('5')), 0, 2);
  assert.deepEqual(tokens, before); assert.equal(replacement.cursor, 3);
  assert.deepEqual(run(`result = ${expressionText(tokensExpression(tokens))}`).variables.result, 14);
  assert.deepEqual(run(`result = ${expressionText(tokensExpression(replacement.tokens))}`).variables.result, 22);
  const first = insertToken(tokens, { text: '(' }, 0, null), last = insertToken(first.tokens, { text: ')' }, first.tokens.length, null);
  assert.equal(run(`result = ${expressionText(tokensExpression(last.tokens))}`).variables.result, 14);
  for (const invalid of [[], [{ text: '+' }], [{ text: 'x' }, { text: '*' }], [{ text: 'eval(1)' }], [{ text: '<script>' }]]) assert.throws(() => tokensExpression(invalid));
});

test('blank lines round trip through files and shares and do not become executable steps', async () => {
  const model = modelFromSource('x = 1\nもし x == 1 ならば：\n  x = x + 1\n表示する(x)');
  model.nodes.unshift(blankRow()); model.nodes[2].body.unshift(blankRow()); model.nodes[2].body.push(blankRow()); model.nodes.push(blankRow());
  const source = builderSource(model), rows = builderLines(model); assertReady(model); assert.equal(run(source).output[0], '2'); assert.equal(run(source).steps, 4);
  const restored = modelFromSource(source); assert.deepEqual(builderLines(restored).map(({ depth, markers, text }) => ({ depth, markers, text })), rows.map(({ depth, markers, text }) => ({ depth, markers, text })));
  const draft = { version: 1, title: '空白行付き', source, settings };
  for (const restoredDraft of [parseDocument(documentJSON(draft)), await decodeShare(new URL(await encodeShare(draft, 'https://mei-chan-nel.com/program-trace/studio/')).hash)]) {
    assert.equal(builderSource(modelFromDraft(restoredDraft)), source); assert.equal(run(restoredDraft.source).output[0], '2');
  }
});

test('empty rows inside unfinished blocks are saved with their structure and prevent execution', async () => {
  const loop = newCommand('for'); loop.body = [blankRow(), blankRow()]; const model = { version: 1, nodes: [loop] };
  validateBuilder(model); assert.throws(() => assertReady(model), error => error.line === 1 && /空白行/u.test(error.message));
  const draft = { version: 1, title: '途中', source: builderSource(model), settings, builder: model };
  const restored = parseDocument(documentJSON(draft)); assert.deepEqual(modelFromDraft(restored), validateBuilder(model));
  const sharedModel = modelFromDraft(await decodeShare(new URL(await encodeShare(draft, 'https://mei-chan-nel.com/program-trace/studio/')).hash));
  const withoutIds = model => JSON.parse(JSON.stringify(model, (key, value) => key === 'id' ? undefined : value));
  assert.deepEqual(withoutIds(sharedModel), withoutIds(validateBuilder(model)));
  assert.notEqual(sharedModel.nodes[0].id, model.nodes[0].id);
  assert.equal(modelFromSource('\n\n').nodes.length, 3); assert.equal(modelFromSource('# メモ\n\n# 最後').nodes.length, 3);
});

test('automatic branch marks continue across alternatives and close every completed nesting level', () => {
  const model = modelFromSource('もし 真 ならば：\n  表示する(1)\nそうでなくもし 偽 ならば：\n  表示する(2)\nそうでなければ：\n  表示する(3)');
  assert.deepEqual(builderLines(model).map(row => row.markers), ['', '｜', '', '｜', '', '⎿']);
  assert.equal(branchMarkers(3, 0), '⎿ ⎿ ⎿'); assert.equal(branchMarkers(3, 1, true), '｜ ｜ ⎿');
  // The exact same marker generator is used for the runner's parsed source lines.
  const lines = compile(builderSource(model)).lines;
  assert.deepEqual(lines.map((row, i) => branchMarkers(row.depth, lines[i + 1]?.depth ?? -1, /^(?:そうでなくもし|そうでなければ)/u.test(lines[i + 1]?.code ?? ''))), builderLines(model).map(row => row.markers));
});

test('variable candidates preserve array dimensions through copies, row references and nonconstant matrix literals', () => {
  const model = modelFromSource('x = 1\nData = [[x, 2], [3, 4]]\nCopy = Data\nRow = Copy[0]\nRowCopy = Row\nData[0] = [5, 6]\nData[1, 0] = 7\nscalar = Copy[1][0]\n表示する("合計は", scalar, "です。")');
  const context = builderContext(model, {}, 1), kinds = Object.fromEntries(context.catalog.map(item => [item.name, item.kind]));
  assert.deepEqual(kinds, { x: 'variable', Data: 'matrix', Copy: 'matrix', Row: 'array', RowCopy: 'array', scalar: 'variable' });
  assert.deepEqual(context.arrays, ['Data', 'Copy', 'Row', 'RowCopy']); assert.deepEqual(context.strings, ['合計は', 'です。']); assert.equal(context.base, 1);
});

test('variable candidates include declarations and loop counters, exclude undeclared references, and do not evaluate random values', () => {
  const model = modelFromSource('Input = 【外部からの入力】\nx = 乱数()\ni を 1 から 3 まで 1 ずつ増やしながら繰り返す：\n  y = missing + i\n表示する(x)');
  const context = builderContext(model, { Input: { ...defaultInput(), kind: 'matrix' } }, 0);
  assert.deepEqual(context.variables, ['Input', 'x', 'i', 'y']); assert.equal(context.catalog[0].kind, 'matrix'); assert.equal(context.catalog[1].value, undefined); assert.equal(context.catalog[3].value, undefined);
});
