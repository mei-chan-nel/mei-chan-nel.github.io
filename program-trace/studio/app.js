import { ProgramEditor } from './editor.js';
import { RunnerView } from './runner-view.js';
import { createFullscreen } from './fullscreen.js';
import { ProgramStorage } from './storage.js';
import { documentJSON, parseDocument, validateInput } from './documents.js';
import { encodeShare, decodeShare } from './sharing.js';
import { replaceInitialValues } from './edit-values.js';
import { valueEditor, inputInitial } from './value-editor.js';
import { LIMITS, diagnostic, StudioError } from './errors.js';
import { draftFingerprint, emptyDraft, exportFilename } from './document-actions.js';
import { tapControls } from './tap-controls.js';
import { byId, element, button, showMessage, showFormError, download, setupDialogs, diagnosticText } from './dom.js';
let worker, generation = 0, busy = false, preparing = false, watchdog = 0;
let info, state, activeDraft = emptyDraft();
let storage, savedId, storageError = '';
let running = false, paused = false, timer = 0, speed = 0.5, autosaveTimer = 0, runnerVisible = false;
let inputRequest, inputField, resumeAfterInput = false;
let sharedSource = false, pendingLoad;
let shareGeneration = 0;
let recoveryDraft;
let savedFingerprint, saveBeforeNew = false;
let pendingExport;
function protectSharedPage() {
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical)
        canonical.href = 'https://mei-chan-nel.com/program-trace/studio/share.html';
}
// New shares use a statically noindex entry. Protect old editor#v1 links too.
if (document.body.dataset.studioEntry === 'shared' || /^#v\d/u.test(location.hash))
    protectSharedPage();
const view = new RunnerView(pause);
const fullscreen = createFullscreen({
    runner: byId('runner-view'), surface: byId('fullscreen-surface'), mount: byId('fullscreen-workspace'), entryButton: byId('fullscreen-button'),
    controls: { next: byId('next-button'), reset: byId('reset-button'), edit: byId('edit-values-button'), play: byId('play-button'), speed: byId('speed-button') },
    speedPanel: byId('speed-panel'), closeSpeed: closeSpeedPanel, onLayout: () => view.layout(),
});
const editor = new ProgramEditor(edited);
setupDialogs();
for (const id of ['value-fields', 'input-fields']) {
    const container = byId(id);
    new MutationObserver(() => tapControls(container)).observe(container, { childList: true, subtree: true });
}
const form = (id) => byId(id);
const dialog = (id) => byId(id);
function errorMessage(error) { return error instanceof Error ? error.message : '操作できませんでした。'; }
function guarded(action) { try {
    action();
}
catch (error) {
    showMessage(errorMessage(error), true);
} }
function clearShareLocation() {
    if (document.body.dataset.studioEntry !== 'shared' && !/^#v\d/u.test(location.hash))
        return;
    history.replaceState(null, '', new URL('./', location.href).pathname + location.search);
    document.body.dataset.studioEntry = 'editor';
}
function edited() {
    sharedSource = false;
    clearShareLocation();
    byId('recover-draft').hidden = true;
    recoveryDraft = undefined;
    window.clearTimeout(autosaveTimer);
    byId('draft-status').textContent = '編集しています…';
    autosaveTimer = window.setTimeout(autosave, 700);
}
function autosave() {
    window.clearTimeout(autosaveTimer);
    if (sharedSource)
        return;
    try {
        const draft = editor.get();
        if (!storage) {
            byId('draft-status').textContent = '下書きの自動保存は利用できません';
            return;
        }
        storage.saveDraft(draft);
        byId('draft-status').textContent = '下書きを自動保存しました';
    }
    catch (error) {
        byId('draft-status').textContent = '下書きを保存できません';
        byId('draft-status').title = errorMessage(error);
    }
}
function currentDraft() { return editor.get(); }
function saveFile() {
    const draft = currentDraft();
    openExport(draft);
}
function openExport(draft, recovering = false) {
    pause();
    pendingExport = { text: documentJSON(draft), ...(recovering ? {} : { fingerprint: draftFingerprint(draft) }) };
    byId('export-name').value = exportFilename(draft.title);
    showFormError(form('export-form'), '');
    dialog('export-dialog').showModal();
}
form('export-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!pendingExport)
        return;
    try {
        const name = exportFilename(byId('export-name').value);
        byId('export-name').value = name;
        // Keep the download link inside the active modal; links in the inert page
        // beneath a modal cannot be activated in some browsers.
        download(pendingExport.text, name, dialog('export-dialog'));
        if (pendingExport.fingerprint === draftFingerprint(currentDraft()))
            savedFingerprint = pendingExport.fingerprint;
        dialog('export-dialog').close();
        showMessage(`「${name}」を書き出しました。`);
    }
    catch (error) {
        showFormError(form('export-form'), errorMessage(error));
    }
});
dialog('export-dialog').addEventListener('close', () => { pendingExport = undefined; });
function createNew() {
    pause();
    showEditor();
    editor.set(emptyDraft(Number(editor.base.value)));
    savedId = undefined;
    sharedSource = false;
    clearShareLocation();
    savedFingerprint = draftFingerprint(currentDraft());
    recoveryDraft = undefined;
    byId('recover-draft').hidden = true;
    info = undefined;
    state = undefined;
    worker?.terminate();
    worker = undefined;
    busy = preparing = false;
    window.clearTimeout(watchdog);
    autosave();
    controls();
    showMessage('新しいプログラムを作成しました。');
}
byId('new-program').addEventListener('click', () => guarded(() => {
    pause();
    if (draftFingerprint(currentDraft()) === savedFingerprint) {
        createNew();
        return;
    }
    showFormError(dialog('new-dialog'), '');
    dialog('new-dialog').showModal();
}));
byId('new-discard').addEventListener('click', () => { dialog('new-dialog').close(); createNew(); });
byId('new-save').addEventListener('click', () => {
    try {
        if (!storage)
            throw new StudioError(storageError || 'ブラウザ内に保存できません。キャンセルして「ファイルに書出」を使ってください。');
        dialog('new-dialog').close();
        openSave(true);
    }
    catch (error) {
        showFormError(dialog('new-dialog'), errorMessage(error));
    }
});
function controls() {
    const ended = !!state?.completed, finalDismissed = ended && state?.currentLine === null;
    byId('next-button').disabled = busy || !state || finalDismissed || !!state.error || running || !!inputRequest;
    byId('play-button').disabled = (!state || ended && !state.steps || !!state.error || busy || !!inputRequest) && !running;
    byId('reset-button').disabled = !state || preparing;
    byId('edit-values-button').disabled = busy || !info?.editable.length;
    byId('prepare-button').disabled = preparing;
    byId('play-label').textContent = running ? '一時停止' : '自動実行';
    byId('play-icon').textContent = running ? 'Ⅱ' : '▶';
    byId('play-button').classList.toggle('is-running', running);
    byId('play-button').setAttribute('aria-pressed', String(running));
    byId('play-button').title = running ? `${speed}秒ごとに実行中。クリックすると一時停止します。` : `${speed}秒ごとに1ステップ実行します。${ended ? '最初から再実行します。' : ''}`;
    byId('speed-button').title = `1ステップ${speed}秒。クリックで実行速度を調整します。`;
    byId('speed-decrease').disabled = speed <= 0.001;
    byId('speed-increase').disabled = speed >= 10;
    fullscreen.sync();
}
function renderView(append = [], reset = false) {
    if (state && runnerVisible)
        view.render(state, append, reset, running, speed, { paused, input: inputRequest });
    fullscreen.sync();
}
function pause() { if (running)
    paused = true; running = false; window.clearTimeout(timer); controls(); renderView(); }
function schedule() { window.clearTimeout(timer); if (running && !busy && !state?.completed && !state?.error)
    timer = window.setTimeout(next, speed * 1000); }
function createWorker() {
    if (typeof Worker !== 'function')
        throw new StudioError('このブラウザでは実行機能を利用できません。新しいブラウザで開いてください。');
    worker?.terminate();
    const nextWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    nextWorker.addEventListener('message', (event) => receive(event.data));
    nextWorker.addEventListener('error', () => failWorker('実行処理を読み込めませんでした。ページを再読み込みしてください。'));
    worker = nextWorker;
    return nextWorker;
}
function send(action, input) {
    if (!worker)
        return;
    busy = true;
    controls();
    window.clearTimeout(watchdog);
    watchdog = window.setTimeout(() => failWorker('実行に時間がかかりすぎたため停止しました。プログラムを編集するか、最初から実行してください。'), 5000);
    worker.postMessage({ generation, action, ...(action === 'prepare' ? { draft: activeDraft } : {}), ...(input !== undefined ? { input } : {}) });
}
function failWorker(message) {
    worker?.terminate();
    worker = undefined;
    busy = preparing = false;
    window.clearTimeout(watchdog);
    pause();
    if (state) {
        state = { ...state, error: { message, line: state.currentLine ?? 1, column: 1 } };
        view.render(state);
    }
    showMessage(message, true);
    controls();
}
function prepare(fromShare = false) {
    pause();
    paused = false;
    closeSpeedPanel();
    showMessage('');
    byId('editor-error').hidden = true;
    try {
        editor.ready();
        activeDraft = currentDraft();
        generation++;
        preparing = true;
        state = undefined;
        createWorker();
        send('prepare');
        if (fromShare)
            sharedSource = true;
    }
    catch (error) {
        preparing = busy = false;
        const detail = diagnostic(error);
        byId('editor-error').textContent = diagnosticText(detail);
        byId('editor-error').hidden = false;
        editor.focusLine(detail.line);
        controls();
    }
}
function showRunner() {
    runnerVisible = true;
    byId('editor-view').hidden = true;
    byId('runner-view').hidden = false;
    byId('to-editor').hidden = false;
    byId('runner-document-tools').append(byId('document-tools'));
    document.body.classList.add('is-tracing');
    byId('studio-title').textContent = activeDraft.title;
    byId('studio-title').focus({ preventScroll: true });
}
function showEditor() {
    fullscreen.leave({ restoreHistory: false });
    closeSpeedPanel();
    pause();
    worker?.terminate();
    worker = undefined;
    generation++;
    busy = preparing = false;
    window.clearTimeout(watchdog);
    runnerVisible = false;
    byId('editor-view').hidden = false;
    byId('runner-view').hidden = true;
    byId('to-editor').hidden = true;
    byId('editor-document-tools').append(byId('document-tools'));
    document.body.classList.remove('is-tracing');
    byId('studio-title').replaceChildren(document.createTextNode('プログラムを、'), element('em', '', '書いて動かす。'));
    controls();
    editor.focus();
}
function next() { if (busy || !state || state.error || inputRequest || state.completed && state.currentLine === null)
    return; paused = false; send('step'); }
function receive(message) {
    if (message.generation !== generation)
        return;
    window.clearTimeout(watchdog);
    busy = false;
    if (message.kind === 'error') {
        const error = message.error ?? { message: '実行できませんでした。', line: 1, column: 1 };
        pause();
        if (preparing) {
            preparing = false;
            showEditor();
            byId('editor-error').textContent = diagnosticText(error);
            byId('editor-error').hidden = false;
            editor.focusLine(error.line);
        }
        else {
            if (message.state)
                state = { ...message.state, error };
            if (state)
                view.render(state);
            byId('run-error').textContent = diagnosticText(error);
            byId('run-error').hidden = false;
        }
        controls();
        return;
    }
    const prepared = preparing;
    if (message.info)
        info = message.info;
    if (message.state)
        state = message.state;
    if (preparing) {
        preparing = false;
        if (!info || !state)
            return;
        view.prepare(info, activeDraft);
        showRunner();
    }
    if (message.kind === 'ready')
        byId('run-error').hidden = true;
    if (state?.completed) {
        running = false;
        paused = false;
        window.clearTimeout(timer);
    }
    renderView(message.outputAppend ?? [], message.kind === 'ready');
    controls();
    if (message.request) {
        openInput(message.request);
        return;
    }
    if (prepared && sharedSource)
        showMessage('共有されたプログラムです。「次へ」で実行できます。');
    if (state && !running && !message.request)
        byId('execution-announcement').textContent = `${state.currentLine === null ? '実行前' : `${state.currentLine}行目を実行`}${state.completed ? '。実行が終わりました。' : ''}`;
    // Restarting autoplay after completion first resets the Worker, then steps.
    if (message.kind === 'ready' && running && !state?.completed) {
        next();
        return;
    }
    schedule();
}
byId('prepare-button').addEventListener('click', () => prepare());
byId('to-editor').addEventListener('click', () => showEditor());
byId('next-button').addEventListener('click', next);
byId('reset-button').addEventListener('click', () => { pause(); paused = false; closeSpeedPanel(); byId('run-error').hidden = true; if (worker)
    send('reset');
else
    prepare(); });
byId('play-button').addEventListener('click', () => {
    if (running) {
        pause();
        return;
    }
    if (!state || state.error || busy || inputRequest || state.completed && !state.steps)
        return;
    running = true;
    paused = false;
    controls();
    renderView();
    if (state.completed)
        send('reset');
    else
        next();
});
document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey || !runnerVisible || document.querySelector('dialog[open]'))
        return;
    const target = event.target;
    if (target.closest('button, input, textarea, select, a, [contenteditable]'))
        return;
    event.preventDefault();
    if (!running)
        next();
});
function closeSpeedPanel() {
    byId('speed-panel').hidden = true;
    byId('speed-button').setAttribute('aria-expanded', 'false');
    byId('speed-input').value = String(speed);
    byId('speed-error').hidden = true;
    byId('speed-input').removeAttribute('aria-invalid');
}
byId('speed-button').addEventListener('click', () => {
    const panel = byId('speed-panel');
    if (!panel.hidden)
        closeSpeedPanel();
    else {
        panel.hidden = false;
        byId('speed-button').setAttribute('aria-expanded', 'true');
    }
    // Keep mobile keyboards closed until the learner taps the input explicitly.
    fullscreen.sync();
});
function setSpeed(value) {
    const error = byId('speed-error');
    if (!Number.isFinite(value) || value < 0.001 || value > 10) {
        error.textContent = '0.001～10秒で指定してください。';
        error.hidden = false;
        byId('speed-input').setAttribute('aria-invalid', 'true');
        return;
    }
    speed = Math.round(value * 1000) / 1000;
    byId('speed-input').value = String(speed);
    byId('speed-value').textContent = `${speed}秒`;
    error.hidden = true;
    byId('speed-input').removeAttribute('aria-invalid');
    controls();
    schedule();
    renderView();
}
byId('speed-decrease').addEventListener('click', () => setSpeed(speed > 0.1 ? Math.max(0.1, speed - 0.1) : speed > 0.01 ? 0.01 : 0.001));
byId('speed-increase').addEventListener('click', () => setSpeed(speed < 0.01 ? 0.01 : speed < 0.1 ? 0.1 : Math.min(10, speed + 0.1)));
byId('speed-input').addEventListener('input', () => setSpeed(Number(byId('speed-input').value)));
byId('speed-input').addEventListener('change', () => setSpeed(Number(byId('speed-input').value)));
document.addEventListener('click', event => {
    if (!event.target.closest('.speed-control') && !fullscreen.containsSpeedControl(event.target)) {
        closeSpeedPanel();
        fullscreen.sync();
    }
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !byId('speed-panel').hidden) {
        event.preventDefault();
        closeSpeedPanel();
        fullscreen.sync();
        fullscreen.control('speed').focus();
    }
});
document.addEventListener('visibilitychange', () => { if (document.hidden)
    pause(); });
