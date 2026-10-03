import { cloneValue, formatValue, validateField } from "./values.js?v=20261003-video";

/** 命令データを解釈する。JavaScript のコードとしては実行しない。 */
export const MAX_STEPS = 10000;
export const MAX_CALL_DEPTH = 32;
const CALL_STARTED = Symbol("call-started");
const nameIsValid = (name) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) && !["__proto__", "constructor", "prototype"].includes(name);
const sameValue = (a, b) => Object.is(a, b) || (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

export function compileProgram(program, { initialVariables = {}, maxSteps = MAX_STEPS } = {}) {
  const instructions = [];
  const variables = new Set();
  const lineKinds = {};
  const functions = {};
  function registerName(name) {
    if (!nameIsValid(name)) throw new Error(`使えない変数名です: ${name}`);
    variables.add(name);
  }
  function register(nodes) {
    for (const node of nodes) {
      if (!Number.isSafeInteger(node.line) || node.line < 1 || Object.hasOwn(lineKinds, node.line)) throw new Error("命令の行番号は正の整数で、重複しないようにしてください。");
      lineKinds[node.line] = node.type;
      if (node.type === "assign") node.assignments.forEach(({ name }) => registerName(name));
      if (["for", "input", "append", "reverse"].includes(node.type)) registerName(node.name);
      if (node.type === "define") {
        if (!nameIsValid(node.name) || Object.hasOwn(functions, node.name)) throw new Error("関数名を確認してください。");
        node.parameters.forEach(registerName);
        functions[node.name] = { parameters: [...node.parameters], entry: null };
      }
      if (node.body) register(node.body);
      if (node.otherwise) register([node.otherwise]);
    }
  }
  function bodyLines(nodes) {
    return nodes.flatMap((node) => [node.line, ...bodyLines(node.body ?? []), ...bodyLines(node.otherwise ? [node.otherwise] : [])]);
  }
  function block(nodes, next) {
    let entry = next;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!["assign", "input", "print", "if", "else", "for", "while", "define", "return", "append", "reverse", "plot"].includes(node.type)) throw new Error(`未対応の命令です: ${node.type}`);
      const pc = instructions.length;
      const instruction = { ...node, next: entry };
      instructions.push(instruction);
      if (node.body) {
        instruction.bodyEntry = block(node.body, node.type === "define" ? null : ["for", "while"].includes(node.type) ? pc : entry);
        instruction.bodyLines = bodyLines(node.body);
      }
      if (node.otherwise) instruction.falseEntry = block([node.otherwise], entry);
      if (node.type === "define") functions[node.name].entry = instruction.bodyEntry;
      entry = pc;
    }
    return entry;
  }
  Object.keys(initialVariables).forEach(registerName);
  register(program);
  return { instructions, entry: block(program, null), variableNames: [...variables], lineKinds, functions, initialVariables: cloneValueMap(initialVariables), maxSteps };
}

const cloneValueMap = (values) => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, cloneValue(value)]));

function newFrame(id, name, pc, variables = {}) {
  return { id, name, pc, variables, loopFrames: {}, loopCounts: {}, pending: null };
}

export function createState(compiled, { seed = 0xc0ffee } = {}) {
  return {
    pc: compiled.entry, frames: [newFrame(0, null, compiled.entry, cloneValueMap(compiled.initialVariables ?? {}))], variables: cloneValueMap(compiled.initialVariables ?? {}), inputCounts: {},
    output: [], steps: 0, currentLine: null, changes: [], reads: [], visitedLines: [], skippedLines: [],
    loopFrames: {}, loopCounts: {}, callStack: [], definedFunctions: [], nextFrameId: 1,
    randomState: seed >>> 0, event: null, completed: compiled.entry === null,
  };
}

export function nextLine(compiled, state) {
  return state.pc === null ? null : compiled.instructions[state.pc].line;
}

export function inputRequest(compiled, state) {
  if (state.completed) return null;
  const instruction = compiled.instructions[state.pc];
  return instruction.type === "input" ? { line: instruction.line, name: instruction.name, field: instruction.field } : null;
}

function numeric(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("計算できる数値が必要です。");
  return value;
}

