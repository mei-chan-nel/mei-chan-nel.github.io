import { programDocument } from "./documents.mjs";
import { OPS, SIZE } from "./model.mjs";

const URL_LIMIT = 10000;
const invalid = () =>
  new Error("共有URLを読み取れません。URL全体をコピーし直してください。");
const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

export function isProgramShare(hash) {
  return /^#cm\d/u.test(hash);
}

export function encodeShare(value, baseURL) {
  const doc = programDocument(value),
    { enabled, blocks, cacheTime, ramTime, cpuTime } = doc.config;
  let url;
  try {
    url = new URL(baseURL);
  } catch {}
  if (!url || !["https:", "http:"].includes(url.protocol))
    url = new URL("https://mei-chan-nel.com/lab/cpu-memory/");
  url.search = "";
  // Thirty-two compact cells fit in a URL without compression support.
  const packet = [
    1,
    doc.name,
    doc.initial.map(({ op, arg }) => [
      OPS.findIndex(([key]) => key === op),
      arg,
    ]),
    [enabled, blocks, cacheTime, ramTime, cpuTime],
  ];
  url.hash =
    "cm1." + base64url(new TextEncoder().encode(JSON.stringify(packet)));
  if (url.href.length > URL_LIMIT)
    throw new Error("共有URLが長すぎます。JSONファイルで共有してください。");
  return url.href;
}

export function decodeShare(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length > URL_LIMIT) throw invalid();
  let hash = value;
  if (!value.startsWith("#")) {
    try {
      hash = new URL(value).hash;
    } catch {
      throw invalid();
    }
  }
  const match = /^#cm1\.([A-Za-z0-9_-]+)$/u.exec(hash);
  if (!match || match[1].length % 4 === 1) throw invalid();
  try {
    const bytes = Uint8Array.from(
      atob(match[1].replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.charCodeAt(0),
    );
    if (base64url(bytes) !== match[1]) throw invalid();
    const packet = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      !Array.isArray(packet) ||
      packet.length !== 4 ||
      packet[0] !== 1 ||
      typeof packet[1] !== "string" ||
      !Array.isArray(packet[2]) ||
      packet[2].length !== SIZE ||
      !Array.isArray(packet[3]) ||
      packet[3].length !== 5
    )
      throw invalid();
    const initial = packet[2].map((cell) => {
      if (
        !Array.isArray(cell) ||
        cell.length !== 2 ||
        !Number.isInteger(cell[0]) ||
        !OPS[cell[0]]
      )
        throw invalid();
      return { op: OPS[cell[0]][0], arg: cell[1] };
    });
    const [enabled, blocks, cacheTime, ramTime, cpuTime] = packet[3];
    return programDocument({
      version: 1,
      name: packet[1],
      initial,
      config: { enabled, blocks, cacheTime, ramTime, cpuTime, start: 0 },
    });
  } catch {
    throw invalid();
  }
}
