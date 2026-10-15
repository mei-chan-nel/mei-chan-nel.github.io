import { mkdir, writeFile } from "node:fs/promises";
import { renderPage } from "../tools/shell.mjs";
import { labs } from "./catalog.mjs";
import { experiences } from "./experience.mjs";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const selector = (id) =>
  `<label class="lab-picker" for="lab-picker"><span>ラボを切り替える</span><select id="lab-picker">${labs.map(([slug, title]) => `<option value="${slug}" ${id === slug ? "selected" : ""}>${title}</option>`).join("")}<option value="projects" ${id === "projects" ? "selected" : ""}>横断分析課題</option></select></label>`;
const heading = (name, purpose, id) =>
  `<header class="workspace-heading"><div><nav class="workspace-breadcrumb" aria-label="現在位置"><a href="../">統計・データ分析</a><span aria-hidden="true"> / </span><span>${name}</span></nav><h1>${name}</h1><p>${purpose}</p></div>${selector(id)}</header>`;
const dialog = (id, title, body) =>
  `<dialog id="${id}" class="workspace-dialog"><form method="dialog" class="dialog-heading"><h2>${title}</h2><button value="close">閉じる</button></form>${body}</dialog>`;
async function save(slug, body, scripts = []) {
  const name =
    labs.find((r) => r[0] === slug)?.[1] ||
    (slug === "projects" ? "横断分析課題" : "統計・データ分析");
  let html = renderPage({
    name,
    description:
      experiences[slug]?.purpose ||
      "自分のデータを使い、分布・代表値・相関などを可視化して確かめる統計ラボ。",
    slug: slug ? `statistics/${slug}` : "statistics",
    body,
    styles: [
      slug ? "../statistics.css" : "statistics.css",
      slug ? "../workspace.css" : "workspace.css",
    ],
    scripts,
  });
  html = html
    .replace(
      /<script\b[^>]*src="[^"]*(?:adsbygoogle|manual-ads)\.js[^"]*"[^>]*><\/script>\n?/g,
      "",
    )
    .replace(/<div class="manual-ad-slot[^"]*"[^>]*hidden><\/div>\n?/g, "")
    .replace(
      'class="lab-shell lab-content-page"',
      'class="lab-shell lab-content-page stat-page"',
    )
    .replace(
      "<body>",
      `<body data-statistics="${slug || "index"}"${experiences[slug] ? ` data-stat-lab="${slug}"` : ""}>`,
    )
    .replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>\n/, "")
    .replace(
      /<footer class="site-footer">[\s\S]*?<\/footer>/,
      (original) =>
        `<footer class="stat-footer"><a href="${slug ? "../" : "./"}">統計ラボ一覧</a><a href="${slug ? "../../" : "../"}">Interactive Lab</a><a href="https://www.ouj.ac.jp/mijika/mijika/" target="_blank" rel="noopener">参考教材</a><details class="site-menu"><summary>サイト案内</summary>${original.match(/<nav aria-label="フッターナビゲーション">[\s\S]*?<\/nav>/)?.[0] || ""}</details><span>情報Ⅰ Study Atlas</span></footer>`,
    );
  const url = new URL(
    slug ? `./${slug}/index.html` : "./index.html",
    import.meta.url,
  );
  await mkdir(new URL("./", url), { recursive: true });
  await writeFile(url, html);
}
await save(
  "",
  `<header class="statistics-home-heading"><h1>統計・データ分析</h1><p>自分のデータを読み込み、分布・平均・相関などを可視化して確かめる。</p><div class="home-start"><a class="button primary" href="./projects/?start=data">自分のCSV・表データから始める</a><span>分布・相関などのラボでもCSVの読込・貼り付けができます。サンプルならすぐに操作できます。</span></div></header><div class="lab-directory">${labs.map(([id, title]) => `<a href="./${id}/" class="lab-directory-link"><h2>${title}<span aria-hidden="true">→</span></h2><p>${esc(experiences[id].purpose)}</p><small>${esc(experiences[id].input)} → ${esc(experiences[id].result)}</small></a>`).join("")}<a href="./projects/" class="lab-directory-link project-directory"><h2>同じデータで、複数の分析を比べる<span aria-hidden="true">→</span></h2><p>分布・代表値・相関の結果を持ち寄り、根拠と限界をまとめる。</p><small>共通データ → 3つのラボ → 分析レポート</small></a></div><p class="directory-note">確率はモデル条件から行う実験です。各ラボの入力形式・計算の前提は、データ読込画面と解説で確認できます。</p>`,
);
for (const [id, title] of labs) {
  const e = experiences[id];
  await save(
    id,
    `${heading(title, e.purpose, id)}<section class="data-summary" aria-label="使用中のデータ"><div><strong id="data-name">サンプルデータを準備しています</strong><p id="data-description"></p></div><div class="actions"><button id="open-data" class="primary" type="button">自分のデータを使う</button><button id="reset" type="button">初期化</button></div></section><p id="analysis-flow" class="analysis-flow" aria-label="データに行った処理"></p><div class="workspace-tabbar"><nav id="view-tabs" class="view-tabs" aria-label="分析結果の表示"></nav><div class="workspace-actions"><button id="capture" type="button">比較に残す</button><button id="show-comparison" type="button">比較を見る</button><button id="show-learning" type="button">ミッション・解説</button><button id="show-tools" type="button">記録・保存</button></div></div><p id="lab-lead" hidden></p><div id="experiment" aria-label="統計実験"></div><p id="stat-status" class="stat-status" role="status" aria-live="polite"></p>${dialog("comparison-dialog", "条件と結果を比較する", '<div class="actions"><button id="clear-compare" type="button">比較を消す</button></div><section id="comparison" class="stat-compare" hidden></section><p id="comparison-empty">上の「比較に残す」で、変更前の条件と結果を記録できます。</p>')}${dialog("learning-dialog", "ミッション・解説", '<details class="stat-missions"><summary>3つのミッションから選ぶ</summary><div id="mission-list" class="mission-grid"></div></details><details class="stat-explanation"><summary>しくみ・計算・読み取り方</summary><div id="explanation-body"></div></details>')}${dialog("tools-dialog", "分析の記録と実験の保存", '<section><h3>分析課題に結果を残す</h3><p>使用したデータと処理、統計量、ミッションの記録を保存します。</p><button id="record" type="button">分析課題に記録</button> <a href="../projects/?start=records">記録と結論のページへ</a></section><section><h3>実験をファイルに保存する</h3><p>操作状態を含むJSONです。数値データを読み込む場合は「自分のデータを使う」を選んでください。</p><div class="actions"><button id="export" type="button">実験をJSON保存</button><button id="import-button" type="button">実験JSONを開く</button><input id="import" type="file" accept=".json,application/json" hidden></div></section>')}`,
    ["../app.mjs?v=20261015-ui2"],
  );
}
await save(
  "projects",
  `${heading("横断分析課題", "同じデータを分布・代表値・相関で調べ、根拠を持って結論をまとめる。", "projects")}<div id="project-root"></div>`,
  ["../projects.mjs?v=20261015-ui2"],
);
console.log("Built compact statistics index, 9 labs and project");
