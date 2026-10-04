import { element, button, showFormError } from './dom.js';
import { expressionEditor, field, selection, subExpression } from './expression-editor.js';
import { targetEditor, targetText } from './target-editor.js';
import { literal } from './builder-model.js';
import { settingsEditor } from './input-settings.js';
import { defaultInput } from './documents.js';
import { constantValue } from './expressions.js';
import { StudioError } from './errors.js';
export function commandEditor(initial, context, specs, fresh = false, valueFunction) {
    const node = element('div', 'command-fields'), draft = structuredClone(initial);
    let readBody = () => draft, inputSpec;
    const leftSteps = [];
    let stageChanged = () => { };
    if (draft.kind === 'assign' || draft.kind === 'input') {
        const assignments = draft.kind === 'assign' ? draft.assignments : [{ target: { name: draft.name, indices: [] }, expression: literal(0) }];
        const fields = element('div', 'assignment-items');
        const readers = [];
        for (const [index, assignment] of assignments.entries()) {
            const wrap = element('div', 'assignment-wizard'), steps = element('p', 'assignment-steps'), leftArea = element('div'), rightArea = element('div');
            const left = targetEditor(fresh ? undefined : assignment.target, context), heading = element('div', 'assignment-summary');
            let selected = { target: structuredClone(assignment.target), kind: (context.catalog?.find(item => item.name === assignment.target.name)?.kind ?? 'variable') };
            let value, preservedValue, readSpec;
            let external = draft.kind === 'input', choosing = true;
            let originalSpec = draft.kind === 'input' ? specs[draft.name] ?? defaultInput() : undefined;
            leftArea.append(left.node);
            const nextToRight = () => {
                const next = left.read();
                if (external && readSpec)
                    originalSpec = readSpec()[selected.target.name];
                if (next.kind !== selected.kind || !!next.target.indices.length !== !!selected.target.indices.length) {
                    value = undefined;
                    preservedValue = undefined;
                }
                else if (value && next.target.name !== selected.target.name) {
                    try {
                        preservedValue = value.read();
                        value = undefined;
                    }
                    catch { /* The unfinished value stays available until it is corrected. */ }
                }
                selected = next;
                choosing = false;
                showRight();
                stageChanged();
            };
            leftSteps.push({ choosing: () => choosing, next: nextToRight });
            function showRight() {
                leftArea.hidden = true;
                rightArea.hidden = false;
                steps.textContent = '右辺を入力';
                heading.replaceChildren(element('strong', '', `${targetText(selected.target)} =`), button('左辺を変更', () => { choosing = true; steps.textContent = '左辺を入力'; leftArea.hidden = false; rightArea.hidden = true; stageChanged(); }, 'text-button'));
                const rhsContext = context, expected = selected.target.indices.length || selected.kind === 'variable' ? 'scalar' : selected.kind;
                const mode = selection('右辺の入力', [['expression', '値・計算式'], ['input', '外部からの入力']], external ? 'input' : 'expression'), content = element('div');
                function renderContent() {
                    external = mode.input.value === 'input';
                    content.replaceChildren();
                    if (external) {
                        if (selected.target.indices.length || assignments.length > 1)
                            throw new StudioError('外部からの入力は、変数または配列全体に1行で入れてください。');
                        const inputKinds = selected.kind === 'variable' ? ['number', 'text'] : [selected.kind];
                        const spec = originalSpec && inputKinds.includes(originalSpec.kind) ? originalSpec : { ...defaultInput(), kind: inputKinds[0] };
                        readSpec = settingsEditor(content, [selected.target.name], { [selected.target.name]: spec }, () => { }, inputKinds);
                    }
                    else {
                        const functionValue = valueFunction === '乱数' ? { kind: 'call', name: '乱数', args: [], column: 1 } : valueFunction === '要素数' ? { kind: 'call', name: '要素数', args: [rhsContext.arrays.length ? { kind: 'variable', name: rhsContext.arrays[0], column: 1 } : { kind: 'array', items: [], column: 1 }], column: 1 } : undefined;
                        const defaultValue = expected === 'scalar' ? undefined : { kind: 'array', items: expected === 'matrix' ? [{ kind: 'array', items: [literal(0), literal(0)], column: 1 }] : [literal(0), literal(0), literal(0)], column: 1 };
                        if (!value)
                            value = expressionEditor(preservedValue ?? (fresh ? functionValue ?? defaultValue : selected.kind === (context.catalog?.find(item => item.name === assignment.target.name)?.kind ?? 'variable') && !!selected.target.indices.length === !!assignment.target.indices.length ? assignment.expression : defaultValue), '入れる値（右辺）', rhsContext, false, expected);
                        content.append(value.node);
                    }
                }
                if (assignments.length > 1 || selected.target.indices.length) {
                    external = false;
                    mode.input.value = 'expression';
                    rightArea.replaceChildren(heading, content);
                }
                else
                    rightArea.replaceChildren(heading, mode.node, content);
                mode.input.addEventListener('change', () => {
                    try {
                        if (external && readSpec)
                            originalSpec = readSpec()[selected.target.name];
                        renderContent();
                    }
                    catch (error) {
                        mode.input.value = external ? 'input' : 'expression';
                        showFormError(node.closest('form') ?? node, error instanceof Error ? error.message : '入力の設定を確認してください。');
                    }
                });
                renderContent();
            }
            if (choosing) {
                rightArea.hidden = true;
                steps.textContent = '左辺を入力';
            }
            else
                showRight();
            if (assignments.length > 1)
                wrap.append(element('h3', '', `代入 ${index + 1}`));
            wrap.append(steps, leftArea, rightArea);
            fields.append(wrap);
            readers.push(() => {
                if (choosing)
                    throw new StudioError('値を入れる場所を選び、「右辺を入力」を押してください。');
                return external ? { target: selected.target, spec: readSpec()[selected.target.name] } : { target: selected.target, expression: value.read() };
            });
        }
        node.append(fields);
        readBody = () => {
            const values = readers.map(read => read());
            if (values[0].spec)
                return { id: draft.id, comment: draft.comment, kind: 'input', name: values[0].target.name };
            return { id: draft.id, comment: draft.comment, kind: 'assign', assignments: values.map(item => ({ target: item.target, expression: item.expression })) };
        };
        inputSpec = () => readers[0]().spec;
    }
    else if (draft.kind === 'print') {
        let args = fresh ? [undefined] : structuredClone(draft.args), readers = [];
        const fields = element('div', 'display-items');
        function render() {
            readers = args.map((arg, i) => expressionEditor(arg, `表示する内容 ${i + 1}`, context));
            fields.replaceChildren();
            readers.forEach((editor, i) => {
                const wrap = element('div', 'display-setting');
                wrap.append(editor.node);
                if (readers.length > 1)
                    wrap.append(button('この内容を削除', () => { args = readers.filter((_, index) => index !== i).map(item => item.read()); render(); }, 'text-button'));
                fields.append(wrap);
            });
        }
        render();
        node.append(fields, button('表示する内容を追加', () => { args = readers.map(item => item.read()); args.push(undefined); render(); }, 'button'));
        readBody = () => { draft.args = readers.map(item => item.read()); return draft; };
    }
    else if (draft.kind === 'if' || draft.kind === 'while') {
        const condition = expressionEditor(fresh ? undefined : draft.condition, '条件', context, true);
        node.append(condition.node);
        readBody = () => { draft.condition = condition.read(); return draft; };
    }
    else if (draft.kind === 'for') {
        const counter = targetEditor({ name: draft.name, indices: [] }, context, true);
        const direction = selection('増減の方向', [['1', '増やしながら'], ['-1', '減らしながら']], String(draft.direction));
        const start = subExpression(draft.start, '開始値', context), end = subExpression(draft.end, '終了値（この値も含む）', context), step = subExpression(draft.step, '1回で増減する値', context);
        node.append(counter.node, direction.node, start.node, end.node, step.node);
        readBody = () => {
            draft.name = counter.read().target.name;
            draft.direction = Number(direction.input.value);
            draft.start = start.read();
            draft.end = end.read();
            draft.step = step.read();
            for (const [expr, label] of [[draft.start, '開始値'], [draft.end, '終了値'], [draft.step, '増減する値']]) {
                const value = constantValue(expr);
                if (value !== undefined && (typeof value !== 'number' || !Number.isSafeInteger(value) || label === '増減する値' && value < 1))
                    throw new StudioError(`${label}は${label === '増減する値' ? '1以上の' : ''}整数にしてください。`);
            }
            return draft;
        };
    }
    else if (draft.kind === 'comment') {
        const text = field('メモ', draft.text);
        node.append(text.node);
        readBody = () => { draft.text = text.input.value; return draft; };
    }
    else if (draft.kind === 'else')
        node.append(element('p', 'dialog-description', 'ほかの条件に当てはまらなかったときに実行します。内側の処理は、プログラムの空白行をタップして設定します。'));
    if (draft.kind !== 'comment' && draft.kind !== 'blank') {
        const details = element('details', 'optional-comment'), comment = field('メモ', draft.comment);
        details.append(element('summary', '', 'メモをつける'), comment.node);
        node.append(details);
        const read = readBody;
        readBody = () => { const result = read(); result.comment = comment.input.value; return result; };
    }
    return { node, read: readBody, ...(inputSpec ? { inputSpec } : {}), choosingLeft: () => leftSteps.some(step => step.choosing()),
        nextToRight: () => leftSteps.find(step => step.choosing())?.next(), onStageChange: callback => { stageChanged = callback; callback(); } };
}
