import { literal, ref, param, op, at, random } from "./language.js?v=20261003-video";

const identifier = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const priorities = { or: 1, and: 2, "==": 3, "!=": 3, "<": 3, "<=": 3, ">": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "÷": 5, "%": 5, "**": 6 };

/** 登録した問題の式だけを構文解析する。JavaScript として実行しない。 */
export function parseExpression(source, { arrayCallNames = [] } = {}) {
  const membership = source.trim().match(/^(.+?)\s+に\s+(.+?)\s+が含まれている$/u);
  if (membership) return { type: "builtin", name: "含む", args: membership.slice(1).map((part) => parseExpression(part)) };
  const tokens = [];
  const pattern = /\s+|"(?:\\.|[^"\\])*"|\{[\p{L}\p{N}_]+\}|\d+(?:\.\d+)?|[\p{L}_][\p{L}\p{N}_]*|\*\*|==|!=|<=|>=|[+\-*/÷%<>()\[\],]/uy;
  let offset = 0;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match) throw new Error(`解釈できない式です: ${source.slice(offset)}`);
    offset = pattern.lastIndex;
    if (!/^\s+$/u.test(match[0])) tokens.push(match[0]);
  }
  let position = 0;
  const take = () => tokens[position++];
  const expect = (value) => { if (take() !== value) throw new Error(`式に ${value} が必要です: ${source}`); };
  function list(close) {
    const args = [];
    if (tokens[position] !== close) {
      do { args.push(expression(0)); if (tokens[position] !== ",") break; take(); } while (true);
    }
    expect(close);
    return args;
  }
  function primary() {
    const token = take();
    if (token === undefined) throw new Error(`式が途中で終わっています: ${source}`);
    if (token === "not") return { type: "unary", operator: "not", expression: expression(3) };
    if (token === "-") return { type: "unary", operator: "-", expression: expression(6) };
    if (token === "+") return expression(6);
    if (token === "(") { const value = expression(0); expect(")"); return value; }
    if (token === "[") return { type: "array", items: list("]") };
    if (token.startsWith('"')) {
      const value = JSON.parse(token);
      const parts = []; let cursor = 0;
      for (const match of value.matchAll(/\{([\p{L}\p{N}_]+)\}/gu)) {
        parts.push(value.slice(cursor, match.index), param(match[1])); cursor = match.index + match[0].length;
      }
      if (!parts.length) return literal(value);
      parts.push(value.slice(cursor));
      return { type: "text", parts };
    }
    if (token.startsWith("{")) return param(token.slice(1, -1));
    if (/^\d/.test(token)) return literal(Number(token));
    if (!identifier.test(token)) throw new Error(`式を確認してください: ${source}`);
    if (tokens[position] === "[") { take(); return at(token, ...list("]")); }
    if (tokens[position] !== "(") return ref(token);
    take();
    const args = list(")");
    if (token === "乱数") { if (args.length) throw new Error("乱数() に引数は指定しません。"); return random(); }
    if (token === "要素数") return { type: "length", expression: args[0] };
    if (arrayCallNames.includes(token)) return at(token, ...args);
    if (["整数", "べき乗", "結合", "配列結合", "ランダム整数", "ランダム日付"].includes(token)) {
      return { type: "builtin", name: token, args: token.startsWith("ランダム") ? [...args, random()] : args };
    }
    return { type: "call", name: token, args };
  }
  function expression(minimum) {
    let left = primary();
    while (priorities[tokens[position]] >= minimum) {
      const operator = take();
      const right = expression(priorities[operator] + (operator === "**" ? 0 : 1));
      left = op(operator, left, right);
    }
    return left;
  }
  const result = expression(0);
  if (position !== tokens.length) throw new Error(`式の末尾を確認してください: ${source}`);
  return result;
}

function splitArguments(text) {
  const parts = [];
  let start = 0, depth = 0, quoted = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) { if (escaped) escaped = false; else if (character === "\\") escaped = true; else if (character === '"') quoted = false; continue; }
    if (character === '"') quoted = true;
    else if (character === "(" || character === "[") depth++;
    else if (character === ")" || character === "]") depth--;
    else if (character === "," && depth === 0) { parts.push(text.slice(start, index).trim()); start = index + 1; }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}

