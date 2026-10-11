import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, initialState, step, finish } from '../../../program-trace/studio/runtime.js';
import { parseProgram } from '../../../program-trace/studio/parser.js';
import { replaceInitialValues } from '../../../program-trace/studio/edit-values.js';
import { validateDraft, defaultInput, validateInput, validateInputSpec, parseDocument, documentJSON } from '../../../program-trace/studio/documents.js';
import { encodeShare, decodeShare } from '../../../program-trace/studio/sharing.js';
import { ProgramStorage } from '../../../program-trace/studio/storage.js';
import { getBuiltin, registerBuiltin } from '../../../program-trace/studio/builtins.js';
import { EXAMPLES, defaultParameters, sourceLines } from '../../../program-trace/examples.js';
import { LIMITS } from '../../../program-trace/studio/errors.js';
const settings = { indexBase: 0, inputs: {} };
const draft = (source, extra = {}) => ({ version: 1, title: 'テスト用のプログラム', source, settings, ...extra });
function execute(source, inputs = {}, options = settings) {
  const compiled = compile(source); let state = initialState(compiled, 123), trace = [];
  while (!state.completed) {
    const next = compiled.instructions[state.pc];
    state = step(compiled, state, options, next.kind === 'input' ? inputs[next.name] : undefined); trace.push(state);
  }
  return { state, trace, compiled };
}
test('initial state, highlighted result, final dismissal retain output and values', () => {
  const compiled = compile('x = 3\n表示する("合計は", x)');
  const initial = initialState(compiled), first = step(compiled, initial, settings);
  assert.equal(initial.currentLine, null); assert.equal(initial.steps, 0); assert.equal(first.currentLine, 1); assert.equal(first.variables.x, 3);
  const last = step(compiled, first, settings); assert.equal(last.currentLine, 2); assert.equal(last.completed, true);
  const ended = finish(last); assert.equal(ended.currentLine, null); assert.deepEqual(ended.output, ['合計は3']); assert.equal(ended.variables.x, 3);
  assert.equal(last.currentLine, 2); assert.equal(ended.steps, 2);
});
test('representative source programs run without depending on the existing interpreter', () => {
  const answers = { addition: '合計は7です。', swap: '現在のyの値は1です。', 'array-swap': '現在のDataは[9, 5, 3]', condition: '成人です。', multiples: '6の倍数', 'for-loop': '最終的な合計は15', average: '平均点は6点です', 'count-multiples': '3の倍数の個数は3', maximum: '配列Data内の最大の数は67', 'while-loop': 'sumが20を超えるのはiが6のときです', 'bubble-sort': 'バブルソート後：[1, 3, 4, 5, 8]', 'binary-search': '18は配列の3番目の要素です' };
  for (const example of EXAMPLES.filter(item => item.number <= 15 && !['factorial', 'matrix'].includes(item.id))) {
    const source = sourceLines(example, defaultParameters(example)).map(row => row.text).join('\n');
    const input = Object.fromEntries((example.inputs ?? []).map(field => [field.key, field.defaultValue]));
    const { state } = execute(source, input);
    if (answers[example.id]) assert.equal(state.output.at(-1), answers[example.id], example.id);
    else assert.ok(state.completed, example.id);
  }
});
test('swap records previous values and does not mutate earlier array snapshots', () => {
  const { trace, state } = execute('Data = [3, 5, 9]\ntmp = Data[0]\nData[0] = Data[2]\nData[2] = tmp');
  assert.deepEqual(trace[0].variables.Data, [3, 5, 9]); assert.deepEqual(state.variables.Data, [9, 5, 3]);
  assert.deepEqual(trace[2].changes, [{ name: 'Data', indices: [0], before: 3, after: 9 }]);
  assert.deepEqual(trace[2].reads, [{ name: 'Data', indices: [2] }]);
});
test('else-if branches evaluate in order and skip nonselected bodies', () => {
  const source = 'x = 3\nもし x == 1 ならば：\n  表示する("one")\nそうでなくもし x == 2 ならば：\n  表示する("two")\nそうでなければ：\n  表示する("other")';
  const result = execute(source); assert.deepEqual(result.trace.map(item => item.currentLine), [1, 2, 4, 6, 7]); assert.deepEqual(result.state.output, ['other']);
});
test('nested loops restart inner counter and build a two-dimensional array', () => {
  const source = 'Table = [[0, 0, 0], [0, 0, 0]]\ni を 0 から 1 まで 1 ずつ増やしながら繰り返す：\n  j を 0 から 2 まで 1 ずつ増やしながら繰り返す：\n    Table[i, j] = (i + 1) * (j + 1)\n表示する(Table)';
  const { state, trace } = execute(source); assert.deepEqual(state.variables.Table, [[1, 2, 3], [2, 4, 6]]);
  assert.equal(trace.filter(item => item.currentLine === 4).length, 6); assert.equal(state.variables.i, 2); assert.equal(state.variables.j, 3);
});
test('array references accept chained syntax and one-based indexing; assignment copies values', () => {
  const { state } = execute('A = [[1, 2], [3, 4]]\nB = A\nB[2][1] = 9\nx = A[2, 1]\ny = 要素数(A) + 要素数(A[1])', {}, { ...settings, indexBase: 1 });
  assert.equal(state.variables.x, 3); assert.equal(state.variables.y, 4); assert.deepEqual(state.variables.B, [[1, 2], [9, 4]]); assert.deepEqual(state.variables.A, [[1, 2], [3, 4]]);
});
test('descending and empty loops use inclusive bounds and are visible steps', () => {
  assert.deepEqual(execute('i を 5 から 1 まで 2 ずつ減らしながら繰り返す：\n  表示する(i)').state.output, ['5', '3', '1']);
  const empty = execute('i を 3 から 1 まで 1 ずつ増やしながら繰り返す：\n  表示する(i)\n表示する("end")');
  assert.deepEqual(empty.trace.map(item => item.currentLine), [1, 3]); assert.deepEqual(empty.state.output, ['end']);
});
test('precedence, integer quotient, short-circuit and multiple assignment', () => {
  const { state } = execute('x = -2 ** 2, y = 2 ** 3 ** 2\nz = -7 ÷ 2\nw = 2 + 3 * 4\na = 偽 and 未代入 > 0\nb = 真 or 未代入 > 0\nx = x + 1, y = x');
  assert.equal(state.variables.x, -3); assert.equal(state.variables.y, -3); assert.equal(state.variables.z, -3); assert.equal(state.variables.w, 14); assert.equal(state.variables.a, false); assert.equal(state.variables.b, true);
});
test('Japanese line numbers, branch markers, whitespace, comments and Unicode values', () => {
  const { state } = execute('（01）名前 = "めい#ちゃん" # comment\n（02）もし 3 ≦ 5 ならば：\n（03）｜ 表示する(名前)\n（04）⎿ x = １ ＋ ２');
  assert.deepEqual(state.output, ['めい#ちゃん']); assert.equal(state.variables.x, 3);
  assert.equal(execute('x = 1\nもし x == 1 ならば：\n\t表示する(x)').state.output[0], '1');
});
test('input forms have type, range, size, integer and rectangular-matrix validation', () => {
  const spec = defaultInput(); spec.min = 0; spec.max = 120;
  assert.equal(validateInput(18, spec), 18); assert.throws(() => validateInput(121, spec)); assert.throws(() => validateInput(1.5, spec)); assert.throws(() => validateInput('18', spec));
  spec.kind = 'array'; spec.minLength = 2; spec.maxLength = 4;
  assert.deepEqual(validateInput([1, 2], spec), [1, 2]); assert.throws(() => validateInput([1], spec)); assert.throws(() => validateInput([[1, 2]], spec));
  spec.kind = 'matrix'; spec.rows = 2; spec.columns = 2;
  assert.deepEqual(validateInput([[1, 2], [3, 4]], spec), [[1, 2], [3, 4]]); assert.throws(() => validateInput([[1], [2]], spec));
  assert.throws(() => validateInputSpec({ ...spec, min: 5, max: 2 })); assert.throws(() => validateInputSpec({ ...spec, rows: 31 }));
});
test('initial value editor changes arrays and dimensions, preserves comments, resets program semantics', () => {
  const source = 'Data = [[1, 2], [3, 4]] # 初期値\nsum = 0\ni を 1 から 3 まで 1 ずつ増やしながら繰り返す：\n  sum = sum + i\n表示する(Data, sum)';
  const edited = replaceInitialValues(source, { '1:assignment:0': [[9, 8, 7]], '3:for:end': 2 });
  assert.ok(edited.includes('# 初期値')); assert.deepEqual(execute(edited).state.variables.Data, [[9, 8, 7]]); assert.equal(execute(edited).state.variables.sum, 3);
  assert.throws(() => replaceInitialValues(source, { '3:for:step': 0 }));
  assert.equal(parseProgram('x = 1\ny = x\nz = 3').editable.length, 1);
});
test('random expression is evaluated once and reset is deterministic for a seed', () => {
  const source = 'A = [0, 0]\nA[乱数(0, 1, "整数")] = 乱数(1, 6, "整数")\n表示する(乱数())';
  const compiled = compile(source), seed = 77; let state = initialState(compiled, seed);
  for (let i = 0; i < 3; i++) state = step(compiled, state, settings);
  const advance = seed => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  assert.equal(state.randomState, advance(advance(advance(seed))));
  let again = initialState(compiled, seed); while (!again.completed) again = step(compiled, again, settings); assert.deepEqual(again.output, state.output);
  const builtin = getBuiltin('乱数', 3);
  assert.equal(builtin.invoke([1, 6, '整数'], { random: () => 0, display() {} }), 1);
  assert.equal(builtin.invoke([1, 6, '整数'], { random: () => 0.999999, display() {} }), 6);
  assert.throws(() => builtin.invoke([1.5, 2, '整数'], { random: () => 0, display() {} }));
});
test('built-in registry can be extended without changing the expression parser', () => {
  registerBuiltin({ name: '試験用二倍', version: 1, effect: 'value', arities: [1], description: 'test only', invoke: args => args[0] * 2 });
  assert.equal(execute('x = 試験用二倍(4)').state.variables.x, 8);
});
test('real random values stay below their maximum even when floating point rounding reaches it', () => {
  const builtin = getBuiltin('乱数', 3);
  for (const [min, max] of [[1, 1 + Number.EPSILON], [-1 - Number.EPSILON, -1], [-Number.MIN_VALUE, 0], [0, Number.MIN_VALUE]]) {
    const result = builtin.invoke([min, max, '実数'], { random: () => 0.999999999, display() {} });
    assert.ok(result >= min && result < max, `${min} <= ${result} < ${max}`);
  }
});
for (const [source, line, match] of [
  ['x = y', 1, /まだ値/], ['x = 1\ny = x / 0', 2, /0で/], ['A = [1]\nx = A[1]', 2, /範囲外/],
  ['A = [[1, 2], [3]]', 1, /列数/], ['A = [[[1]]]', 1, /二次元/],
  ['x = 0\n# 配列の形が不正\nA = [[1], [2, 3]]', 3, /列数/],
  ['x = 9007199254740991\nx = x + 1', 2, /正確/], ['x = 2 ** 1024', 1, /数値/],
  ['もし 真 ならば：\n表示する(1)', 1, /字下げ/], ['そうでなければ：\n  x = 1', 1, /対応/],
  ['x = alert(1)', 1, /使えません/], ['x = 表示する(1)', 1, /式/], ['返す 1', 1, /関数/],
  ['i を 1 から 5 まで 0 ずつ増やしながら繰り返す：\n  x = 1', 1, /1以上/], ['constructor = 1', 1, /値|変数/],
]) test(`diagnostic: ${source.split('\n')[0]}`, () => { assert.throws(() => execute(source), error => error.line === line && match.test(error.message)); });
test('infinite loops, too much output, oversized source stop with bounded errors', () => {
  assert.throws(() => execute('x = 0\n真 の間繰り返す：\n  x = x + 1'), /ステップの上限/);
  assert.throws(() => execute('i を 1 から 1001 まで 1 ずつ増やしながら繰り返す：\n  表示する(i)'), /出力の上限/);
  assert.throws(() => compile('x = 1\n'.repeat(501)), /500行/);
});
test('files round trip Unicode and matrix/input settings, reject unrelated or oversized data', () => {
  const value = draft('Array = 【外部からの入力】\n表示する("🧑‍💻", Array)', { settings: { indexBase: 1, inputs: { Array: { ...defaultInput(), kind: 'matrix' } } } });
  assert.deepEqual(parseDocument(documentJSON(value)), validateDraft(value));
  for (const text of ['{}', '{broken', JSON.stringify({ format: 'mei-program-studio', ...value, version: 2 }), ' '.repeat(LIMITS.fileBytes + 1)]) assert.throws(() => parseDocument(text));
  assert.throws(() => validateDraft({ ...value, settings: { ...settings, inputs: JSON.parse('{"__proto__":{}}') } }));
});
test('URL share round trips all settings without external storage and handles corruption', async () => {
  const value = draft('Data = [[1, 2], [3, 4]]\n表示する("共有テスト", Data)');
  const url = await encodeShare(value, 'https://mei-chan-nel.com/program-trace/studio/?extra=1');
  assert.equal(new URL(url).pathname, '/program-trace/studio/share.html'); assert.equal(new URL(url).search, '');
  assert.ok(url.length < 1000); assert.deepEqual(await decodeShare(new URL(url).hash), validateDraft(value));
  for (const hash of ['', '#v9.abc', '#v1.a', '#v1.%%%error', new URL(url).hash.slice(0, -6), '#v1.' + 'a'.repeat(100001)]) await assert.rejects(decodeShare(hash));
});
test('bounded decompression prevents huge decoded shares, and uncompressed v2 works without compression support', async () => {
  const bytes = Buffer.from('x'.repeat(LIMITS.shareBytes + 1));
  const compressed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  await assert.rejects(decodeShare('#v1.' + Buffer.from(compressed).toString('base64url')), /大きすぎ/);
  const original = globalThis.CompressionStream; globalThis.CompressionStream = undefined;
  try {
    const url = await encodeShare(draft('x = 1'), 'https://example.test/studio/');
    assert.match(new URL(url).hash, /^#v2\.j\./u);
    assert.deepEqual(await decodeShare(new URL(url).hash), validateDraft(draft('x = 1')));
  } finally { globalThis.CompressionStream = original; }
});
class MemoryStorage {
  data = new Map(); getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, String(value)); }
}
test('local draft, named copies and overwrite remain isolated from other site data', () => {
  const memory = new MemoryStorage(), storage = new ProgramStorage(memory); memory.setItem('quiz-data', 'keep');
  storage.saveDraft(draft('x = 1')); assert.equal(storage.draft().source, 'x = 1');
  const first = storage.save(draft('x = 2')), second = storage.save(draft('x = 3'));
  storage.save(draft('x = 4'), first.id); assert.equal(storage.list().length, 2); assert.equal(storage.list().find(item => item.id === first.id).draft.source, 'x = 4');
  storage.remove(second.id); assert.equal(storage.list().length, 1); assert.equal(memory.getItem('quiz-data'), 'keep');
  memory.setItem('mei-program-studio:v1:saved', '{broken'); assert.throws(() => storage.save(draft('x = 5')), /変更していません/); assert.equal(memory.getItem('mei-program-studio:v1:saved'), '{broken');
});
test('unavailable or full local storage reports file fallback', () => {
  const storage = new ProgramStorage({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  assert.throws(() => storage.draft(), /ファイル/); assert.throws(() => storage.saveDraft(draft('x = 1')), /ファイル/);
});

test('serializing a negative base preserves exponent precedence', async () => {
  const {parseExpression,expressionText,valueExpression} = await import('../../../program-trace/studio/expressions.js');
  const parsed = parseExpression('(-1) ** 2');
  assert.equal(execute(`x = ${expressionText(parsed)}`).state.variables.x, 1);
  const built = {kind:'binary',operator:'**',left:valueExpression(-2),right:valueExpression(2),column:1};
  assert.equal(execute(`x = ${expressionText(built)}`).state.variables.x, 4);
});
test('compatibility helpers have exact numeric and array semantics', () => {
  const {state}=execute('x = 整数(-1.2)\ny = べき乗(2, 3)\nA = [1, 2]\nB = 配列結合(A, [3], [4])\nC = 逆順(B)\nB[0] = 9\np = 含む(C, 3)\nq = 含む(C, 9)');
  assert.deepEqual({...state.variables},{x:-2,y:8,A:[1,2],B:[9,2,3,4],C:[4,3,2,1],p:true,q:false});
  assert.throws(()=>execute('x = ランダム整数(3, 2)'));
  assert.throws(()=>execute('x = 配列結合([1], 2)'));
});
