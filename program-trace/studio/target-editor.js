import { element } from './dom.js';
import { nameField, selection, subExpression } from './expression-editor.js';
import { literal } from './builder-model.js';
import { validName, StudioError } from './errors.js';
import { expressionText } from './expressions.js';
import { formatValue } from './values.js';
import { builtinRegistry } from './builtins.js';
import { normalizeSymbols } from './lexer.js';
let serial = 0;
export const targetText = (target) => target.name + (target.indices.length ? `[${target.indices.map(expressionText).join(', ')}]` : '');
export function targetEditor(initial, context, scalarOnly = false) {
    const node = element('div', 'target-editor'), choices = element('fieldset', 'target-choices'), group = `target-${++serial}`;
    const catalog = context.catalog ?? context.variables.map(name => ({ name, kind: context.arrays.includes(name) ? 'array' : 'variable' }));
    const initialChoice = catalog.find(item => item.name === initial?.name);
    let chosen = initialChoice?.name ?? '', kind = scalarOnly ? 'variable' : initialChoice?.kind ?? (initial?.indices.length === 2 ? 'matrix' : initial?.indices.length ? 'array' : 'variable');
    const type = selection('作るもの', [['variable', '変数'], ['array', '一次元配列'], ['matrix', '二次元配列']], kind);
    const extras = element('div', 'target-extra'), newArea = element('div', 'new-variable-area'), indicesArea = element('div', 'target-indices');
    const name = nameField('名前', initialChoice ? '' : initial?.name ?? '');
    newArea.append(name.node);
    const mode = selection('入れる場所', [['whole', '配列全体'], ['element', 'ひとつの要素']], initial?.indices.length ? 'element' : 'whole');
    let positions = [];
    function renderExtras() {
        extras.replaceChildren();
        positions = [];
        if (!chosen)
            extras.append(newArea);
        else if (kind !== 'variable')
            extras.append(mode.node);
        if (chosen && kind !== 'variable' && mode.input.value === 'element') {
            positions = Array.from({ length: kind === 'matrix' ? 2 : 1 }, (_, i) => subExpression(initial?.name === chosen ? initial.indices[i] ?? literal(context.base) : literal(context.base), kind === 'matrix' ? i === 0 ? '行番号' : '列番号' : '要素番号', context));
            indicesArea.replaceChildren(...positions.map(item => item.node));
            extras.append(indicesArea);
        }
    }
    function renderChoices() {
        choices.replaceChildren(element('legend', '', scalarOnly ? '繰り返しに使う変数' : kind === 'variable' ? '値を入れる変数（左辺）' : '値を入れる配列（左辺）'));
        function radio(value, label, detail = '') {
            const row = element('label', 'target-choice'), input = element('input');
            input.type = 'radio';
            input.name = group;
            input.value = value;
            input.checked = value === chosen;
            input.addEventListener('change', () => { if (input.checked) {
                chosen = value;
                renderExtras();
            } });
            const text = element('span');
            text.append(element('strong', '', label));
            if (detail)
                text.append(element('span', 'subtle-label', detail));
            row.append(input, text);
            choices.append(row);
        }
        const matching = catalog.filter(item => item.kind === kind);
        if (chosen && !matching.some(item => item.name === chosen))
            chosen = '';
        for (const item of matching)
            radio(item.name, item.name, item.value === undefined ? '' : formatValue(item.value).slice(0, 70));
        radio('', '新規');
        renderExtras();
    }
    type.input.addEventListener('change', () => { kind = type.input.value; renderChoices(); });
    mode.input.addEventListener('change', renderExtras);
    renderChoices();
    if (!scalarOnly)
        node.append(type.node);
    node.append(choices, extras);
    return { node, read: () => {
            const targetName = chosen || normalizeSymbols(name.input.value).trim();
            name.input.value = chosen ? name.input.value : targetName;
            if (!validName(targetName) || builtinRegistry.has(targetName) || ['and', 'or', 'not', '真', '偽', 'true', 'false'].includes(targetName))
                throw new StudioError('名前は文字から始め、空白や記号を含めずに入力してください。関数名・予約語は使えません。');
            const existing = catalog.find(item => item.name === targetName);
            if (existing && existing.kind !== kind)
                throw new StudioError(`「${targetName}」はすでに${existing.kind === 'variable' ? '変数' : existing.kind === 'array' ? '一次元配列' : '二次元配列'}として使われています。「作るもの」を合わせるか、別の名前にしてください。`);
            return { target: { name: targetName, indices: positions.map(item => item.read()) }, kind };
        } };
}
