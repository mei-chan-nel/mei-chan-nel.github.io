import { expressionText, parseExpression } from './expressions.js';
import { StudioError } from './errors.js';
export const valueToken = (expr) => ({ text: expressionText(expr), expr: structuredClone(expr) });
export function expressionTokens(expr) {
    if (expr.kind === 'binary')
        return [{ text: '(' }, ...expressionTokens(expr.left), { text: expr.operator }, ...expressionTokens(expr.right), { text: ')' }];
    if (expr.kind === 'unary')
        return [{ text: expr.operator }, { text: '(' }, ...expressionTokens(expr.expression), { text: ')' }];
    return [valueToken(expr)];
}
export function tokensExpression(tokens) {
    if (!tokens.length)
        throw new StudioError('候補をタップして、値や式を組み立ててください。');
    return parseExpression(tokens.map(token => token.expr ? expressionText(token.expr) : token.text).join(' '), 1);
}
export function insertToken(tokens, token, cursor, selected) {
    const next = structuredClone(tokens), position = selected ?? cursor;
    next.splice(position, selected === null ? 0 : 1, structuredClone(token));
    return { tokens: next, cursor: position + 1 };
}
