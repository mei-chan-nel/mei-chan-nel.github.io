import { LIMITS, StudioError, validName } from './errors.js';
import { validateValue } from './values.js';
import { validateBuilder, builderSource } from './builder-model.js?v=20261009-functions';
export const defaultInput = () => ({ kind: 'number', integer: true, min: -1000000, max: 1000000,
    minLength: 1, maxLength: 100, elementKind: 'number', rows: 2, columns: 3 });
const object = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
function boundedNumber(value, name, min, max, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value))
        throw new StudioError(`${name}の設定を確認してください。`);
    return value;
}
export function validateInputSpec(value) {
    if (!object(value) || !['number', 'text', 'array', 'matrix'].includes(String(value.kind)) || typeof value.integer !== 'boolean'
        || !['number', 'text'].includes(String(value.elementKind)))
        throw new StudioError('外部入力の形式を確認してください。');
    const min = boundedNumber(value.min, '入力の最小値', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, value.integer);
    const max = boundedNumber(value.max, '入力の最大値', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, value.integer);
    const minLength = boundedNumber(value.minLength, '入力の最小要素数', 1, LIMITS.arrayCells, true);
    const maxLength = boundedNumber(value.maxLength, '入力の最大要素数', 1, LIMITS.arrayCells, true);
    const rows = boundedNumber(value.rows, '入力の行数', 1, 30, true), columns = boundedNumber(value.columns, '入力の列数', 1, 30, true);
    if (min > max || minLength > maxLength || rows * columns > LIMITS.arrayCells)
        throw new StudioError('外部入力の範囲を確認してください。');
    return { kind: value.kind, integer: value.integer, min, max, minLength, maxLength, elementKind: value.elementKind, rows, columns };
}
export function validateSettings(value) {
    if (!object(value) || value.indexBase !== 0 && value.indexBase !== 1 || !object(value.inputs))
        throw new StudioError('配列・外部入力の設定を読み取れません。');
    if (Object.keys(value.inputs).length > LIMITS.variables)
        throw new StudioError('外部入力の設定が多すぎます。');
    const inputs = Object.create(null);
    for (const [name, spec] of Object.entries(value.inputs)) {
        if (!validName(name))
            throw new StudioError('外部入力の変数名が不正です。');
        inputs[name] = validateInputSpec(spec);
    }
    return { indexBase: value.indexBase, inputs };
}
export function validateDraft(value) {
    if (!object(value) || value.version !== 1)
        throw new StudioError('このプログラムの保存形式・バージョンには対応していません。');
    if (typeof value.title !== 'string' || value.title.length > 120 || typeof value.source !== 'string')
        throw new StudioError('プログラム名や本文を読み取れません。');
    if (new TextEncoder().encode(value.source).length > LIMITS.sourceBytes || value.source.split(/\r\n?|\n/u).length > LIMITS.lines)
        throw new StudioError(`プログラムは${LIMITS.lines}行・50KB以内にしてください。`);
    const source = value.source.replace(/\r\n?/gu, '\n');
    const builder = value.builder === undefined ? undefined : validateBuilder(value.builder);
    if (builder && builderSource(builder) !== source)
        throw new StudioError('行の編集データとプログラム本文が一致していません。');
    return { version: 1, title: value.title.trim() || '名前のないプログラム', source, settings: validateSettings(value.settings), ...(builder ? { builder } : {}) };
}
export function validateInput(value, spec) {
    validateValue(value);
    const checked = value;
    const scalar = (item, kind) => {
        if (kind === 'text') {
            if (typeof item !== 'string' || item.length > 1000)
                throw new StudioError('文字列は1,000文字以内で入力してください。');
        }
        else if (typeof item !== 'number' || spec.integer && !Number.isSafeInteger(item) || typeof item === 'number' && (item < spec.min || item > spec.max)) {
            throw new StudioError(`${spec.min}～${spec.max}の${spec.integer ? '整数' : '数値'}を入力してください。`);
        }
    };
    if (spec.kind === 'number' || spec.kind === 'text')
        scalar(checked, spec.kind);
    else {
        if (!Array.isArray(checked))
            throw new StudioError('配列を入力してください。');
        if (spec.kind === 'array') {
            if (checked.length < spec.minLength || checked.length > spec.maxLength)
                throw new StudioError(`要素数は${spec.minLength}～${spec.maxLength}個にしてください。`);
            checked.forEach(item => scalar(item, spec.elementKind));
        }
        else {
            if (checked.length !== spec.rows || checked.some(row => !Array.isArray(row) || row.length !== spec.columns))
                throw new StudioError(`${spec.rows}行・${spec.columns}列の配列を入力してください。`);
            checked.forEach(row => row.forEach(item => scalar(item, spec.elementKind)));
        }
    }
    return checked;
}
export function documentJSON(draft) {
    const text = JSON.stringify({ format: 'mei-program-studio', ...validateDraft(draft) }, null, 2);
    if (new TextEncoder().encode(text).length > LIMITS.fileBytes)
        throw new StudioError('保存ファイルが300KBを超えます。作成途中のまとまりを完成させるか、プログラムを短くしてから書き出してください。');
    return text;
}
export function parseDocument(text) {
    if (new TextEncoder().encode(text).length > LIMITS.fileBytes)
        throw new StudioError('ファイルが大きすぎます（300KB以内）。');
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new StudioError('プログラムのJSONファイルを読み取れません。Studio形式のファイルを選んでください。');
    }
    if (!object(value) || value.format !== 'mei-program-studio')
        throw new StudioError('Studio形式のプログラムファイルを選んでください。');
    return validateDraft(value);
}