function read(variables, name) {
  if (!Object.hasOwn(variables, name)) throw new Error(`${name} にはまだ値が入っていません。`);
  return variables[name];
}

function readIndex(variables, name, indices) {
  const value = read(variables, name);
  if (indices.some((index) => !Number.isSafeInteger(index))) throw new Error("要素番号は整数にしてください。");
  if (indices.length === 1 && Array.isArray(value) && indices[0] >= 0 && indices[0] < value.length) return value[indices[0]];
  if (indices.length === 2 && value?.kind === "matrix" && Object.hasOwn(value.cells, indices.join(","))) return value.cells[indices.join(",")];
  throw new Error(`${name}[${indices.join(", ")}] は配列の範囲外か、まだ値がありません。`);
}

function arrayLength(value) {
  if (!Array.isArray(value)) throw new Error("要素数() には配列を指定してください。");
  return value.length;
}

function binary(operator, left, right) {
  switch (operator) {
    case "+": return typeof left === "string" && typeof right === "string" ? left + right : numeric(numeric(left) + numeric(right));
    case "-": return numeric(numeric(left) - numeric(right));
    case "*": return numeric(numeric(left) * numeric(right));
    case "**": return numeric(numeric(left) ** numeric(right));
    case "/": case "÷": case "%": {
      if (numeric(right) === 0) throw new Error("0 で割ることはできません。");
      const result = operator === "%" ? numeric(left) % right : numeric(left) / right;
      return numeric(operator === "÷" ? Math.trunc(result) : result);
    }
    case "<": return numeric(left) < numeric(right);
    case "<=": return numeric(left) <= numeric(right);
    case ">": return numeric(left) > numeric(right);
    case ">=": return numeric(left) >= numeric(right);
    case "==": return left === right;
    case "!=": return left !== right;
    default: throw new Error(`未対応の演算です: ${operator}`);
  }
}

function builtin(name, args) {
  switch (name) {
    case "整数": return Math.floor(numeric(args[0]));
    case "べき乗": return numeric(numeric(args[0]) ** numeric(args[1]));
    case "結合": case "配列結合": {
      args.forEach(arrayLength);
      return args.flatMap(cloneValue);
    }
    case "含む": arrayLength(args[0]); return args[0].some((value) => sameValue(value, args[1]));
    case "ランダム整数": return Math.floor(numeric(args[2]) * (numeric(args[1]) - numeric(args[0]) + 1)) + args[0];
    case "ランダム日付": {
      const date = new Date(Date.UTC(2025, 0, 1 + Math.floor(numeric(args[0]) * 365)));
      return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
    }
    default: throw new Error(`未対応の組み込み関数です: ${name}`);
  }
}

/** 副作用のない式の検証・評価用。関数と乱数は step 内の式VMで処理する。 */
export function evaluate(expression, variables, parameters) {
  switch (expression.type) {
    case "literal": return cloneValue(expression.value);
    case "variable": return read(variables, expression.name);
    case "parameter": return read(parameters, expression.name);
    case "index": return readIndex(variables, expression.name, expression.indices.map((index) => evaluate(index, variables, parameters)));
    case "length": return arrayLength(evaluate(expression.expression, variables, parameters));
    case "text": return expression.parts.map((part) => typeof part === "string" ? part : formatValue(evaluate(part, variables, parameters))).join("");
    case "array": return expression.items.map((item) => evaluate(item, variables, parameters));
    case "builtin": return builtin(expression.name, expression.args.map((arg) => evaluate(arg, variables, parameters)));
    case "unary": return expression.operator === "not" ? !evaluate(expression.expression, variables, parameters) : -numeric(evaluate(expression.expression, variables, parameters));
    case "binary": {
      const left = evaluate(expression.left, variables, parameters);
      if (expression.operator === "and") return Boolean(left) && Boolean(evaluate(expression.right, variables, parameters));
      if (expression.operator === "or") return Boolean(left) || Boolean(evaluate(expression.right, variables, parameters));
      return binary(expression.operator, left, evaluate(expression.right, variables, parameters));
    }
    default: throw new Error(`この式はステップ実行が必要です: ${expression.type}`);
  }
}

