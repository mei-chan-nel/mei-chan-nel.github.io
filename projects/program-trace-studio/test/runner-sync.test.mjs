import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compile, initialState, step, finish } from '../../../program-trace/studio/runtime.js';
import { assignmentLinks, routeAssignment, crossesBox } from '../../../program-trace/studio/assignment-flow.js';
import { highlightScrollTop } from '../../../program-trace/studio/variable-scroll.js';
import { matchesReference, previewIndices } from '../../../program-trace/studio/runner-model.js';
const settings = { indexBase: 0, inputs: {} };
function trace(source, options = settings) {
  const program = compile(source), result = []; let state = initialState(program);
  while (!state.completed) { state = step(program, state, options); result.push(state); }
  return result;
}
const ref = (name, ...indices) => ({ name, indices });

test('each assignment links only its evaluated right-hand sources to its own target, in sequential order', () => {
  const rows = trace('x = 3\ny = 4\ntmp = x, x = y, y = tmp');
  assert.deepEqual(rows[2].variables, { x: 4, y: 3, tmp: 3 });
  assert.deepEqual(assignmentLinks(rows[2].event), [
    { source: ref('x'), target: ref('tmp'), self: false },
    { source: ref('y'), target: ref('x'), self: false },
    { source: ref('tmp'), target: ref('y'), self: false },
  ]);
  assert.equal(assignmentLinks(rows[0].event).length, 0);
});

test('array index calculations are references but never become the transferred value', () => {
  const rows = trace('A = [3, 5, 9]\ni = 0\nj = 1\nA[i] = A[j + 1]');
  const last = rows.at(-1);
  assert.deepEqual(last.event.assignments, [{ ...ref('A', 0), sources: [ref('A', 2)] }]);
  assert.deepEqual(last.reads, [ref('j'), ref('A', 2), ref('i')]);
  assert.deepEqual(assignmentLinks(last.event), [{ source: ref('A', 2), target: ref('A', 0), self: false }]);
  assert.deepEqual(rows[0].variables.A, [3, 5, 9]);
});

test('unchanged assignments retain target highlights, and a self assignment is a loop rather than two cells', () => {
  const rows = trace('x = 1\nx = x + x\nx = x');
  assert.deepEqual(rows[2].changes, []);
  assert.deepEqual(rows[2].event.assignments, [{ ...ref('x'), sources: [ref('x')] }]);
  assert.deepEqual(assignmentLinks(rows[1].event), [{ source: ref('x'), target: ref('x'), self: true }]);
  assert.equal(rows[1].changes[0].before, 1);
  assert.equal(rows[1].changes[0].after, 2);
});

test('two-dimensional transfers preserve displayed one-based indices and separate index variables', () => {
  const rows = trace('Table = [[1, 2], [3, 4]]\ni = 1\nj = 2\nTable[i, j] = Table[j][i]', { ...settings, indexBase: 1 });
  assert.deepEqual(rows.at(-1).variables.Table, [[1, 3], [3, 4]]);
  assert.deepEqual(assignmentLinks(rows.at(-1).event), [{ source: ref('Table', 2, 1), target: ref('Table', 1, 2), self: false }]);
  assert.equal(matchesReference(ref('Table', 1), 'Table', [1, 2]), true);
  assert.equal(matchesReference(ref('Table', 2, 1), 'Table', [1, 2]), false);
});

test('short circuit, conditions, output and completion never reuse stale assignment arrows', () => {
  const rows = trace('x = 1\ny = 真 or missing\nもし x == 1 ならば：\n  表示する(x)');
  assert.deepEqual(rows[1].event.sources, []);
  for (const state of [rows[2], rows[3], finish(rows[3])]) assert.deepEqual(assignmentLinks(state.event), []);
  assert.deepEqual(initialState(compile('x = 1')).event, null);
});

test('false branches show the nested skipped lines for that step and clear them on the next step', () => {
  const rows = trace('x = 0\nもし x > 0 ならば：\n  もし x > 10 ならば：\n    表示する("large")\n  そうでなければ：\n    表示する("positive")\nそうでなければ：\n  表示する("zero")');
  assert.deepEqual(rows[1].skippedLines, [3, 4, 5, 6]);
  assert.deepEqual(rows[2].skippedLines, []); assert.deepEqual(rows[3].output, ['zero']);
  assert.deepEqual(finish(rows[3]).skippedLines, []);
});

