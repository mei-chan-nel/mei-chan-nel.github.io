import { mkdir, writeFile } from "node:fs/promises";
import { renderPage } from "../tools/shell.mjs";
import { labs } from "./catalog.mjs";
import { experiences } from "./experience.mjs?v=20261025-final-polish";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const selector = (id) =>
  `<label class="lab-picker" for="lab-picker"><span>ほかの統計ラボへ</span><select id="lab-picker">${labs.map(([slug, title]) => `<option value="${slug}" ${id === slug ? "selected" : ""}>${title}</option>`).join("")}<option value="projects" ${id === "projects" ? "selected" : ""}>横断分析課題</option></select></label>`;
const heading = (name, purpose, id, intro) =>
  `<header class="workspace-heading"><div><nav class="workspace-breadcrumb" aria-label="現在位置"><a href="../../">Interactive Lab</a><span aria-hidden="true"> / </span><a href="../">統計・データ分析</a></nav><h1>${name}</h1><p class="workspace-purpose">${purpose}</p><p class="workspace-intro">${intro}</p></div>${selector(id)}</header>`;
const academic = (body) =>
  `<section id="academic" class="academic" aria-labelledby="academic-heading"><h2 id="academic-heading">統計のしくみと読み取り方</h2><p>操作で気になったことを、定義・計算方法・前提から確かめられます。読みたい項目を開いてください。</p>${body}</section>`;
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
      slug
        ? "../workspace.css?v=20261025-final-polish"
        : "workspace.css?v=20261025-final-polish",
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
    .replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>\n/, "");
  // Fetch the selected lab alongside the entry point rather than waiting for
  // the app's dependency graph and dynamic import to finish in sequence.
  if (experiences[slug] && slug !== "projects")
    html = html.replace(
      '<script type="module" src="./../app.mjs',
      `<link rel="modulepreload" href="./lab.mjs?v=20261025-final-polish" />\n<script type="module" src="./../app.mjs`,
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
  `<header class="statistics-home-heading"><nav class="workspace-breadcrumb" aria-label="現在位置"><a href="../">Interactive Lab</a></nav><h1>統計・データ分析</h1><p class="workspace-purpose">データを動かす。見え方を比べる。根拠を持って判断する。</p></header>

<section class="lab-category" aria-label="統計ラボ" style="--lab-accent:var(--amber-strong)"><div class="archive-field-grid lab-content-grid">${labs.map(([id, title], i) => `<a href="./${id}/" class="archive-field-card" style="grid-template-columns:42px 1fr;min-height:88px"><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><h2>${title}</h2></div></a>`).join("")}</div></section>
<section id="academic" class="academic" aria-label="統計の見方"><details class="academic-section"><summary>統計の見方</summary><div class="explanation-content"><p>統計は、データの特徴や関係を調べるための道具です。</p><ul><li><strong>分布を見る：</strong>どの値が多いか、どれくらい散らばっているかを調べます。</li><li><strong>関係を調べる：</strong>2つの数値の関係や、グループごとの割合の違いを比べます。</li><li><strong>変化を追う：</strong>時間に沿った増減や、繰り返し現れる動きを読み取ります。</li><li><strong>全体を推測する：</strong>一部のデータから全体の値を推定したり、予想との違いを検定したりします。</li></ul></div></details></section>`,
);
for (const [id, title] of labs) {
  const e = experiences[id];
  await save(
    id,
    `${heading(title, e.purpose, id, e.intro)}
<section id="statistics-workspace" class="statistics-workspace" aria-label="${title}の操作画面"><div class="workspace-screenbar"><span class="workspace-screen-title">${title}</span><button data-stat-fullscreen type="button" aria-expanded="false">⛶ 全画面</button></div>
<nav id="view-tabs" class="view-tabs workspace-tabbar" aria-label="データと分析結果の表示"></nav>
<p id="tab-progress" class="tab-progress" role="status"></p><p id="lab-lead" class="lab-lead"></p><div id="experiment" aria-label="統計実験"><p role="status">データを読み込んでいます…</p></div>
<p id="experiment-insight" class="experiment-insight"></p><p id="analysis-flow" class="analysis-flow" aria-label="データに行った処理"></p>
<nav id="step-navigation" class="step-navigation" aria-label="学習タブの順路"></nav>
</section>
${academic('<div id="explanation-body"></div>')}
<div id="data-provenance"></div>
<nav class="stat-related" aria-label="次の学習"><a href="../">統計ラボの一覧へ →</a><a href="../projects/">同じデータで分析を比べる →</a></nav>`,
    ["../app.mjs?v=20261025-final-polish"],
  );
}
await save(
  "projects",
  `${heading("横断分析課題", "同じデータを分布・代表値・相関で眺め、見える特徴の違いを比べる。", "projects", "気温の高い月ほどアイスクリームへの支出が多いでしょうか。分布・代表値・相関から同じデータを見ると、どんな違いが見つかるか試せます。自分の2列の数値データでも利用できます。")}
<section id="statistics-workspace" class="statistics-workspace" aria-label="横断分析課題の操作画面"><div class="workspace-screenbar"><span class="workspace-screen-title">横断分析課題</span><button data-stat-fullscreen type="button" aria-expanded="false">⛶ 全画面</button></div><nav id="project-tabs" class="view-tabs project-tabs workspace-tabbar" aria-label="横断分析の表示"></nav><div id="project-root"></div></section>
${academic(`<details class="academic-section"><summary>問いに合わせて分析方法を選ぶ</summary><div class="explanation-content"><p>「支出の多い月はどれくらいあるか」には分布、「典型的な支出や月ごとの差はどれくらいか」には代表値とばらつき、「気温と支出に関係があるか」には散布図が役立ちます。すべての方法を使うことより、問いの根拠になる情報を選ぶことが大切です。</p><p>2016〜2025年の東京の月平均気温と全国の世帯当たり支出金額を、同じ月で対応させた120組の公開データです。各ラボへは同じ行の対応と列名を引き継ぎ、分布・代表値ではどちらの列を分析するか選べます。</p></div></details><details class="academic-section"><summary>分析結果を結び付け、限界も確かめる</summary><div class="explanation-content"><p>平均が高いことと、全員の得点が高いことは同じではありません。分布に複数の山があれば、集団別にも調べます。相関係数が大きくても、外れ値が直線を動かしていないか、予測範囲が元データから離れすぎていないかを確認しましょう。</p><p>気温と支出の関連だけで、気温の上昇が支出を何円増やすかは言えません。季節の行事、価格の変化、地域の違いなども関係しえます。どの集団のデータか、条件がそろっているか、他の説明はないかも考えると、数値の意味を読み取りやすくなります。</p></div></details>`)}<div id="data-provenance"></div>`,
  ["../projects.mjs?v=20261025-final-polish"],
);
console.log(
  `Built statistics index, ${labs.length} labs and project with natural page flow`,
);

