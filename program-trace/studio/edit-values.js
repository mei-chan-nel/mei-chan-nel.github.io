import { parseProgram } from './parser.js?v=20261009-function-editor2';
import { valueExpression, expressionText } from './expressions.js?v=20261009-function-editor2';
import { StudioError } from './errors.js';
import { validateValue } from './values.js';
export function replaceInitialValues(source, values) {
    const parsed = parseProgram(source);
    const byLine = new Map();
    function collect(nodes) { for (const node of nodes) {
        byLine.set(node.line, node);
        if ('body' in node)
            collect(node.body);
        if (node.kind === 'if' && node.otherwise)
            collect([node.otherwise]);
    } }
    collect(parsed.nodes);
    const changed = new Set();
    for (const [key, value] of Object.entries(values)) {
        const field = parsed.editable.find(item => item.key === key);
        if (!field)
            throw new StudioError('変更できる初期値が見つかりません。');
        validateValue(value);
        const node = byLine.get(field.line);
        if (node.kind === 'assign' && field.assignment !== undefined)
            node.assignments[field.assignment].expression = valueExpression(value);
        else if (node.kind === 'for' && field.part) {
            if (typeof value !== 'number' || !Number.isSafeInteger(value) || field.part === 'step' && value <= 0)
                throw new StudioError('繰り返しの値は整数にし、増減する値は1以上にしてください。', field.line);
            node[field.part] = valueExpression(value);
        }
        changed.add(field.line);
    }
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    for (const line of changed) {
        const node = byLine.get(line);
        let code = '';
        if (node.kind === 'assign')
            code = node.assignments.map(a => `${a.target.name} = ${expressionText(a.expression)}`).join(', ');
        if (node.kind === 'for')
            code = `${node.name} を ${expressionText(node.start)} から ${expressionText(node.end)} まで ${expressionText(node.step)} ずつ${node.direction === 1 ? '増やしながら' : '減らしながら'}繰り返す：`;
        const comment = parsed.lines[line - 1].comment;
        lines[line - 1] = '  '.repeat(node.depth) + code + (comment ? ` ${comment}` : '');
    }
    const result = lines.join('\n');
    parseProgram(result);
    return result;
}
