import { VIDEO_PROGRAM_DATA } from "./video-program-data.js?v=20261003-video";
import { parseProgram } from "./source-parser.js?v=20261003-video";
import { matrixAxes } from "./values.js?v=20261003-video";

export function deriveVideoParameters(entry, values) {
  const result = { ...values };
  for (const [key, rule] of Object.entries(entry.derived ?? {})) {
    const length = Array.isArray(result[rule.lengthOf]) ? result[rule.lengthOf].length : result[rule.lengthOf];
    result[key] = Object.hasOwn(rule, "fill") ? Array.from({ length: length + (rule.extra ?? 0) }, () => rule.fill) : length;
  }
  return result;
}

function prepare(data, parent = null) {
  const entry = { collection: "video", accent: "mint", ...data };
  entry.deriveParameters = (values) => deriveVideoParameters(entry, values);
  entry.initialize = (values) => Object.fromEntries((entry.initialKeys ?? []).map((key) => [key, values[key]]));
  entry.validate = (values) => {
    for (const [key, rule] of Object.entries(entry.indexParameters ?? {})) {
      const value = values[rule.array];
      const indices = value?.kind === "matrix" ? Object.values(matrixAxes(value))[rule.axis] : Array.from({ length: value.length }, (_, index) => index);
      if (!indices.includes(values[key])) return `${key} は ${rule.array} の添字 ${indices[0]}〜${indices.at(-1)} の範囲で指定してください。`;
    }
    return null;
  };
  entry.program = parseProgram(entry.source, { inputs: entry.inputs, arrayCallNames: entry.number === 309 ? ["Henkan"] : [] });
  entry.groupId = parent?.id ?? entry.id;
  return entry;
}

export const VIDEO_PROGRAMS = VIDEO_PROGRAM_DATA.map((data) => {
  const entry = prepare(data);
  entry.alternatives = (data.variants ?? []).map((variant) => prepare({ ...data, ...variant, title: data.title, variantLabel: variant.label, focus: variant.note || data.focus, variants: undefined }, entry));
  return entry;
});
export const VIDEO_VARIANTS = VIDEO_PROGRAMS.flatMap((entry) => entry.alternatives);
export const videoGroup = (entry) => VIDEO_PROGRAMS.find((item) => item.id === entry.groupId);

/** 入力は省略せず、問題文で指定された順の入力候補をダイアログへ渡す。 */
export function inputCandidate(entry, field, state, parameters) {
  const sequence = entry.inputSequences?.[field.key];
  const candidate = parameters[field.key] ?? field.defaultValue;
  if (!sequence || JSON.stringify(candidate) !== JSON.stringify(field.defaultValue)) return candidate;
  if (entry.number === 290 && parameters.target !== 5) return parameters.target;
  return sequence[Math.min(state.inputCounts?.[field.key] ?? 0, sequence.length - 1)];
}

export function navigationForProgram(entry, from = "") {
  if (entry.collection !== "video") return { primary: { label: "例題一覧", href: "./" }, secondary: null };
  if (from === "examples") return { primary: { label: "プログラム一覧", href: "./" }, secondary: null };
  const allowed = new Set([entry.archivePage, ...(entry.coursePages ?? [])]);
  const page = allowed.has(from) ? from : entry.archivePage;
  return { primary: { label: "問題へ戻る", href: `../archive/${page}.html#${entry.questionId}` }, secondary: null };
}
