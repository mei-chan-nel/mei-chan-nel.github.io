import { LIMITS, StudioError } from './errors.js';
import type { Value, Variables } from './types.js';
export const cloneValue = (value: Value): Value => Array.isArray(value) ? value.map(cloneValue) : value;
export const isMatrix = (value: Value): value is Value[][] => Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
export function numeric(value: Value): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new StudioError('計算には数値を指定してください。');
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new StudioError('整数が正確に扱える範囲を超えました。');
  return value;
}
export function truth(value: Value): boolean {
  if (typeof value !== 'boolean') throw new StudioError('条件には「x < 10」などの比較式を指定してください。');
  return value;
}
export function formatValue(value: Value | undefined, max = Infinity): string {
  if (Array.isArray(value)) {
    let result = '[';
    for (let index = 0; index < value.length; index++) {
      if (index) result += ', ';
      if (result.length >= max - 2) return result.slice(0, Math.max(0, max - 2)) + '…]';
      result += formatValue(value[index], Number.isFinite(max) ? Math.max(1, max - result.length - 1) : Infinity);
    }
    return result + ']';
  }
  const result = value === undefined ? '—' : typeof value === 'boolean' ? value ? '真' : '偽'
    : typeof value === 'number' && !Number.isInteger(value) ? String(Number(value.toPrecision(10))) : String(value);
  return result.length > max ? result.slice(0, Math.max(0, max - 1)) + '…' : result;
}
export function literalText(value: Value): string {
  return Array.isArray(value) ? `[${value.map(literalText).join(', ')}]` : typeof value === 'string' ? JSON.stringify(value)
    : typeof value === 'boolean' ? value ? '真' : '偽' : String(value);
}
export function validateValue(value: unknown, depth = 0): asserts value is Value {
  if (Array.isArray(value)) {
    if (depth >= 2) throw new StudioError('配列は一次元・二次元まで使えます。');
    if (value.length > LIMITS.arrayCells) throw new StudioError(`配列は${LIMITS.arrayCells}要素以内にしてください。`);
    const matrix = value.some(Array.isArray);
    if (matrix && (!value.every(Array.isArray) || value.some(row => row.length !== value[0].length))) throw new StudioError('二次元配列は各行の列数をそろえてください。');
    if (matrix && value.length * value[0].length > LIMITS.arrayCells) throw new StudioError(`二次元配列は合計${LIMITS.arrayCells}セル以内にしてください。`);
    value.forEach(item => validateValue(item, depth + 1));
  } else if (typeof value === 'number') numeric(value);
  else if (typeof value === 'string') {
    if (value.length > LIMITS.string) throw new StudioError(`文字列は${LIMITS.string}文字以内にしてください。`);
  } else if (typeof value !== 'boolean') throw new StudioError('値には数値・文字列・配列を指定してください。');
}
export function validateVariables(variables: Variables): void {
  if (Object.keys(variables).length > LIMITS.variables) throw new StudioError(`変数は${LIMITS.variables}個以内にしてください。`);
  let cells = 0, strings = 0;
  function count(value: Value): void {
    if (Array.isArray(value)) { for (const item of value) { if (!Array.isArray(item)) cells++; count(item); } }
    else if (typeof value === 'string') strings += value.length;
  }
  for (const value of Object.values(variables)) { validateValue(value); count(value); }
  if (cells > LIMITS.totalCells) throw new StudioError(`すべての配列の合計が${LIMITS.totalCells}要素を超えました。`);
  if (strings > LIMITS.totalStrings) throw new StudioError('保存中の文字列の合計が大きすぎます。');
}
export function readVariable(variables: Variables, name: string): Value {
  if (!Object.hasOwn(variables, name)) throw new StudioError(`${name} にはまだ値が入っていません。`);
  return variables[name];
}
export function readIndices(value: Value, indices: number[], base: number, name: string): Value {
  let result = value;
  for (const index of indices) {
    if (!Number.isSafeInteger(index)) throw new StudioError('配列の添字は整数にしてください。');
    if (!Array.isArray(result)) throw new StudioError(`${name} の次元と添字の個数が合っていません。`);
    if (index < base || index - base >= result.length) throw new StudioError(`${name}[${indices.join(', ')}] は範囲外です。添字は${base}から${base + result.length - 1}までです。`);
    result = result[index - base];
  }
  return result;
}
export function binary(operator: string, left: Value, right: Value): Value {
  if (operator === '+' && typeof left === 'string' && typeof right === 'string') {
    if (left.length + right.length > LIMITS.string) throw new StudioError('連結後の文字列が長すぎます。');
    return left + right;
  }
  if (operator === '==' || operator === '!=') {
    if (Array.isArray(left) || Array.isArray(right)) throw new StudioError('配列を比較する場合は、要素を指定してください。');
    return operator === '==' ? left === right : left !== right;
  }
  const a = numeric(left), b = numeric(right);
  switch (operator) {
    case '+': return numeric(a + b); case '-': return numeric(a - b); case '*': return numeric(a * b);
    case '**': return numeric(a ** b);
    case '/': case '÷': case '%':
      if (b === 0) throw new StudioError('0で割ることはできません。');
      return numeric(operator === '%' ? a % b : operator === '÷' ? Math.trunc(a / b) : a / b);
    case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b;
    default: throw new StudioError(`「${operator}」は使えません。`);
  }
}