/** 行の字下げを命令の入れ子に変換し、表示行との対応を保つ。 */
export function parseProgram(source, options = {}) {
  const lines = source.map((text, index) => {
    const prefix = text.match(/^[\s｜⎿]*/u)[0];
    return { line: index + 1, depth: (prefix.match(/[｜⎿]/g) ?? []).length, text: text.slice(prefix.length).trim().replace(/\s*#.*$/, "") };
  });
  const expr = (text) => parseExpression(text.trim(), options);
  let position = 0;
  function block(depth) {
    const nodes = [];
    while (position < lines.length && lines[position].depth >= depth) {
      const current = lines[position];
      if (current.depth !== depth) throw new Error(`${current.line} 行の字下げを確認してください。`);
      if (/^そうで/.test(current.text)) break;
      position++;
      nodes.push(statement(current));
    }
    return nodes;
  }
  function conditional(current, condition) {
    const node = { type: "if", line: current.line, condition: expr(condition), body: block(current.depth + 1), otherwise: null };
    const next = lines[position];
    if (next?.depth === current.depth && /^そうで/.test(next.text)) {
      position++;
      const match = next.text.match(/^そうでなくもし\s*(.+?)\s*ならば[：:]?$/u);
      node.otherwise = match ? conditional(next, match[1]) : { type: "else", line: next.line, body: block(next.depth + 1) };
    }
    return node;
  }
  function statement(current) {
    const { text, line, depth } = current;
    let match;
    if ((match = text.match(/^もし\s*(.+?)\s*ならば[：:]?$/u))) return conditional(current, match[1]);
    if ((match = text.match(/^(.+?)\s*の間繰り返す[：:]?$/u))) return { type: "while", line, condition: expr(match[1]), body: block(depth + 1) };
    if ((match = text.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*を\s*(.+?)\s*から\s*(.+?)\s*まで\s*(.+?)\s*ずつ(増やし|減らし)ながら繰り返す[：:]?$/u))) {
      return { type: "for", line, name: match[1], start: expr(match[2]), end: expr(match[3]), step: expr(match[5] === "減らし" ? `-(${match[4]})` : match[4]), body: block(depth + 1) };
    }
    if ((match = text.match(/^定義する\s+([^\s(]+)\((.*?)\)$/u))) return { type: "define", line, name: match[1], parameters: splitArguments(match[2]), body: block(depth + 1) };
    if ((match = text.match(/^返す\s+(.+)$/u))) return { type: "return", line, expression: expr(match[1]) };
    if ((match = text.match(/^表示する\((.*)\)$/u))) return { type: "print", line, args: splitArguments(match[1]).map(expr) };
    if ((match = text.match(/^(?:要素追加|追加する)\((.*)\)$/u))) { const [name, value] = splitArguments(match[1]); return { type: "append", line, name, expression: expr(value) }; }
    if ((match = text.match(/^逆順\(([^)]+)\)$/u))) return { type: "reverse", line, name: match[1].trim() };
    if ((match = text.match(/^プロットする\((.*)\)$/u))) { const [x, y] = splitArguments(match[1]).map(expr); return { type: "plot", line, x, y }; }
    if ((match = text.match(/^([^=]+)=\s*【外部からの入力】$/u))) {
      const name = match[1].trim();
      const field = options.inputs?.find((item) => item.key === name);
      if (!field) throw new Error(`${name} の入力条件が未設定です。`);
      return { type: "input", line, name, field };
    }
    const assignments = splitArguments(text).map((part) => {
      const assignment = part.match(/^([^=]+)=([^=].*)$/u);
      if (!assignment) throw new Error(`${line} 行は未対応の命令です: ${text}`);
      const target = expr(assignment[1]);
      if (!["variable", "index"].includes(target.type)) throw new Error("代入先は変数か配列の要素にしてください。");
      return { name: target.name, indices: target.indices ?? [], expression: expr(assignment[2]) };
    });
    return { type: "assign", line, assignments };
  }
  const result = block(0);
  if (position !== lines.length) throw new Error("プログラムの分岐・字下げを確認してください。");
  return result;
}
