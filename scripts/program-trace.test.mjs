import assert from "node:assert/strict";
import test from "node:test";
import { EXAMPLES, PROGRAMS, VIDEO_PROGRAMS, programForQuestion, defaultParameters, sourceLines, lineLabel, validateParameters } from "../program-trace/examples.js";
import { compileProgram, createState, evaluate, MAX_STEPS, MAX_CALL_DEPTH, nextLine, inputRequest, step } from "../program-trace/interpreter.js";
import { createAutoplay, adjustInterval, intervalSeconds } from "../program-trace/autoplay.js";
import { finishTrace } from "../program-trace/trace-completion.js";
import { planWorkspace } from "../program-trace/workspace.js";
import { formatValue, validateField } from "../program-trace/values.js";
import { literal as v, ref as r, op, at, call, define, returnValue, print, assign } from "../program-trace/language.js";

const exampleFor = (id) => EXAMPLES.find((example) => example.id === id);
function execute(id, overrides = {}, inputs = {}) {
  const example = exampleFor(id);
  const parameters = { ...defaultParameters(example), ...overrides };
  assert.equal(validateParameters(example, parameters).valid, true);
  const compiled = compileProgram(example.program);
  let state = createState(compiled);
  const trace = [];
  while (!state.completed) {
    const request = inputRequest(compiled, state);
    state = step(compiled, state, parameters, request ? { input: inputs[request.name] ?? parameters[request.field.key] } : {});
    trace.push(state);
    assert.ok(trace.length <= MAX_STEPS);
  }
  return { state, trace, compiled, parameters };
}
const output = (state) => state.output.map((item) => item.text);

