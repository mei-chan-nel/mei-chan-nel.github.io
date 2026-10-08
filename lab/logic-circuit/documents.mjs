import { validCircuit, explicitBranches } from "./circuit.mjs?v=6";
import { circuitExamples } from "./examples.mjs?v=6";

export const FORMAT = "interactive-lab-logic-circuit";
export const FILE_BYTES = 100000;
export const DRAFT_KEY = "interactive-lab:logic-circuit:v1";
export const SAVED_KEY = "interactive-lab:logic-circuit:saved:v1";
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const byteLength = (text) => new TextEncoder().encode(text).length;

export function circuitDocument(graph, title = "名前のない回路") {
  return validateDocument({
    format: FORMAT,
    version: 1,
    title,
    circuit: graph,
  });
}

export function validateDocument(value) {
  if (!object(value) || value.format !== FORMAT || value.version !== 1)
    throw new Error("論理回路の保存形式・バージョンに対応していません。");
  if (typeof value.title !== "string" || value.title.length > 120)
    throw new Error("回路名は120文字以内にしてください。");
  if (!validCircuit(value.circuit, { allowFanout: true }))
    throw new Error(
      "部品や配線を読み取れません。論理回路から書き出したファイルを選んでください。",
    );
  // Keep only document fields, never runtime state or properties from an import.
  const graph = explicitBranches(value.circuit);
  if (!validCircuit(graph)) throw new Error("分岐の部品を読み取れません。");
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    ...(["input", "output"].includes(node.type) && node.name?.trim()
      ? { name: node.name.trim() }
      : {}),
    ...(node.type === "input"
      ? {
          label: node.label,
          value: node.value,
          ...(node.meaning ? { meaning: node.meaning } : {}),
        }
      : node.type === "output"
        ? {
            label: node.label,
            ...(node.meaning ? { meaning: node.meaning } : {}),
          }
        : { number: node.number }),
  }));
  const edges = graph.edges.map((edge) => ({
    id: edge.id,
    from: { node: edge.from.node, port: edge.from.port },
    to: { node: edge.to.node, port: edge.to.port },
  }));
  const minimums = {
    nextNode: Math.max(0, ...nodes.map((n) => Number(n.id.slice(1)))) + 1,
    nextWire: Math.max(0, ...edges.map((e) => Number(e.id.slice(1)))) + 1,
    nextGate:
      Math.max(
        0,
        ...nodes
          .filter((n) => ["and", "or", "not"].includes(n.type))
          .map((n) => n.number),
      ) + 1,
    nextBranch:
      Math.max(
        0,
        ...nodes.filter((n) => n.type === "branch").map((n) => n.number),
      ) + 1,
  };
  const counters = {};
  for (const [key, min] of Object.entries(minimums)) {
    if (
      graph[key] !== undefined &&
      (!Number.isSafeInteger(graph[key]) ||
        graph[key] < 1 ||
        graph[key] > 1000000000)
    )
      throw new Error("部品の番号を読み取れません。");
    counters[key] = Math.max(min, graph[key] ?? min);
  }
  return {
    format: FORMAT,
    version: 1,
    title: value.title.trim() || "名前のない回路",
    circuit: {
      nodes,
      edges,
      ...counters,
      example: [
        "and",
        "or",
        "not",
        "blank",
        ...circuitExamples.map((e) => e.id),
      ].includes(graph.example)
        ? graph.example
        : "",
    },
  };
}

export function documentJSON(document) {
  const text = JSON.stringify(validateDocument(document), null, 2);
  if (byteLength(text) > FILE_BYTES)
    throw new Error("保存ファイルは100KB以内にしてください。");
  return text;
}

export function parseDocument(text) {
  if (typeof text !== "string" || byteLength(text) > FILE_BYTES)
    throw new Error("ファイルが大きすぎます（100KB以内）。");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      "JSONファイルを読み取れません。論理回路から書き出したファイルを選んでください。",
    );
  }
  return validateDocument(value);
}

export function fingerprint(document) {
  const checked = validateDocument(document);
  return JSON.stringify({
    title: checked.title,
    nodes: checked.circuit.nodes,
    edges: checked.circuit.edges,
  });
}

export function exportFilename(raw) {
  let name = raw
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/gu, "_")
    .replace(/[. ]+$/u, "");
  if (!name) throw new Error("ファイル名を入力してください。");
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name))
    name = "circuit-" + name;
  if (!/\.json$/iu.test(name)) name += ".circuit.json";
  if (name.length > 120) name = name.slice(0, 115) + ".json";
  return name;
}

