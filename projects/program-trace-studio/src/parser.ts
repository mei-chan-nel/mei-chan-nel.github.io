import { LIMITS, StudioError, validName } from './errors.js';
import { normalizeSymbols, splitComment, tokenize } from './lexer.js';
import { ExpressionParser, parseExpression, toTarget, constantValue } from './expressions.js';
import type { Parsed, SourceLine, Node, IfNode, ElseNode, Editable, Expr } from './types.js';
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
export function sourceLines(source: string): SourceLine[] {
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  if (raw.length > LIMITS.lines || new TextEncoder().encode(source).length > LIMITS.sourceBytes) throw new StudioError(`プログラムは${LIMITS.lines}行・50KB以内にしてください。`);
  const records = raw.map((original, index) => {
    const numbered = original.replace(/^(\s*)[（(][0-9０-９]+[）)]\s*/u, '$1');
    const white = numbered.match(/^[ \t　]*/u)![0];
    const columns = [...white].reduce((sum, c) => sum + (c === '\t' || c === '　' ? 2 : 1), 0);
    let remaining = numbered.slice(white.length), markers = 0;
    while (/^[｜⎿]/u.test(remaining)) { markers++; remaining = remaining.slice(1).replace(/^[ \t　]*/u, ''); }
    const split = splitComment(remaining);
    return { line: index + 1, original, columns, markers, code: normalizeSymbols(split.code).trim(), comment: split.comment, column: original.length - remaining.length + 1 };
  });
  const widths = records.filter(record => record.code && !record.markers && record.columns).map(record => record.columns);
  const unit = widths.reduce(gcd, 0) || 2;
  return records.map(record => {
    if (record.markers && record.columns && record.columns / unit !== record.markers) throw new StudioError('空白と｜・⎿の字下げが一致していません。どちらかにそろえてください。', record.line);
    return { line: record.line, original: record.original, depth: record.markers || record.columns / unit, code: record.code, comment: record.comment, column: record.column };
  });
}
export function parseProgram(source: string): Parsed {
  const lines = sourceLines(source);
  const executable = lines.filter(line => line.code);
  let cursor = 0;
  const names = new Set<string>(), inputs = new Set<string>();
  const register = (name: string, line: number): void => {
    if (!validName(name)) throw new StudioError('変数名を確認してください。', line);
    names.add(name); if (names.size > LIMITS.variables) throw new StudioError(`変数は${LIMITS.variables}個以内にしてください。`, line);
  };
  const expr = (text: string, row: SourceLine): Expr => parseExpression(text, row.line, row.column + Math.max(0, row.code.indexOf(text)));
  const takeBody = (row: SourceLine): Node[] => {
    if (!executable[cursor] || executable[cursor].depth !== row.depth + 1) throw new StudioError('内側の処理を1段字下げして、次の行に書いてください。', row.line);
    return block(row.depth + 1);
  };
  const conditionNode = (row: SourceLine, condition: string): IfNode => {
    const node: IfNode = { kind: 'if', line: row.line, depth: row.depth, condition: expr(condition, row), body: [] };
    cursor++; node.body = takeBody(row);
    const next = executable[cursor];
    if (next?.depth === row.depth) {
      const elseif = next.code.match(/^そうでなくもし\s*(.+?)\s*ならば\s*:?[ \t]*$/u);
      if (elseif) node.otherwise = conditionNode(next, elseif[1]);
      else if (/^そうでなければ\s*:?[ \t]*$/u.test(next.code)) {
        cursor++; const otherwise: ElseNode = { kind: 'else', line: next.line, depth: next.depth, body: takeBody(next) }; node.otherwise = otherwise;
      }
    }
    return node;
  };
  function block(depth: number): Node[] {
    if (depth > LIMITS.depth) throw new StudioError('分岐・繰り返しの入れ子が深すぎます。', executable[cursor]?.line ?? 1);
    const nodes: Node[] = [];
    while (cursor < executable.length) {
      const row = executable[cursor];
      if (row.depth < depth) break;
      if (row.depth > depth) throw new StudioError('この行の字下げが深すぎます。直前の分岐・繰り返しを確認してください。', row.line);
      if (/^(?:定義する|返す)(?:\s|$)/u.test(row.code)) throw new StudioError('独自の関数と「返す」は、このページでは使いません。', row.line);
      const condition = row.code.match(/^もし\s*(.+?)\s*ならば\s*:?[ \t]*$/u);
      if (condition) { nodes.push(conditionNode(row, condition[1])); continue; }
      if (/^そうで(?:なくもし|なければ)/u.test(row.code)) throw new StudioError('対応する「もし」がありません。字下げと行の順を確認してください。', row.line);
      const repeat = row.code.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*を\s*(.+?)\s*から\s*(.+?)\s*まで\s*(.+?)\s*ずつ(増やしながら|減らしながら)繰り返す\s*:?[ \t]*$/u);
      if (repeat) {
        register(repeat[1], row.line); cursor++;
        nodes.push({ kind: 'for', line: row.line, depth, name: repeat[1], start: expr(repeat[2], row), end: expr(repeat[3], row), step: expr(repeat[4], row), direction: repeat[5] === '増やしながら' ? 1 : -1, body: takeBody(row) }); continue;
      }
      const whileMatch = row.code.match(/^(.+?)\s*の間繰り返す\s*:?[ \t]*$/u);
      if (whileMatch) { cursor++; nodes.push({ kind: 'while', line: row.line, depth, condition: expr(whileMatch[1], row), body: takeBody(row) }); continue; }
      const parser = new ExpressionParser(tokenize(row.code, row.line, row.column), row.line, /^表示する\s*\(/u.test(row.code));
      const first = parser.expression();
      if (first.kind === 'call' && first.name === '表示する') { parser.complete(); nodes.push({ kind: 'print', line: row.line, depth, args: first.args }); cursor++; continue; }
      const assignments = [];
      let targetExpression = first;
      do {
        const target = toTarget(targetExpression, row.line); register(target.name, row.line); parser.consume('=');
        if (parser.token.kind === 'input') {
          if (assignments.length || target.indices.length) parser.fail('外部入力は1行に1つ、変数への代入として書いてください。');
          parser.consume(); parser.complete(); inputs.add(target.name);
          nodes.push({ kind: 'input', line: row.line, depth, name: target.name }); break;
        }
        assignments.push({ target, expression: parser.expression() });
        if (parser.token.text !== ',') { parser.complete(); nodes.push({ kind: 'assign', line: row.line, depth, assignments }); break; }
        parser.consume(','); targetExpression = parser.expression();
      } while (true);
      cursor++;
    }
    return nodes;
  }
  if (!executable.length) throw new StudioError('プログラムを書いてから実行してください。');
  const nodes = block(0);
  // Include referenced names so the learner can see them before first assignment.
  function scanExpr(expression: Expr, depth = 0): void {
    if (depth > LIMITS.depth) throw new StudioError('式の入れ子が深すぎます。', 1, expression.column);
    const scan = (child: Expr): void => scanExpr(child, depth + 1);
    if (expression.kind === 'variable') register(expression.name, 1);
    else if (expression.kind === 'array') expression.items.forEach(scan);
    else if (expression.kind === 'index') { scan(expression.target); expression.indices.forEach(scan); }
    else if (expression.kind === 'unary') scan(expression.expression);
    else if (expression.kind === 'binary') { scan(expression.left); scan(expression.right); }
    else if (expression.kind === 'call') expression.args.forEach(scan);
  }
  function scanNodes(items: Node[]): void {
    for (const node of items) {
      if (node.kind === 'assign') node.assignments.forEach(a => { a.target.indices.forEach(expr => scanExpr(expr)); scanExpr(a.expression); });
      if (node.kind === 'print') node.args.forEach(expr => scanExpr(expr));
      if (node.kind === 'if' || node.kind === 'while') scanExpr(node.condition);
      if (node.kind === 'for') { scanExpr(node.start); scanExpr(node.end); scanExpr(node.step); }
      if ('body' in node) scanNodes(node.body);
      if (node.kind === 'if' && node.otherwise) scanNodes([node.otherwise]);
    }
  }
  scanNodes(nodes);
  const editable: Editable[] = [];
  const constantAt = (expression: Expr, line: number) => {
    try { return constantValue(expression); }
    catch (error) { if (error instanceof StudioError) error.line = line; throw error; }
  };
  for (const node of nodes) {
    if (node.kind !== 'assign' || node.assignments.some(a => a.target.indices.length || constantAt(a.expression, node.line) === undefined)) break;
    node.assignments.forEach((a, index) => editable.push({ key: `${node.line}:assignment:${index}`, line: node.line, assignment: index, label: `${a.target.name} の初期値`, value: constantAt(a.expression, node.line)! }));
  }
  function loopFields(items: Node[]): void {
    for (const node of items) {
      if (node.kind === 'for') for (const part of ['start', 'end', 'step'] as const) {
        const value = constantValue(node[part]);
        if (typeof value === 'number') editable.push({ key: `${node.line}:for:${part}`, line: node.line, part, label: `${node.name} の${{ start: '開始値', end: '終了値', step: '増減する値' }[part]}（${node.line}行）`, value });
      }
      if ('body' in node) loopFields(node.body);
      if (node.kind === 'if' && node.otherwise) loopFields([node.otherwise]);
    }
  }
  loopFields(nodes);
  return { nodes, lines, variableNames: [...names], inputNames: [...inputs], editable };
}
