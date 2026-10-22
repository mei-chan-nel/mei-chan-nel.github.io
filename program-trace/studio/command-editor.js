import { element, button, showFormError } from './dom.js?v=20261009-function-help3';
import { expressionEditor, field, nameField, selection, subExpression } from './expression-editor.js?v=20261009-function-help3';
import { targetEditor, targetText } from './target-editor.js?v=20261009-function-help3';
import { literal } from './builder-model.js?v=20261009-function-help3';
import { settingsEditor } from './input-settings.js?v=20261009-function-help3';
import { defaultInput } from './documents.js?v=20261009-function-help3';
import { constantValue } from './expressions.js?v=20261009-function-help3';
import { LIMITS, StudioError, validName } from './errors.js';
import { builtinRegistry, getBuiltin } from './builtins.js';
import { normalizeSymbols } from './lexer.js?v=20261009-function-help3';
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
                        const custom = context.functions?.find(fn => fn.name === valueFunction);
                        const functionValue = custom ? { kind: 'call', name: custom.name, args: custom.parameters.map(() => literal(0)), column: 1 } : valueFunction === '乱数' ? { kind: 'call', name: '乱数', args: [], column: 1 } : valueFunction === '要素数' ? { kind: 'call', name: '要素数', args: [rhsContext.arrays.length ? { kind: 'variable', name: rhsContext.arrays[0], column: 1 } : { kind: 'array', items: [], column: 1 }], column: 1 } : undefined;
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
    else if (draft.kind === 'define') {
        const name = nameField('関数名', draft.name), parameters = element('fieldset', 'function-parameters');
        parameters.append(element('legend', '', '引数'));
        const controls = element('div', 'array-length-controls'), count = element('span', 'array-count'), items = element('div', 'function-parameter-items');
        let inputs = [], values = [...draft.parameters];
        const add = button('引数を追加する', () => { values = inputs.map(input => input.value); values.push(''); renderParameters(); inputs.at(-1)?.focus(); }, 'button array-count-button');
        function renderParameters() {
            items.replaceChildren();
            inputs = [];
            count.textContent = `${values.length}個の引数`;
            add.disabled = values.length >= LIMITS.variables;
            values.forEach((value, index) => {
                const item = nameField(`引数${index + 1}の名前`, value);
                item.node.classList.add('function-parameter-item');
                item.input.placeholder = index === 0 ? '例：n' : '例：data';
                const remove = button('×', () => { values = inputs.map(input => input.value); values.splice(index, 1); renderParameters(); (inputs[index] ?? inputs.at(-1) ?? add).focus(); }, 'array-remove');
                remove.setAttribute('aria-label', `引数${index + 1}を削除`);
                item.node.append(remove);
                items.append(item.node);
                inputs.push(item.input);
            });
            showFormError(node.closest('form') ?? node, '');
        }
        controls.append(count, add);
        parameters.append(controls, items, element('p', 'dialog-description', '受け取る値の名前を1つずつ追加します。引数がいらないときは0個にします。'));
        renderParameters();
        node.append(name.node, parameters, element('p', 'dialog-description', '関数の処理は、メインの下の専用ブロックで作成します。関数名と引数は作成後に変更できません。引数と関数内の変数は、呼び出すたびに別に用意します。'));
        const checkName = (input, label) => {
            const value = normalizeSymbols(input.value).trim();
            input.value = value;
            if (!validName(value) || builtinRegistry.has(value) || ['and', 'or', 'not', '真', '偽', 'true', 'false'].includes(value)) {
                input.setAttribute('aria-invalid', 'true');
                input.focus();
                throw new StudioError(`${label}を確認してください。文字または _ で始め、空白・記号・予約語は使わないでください。`);
            }
            input.removeAttribute('aria-invalid');
            return value;
        };
        readBody = () => {
            draft.name = checkName(name.input, '関数名');
            if (context.functions?.some(fn => fn.name === draft.name)) {
                name.input.setAttribute('aria-invalid', 'true');
                name.input.focus();
                throw new StudioError(`「${draft.name}」という関数は作成済みです。別の関数名にしてください。`);
            }
            const seen = new Set();
            draft.parameters = inputs.map((input, index) => {
                const value = checkName(input, `引数${index + 1}の名前`);
                if (seen.has(value)) {
                    input.setAttribute('aria-invalid', 'true');
                    input.focus();
                    throw new StudioError(`引数${index + 1}の「${value}」は重複しています。別の名前にしてください。`);
                }
                seen.add(value);
                return value;
            });
            return draft;
        };
    }
    else if (draft.kind === 'return') {
        const mode = selection('返し方', [['value', '値を返す'], ['none', '値を返さずに終了する']], fresh || draft.expression ? 'value' : 'none');
        // This pending return also makes the current function available for recursion.
        const returnContext = { ...context, functions: context.functions?.map(fn => fn.name === context.activeFunction ? { ...fn, returnsValue: true } : fn) };
        const value = expressionEditor(fresh ? undefined : draft.expression, '呼び出し元に返す値', returnContext);
        const render = () => { value.node.hidden = mode.input.value !== 'value'; };
        mode.input.addEventListener('change', render);
        render();
        node.append(mode.node, value.node, element('p', 'dialog-description', 'ここで関数を終え、呼び出した場所に戻ります。値を返すと、変数・配列の右辺でこの関数を使えます。'));
        readBody = () => { if (mode.input.value === 'value')
            draft.expression = value.read();
        else
            delete draft.expression; return draft; };
    }
    else if (draft.kind === 'call') {
        const call = draft.expression;
        if (call.kind !== 'call')
            throw new StudioError('呼び出す関数を確認してください。');
        const fn = context.functions?.find(fn => fn.name === call.name);
        const builtin = !fn && builtinRegistry.has(call.name) ? getBuiltin(call.name, call.args.length) : undefined;
        if (!fn && !builtin)
            throw new StudioError('呼び出す関数を先に定義してください。');
        const parameters = fn?.parameters ?? call.args.map((_, index) => `引数${index + 1}`);
        const args = parameters.map((parameter, index) => expressionEditor(fresh ? undefined : call.args[index], fn ? `引数${index + 1}：${parameter}` : parameter, context, false, builtin?.argumentKinds?.[index] ?? 'any'));
        node.append(element('p', 'function-call-name', `呼び出す関数：${call.name}()`), ...args.map(arg => arg.node), element('p', 'dialog-description', args.length ? 'それぞれの引数に渡す値を設定してください。呼び出した関数の処理が終わると、次の行に進みます。' : '引数のない関数です。処理が終わると、次の行に進みます。'));
        readBody = () => { draft.expression = { kind: 'call', name: call.name, args: args.map(arg => arg.read()), column: 1 }; return draft; };
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
