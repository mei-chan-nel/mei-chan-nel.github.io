import { copy, validateMemory, validateConfig } from "./model.mjs";
export const SAVED_KEY = "study-atlas-cpu-memory:saved:v1";
export function programDocument(value) {
  if (
    !value ||
    value.version !== 1 ||
    (value.format && value.format !== "interactive-lab-cpu-memory")
  )
    throw new Error("CPUと記憶装置のJSONファイルを選んでください。");
  validateMemory(value.initial);
  validateConfig(value.config);
  const { enabled, blocks, cacheTime, ramTime, cpuTime, start } = value.config;
  return {
    format: "interactive-lab-cpu-memory",
    version: 1,
    name:
      String(value.name || "名前のないプログラム")
        .trim()
        .slice(0, 60) || "名前のないプログラム",
    initial: value.initial.map(({ op, arg }) => ({ op, arg })),
    config: { enabled, blocks, cacheTime, ramTime, cpuTime, start },
  };
}
export function readPrograms(storage) {
  const raw = JSON.parse(storage.getItem(SAVED_KEY) || "[]");
  if (!Array.isArray(raw))
    throw new Error("保存したプログラムを読み取れません。");
  return raw
    .map((r) => {
      if (typeof r.id !== "string" || !Number.isFinite(r.updatedAt))
        throw new Error("保存したプログラムを読み取れません。");
      return {
        id: r.id,
        updatedAt: r.updatedAt,
        document: programDocument(r.document),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
export function saveProgram(storage, document, id) {
  const records = readPrograms(storage),
    value = programDocument(document),
    old = records.find((r) => r.id === id);
  if (!old && records.length >= 50)
    throw new Error(
      "保存は50件までです。不要な記録を読込画面から削除してください。",
    );
  const record = {
    id: old?.id ?? crypto.randomUUID(),
    updatedAt: Date.now(),
    document: value,
  };
  storage.setItem(
    SAVED_KEY,
    JSON.stringify([record, ...records.filter((r) => r.id !== record.id)]),
  );
  return copy(record);
}
export function removeProgram(storage, id) {
  storage.setItem(
    SAVED_KEY,
    JSON.stringify(readPrograms(storage).filter((r) => r.id !== id)),
  );
}
