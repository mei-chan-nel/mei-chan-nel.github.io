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
<section class="home-start" aria-labelledby="own-data-heading"><div><h2 id="own-data-heading">自分のデータでも、すぐに試せます</h2><p>CSVを読み込むか、表計算ソフトのセルを貼り付けて、分析する列を選びます。使用したデータ・操作した条件・結果を対応させながら調べられます。教材サンプルなら準備なしで始められます。</p></div><a class="button primary" href="./projects/?start=data">自分のCSV・表データから始める →</a></section>
<section aria-labelledby="directory-heading"><div class="section-heading"><h2 id="directory-heading">調べたいことからラボを選ぶ</h2><p>各カードから実験ページへ進めます。どのラボも単独で利用できます。</p></div><div class="lab-directory">${labs.map(([id, title, question]) => `<a href="./${id}/" class="lab-directory-link"><h3>${title}</h3><p class="card-question">${esc(question)}</p><p>${esc(experiences[id].purpose)}</p><dl><dt>使うデータ</dt><dd>${esc(experiences[id].input)}</dd><dt>わかること</dt><dd>${esc(experiences[id].result)}</dd></dl><span class="card-link-label">ラボを開く <span aria-hidden="true">→</span></span></a>`).join("")}</div></section>
<a href="./projects/" class="project-directory"><div><h2>同じデータで、複数の分析を組み合わせる</h2><p>学習時間とテスト得点を題材に、分布・代表値・相関から調べます。自分のデータへの置き換えもでき、各ラボの結果を記録して結論をまとめられます。</p></div><span class="card-link-label">横断分析課題へ →</span></a>
${academic(`<details class="academic-section"><summary>何を調べたい？ データとグラフの選び方</summary><div class="explanation-content"><p>分析の方法は、問いとデータの性質から選びます。「何人いるか」「どの値が多いか」「2つの量が関連するか」「時間とともにどう変わるか」では、適した表現が異なります。</p><ul><li><strong>分類ごとの人数・割合：</strong>クラスや回答の種類などの質的データは、棒グラフやクロス集計で比べます。数字が付いた分類番号も、数値の大小や平均に意味があるとは限りません。</li><li><strong>数値の分布：</strong>得点や時間などの量的データは、ヒストグラムやドットプロットで値の集まりを見ます。ヒストグラムの横軸は連続した数値区間で、分類を並べる棒グラフとは意味が異なります。</li><li><strong>対応する2つの数値：</strong>同じ人の学習時間と得点のような組を散布図にします。各列の値をばらばらに並べ替えると対応が失われます。</li><li><strong>時間の順序：</strong>月ごとの値は折れ線で推移を見ます。前月や前年同月など、比較対象を決めて変化を読みます。</li></ul></div></details><details class="academic-section"><summary>結果を判断する前に確認すること</summary><div class="explanation-content"><p>単位、対象集団、収集した時期、欠測の扱いを確かめましょう。未測定の値と実際に測った0は別です。このサイトの読込画面は、不正な数値や空欄を勝手に0へ変換せず、修正を求めます。</p><p>1つの指標だけで結論を決めず、元の分布・外れ値・比較条件を併せて見ます。相関は因果を証明せず、推定や検定は抽出や確率モデルの前提に依存します。疑問を立て、条件を1つずつ変え、結果とその限界を記録することが分析の出発点です。</p></div></details>`)}`,
);
for (const [id, title] of labs) {
  const e = experiences[id];
  await save(
    id,
    `${heading(title, e.purpose, id, e.intro)}
