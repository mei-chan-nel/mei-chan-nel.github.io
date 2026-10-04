import { element, button } from './dom.js';
import { numeric } from './values.js';
import { LIMITS } from './errors.js';
const phrases = ['合計は', '平均点は', '現在の値は', '現在の合計は', '最終的な合計は', 'です。', '点です。', '成人です。', '未成年です。', '見つかりました。', '見つかりませんでした。', 'はい', 'いいえ', '終了', '整数', '実数'];
let dialog, serial = 0;
export function openTapPad(initial, label, kind, apply, suggestions = []) {
    if (!dialog) {
        dialog = element('dialog', 'tap-dialog');
        dialog.setAttribute('aria-label', '画面上の入力');
        document.body.append(dialog);
    }
    const root = element('div', 'tap-dialog-content'), heading = element('div', 'dialog-heading');
    heading.append(element('h2', '', label), button('×', () => dialog.close(), 'close-button'));
    heading.lastElementChild.setAttribute('aria-label', '入力を閉じる');
    root.append(heading);
    let characters = Array.from(initial), cursor = characters.length, replace = kind === 'number';
    const display = element('div', 'tap-pad-display');
    display.setAttribute('role', 'status');
    const error = element('p', 'form-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const refresh = () => { display.textContent = [...characters.slice(0, cursor), '│', ...characters.slice(cursor)].join('') || '│'; };
    const insert = (value) => { const additions = Array.from(value); if (characters.length + additions.length > LIMITS.string)
        return; characters.splice(cursor, 0, ...additions); cursor += additions.length; refresh(); };
    const edits = element('div', 'tap-edit-tools');
    edits.append(button('←', () => { replace = false; cursor = Math.max(0, cursor - 1); refresh(); }, 'tap-key'), button('→', () => { replace = false; cursor = Math.min(characters.length, cursor + 1); refresh(); }, 'tap-key'), button('1文字消す', () => { replace = false; if (cursor)
        characters.splice(--cursor, 1); refresh(); }, 'tap-key'), button('すべて消す', () => { replace = false; characters = []; cursor = 0; refresh(); }, 'tap-key'));
    root.append(display, edits);
    const keys = element('div', kind === 'number' ? 'number-pad' : 'text-pad');
    if (kind === 'number') {
        for (const value of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '±', '0', '.', 'e', '＋', '−']) {
            const key = button(value, () => {
                if (replace && /^[0-9.]$/u.test(value)) {
                    characters = [];
                    cursor = 0;
                }
                replace = false;
                if (value === '±') {
                    if (characters[0] === '-') {
                        characters.shift();
                        cursor = Math.max(0, cursor - 1);
                    }
                    else {
                        characters.unshift('-');
                        cursor++;
                    }
                    refresh();
                }
                else
                    insert(value === '＋' ? '+' : value === '−' ? '-' : value);
            }, 'tap-key');
            key.setAttribute('aria-label', /^[0-9]$/u.test(value) ? `数字 ${value}` : value === '±' ? '正負を切り替える' : value === '.' ? '小数点' : value === 'e' ? '指数' : value === '−' ? '指数のマイナス' : '指数のプラス');
            keys.append(key);
        }
        const quick = element('div', 'tap-choices');
        for (const value of ['0', '1', '2', '3', '5', '10', '18', '20', '100', '1000'])
            quick.append(button(value, () => { characters = Array.from(value); cursor = characters.length; replace = false; refresh(); }, 'tap-chip'));
        root.append(quick, keys);
    }
    else {
        const modes = element('div', 'tap-choices');
        let upper = false;
        const layouts = { 'ひらがな': 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんぁぃぅぇぉっゃゅょ', 'カタカナ': 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョ', '英数字': 'abcdefghijklmnopqrstuvwxyz0123456789', '記号': '。、！？：；,.!?+-*/%=<>()[ ]_#\"\'\\\n' };
        const render = (mode) => {
            keys.replaceChildren();
            keys.classList.toggle('phrase-pad', mode === '定型文');
            if (mode === '定型文')
                for (const phrase of [...new Set([...suggestions, ...phrases])].filter(Boolean))
                    keys.append(button(phrase, () => insert(phrase), 'tap-chip'));
            else
                for (const char of Array.from(mode === '英数字' && upper ? layouts[mode].toUpperCase() : layouts[mode]))
                    keys.append(button(char === '\n' ? '改行' : char === ' ' ? '空白' : char, () => insert(char), 'tap-key'));
            for (const choice of modes.querySelectorAll('button'))
                choice.setAttribute('aria-pressed', String(choice.textContent === mode));
        };
        for (const mode of ['定型文', ...Object.keys(layouts)])
            modes.append(button(mode, () => render(mode), 'tap-chip'));
        const extras = element('div', 'tap-choices');
        extras.append(button('空白', () => insert(' '), 'tap-chip'), button('大文字／小文字', () => { upper = !upper; render('英数字'); }, 'tap-chip'), button('゛／゜', () => {
            if (!cursor)
                return;
            const char = characters[cursor - 1], base = char.normalize('NFD')[0];
            const marked = base + (char.includes('\u3099') || char.normalize('NFD').includes('\u3099') ? '\u309a' : '\u3099');
            characters[cursor - 1] = marked.normalize('NFC');
            refresh();
        }, 'tap-chip'), button('貼り付け', async () => { try {
            insert(await navigator.clipboard.readText());
        }
        catch {
            error.textContent = '貼り付けを利用できません。画面上の文字を選んで入力してください。';
            error.hidden = false;
        } }, 'tap-chip'));
        root.append(modes, keys, extras);
        render('定型文');
    }
    const actions = element('div', 'dialog-actions');
    actions.append(button('キャンセル', () => dialog.close()), button('この値を使う', () => {
        try {
            const value = characters.join('');
            if (kind === 'number') {
                if (!value.trim())
                    throw new Error('数値を指定してください。');
                numeric(Number(value));
            }
            apply(value);
            dialog.close();
        }
        catch (cause) {
            error.textContent = cause instanceof Error ? cause.message : '値を確認してください。';
            error.hidden = false;
        }
    }, 'button button-primary'));
    root.append(error, actions);
    dialog.replaceChildren(root);
    refresh();
    dialog.showModal();
}
export function tapInput(input, label, suggestions = []) {
    if (input.dataset.tapInput || input.dataset.newName || !['number', 'text'].includes(input.type))
        return;
    input.dataset.tapInput = 'true';
    const open = () => openTapPad(input.value, label, input.type === 'number' ? 'number' : 'text', value => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, suggestions);
    const edit = button('入力補助', open, 'tap-input-button');
    edit.setAttribute('aria-label', `${label}を画面上で入力`);
    input.after(edit);
}
export function tapControls(container, suggestions = []) {
    for (const input of container.querySelectorAll('input')) {
        const label = input.id ? container.querySelector(`label[for="${input.id}"]`)?.textContent ?? '値' : '値';
        tapInput(input, label, suggestions);
    }
    for (const select of container.querySelectorAll('select')) {
        if (select.dataset.tapChoices)
            continue;
        select.dataset.tapChoices = 'true';
        select.hidden = true;
        const label = container.querySelector(`label[for="${select.id}"]`), title = label?.textContent ?? '選択';
        if (label)
            label.hidden = true;
        const choices = element('fieldset', 'tap-radio-choices');
        choices.append(element('legend', '', title));
        const name = `tap-choice-${++serial}`;
        for (const option of select.options) {
            const caption = element('label', 'tap-radio'), input = element('input');
            input.type = 'radio';
            input.name = name;
            input.value = option.value;
            input.checked = select.value === option.value;
            input.disabled = option.disabled;
            input.addEventListener('change', () => { select.value = input.value; select.dispatchEvent(new Event('change', { bubbles: true })); });
            caption.append(input, element('span', '', option.text));
            choices.append(caption);
        }
        select.addEventListener('change', () => choices.querySelectorAll('input').forEach(input => { input.checked = input.value === select.value; }));
        select.after(choices);
    }
}
