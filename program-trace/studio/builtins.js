import { StudioError, validName, LIMITS } from './errors.js';
import { numeric, formatValue } from './values.js';
export const builtinRegistry = new Map();
export function registerBuiltin(definition) {
    if (!validName(definition.name) || builtinRegistry.has(definition.name))
        throw new StudioError('組み込み関数の登録が重複しています。');
    builtinRegistry.set(definition.name, Object.freeze(definition));
}
registerBuiltin({ name: '表示する', version: 1, effect: 'output', arities: 'any', description: '引数を順につなげて表示します。',
    invoke: (args, context) => {
        let text = '';
        for (const value of args) {
            const part = formatValue(value);
            if (text.length + part.length > LIMITS.outputCharacters)
                throw new StudioError('1回の表示内容が長すぎます。');
            text += part;
        }
        context.display(text);
        return undefined;
    } });
registerBuiltin({ name: '要素数', version: 1, effect: 'value', arities: [1], argumentKinds: ['collection'], scalarType: 'number', description: '一次元配列の要素数、二次元配列の行数を返します。',
    invoke: args => { if (!Array.isArray(args[0]))
        throw new StudioError('要素数()には配列を指定してください。'); return args[0].length; } });
registerBuiltin({ name: '乱数', version: 1, effect: 'value', arities: [0, 3], argumentKinds: ['scalar', 'scalar', 'scalar'], scalarType: 'number', description: '整数または実数の乱数を指定した範囲で生成します。',
    invoke: (args, context) => {
        const min = args.length ? numeric(args[0]) : 0;
        const max = args.length ? numeric(args[1]) : 1;
        const kind = args.length ? args[2] : '実数';
        if (kind !== '整数' && kind !== '実数')
            throw new StudioError('乱数の種類は「整数」または「実数」にしてください。');
        if (kind === '整数' && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)))
            throw new StudioError('整数の乱数では範囲の両端を整数にしてください。');
        if (min > max || kind === '実数' && min === max)
            throw new StudioError('乱数の最小値と最大値を確認してください。');
        const span = max - min + (kind === '整数' ? 1 : 0);
        if (!Number.isFinite(span) || kind === '整数' && !Number.isSafeInteger(span))
            throw new StudioError('乱数の範囲が大きすぎます。');
        const result = kind === '整数' ? min + Math.floor(context.random() * span) : min + context.random() * span;
        // Rounding near an endpoint must not include the excluded real maximum.
        if (kind === '実数' && result >= max) {
            const view = new DataView(new ArrayBuffer(8));
            view.setFloat64(0, max);
            if (max === 0)
                return -Number.MIN_VALUE;
            const bits = view.getBigUint64(0);
            view.setBigUint64(0, max > 0 ? bits - 1n : bits + 1n);
            return numeric(Math.max(min, view.getFloat64(0)));
        }
        return numeric(result);
    } });
export function getBuiltin(name, count, line = 1, column = 1) {
    const definition = builtinRegistry.get(name);
    if (!definition)
        throw new StudioError(`「${name}()」は使えません。表示する()・要素数()・乱数()が使えます。`, line, column);
    if (definition.arities !== 'any' && !definition.arities.includes(count))
        throw new StudioError(`${name}()の引数の個数を確認してください。${definition.arities.join('または')}個で指定します。`, line, column);
    return definition;
}