// Preserve incoming links and offer an explicit transfer of old saved data.
await mkdir(new URL("./summary/", import.meta.url), { recursive: true });
await writeFile(
  new URL("./summary/index.html", import.meta.url),
  `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>データの分布へ統合しました｜Study Atlas</title><link rel="stylesheet" href="../workspace.css?v=20261025-final-polish"><script type="module" src="../legacy-summary.mjs?v=20261025-final-polish"></script></head><body><main class="stat-page"><h1>代表値とばらつきは「データの分布」へ統合しました</h1><p>分布・箱ひげ図・代表値計算を、同じデータで確認できます。</p><section id="legacy-summary-data" hidden><p>旧ページの保存データを統合ラボで使うか、CSVに保存できます。旧ページの保存データはそのまま残ります。</p><div class="actions"><button id="legacy-summary-open" type="button">この保存データで開く</button><button id="legacy-summary-download" type="button">CSVで保存</button></div></section><p><a href="../histogram/">データの分布を開く →</a></p></main></body></html>`,
);

// Retired standalone lab: keep bookmarks usable without loading its experiment.
await mkdir(new URL("./probability/", import.meta.url), { recursive: true });
await writeFile(
  new URL("./probability/index.html", import.meta.url),
  `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=../"><meta name="robots" content="noindex,follow"><title>統計・データ分析｜Study Atlas</title></head><body><p><a href="../">統計・データ分析の一覧へ</a></p></body></html>`,
);