test('an empty loop marks the unexecuted body, while a finished nonempty for loop does not', () => {
  const empty = trace('i を 5 から 1 まで 1 ずつ増やしながら繰り返す：\n  表示する(i)');
  assert.deepEqual(empty[0].skippedLines, [2]); assert.deepEqual(finish(empty[0]).skippedLines, []);
  const normal = trace('i を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n  表示する(i)');
  assert.deepEqual(normal.at(-1).skippedLines, []);
  const condition = trace('x = 0\nx > 0 の間繰り返す：\n  x = x + 1');
  assert.deepEqual(condition.at(-1).skippedLines, [3]);
});

test('collecting transfer metadata does not evaluate a random expression twice', () => {
  const program = compile('x = 乱数()'), initial = initialState(program, 42);
  const state = step(program, initial, settings);
  const expected = (Math.imul(42, 1664525) + 1013904223) >>> 0;
  assert.equal(state.randomState, expected); assert.equal(state.variables.x, expected / 4294967296);
  assert.deepEqual(state.event.assignments, [{ ...ref('x'), sources: [] }]);
});

test('external input has a destination and no fabricated source', () => {
  const program = compile('age = 【外部からの入力】'), state = step(program, initialState(program), settings, 18);
  assert.deepEqual(state.event.assignments, [{ ...ref('age'), sources: [] }]);
  assert.deepEqual(assignmentLinks(state.event), []);
});

test('compact previews retain distant source and target cells, including mandatory references that exceed capacity', () => {
  assert.deepEqual(previewIndices(3, 6), [0, 1, 2]); assert.deepEqual(previewIndices(0, 6), []);
  for (const length of [10, 50, 1000]) {
    for (const references of [[0, length - 1], [3, length - 4], Array.from({ length: 10 }, (_, i) => i * 2)]) {
      const visible = previewIndices(length, 6, references);
      for (const index of references.filter(i => i < length)) assert.ok(visible.includes(index));
      assert.deepEqual([...visible].sort((a, b) => a - b), visible);
      assert.equal(new Set(visible).size, visible.length);
      assert.ok(visible.every(i => i >= 0 && i < length));
    }
  }
  assert.deepEqual(previewIndices(10, 6, [NaN, -1, 10, 2.5]), previewIndices(10, 6));
});

test('scroll positioning prioritizes a visible assignment target and then its source, without needless movement', () => {
  const targets = [{ top: 300, bottom: 350 }], sources = [{ top: 220, bottom: 260 }];
  const top = highlightScrollTop({ current: 0, height: 200, extent: 500, targets, sources });
  assert.ok(top <= 220 && top + 200 >= 350);
  assert.equal(highlightScrollTop({ current: top, height: 200, extent: 500, targets, sources }), top);
  assert.equal(highlightScrollTop({ current: 85, height: 200, extent: 500 }), 85);
  assert.equal(highlightScrollTop({ current: 20, height: 100, extent: 80, targets }), 0);
});

test('assignment arrows route around values and safely omit a route when no clearance exists', () => {
  const from = { left: 20, right: 70, top: 20, bottom: 70 }, to = { left: 190, right: 240, top: 20, bottom: 70 };
  const obstacle = { left: 95, right: 160, top: 10, bottom: 80 };
  const route = routeAssignment(from, to, [from, to, obstacle], { width: 280, height: 150 });
  assert.ok(route);
  for (let i = 1; i < route.length; i++) assert.equal(crossesBox(route[i - 1], route[i], obstacle), false);
  assert.equal(routeAssignment(from, to, [{ left: 0, right: 280, top: 0, bottom: 150 }], { width: 280, height: 150 }), null);
});

test('Studio uses the latest published runner interaction modules unchanged, without its interpreter or problem collection', async () => {
  for (const name of ['assignment-flow.js', 'variable-scroll.js', 'fullscreen.js']) {
    const expected = await readFile(new URL(`../../../program-trace/${name}`, import.meta.url));
    assert.deepEqual(await readFile(new URL(`../../../program-trace/studio/${name}`, import.meta.url)), expected);
  }
});
