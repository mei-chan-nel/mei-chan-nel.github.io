import { validateDraft } from './documents.js?v=20261009-functions';
import { LIMITS, StudioError } from './errors.js';
const PREFIX = 'mei-program-studio:v1:';
export class ProgramStorage {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    get(key) {
        try {
            return this.storage.getItem(PREFIX + key);
        }
        catch {
            throw new StudioError('このブラウザではローカル保存を利用できません。ファイルに書き出して保存してください。');
        }
    }
    put(key, value) {
        try {
            this.storage.setItem(PREFIX + key, value);
        }
        catch {
            throw new StudioError('ブラウザに保存できませんでした。保存容量・設定を確認するか、ファイルに書き出してください。');
        }
    }
    draft() {
        const raw = this.get('draft');
        if (!raw)
            return null;
        try {
            return validateDraft(JSON.parse(raw));
        }
        catch {
            throw new StudioError('前回の下書きを読み取れませんでした。名前付き保存やファイルから読み込めます。');
        }
    }
    saveDraft(draft) { this.put('draft', JSON.stringify(validateDraft(draft))); }
    list() {
        const raw = this.get('saved');
        if (!raw)
            return [];
        try {
            if (raw.length > LIMITS.fileBytes * 100)
                throw new Error('size');
            const data = JSON.parse(raw);
            if (!Array.isArray(data) || data.length > 100)
                throw new Error('shape');
            return data.map(item => {
                if (!item || typeof item.id !== 'string' || !/^[\w-]{1,80}$/u.test(item.id) || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt))
                    throw new Error('record');
                return { id: item.id, updatedAt: item.updatedAt, draft: validateDraft(item.draft) };
            }).sort((a, b) => b.updatedAt - a.updatedAt);
        }
        catch {
            throw new StudioError('保存一覧を読み取れませんでした。既存の保存データは変更していません。');
        }
    }
    save(draft, overwrite) {
        const records = this.list(), existing = records.find(item => item.id === overwrite);
        if (overwrite && !existing)
            throw new StudioError('上書きする保存データが見つかりません。');
        if (!existing && records.length >= 100)
            throw new StudioError('名前付き保存は100件までです。不要なものを削除するか、ファイルに書き出してください。');
        const record = { id: existing?.id ?? crypto.randomUUID(), updatedAt: Date.now(), draft: validateDraft(draft) };
        this.put('saved', JSON.stringify([...records.filter(item => item.id !== record.id), record]));
        return record;
    }
    remove(id) { this.put('saved', JSON.stringify(this.list().filter(item => item.id !== id))); }
}
