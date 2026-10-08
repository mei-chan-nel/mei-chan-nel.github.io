import { validateDocument, FORMAT, FILE_BYTES } from "./documents.mjs?v=6";
const TYPES = ["input", "output", "and", "or", "not", "branch"];
const URL_LIMIT = 100000;
const tooLarge = () =>
  new Error("共有データが大きすぎます。ファイルで受け渡してください。");

async function collect(stream) {
  const reader = stream.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > FILE_BYTES) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function packet(document) {
  const { title, circuit: g } = validateDocument(document);
  return [
    1,
    title,
    g.nodes.map((n) => [
      n.id,
      TYPES.indexOf(n.type),
      n.x,
      n.y,
      ...(n.type === "input"
        ? [
            n.label,
            n.value,
            ...(n.name
              ? [n.meaning ?? "", n.name]
              : n.meaning
                ? [n.meaning]
                : []),
          ]
        : n.type === "output"
          ? [n.label, n.meaning ?? "", ...(n.name ? [n.name] : [])]
          : [n.number]),
    ]),
    g.edges.map((e) => [e.id, e.from.node, e.from.port, e.to.node, e.to.port]),
    [g.nextNode, g.nextWire, g.nextGate, g.nextBranch],
    g.example,
  ];
}
function readPacket(p) {
  if (
    !Array.isArray(p) ||
    p.length !== 6 ||
    p[0] !== 1 ||
    !Array.isArray(p[2]) ||
    p[2].length > 40 ||
    !Array.isArray(p[3]) ||
    p[3].length > 80 ||
    !Array.isArray(p[4]) ||
    p[4].length !== 4
  )
    throw new Error("共有URLの保存形式・バージョンを読み取れません。");
  const nodes = p[2].map((n) => {
    if (
      !Array.isArray(n) ||
      !Number.isInteger(n[1]) ||
      n[1] < 0 ||
      n[1] >= TYPES.length ||
      !(n[1] === 0
        ? [6, 7, 8].includes(n.length)
        : n[1] === 1
          ? [6, 7].includes(n.length)
          : n.length === 5)
    )
      throw new Error("共有URLの部品を読み取れません。");
    return {
      id: n[0],
      type: TYPES[n[1]],
      x: n[2],
      y: n[3],
      ...(n[1] === 0
        ? {
            label: n[4],
            value: n[5],
            ...(n.length >= 7 ? { meaning: n[6] } : {}),
            ...(n.length === 8 ? { name: n[7] } : {}),
          }
        : n[1] === 1
          ? {
              label: n[4],
              meaning: n[5],
              ...(n.length === 7 ? { name: n[6] } : {}),
            }
          : { number: n[4] }),
    };
  });
  const edges = p[3].map((e) => {
    if (!Array.isArray(e) || e.length !== 5)
      throw new Error("共有URLの配線を読み取れません。");
    return {
      id: e[0],
      from: { node: e[1], port: e[2] },
      to: { node: e[3], port: e[4] },
    };
  });
  return validateDocument({
    format: FORMAT,
    version: 1,
    title: p[1],
    circuit: {
      nodes,
      edges,
      nextNode: p[4][0],
      nextWire: p[4][1],
      nextGate: p[4][2],
      nextBranch: p[4][3],
      example: p[5],
    },
  });
}

export async function encodeShare(document, baseURL) {
  let url;
  try {
    url = new URL(baseURL);
  } catch {}
  if (!url || !["http:", "https:"].includes(url.protocol))
    url = new URL("https://mei-chan-nel.com/lab/logic-circuit/");
  url.search = "";
  const bytes = new TextEncoder().encode(JSON.stringify(packet(document)));
  if (bytes.length > FILE_BYTES) throw tooLarge();
  let mode = "j",
    payload = bytes;
  if (typeof CompressionStream === "function") {
    try {
      const compressed = await collect(
        new Blob([bytes])
          .stream()
          .pipeThrough(new CompressionStream("deflate")),
      );
      if (compressed.length < bytes.length) {
        mode = "d";
        payload = compressed;
      }
    } catch {
      /* Browsers without compression can still share JSON. */
    }
  }
  url.hash = `lc1.${mode}.${base64url(payload)}`;
  if (url.href.length > URL_LIMIT) throw tooLarge();
  return url.href;
}

export function isCircuitShare(hash) {
  return /^#lc\d/u.test(hash);
}

export async function decodeShare(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length > URL_LIMIT) throw tooLarge();
  let hash = text;
  if (!text.startsWith("#")) {
    try {
      hash = new URL(text).hash;
    } catch {
      throw new Error("共有URL全体を貼り付けてください。");
    }
  }
  const match = /^#lc1\.([dj])\.([A-Za-z0-9_-]+)$/u.exec(hash);
  if (!match || match[2].length % 4 === 1)
    throw new Error(
      "共有URLの形式・バージョンを読み取れません。URL全体をコピーし直してください。",
    );
  try {
    const binary = atob(match[2].replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (base64url(bytes) !== match[2])
      throw new Error("共有URLのデータが欠けています。");
    if (match[1] === "d" && typeof DecompressionStream !== "function")
      throw new Error(
        "このブラウザでは共有URLを読み取れません。更新するか、ファイルで読み込んでください。",
      );
    const decoded =
      match[1] === "d"
        ? await collect(
            new Blob([bytes])
              .stream()
              .pipeThrough(new DecompressionStream("deflate")),
          )
        : bytes;
    if (decoded.length > FILE_BYTES) throw tooLarge();
    return readPacket(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /共有|ブラウザ|部品|配線|回路|番号/u.test(error.message)
    )
      throw error;
    throw new Error(
      "共有URLを復元できませんでした。URLが途中で切れていないか確認するか、ファイルを読み込んでください。",
    );
  }
}
