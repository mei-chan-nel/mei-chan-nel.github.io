import { element, button } from './dom.js?v=20261009-functions';
import { cloneValue, isMatrix, validateValue } from './values.js';
import { StudioError, LIMITS } from './errors.js';
let serial = 0;
export function valueEditor(initial, label, options = {}) {
    const base = options.base ?? 0, id = `value-field-${++serial}`;
    const root = element('fieldset', 'value-editor');
    root.append(element('legend', '', label));
    let value = cloneValue(initial);
    const readers = new Map();
    function scalar(item, caption, key) {
        const wrap = element('div', 'array-editor-cell'), scalarId = `${id}-${key}`;
        const labelNode = element('label', '', caption);
        labelNode.htmlFor = scalarId;
        wrap.append(labelNode);
        if (typeof item === 'boolean') {
            const select = element('select');
            select.id = scalarId;
            for (const text of ['真', '偽']) {
                const option = element('option', '', text);
                option.value = text;
                select.append(option);
            }
            select.value = item ? '真' : '偽';
            readers.set(key, () => select.value === '真');
            wrap.append(select);
        }
        else {
            const input = element('input');
            input.id = scalarId;
            input.autocomplete = 'off';
            input.type = typeof item === 'number' ? 'number' : 'text';
            input.value = String(item);
            if (input.type === 'number') {
                input.step = options.spec?.integer ? '1' : 'any';
                input.inputMode = options.spec?.integer ? 'numeric' : 'decimal';
            }
            input.maxLength = options.spec ? 1000 : LIMITS.string;
            if (options.spec && input.type === 'number') {
                input.min = String(options.spec.min);
                input.max = String(options.spec.max);
            }
            readers.set(key, () => {
                if (typeof item !== 'number')
                    return input.value;
                if (!input.value.trim() || !Number.isFinite(Number(input.value))) {
                    input.focus();
                    throw new StudioError(`${label} の ${caption} に数値を入力してください。`);
                }
                return Number(input.value);
            });
            wrap.append(input);
        }
        return wrap;
    }
    const read = () => {
        const result = Array.isArray(value) ? isMatrix(value) ? value.map((row, i) => row.map((_, j) => readers.get(`${i}-${j}`)())) : value.map((_, i) => readers.get(String(i))()) : readers.get('scalar')();
        validateValue(result);
        return result;
    };
    const defaultCell = () => {
        if (options.spec)
            return options.spec.elementKind === 'text' ? '' : Math.max(options.spec.min, Math.min(options.spec.max, 0));
        if (options.elementType)
            return options.elementType === 'string' ? '' : options.elementType === 'boolean' ? false : 0;
        const first = Array.isArray(value) ? isMatrix(value) ? value[0]?.[0] : value[0] : value;
        return typeof first === 'string' ? '' : typeof first === 'boolean' ? false : 0;
    };
    function render() {
        root.replaceChildren(element('legend', '', label));
        readers.clear();
        if (!Array.isArray(value)) {
            root.append(scalar(value, '値', 'scalar'));
            return;
        }
        const matrix = isMatrix(value), count = value.length;
        const dimensions = options.dimensions !== false;
        if (matrix) {
            const columns = value[0].length;
            const header = element('div', 'array-length-controls');
            header.append(element('span', 'array-count', `${count}行 × ${columns}列`));
            if (dimensions) {
                header.append(button('行を追加する', () => { value = read(); if ((value.length + 1) * columns > LIMITS.arrayCells)
                    throw new StudioError('配列が大きすぎます。'); value.push(Array.from({ length: columns }, defaultCell)); render(); }, 'button array-count-button'));
                header.append(button('列を追加する', () => { const rows = read(); if (rows.length * (columns + 1) > LIMITS.arrayCells)
                    throw new StudioError('配列が大きすぎます。'); rows.forEach(row => row.push(defaultCell())); value = rows; render(); }, 'button array-count-button'));
            }
            root.append(header);
            const table = element('div', 'matrix-edit-grid');
            table.style.setProperty('--edit-columns', String(Math.min(columns, 5)));
            if (dimensions) {
                const controls = element('div', 'column-removers');
                for (let j = 0; j < columns; j++) {
                    const remove = button(`列${j + base} ×`, () => { const rows = read(); rows.forEach(row => row.splice(j, 1)); value = rows; render(); }, 'text-button');
                    remove.disabled = columns <= 1;
                    controls.append(remove);
                }
                root.append(controls);
            }
            value.forEach((row, i) => {
                const rowNode = element('div', 'matrix-edit-row');
                rowNode.append(element('strong', 'matrix-edit-label', `行 ${i + base}`));
                if (dimensions) {
                    const remove = button('×', () => { value = read(); value.splice(i, 1); render(); }, 'array-remove');
                    remove.setAttribute('aria-label', `行${i + base}を削除`);
                    remove.disabled = count <= 1;
                    rowNode.append(remove);
                }
                const cells = element('div', 'array-editor-cells');
                row.forEach((item, j) => cells.append(scalar(item, `[${i + base}, ${j + base}]`, `${i}-${j}`)));
                rowNode.append(cells);
                table.append(rowNode);
            });
            root.append(table);
        }
        else {
            const header = element('div', 'array-length-controls');
            header.append(element('span', 'array-count', `${count}要素`));
            if (dimensions) {
                const add = button('要素を追加する', () => { value = read(); value.push(defaultCell()); render(); }, 'button array-count-button');
                add.disabled = count >= (options.spec?.maxLength ?? LIMITS.arrayCells);
                header.append(add);
            }
            root.append(header);
            const cells = element('div', 'array-editor-cells');
            value.forEach((item, i) => {
                const cell = scalar(item, `[${i + base}]`, String(i));
                if (dimensions) {
                    const remove = button('×', () => { value = read(); value.splice(i, 1); render(); }, 'array-remove');
                    remove.setAttribute('aria-label', `要素${i + base}を削除`);
                    remove.disabled = count <= (options.spec?.minLength ?? 0);
                    cell.append(remove);
                }
                cells.append(cell);
            });
            root.append(cells);
        }
    }
    // All mutations are local to this editor; caller validates before applying.
    root.addEventListener('click', () => { root.setAttribute('data-value-kind', Array.isArray(value) ? 'array' : 'scalar'); });
    render();
    return { node: root, read, focus: () => root.querySelector('input, select')?.focus() };
}
export function inputInitial(spec) {
    const cell = () => spec.elementKind === 'text' ? '' : Math.max(spec.min, Math.min(spec.max, 0));
    if (spec.kind === 'number')
        return Math.max(spec.min, Math.min(spec.max, 0));
    if (spec.kind === 'text')
        return '';
    if (spec.kind === 'array')
        return Array.from({ length: Math.max(spec.minLength, Math.min(3, spec.maxLength)) }, cell);
    return Array.from({ length: spec.rows }, () => Array.from({ length: spec.columns }, cell));
}
