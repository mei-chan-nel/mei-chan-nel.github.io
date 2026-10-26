// Pure composition: never reads a page, form, URL query/hash, or saved learning data.
export const CHATGPT_URL = "https://chatgpt.com/";
// Application budget, NOT a guarantee about ChatGPT or any browser's URL limit.
export const MAX_URL_LENGTH = 12000;
const fields = [
  ["purpose", "目的"], ["initialState", "初めて開いたとき"],
  ["controls", "画面と操作"], ["firstSteps", "最初に試す操作"],
  ["experiments", "おすすめ"], ["results", "結果の見方"], ["cautions", "注意"],
];

export function pageKey(pathname, rootPath = "/lab/") {
  if (!pathname.startsWith(rootPath)) return null;
  return pathname.slice(rootPath.length).replace(/(?:\/index\.html|\/)$/, "");
}

export function validateGuide(guide) {
  if (!guide || guide.schemaVersion !== 1 || typeof guide.name !== "string" || !guide.name.trim() ||
      typeof guide.id !== "string" ||
      !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(guide.id)) throw Error("Invalid guide");
  for (const [field] of fields) {
    if (!Array.isArray(guide[field]) || !guide[field].length ||
        guide[field].some(value => typeof value !== "string" || !value.trim())) {
      throw Error(`Invalid guide field: ${field}`);
    }
  }
  return guide;
}

export function composePrompt(common, guides) {
  if (common?.schemaVersion !== 1 || typeof common.introduction !== "string" ||
      typeof common.instructions !== "string" || !guides.length) throw Error("Invalid prompt data");
  guides.forEach(validateGuide);
  const current = guides.at(-1);
  const lines = [common.introduction, `教材：${guides.map(g => g.name).join(" / ")}`,
    `URL：https://mei-chan-nel.com/lab/${current.id}/`];
  // The parent supplies cross-lab facts; the child supplies the starting activity.
  for (const [field, label] of fields) {
    const layers = field === "firstSteps" || field === "experiments" ? [current] : guides;
    lines.push(`${label}：${[...new Set(layers.flatMap(g => g[field]))].join(" ")}`);
  }
  return [...lines, common.instructions].join("\n\n");
}

export function chatGPTUrl(prompt) {
  return `${CHATGPT_URL}?q=${encodeURIComponent(prompt)}`;
}

export function launchPlan(prompt) {
  const url = chatGPTUrl(prompt);
  return { url: url.length <= MAX_URL_LENGTH ? url : CHATGPT_URL,
    needsCopy: url.length > MAX_URL_LENGTH, encodedLength: url.length };
}