<nav class="page-anchors" aria-label="ページ内の案内"><a href="#experiment">実験する</a><a href="#missions">ミッションを試す</a><a href="#academic">統計の解説を読む</a></nav>
<section class="data-summary" aria-label="使用中のデータ"><div><span class="data-label">使用中のデータ</span><strong id="data-name">サンプルデータを準備しています</strong><p id="data-description"></p></div><div class="actions"><button id="open-data" class="primary" type="button">自分のデータを使う</button><button id="reset" type="button">初期化</button></div></section>
<p id="analysis-flow" class="analysis-flow" aria-label="データに行った処理"></p><p id="lab-lead" class="lab-lead"></p>
<div class="workspace-tabbar"><nav id="view-tabs" class="view-tabs" aria-label="分析結果の表示"></nav><div class="workspace-actions"><button id="capture" type="button">比較に残す</button><button id="show-comparison" type="button">比較を見る</button><button id="show-tools" type="button">記録・保存</button></div></div><div id="experiment" aria-label="統計実験"></div><p id="stat-status" class="stat-status" role="status" aria-live="polite"></p>
<details id="comparison-panel" class="comparison-panel" hidden><summary>比較のために残した条件と結果</summary><div class="comparison-body"><div class="actions"><button id="clear-compare" type="button">比較を消す</button></div><section id="comparison" class="stat-compare" hidden></section><p id="comparison-empty">「比較に残す」で、変更前の条件と結果を記録できます。</p></div></details>
<section id="missions" class="stat-missions" aria-labelledby="missions-heading"><h2 id="missions-heading">試して考える3つのミッション</h2><p>自由実験のヒントです。予想してから条件を変え、結果と理由を記録しましょう。「教材サンプルをセット」は使用データと条件をサンプルに切り替えます。</p><div id="mission-list" class="mission-grid"></div></section>
${academic('<div id="explanation-body"></div>')}
<nav class="stat-related" aria-label="次の学習"><a href="../">統計ラボの一覧へ →</a><a href="../projects/">複数の分析を組み合わせる課題へ →</a></nav>

${dialog("tools-dialog", "分析の記録と実験の保存", '<section><h3>分析課題に結果を残す</h3><p>使用したデータと処理、統計量、ミッションの記録を保存します。</p><button id="record" type="button">分析課題に記録</button> <a href="../projects/?start=records">記録と結論のページへ →</a></section><section><h3>実験をファイルに保存する</h3><p>操作状態を含むJSONです。数値データを読み込む場合は「自分のデータを使う」を選んでください。</p><div class="actions"><button id="export" type="button">実験をJSON保存</button><button id="import-button" type="button">実験JSONを開く</button><input id="import" type="file" accept=".json,application/json" hidden></div></section>')}`,
    ["../app.mjs?v=20261015-ui3"],
  );
}
await save(
  "projects",
  `${heading("横断分析課題", "同じデータを分布・代表値・相関で調べ、根拠を持って結論をまとめる。", "projects", "学習時間が長い人ほど高得点でしょうか。まずデータを確認し、問いに合うラボを選んで調べます。結果を持ち帰って見比べ、データから言えること・言えないことを整理しましょう。自分の2列の数値データでも取り組めます。")}
<nav class="page-anchors" aria-label="ページ内の案内"><a href="#project-root">データと分析方法を選ぶ</a><a href="#academic">分析を進めるヒントを読む</a></nav><div id="project-root"></div>
${academic(`<details class="academic-section"><summary>問いに合わせて分析方法を選ぶ</summary><div class="explanation-content"><p>「得点の低い人はどれくらいいるか」には分布、「典型的な得点や個人差はどれくらいか」には代表値とばらつき、「時間と得点に関係があるか」には散布図が役立ちます。すべての方法を使うことより、問いの根拠になる情報を選ぶことが大切です。</p><p>サンプルは学習用に独自制作した架空の24人です。実在する生徒についての結論には使えません。各ラボへは同じ行の対応と列名を引き継ぎ、分布・代表値ではどちらの列を分析するか選べます。</p></div></details><details class="academic-section"><summary>分析結果を結び付け、限界も記録する</summary><div class="explanation-content"><p>平均が高いことと、全員の得点が高いことは同じではありません。分布に複数の山があれば、集団別にも調べます。相関係数が大きくても、外れ値が直線を動かしていないか、予測範囲が元データから離れすぎていないかを確認しましょう。</p><p>学習時間と得点の関連から、時間を増やせば必ず得点が上がるとは言えません。既習内容、学習方法、対象者の選ばれ方なども関係しえます。問い・使用したデータ・分析条件・根拠・限界を結論と一緒に残してください。データを変更した後は、過去の記録のデータ名と件数も確認しましょう。</p></div></details>`)}`,
  ["../projects.mjs?v=20261015-ui3"],
);
console.log(
  "Built statistics index, 9 labs and project with natural page flow",
);
