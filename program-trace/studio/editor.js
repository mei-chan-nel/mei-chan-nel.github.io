import { byId, button, element, showFormError, showMessage } from './dom.js?v=20261009-functions';
import { validateDraft } from './documents.js?v=20261009-functions';
import { commandEditor } from './command-editor.js?v=20261009-functions';
import { assertReady, blankRow, builderLines, builderSource, modelFromDraft, newCommand, validateBuilder } from './builder-model.js?v=20261009-functions';
import { tapControls } from './tap-controls.js?v=20261009-functions';
import { colorCode } from './runner-view.js?v=20261009-functions';
import { builderContext } from './builder-variables.js?v=20261009-functions';
import { splitComment } from './lexer.js?v=20261009-functions';
import { dropDestination, moveRow, rowLocations, rowMoveDestination } from './builder-moves.js?v=20261009-functions';
export class ProgramEditor {
    changed;
    title = byId('program-name');
    base = byId('index-base');
    model = { version: 1, nodes: [] };
    specs = {};
    history = [];
    redo = [];
    pending;
    rowDialog = byId('row-dialog');
    dragging;
    drop;
    dropRow;
    suppressRowClick = false;
    editingFunctionId;
    constructor(changed) {
        this.changed = changed;
        this.title.addEventListener('input', changed);
        this.base.addEventListener('change', () => { this.render(); changed(); });
        byId('builder-first-plus').addEventListener('click', () => this.transaction(() => this.model.nodes.unshift(blankRow())));
        byId('builder-undo').addEventListener('click', () => { const previous = this.history.pop(); if (previous) {
            this.redo.push(this.snapshot());
            this.restore(previous);
            this.notify();
        } });
        byId('builder-redo').addEventListener('click', () => { const next = this.redo.pop(); if (next) {
            this.history.push(this.snapshot());
            this.restore(next);
            this.notify();
        } });
        byId('row-form').addEventListener('submit', event => {
            event.preventDefault();
            if (!this.pending?.editor) {
                showFormError(byId('row-form'), 'この行で行う処理を選んでください。');
                return;
            }
            try {
                if (this.pending.editor.choosingLeft()) {
                    this.pending.editor.nextToRight();
                    return;
                }
                const node = this.pending.editor.read();
                const spec = node.kind === 'input' ? this.pending.editor.inputSpec?.() : undefined;
                this.transaction(() => { this.pending.apply(node); if (node.kind === 'input' && spec)
                    this.specs[node.name] = spec; });
                this.rowDialog.close();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : '行の設定を確認してください。';
                if (this.pending)
                    showFormError(byId('row-form'), message);
                else
                    showMessage(message, true);
            }
        });
        this.rowDialog.addEventListener('close', () => { this.pending = undefined; this.render(); });
        // Newly added array cells and nested expression settings get the same tap controls.
        const fields = byId('row-fields');
        new MutationObserver(() => tapControls(fields, this.context().strings)).observe(fields, { childList: true, subtree: true });
        fields.addEventListener('input', () => showFormError(byId('row-form'), ''));
        this.setupDrag();
    }
    validateIncoming(draft) { const checked = validateDraft(draft); modelFromDraft(checked); return checked; }
    set(draft) {
        this.model = modelFromDraft(draft);
        this.ensureBlanks();
        this.title.value = draft.title;
        this.base.value = String(draft.settings.indexBase);
        this.specs = structuredClone(draft.settings.inputs);
        this.history = [];
        this.redo = [];
        this.render();
        byId('editor-error').hidden = true;
    }
    get() {
        let complete = true;
        try {
            assertReady(this.model);
        }
        catch {
            complete = false;
        }
        const inputs = Object.create(null);
        const collect = (items) => { for (const node of items) {
            if (node.kind === 'input' && this.specs[node.name])
                inputs[node.name] = this.specs[node.name];
            if ('body' in node)
                collect(node.body);
            if (node.kind === 'if' && node.otherwise)
                collect([node.otherwise]);
        } };
        collect(this.model.nodes);
        return validateDraft({ version: 1, title: this.title.value, source: builderSource(this.model), settings: { indexBase: Number(this.base.value), inputs }, ...(!complete ? { builder: this.model } : {}) });
    }
    ready() { assertReady(this.model); }
    focus() { byId('builder-programs').querySelector('.builder-code')?.focus({ preventScroll: true }); }
    focusLine(line) {
        const id = builderLines(this.model)[line - 1]?.id;
        if (!id)
            return;
        byId('builder-programs').querySelectorAll('.builder-row').forEach(row => row.classList.toggle('has-error', row.dataset.rowId === id));
        const row = [...byId('builder-programs').querySelectorAll('.builder-row')].find(row => row.dataset.rowId === id);
        row?.querySelector('.builder-code')?.focus();
        row?.scrollIntoView({ block: 'center' });
    }
    ensureBlanks() {
        const visit = (list) => {
            if (!list.length)
                list.push(blankRow());
            for (const node of list) {
                if ('body' in node)
                    visit(node.body);
                if (node.kind === 'if' && node.otherwise)
                    visit([node.otherwise]);
            }
        };
        visit(this.model.nodes);
    }
    snapshot() { return structuredClone({ model: this.model, specs: this.specs }); }
    restore(snapshot) { this.model = snapshot.model; this.specs = snapshot.specs; this.render(); }
    transaction(action) {
        const previous = this.snapshot();
        try {
            action();
            this.ensureBlanks();
            this.model = validateBuilder(this.model);
            this.get();
        }
        catch (error) {
            this.restore(previous);
            if (this.pending) {
                this.pending = undefined;
                this.rowDialog.close();
            }
            throw error;
        }
        this.history.push(previous);
        if (this.history.length > 30)
            this.history.shift();
        this.redo = [];
        this.render();
        this.notify();
    }
    notify() { byId('editor-error').hidden = true; this.changed(); }
    context() { return builderContext(this.model, this.specs, Number(this.base.value), this.editingFunctionId); }
    open(node, placement, branchOwner) {
        const locations = rowLocations(this.model);
        let location = locations.get(node.id);
        while (location?.parent && location.node.kind !== 'define')
            location = locations.get(location.parent.id);
        this.editingFunctionId = location?.node.kind === 'define' ? location.node.id : undefined;
        byId('row-fields').replaceChildren();
        byId('row-actions').replaceChildren();
        showFormError(byId('row-form'), '');
        const apply = (changed) => {
            if (branchOwner) {
                branchOwner.otherwise = changed;
                return;
            }
            const children = !('body' in changed) && 'body' in node ? this.collectChildren(node) : [];
            placement.list.splice(placement.index, 1, changed, ...children);
        };
        this.pending = { apply };
        const configure = (next, fresh, label, replacement = apply, valueFunction) => {
            const editor = commandEditor(next, this.context(), this.specs, fresh, valueFunction);
            this.pending = { editor, apply: replacement };
            byId('row-heading').textContent = label ?? `（${builderLines(this.model).find(row => row.id === node.id)?.line ?? ''}）行を設定する`;
            byId('row-fields').replaceChildren(editor.node);
            showFormError(byId('row-form'), '');
            byId('row-submit').hidden = false;
            editor.onStageChange(() => { byId('row-submit').textContent = editor.choosingLeft() ? '右辺を入力' : 'この行に反映'; showFormError(byId('row-form'), ''); });
            tapControls(editor.node, this.context().strings);
        };
        const categories = () => {
            this.pending = { apply };
            byId('row-heading').textContent = 'この行で何をしますか';
            byId('row-submit').hidden = true;
            const area = element('div', 'command-categories'), choices = element('div', 'command-category-choices');
            const select = (command, valueFunction) => {
                const next = newCommand(command, Number(this.base.value));
                next.id = node.id;
                next.comment = node.comment;
                if ('body' in next && 'body' in node)
                    next.body = next.kind === 'if' && node.kind === 'if' ? structuredClone(node.body) : this.collectChildren(node);
                if (next.kind === 'if' && node.kind === 'if' && node.otherwise)
                    next.otherwise = structuredClone(node.otherwise);
                if (command === 'define') {
                    const names = new Set(this.context().functions?.map(fn => fn.name));
                    let suffix = 1;
                    while (names.has(next.kind === 'define' ? next.name : '')) {
                        if (next.kind === 'define')
                            next.name = `自作関数${suffix++}`;
                    }
                    next.id = newCommand('define').id;
                    configure(next, true, '関数を定義する', changed => this.model.nodes.push(changed));
                    return;
                }
                if (command === 'call' && next.kind === 'call' && valueFunction) {
                    const fn = this.context().functions?.find(fn => fn.name === valueFunction);
                    next.expression = { kind: 'call', name: valueFunction, args: fn?.parameters.map(() => ({ kind: 'literal', value: 0, column: 1 })) ?? [], column: 1 };
                }
                configure(next, true, undefined, apply, valueFunction);
            };
            const showChoices = (title, entries) => {
                choices.replaceChildren(element('h3', '', title));
                const list = element('div', 'category-options');
                for (const entry of entries) {
                    const item = button(entry.text, entry.action, 'category-option');
                    item.disabled = !!entry.disabled;
                    list.append(item);
                }
                choices.append(list);
            };
            const owner = this.branchCandidate(placement);
            area.append(button('変数・配列', () => select('assign'), 'command-category'), button('分岐', () => {
                const branch = (kind) => {
                    if (!owner)
                        return;
                    const next = kind === 'if' ? newCommand('if') : { ...blankRow(), kind: 'else', body: [] };
                    next.id = node.id;
                    configure(next, true, kind === 'if' ? 'そうでなくもし' : 'そうでなければ', changed => {
                        if (node.kind !== 'blank')
                            throw new Error('分岐の追加は空白行から行ってください。');
                        placement.list.splice(placement.index, 1);
                        let tail = owner;
                        while (tail.otherwise?.kind === 'if')
                            tail = tail.otherwise;
                        const rest = tail.otherwise;
                        tail.otherwise = changed;
                        if (kind === 'if' && changed.kind === 'if' && rest)
                            changed.otherwise = rest;
                    });
                };
                let hasElse = false;
                if (owner) {
                    let tail = owner;
                    while (tail.kind === 'if' && tail.otherwise)
                        tail = tail.otherwise;
                    hasElse = tail.kind === 'else';
                }
                showChoices('分岐', [{ text: 'もし … ならば', action: () => select('if'), disabled: !!branchOwner }, { text: 'そうでなくもし … ならば', action: () => branch('if'), disabled: node.kind !== 'blank' || !owner }, { text: 'そうでなければ', action: () => branch('else'), disabled: node.kind !== 'blank' || !owner || hasElse }]);
                if (owner)
                    choices.append(element('p', 'subtle-label', `追加先：${builderLines(this.model).find(row => row.id === owner.id)?.text}`));
            }, 'command-category'), button('繰り返し', () => showChoices('繰り返し', [{ text: '範囲を決めて繰り返す', action: () => select('for'), disabled: !!branchOwner }, { text: '条件を満たす間繰り返す', action: () => select('while'), disabled: !!branchOwner }]), 'command-category'), button('関数', () => showChoices('関数', [
                { text: '関数を定義する', action: () => select('define'), disabled: !!branchOwner },
                { text: '表示する()', action: () => select('print'), disabled: !!branchOwner },
                { text: '要素数() の結果を変数に入れる', action: () => select('assign', '要素数'), disabled: !!branchOwner },
                { text: '乱数() の結果を変数に入れる', action: () => select('assign', '乱数'), disabled: !!branchOwner },
                ...(!this.editingFunctionId ? [] : [{ text: '値を返す', action: () => select('return'), disabled: !!branchOwner }]),
                ...(this.context().functions ?? []).flatMap(fn => [
                    { text: `${fn.name}() の結果を変数に入れる`, action: () => select('assign', fn.name), disabled: !!branchOwner },
                    { text: `${fn.name}() を呼び出す`, action: () => select('call', fn.name), disabled: !!branchOwner },
                ]),
            ]), 'command-category'));
            if (branchOwner) {
                const first = area.querySelector('button');
                first.disabled = true;
            }
            byId('row-fields').replaceChildren(area, choices);
        };
        if (node.kind === 'blank')
            categories();
        else
            configure(structuredClone(node), false);
        const actions = byId('row-actions');
        for (const [action, label] of [['up', '1行上に'], ['down', '1行下に'], ['inner', 'ひとつ内側へ'], ['outer', 'ひとつ外側へ']]) {
            const control = button(label, () => {
                const destination = rowMoveDestination(this.model, node.id, action);
                if (!destination)
                    return;
                this.rowDialog.close();
                this.transaction(() => { this.model = moveRow(this.model, node.id, destination); });
            }, 'text-button row-move-button');
            control.disabled = !!branchOwner || !rowMoveDestination(this.model, node.id, action);
            actions.append(control);
        }
        actions.append(button('削除', () => { this.rowDialog.close(); this.remove(node, placement, branchOwner); }, 'text-button delete-row-button'));
        this.rowDialog.showModal();
    }
    branchCandidate(placement) {
        const previous = placement.list[placement.index - 1];
        if (previous?.kind === 'if')
            return previous;
        return placement.owner?.kind === 'if' ? placement.owner : undefined;
    }
    collectChildren(node) { const items = 'body' in node ? [...node.body] : []; if (node.kind === 'if' && node.otherwise)
        items.push(...this.collectChildren(node.otherwise)); return items; }
    remove(node, placement, branchOwner) {
        this.transaction(() => {
            if (branchOwner) {
                if (node.kind === 'if' && node.otherwise)
                    branchOwner.otherwise = node.otherwise;
                else
                    delete branchOwner.otherwise;
            }
            else
                placement.list.splice(placement.index, 1);
        });
    }
    render() {
        let container = byId('builder-rows');
        container.replaceChildren();
        const blocks = byId('builder-function-blocks');
        blocks.replaceChildren();
        const lines = builderLines(this.model), byRow = new Map(lines.map(row => [row.id, row]));
        const renderRow = (node, placement, branchOwner) => {
            const line = byRow.get(node.id), row = element('li', 'program-line builder-row');
            row.dataset.rowId = node.id;
            row.dataset.line = String(line.line);
            row.classList.toggle('is-blank', node.kind === 'blank');
            row.dataset.depth = String(line.depth);
            row.draggable = !branchOwner;
            const handle = element('span', 'line-number builder-drag-handle', `（${line.line}）`);
            handle.title = branchOwner ? '分岐は「もし」の行と一緒に移動します' : 'ドラッグして移動（横に動かすと内側・外側へ）';
            handle.setAttribute('aria-hidden', 'true');
            if (!branchOwner)
                this.pointerDrag(handle, node.id);
            row.append(handle);
            const code = button('', () => { if (!this.suppressRowClick)
                this.open(node, placement, branchOwner); }, 'builder-code');
            code.setAttribute('aria-label', `${line.line}行目${node.kind === 'blank' ? 'の処理を選ぶ' : 'を編集'}`);
            if (!branchOwner)
                this.pointerDrag(code, node.id, false);
            if (line.markers)
                code.append(element('span', 'branch-prefix', line.markers + ' '));
            if (node.kind === 'blank')
                code.append(element('span', 'blank-line-label', 'タップして処理を選ぶ'));
            else {
                const source = splitComment(line.text), text = colorCode(source.code.trimEnd());
                if (source.comment)
                    text.append(element('span', 'source-comment', ` ${source.comment}`));
                code.append(text);
            }
            row.append(code);
            const add = button('＋', () => this.transaction(() => { if ('body' in node)
                node.body.unshift(blankRow());
            else
                placement.list.splice(placement.index + 1, 0, blankRow()); }), 'builder-plus');
            add.setAttribute('aria-label', `${line.line}行目の下に行を追加`);
            row.append(add);
            container.append(row);
            if ('body' in node)
                renderList(node.body, placement.depth + 1, placement, node);
            if (node.kind === 'if' && node.otherwise)
                renderRow(node.otherwise, placement, node);
        };
        const renderList = (items, depth, outer, owner) => items.forEach((node, index) => renderRow(node, { list: items, index, depth, outer, owner }));
        this.model.nodes.forEach((node, index) => {
            if (node.kind === 'define') {
                const block = element('section', 'builder-function-block panel'), heading = element('div', 'panel-heading');
                heading.append(element('h2', '', `関数：${node.name}`));
                block.append(heading);
                container = element('ol', 'program-lines builder-rows');
                container.setAttribute('aria-label', `${node.name} のプログラム`);
                block.append(container);
                blocks.append(block);
            }
            else
                container = byId('builder-rows');
            renderRow(node, { list: this.model.nodes, index, depth: 0 });
        });
        byId('builder-source').textContent = lines.map(line => `（${line.line}）${line.markers ? line.markers + ' ' : ''}${line.text}`).join('\n');
        byId('source-size').textContent = `${lines.length}行`;
        byId('builder-undo').disabled = !this.history.length;
        byId('builder-redo').disabled = !this.redo.length;
    }
    pointerDrag(control, id, touch = true) {
        control.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0 || !touch && event.pointerType !== 'mouse')
                return;
            event.preventDefault();
            control.setPointerCapture(event.pointerId);
            this.beginDrag(id, event.clientX, event.pointerId, event.clientY);
        });
        control.addEventListener('pointermove', event => {
            if (this.dragging?.pointer !== event.pointerId)
                return;
            event.preventDefault();
            if (Math.hypot(event.clientX - this.dragging.x, event.clientY - (this.dragging.y ?? event.clientY)) < 5 && !this.dragging.moved)
                return;
            this.dragging.moved = true;
            this.updateDrop(event.clientX, event.clientY);
            const edge = event.clientY < 80 ? -16 : event.clientY > innerHeight - 80 ? 16 : 0;
            if (edge)
                window.scrollBy(0, edge);
        });
        control.addEventListener('pointerup', event => {
            if (this.dragging?.pointer !== event.pointerId)
                return;
            event.preventDefault();
            if (this.dragging.moved) {
                this.suppressRowClick = true;
                window.setTimeout(() => { this.suppressRowClick = false; }, 0);
            }
            this.finishDrag();
        });
        control.addEventListener('pointercancel', () => this.clearDrag());
    }
    beginDrag(id, x, pointer, y) {
        const row = rowLocations(this.model).get(id);
        if (!row?.list || row.branchOwner)
            return;
        this.clearDrag();
        this.dragging = { id, x, y, depth: row.depth, pointer, moved: false };
        [...byId('builder-programs').querySelectorAll('.builder-row')].find(row => row.dataset.rowId === id)?.classList.add('is-dragging');
    }
    updateDrop(x, y) {
        if (!this.dragging)
            return;
        this.dropRow?.classList.remove('drop-before', 'drop-after');
        this.dropRow = undefined;
        this.drop = undefined;
        const bounds = byId('builder-programs').getBoundingClientRect();
        const probeX = Math.max(bounds.left + 45, Math.min(bounds.right - 50, x));
        const hovered = document.elementFromPoint(probeX, y)?.closest('.builder-row');
        if (!hovered || !byId('builder-programs').contains(hovered)) {
            byId('drag-status').textContent = '';
            return;
        }
        const box = hovered.getBoundingClientRect(), edge = y < box.top + box.height / 2 ? 'before' : 'after';
        const requested = x < bounds.left ? 0 : Math.max(0, this.dragging.depth + Math.round((x - this.dragging.x) / 24));
        const destination = dropDestination(this.model, this.dragging.id, hovered.dataset.rowId, edge, requested);
        if (!destination) {
            byId('drag-status').textContent = 'この場所には移せません';
            return;
        }
        this.drop = destination;
        this.dropRow = hovered;
        hovered.classList.add(`drop-${edge}`);
        hovered.style.setProperty('--drop-depth', String(destination.depth));
        byId('drag-status').textContent = `移動先：${hovered.dataset.line}行目の${edge === 'before' ? '上' : '下'}・${destination.depth === 0 ? 'いちばん外側' : `内側 ${destination.depth} 段`}`;
    }
    finishDrag() {
        const source = this.dragging, destination = this.drop;
        this.clearDrag();
        if (!source?.moved || !destination)
            return;
        try {
            this.transaction(() => { this.model = moveRow(this.model, source.id, destination); });
            byId('drag-status').textContent = '行を移動しました';
        }
        catch (error) {
            showMessage(error instanceof Error ? error.message : '行を移せませんでした。', true);
        }
    }
    clearDrag() {
        this.dragging = undefined;
        this.drop = undefined;
        this.dropRow = undefined;
        byId('builder-programs').querySelectorAll('.is-dragging, .drop-before, .drop-after').forEach(row => row.classList.remove('is-dragging', 'drop-before', 'drop-after'));
        byId('drag-status').textContent = '';
    }
    setupDrag() {
        const rows = byId('builder-rows');
        rows.addEventListener('dragstart', event => {
            const row = event.target.closest('.builder-row');
            if (!row || event.target.closest('.builder-plus')) {
                event.preventDefault();
                return;
            }
            this.beginDrag(row.dataset.rowId, event.clientX);
            if (!this.dragging) {
                event.preventDefault();
                return;
            }
            event.dataTransfer?.setData('text/plain', this.dragging.id);
            if (event.dataTransfer)
                event.dataTransfer.effectAllowed = 'move';
        });
        rows.addEventListener('dragover', event => {
            if (!this.dragging)
                return;
            event.preventDefault();
            this.dragging.moved = true;
            this.updateDrop(event.clientX, event.clientY);
            if (event.dataTransfer)
                event.dataTransfer.dropEffect = this.drop ? 'move' : 'none';
        });
        rows.addEventListener('drop', event => { if (!this.dragging)
            return; event.preventDefault(); this.updateDrop(event.clientX, event.clientY); this.finishDrag(); });
        rows.addEventListener('dragend', () => this.clearDrag());
    }
}
