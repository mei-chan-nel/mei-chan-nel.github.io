import { executionHref } from "./routing.js?v=20261003-seo";

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (character) => entities[character]);

function highlightedHTML(text) {
  const pattern = /"[^"]*"|-?\d+(?:\.\d+)?|\b[a-zA-Z_][a-zA-Z_0-9]*\b|そうでなくもし|そうでなければ|もし|ならば|繰り返す|の間|ずつ増やしながら|外部からの入力|要素数|定義する|返す|乱数|[｜⎿]/g;
  let cursor = 0;
  let result = "";
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const type = token.startsWith('"') ? "string" : /^-?\d/.test(token) ? "number" : /^[a-zA-Z_]/.test(token) ? "variable" : /[｜⎿]/.test(token) ? "branch" : "keyword";
    result += escapeHTML(text.slice(cursor, match.index)) + `<span class="token-${type}">${escapeHTML(token)}</span>`;
    cursor = match.index + token.length;
  }
  return result + escapeHTML(text.slice(cursor));
}

export function cardMarkup(entry, lines) {
  const video = entry.collection === "video";
  const label = `${video ? "動画解説問題" : `例${entry.number}`} ${entry.title}：1行ずつ実行`;
  const code = lines.map(({ line, text }) => {
    const label = entry.lineLabels?.[line - 1] ?? `（${String(line).padStart(entry.lineNumberDigits ?? 1, "0")}）`;
    return `<div class="preview-line"><span class="line-number">${escapeHTML(label)}</span><code class="source-code">${highlightedHTML(text)}</code></div>`;
  }).join("");
  return `<a class="example-card" href="${escapeHTML(executionHref(entry.id, video ? "examples" : ""))}" data-accent="${escapeHTML(entry.accent)}" aria-label="${escapeHTML(label)}"><div class="card-heading"><span class="example-number">${escapeHTML(String(entry.number).padStart(2, "0"))}</span><span class="category">${escapeHTML(entry.category)}</span></div><h3>${escapeHTML(entry.title)}</h3><p class="card-description">${escapeHTML(entry.description)}</p><div class="preview-code">${code}</div><div class="card-bottom"><strong>1行ずつ実行<span class="card-arrow" aria-hidden="true">→</span></strong></div></a>`;
}
