import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
import { modelFromSource, builderSource, validateBuilder, newCommand, assertReady } from '../../../program-trace/studio/builder-model.js';
import { builderContext } from '../../../program-trace/studio/builder-variables.js';
import { functionReferenceLines, hasValueReturn } from '../../../program-trace/studio/builder-functions.js';
import { readExpressionInput } from '../../../program-trace/studio/expression-input.js';
import { documentJSON, parseDocument, validateDraft } from '../../../program-trace/studio/documents.js';
import { encodeShare, decodeShare } from '../../../program-trace/studio/sharing.js';
const settings = { indexBase: 0, inputs: {} };
function run(source, input = {}, seed = 77) {
  const compiled = compile(source), trace = []; let state = initialState(compiled, seed);
  while (!state.completed) {
    assert.ok(state.steps < 1000);
    const before = JSON.stringify(state);
    const next = step(compiled, state, settings, input[compiled.instructions[state.pc].name]);
    assert.equal(JSON.stringify(state), before, 'every previous state remains immutable');
    trace.push(state); state = next;
  }
  return { state, trace, compiled };
}
test('functions below main execute line by line with independent recursive locals and return to the pending expression', () => {
  const { state, trace } = run('n = 9\nx = fact(4) + fact(3)\n表示する(n, ":", x)\n定義する fact(n)：\n  もし n <= 1 ならば：\n    返す 1\n  返す n * fact(n - 1)');
  assert.deepEqual(state.output, ['9:30']); assert.equal(state.variables.n, 9); assert.equal(state.variables.x, 30);
  assert.ok(trace.some(item => item.frames.length === 5 && item.variables.n === 1));
  assert.ok(trace.some(item => item.currentLine === 6)); assert.equal(state.frames.length, 1);
});
test('suspended nested arguments, array indices and sequential assignments evaluate random values once', () => {
  const source = 'A = [0, 0]\nx = 乱数(), y = identity(identity(x) + 乱数())\nA[identity(1)] = identity(y)\n表示する(A, x, y)\n定義する identity(n)：\n  返す n';
  const { state, trace, compiled } = run(source);
  const advance = seed => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  assert.equal(state.randomState, advance(advance(77))); assert.equal(state.variables.A[1], state.variables.y);
  assert.deepEqual(trace[1].variables.A, [0, 0]);
  // Restoring any earlier state reproduces the next call, return and mutation.
  for (let i = 0; i < trace.length - 1; i++) assert.deepEqual(step(compiled, trace[i], settings), trace[i + 1]);
  assert.deepEqual(step(compiled, trace.at(-1), settings), state);
});
test('array arguments and returned arrays are copied and local loops do not leak to main', () => {
  const { state } = run('A = [[1, 2], [3, 4]]\nB = change(A)\n表示する(A, B)\n定義する change(Data)：\n  i を 0 から 1 まで 1 ずつ増やしながら繰り返す：\n    Data[i, 0] = Data[i, 0] + 10\n  返す Data');
  assert.deepEqual(state.variables.A, [[1, 2], [3, 4]]); assert.deepEqual(state.variables.B, [[11, 2], [13, 4]]);
  assert.equal(state.variables.i, undefined); assert.equal(state.variables.Data, undefined);
});
test('short circuit skips custom calls, external inputs suspend inside functions, and standalone procedures can finish without a value', () => {
  const { state, trace } = run('x = 偽 and danger()\nannounce()\ny = inputValue()\n表示する(y)\n定義する danger()：\n  返す 1 / 0\n定義する announce()：\n  表示する("hello")\n定義する inputValue()：\n  age = 【外部からの入力】\n  返す age', { age: 18 });
  assert.deepEqual(state.output, ['hello', '18']); assert.ok(trace.some(s => s.frames.at(-1).name === 'inputValue'));
  assert.throws(() => run('x = empty()\n定義する empty()：\n  表示する(1)'), /返す値/);
  assert.throws(() => run('outer(empty())\n定義する outer(n)：\n  返す n\n定義する empty()：\n  返す'), /返す値/);
});
test('invalid signatures, returns outside functions, unknown calls and unbounded recursion report errors', () => {
  for (const source of ['返す 1', 'x = missing()', 'x = f(1, 2)\n定義する f(n)：\n  返す n', '定義する f(n, n)：\n  返す n', '定義する f()：\n  定義する g()：\n    返す 1', '定義する f()：\n  返す 1\n定義する f()：\n  返す 2', '定義する 乱数()：\n  返す 1']) assert.throws(() => compile(source));
  assert.throws(() => run('f()\n定義する f()：\n  f()'), /呼び出しが深すぎ/);
});
test('function editing contexts expose local parameters and functions; files and shares preserve complete and unfinished blocks', async () => {
  const source = 'main = 3\nx = twice(main)\n定義する twice(n)：\n  local = n * 2\n  返す local';
  const model = modelFromSource(source), definition = model.nodes.at(-1), context = builderContext(model, {}, 0, definition.id);
  assert.deepEqual(context.variables, ['n', 'local']); assert.equal(context.functions[0].name, 'twice');
  assert.equal(readExpressionInput('twice(n)', context).kind, 'call');
  assert.throws(() => readExpressionInput('twice(n, 1)', context));
  const draft = { version: 1, title: '自作関数', source: builderSource(model), settings };
  assert.deepEqual(parseDocument(documentJSON(draft)), validateDraft(draft));
  assert.deepEqual(await decodeShare(new URL(await encodeShare(draft, 'https://example.test/studio/')).hash), validateDraft(draft));
  const fn = newCommand('define'), unfinished = validateBuilder({ version: 1, nodes: [newCommand('assign'), fn] });
  assert.throws(() => assertReady(unfinished));
  const partial = { ...draft, source: builderSource(unfinished), builder: unfinished };
  const loaded = await decodeShare(new URL(await encodeShare(partial, 'https://example.test/studio/')).hash);
  assert.equal(loaded.builder.nodes[1].kind, 'define'); assert.deepEqual(loaded.builder.nodes[1].parameters, []);
});
test('only functions with value returns are expression candidates, including returns in branches and loops', () => {
  const model = modelFromSource('通知()\n定義する 通知()：\n  表示する("hello")\n  返す\n定義する 計算(n)：\n  もし n > 0 ならば：\n    返す n\n  そうでなければ：\n    n の間繰り返す：\n      返す 0');
  const context = builderContext(model, {}, 0);
  assert.deepEqual(context.functions.map(fn => [fn.name, fn.returnsValue]), [['通知', false], ['計算', true]]);
  assert.throws(() => readExpressionInput('通知()', context), /返す値がありません/);
  assert.throws(() => readExpressionInput('計算(通知())', context), /返す値がありません/);
  assert.equal(readExpressionInput('計算(1)', context).kind, 'call');
  assert.equal(hasValueReturn(model.nodes[1].body), false); assert.equal(hasValueReturn(model.nodes[2].body), true);
});
test('deletion identifies call sites inside expressions, arguments, indices and branches, excluding its own recursive body', () => {
  const model = modelFromSource('A = [0]\nA[f(0)] = f(f(1))\n表示する(f(2))\nもし f(3) > 0 ならば：\n  f(4)\n定義する f(n)：\n  返す f(n - 1)\n定義する g()：\n  返す f(5)');
  assert.deepEqual(functionReferenceLines(model, 'f', model.nodes[4].id), [2, 3, 4, 5, 9]);
  assert.deepEqual(functionReferenceLines(model, 'g', model.nodes[5].id), []);
});