const precedence = { "or": .1, "and": .2, "==": 1, "!=": 1, "<": 1, "<=": 1, ">": 1, ">=": 1, "+": 2, "-": 2, "*": 3, "/": 3, "÷": 3, "%": 3, "**": 4 };
function expressionText(expression, variables, parameters, resolved = false, calls = [], parent = 0) {
  switch (expression.type) {
    case "variable": {
      const value = resolved ? read(variables, expression.name) : null;
      return resolved ? Array.isArray(value) && value.length > 20 ? `${expression.name}（${value.length}要素）` : formatValue(value) : expression.name;
    }
    case "parameter": return formatValue(read(parameters, expression.name));
    case "literal": return formatValue(expression.value);
    case "random": return "乱数()";
    case "array": return `[${expression.items.map((item) => expressionText(item, variables, parameters, resolved, calls)).join(", ")}]`;
    case "unary": return `${expression.operator === "not" ? "not" : "-"}(${expressionText(expression.expression, variables, parameters, resolved, calls)})`;
    case "builtin": {
      if (expression.name === "含む") {
        const array = expressionText(expression.args[0], variables, parameters, false, calls);
        const length = resolved ? `（${arrayLength(evaluate(expression.args[0], variables, parameters))}要素）` : "";
        return `${array}${length} に ${expressionText(expression.args[1], variables, parameters, resolved, calls)} が含まれている`;
      }
      return `${expression.name}(${expression.args.map((arg) => expressionText(arg, variables, parameters, resolved, calls)).join(", ")})`;
    }
    case "index": return resolved ? formatValue(evaluate(expression, variables, parameters)) : `${expression.name}[${expression.indices.map((index) => expressionText(index, variables, parameters)).join(", ")}]`;
    case "length": return resolved ? String(evaluate(expression, variables, parameters)) : `要素数(${expressionText(expression.expression, variables, parameters)})`;
    case "call": {
      const args = expression.args.map((arg) => expressionText(arg, variables, parameters, resolved));
      let result = null;
      if (resolved) {
        try {
          const values = expression.args.map((arg) => evaluate(arg, variables, parameters));
          result = calls.find((entry) => entry.name === expression.name && sameValue(entry.args, values));
        } catch { /* 関数や乱数を含む引数は、表示のために再実行しない。 */ }
      }
      return result ? formatValue(result.value) : `${expression.name}(${args.join(", ")})`;
    }
    case "text": return expression.parts.map((part) => typeof part === "string" ? part : expressionText(part, variables, parameters, resolved, calls)).join("");
    case "binary": {
      const priority = precedence[expression.operator];
      if (resolved && ["and", "or"].includes(expression.operator)) {
        const left = evaluate(expression.left, variables, parameters);
        if (expression.operator === "and" && !left || expression.operator === "or" && left) return `${expressionText(expression.left, variables, parameters, true, calls)} ${expression.operator} （右側は評価しない）`;
      }
      const text = `${expressionText(expression.left, variables, parameters, resolved, calls, priority)} ${expression.operator} ${expressionText(expression.right, variables, parameters, resolved, calls, priority + (expression.operator === "**" ? 0 : 1))}`;
      return priority < parent ? `(${text})` : text;
    }
    default: throw new Error(`未対応の式です: ${expression.type}`);
  }
}

/** 式を小さなスタックマシンへ変換する。呼び出し時に中断し、戻り値で再開できる。 */
function expressionOps(expression) {
  switch (expression.type) {
    case "literal": case "variable": case "parameter": case "random": return [{ ...expression }];
    case "binary": {
      if (["and", "or"].includes(expression.operator)) {
        const right = [...expressionOps(expression.right), { type: "boolean" }];
        return [...expressionOps(expression.left), { type: "short-circuit", operator: expression.operator, skip: right.length }, ...right];
      }
      return [...expressionOps(expression.left), ...expressionOps(expression.right), { type: "binary", operator: expression.operator }];
    }
    case "unary": return [...expressionOps(expression.expression), { type: "unary", operator: expression.operator }];
    case "array": return [...expression.items.flatMap(expressionOps), { type: "array", count: expression.items.length }];
    case "builtin": return [...expression.args.flatMap(expressionOps), { type: "builtin", name: expression.name, count: expression.args.length }];
    case "index": return [...expression.indices.flatMap(expressionOps), { type: "index", name: expression.name, count: expression.indices.length }];
    case "length": return [...expressionOps(expression.expression), { type: "length" }];
    case "call": return [...expression.args.flatMap(expressionOps), { type: "call", name: expression.name, count: expression.args.length }];
    case "text": return [...expression.parts.flatMap((part) => expressionOps(typeof part === "string" ? { type: "literal", value: part } : part)), { type: "text", count: expression.parts.length }];
    default: throw new Error(`未対応の式です: ${expression.type}`);
  }
}

