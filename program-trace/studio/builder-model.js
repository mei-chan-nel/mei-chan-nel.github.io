import { parseProgram } from './parser.js';
import { expressionText, parseExpression } from './expressions.js';
import { LIMITS, StudioError, validName } from './errors.js';
import { getBuiltin } from './builtins.js';
import { validateValue } from './values.js';
export const rowId = () => `row-${crypto.randomUUID()}`;
export const blankRow = () => ({ kind: 'blank', id: rowId(), comment: '' });
export const branchMarkers = (depth, nextDepth, nextBranch = false) => Array.from({ length: depth }, (_, k) => nextDepth < k + 1 && !(nextBranch && nextDepth === k) ? '⎿' : '｜').join(' ');
const executable = (node) => node.kind !== 'comment' && node.kind !== 'blank';
export const literal = (value) => ({ kind: 'literal', value, column: 1 });
export const variable = (name = 'x') => ({ kind: 'variable', name, column: 1 });
export const comparison = () => ({ kind: 'binary', operator: '<', left: variable(), right: literal(10), column: 1 });
export const commandOptions = [
    ['assign', '値を設定する'], ['calculate', '計算する'], ['array', '配列を作る'], ['element', '配列の要素を変更する'],
    ['print', '表示する'], ['input', '外部から入力する'], ['if', '条件で分ける'], ['for', '範囲を決めて繰り返す'],
    ['while', '条件を満たす間繰り返す'], ['comment', 'メモを書く'],
];
export function commandOf(node) {
    if (node.kind !== 'assign')
        return node.kind === 'else' ? 'if' : node.kind === 'blank' ? 'assign' : node.kind;
    const assignment = node.assignments[0];
    return assignment.target.indices.length ? 'element' : assignment.expression.kind === 'array' ? 'array' : assignment.expression.kind === 'binary' && !['==', '!=', '<', '<=', '>', '>=', 'and', 'or'].includes(assignment.expression.operator) ? 'calculate' : 'assign';
}
export function newCommand(command, indexBase = 0) {
    const base = { id: rowId(), comment: '' };
    const assignment = (expression, target = { name: 'x', indices: [] }) => ({ ...base, kind: 'assign', assignments: [{ target, expression }] });
    switch (command) {
        case 'assign': return assignment(literal(0));
        case 'calculate': return assignment({ kind: 'binary', operator: '+', left: variable('x'), right: variable('y'), column: 1 }, { name: 'goukei', indices: [] });
        case 'array': return assignment({ kind: 'array', items: [literal(3), literal(5), literal(9)], column: 1 }, { name: 'Data', indices: [] });
        case 'element': return assignment(literal(0), { name: 'Data', indices: [literal(indexBase)] });
        case 'print': return { ...base, kind: 'print', args: [literal('表示する内容')] };
        case 'input': return { ...base, kind: 'input', name: 'x' };
        case 'if': return { ...base, kind: 'if', condition: comparison(), body: [] };
        case 'for': return { ...base, kind: 'for', name: 'i', start: literal(1), end: literal(5), step: literal(1), direction: 1, body: [] };
        case 'while': return { ...base, kind: 'while', condition: { kind: 'binary', operator: '<', left: variable('i'), right: literal(5), column: 1 }, body: [] };
        case 'comment': return { ...base, kind: 'comment', text: '' };
    }
}
export function statement(node, elseif = false) {
    switch (node.kind) {
        case 'assign': return node.assignments.map(a => `${a.target.name}${a.target.indices.length ? `[${a.target.indices.map(expressionText).join(', ')}]` : ''} = ${expressionText(a.expression)}`).join(', ');
        case 'print': return `表示する(${node.args.map(expressionText).join(', ')})`;
        case 'input': return `${node.name} = 【外部からの入力】`;
        case 'if': return `${elseif ? 'そうでなくもし' : 'もし'} ${expressionText(node.condition)} ならば：`;
        case 'else': return 'そうでなければ：';
        case 'for': return `${node.name} を ${expressionText(node.start)} から ${expressionText(node.end)} まで ${expressionText(node.step)} ずつ${node.direction === 1 ? '増やしながら' : '減らしながら'}繰り返す：`;
        case 'while': return `${expressionText(node.condition)} の間繰り返す：`;
        case 'comment': return `# ${node.text}`;
        case 'blank': return '';
    }
}
export function builderLines(document) {
    const result = [];
    function collect(node, depth, elseif = false) {
        result.push({ id: node.id, depth, line: result.length + 1, markers: '', text: statement(node, elseif) + (node.comment ? ` # ${node.comment}` : ''), elseif });
        if ('body' in node)
            node.body.forEach(child => collect(child, depth + 1));
        if (node.kind === 'if' && node.otherwise)
            collect(node.otherwise, depth, node.otherwise.kind === 'if');
    }
    document.nodes.forEach(node => collect(node, 0));
    result.forEach((row, index) => { const next = result[index + 1]; row.markers = branchMarkers(row.depth, next?.depth ?? -1, !!next && /^(?:そうでなくもし|そうでなければ)/u.test(next.text)); });
    return result;
}
export function builderSource(document) { return builderLines(document).map(row => `${row.markers ? row.markers + ' ' : ''}${row.text}`).join('\n'); }
export function assertReady(document) {
    if (!document.nodes.some(executable))
        throw new StudioError('空白の行をタップして、最初の処理を設定してください。');
    const byId = new Map(builderLines(document).map(row => [row.id, row.line]));
    function visit(node) {
        if ('body' in node) {
            if (!node.body.some(executable))
                throw new StudioError('このまとまりの内側の空白行をタップして、処理を設定してください。', byId.get(node.id));
            node.body.forEach(visit);
        }
        if (node.kind === 'if' && node.otherwise)
            visit(node.otherwise);
    }
    document.nodes.forEach(visit);
    parseProgram(builderSource(document));
}
export function modelFromSource(source) {
    if (source === '')
        return { version: 1, nodes: [] };
    if (!source.split('\n').some(row => !/^\s*(?:#.*)?$/u.test(row)))
        return { version: 1, nodes: source.split('\n').map(row => row.trim() ? { id: rowId(), kind: 'comment', text: row.trim().replace(/^#\s?/u, ''), comment: '' } : blankRow()) };
    const parsed = parseProgram(source);
    function convertBlock(nodes, depth, start, end) {
        const merged = nodes.map((node, i) => ({ line: node.line, node: convert(node, nodes[i + 1]?.line ?? end) }));
        for (const row of parsed.lines)
            if (!row.code && row.depth === depth && row.line >= start && row.line < end)
                merged.push({ line: row.line, node: row.comment ? { id: rowId(), kind: 'comment', text: row.comment.replace(/^#\s?/u, ''), comment: '' } : blankRow() });
        return merged.sort((a, b) => a.line - b.line).map(item => item.node);
    }
    function convert(node, end) {
        const { line, depth, ...rest } = node;
        const base = { ...rest, id: rowId(), comment: parsed.lines[line - 1].comment.replace(/^#\s?/u, '') };
        if ('body' in base && 'body' in node)
            base.body = convertBlock(node.body, depth + 1, line + 1, node.kind === 'if' ? node.otherwise?.line ?? end : end);
        if (base.kind === 'if' && node.kind === 'if') {
            if (node.otherwise)
                base.otherwise = convert(node.otherwise, end);
            else
                delete base.otherwise;
        }
        return base;
    }
    return { version: 1, nodes: convertBlock(parsed.nodes, 0, 1, parsed.lines.length + 1) };
}
export function cloneWithIds(node) {
    const clone = structuredClone(node);
    const walk = (item) => { item.id = rowId(); if ('body' in item)
        item.body.forEach(walk); if (item.kind === 'if' && item.otherwise)
        walk(item.otherwise); };
    walk(clone);
    return clone;
}
export function modelFromDraft(draft) { return draft.builder ? validateBuilder(draft.builder) : modelFromSource(draft.source); }
export function validateBuilder(value) {
    const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
    const fail = () => { throw new StudioError('行の編集データを読み取れません。元のファイルを確認してください。'); };
    let count = 0, expressionCount = 0;
    const ids = new Set();
    const text = (value, max = LIMITS.string) => typeof value === 'string' && value.length <= max && !/[\r\n]/u.test(value) ? value : fail();
    const name = (value) => typeof value === 'string' && validName(value) ? value : fail();
    const list = (value, max = LIMITS.arrayCells) => Array.isArray(value) && value.length <= max ? value : fail();
    function expression(value, depth = 0) {
        if (!object(value) || depth > LIMITS.depth || ++expressionCount > 20000)
            return fail();
        const column = 1;
        switch (value.kind) {
            case 'literal': {
                validateValue(value.value);
                if (Array.isArray(value.value))
                    return fail();
                return { kind: 'literal', value: value.value, column };
            }
            case 'variable': return { kind: 'variable', name: name(value.name), column };
            case 'array': return { kind: 'array', items: list(value.items).map(item => expression(item, depth + 1)), column };
            case 'index': {
                const indices = list(value.indices, 2);
                if (!indices.length)
                    return fail();
                return { kind: 'index', target: expression(value.target, depth + 1), indices: indices.map(item => expression(item, depth + 1)), column };
            }
            case 'unary':
                if (!['+', '-', 'not'].includes(String(value.operator)))
                    return fail();
                return { kind: 'unary', operator: String(value.operator), expression: expression(value.expression, depth + 1), column };
            case 'binary':
                if (!['+', '-', '*', '/', '÷', '%', '**', '==', '!=', '<', '<=', '>', '>=', 'and', 'or'].includes(String(value.operator)))
                    return fail();
                return { kind: 'binary', operator: String(value.operator), left: expression(value.left, depth + 1), right: expression(value.right, depth + 1), column };
            case 'call': {
                const args = list(value.args, 128).map(item => expression(item, depth + 1)), callName = name(value.name);
                if (getBuiltin(callName, args.length).effect !== 'value')
                    return fail();
                return { kind: 'call', name: callName, args, column };
            }
            default: return fail();
        }
    }
    function assignment(value) {
        if (!object(value) || !object(value.target))
            return fail();
        const target = { name: name(value.target.name), indices: list(value.target.indices, 2).map(item => expression(item)) };
        // Use the language's own target validation as well as the data shape.
        parseExpression(`${target.name}${target.indices.length ? `[${target.indices.map(expressionText).join(', ')}]` : ''}`, 1);
        return { target, expression: expression(value.expression) };
    }
    function node(value, depth = 0, branch = false) {
        if (!object(value) || depth > LIMITS.depth || ++count > LIMITS.lines)
            return fail();
        const id = text(value.id, 80);
        if (!/^[A-Za-z0-9_-]+$/u.test(id) || ids.has(id))
            return fail();
        ids.add(id);
        const base = { id, comment: text(value.comment) };
        const body = () => list(value.body, LIMITS.lines).map(item => node(item, depth + 1));
        switch (value.kind) {
            case 'assign': {
                const assignments = list(value.assignments, 128).map(assignment);
                if (!assignments.length)
                    return fail();
                return { ...base, kind: 'assign', assignments };
            }
            case 'print': return { ...base, kind: 'print', args: list(value.args, 128).map(item => expression(item)) };
            case 'input': return { ...base, kind: 'input', name: name(value.name) };
            case 'if': {
                const otherwise = value.otherwise === undefined ? undefined : node(value.otherwise, depth, true);
                if (otherwise && otherwise.kind !== 'if' && otherwise.kind !== 'else')
                    return fail();
                return { ...base, kind: 'if', condition: expression(value.condition), body: body(), ...(otherwise ? { otherwise } : {}) };
            }
            case 'else':
                if (!branch)
                    return fail();
                return { ...base, kind: 'else', body: body() };
            case 'for':
                if (value.direction !== 1 && value.direction !== -1)
                    return fail();
                return { ...base, kind: 'for', name: name(value.name), start: expression(value.start), end: expression(value.end), step: expression(value.step), direction: value.direction, body: body() };
            case 'while': return { ...base, kind: 'while', condition: expression(value.condition), body: body() };
            case 'comment': return { ...base, kind: 'comment', text: text(value.text) };
            case 'blank':
                if (base.comment)
                    return fail();
                return { ...base, kind: 'blank' };
            default: return fail();
        }
    }
    if (!object(value) || value.version !== 1)
        return fail();
    const document = { version: 1, nodes: list(value.nodes, LIMITS.lines).map(item => node(item)) };
    // Validate semantic syntax with a temporary empty display in unfinished blocks.
    const check = structuredClone(document);
    const fill = (node) => { if ('body' in node) {
        node.body.forEach(fill);
        if (!node.body.some(executable))
            node.body.push(newCommand('print'));
    } if (node.kind === 'if' && node.otherwise)
        fill(node.otherwise); };
    check.nodes.forEach(fill);
    if (check.nodes.some(executable))
        parseProgram(builderSource(check));
    return document;
}
