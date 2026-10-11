import { normalizeSymbols, tokenize } from './lexer.js?v=20261009-function-help3';
import { constantValue, parseExpression } from './expressions.js?v=20261009-function-help3';
import { getBuiltin, builtinRegistry } from './builtins.js';
import { StudioError, LIMITS } from './errors.js';
import { binary, numeric, truth } from './values.js';
// Only formatting is repaired. Unclosed delimiters and missing operands stay errors.
export function normalizeExpressionInput(text, condition = false) {
    const normalized = normalizeSymbols(text).trim();
    if (!condition)
        return normalized;
    const tokens = tokenize(normalized);
    let result = '', end = 0;
    for (const token of tokens) {
        if (token.kind === 'eof')
            break;
        const start = token.column - 1;
        result += normalized.slice(end, start) + (token.text === '=' ? '==' : token.text);
        end = start + token.text.length;
    }
    return result + normalized.slice(end);
}
export function expressionKind(expr, context) {
    const scalar = (item) => {
        const kind = expressionKind(item, context);
        if (kind !== 'scalar' && kind !== 'unknown')
            throw new StudioError('配列全体はここに使えません。Data[0] のように要素を指定してください。');
    };
    switch (expr.kind) {
        case 'literal': return 'scalar';
        case 'variable': {
            const choice = context.catalog?.find(item => item.name === expr.name);
            if (!choice && !context.variables.includes(expr.name))
                throw new StudioError(`「${expr.name}」という変数はまだ作られていません。文字列は " " で囲んでください。`);
            if (context.parameters?.includes(expr.name) && choice?.kind === 'variable')
                return 'unknown';
            return choice?.kind === 'matrix' ? 'matrix' : choice?.kind === 'array' || context.arrays.includes(expr.name) ? 'array' : 'scalar';
        }
        case 'array': {
            if (expr.items.length > LIMITS.arrayCells)
                throw new StudioError('配列の要素が多すぎます。');
            const kinds = expr.items.map(item => expressionKind(item, context));
            if (kinds.includes('matrix'))
                throw new StudioError('配列は二次元までです。');
            if (kinds.some(kind => kind === 'array') && kinds.some(kind => kind === 'scalar'))
                throw new StudioError('二次元配列の各行を同じ形の配列にしてください。');
            if (kinds.includes('array')) {
                const lengths = expr.items.map(item => {
                    if (item.kind === 'array')
                        return item.items.length;
                    const value = item.kind === 'variable' ? context.catalog?.find(choice => choice.name === item.name)?.value : undefined;
                    return Array.isArray(value) ? value.length : undefined;
                }).filter((length) => length !== undefined);
                if (lengths.some(length => length === 0 || length !== lengths[0]))
                    throw new StudioError('二次元配列の各行の要素数をそろえてください。');
                if (lengths.length && expr.items.length * lengths[0] > LIMITS.arrayCells)
                    throw new StudioError('配列の要素が多すぎます。');
                return 'matrix';
            }
            return 'array';
        }
        case 'index': {
            let target = expr.target, indices = [...expr.indices];
            while (target.kind === 'index') {
                indices = [...target.indices, ...indices];
                target = target.target;
            }
            const kind = expressionKind(target, context), dimensions = kind === 'matrix' || kind === 'unknown' ? 2 : kind === 'array' ? 1 : 0;
            if (!dimensions || indices.length > dimensions)
                throw new StudioError('配列の次元に合った要素番号を指定してください。');
            for (const index of indices) {
                scalar(index);
                const value = constantValue(index);
                if (value !== undefined && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < context.base))
                    throw new StudioError(`要素番号は ${context.base} 以上の整数にしてください。`);
            }
            return kind === 'unknown' ? 'unknown' : dimensions - indices.length === 1 ? 'array' : 'scalar';
        }
        case 'unary':
            scalar(expr.expression);
            return 'scalar';
        case 'binary':
            scalar(expr.left);
            scalar(expr.right);
            return 'scalar';
        case 'call': {
            const custom = context.functions?.find(fn => fn.name === expr.name);
            if (custom) {
                if (!custom.returnsValue)
                    throw new StudioError(`「${custom.name}」には返す値がありません。関数ブロックで「値を返す」を設定するか、「関数」から呼び出してください。`);
                if (expr.args.length !== custom.parameters.length)
                    throw new StudioError(`${expr.name}()の引数は${custom.parameters.length}個で指定してください。`);
                expr.args.forEach(arg => validateExpression(arg, context));
                return 'unknown';
            }
            const builtin = getBuiltin(expr.name, expr.args.length);
            expr.args.forEach((arg, i) => validateExpression(arg, context, builtin.argumentKinds?.[i] ?? 'any'));
            if (expr.name === '乱数' && expr.args.length) {
                const values = expr.args.map(constantValue), [min, max, kind] = values;
                if (min !== undefined && typeof min !== 'number' || max !== undefined && typeof max !== 'number' || kind !== undefined && kind !== '整数' && kind !== '実数')
                    throw new StudioError('乱数は数値の範囲と "整数" または "実数" を指定してください。');
                if (typeof min === 'number' && typeof max === 'number' && (min > max || kind === '実数' && min === max || kind === '整数' && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max))))
                    throw new StudioError('乱数の範囲を確認してください。整数の場合は整数の範囲を指定します。');
            }
            return builtin.returnKind ?? 'scalar';
        }
    }
}
export function validateExpression(expr, context, expected = 'any') {
    const kind = expressionKind(expr, context);
    // Parameter and custom return types depend on the actual call. The runtime
    // checks their values, indices and arithmetic without evaluating ahead.
    if (kind === 'unknown')
        return expr;
    if (expected === 'scalar' && kind !== 'scalar')
        throw new StudioError('変数には配列全体を入れられません。配列の要素を指定してください。');
    if (expected === 'collection' && kind === 'scalar')
        throw new StudioError('ここには配列を指定してください。');
    if (expected === 'array' && kind !== 'array')
        throw new StudioError('一次元配列を指定してください。例：[3, 5, 9]');
    if (expected === 'matrix' && kind !== 'matrix')
        throw new StudioError('二次元配列を指定してください。例：[[1, 2], [3, 4]]');
    return expr;
}
export function readExpressionInput(text, context, expected = 'any', condition = false) {
    const normalized = normalizeExpressionInput(text, condition);
    if (!normalized)
        throw new StudioError('値や式を入力してください。');
    const expr = validateExpression(parseExpression(normalized, 1, 1, new Map(context.functions?.map(fn => [fn.name, fn.parameters.length]))), context, expected);
    checkConstantCalculation(expr);
    if (condition && scalarType(expr) !== 'boolean' && scalarType(expr) !== 'unknown')
        throw new StudioError('条件には x < 10 のような比較式を指定してください。');
    return expr;
}
function scalarType(expr) {
    if (expr.kind === 'literal')
        return typeof expr.value;
    if (expr.kind === 'array')
        return 'collection';
    if (expr.kind === 'unary')
        return expr.operator === 'not' ? 'boolean' : 'number';
    if (expr.kind === 'binary')
        return ['==', '!=', '<', '<=', '>', '>=', 'and', 'or'].includes(expr.operator) ? 'boolean'
            : expr.operator === '+' && scalarType(expr.left) === 'string' && scalarType(expr.right) === 'string' ? 'string' : 'number';
    if (expr.kind === 'call')
        return builtinRegistry.has(expr.name) ? getBuiltin(expr.name, expr.args.length).scalarType ?? 'unknown' : 'unknown';
    return 'unknown';
}
// Detect mistakes that can be decided from literals alone. No variables or
// built-ins are evaluated, and short-circuited branches are left untouched.
function checkConstantCalculation(expr) {
    if (expr.kind === 'literal')
        return expr.value;
    if (expr.kind === 'unary') {
        const value = checkConstantCalculation(expr.expression);
        if (value === undefined)
            return;
        return expr.operator === 'not' ? !truth(value) : numeric((expr.operator === '-' ? -1 : 1) * numeric(value));
    }
    if (expr.kind === 'binary') {
        const left = checkConstantCalculation(expr.left);
        if (expr.operator === 'and' || expr.operator === 'or') {
            if (left !== undefined && (expr.operator === 'and' && !truth(left) || expr.operator === 'or' && truth(left)))
                return left;
            const right = checkConstantCalculation(expr.right);
            return left !== undefined && right !== undefined ? truth(right) : undefined;
        }
        const right = checkConstantCalculation(expr.right);
        return left !== undefined && right !== undefined ? binary(expr.operator, left, right) : undefined;
    }
    if (expr.kind === 'array')
        expr.items.forEach(checkConstantCalculation);
    if (expr.kind === 'index') {
        checkConstantCalculation(expr.target);
        expr.indices.forEach(checkConstantCalculation);
    }
    if (expr.kind === 'call')
        expr.args.forEach(checkConstantCalculation);
    return undefined;
}
