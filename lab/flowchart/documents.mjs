import { validateDocument, flowDocument, FORMAT, MAX_BYTES } from "./graph.mjs";
import {
  parseStudioDocument,
  encodeProgram,
  decodeProgram,
} from "./studio.mjs";
import { fromProgram } from "./conversion.mjs";
export const DRAFT_KEY = "mei-interactive-flowchart:v1:draft",
  SAVED_KEY = "mei-interactive-flowchart:v1:saved";
export const fingerprint = (d) => JSON.stringify(validateDocument(d));
export function parseDocument(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_BYTES
  )
    throw Error("ファイルは300KB以内にしてください。");
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    throw Error("JSONファイルを読み取れません。");
  }
  return d?.format === FORMAT
    ? validateDocument(d)
    : fromProgram(parseStudioDocument(text));
}
export const documentJSON = (d) => JSON.stringify(validateDocument(d), null, 2);
const base64 = (bytes) => {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};
async function collect(stream) {
  const reader = stream.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        throw Error("共有データが大きすぎます。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
export async function encodeShare(
  d,
  base = "https://mei-chan-nel.com/lab/flowchart/",
) {
  const raw = new TextEncoder().encode(JSON.stringify(validateDocument(d)));
  let bytes = raw,
    mode = "j";
  if (typeof CompressionStream === "function") {
    try {
      const compressed = await collect(
        new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
      );
      if (compressed.length < bytes.length) {
        bytes = compressed;
        mode = "d";
      }
    } catch {}
  }
  const url = new URL(
    base.startsWith("http") ? base : "https://mei-chan-nel.com/lab/flowchart/",
  );
  url.search = "";
  url.hash = `fc1.${mode}.${base64(bytes)}`;
  if (url.href.length > 100000)
    throw Error("共有URLが長すぎます。JSONファイルで共有してください。");
  return url.href;
}
export async function decodeShare(value) {
  let hash = value.trim();
  if (!hash.startsWith("#")) {
    try {
      hash = new URL(hash).hash;
    } catch {}
  }
  if (/^#?v[12]\./.test(hash)) return fromProgram(await decodeProgram(hash));
  const m = /^#?fc1\.([dj])\.([\w-]+)$/.exec(hash);
  if (!m || m[2].length > 100000 || m[2].length % 4 === 1)
    throw Error("共有URLを読み取れません。");
  try {
    const bytes = Uint8Array.from(
      atob(m[2].replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
    if (base64(bytes) !== m[2]) throw Error("共有データが欠けています。");
    if (m[1] === "d" && typeof DecompressionStream !== "function")
      throw Error(
        "このブラウザでは圧縮されたURLを読めません。JSONファイルを使ってください。",
      );
    const raw =
      m[1] === "d"
        ? await collect(
            new Blob([bytes])
              .stream()
              .pipeThrough(new DecompressionStream("deflate")),
          )
        : bytes;
    if (raw.length > MAX_BYTES) throw Error("共有データが大きすぎます。");
    return validateDocument(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
    );
  } catch (e) {
    throw Error(e.message || "共有データを復元できません。");
  }
}
export async function programURL(
  draft,
  base = "https://mei-chan-nel.com/program-trace/studio/",
) {
  const encoded = await encodeProgram(draft, base),
    url = new URL(encoded);
  url.pathname = url.pathname.replace(/share\.html$/, "");
  return url.href;
}
export class FlowStorage {
  constructor(storage) {
    this.storage = storage;
  }
  draft() {
    const raw = this.storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    if (raw.length > MAX_BYTES * 3 + 4096)
      throw Error("前回の作業を読み取れません。");
    const d = JSON.parse(raw);
    return {
      document: validateDocument(d.document),
      id: typeof d.id === "string" ? d.id : null,
      baseline:
        typeof d.baseline === "string" && d.baseline.length <= MAX_BYTES
          ? d.baseline
          : null,
    };
  }
  saveDraft(d, id, baseline) {
    this.storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        document: validateDocument(d),
        id: id ?? null,
        baseline,
      }),
    );
  }
  list() {
    const raw = this.storage.getItem(SAVED_KEY);
    if (!raw) return [];
    if (raw.length > MAX_BYTES * 100 + 30000)
      throw Error("保存一覧が大きすぎます。");
    const records = JSON.parse(raw);
    if (
      !Array.isArray(records) ||
      records.length > 100 ||
      new Set(records.map((r) => r.id)).size !== records.length
    )
      throw Error("保存一覧を読み取れません。");
    return records.map((r) => {
      if (!r || typeof r.id !== "string" || typeof r.updated !== "string")
        throw Error("保存一覧を読み取れません。");
      return { ...r, document: validateDocument(r.document) };
    });
  }
  save(d, id) {
    const list = this.list();
    if (id && !list.some((r) => r.id === id)) id = null;
    if (!id && list.length >= 100) throw Error("保存は100件までです。");
    const record = {
      id: id ?? crypto.randomUUID(),
      updated: new Date().toISOString(),
      document: validateDocument(d),
    };
    const index = list.findIndex((r) => r.id === record.id);
    if (index < 0) list.push(record);
    else list[index] = record;
    this.storage.setItem(SAVED_KEY, JSON.stringify(list));
    return record;
  }
  remove(id) {
    this.storage.setItem(
      SAVED_KEY,
      JSON.stringify(this.list().filter((r) => r.id !== id)),
    );
  }
}
