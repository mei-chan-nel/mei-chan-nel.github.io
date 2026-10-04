import { LIMITS, StudioError } from './errors.js';
import { validateDraft } from './documents.js';
import { readSharePacket, sharePackets } from './share-packet.js';
async function collect(stream, limit) {
    const reader = stream.getReader(), chunks = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > limit) {
                await reader.cancel().catch(() => { });
                throw new StudioError('共有データが大きすぎます。ファイルで受け渡してください。');
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const result = new Uint8Array(size);
    let offset = 0;
    chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length; });
    return result;
}
const tooLarge = () => { throw new StudioError('共有データが大きすぎます。ファイルで受け渡してください。'); };
function base64url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
export async function encodeShare(draft, baseURL) {
    const url = new URL('share.html', baseURL);
    url.search = '';
    url.hash = '';
    let shortest = '';
    for (const packet of sharePackets(draft)) {
        const bytes = new TextEncoder().encode(JSON.stringify(packet));
        if (bytes.length > LIMITS.shareBytes)
            continue;
        let mode = 'j', payload = bytes;
        if (typeof CompressionStream === 'function') {
            try {
                const compressed = await collect(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate')), LIMITS.shareBytes);
                if (compressed.length < payload.length) {
                    mode = 'd';
                    payload = compressed;
                }
            }
            catch (error) {
                if (error instanceof StudioError)
                    throw error;
                // Uncompressed v2 still works when compression isn't available.
            }
        }
        url.hash = `v2.${mode}.${base64url(payload)}`;
        if (!shortest || url.href.length < shortest.length)
            shortest = url.href;
    }
    if (!shortest)
        return tooLarge();
    if (shortest.length > LIMITS.urlCharacters)
        throw new StudioError('このプログラムは共有URLが長すぎます。ファイルに書き出してください。');
    return shortest;
}
export async function decodeShare(hash) {
    const text = hash.startsWith('#') ? hash.slice(1) : hash;
    const legacy = text.startsWith('v1.'), match = legacy ? undefined : /^v2\.([dj])\.(.*)$/u.exec(text);
    if (!legacy && !match)
        throw new StudioError('共有URLの形式・バージョンを読み取れません。URL全体を開いてください。');
    const token = legacy ? text.slice(3) : match[2], mode = legacy ? 'gzip' : match[1] === 'd' ? 'deflate' : '';
    if (!token || token.length > LIMITS.urlCharacters || !/^[A-Za-z0-9_-]+$/u.test(token) || token.length % 4 === 1)
        throw new StudioError('共有URLのデータが欠けているか、大きすぎます。URL全体をコピーするか、ファイルで読み込んでください。');
    try {
        const binary = atob(token.replaceAll('-', '+').replaceAll('_', '/'));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        if (base64url(bytes) !== token)
            throw new StudioError('共有URLのデータが正しくありません。URL全体をコピーし直してください。');
        if (mode && typeof DecompressionStream !== 'function')
            throw new StudioError('このブラウザでは共有URLを読み取れません。更新するか、送信者にファイルの書き出しを依頼してください。');
        const raw = mode ? await collect(new Blob([bytes]).stream().pipeThrough(new DecompressionStream(mode)), LIMITS.shareBytes) : bytes;
        if (raw.length > LIMITS.shareBytes)
            return tooLarge();
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
        return legacy ? validateDraft(value) : readSharePacket(value);
    }
    catch (error) {
        if (error instanceof StudioError)
            throw error;
        throw new StudioError('共有URLを復元できませんでした。URLが途中で切れていないか確認するか、ファイルを読み込んでください。');
    }
}
