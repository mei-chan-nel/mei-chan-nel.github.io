import { mkdir, writeFile, readFile } from "node:fs/promises";
import { renderPage } from "../tools/shell.mjs";
import { labs } from "./catalog.mjs";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const nav = (id, base = "../") =>
  `<nav class="stat-nav" aria-label="統計ラボ">${labs.map(([slug, title], i) => `<a href="${base}${slug}/" ${id === slug ? 'aria-current="page"' : ""}>${String(i + 1).padStart(2, "0")} ${title}</a>`).join("")}<a href="${base}projects/">横断分析課題 →</a></nav>`;
const save = async (slug, body, scripts = [], isLab = false) => {
  const row = labs.find((r) => r[0] === slug),
    name =
      row?.[1] || (slug === "projects" ? "横断分析課題" : "統計・データ分析"),
    path = slug ? `statistics/${slug}` : "statistics";
  let html = renderPage({
    name,
    description: row?.[2] || "9つの実験と横断分析で学ぶ、統計・データ分析。",
    slug: path,
    body,
    styles: [slug ? "../statistics.css" : "statistics.css"],
    scripts,
  });
  html = html
    .replace(
      'class="lab-shell lab-content-page"',
      'class="lab-shell lab-content-page stat-page"',
    )
    .replace("<body>", `<body${isLab ? ` data-stat-lab="${slug}"` : ""}>`);
  const url = new URL(
    slug ? `./${slug}/index.html` : "./index.html",
    import.meta.url,
  );
  await mkdir(new URL("./", url), { recursive: true });
  await writeFile(url, html);
};
const dots = Array.from(
  { length: 35 },
  (_, i) =>
    `<circle cx="${40 + i * 9}" cy="${218 - i * 3.8 + Math.sin(i * 4) * 27}" r="${i % 6 === 0 ? 6 : 4}" fill="${i % 6 === 0 ? "#b9793c" : "#267467"}" opacity=".8"/>`,
).join("");
await save(
  "",
  `<div class="stat-index"><div class="stat-index-visual"><div><p class="eyebrow">INTERACTIVE LAB / STATISTICS & DATA</p><h1>データを動かす。<br><em>見方が、変わる。</em></h1><p>「平均だから安心？」「相関があれば原因？」<br>予想して、変えて、確かめる。9つの小さな実験室へ。</p><span class="stat-badge">情報Ⅰ・共通テストから、その先へ</span></div><svg viewBox="0 0 400 290" role="img" aria-label="点を動かして統計を探るイメージ"><path d="M30 30V250H380" stroke="#aec9b8" fill="none"/><path d="M40 230L360 98" stroke="#b9793c" stroke-width="2" stroke-dasharray="6 5"/>${dots}<text x="42" y="30" fill="#366455" font-size="13">observe → experiment → discover</text><rect x="245" y="225" width="135" height="40" rx="8" fill="#fff"/><text x="260" y="250" fill="#366455" font-size="12">一つ動かすと、何が変わる？</text></svg></div><div class="section-heading"><div><p class="eyebrow">CHOOSE YOUR EXPERIMENT</p><h2>気になる問いから、始めよう。</h2></div><p>各ラボは単独で使えます。ミッションは自由参加。</p></div><div class="stat-cards">${labs.map(([slug, title, desc, tags], i) => `<a class="stat-card" href="./${slug}/"><small>${String(i + 1).padStart(2, "0")}</small><h2>${title}</h2><p>${desc}</p><span>${tags}　↗</span></a>`).join("")}</div><section class="project-banner"><p class="eyebrow" style="color:#a7d6ba">DATA ANALYSIS PROJECT 01</p><h2>勉強時間が長いほど、得点は高い？</h2><p>一つの架空データを、分布・代表値・相関の3つの見方で調べよう。<br>方法を選び、証拠を持ち寄り、言えることと言えないことをまとめます。</p><a class="button" href="./projects/">横断分析課題を始める →</a></section><p class="hint">教材・題材・データは独自制作です。参考：<a href="https://www.ouj.ac.jp/mijika/mijika/" target="_blank" rel="noopener">放送大学「身近な統計」</a>。計算の定義と注意点は各ラボの解説に記載しています。</p></div>`,
);
for (const [id, title, desc] of labs) {
  await save(
    id,
    `<header class="stat-hero"><div><p class="eyebrow">INTERACTIVE LAB / STATISTICS ${String(labs.findIndex((r) => r[0] === id) + 1).padStart(2, "0")}</p><h1>${title}</h1><p>${desc}</p></div><span class="stat-badge">動かして、理由を考える。</span></header>${nav(id)}<div class="stat-toolbar"><div class="actions"><button id="reset" type="button">初期化</button><button id="capture" type="button">比較に残す</button><button id="clear-compare" type="button">比較を消す</button></div><div class="actions"><button id="record" type="button">分析課題に記録</button><button id="export" type="button">JSON保存</button><label class="button" for="import">JSON読込</label><input id="import" type="file" accept=".json,application/json" hidden></div></div><p id="stat-status" class="stat-status" role="status" aria-live="polite"></p><p id="lab-lead" class="hint"></p><div id="experiment" aria-label="統計実験"></div><section id="comparison" class="stat-compare" hidden></section><details class="stat-missions" open><summary>発見のミッション <small>自由に選んで、予想を試そう</small></summary><div id="mission-list" class="mission-grid"></div></details><details class="stat-explanation"><summary>しくみ・計算・読み取り方を詳しく</summary><div id="explanation-body"></div><p class="hint">参考教材：<a href="https://www.ouj.ac.jp/mijika/mijika/" target="_blank" rel="noopener">放送大学「身近な統計」</a>。文章・図・データは独自に作成しています。</p></details><div class="stat-related"><a class="button" href="../">← 統計ラボの一覧</a><a class="button" href="../projects/">横断分析課題 →</a><a class="button" href="../../../LectureNote/statistics.html">講義ノートで学ぶ ↗</a></div>`,
    ["../app.mjs"],
    true,
  );
}
await save(
  "projects",
  `<header class="stat-hero"><div><p class="eyebrow">DATA ANALYSIS PROJECT / 01</p><h1>勉強時間と得点、どう調べる？</h1><p>一つの問いを、いくつかの見方で。必要なラボを選び、証拠を集めよう。</p></div></header>${nav("projects")}<div id="project-root"></div>`,
  ["../projects.mjs"],
);
console.log("Built statistics index, 9 labs and project");