function runExpression(vm, variables, parameters, state) {
  while (vm.ip < vm.ops.length) {
    const operation = vm.ops[vm.ip++];
    switch (operation.type) {
      case "literal": vm.values.push(cloneValue(operation.value)); break;
      case "variable": vm.values.push(read(variables, operation.name)); break;
      case "parameter": vm.values.push(read(parameters, operation.name)); break;
      case "binary": { const right = vm.values.pop(); const left = vm.values.pop(); vm.values.push(binary(operation.operator, left, right)); break; }
      case "boolean": vm.values.push(Boolean(vm.values.pop())); break;
      case "short-circuit": {
        const left = Boolean(vm.values.pop());
        if (operation.operator === "and" && !left || operation.operator === "or" && left) { vm.values.push(left); vm.ip += operation.skip; }
        break;
      }
      case "unary": { const value = vm.values.pop(); vm.values.push(operation.operator === "not" ? !value : -numeric(value)); break; }
      case "array": vm.values.push(vm.values.splice(vm.values.length - operation.count, operation.count)); break;
      case "builtin": vm.values.push(builtin(operation.name, vm.values.splice(vm.values.length - operation.count, operation.count))); break;
      case "length": vm.values.push(arrayLength(vm.values.pop())); break;
      case "text": vm.values.push(vm.values.splice(vm.values.length - operation.count, operation.count).map(formatValue).join("")); break;
      case "index": {
        const indices = vm.values.splice(vm.values.length - operation.count, operation.count);
        vm.values.push(readIndex(variables, operation.name, indices));
        state.reads.push({ name: operation.name, indices });
        break;
      }
      case "random": {
        state.randomState = (Math.imul(state.randomState, 1664525) + 1013904223) >>> 0;
        vm.values.push(state.randomState / 4294967296);
        break;
      }
      case "call": return { call: operation.name, args: vm.values.splice(vm.values.length - operation.count, operation.count) };
    }
  }
  if (vm.values.length !== 1) throw new Error("式の命令データを確認してください。");
  return { value: vm.values[0] };
}

function finishState(state) {
  const active = state.frames.at(-1);
  state.pc = active.pc;
  state.variables = { ...state.frames[0].variables, ...(active.name ? active.variables : {}) };
  state.loopFrames = active.loopFrames;
  state.loopCounts = active.loopCounts;
  state.callStack = state.frames.slice(1).map((frame) => ({ id: frame.id, name: frame.name, variables: { ...frame.variables }, waiting: !!frame.pending }));
  state.completed = state.frames.length === 1 && active.pc === null;
  if (!state.completed && active.pc === null) throw new Error(`${active.name} が値を返さずに終了しました。`);
  return state;
}

