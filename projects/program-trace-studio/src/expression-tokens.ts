import { expressionText, parseExpression } from './expressions.js';
import { StudioError } from './errors.js';
import type { Expr } from './types.js';
export interface ExpressionToken { text: string; expr?: Expr }
export const valueToken = (expr: Expr): ExpressionToken => ({ text: expressionText(expr), expr: structuredClone(expr) });
export function expressionTokens(expr: Expr): ExpressionToken[] {
  if (expr.kind === 'binary') return [{ text: '(' }, ...expressionTokens(expr.left), { text: expr.operator }, ...expressionTokens(expr.right), { text: ')' }];
  if (expr.kind === 'unary') return [{ text: expr.operator }, { text: '(' }, ...expressionTokens(expr.expression), { text: ')' }];
  return [valueToken(expr)];
}
export function tokensExpression(tokens: ExpressionToken[]): Expr {
  if (!tokens.length) throw new StudioError('候補をタップして、値や式を組み立ててください。');
  return parseExpression(tokens.map(token => token.expr ? expressionText(token.expr) : token.text).join(' '), 1);
}
export function insertToken(tokens: ExpressionToken[], token: ExpressionToken, cursor: number, selected: number | null): { tokens: ExpressionToken[]; cursor: number } {
  const next = structuredClone(tokens), position = selected ?? cursor;
  next.splice(position, selected === null ? 0 : 1, structuredClone(token));
  return { tokens: next, cursor: position + 1 };
}
