import { element, byId, button } from './dom.js';
import { tokenize } from './lexer.js';
import { formatValue, isMatrix } from './values.js';
import { branchMarkers } from './builder-model.js';
import { createAssignmentFlow } from './assignment-flow.js';
import { createVariableScroll } from './variable-scroll.js';
import { matchesReference, previewIndices } from './runner-model.js';
const keywords = /^(?:もし|ならば|そうでなければ|そうでなくもし|繰り返す|増やしながら|減らしながら|の間繰り返す|表示する|要素数|乱数|and|or|not|真|偽)$/u;
export function colorCode(source) {
    const result = element('span', 'source-code');
    // Tokenization is for display only. Invalid text is displayed verbatim.
    try {
        const tokens = tokenize(source, 1);
        let position = 0;
        for (const token of tokens) {
            if (token.kind === 'eof')
                break;
            const start = token.column - 1;
            if (start > position)
                result.append(document.createTextNode(source.slice(position, start)));
            const original = source.slice(start, start + token.text.length);
            result.append(element('span', token.kind === 'string' ? 'token-string' : token.kind === 'number' ? 'token-number' : keywords.test(token.text) ? 'token-keyword' : /^[A-Za-z_]\w*$/u.test(token.text) ? 'token-variable' : '', original));
            position = start + token.text.length;
        }
        result.append(document.createTextNode(source.slice(position)));
    }
    catch {
        result.textContent = source;
    }
    return result;
}
export class RunnerView {
    pause;
    constructor(pause = () => { }) {
        this.pause = pause;
    }
    info;
    state;
    draft;
    arrayNames = new Set();
    assignmentFlow = createAssignmentFlow(byId('variable-table'), byId('variable-rows'));
    variableScroll = createVariableScroll(byId('variables-body'), byId('variable-rows'));
    renderedVariables;
    renderedOutputLength = -1;
    rowMap = new Map();
    highlighted;
    outputs = [];
    prepare(info, draft) {
        this.info = info;
        this.draft = draft;
        this.rowMap.clear();
        this.highlighted = undefined;
        this.outputs = [];
        this.renderedVariables = undefined;
        this.renderedOutputLength = -1;
        this.assignmentFlow.update(null);
        const list = byId('program-lines');
        list.replaceChildren();
        for (const [index, line] of info.lines.entries()) {
            const row = element('li', 'program-line');
            row.dataset.line = String(line.line);
            row.append(element('span', 'line-number', `（${line.line}）`));
            const next = info.lines[index + 1], text = element('span', 'source-code'), markers = branchMarkers(line.depth, next?.depth ?? -1, !!next && /^(?:そうでなくもし|そうでなければ)/u.test(next.code));
            if (markers)
                text.append(element('span', 'branch-prefix', markers + ' '));
            text.append(colorCode(line.code));
            if (line.comment)
                text.append(element('span', 'source-comment', ` ${line.comment}`));
            row.append(text, element('span', 'line-marker'));
            list.append(row);
            this.rowMap.set(line.line, row);
        }
        this.arrayNames = new Set(info.editable.filter(item => Array.isArray(item.value)).map(item => item.label.replace(/ の初期値$/u, '')));
        for (const name of info.inputNames)
            if (['array', 'matrix'].includes(draft.settings.inputs[name]?.kind ?? 'number'))
                this.arrayNames.add(name);
        let units = Math.min(8, Math.max(4, info.variableNames.reduce((sum, name) => sum + (this.arrayNames.has(name) ? 4 : 1), 0)));
        if (units % 2)
            units++;
        const workspace = byId('workspace');
        workspace.style.setProperty('--studio-variable-height', `${units / 2 * 74 + 80}px`);
        workspace.style.setProperty('--variables-height', `${units / 2 * 74 + 80}px`);
        byId('edit-values-button').toggleAttribute('disabled', !info.editable.length);
        byId('variables-full').toggleAttribute('disabled', !info.variableNames.length);
        byId('completion-message').hidden = true;
        byId('run-error').hidden = true;
    }
    render(state, append = [], reset = false, running = false, speed = 0.5, status = {}) {
        this.state = status.input ? { ...state, changes: [], reads: [], skippedLines: [], event: null } : state;
        if (reset)
            this.outputs = [];
        this.outputs.push(...append);
        if (this.highlighted) {
            this.highlighted.classList.remove('is-current');
            this.highlighted.removeAttribute('aria-current');
            this.highlighted.querySelector('.line-marker').textContent = '';
        }
        this.rowMap.forEach(row => row.classList.remove('is-error'));
        const displayedLine = status.input?.line ?? state.currentLine;
        this.highlighted = displayedLine === null ? undefined : this.rowMap.get(displayedLine);
        if (this.highlighted) {
            this.highlighted.classList.add('is-current');
            this.highlighted.setAttribute('aria-current', 'step');
            this.highlighted.querySelector('.line-marker').textContent = '実行中';
        }
        for (const [line, row] of this.rowMap) {
            const skipped = (this.state.skippedLines ?? []).includes(line);
            row.classList.toggle('is-skipped', skipped);
            if (row !== this.highlighted)
                row.querySelector('.line-marker').textContent = skipped ? 'スキップ' : '';
        }
        if (state.error)
            this.rowMap.get(state.error.line)?.classList.add('is-error');
        byId('current-line-label').textContent = displayedLine === null ? '' : `（${displayedLine}）行`;
        byId('step-count').textContent = `${state.steps.toLocaleString('ja-JP')} ステップ`;
        byId('status-text').textContent = status.input ? '外部からの入力待ち' : state.error ? '実行を停止しました' : state.completed ? '実行完了' : running ? `自動実行中（${speed}秒）` : status.paused ? '一時停止中' : state.steps ? '1行ずつ実行中' : '準備できました';
        byId('status-dot').classList.toggle('running', running);
        byId('status-dot').classList.toggle('complete', state.completed);
        byId('completion-message').hidden = !state.completed || !!state.error;
        const event = status.input ? { title: '入力を待っています', explanation: `${status.input.name} に入れる値を入力してください。確定すると、この行の結果を反映します。` } : state.event;
        byId('detail-label').textContent = displayedLine === null ? state.completed ? '実行完了' : '実行前' : `実行中・（${displayedLine}）行`;
        byId('detail-title').textContent = event?.title ?? (state.completed ? 'すべての処理が終了' : '「次へ」で1行目から実行');
        byId('detail-explanation').textContent = event?.explanation ?? (state.completed ? '変数の値と出力を確認しましょう。' : '実行中の行と、変数の変化を確かめましょう。');
        byId('explanation-full').hidden = !event;
        const condition = byId('condition-result');
        condition.hidden = !event?.condition;
        condition.textContent = event?.condition ? `${event.condition.resolved} → ${event.condition.result ? '真（成り立つ）' : '偽（成り立たない）'}` : '';
        condition.classList.toggle('is-false', event?.condition?.result === false);
        if (this.renderedVariables !== this.state) {
            this.variables();
            this.renderedVariables = this.state;
        }
        this.output();
        const highlights = status.input || state.error ? null : state.event;
        this.assignmentFlow.update(highlights);
        this.variableScroll.update(highlights);
    }
    layout() {
        if (!this.state)
            return;
        this.variables();
        this.assignmentFlow.redraw();
        this.variableScroll.reveal();
    }
    variable(name, full = false) {
        const state = this.state, value = state.variables[name], row = element('div', 'variable-row');
        row.dataset.variable = name;
        row.setAttribute('role', 'row');
        const title = element('div', 'variable-name', name), current = element('div', 'variable-value');
        row.append(title, current);
        const changes = state.changes.filter(change => change.name === name), reads = state.reads.filter(read => read.name === name);
        const sources = state.error ? [] : state.event?.sources ?? [], assignments = state.error ? [] : state.event?.assignments ?? [];
        row.classList.toggle('is-source', sources.some(source => source.name === name && !source.indices.length));
        row.classList.toggle('is-assignment-target', assignments.some(assignment => assignment.name === name));
        if (changes.length)
            row.classList.add('is-changed');
        if (Array.isArray(value) || this.arrayNames.has(name))
            row.classList.add('is-array');
        if (Array.isArray(value)) {
            row.classList.add('is-array');
            if (!full)
                title.append(button('全要素を見る', () => this.inspect(name), 'text-button'));
            current.append(this.array(value, name, full));
        }
        else {
            current.textContent = formatValue(value, full ? Infinity : 40);
            current.title = formatValue(value);
            if (value === undefined)
                current.classList.add('is-unset');
        }
        const change = element('div', 'variable-change');
        for (const [index, item] of changes.entries()) {
            if (index)
                change.append(document.createTextNode(' / '));
            if (item.indices.length)
                change.append(element('code', 'changed-target', `${name}[${item.indices.join(', ')}]`));
            const wasSource = sources.some(source => matchesReference(source, name, item.indices));
            const describe = (v) => v === undefined ? '未代入' : Array.isArray(v) ? isMatrix(v) ? `${v.length}×${v[0].length}の配列` : `${v.length}個の配列` : formatValue(v, full ? Infinity : 32);
            change.append(element('span', item.before === undefined ? 'unset-before' : wasSource ? 'is-assignment-source' : '', describe(item.before)), element('span', 'change-arrow', '→'), element('strong', '', describe(item.after)));
        }
        if (!changes.length)
            change.textContent = '—';
        if (reads.length && !Array.isArray(value) && !sources.some(source => source.name === name) && !assignments.some(assignment => assignment.name === name))
            row.classList.add('is-referenced');
        for (const node of [title, current, change])
            node.setAttribute('role', 'cell');
        row.append(change);
        return row;
    }
    array(value, name, full) {
        const state = this.state, base = this.draft.settings.indexBase;
        const sources = state.error ? [] : state.event?.sources ?? [], assignments = state.error ? [] : state.event?.assignments ?? [];
        const references = [...state.changes, ...assignments, ...sources, ...state.reads].filter(item => item.name === name);
        function mark(node, indices, item) {
            node.dataset.index = indices.join(',');
            const source = sources.some(ref => matchesReference(ref, name, indices)), target = assignments.some(ref => matchesReference(ref, name, indices));
            node.classList.toggle('is-changed-element', state.changes.some(ref => matchesReference(ref, name, indices)));
            node.classList.toggle('is-referenced', state.reads.some(ref => matchesReference(ref, name, indices)));
            node.classList.toggle('is-assignment-source', source);
            node.classList.toggle('is-assignment-target', target);
            node.setAttribute('aria-label', `${name}[${indices.join(', ')}]：${formatValue(item)}${source ? '（代入元）' : ''}${target ? '（代入先）' : ''}`);
        }
        const indicesFor = (length, capacity, dimension) => full ? Array.from({ length }, (_, i) => i)
            : previewIndices(length, capacity, references.filter(item => item.indices.length > dimension).map(item => item.indices[dimension] - base));
        const omitted = (count) => {
            const node = full ? element('span', 'array-ellipsis', '…') : button('……', () => this.inspect(name), 'array-ellipsis');
            node.setAttribute('aria-label', `${count}要素を省略。${name} の全要素を見る`);
            return node;
        };
        if (isMatrix(value)) {
            const matrix = element('table', 'matrix-value');
            matrix.setAttribute('aria-label', `${name} の二次元配列`);
            const axis = (indices, length) => {
                const result = [];
                let previous = -1;
                for (const index of indices) {
                    if (index > previous + 1)
                        result.push(null);
                    result.push(index);
                    previous = index;
                }
                if (previous < length - 1)
                    result.push(null);
                return result;
            };
            const rows = axis(indicesFor(value.length, full ? value.length : 5, 0), value.length);
            const columns = axis(indicesFor(value[0].length, full ? value[0].length : 7, 1), value[0].length);
            const head = element('thead'), header = element('tr');
            header.append(element('th', 'matrix-axis', '行 / 列'));
            for (const j of columns) {
                const node = element('th', 'matrix-axis', j === null ? '…' : String(j + base));
                node.scope = 'col';
                header.append(node);
            }
            head.append(header);
            matrix.append(head);
            const body = element('tbody');
            for (const i of rows) {
                const row = element('tr');
                if (i === null) {
                    const gap = element('td', 'matrix-axis', '⋮');
                    gap.colSpan = columns.length + 1;
                    row.append(gap);
                    body.append(row);
                    continue;
                }
                const label = element('th', 'matrix-axis', String(i + base));
                label.scope = 'row';
                row.append(label);
                for (const j of columns) {
                    if (j === null) {
                        row.append(element('td', 'matrix-axis', '…'));
                        continue;
                    }
                    const cell = element('td', 'matrix-element', formatValue(value[i][j], full ? Infinity : 32));
                    cell.title = `[${i + base}, ${j + base}] = ${formatValue(value[i][j])}`;
                    mark(cell, [i + base, j + base], value[i][j]);
                    row.append(cell);
                }
                body.append(row);
            }
            matrix.append(body);
            const wrap = element('div', 'matrix-scroll');
            wrap.append(matrix);
            if (!full && (rows.includes(null) || columns.includes(null)))
                wrap.append(element('span', 'subtle-label', `全${value.length}行 × ${value[0].length}列`));
            return wrap;
        }
        const grid = element('div', 'array-value');
        grid.setAttribute('aria-label', `${name} の要素（番号は${base}から）`);
        if (!value.length) {
            grid.textContent = '[]';
            return grid;
        }
        const compact = !full && byId('workspace').parentElement?.classList.contains('fullscreen-workspace');
        grid.classList.toggle('is-compact', !!compact);
        grid.classList.toggle('is-text-array', value.some(item => typeof item === 'string' && item.length >= 3));
        const width = byId('variable-rows').clientWidth;
        const indices = indicesFor(value.length, compact ? Math.floor((width - 36) / 48) : 40, 0);
        let previous = -1;
        for (const i of indices) {
            if (i > previous + 1)
                grid.append(omitted(i - previous - 1));
            const cell = element('div', 'array-element');
            cell.append(element('span', 'element-index', `[${i + base}]`), element('span', 'element-value', formatValue(value[i], full ? Infinity : 80)));
            cell.title = `[${i + base}] = ${formatValue(value[i])}`;
            mark(cell, [i + base], value[i]);
            grid.append(cell);
            previous = i;
        }
        if (previous < value.length - 1)
            grid.append(omitted(value.length - previous - 1));
        grid.style.setProperty('--array-columns', String(Math.max(1, grid.children.length)));
        return grid;
    }
    variables() {
        const root = byId('variable-rows');
        root.replaceChildren();
        const names = this.info?.variableNames ?? [];
        // All rows stay in source order; fullscreen follows the highlighted cells.
        // Omitting arbitrary variables would hide a source needed for its arrow.
        for (const name of names)
            root.append(this.variable(name));
        if (!names.length)
            root.append(element('p', 'variable-summary', 'このプログラムには変数がありません。'));
    }
    output() {
        byId('output-count').textContent = `${this.outputs.length}件`;
        byId('output-placeholder').hidden = !!this.outputs.length;
        byId('output-full').toggleAttribute('disabled', !this.outputs.length);
        const list = byId('output-lines');
        if (this.renderedOutputLength !== this.outputs.length) {
            list.replaceChildren();
            this.outputs.slice(-3).forEach((text, i, rows) => list.append(this.outputLine(text, this.outputs.length - rows.length + i + 1, i === rows.length - 1)));
            this.renderedOutputLength = this.outputs.length;
        }
        if (this.state?.event?.title !== '表示する')
            list.lastElementChild?.classList.remove('is-new');
    }
    outputLine(text, index, latest = false) {
        const row = element('li', `output-line${latest ? ' is-new' : ''}`);
        row.append(element('span', 'output-number', String(index).padStart(2, '0')), element('span', 'output-content', text));
        return row;
    }
    inspect(name, kind = 'variables') {
        if (!this.state || !this.info)
            return;
        this.pause();
        const content = byId('inspect-content');
        content.replaceChildren();
        if (kind === 'output') {
            byId('inspect-heading').textContent = 'すべての出力';
            const list = element('ol', 'output-lines output-lines-full');
            this.outputs.forEach((text, i) => list.append(this.outputLine(text, i + 1)));
            content.append(list);
        }
        else if (kind === 'explanation') {
            byId('inspect-heading').textContent = this.state.event?.title ?? '解説';
            content.append(element('p', 'inspect-explanation', this.state.event?.explanation ?? ''));
        }
        else {
            byId('inspect-heading').textContent = name ? `${name} の値` : 'すべての変数';
            for (const item of name ? [name] : this.info.variableNames)
                content.append(this.variable(item, true));
        }
        byId('inspect-dialog').showModal();
    }
}
