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
  `<label class="lab-picker" for="lab-picker"><span>ほかの統計ラボへ</span><select id="lab-picker">${labs.map(([slug, title]) => `<option value="${slug}" ${id === slug ? "selected" : ""}>${title}</option>`).join("")}<option value="projects" ${id === "projects" ? "selected" : ""}>横断分析課題</option></select></label>`;
const heading = (name, purpose, id, intro) =>
  `<header class="workspace-heading"><div><nav class="workspace-breadcrumb" aria-label="現在位置"><a href="../../">Interactive Lab</a><span aria-hidden="true"> / </span><a href="../">統計・データ分析</a></nav><h1>${name}</h1><p class="workspace-purpose">${purpose}</p><p class="workspace-intro">${intro}</p></div>${selector(id)}</header>`;
const reference = `<p class="academic-reference">参考：<a href="https://www.ouj.ac.jp/mijika/mijika/" target="_blank" rel="noopener">放送大学「身近な統計」（別タブ）</a>。このラボの題材・データ・図・解説は独自に制作しています。</p>`;
const academic = (body) =>
  `<section id="academic" class="academic" aria-labelledby="academic-heading"><h2 id="academic-heading">統計のしくみと読み取り方</h2><p>操作で気になったことを、定義・計算方法・前提から確かめられます。読みたい項目を開いてください。</p>${body}${reference}</section>`;
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
    .replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>\n/, "");
  const url = new URL(
    slug ? `./${slug}/index.html` : "./index.html",
    import.meta.url,
  );
  await mkdir(new URL("./", url), { recursive: true });
  await writeFile(url, html);
}
await save(
  "",
  `<header class="statistics-home-heading"><nav class="workspace-breadcrumb" aria-label="現在位置"><a href="../">Interactive Lab</a></nav><h1>統計・データ分析</h1><p class="workspace-purpose">データを動かす。見え方を比べる。根拠を持って判断する。</p><p class="workspace-intro">平均が同じなら、同じ集団？ 相関が強ければ、予測は正確？ グラフや条件を操作して、統計の数値が表す意味と限界を確かめる9つのラボです。高校「情報Ⅰ」の学習から、推定・検定の発展的な実験まで、自分のペースで試せます。</p></header>

<section class="lab-category" aria-labelledby="directory-heading" style="--lab-accent:var(--amber-strong)"><div class="section-heading lab-category-heading"><h2 id="directory-heading">調べたいことからラボを選ぶ</h2><p>気になるラボを開いて、点や条件を動かしてみよう。</p></div><div class="archive-field-grid lab-content-grid">${labs.map(([id, title, question], i) => `<a href="./${id}/" class="archive-field-card"><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><h3>${title}</h3><p>${esc(question)} ${esc(experiences[id].purpose)}</p><small>${esc(experiences[id].input)} → ${esc(experiences[id].result)}</small></div><b aria-hidden="true">→</b></a>`).join("")}</div></section>
<a href="./projects/" class="archive-course-card"><div><h2>同じデータで、分析の見え方を比べる</h2><p>学習時間とテスト得点を、分布・代表値・相関から眺めてみよう。各ラボへ同じデータを持ち込めます。</p></div><b aria-hidden="true">→</b></a>
${academic(`<details class="academic-section"><summary>何を調べたい？ データとグラフの選び方</summary><div class="explanation-content"><p>分析の方法は、問いとデータの性質から選びます。「何人いるか」「どの値が多いか」「2つの量が関連するか」「時間とともにどう変わるか」では、適した表現が異なります。</p><ul><li><strong>分類ごとの人数・割合：</strong>クラスや回答の種類などの質的データは、棒グラフやクロス集計で比べます。数字が付いた分類番号も、数値の大小や平均に意味があるとは限りません。</li><li><strong>数値の分布：</strong>得点や時間などの量的データは、ヒストグラムやドットプロットで値の集まりを見ます。ヒストグラムの横軸は連続した数値区間で、分類を並べる棒グラフとは意味が異なります。</li><li><strong>対応する2つの数値：</strong>同じ人の学習時間と得点のような組を散布図にします。各列の値をばらばらに並べ替えると対応が失われます。</li><li><strong>時間の順序：</strong>月ごとの値は折れ線で推移を見ます。前月や前年同月など、比較対象を決めて変化を読みます。</li></ul></div></details><details class="academic-section"><summary>結果を判断する前に確認すること</summary><div class="explanation-content"><p>単位、対象集団、収集した時期、欠測の扱いを確かめましょう。未測定の値と実際に測った0は別です。このサイトの読込画面は、不正な数値や空欄を勝手に0へ変換せず、修正を求めます。</p><p>1つの指標だけで結論を決めず、元の分布・外れ値・比較条件を併せて見ます。相関は因果を証明せず、推定や検定は抽出や確率モデルの前提に依存します。疑問を立て、条件を1つずつ変え、結果とその限界を確かめることが分析の出発点です。</p></div></details>`)}`,
);
for (const [id, title] of labs) {
  const e = experiences[id];
  await save(
    id,
    `${heading(title, e.purpose, id, e.intro)}
<nav class="page-anchors" aria-label="ページ内の案内"><a href="#experiment">実験する</a><a href="#academic">統計の解説を読む</a></nav>
<nav id="view-tabs" class="view-tabs workspace-tabbar" aria-label="データと分析結果の表示"></nav>
<p id="lab-lead" class="lab-lead"></p><div id="experiment" aria-label="統計実験"></div>
<p id="experiment-insight" class="experiment-insight"></p><p id="analysis-flow" class="analysis-flow" aria-label="データに行った処理"></p>
${academic('<div id="explanation-body"></div>')}
<nav class="stat-related" aria-label="次の学習"><a href="../">統計ラボの一覧へ →</a><a href="../projects/">同じデータで分析を比べる →</a></nav>`,
    ["../app.mjs?v=20261016-data"],
  );
}
await save(
  "projects",
  `${heading("横断分析課題", "同じデータを分布・代表値・相関で眺め、見える特徴の違いを比べる。", "projects", "学習時間が長い人ほど高得点でしょうか。分布・代表値・相関から同じデータを見ると、どんな違いが見つかるか試せます。自分の2列の数値データでも利用できます。")}
<nav class="page-anchors" aria-label="ページ内の案内"><a href="#project-root">データと分析方法を選ぶ</a><a href="#academic">分析を進めるヒントを読む</a></nav><div id="project-root"></div>
${academic(`<details class="academic-section"><summary>問いに合わせて分析方法を選ぶ</summary><div class="explanation-content"><p>「得点の低い人はどれくらいいるか」には分布、「典型的な得点や個人差はどれくらいか」には代表値とばらつき、「時間と得点に関係があるか」には散布図が役立ちます。すべての方法を使うことより、問いの根拠になる情報を選ぶことが大切です。</p><p>サンプルは学習用に独自制作した架空の24人です。実在する生徒についての結論には使えません。各ラボへは同じ行の対応と列名を引き継ぎ、分布・代表値ではどちらの列を分析するか選べます。</p></div></details><details class="academic-section"><summary>分析結果を結び付け、限界も確かめる</summary><div class="explanation-content"><p>平均が高いことと、全員の得点が高いことは同じではありません。分布に複数の山があれば、集団別にも調べます。相関係数が大きくても、外れ値が直線を動かしていないか、予測範囲が元データから離れすぎていないかを確認しましょう。</p><p>学習時間と得点の関連から、時間を増やせば必ず得点が上がるとは言えません。既習内容、学習方法、対象者の選ばれ方なども関係しえます。どの集団のデータか、条件がそろっているか、他の説明はないかも考えると、数値の意味を読み取りやすくなります。</p></div></details>`)}`,
  ["../projects.mjs?v=20261016-data"],
);
console.log(
  "Built statistics index, 9 labs and project with natural page flow",
);