window.addEventListener('pagehide', pause);
window.addEventListener('resize', () => { if (!fullscreen.active)
    view.layout(); });
byId('variables-full').addEventListener('click', event => { event.stopPropagation(); pause(); view.inspect(); });
byId('output-full').addEventListener('click', event => { event.stopPropagation(); pause(); view.inspect(undefined, 'output'); });
byId('explanation-full').addEventListener('click', event => { event.stopPropagation(); pause(); view.inspect(undefined, 'explanation'); });
let valueFields = new Map();
byId('edit-values-button').addEventListener('click', () => guarded(() => {
    pause();
    valueFields.clear();
    const container = byId('value-fields');
    container.replaceChildren();
    for (const item of info?.editable ?? []) {
        const field = valueEditor(item.value, item.label, { base: activeDraft.settings.indexBase });
        valueFields.set(item.key, field);
        container.append(field.node);
    }
    showFormError(form('values-form'), '');
    dialog('values-dialog').showModal();
}));
form('values-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
        const values = {};
        for (const [key, field] of valueFields)
            values[key] = field.read();
        const draft = currentDraft();
        draft.source = replaceInitialValues(draft.source, values);
        delete draft.builder;
        editor.set(draft);
        sharedSource = false;
        clearShareLocation();
        autosave();
        dialog('values-dialog').close();
        prepare();
    }
    catch (error) {
        showFormError(form('values-form'), errorMessage(error));
    }
});
function openInput(request) {
    resumeAfterInput = running;
    inputRequest = request;
    pause();
    const spec = request.spec;
    inputField = valueEditor(inputInitial(spec), request.name, { base: activeDraft.settings.indexBase, spec, dimensions: spec.kind === 'array' });
    byId('input-fields').replaceChildren(inputField.node);
    byId('input-description').textContent = `${request.line}行目：${request.name} に入れる${{ number: '数値', text: '文字列', array: '配列', matrix: '二次元配列' }[spec.kind]}を入力してください。${spec.kind === 'number' || spec.elementKind === 'number' && spec.kind !== 'text' ? ` ${spec.min}～${spec.max}の${spec.integer ? '整数' : '数値'}。` : ''}${spec.kind === 'array' ? ` 要素数：${spec.minLength}～${spec.maxLength}個。` : ''}`;
    showFormError(form('input-form'), '');
    dialog('input-dialog').showModal();
    byId('input-heading').focus({ preventScroll: true });
}
form('input-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!inputField || !inputRequest)
        return;
    try {
        const value = validateInput(inputField.read(), inputRequest.spec);
        const resume = resumeAfterInput;
        resumeAfterInput = false;
        inputRequest = undefined;
        dialog('input-dialog').close();
        running = resume;
        send('step', value);
    }
    catch (error) {
        showFormError(form('input-form'), errorMessage(error));
    }
});
dialog('input-dialog').addEventListener('close', () => {
    const cancelled = !!inputRequest;
    resumeAfterInput = false;
    inputRequest = undefined;
    inputField = undefined;
    if (cancelled) {
        controls();
        renderView();
        fullscreen.control('next').focus();
    }
});
function confirmLoad(draft, id) {
    const checked = editor.validateIncoming(draft);
    pause();
    pendingLoad = { draft: checked, id };
    byId('confirm-copy').textContent = `「${checked.title}」を読み込みます。`;
    dialog('confirm-dialog').showModal();
}
form('confirm-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!pendingLoad)
        return;
    showEditor();
    editor.set(pendingLoad.draft);
    savedId = pendingLoad.id;
    sharedSource = false;
    clearShareLocation();
    savedFingerprint = draftFingerprint(currentDraft());
    recoveryDraft = undefined;
    byId('recover-draft').hidden = true;
    autosave();
    dialog('confirm-dialog').close();
    pendingLoad = undefined;
    showMessage('プログラムを読み込みました。');
});
function openSave(beforeNew = false) {
    pause();
    if (!storage)
        throw new StudioError(storageError || 'ブラウザ内に保存できません。「ファイルに書出」を使ってください。');
    const draft = currentDraft();
    byId('save-name').value = draft.title;
    byId('save-copy').hidden = !savedId;
    byId('save-submit').textContent = savedId ? '上書き保存する' : '保存する';
    showFormError(form('save-form'), '');
    dialog('save-dialog').showModal();
    saveBeforeNew = beforeNew;
}
byId('save-button').addEventListener('click', () => guarded(() => openSave()));
function saveNamed(copy) {
    try {
        if (!storage)
            throw new StudioError('ローカル保存を利用できません。');
        const title = byId('save-name').value.trim();
        if (!title)
            throw new StudioError('プログラム名を入力してください。');
        const draft = currentDraft();
        draft.title = title;
        const record = storage.save(draft, copy ? undefined : savedId);
        editor.title.value = title;
        activeDraft.title = title;
        if (runnerVisible)
            byId('studio-title').textContent = title;
        savedId = record.id;
        sharedSource = false;
        clearShareLocation();
        savedFingerprint = draftFingerprint(currentDraft());
        const makeNew = saveBeforeNew;
        saveBeforeNew = false;
        autosave();
        dialog('save-dialog').close();
        if (makeNew) {
            createNew();
            showMessage(`「${title}」を保存して、新しいプログラムを作成しました。`);
        }
        else
            showMessage(`「${title}」をこのブラウザに保存しました。`);
    }
    catch (error) {
        showFormError(form('save-form'), errorMessage(error));
    }
}
form('save-form').addEventListener('submit', event => { event.preventDefault(); saveNamed(false); });
byId('save-copy').addEventListener('click', () => saveNamed(true));
dialog('save-dialog').addEventListener('close', () => { saveBeforeNew = false; });
function renderSaved() {
    if (!storage)
        throw new StudioError(storageError || 'ローカル保存を利用できません。');
    const records = storage.list(), container = byId('saved-list');
    container.replaceChildren();
    if (!records.length)
        container.append(element('p', 'dialog-description', '名前をつけて保存したプログラムはまだありません。'));
    for (const record of records) {
        const row = element('div', 'saved-item'), text = element('div'), controls = element('div');
        text.append(element('strong', '', record.draft.title));
        const time = element('time', '', new Date(record.updatedAt).toLocaleString('ja-JP'));
        time.dateTime = new Date(record.updatedAt).toISOString();
        text.append(time);
        controls.append(button('読込', () => { dialog('load-dialog').close(); confirmLoad(record.draft, record.id); }));
        const remove = button('削除', () => {
            if (remove.dataset.confirm !== 'yes') {
                remove.dataset.confirm = 'yes';
                remove.textContent = '削除する';
                return;
            }
            storage.remove(record.id);
            if (savedId === record.id) {
                savedId = undefined;
                savedFingerprint = undefined;
            }
            renderSaved();
        });
        controls.append(remove);
        row.append(text, controls);
        container.append(row);
    }
}
byId('load-button').addEventListener('click', () => guarded(() => { pause(); renderSaved(); dialog('load-dialog').showModal(); }));
byId('export-button').addEventListener('click', () => guarded(saveFile));
byId('import-button').addEventListener('click', () => { pause(); byId('file-input').click(); });
byId('file-input').addEventListener('change', async () => {
    const input = byId('file-input'), file = input.files?.[0];
    input.value = '';
    if (!file)
        return;
    try {
        if (file.size > LIMITS.fileBytes)
            throw new StudioError('ファイルが大きすぎます（300KB以内）。');
        confirmLoad(parseDocument(await file.text()));
    }
    catch (error) {
        showMessage(errorMessage(error), true);
    }
});
byId('share-button').addEventListener('click', async () => {
    pause();
    const urlField = byId('share-url');
    urlField.value = '';
    byId('share-error').hidden = true;
    byId('share-status').textContent = '共有URLを作っています…';
    byId('copy-url').disabled = true;
    byId('native-share').hidden = true;
    dialog('share-dialog').showModal();
    try {
        const url = await encodeShare(currentDraft(), location.href);
        urlField.value = url;
        byId('copy-url').disabled = false;
        byId('share-status').textContent = `${url.length.toLocaleString('ja-JP')}文字のURLです。${url.length > 2000 ? '長いURLは送信先で途中までしか届かない場合があります。うまく送れないときはファイルを使ってください。' : ''}`;
        byId('native-share').hidden = typeof navigator.share !== 'function';
    }
    catch (error) {
        byId('share-error').textContent = errorMessage(error);
        byId('share-error').hidden = false;
        byId('share-status').textContent = '';
    }
});
byId('share-export').addEventListener('click', () => guarded(saveFile));
byId('copy-url').addEventListener('click', async () => {
    const node = byId('share-url');
    try {
        await navigator.clipboard.writeText(node.value);
        byId('share-status').textContent = 'URLをコピーしました。';
    }
    catch {
        node.focus();
        node.select();
        byId('share-status').textContent = 'URLを選択しました。コピーして送ってください。';
    }
});
byId('native-share').addEventListener('click', async () => {
    try {
        await navigator.share({ title: currentDraft().title, url: byId('share-url').value });
    }
    catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
            byId('share-status').textContent = '共有できませんでした。URLをコピーするか、ファイルを使ってください。';
    }
});
byId('recover-draft').addEventListener('click', () => guarded(() => { if (recoveryDraft)
    openExport(recoveryDraft, true); }));
