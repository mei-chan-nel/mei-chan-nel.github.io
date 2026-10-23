import test from 'node:test';
import assert from 'node:assert/strict';

// Run the same behavioral contract against the two independent interpreters.
export function rangeTests(engine, run) {
  const headers = trace => trace.filter(state => state.kind === 'for' && state.event?.condition);
  const entered = trace => headers(trace).filter(state => state.event.condition.result);
  for (const [name, header, body, expected, final] of [
    ['inclusive', 'i を 1 から 5 まで 1 ずつ増やしながら繰り返す：', '', ['1', '2', '3', '4', '5'], 5],
    ['body increments counter', 'i を 1 から 5 まで 1 ずつ増やしながら繰り返す：', '  i = i + 10', ['1', '2', '3', '4', '5'], 15],
    ['decreasing', 'i を 5 から 1 まで 2 ずつ減らしながら繰り返す：', '', ['5', '3', '1'], 1],
    ['decreasing with body assignment', 'i を 5 から 1 まで 2 ずつ減らしながら繰り返す：', '  i = i - 10', ['5', '3', '1'], -9],
    ['end not reached exactly', 'i を 1 から 6 まで 2 ずつ増やしながら繰り返す：', '', ['1', '3', '5'], 5],
    ['decreasing end not reached exactly', 'i を 6 から 1 まで 2 ずつ減らしながら繰り返す：', '', ['6', '4', '2'], 2],
    ['single iteration', 'i を 3 から 3 まで 7 ずつ増やしながら繰り返す：', '  i = i + 10', ['3'], 13],
    ['counter becomes text', 'i を 1 から 3 まで 1 ずつ増やしながら繰り返す：', '  i = "changed"', ['1', '2', '3'], 'changed'],
    ['counter moves backwards', 'i を 1 から 3 まで 1 ずつ増やしながら繰り返す：', '  i = -100', ['1', '2', '3'], -100],
  ]) {
    test(`${engine}: range ${name}`, () => {
      const source = [header, '  表示する(i)', body].filter(Boolean).join('\n');
      const { state, trace, output } = run(source);
      assert.deepEqual(output, expected);
      assert.equal(state.variables.i, final);
      assert.deepEqual(entered(trace).map(item => item.variables.i), expected.map(Number));
      assert.equal(headers(trace).length, expected.length + 1, 'the exhaustion check remains a visible step');
      const exit = headers(trace).at(-1);
      assert.equal(exit.variables.i, final);
      assert.deepEqual(exit.changes, []);
      assert.deepEqual(exit.event.assignments ?? [], []);
      assert.match(exit.event.explanation, /数列の値をすべて使い.*値は変更せず/u);
      for (const entry of entered(trace)) {
        assert.deepEqual(entry.event.assignments.map(item => item.name), ['i']);
        assert.match(entry.event.explanation, /数列の(?:開始値|次の値).*代入/u);
      }
    });
  }
  for (const [direction, start, end] of [['増やし', 5, 1], ['減らし', 1, 5]]) {
    for (const prior of ['', 'i = 42\n']) {
      test(`${engine}: empty ${direction} range ${prior ? 'retains a prior value' : 'does not create a variable'}`, () => {
        const { state, trace, output } = run(`${prior}i を ${start} から ${end} まで 1 ずつ${direction}ながら繰り返す：\n  表示する(i)\n表示する("end")`);
        assert.deepEqual(output, ['end']);
        assert.equal(Object.hasOwn(state.variables, 'i'), !!prior);
        if (prior) assert.equal(state.variables.i, 42);
        const [exit] = headers(trace);
        assert.equal(headers(trace).length, 1);
        assert.equal(exit.event.condition.result, false);
        assert.deepEqual(exit.changes, []);
        assert.deepEqual(exit.event.assignments ?? [], []);
        assert.deepEqual(exit.skippedLines, [prior ? 3 : 2]);
        assert.match(exit.event.explanation, /一度も繰り返しません/u);
      });
    }
  }
  test(`${engine}: start, end and step are frozen independently of body assignments`, () => {
    const { state, trace, output } = run('start = 1, end = 5, amount = 2\ni を start から end まで amount ずつ増やしながら繰り返す：\n  表示する(i)\n  start = 99, end = -99, amount = 100\n  i = i + 10');
    assert.deepEqual(output, ['1', '3', '5']);
    assert.equal(state.variables.i, 15);
    assert.equal(entered(trace).length, 3);
    const self = run('i = 3\ni を 1 から i まで 1 ずつ増やしながら繰り返す：\n  表示する(i)\n  i = i + 10');
    assert.deepEqual(self.output, ['1', '2', '3']);
    assert.equal(self.state.variables.i, 13);
  });
  test(`${engine}: decreasing inner loops and modified counters have independent cursors`, () => {
    const { state, output } = run('i を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n  表示する("outer", i)\n  j を 5 から 1 まで 2 ずつ減らしながら繰り返す：\n    表示する(j)\n    j = j - 10\n  i = i + 10');
    assert.deepEqual(output, ['outer1', '5', '3', '1', 'outer2', '5', '3', '1']);
    assert.equal(state.variables.i, 12);
    assert.equal(state.variables.j, -9);
  });
  test(`${engine}: nested loops can reuse the same counter name`, () => {
    const { state, output } = run('i を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n  表示する("outer", i)\n  i を 5 から 3 まで 2 ずつ減らしながら繰り返す：\n    表示する("inner", i)\n  表示する("after", i)');
    assert.deepEqual(output, ['outer1', 'inner5', 'inner3', 'after3', 'outer2', 'inner5', 'inner3', 'after3']);
    assert.equal(state.variables.i, 3);
  });
  test(`${engine}: inner bounds are re-evaluated on each new invocation`, () => {
    const { output } = run('i を 1 から 3 まで 1 ずつ増やしながら繰り返す：\n  j を 1 から i まで 1 ずつ増やしながら繰り返す：\n    表示する(i, ":", j)');
    assert.deepEqual(output, ['1:1', '2:1', '2:2', '3:1', '3:2', '3:3']);
  });
  test(`${engine}: range calls are evaluated once, including suspended function continuations`, () => {
    const { state, output } = run('定義する bound(n)：\n  表示する("bound", n)\n  返す n\ni を bound(1) から bound(5) まで bound(2) ずつ増やしながら繰り返す：\n  表示する(i)\n  i = i + 10');
    assert.deepEqual(output.filter(value => value.startsWith('bound')).sort(), ['bound1', 'bound2', 'bound5']);
    assert.deepEqual(output.filter(value => !value.startsWith('bound')), ['1', '3', '5']);
    assert.equal(state.variables.i, 15);
  });
  test(`${engine}: recursive calls to the same loop have isolated cursors`, () => {
    const { state, output } = run('定義する f(n)：\n  total = 0\n  i を 1 から 2 まで 1 ずつ増やしながら繰り返す：\n    もし n > 0 ならば：\n      total = total + f(n - 1)\n    i = i + 10\n  返す total + i\ni = 99\n表示する(f(2), ":", i)');
    assert.deepEqual(output, ['84:99']);
    assert.equal(state.variables.i, 99);
  });
  test(`${engine}: early returns discard only the departing call's loop`, () => {
    const { output } = run('定義する f(n)：\n  i を 1 から 3 まで 1 ずつ増やしながら繰り返す：\n    もし i == 2 ならば：\n      返す i\n    i = i + 10\n  返す 0\n表示する(f(0), ":", f(1))');
    assert.deepEqual(output, ['2:2']);
  });
  for (const [start, end, step, direction, expected] of [
    [Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER, 1, '増やし', [Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER]],
    [Number.MIN_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER, 1, '減らし', [Number.MIN_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER]],
    [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, '増やし', [Number.MIN_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER]],
  ]) {
    test(`${engine}: safe integer boundary ${start}..${end} by ${step}`, () => {
      const { state, trace } = run(`i を ${start} から ${end} まで ${step} ずつ${direction}ながら繰り返す：\n  表示する(i)`);
      assert.deepEqual(entered(trace).map(item => item.variables.i), expected);
      assert.equal(state.variables.i, expected.at(-1));
      assert.deepEqual(headers(trace).at(-1).changes, []);
    });
  }
  test(`${engine}: while still tests the current variable and zero increments remain invalid`, () => {
    const { state, output } = run('i = 0\ni < 3 の間繰り返す：\n  i = i + 1\n  表示する(i)');
    assert.deepEqual(output, ['1', '2', '3']);
    assert.equal(state.variables.i, 3);
    assert.throws(() => run('i を 1 から 5 まで 0 ずつ増やしながら繰り返す：\n  表示する(i)'), /0|1以上/u);
  });
}
