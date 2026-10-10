import { readFile, writeFile } from "node:fs/promises";
import { groups, contents } from "../catalog.mjs";
const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const nav = [
  ["", "トップページ"],
  ["info1-quiz-app/app/", "学習アプリ"],
  ["info1-quiz-app/questions/", "問題を探す"],
  ["terms/", "用語一覧"],
  ["archive/", "解説動画"],
  ["LectureNote/", "講義ノート"],
  ["program-trace/", "プログラムトレース"],
];
const footer = [...nav, ["books/", "書籍案内"], ["study-guide.html", "使い方"], ["about.html", "このサイトについて"], ["privacy.html", "プライバシーポリシー"], ["sitemap.html", "サイトマップ"]];
const links = (list) => list.map(([path, name]) => `<a href="../${path}">${name}</a>`).join("\n");
const esc = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const cards = (group) => contents.filter((content) => content.group === group.id).map((content, i) => `<a class="archive-field-card" href="./${esc(content.id)}/"><span aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(content.name)}</h3><p>${esc(content.description)}</p></div><b aria-hidden="true">→</b></a>`).join("\n");
const title = "Interactive Lab｜情報Ⅰ Study Atlas";
const description = "情報Ⅰの概念を、操作・実験・可視化で理解するInteractive Lab。学習アプリと同じ6分野から、情報処理のしくみを探ります。";
const url = "https://mei-chan-nel.com/lab/";
const html = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="noindex, nofollow" />
<meta property="og:type" content="website" /><meta property="og:locale" content="ja_JP" />
<meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" /><meta property="og:site_name" content="情報Ⅰ Study Atlas" />
<link rel="canonical" href="${url}" /><meta name="theme-color" content="#102f35" />
<link rel="icon" href="./icon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="../assets/site.css?v=2026100303" />
<link rel="stylesheet" href="./lab.css?v=2" />
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Study Atlas", item: "https://mei-chan-nel.com/" }, { "@type": "ListItem", position: 2, name: "Interactive Lab", item: url }] })}</script>
</head><body>
<a class="skip-link" href="#main-content">本文へ移動</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="../"><span class="brand-mark" aria-hidden="true">I</span><span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span></a><nav class="global-nav" aria-label="メインナビゲーション">${links(nav)}</nav></div></header>
<main id="main-content" class="lab-shell">
<nav class="breadcrumb" aria-label="パンくず"><a href="../">Study Atlas</a><span aria-hidden="true">/</span><span>Interactive Lab</span></nav>
<header class="lab-hero"><h1 id="lab-title">Interactive <em>Lab.</em></h1><p class="lab-tagline">触って、変えて、仕組みが見えてくる。</p></header>
${groups.map((g, i) => `<section class="lab-category" id="${g.id}" aria-labelledby="heading-${g.id}" style="--lab-accent:var(--${g.color}-strong)"><div class="section-heading lab-category-heading"><div class="category-title"><span class="category-number" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><h2 id="heading-${g.id}">${g.name}</h2></div><p>${g.hint}</p></div><div class="archive-field-grid lab-content-grid">${cards(g)}</div></section>`).join("\n")}
</main>
<footer class="site-footer"><div class="footer-grid"><div><p class="footer-brand">情報Ⅰ Study Atlas</p><p class="footer-copy">知識を、ひろげ、つなげる</p></div><nav aria-label="フッターナビゲーション">${links(footer)}</nav></div><p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p></footer>
<script type="module" src="./navigation.mjs?v=1"></script>
</body></html>\n`;
const target = new URL("index.html", root);
if (check) {
  if ((await readFile(target, "utf8")) !== html) throw new Error("lab/index.html is out of date");
} else {
  await writeFile(target, html);
}
console.log(`${check ? "Checked" : "Built"} Interactive Lab (6 fields, ${contents.length} exhibits)`);