window.addEventListener('pagehide', () => { pause(); if (!sharedSource && !recoveryDraft)
    autosave(); });
window.addEventListener('hashchange', async () => {
    if (!/^#v\d/u.test(location.hash) && document.body.dataset.studioEntry !== 'shared')
        return;
    protectSharedPage();
    const token = ++shareGeneration;
    pause();
    for (const openDialog of document.querySelectorAll('dialog[open]'))
        openDialog.close();
    try {
        const decoded = await decodeShare(location.hash);
        if (token !== shareGeneration)
            return;
        showEditor();
        editor.set(decoded);
        savedId = undefined;
        sharedSource = true;
        savedFingerprint = draftFingerprint(currentDraft());
        prepare(true);
    }
    catch (error) {
        if (token === shareGeneration) {
            showEditor();
            showMessage(errorMessage(error), true);
        }
    }
});
async function start() {
    let draft = emptyDraft(), error = '';
    try {
        storage = new ProgramStorage(localStorage);
        const previous = storage.draft();
        if (previous)
            draft = previous;
    }
    catch (cause) {
        storageError = errorMessage(cause);
        error = storageError;
    }
    const shared = document.body.dataset.studioEntry === 'shared' || /^#v\d/u.test(location.hash);
    if (shared) {
        try {
            draft = await decodeShare(location.hash);
            sharedSource = true;
        }
        catch (cause) {
            error = errorMessage(cause);
            sharedSource = false;
        }
    }
    try {
        editor.set(draft);
    }
    catch (cause) {
        recoveryDraft = draft;
        byId('recover-draft').hidden = false;
        error = `保存されている下書きを行の編集画面に変換できませんでした。${errorMessage(cause)} 元の下書きは下のボタンからファイルに書き出せます。`;
        draft = emptyDraft();
        editor.set(draft);
        sharedSource = false;
    }
    activeDraft = draft;
    controls();
    if (sharedSource || !draft.source.trim() && draft.title === '新しいプログラム')
        savedFingerprint = draftFingerprint(currentDraft());
    else if (storage) {
        try {
            const current = draftFingerprint(currentDraft()), saved = storage.list().find(record => draftFingerprint(record.draft) === current);
            if (saved) {
                savedId = saved.id;
                savedFingerprint = current;
            }
        }
        catch { /* An unreadable named-save list must not discard the recovered draft. */ }
    }
    if (sharedSource)
        prepare(true);
    else if (error)
        showMessage(error, true);
    else
        byId('draft-status').textContent = '下書きはこのブラウザに自動保存されます';
}
void start();