test("15の代表問題を指定順に収録し、動画解説問題は別のコレクションにする", () => {
  assert.equal(EXAMPLES.length, 15);
  assert.deepEqual(EXAMPLES.map((example) => example.number), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.equal(new Set(PROGRAMS.map((example) => example.id)).size, PROGRAMS.length);
  assert.ok(EXAMPLES.every((example) => example.collection === "representative"));
  assert.equal(VIDEO_PROGRAMS.length, 100);
  assert.ok(VIDEO_PROGRAMS.every((example) => example.collection === "video"));
  assert.equal(programForQuestion("unregistered"), undefined);
});

test("表記の行数・行番号・命令データが一致し、設定値の置換で原文の数値を再現する", () => {
  const firstLines = ["x = 3", "x = 1", "Data = [3, 5, 9]", "age = 【外部からの入力】", "number = 【外部からの入力】", "sum = 0", "Tokuten = [5, 7, 8, 4]", "count = 0", "Data = [54, 23, 34, 67, 49]", "i を 1 から 5 まで 1 ずつ増やしながら繰り返す：", "sum = 0, i = 0", "Array = 【外部からの入力】", "Array = 【外部からの入力】", "定義する factorial(n)", "kaisu = 1000"];
  const lineCounts = [4, 7, 5, 5, 9, 5, 6, 5, 6, 4, 6, 8, 17, 6, 8];
  EXAMPLES.forEach((example, index) => {
    const lines = sourceLines(example, defaultParameters(example));
    assert.equal(lines.length, lineCounts[index]);
    assert.equal(lines[0].text, firstLines[index]);
    assert.ok(lines.every((line) => !/\{[A-Za-z_]+\}/.test(line.text)));
    const compiled = compileProgram(example.program);
    assert.deepEqual(Object.keys(compiled.lineKinds).map(Number), lines.map((line) => line.line));
    assert.equal(validateParameters(example, defaultParameters(example)).valid, true);
  });
  const binary = exampleFor("binary-search");
  assert.equal(lineLabel(binary, 1), "（01）");
  assert.equal(lineLabel(binary, 17), "（17）");
  assert.equal(sourceLines(binary, defaultParameters(binary))[5].text, "｜ mid = (low + high) ÷ 2");
  assert.equal(sourceLines(exampleFor("average"), defaultParameters(exampleFor("average")))[2].text.endsWith("："), false);
});

test("初期状態では行の選択なし、最初の1ステップで1行目と代入結果を反映する", () => {
  const example = exampleFor("addition");
  const compiled = compileProgram(example.program);
  const initial = createState(compiled);
  assert.equal(initial.currentLine, null);
  assert.deepEqual(initial.variables, {});
  assert.deepEqual(initial.output, []);
  assert.equal(nextLine(compiled, initial), 1);
  const first = step(compiled, initial, defaultParameters(example));
  assert.equal(first.currentLine, 1);
  assert.equal(first.steps, 1);
  assert.deepEqual(first.variables, { x: 3 });
  assert.equal(first.event.explanation, "x に 3 を代入しました。");
  assert.equal(initial.currentLine, null);
});

test("合計と変数の交換は、指定の行順と変更前後の値を示す", () => {
  const addition = execute("addition");
  assert.deepEqual(addition.trace.map((state) => state.currentLine), [1, 2, 3, 4]);
  assert.deepEqual(addition.state.variables, { x: 3, y: 4, goukei: 7 });
  assert.deepEqual(output(addition.state), ["合計は7です。"]);
  const swap = execute("swap");
  assert.deepEqual(swap.trace[2].variables, { x: 1, y: 2, tmp: 1 });
  assert.deepEqual(swap.trace[3].changes, [{ name: "x", before: 1, after: 2 }]);
  assert.deepEqual(swap.trace[4].changes, [{ name: "y", before: 2, after: 1 }]);
  assert.deepEqual(output(swap.state), ["現在のxの値は2です。", "現在のyの値は1です。"]);
  assert.equal(execute("addition", { x: 0, y: -4 }).state.variables.goukei, -4);
});

test("配列の交換では要素番号と変更前後を示し、過去の配列と初期値を変更しない", () => {
  const { state, trace, parameters } = execute("array-swap");
  assert.deepEqual(trace[0].variables.Data, [3, 5, 9]);
  assert.deepEqual(trace[2].variables.Data, [9, 5, 9]);
  assert.deepEqual(trace[3].variables.Data, [9, 5, 3]);
  assert.equal(trace[2].changes[0].beforeElement, 3);
  assert.equal(trace[2].changes[0].afterElement, 9);
  assert.deepEqual(trace[2].changes[0].indices, [0]);
  assert.deepEqual(trace[2].reads, [{ name: "Data", indices: [2] }]);
  assert.deepEqual(parameters.Data, [3, 5, 9]);
  assert.deepEqual(output(state), ["現在のDataは[9, 5, 3]"]);
  const longer = execute("array-swap", { Data: [0, 2, -8, 10, 99] }).state;
  assert.deepEqual(longer.variables.Data, [-8, 2, 0, 10, 99]);
});

test("代入元は実際に使う変数・要素で、添字や短絡評価で省略された式を含めない", () => {
  const swap = execute("swap");
  assert.deepEqual(swap.trace[2].event.sources, [{ name: "x", indices: [] }]);
  assert.deepEqual(swap.trace[3].event.sources, [{ name: "y", indices: [] }]);
  assert.deepEqual(swap.trace[4].event.sources, [{ name: "tmp", indices: [] }]);
  assert.deepEqual(swap.trace[5].event.sources, []);
  assert.deepEqual(execute("array-swap").trace[2].event.sources, [{ name: "Data", indices: [2] }]);
  const compiled = compileProgram([
    assign(1, "Data", r("x"), r("i")),
    assign(2, "tmp", at("Data", r("j"))),
    assign(3, "result", op("and", op(">", r("x"), v(0)), op(">", at("Data", r("j")), v(0)))),
  ], { initialVariables: { Data: [3, 5], x: -1, i: 0, j: 1 } });
  const initial = createState(compiled);
  const first = step(compiled, initial, {});
  const second = step(compiled, first, {});
  const third = step(compiled, second, {});
  assert.deepEqual(first.event.sources, [{ name: "x", indices: [] }]);
  assert.deepEqual(second.event.sources, [{ name: "Data", indices: [1] }]);
  assert.deepEqual(third.event.sources, [{ name: "x", indices: [] }]);
  assert.equal(third.variables.result, false);
  assert.deepEqual(initial.variables.Data, [3, 5]);
  assert.deepEqual(first.event.sources, [{ name: "x", indices: [] }]);
});

test("関数呼び出しで中断・再開した代入も、右辺の代入元を保持する", () => {
  const compiled = compileProgram([
    define(1, "square", ["n"], returnValue(2, op("*", r("n"), r("n")))),
    assign(3, "result", op("+", r("x"), call("square", r("x")))),
    print(4, r("result")),
  ], { initialVariables: { x: 3 } });
  let state = createState(compiled);
  const trace = [];
  while (!state.completed) { state = step(compiled, state, {}); trace.push(state); }
  const assignment = trace.find((state) => state.currentLine === 3 && state.event.kind === "assign");
  assert.equal(assignment.variables.result, 12);
  assert.deepEqual(assignment.event.sources, [{ name: "x", indices: [] }, { name: "x", indices: [] }]);
  assert.deepEqual(trace.find((state) => state.event.kind === "call").event.sources, []);
  assert.deepEqual(state.event.sources, []);
  assert.deepEqual(output(state), ["12"]);
});

for (const [age, lines, text] of [[0, [1, 2, 4, 5], "未成年です。"], [17, [1, 2, 4, 5], "未成年です。"], [18, [1, 2, 3], "成人です。"], [120, [1, 2, 3], "成人です。"]]) {
  test(`年齢 ${age}：境界を正しく判定し、選んだ枝だけを実行する`, () => {
    const { state, trace } = execute("condition", {}, { age });
    assert.deepEqual(trace.map((state) => state.currentLine), lines);
    assert.deepEqual(output(state), [text]);
    assert.equal(state.variables.age, age);
  });
}

for (const [number, lines, text] of [[12, [1, 2, 3], "6の倍数"], [4, [1, 2, 4, 5], "2の倍数だが3の倍数でない"], [9, [1, 2, 4, 6, 7], "3の倍数だが2の倍数でない"], [5, [1, 2, 4, 6, 8, 9], "2の倍数でも3の倍数でもない"], [0, [1, 2, 3], "6の倍数"], [-6, [1, 2, 3], "6の倍数"]]) {
  test(`整数 ${number}：複数の条件が成り立っても最初の枝だけ実行する`, () => {
    const { state, trace } = execute("multiples", {}, { number });
    assert.deepEqual(trace.map((state) => state.currentLine), lines);
    assert.deepEqual(output(state), [text]);
  });
}

test("外部入力は確定まで状態を進めず、範囲外・空欄・小数を拒否する", () => {
  const example = exampleFor("condition");
  const compiled = compileProgram(example.program);
  const initial = createState(compiled);
  assert.equal(inputRequest(compiled, initial).name, "age");
  assert.throws(() => step(compiled, initial, defaultParameters(example)), /入力を待って/);
  for (const input of [-1, 121, "", "18.5", "alert(1)", true]) assert.throws(() => step(compiled, initial, {}, { input }));
  assert.equal(initial.steps, 0);
  assert.deepEqual(initial.variables, {});
  const accepted = step(compiled, initial, {}, { input: "17" });
  assert.equal(accepted.currentLine, 1);
  assert.deepEqual(accepted.variables, { age: 17 });
  assert.equal(inputRequest(compiled, accepted), null);
  assert.ok(inputRequest(compiled, createState(compiled)));
});

test("for の各行で i と sum が進み、過去の出力を順に蓄積する", () => {
  const { state, trace } = execute("for-loop");
  assert.deepEqual(trace.map((state) => state.currentLine), [1, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 5]);
  assert.deepEqual(trace.filter((state) => state.currentLine === 2).map((state) => state.variables.i), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(trace.filter((state) => state.currentLine === 3).map((state) => state.variables.sum), [1, 3, 6, 10, 15]);
  assert.deepEqual(output(state), ["現在の合計は1", "現在の合計は3", "現在の合計は6", "現在の合計は10", "現在の合計は15", "最終的な合計は15"]);
  assert.equal(trace.at(-2).event.condition.result, false);
});

test("for の範囲・増分を変更でき、空の範囲や1回だけの範囲も扱う", () => {
  const changed = execute("for-loop", { sum: 10, start: 0, end: 5, step: 2 });
  assert.deepEqual(changed.trace.filter((state) => state.currentLine === 2).map((state) => state.variables.i), [0, 2, 4, 6]);
  assert.equal(changed.state.variables.sum, 16);
  const empty = execute("for-loop", { start: 5, end: 1 });
  assert.deepEqual(empty.trace.map((state) => state.currentLine), [1, 2, 5]);
  assert.deepEqual(empty.trace[1].skippedLines, [3, 4]);
  assert.equal(execute("for-loop", { start: 3, end: 3 }).state.variables.sum, 3);
});

test("平均点は要素数に合わせて繰り返し、1要素・20要素・小数の結果にも対応する", () => {
  assert.deepEqual(output(execute("average").state), ["平均点は6点です"]);
  assert.equal(execute("average", { Tokuten: [90] }).state.variables.average, 90);
  const changed = execute("average", { Tokuten: [1, 2, 2] });
  assert.equal(changed.state.variables.average, 5 / 3);
  assert.equal(changed.state.variables.i, 3);
  assert.match(output(changed.state)[0], /^平均点は1\.666666667点です$/);
  assert.equal(execute("average", { Tokuten: Array(20).fill(100) }).state.variables.average, 100);
});

test("入れ子の条件分岐で3の倍数だけを数える", () => {
  const { state, trace } = execute("count-multiples");
  assert.equal(state.variables.count, 3);
  assert.deepEqual(trace.filter((state) => state.currentLine === 4).map((state) => state.variables.i), [3, 6, 9]);
  assert.deepEqual(output(state), ["3の倍数の個数は3"]);
  assert.equal(execute("count-multiples", { end: 2 }).state.variables.count, 0);
  assert.equal(execute("count-multiples", { end: 500 }).state.variables.count, 166);
});

test("最大値は負数・同値・1要素の配列でも正しく求める", () => {
  assert.deepEqual(output(execute("maximum").state), ["配列Data内の最大の数は67"]);
  for (const Data of [[-8, -2, -10], [6, 6, 6], [42], [999, 1, -999]]) assert.equal(execute("maximum", { Data }).state.variables.max_value, Math.max(...Data));
});

test("二重ループは内側の j を毎回初期化し、二次元配列を1マスずつ更新する", () => {
  const { state, trace } = execute("matrix");
  assert.deepEqual(trace.filter((state) => state.currentLine === 3).map((state) => [state.variables.i, state.variables.j]), Array.from({ length: 5 }, (_, i) => Array.from({ length: 3 }, (_, j) => [i + 1, j + 1])).flat());
  assert.equal(Object.keys(trace.find((state) => state.currentLine === 3).variables.Kuku.cells).length, 1);
  assert.equal(Object.keys(state.variables.Kuku.cells).length, 15);
  assert.equal(state.variables.Kuku.cells["5,3"], 15);
  assert.equal(formatValue(state.variables.Kuku), "[[1, 2, 3], [2, 4, 6], [3, 6, 9], [4, 8, 12], [5, 10, 15]]");
  assert.equal(execute("matrix", { rows: 10, columns: 10 }).state.variables.Kuku.cells["10,10"], 100);
});

test("while は sum < 20 を毎回判定し、sum=21・i=6 で終了する", () => {
  const { state, trace } = execute("while-loop");
  assert.deepEqual(trace[0].variables, { sum: 0, i: 0 });
  assert.deepEqual(trace[2].variables, { sum: 0, i: 1 });
  assert.deepEqual(trace[3].variables, { sum: 1, i: 1 });
  assert.deepEqual(state.variables, { sum: 21, i: 6 });
  assert.equal(state.steps, 27);
  assert.equal(output(state).at(-1), "sumが20を超えるのはiが6のときです");
  assert.equal(output(state).length, 7);
  const boundary = execute("while-loop", { limit: 21 });
  assert.equal(boundary.state.variables.sum, 21);
  assert.equal(boundary.trace.at(-2).event.condition.result, false);
  assert.deepEqual(execute("while-loop", { sum: 20 }).trace.map((state) => state.currentLine), [1, 2, 6]);
});

for (const items of [[5, 3, 8, 1, 4], [2, 1], [1, 2, 3], [3, 3, -1, 0], [-5, -9, -2], Array.from({ length: 12 }, (_, index) => 12 - index)]) {
  test(`バブルソート ${JSON.stringify(items)}：交換を3行に分けて昇順にする`, () => {
    const { state, trace } = execute("bubble-sort", {}, { Array: items });
    assert.deepEqual(state.variables.Array, [...items].sort((a, b) => a - b));
    assert.equal(output(state)[0], `バブルソート後：${formatValue(state.variables.Array)}`);
    for (let index = 0; index < trace.length; index++) {
      if (trace[index].currentLine === 5) assert.deepEqual(trace.slice(index, index + 3).map((state) => state.currentLine), [5, 6, 7]);
    }
    assert.deepEqual(trace[0].variables.Array, items);
  });
}

test("二分探索は両端・中央・不在・重複・1要素を扱い、配列の範囲外を参照しない", () => {
  for (const items of [[3, 7, 12, 18, 25, 31, 42], [-9, -2, 0, 5, 5, 99], [0], Array.from({ length: 20 }, (_, index) => index * 3)]) {
    for (const target of [...items, -10, -1, 1, 100]) {
      const { state, trace } = execute("binary-search", {}, { Array: items, target });
      const found = items.includes(target);
      assert.equal(state.variables.found, found ? 1 : 0);
      assert.equal(state.currentLine, found ? 15 : 17);
      assert.deepEqual(output(state), [found ? `${target}は配列の${state.variables.mid}番目の要素です` : `${target}は配列の中に存在しません`]);
      if (found) assert.equal(items[state.variables.mid], target);
      for (const actual of trace.filter((state) => state.currentLine === 6)) assert.ok(Number.isSafeInteger(actual.variables.mid) && actual.variables.mid >= 0 && actual.variables.mid < items.length);
    }
  }
});

test("二分探索は配列と target を別々の行で入力し、昇順でない入力を拒否する", () => {
  const example = exampleFor("binary-search");
  const compiled = compileProgram(example.program);
  let state = createState(compiled);
  assert.equal(inputRequest(compiled, state).name, "Array");
  assert.throws(() => step(compiled, state, {}, { input: [2, 1] }), /小さい順/);
  state = step(compiled, state, {}, { input: "-3, 0, 0, 5" });
  assert.deepEqual(state.variables, { Array: [-3, 0, 0, 5] });
  assert.equal(inputRequest(compiled, state).name, "target");
  state = step(compiled, state, {}, { input: "5" });
  assert.equal(state.steps, 2);
  assert.equal(state.variables.target, 5);
});

test("再帰は別々の n を持つ呼び出しを積み、基底条件のあと1行ずつ結果を返す", () => {
  const { state, trace } = execute("factorial");
  assert.deepEqual(trace.slice(0, 3).map((state) => state.currentLine), [1, 6, 2]);
  assert.equal(trace[0].variables.n, undefined);
  assert.equal(trace[1].variables.n, 5);
  assert.deepEqual(trace.filter((state) => state.event.kind === "call").map((state) => state.variables.n), [5, 4, 3, 2, 1, 0]);
  assert.deepEqual(trace.filter((state) => state.event.kind === "return").map((state) => state.event.returnValue), [1, 1, 2, 6, 24, 120]);
  assert.deepEqual(trace.filter((state) => state.event.kind === "return").map((state) => state.currentLine), [3, 5, 5, 5, 5, 5]);
  assert.equal(Math.max(...trace.map((state) => state.callStack.length)), 6);
  assert.ok(trace.slice(0, -1).every((state) => state.output.length === 0));
  assert.deepEqual(state.callStack, []);
  assert.equal(state.variables.n, undefined);
  assert.deepEqual(output(state), ["120"]);
  assert.equal(execute("factorial", { n: 0 }).state.output[0].text, "1");
  assert.equal(execute("factorial", { n: 10 }).state.output[0].text, "3628800");
});

test("関数の式VMは呼び出し前の左辺を保存し、複数の呼び出しを重複実行しない", () => {
  const program = [define(1, "double", ["n"], returnValue(2, op("*", r("n"), v(2)))), assign(3, "answer", op("+", call("double", v(3)), call("double", v(4)))), print(4, r("answer"))];
  const compiled = compileProgram(program);
  let state = createState(compiled);
  let calls = 0;
  let explanation = "";
  while (!state.completed) { state = step(compiled, state, {}); if (state.event.kind === "call") calls++; if (state.event.kind === "assign") explanation = state.event.explanation; }
  assert.equal(calls, 2);
  assert.deepEqual(output(state), ["14"]);
  assert.match(explanation, /6 \+ 8 = 14/);
});

test("関数の呼び出し深さ・未定義関数・不正な変数名を拒否する", () => {
  const compiled = compileProgram([define(1, "forever", ["n"], returnValue(2, call("forever", r("n")))), print(3, call("forever", v(1)))]);
  let state = createState(compiled);
  assert.throws(() => { while (!state.completed) state = step(compiled, state, {}); }, /呼び出しが深すぎ/);
  assert.equal(state.callStack.length, MAX_CALL_DEPTH);
  const missing = compileProgram([print(1, call("missing", v(1)))]);
  assert.throws(() => step(missing, createState(missing), {}), /まだ定義されて/);
  assert.throws(() => compileProgram([assign(1, "__proto__", v(1))]), /使えない変数名/);
});

test("1000回の乱数試行は0以上1未満の値を使い、条件が真のときだけ個数を増やす", () => {
  const { state, trace } = execute("monte-carlo");
  const points = trace.filter((state) => state.currentLine === 6);
  assert.equal(points.length, 1000);
  assert.ok(points.every((state) => state.variables.x >= 0 && state.variables.x < 1 && state.variables.y >= 0 && state.variables.y < 1));
  const inside = points.filter((state) => state.variables.x ** 2 + state.variables.y ** 2 <= 1).length;
  assert.equal(state.variables.kosu, inside);
  assert.equal(trace.filter((state) => state.currentLine === 7).length, inside);
  assert.equal(state.variables.i, 1001);
  assert.deepEqual(output(state), [`円周率の推定値は${4 * inside / 1000}`]);
  assert.ok(4 * inside / 1000 > 2.9 && 4 * inside / 1000 < 3.4);
  assert.equal(execute("monte-carlo", { kaisu: 1500 }).trace.filter((state) => state.currentLine === 6).length, 1500);
});

test("乱数は1行につき1回だけ生成し、解説の作成では追加生成しない", () => {
  const example = exampleFor("monte-carlo");
  const compiled = compileProgram(example.program);
  const parameters = { kaisu: 1 };
  let state = createState(compiled, { seed: 123 });
  for (let index = 0; index < 3; index++) state = step(compiled, state, parameters);
  assert.equal(state.randomState, 123);
  state = step(compiled, state, parameters);
  const expected = (Math.imul(123, 1664525) + 1013904223) >>> 0;
  assert.equal(state.randomState, expected);
  assert.equal(state.variables.x, expected / 4294967296);
  state = step(compiled, state, parameters);
  const second = state.randomState;
  state = step(compiled, state, parameters);
  assert.equal(state.randomState, second);
});

test("配列の入力は要素数・各値の範囲・昇順を検証し、空配列や欠落要素を拒否する", () => {
  for (const id of ["array-swap", "average", "maximum", "bubble-sort", "binary-search"]) {
    const example = exampleFor(id);
    const field = example.parameters.find((field) => field.type === "array");
    for (const raw of ["", [], "1,,2", "[1,2", [NaN], [1.2], Array(field.maxLength + 1).fill(0), "1;alert(1)"]) assert.ok(validateField(field, raw).error, `${id}: ${raw}`);
    assert.ok(validateField(field, Array(field.minLength).fill(field.min)).value);
    assert.ok(validateField(field, Array(field.maxLength).fill(field.max)).value);
  }
  assert.deepEqual(validateField(exampleFor("maximum").parameters[0], "[-3, 0, 5]").value, [-3, 0, 5]);
  assert.deepEqual(validateField(exampleFor("maximum").parameters[0], "-3 0 5").value, [-3, 0, 5]);
  assert.deepEqual(validateField(exampleFor("maximum").parameters[0], "-3、0、5").value, [-3, 0, 5]);
  assert.ok(validateParameters(exampleFor("array-swap"), { Data: [1, 2] }).errors.Data);
  assert.ok(validateParameters(exampleFor("binary-search"), { Array: [3, 1], target: 3 }).errors.Array);
  const defaults = defaultParameters(exampleFor("maximum"));
  defaults.Data.push(100);
  assert.equal(defaultParameters(exampleFor("maximum")).Data.length, 5);
});

test("設定値の空欄・小数・範囲外・コード文字列と、長すぎる繰り返しを拒否する", () => {
  for (const x of ["", " ", "3.5", "Infinity", "99999", "1; alert(1)", true]) assert.equal(validateParameters(exampleFor("addition"), { x, y: 4 }).valid, false);
  for (const step of [0, -1]) assert.equal(validateParameters(exampleFor("for-loop"), { sum: 0, start: 1, end: 5, step }).valid, false);
  assert.equal(validateParameters(exampleFor("for-loop"), { sum: 0, start: 0, end: 500, step: 1 }).valid, false);
  assert.equal(validateParameters(exampleFor("factorial"), { n: 11 }).valid, false);
  assert.equal(validateParameters(exampleFor("monte-carlo"), { kaisu: 1501 }).valid, false);
  assert.equal(validateParameters(exampleFor("monte-carlo"), { kaisu: 0 }).valid, false);
});

test("未代入・範囲外の要素・ゼロ除算・未対応演算・実行回数上限を拒否する", () => {
  assert.throws(() => evaluate(r("toString"), {}, {}), /まだ値が入って/);
  for (const operator of ["/", "÷", "%"]) assert.throws(() => evaluate(op(operator, v(2), v(0)), {}, {}), /0 で割る/);
  assert.throws(() => evaluate(op("&", v(2), v(2)), {}, {}), /未対応の演算/);
  for (const index of [-1, 1.5, 3]) assert.throws(() => evaluate(at("Data", v(index)), { Data: [1, 2, 3] }, {}), /範囲外|整数/);
  const program = compileProgram([assign(1, "Data", v([1])), assign(2, "Data", v(8), v(1))]);
  const first = step(program, createState(program), {});
  assert.throws(() => step(program, first, {}), /代入できません/);
  assert.throws(() => step(program, { ...first, steps: MAX_STEPS }, {}), /実行回数の上限/);
});

test("15例の全ステップで実行行・解説・変数変更・出力が同じ結果を示し、過去の状態を変更しない", () => {
  for (const example of EXAMPLES) {
    const { compiled, trace, parameters, state } = execute(example.id);
    let previous = createState(compiled);
    let outputCount = 0;
    for (const actual of trace) {
      assert.equal(actual.event.line, actual.currentLine);
      assert.equal(actual.steps, previous.steps + 1);
      for (const change of actual.changes) {
        assert.deepEqual(change.before, previous.variables[change.name]);
        assert.deepEqual(change.after, actual.variables[change.name]);
      }
      if (actual.event.kind === "print") {
        const last = actual.output.at(-1);
        assert.equal(actual.output.length, ++outputCount);
        assert.equal(last.line, actual.currentLine);
        assert.equal(last.step, actual.steps);
        assert.equal(actual.event.title, "表示する");
        assert.equal(actual.event.explanation, `「${last.text}」と表示する。`);
      } else assert.equal(actual.output.length, outputCount);
      previous = actual;
    }
    assert.equal(state.event.kind, "print");
    assert.equal(nextLine(compiled, state), null);
    assert.equal(step(compiled, state, parameters), state);
    assert.deepEqual(createState(compiled).variables, {});
    assert.deepEqual(createState(compiled).output, []);
    // 呼び出し途中・配列交換途中を含め、凍結した前状態にも書き込まない。
    const freeze = (value) => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
    for (const before of trace.slice(0, Math.min(trace.length - 1, 24))) {
      const snapshot = structuredClone(before);
      freeze(before);
      const request = inputRequest(compiled, before);
      step(compiled, before, parameters, request ? { input: parameters[request.field.key] } : {});
      assert.deepEqual(before, snapshot);
    }
  }
});

function fakeClock() {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  return {
    setTimer(callback, delay) { tasks.set(++id, { callback, due: now + delay }); return id; },
    clearTimer(timer) { tasks.delete(timer); },
    get pending() { return tasks.size; },
    tick(duration) {
      const end = now + duration;
      while (tasks.size) {
        const [id, task] = [...tasks].sort((a, b) => a[1].due - b[1].due)[0];
        if (task.due > end) break;
        now = task.due;
        tasks.delete(id);
        task.callback();
      }
      now = end;
    },
  };
}

function autoplayFixture(id = "for-loop") {
  const example = exampleFor(id);
  const compiled = compileProgram(example.program);
  const parameters = defaultParameters(example);
  const clock = fakeClock();
  let state = createState(compiled);
  const autoplay = createAutoplay({
    advance() {
      const request = inputRequest(compiled, state);
      state = step(compiled, state, parameters, request ? { input: parameters[request.field.key] } : {});
      if (state.completed) autoplay.stop();
      return !state.completed;
    }, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  return { clock, autoplay, get state() { return state; }, reset() { autoplay.stop(); state = createState(compiled); } };
}

test("自動実行は0.5秒が初期値で、開始時に1行進み、以後は設定した間隔を使う", () => {
  const fixture = autoplayFixture();
  const { clock, autoplay } = fixture;
  assert.equal(autoplay.interval, 500);
  assert.equal(autoplay.setInterval(300), true);
  assert.equal(fixture.state.steps, 0);
  autoplay.start();
  assert.equal(fixture.state.steps, 1);
  clock.tick(299);
  assert.equal(fixture.state.steps, 1);
  clock.tick(1);
  assert.equal(fixture.state.steps, 2);
});

test("実行中の速度変更は行を進めず、古いタイマーを取り消して新しい間隔を使う", () => {
  const fixture = autoplayFixture();
  const { clock, autoplay } = fixture;
  autoplay.start();
  clock.tick(150);
  const before = structuredClone(fixture.state);
  autoplay.setInterval(200);
  assert.deepEqual(fixture.state, before);
  assert.equal(clock.pending, 1);
  clock.tick(199);
  assert.equal(fixture.state.steps, 1);
  clock.tick(1);
  assert.equal(fixture.state.steps, 2);
  autoplay.setInterval(800);
  clock.tick(799);
  assert.equal(fixture.state.steps, 2);
  clock.tick(1);
  assert.equal(fixture.state.steps, 3);
});

test("速度の下限・刻み・上限を検証し、同じ速度の設定では待ち時間を変えない", () => {
  const fixture = autoplayFixture();
  const { clock, autoplay } = fixture;
  autoplay.start();
  for (const interval of [0, -100, 0.1, 150, 500.1, NaN, Infinity, "500", 2147483700]) {
    assert.equal(autoplay.setInterval(interval), false);
    assert.equal(autoplay.interval, 500);
    assert.equal(clock.pending, 1);
  }
  clock.tick(200);
  autoplay.setInterval(500);
  clock.tick(300);
  assert.equal(fixture.state.steps, 2);
  assert.equal(autoplay.setInterval(100), true);
  clock.tick(100);
  assert.equal(fixture.state.steps, 3);
});

test("0.1秒から0.01秒・0.001秒へ変更し、逆方向に戻せる", () => {
  const fixture = autoplayFixture();
  let interval = 100;
  interval = adjustInterval(interval, -1);
  assert.equal(interval, 10);
  assert.equal(intervalSeconds(interval), "0.01");
  assert.equal(fixture.autoplay.setInterval(interval), true);
  fixture.autoplay.start();
  fixture.clock.tick(9);
  assert.equal(fixture.state.steps, 1);
  fixture.clock.tick(1);
  assert.equal(fixture.state.steps, 2);
  interval = adjustInterval(interval, -1);
  assert.equal(interval, 1);
  assert.equal(intervalSeconds(interval), "0.001");
  assert.equal(fixture.autoplay.setInterval(interval), true);
  fixture.clock.tick(1);
  assert.equal(fixture.state.steps, 3);
  assert.equal(adjustInterval(1, -1), 1);
  assert.equal(adjustInterval(1, 1), 10);
  assert.equal(adjustInterval(10, 1), 100);
  assert.equal(adjustInterval(100, 1), 200);
});

test("最後の行の次の操作で選択を解除し、最終値・出力と過去の状態を保持する", () => {
  const completed = execute("swap").state;
  const before = structuredClone(completed);
  assert.equal(completed.currentLine, 7);
  const finished = finishTrace(completed);
  assert.equal(finished.completed, true);
  assert.equal(finished.currentLine, null);
  assert.equal(finished.event, null);
  assert.deepEqual(finished.changes, []);
  assert.deepEqual(finished.variables, completed.variables);
  assert.deepEqual(finished.output, completed.output);
  assert.deepEqual(completed, before);
  assert.strictEqual(finishTrace(finished), finished);
});

test("実行前に出力行数・入力可能な配列の長さ・再帰の呼び出し数を確保する", () => {
  const plan = (id, overrides = {}) => {
    const example = exampleFor(id);
    return planWorkspace(example, compileProgram(example.program), { ...defaultParameters(example), ...overrides });
  };
  assert.equal(plan("for-loop").outputs.length, 6);
  assert.equal(plan("while-loop").outputs.length, 7);
  assert.equal(plan("binary-search").variables.get("Array").value.length, 20);
  assert.equal(plan("bubble-sort").variables.get("Array").value.length, 12);
  assert.equal(plan("average", { Tokuten: [1, 2] }).variables.get("Tokuten").value.length, 2);
  assert.equal(plan("factorial", { n: 10 }).calls.length, 11);
});

test("停止・リセット・完了でも速度を保持し、重複タイマーを残さない", () => {
  for (const interval of [100, 300, 500, 1200]) {
    const fixture = autoplayFixture("addition");
    const { clock, autoplay } = fixture;
    autoplay.setInterval(interval);
    autoplay.start();
    autoplay.start();
    assert.equal(clock.pending, 1);
    autoplay.stop();
    clock.tick(5000);
    assert.equal(fixture.state.steps, 1);
    autoplay.start();
    clock.tick(interval * 2);
    assert.equal(fixture.state.completed, true);
    assert.equal(clock.pending, 0);
    assert.equal(autoplay.interval, interval);
    fixture.reset();
    assert.equal(fixture.state.currentLine, null);
    assert.deepEqual(fixture.state.output, []);
    assert.equal(autoplay.interval, interval);
    autoplay.start();
    assert.equal(fixture.state.currentLine, 1);
    assert.equal(clock.pending, 1);
  }
});

test("外部入力中はタイマーを止め、確定後の結果を1間隔保持して自動実行を再開する", () => {
  const example = exampleFor("binary-search");
  const compiled = compileProgram(example.program);
  const parameters = defaultParameters(example);
  const clock = fakeClock();
  let state = createState(compiled);
  let waiting = null;
  const autoplay = createAutoplay({ advance() {
    waiting = inputRequest(compiled, state);
    if (waiting) { autoplay.stop(); return false; }
    state = step(compiled, state, parameters);
    return !state.completed;
  }, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  autoplay.start();
  assert.equal(waiting.name, "Array");
  assert.equal(clock.pending, 0);
  clock.tick(5000);
  assert.equal(state.steps, 0);
  state = step(compiled, state, parameters, { input: [1, 2, 3] });
  autoplay.start({ immediate: false });
  assert.equal(state.steps, 1);
  clock.tick(499);
  assert.equal(state.steps, 1);
  clock.tick(1);
  assert.equal(waiting.name, "target");
  assert.equal(autoplay.running, false);
  assert.equal(clock.pending, 0);
  state = step(compiled, state, parameters, { input: 2 });
  autoplay.start({ immediate: false });
  clock.tick(500);
  assert.equal(state.currentLine, 3);
});

test("15例は手動でも自動でも同じ行順・呼び出し・乱数・配列・出力で完了する", () => {
  for (const example of EXAMPLES) {
    const fixture = autoplayFixture(example.id);
    const expected = execute(example.id);
    fixture.autoplay.setInterval(100);
    fixture.autoplay.start();
    for (const actual of expected.trace) {
      assert.deepEqual(fixture.state, actual);
      fixture.clock.tick(100);
    }
    assert.deepEqual(fixture.state, expected.state);
    assert.equal(fixture.clock.pending, 0);
  }
});