/** 純粋な状態遷移。配列・式の途中状態・関数の各フレームも前の状態を変更しない。 */
export function step(compiled, previous, parameters, { input: rawInput } = {}) {
  if (previous.completed) return previous;
  if (previous.steps >= (compiled.maxSteps ?? MAX_STEPS)) throw new Error("実行回数の上限に達しました。値を変更するか、最初から実行してください。");
  const instruction = compiled.instructions[previous.pc];
  if (instruction.type === "input" && rawInput === undefined) throw new Error("外部からの入力を待っています。");
  const state = {
    ...previous,
    frames: previous.frames.map((frame) => ({ ...frame, variables: { ...frame.variables }, loopFrames: { ...frame.loopFrames }, loopCounts: { ...frame.loopCounts }, pending: frame.pending ? structuredClone(frame.pending) : null })),
    output: [...previous.output], definedFunctions: [...previous.definedFunctions], inputCounts: { ...previous.inputCounts },
    steps: previous.steps + 1, currentLine: instruction.line, changes: [], reads: [], skippedLines: [],
    visitedLines: [...new Set([...previous.visitedLines, instruction.line])],
  };
  const frame = state.frames.at(-1);
  const variables = () => ({ ...state.frames[0].variables, ...(frame.name ? frame.variables : {}) });
  const event = { kind: instruction.type, line: instruction.line, title: "", explanation: "", condition: null, assignments: [] };
  state.event = event;
  const pending = frame.pending ??= { values: {}, evaluation: null, calls: [], actionIndex: 0, explanations: [], assignments: [] };
  const symbolic = (expression, resolved = false) => expressionText(expression, variables(), parameters, resolved, pending.calls);

  function expression(expr, slot) {
    if (Object.hasOwn(pending.values, slot)) return pending.values[slot];
    pending.evaluation ??= { ops: expressionOps(expr), ip: 0, values: [] };
    const result = runExpression(pending.evaluation, variables(), parameters, state);
    if (result.call) {
      const definition = Object.hasOwn(compiled.functions, result.call) ? compiled.functions[result.call] : null;
      if (!definition || !state.definedFunctions.includes(result.call)) throw new Error(`関数 ${result.call} はまだ定義されていません。`);
      if (result.args.length !== definition.parameters.length) throw new Error("関数に渡す値の個数を確認してください。");
      if (state.frames.length > MAX_CALL_DEPTH) throw new Error("関数の呼び出しが深すぎます。値を変更して試してください。");
      const locals = Object.fromEntries(definition.parameters.map((name, index) => [name, cloneValue(result.args[index])]));
      for (const [name, after] of Object.entries(locals)) state.changes.push({ name, before: variables()[name], after, context: true });
      const name = `${result.call}(${result.args.map(formatValue).join(", ")})`;
      pending.waitingCall = { name: result.call, args: cloneValue(result.args) };
      state.frames.push(newFrame(state.nextFrameId++, result.call, definition.entry, locals));
      event.kind = "call";
      event.title = `${name} を呼び出す`;
      event.explanation = `${name} の処理へ進みます。呼び出しごとに変数を用意し、結果が返るまでこの行の計算を待ちます。`;
      throw CALL_STARTED;
    }
    pending.values[slot] = cloneValue(result.value);
    pending.evaluation = null;
    return result.value;
  }

  function write(name, after, indices = []) {
    const before = frame.variables[name];
    let next = cloneValue(after);
    let beforeElement;
    if (indices.length) {
      if (indices.some((index) => !Number.isSafeInteger(index))) throw new Error("要素番号は整数にしてください。");
      next = cloneValue(before);
      if (indices.length === 1 && Array.isArray(next) && indices[0] >= 0 && indices[0] < next.length) {
        beforeElement = next[indices[0]];
        next[indices[0]] = cloneValue(after);
      } else if (indices.length === 2 && (next === undefined || next?.kind === "matrix") && indices.every((index) => index >= 0 && index <= 20)) {
        next ??= { kind: "matrix", cells: {} };
        beforeElement = next.cells[indices.join(",")];
        next.cells[indices.join(",")] = cloneValue(after);
      } else throw new Error(`${name}[${indices.join(", ")}] に代入できません。要素番号を確認してください。`);
    }
    frame.variables[name] = next;
    if (!sameValue(before, next)) state.changes.push({ name, before, after: next, ...(indices.length ? { indices, beforeElement, afterElement: after } : {}) });
    return indices.length ? beforeElement : before;
  }

  try {
    switch (instruction.type) {
      case "assign": {
        for (let index = pending.actionIndex; index < instruction.assignments.length; index++) {
          const assignment = instruction.assignments[index];
          const after = expression(assignment.expression, `value-${index}`);
          const indices = (assignment.indices ?? []).map((expr, offset) => expression(expr, `index-${index}-${offset}`));
          const text = symbolic(assignment.expression);
          const resolved = symbolic(assignment.expression, true);
          const before = write(assignment.name, after, indices);
          const target = `${assignment.name}${indices.length ? `[${indices.join(", ")}]` : ""}`;
          pending.assignments.push({ name: assignment.name, target, indices, before, after, expression: text, calculation: resolved });
          pending.explanations.push(`${assignment.expression.type === "binary" ? `${text} = ${resolved} = ${formatValue(after)}。` : ""}${target} に ${formatValue(after)} を代入しました。${sameValue(before, after) ? "値は変わりません。" : ""}`);
          pending.actionIndex = index + 1;
        }
        event.assignments = pending.assignments;
        event.title = instruction.assignments.some((assignment) => assignment.indices?.length) ? "配列の要素に代入" : instruction.assignments.some((assignment) => Array.isArray(frame.variables[assignment.name])) ? "配列を用意する" : "変数に値を代入";
        event.explanation = pending.explanations.join(" ");
        break;
      }
      case "input": {
        const result = validateField(instruction.field, rawInput);
        if (result.error) throw new Error(result.error);
        const before = write(instruction.name, result.value);
        event.assignments.push({ name: instruction.name, before, after: result.value });
        event.title = "外部からの入力を受け取る";
        event.explanation = `入力した ${formatValue(result.value)} を ${instruction.name} に代入しました。`;
        state.inputCounts[instruction.name] = (state.inputCounts[instruction.name] ?? 0) + 1;
        break;
      }
      case "append": {
        const before = read(variables(), instruction.name);
        arrayLength(before);
        const value = expression(instruction.expression, 0);
        write(instruction.name, [...before, cloneValue(value)]);
        const change = state.changes.at(-1);
        if (change) Object.assign(change, { indices: [before.length], beforeElement: undefined, afterElement: value });
        event.title = "要素を追加する";
        event.explanation = `${instruction.name} の末尾 [${before.length}] に ${formatValue(value)} を追加しました。要素数は ${before.length + 1} 個です。`;
        break;
      }
      case "reverse": {
        const before = read(variables(), instruction.name);
        arrayLength(before);
        write(instruction.name, [...before].reverse());
        event.title = "配列を逆順にする";
        event.explanation = `${instruction.name} の要素の並び順を逆にしました。`;
        break;
      }
      case "plot": {
        const x = expression(instruction.x, 0);
        const y = expression(instruction.y, 1);
        if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) throw new Error("座標の配列は同じ要素数にしてください。");
        x.forEach(numeric); y.forEach(numeric);
        const text = `${x.length} 個の点をプロット`;
        state.output.push({ kind: "plot", text, x: cloneValue(x), y: cloneValue(y), line: instruction.line, step: state.steps });
        event.title = "プロットする";
        event.explanation = `X と Y の同じ添字を組にして、${x.length} 個の点を xy 平面にプロットします。`;
        break;
      }
      case "print": {
        const text = instruction.args.map((expr, index) => formatValue(expression(expr, index))).join("");
        state.output.push({ text, line: instruction.line, step: state.steps });
        event.title = "表示する";
        event.explanation = `「${text}」と表示する。`;
        break;
      }
      case "if": case "while": {
        const result = expression(instruction.condition, 0);
        if (typeof result !== "boolean") throw new Error("条件には比較式が必要です。");
        const text = symbolic(instruction.condition);
        const resolved = symbolic(instruction.condition, true);
        event.condition = { expression: text, resolved, result };
        frame.pc = result ? instruction.bodyEntry : instruction.falseEntry ?? instruction.next;
        if (!result) state.skippedLines = instruction.bodyLines;
        if (instruction.type === "while") {
          if (result) frame.loopCounts[instruction.line] = (frame.loopCounts[instruction.line] ?? 0) + 1;
          event.title = result ? "条件が成り立つ → 繰り返す" : "条件が成り立たない → 繰り返しを終了";
          event.explanation = `${text} は ${resolved} なので「${result ? "真" : "偽"}」です。${result ? `内側の処理を実行します（${frame.loopCounts[instruction.line]}回目）。` : "繰り返しの次の行へ進みます。"}`;
        } else {
          event.title = result ? "条件が成り立つ → 内側へ" : "条件が成り立たない → 次の枝へ";
          event.explanation = `${text} は ${resolved} なので「${result ? "真" : "偽"}」です。${result ? "内側の行を実行します。" : instruction.falseEntry !== undefined ? "内側の行をスキップして、次の枝に進みます。" : "内側の行をスキップして進みます。"}`;
        }
        break;
      }
      case "else":
        frame.pc = instruction.bodyEntry;
        event.title = "そうでなければの処理へ";
        event.explanation = "ここまでの条件が成り立たなかったので、この枝の内側の行を実行します。";
        break;
      case "for": {
        const loop = frame.loopFrames[frame.pc];
        const increment = loop?.increment ?? numeric(expression(instruction.step, "increment"));
        const end = loop?.end ?? numeric(expression(instruction.end, "end"));
        if (increment === 0) throw new Error("増やす値・減らす値は 0 以外にしてください。");
        const candidate = loop ? numeric(read(variables(), instruction.name)) + increment : numeric(expression(instruction.start, "start"));
        const before = write(instruction.name, candidate);
        const result = increment > 0 ? candidate <= end : candidate >= end;
        const comparison = increment > 0 ? "<=" : ">=";
        event.condition = { expression: `${instruction.name} ${comparison} ${formatValue(end)}`, resolved: `${formatValue(candidate)} ${comparison} ${formatValue(end)}`, result };
        if (result) {
          const iteration = (loop?.iteration ?? 0) + 1;
          frame.loopFrames[frame.pc] = { increment, end, iteration };
          frame.loopCounts[instruction.line] = iteration;
          frame.pc = instruction.bodyEntry;
        } else {
          delete frame.loopFrames[frame.pc];
          frame.pc = instruction.next;
          if (!loop) state.skippedLines = instruction.bodyLines;
        }
        event.title = result ? "範囲内 → 繰り返す" : "範囲を超えた → 繰り返しを終了";
        event.explanation = `${loop ? `${instruction.name} を ${formatValue(before)} から ${formatValue(candidate)} に${increment > 0 ? "増やし" : "減らし"}ました。` : `${instruction.name} に開始値 ${formatValue(candidate)} を入れました。`}${formatValue(candidate)} ${increment > 0 ? "≤" : "≥"} ${formatValue(end)} は「${result ? "真" : "偽"}」です。${result ? `内側の処理を実行します（${frame.loopCounts[instruction.line]}回目）。` : "繰り返しの次の行へ進みます。"}`;
        break;
      }
      case "define":
        if (!state.definedFunctions.includes(instruction.name)) state.definedFunctions.push(instruction.name);
        event.title = "関数を定義する";
        event.explanation = `${instruction.name}(${instruction.parameters.join(", ")}) の処理を定義しました。関数の内側は、呼び出されたときに実行します。`;
        break;
      case "return": {
        if (state.frames.length === 1) throw new Error("返す は関数の内側で使います。");
        const result = expression(instruction.expression, 0);
        event.title = `${formatValue(result)} を返す`;
        event.explanation = `${symbolic(instruction.expression)}${instruction.expression.type === "binary" ? ` = ${symbolic(instruction.expression, true)} = ${formatValue(result)}` : ""}。${frame.name} の結果 ${formatValue(result)} を呼び出し元へ返します。`;
        event.returnValue = result;
        state.frames.pop();
        const caller = state.frames.at(-1);
        caller.pending.evaluation.values.push(cloneValue(result));
        caller.pending.calls.push({ ...caller.pending.waitingCall, value: cloneValue(result) });
        delete caller.pending.waitingCall;
        for (const [name, before] of Object.entries(frame.variables)) {
          const after = caller.variables[name];
          if (!sameValue(before, after)) state.changes.push({ name, before, after, context: true });
        }
        return finishState(state);
      }
    }
    if (!["if", "else", "for", "while"].includes(instruction.type)) frame.pc = instruction.next;
    frame.pending = null;
  } catch (error) {
    if (error !== CALL_STARTED) throw error;
  }
  return finishState(state);
}
