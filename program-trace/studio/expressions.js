import { getBuiltin, builtinRegistry } from './builtins.js';
import { StudioError, LIMITS, validName } from './errors.js';
import { tokenize } from './lexer.js?v=20261009-function-editor2';
import { literalText, numeric, validateValue } from './values.js';
const precedence = { or: 1, and: 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '÷': 5, '%': 5, '**': 7 };
export class ExpressionParser {
    tokens;
    line;
    allowOutput;
    functions;
    position = 0;
    constructor(tokens, line, allowOutput = false, functions = new Map()) {
        this.tokens = tokens;
        this.line = line;
        this.allowOutput = allowOutput;
        this.functions = functions;
    }
    get token() { return this.tokens[this.position]; }
    at(text) { return this.token.text === text; }
    consume(text) {
        const token = this.token;
        if (text !== undefined && token.text !== text)
            this.fail(`「${text}」が必要です。`);
        this.position++;
        return token;
    }
    fail(message, token = this.token) { throw new StudioError(message, this.line, token.column); }
    expression(minimum = 0, depth = 0) {
        if (depth > LIMITS.depth)
            this.fail('式の入れ子が深すぎます。');
        const token = this.consume();
        let left;
        if (token.kind === 'number' || token.kind === 'string')
            left = { kind: 'literal', value: token.value, column: token.column };
        else if (['真', '偽', 'true', 'false'].includes(token.text))
            left = { kind: 'literal', value: token.text === '真' || token.text === 'true', column: token.column };
        else if (token.text === '-' || token.text === '+' || token.text === 'not')
            left = { kind: 'unary', operator: token.text, expression: this.expression(token.text === 'not' ? 3 : 6, depth + 1), column: token.column };
        else if (token.text === '(') {
            left = this.expression(0, depth + 1);
            this.consume(')');
        }
        else if (token.text === '[') {
            const items = [];
            if (this.token.text !== ']')
                do {
                    items.push(this.expression(0, depth + 1));
                    if (items.length > LIMITS.arrayCells)
                        this.fail('配列の要素が多すぎます。');
                    if (this.token.text !== ',')
                        break;
                    this.consume(',');
                    if (this.at(']'))
                        break;
                } while (true);
            this.consume(']');
            left = { kind: 'array', items, column: token.column };
        }
        else if (token.kind === 'name' && validName(token.text) && !['and', 'or', 'not'].includes(token.text)) {
            if (this.token.text === '(') {
                this.consume('(');
                const args = [];
                if (!this.at(')'))
                    do {
                        args.push(this.expression(0, depth + 1));
                        if (!this.at(','))
                            break;
                        this.consume(',');
                    } while (true);
                this.consume(')');
                const count = this.functions.get(token.text);
                const definition = count === undefined ? getBuiltin(token.text, args.length, this.line, token.column) : undefined;
                if (count !== undefined && count !== args.length)
                    this.fail(`${token.text}()の引数は${count}個で指定してください。`, token);
                if (definition?.effect === 'output' && !(this.allowOutput && depth === 0))
                    this.fail('表示する()は、値を代入する式の中では使えません。', token);
                left = { kind: 'call', name: token.text, args, column: token.column };
            }
            else
                left = { kind: 'variable', name: token.text, column: token.column };
        }
        else
            this.fail(token.kind === 'input' ? '【外部からの入力】は「x = 【外部からの入力】」の形で使います。' : '値・変数・式を指定してください。', token);
        while (this.token.text === '[') {
            this.consume('[');
            const indices = [this.expression(0, depth + 1)];
            if (this.at(',')) {
                this.consume(',');
                indices.push(this.expression(0, depth + 1));
            }
            this.consume(']');
            left = { kind: 'index', target: left, indices, column: left.column };
        }
        while (Object.hasOwn(precedence, this.token.text) && precedence[this.token.text] >= minimum) {
            const operator = this.consume().text;
            const right = this.expression(precedence[operator] + (operator === '**' ? 0 : 1), depth + 1);
            left = { kind: 'binary', operator, left, right, column: left.column };
        }
        return left;
    }
    complete() { if (this.token.kind !== 'eof')
        this.fail(`「${this.token.text}」の前後の式を確認してください。`); }
}
export function parseExpression(text, line, column = 1, functions = new Map()) {
    const parser = new ExpressionParser(tokenize(text, line, column), line, false, functions);
    const expr = parser.expression();
    parser.complete();
    return expr;
}
export function toTarget(expression, line) {
    let target = expression;
    let indices = [];
    while (target.kind === 'index') {
        indices = [...target.indices, ...indices];
        target = target.target;
    }
    if (target.kind !== 'variable' || !validName(target.name) || builtinRegistry.has(target.name) || ['and', 'or', 'not', '真', '偽', 'true', 'false'].includes(target.name))
        throw new StudioError('代入先には変数名または配列の要素を指定してください。', line, expression.column);
    if (indices.length > 2)
        throw new StudioError('配列の添字は二次元までです。', line, expression.column);
    return { name: target.name, indices };
}
export function expressionText(expr) {
    switch (expr.kind) {
        case 'literal': return literalText(expr.value);
        case 'variable': return expr.name;
        case 'array': return `[${expr.items.map(expressionText).join(', ')}]`;
        case 'index': return `${expressionText(expr.target)}[${expr.indices.map(expressionText).join(', ')}]`;
        case 'unary': return `${expr.operator === 'not' ? 'not ' : expr.operator}(${expressionText(expr.expression)})`;
        case 'binary': return `(${expressionText(expr.left)} ${expr.operator} ${expressionText(expr.right)})`;
        case 'call': return `${expr.name}(${expr.args.map(expressionText).join(', ')})`;
    }
}
export function constantValue(expr) {
    if (expr.kind === 'literal')
        return expr.value;
    if (expr.kind === 'unary' && ['-', '+'].includes(expr.operator)) {
        const value = constantValue(expr.expression);
        return typeof value === 'number' ? numeric(expr.operator === '-' ? -value : value) : undefined;
    }
    if (expr.kind === 'array') {
        const items = expr.items.map(constantValue);
        if (items.some(item => item === undefined))
            return undefined;
        const values = items;
        validateValue(values);
        return values;
    }
    return undefined;
}
export const valueExpression = (value) => Array.isArray(value)
    ? { kind: 'array', items: value.map(valueExpression), column: 1 } : { kind: 'literal', value, column: 1 };
