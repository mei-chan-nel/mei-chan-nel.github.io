import { defaultInput, validateInputSpec } from './documents.js?v=20261009-function-editor2';
import { element } from './dom.js?v=20261009-function-editor2';
import { normalizeSymbols, splitComment } from './lexer.js?v=20261009-function-editor2';
let serial = 0;
export function inputNames(source) {
    const names = new Set();
    for (const row of source.split('\n')) {
        const code = normalizeSymbols(splitComment(row).code);
        const match = code.match(/([\p{L}_][\p{L}\p{N}_]*)\s*=\s*【外部からの入力】\s*$/u);
        if (match)
            names.add(match[1]);
    }
    return [...names];
}
export function settingsEditor(container, names, existing, changed, allowedKinds) {
    const readers = new Map();
    container.replaceChildren();
    if (!names.length)
        container.append(element('p', '', '【外部からの入力】を書くと、入力形式を設定できます。'));
    for (const name of names) {
        const initial = existing[name] ?? defaultInput();
        const field = element('fieldset', 'input-setting');
        field.append(element('legend', '', name));
        const prefix = `input-spec-${++serial}`;
        const controls = new Map();
        const kindLabel = element('label', '', '入力形式');
        kindLabel.htmlFor = `${prefix}-kind`;
        field.append(kindLabel);
        const kind = element('select');
        kind.id = kindLabel.htmlFor;
        for (const [value, text] of [['number', '数値'], ['text', '文字列'], ['array', '一次元配列'], ['matrix', '二次元配列']]) {
            if (allowedKinds && !allowedKinds.includes(value))
                continue;
            const option = element('option', '', text);
            option.value = value;
            kind.append(option);
        }
        kind.value = initial.kind;
        field.append(kind);
        controls.set('kind', kind);
        const grid = element('div', 'spec-fields');
        field.append(grid);
        function select(key, label, options, initialValue) {
            const cell = element('div'), caption = element('label', '', label), node = element('select');
            caption.htmlFor = `${prefix}-${key}`;
            node.id = caption.htmlFor;
            for (const [value, text] of options) {
                const option = element('option', '', text);
                option.value = value;
                node.append(option);
            }
            node.value = initialValue;
            controls.set(key, node);
            cell.append(caption, node);
            grid.append(cell);
            return cell;
        }
        function number(key, label, value, min, max) {
            const cell = element('div'), caption = element('label', '', label), node = element('input');
            caption.htmlFor = `${prefix}-${key}`;
            node.id = caption.htmlFor;
            node.type = 'number';
            node.step = 'any';
            node.value = String(value);
            if (min !== undefined)
                node.min = String(min);
            if (max !== undefined)
                node.max = String(max);
            controls.set(key, node);
            cell.append(caption, node);
            grid.append(cell);
            return cell;
        }
        const elementKind = select('elementKind', '要素の種類', [['number', '数値'], ['text', '文字列']], initial.elementKind);
        elementKind.className = 'spec-wide';
        const integer = select('integer', '数値の種類', [['true', '整数'], ['false', '実数']], String(initial.integer));
        integer.className = 'spec-wide';
        const min = number('min', '最小値', initial.min), max = number('max', '最大値', initial.max);
        const minLength = number('minLength', '最小要素数', initial.minLength, 1, 1000), maxLength = number('maxLength', '最大要素数', initial.maxLength, 1, 1000);
        const rows = number('rows', '行数', initial.rows, 1, 30), columns = number('columns', '列数', initial.columns, 1, 30);
        const visibility = () => {
            const array = kind.value === 'array' || kind.value === 'matrix', numeric = kind.value === 'number' || array && controls.get('elementKind').value === 'number';
            elementKind.hidden = !array;
            integer.hidden = !numeric;
            min.hidden = !numeric;
            max.hidden = !numeric;
            minLength.hidden = maxLength.hidden = kind.value !== 'array';
            rows.hidden = columns.hidden = kind.value !== 'matrix';
        };
        field.addEventListener('change', () => { visibility(); changed(); });
        field.addEventListener('input', changed);
        visibility();
        readers.set(name, () => {
            const numericField = (key) => { const raw = controls.get(key).value; return raw.trim() ? Number(raw) : NaN; };
            const defaults = defaultInput(), array = kind.value === 'array' || kind.value === 'matrix';
            const numeric = kind.value === 'number' || array && controls.get('elementKind').value === 'number';
            return validateInputSpec({ kind: kind.value, integer: numeric ? controls.get('integer').value === 'true' : defaults.integer, elementKind: array ? controls.get('elementKind').value : defaults.elementKind,
                min: numeric ? numericField('min') : defaults.min, max: numeric ? numericField('max') : defaults.max,
                minLength: kind.value === 'array' ? numericField('minLength') : defaults.minLength, maxLength: kind.value === 'array' ? numericField('maxLength') : defaults.maxLength,
                rows: kind.value === 'matrix' ? numericField('rows') : defaults.rows, columns: kind.value === 'matrix' ? numericField('columns') : defaults.columns });
        });
        container.append(field);
    }
    return () => { const result = Object.create(null); for (const [name, reader] of readers)
        result[name] = reader(); return result; };
}
