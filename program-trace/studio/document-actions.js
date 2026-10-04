import { StudioError } from './errors.js';
export function emptyDraft(indexBase = 0) { return { version: 1, title: '新しいプログラム', source: '', settings: { indexBase, inputs: {} } }; }
// Automatic draft saves do not count as a named/file save. Transient row IDs do
// not make a freshly loaded document appear edited.
export function draftFingerprint(draft) { return JSON.stringify({ title: draft.title, source: draft.source, settings: draft.settings }); }
export function exportFilename(raw) {
    let name = raw.trim().replace(/[<>:"/\\|?*\x00-\x1f]/gu, '_').replace(/[. ]+$/u, '');
    if (!name)
        throw new StudioError('ファイル名を入力してください。');
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name))
        name = 'program-' + name;
    if (!/\.json$/iu.test(name))
        name += '.studio.json';
    if (name.length > 120)
        name = name.replace(/\.json$/iu, '').slice(0, 115) + '.json';
    return name;
}