export class CircuitStorage {
  constructor(storage) {
    this.storage = storage;
  }
  get(key) {
    try {
      return this.storage.getItem(key);
    } catch {
      throw new Error(
        "このブラウザでは保存を利用できません。ファイルに書き出して保存してください。",
      );
    }
  }
  put(key, value) {
    try {
      this.storage.setItem(key, value);
    } catch {
      throw new Error(
        "ブラウザに保存できませんでした。保存容量・設定を確認するか、ファイルに書き出してください。",
      );
    }
  }
  draftState() {
    const raw = this.get(DRAFT_KEY);
    if (!raw) return null;
    try {
      if (byteLength(raw) > FILE_BYTES * 2 + 4096) throw new Error("size");
      const data = JSON.parse(raw);
      // Migrate the graph-only automatic save from the first circuit release.
      const document = data?.format
        ? validateDocument(data)
        : circuitDocument(data);
      const legacy = !Object.hasOwn(data, "recordId");
      if (
        !legacy &&
        data.recordId !== null &&
        (typeof data.recordId !== "string" ||
          !/^[\w-]{1,80}$/u.test(data.recordId))
      )
        throw new Error("record");
      if (
        data.cleanFingerprint !== undefined &&
        data.cleanFingerprint !== null &&
        (typeof data.cleanFingerprint !== "string" ||
          byteLength(data.cleanFingerprint) > FILE_BYTES)
      )
        throw new Error("baseline");
      return {
        document,
        recordId: legacy ? null : data.recordId,
        legacy,
        cleanFingerprint: data.cleanFingerprint ?? null,
      };
    } catch {
      throw new Error(
        "前回の作業を読み取れませんでした。保存一覧やファイルから読み込めます。",
      );
    }
  }
  draft() {
    return this.draftState()?.document ?? null;
  }
  saveDraft(document, recordId = null, cleanFingerprint = null) {
    if (
      recordId !== null &&
      (typeof recordId !== "string" || !/^[\w-]{1,80}$/u.test(recordId))
    )
      throw new Error("保存先を読み取れません。");
    if (
      cleanFingerprint !== null &&
      (typeof cleanFingerprint !== "string" ||
        byteLength(cleanFingerprint) > FILE_BYTES)
    )
      throw new Error("保存状態を読み取れません。");
    // The association belongs to this browser's draft only. Imported/exported
    // documents and shared URLs never carry a recipient's overwrite target.
    this.put(
      DRAFT_KEY,
      JSON.stringify({
        ...validateDocument(document),
        recordId,
        cleanFingerprint,
      }),
    );
  }
  list() {
    const raw = this.get(SAVED_KEY);
    if (!raw) return [];
    try {
      if (byteLength(raw) > FILE_BYTES * 100) throw new Error("size");
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || data.length > 100) throw new Error("shape");
      const ids = new Set();
      return data
        .map((item) => {
          if (
            !object(item) ||
            typeof item.id !== "string" ||
            !/^[\w-]{1,80}$/u.test(item.id) ||
            ids.has(item.id) ||
            !Number.isSafeInteger(item.updatedAt) ||
            item.updatedAt < 0 ||
            item.updatedAt > 8640000000000000
          )
            throw new Error("record");
          ids.add(item.id);
          return {
            id: item.id,
            updatedAt: item.updatedAt,
            document: validateDocument(item.document),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      throw new Error(
        "保存一覧を読み取れませんでした。既存の保存データは変更していません。ファイルから読み込めます。",
      );
    }
  }
  save(document, overwrite) {
    const records = this.list(),
      existing = records.find((item) => item.id === overwrite);
    if (overwrite && !existing)
      throw new Error(
        "上書きする保存データが見つかりません。「別の名前で保存」を使ってください。",
      );
    if (!existing && records.length >= 100)
      throw new Error(
        "名前付き保存は100件までです。不要な回路を削除するか、ファイルに書き出してください。",
      );
    const record = {
      id: existing?.id ?? crypto.randomUUID(),
      updatedAt: Date.now(),
      document: validateDocument(document),
    };
    this.put(
      SAVED_KEY,
      JSON.stringify([
        ...records.filter((item) => item.id !== record.id),
        record,
      ]),
    );
    return record;
  }
  remove(id) {
    this.put(
      SAVED_KEY,
      JSON.stringify(this.list().filter((item) => item.id !== id)),
    );
  }
}
