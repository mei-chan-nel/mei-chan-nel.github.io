import { StudioError, validName, LIMITS } from './errors.js';
import { numeric, formatValue } from './values.js';
import type { Value } from './types.js';
export interface BuiltinContext { random: () => number; display: (text: string) => void }
export interface Builtin {
  name: string; version: number; effect: 'value' | 'output'; arities: number[] | 'any';
  description: string; invoke: (args: Value[], context: BuiltinContext) => Value | undefined;
  returnKind?: 'scalar' | 'array' | 'matrix'; argumentKinds?: ('scalar' | 'collection' | 'any')[];
  scalarType?: 'number' | 'string' | 'boolean';
}
export const builtinRegistry = new Map<string, Builtin>();
export function registerBuiltin(definition: Builtin): void {
  if (!validName(definition.name) || builtinRegistry.has(definition.name)) throw new StudioError('組み込み関数の登録が重複しています。');
  builtinRegistry.set(definition.name, Object.freeze(definition));
}
registerBuiltin({ name: '表示する', version: 1, effect: 'output', arities: 'any', description: '引数を順につなげて表示します。',
  invoke: (args, context) => {
    let text = '';
    for (const value of args) {
      const part = formatValue(value);
      if (text.length + part.length > LIMITS.outputCharacters) throw new StudioError('1回の表示内容が長すぎます。');
      text += part;
    }
    context.display(text); return undefined;
  } });
registerBuiltin({ name: '要素数', version: 1, effect: 'value', arities: [1], argumentKinds: ['collection'], scalarType: 'number', description: '一次元配列の要素数、二次元配列の行数を返します。',
  invoke: args => { if (!Array.isArray(args[0])) throw new StudioError('要素数()には配列を指定してください。'); return args[0].length; } });
registerBuiltin({ name: '乱数', version: 1, effect: 'value', arities: [0, 3], argumentKinds: ['scalar', 'scalar', 'scalar'], scalarType: 'number', description: '整数または実数の乱数を指定した範囲で生成します。',
  invoke: (args, context) => {
    const min = args.length ? numeric(args[0]) : 0;
    const max = args.length ? numeric(args[1]) : 1;
    const kind = args.length ? args[2] : '実数';
    if (kind !== '整数' && kind !== '実数') throw new StudioError('乱数の種類は「整数」または「実数」にしてください。');
    if (kind === '整数' && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max))) throw new StudioError('整数の乱数では範囲の両端を整数にしてください。');
    if (min > max || kind === '実数' && min === max) throw new StudioError('乱数の最小値と最大値を確認してください。');
    const span = max - min + (kind === '整数' ? 1 : 0);
    if (!Number.isFinite(span) || kind === '整数' && !Number.isSafeInteger(span)) throw new StudioError('乱数の範囲が大きすぎます。');
    const result = kind === '整数' ? min + Math.floor(context.random() * span) : min + context.random() * span;
    // Rounding near an endpoint must not include the excluded real maximum.
    if (kind === '実数' && result >= max) {
      const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, max);
      if (max === 0) return -Number.MIN_VALUE;
      const bits = view.getBigUint64(0); view.setBigUint64(0, max > 0 ? bits - 1n : bits + 1n);
      return numeric(Math.max(min, view.getFloat64(0)));
    }
    return numeric(result);
  } });
// Pure collection/arithmetic helpers shared with the original trace examples.
// Return new arrays: calls never mutate another variable through an alias.
const array = (value: Value): Value[] => { if (!Array.isArray(value)) throw new StudioError('配列を指定してください。'); return value; };
registerBuiltin({ name: '整数', version: 1, effect: 'value', arities: [1], scalarType: 'number', description: '小数点以下を切り下げます。負の数も負の無限大方向へ丸めます。', invoke: args => numeric(Math.floor(numeric(args[0]))) });
registerBuiltin({ name: 'べき乗', version: 1, effect: 'value', arities: [2], scalarType: 'number', description: '第1引数を第2引数の指数で累乗します。', invoke: args => numeric(numeric(args[0]) ** numeric(args[1])) });
registerBuiltin({ name: '配列結合', version: 1, effect: 'value', arities: 'any', returnKind: 'array', description: '配列を順につないだ新しい配列を返します。', invoke: args => { if (!args.length) throw new StudioError('配列を1つ以上指定してください。'); const result = args.flatMap(array); if (result.length > LIMITS.arrayCells) throw new StudioError('配列が大きすぎます。'); return structuredClone(result); } });
registerBuiltin({ name: '逆順', version: 1, effect: 'value', arities: [1], returnKind: 'array', description: '配列の要素を逆順にした新しい配列を返します。', invoke: args => structuredClone(array(args[0])).reverse() });
registerBuiltin({ name: '含む', version: 1, effect: 'value', arities: [2], scalarType: 'boolean', description: '配列に第2引数と同じ値があれば真を返します。', invoke: args => array(args[0]).some(value => JSON.stringify(value) === JSON.stringify(args[1])) });
registerBuiltin({ name: 'ランダム整数', version: 1, effect: 'value', arities: [2], scalarType: 'number', description: '両端を含む範囲から整数の乱数を返します。', invoke: (args, context) => { const min = numeric(args[0]), max = numeric(args[1]), span = max - min + 1; if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || !Number.isSafeInteger(span)) throw new StudioError('乱数の整数の範囲を確認してください。'); return numeric(min + Math.floor(context.random() * span)); } });
registerBuiltin({ name: 'ランダム日付', version: 1, effect: 'value', arities: [0], scalarType: 'string', description: '閏年を除く365日から、月日を等確率で選びます。', invoke: (_, context) => { const date = new Date(Date.UTC(2025, 0, 1 + Math.floor(context.random() * 365))); return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`; } });
export function getBuiltin(name: string, count: number, line = 1, column = 1): Builtin {
  const definition = builtinRegistry.get(name);
  if (!definition) throw new StudioError(`「${name}()」は使えません。組み込み関数または定義した関数を指定してください。`, line, column);
  if (definition.arities !== 'any' && !definition.arities.includes(count)) throw new StudioError(`${name}()の引数の個数を確認してください。${definition.arities.join('または')}個で指定します。`, line, column);
  return definition;
}
