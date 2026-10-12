// Shared static shell for the Lab entrance and individual exhibits.
const nav = [
  ["", "トップページ"],
  ["info1-quiz-app/app/", "学習アプリ"],
  ["info1-quiz-app/questions/", "問題を探す"],
  ["terms/", "用語一覧"],
  ["archive/", "解説動画"],
  ["program-trace/", "プログラムトレース"],
  ["LectureNote/", "講義ノート"],
  ["lab/", "ラボ"],
];
const footer = [
  ...nav,
  ["study-guide.html", "使い方"],
  ["books/", "書籍案内"],
  ["about.html", "このサイトについて"],
  ["privacy.html", "プライバシーポリシー"],
  ["sitemap.html", "サイトマップ"],
];
const links = (list, prefix) =>
  list
    .map(([path, name]) => `<a href="${prefix}${path}"${path === "lab/" ? ' aria-current="page"' : ""}>${name}</a>`)
    .join("\n");

export function renderPage({
  name = "Interactive Lab",
  description,
  body,
  slug = "",
  styles = [],
  scripts = [],
}) {
  const prefix = slug ? "../../" : "../";
  const local = slug ? "../" : "./";
  const title = slug
    ? `${name}｜Interactive Lab`
    : "Interactive Lab｜情報Ⅰ Study Atlas";
  const url = `https://mei-chan-nel.com/lab/${slug ? slug + "/" : ""}`;
  const crumbs = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Study Atlas",
      item: "https://mei-chan-nel.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Interactive Lab",
      item: "https://mei-chan-nel.com/lab/",
    },
  ];
  if (slug) crumbs.push({ "@type": "ListItem", position: 3, name, item: url });
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" /><meta property="og:locale" content="ja_JP" />
<meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" /><meta property="og:site_name" content="情報Ⅰ Study Atlas" />
<link rel="canonical" href="${url}" /><meta name="theme-color" content="#102f35" />
<link rel="icon" href="${local}icon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="${prefix}assets/site.css?v=2026100303" />
<link rel="stylesheet" href="${local}lab.css?v=3" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6257644709224446" crossorigin="anonymous"></script>
<script src="${prefix}assets/manual-ads.js?v=2026080901" defer></script>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs })}</script>
${styles.map((path) => `<link rel="stylesheet" href="./${path}" />`).join("\n")}
${scripts.map((path) => `<script type="module" src="./${path}"></script>`).join("\n")}
</head><body>
<a class="skip-link" href="#main-content">本文へ移動</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="${prefix}"><span class="brand-mark" aria-hidden="true">I</span><span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span></a><nav class="global-nav" aria-label="メインナビゲーション">${links(nav, prefix)}</nav></div></header>
<main id="main-content" class="lab-shell ${slug ? "lab-content-page" : ""}">
<nav class="breadcrumb" aria-label="パンくず"><a href="${prefix}">Study Atlas</a><span aria-hidden="true">/</span>${slug ? `<a href="../">Interactive Lab</a><span aria-hidden="true">/</span><span>${name}</span>` : "<span>Interactive Lab</span>"}</nav>
${body}
</main>
<div class="manual-ad-slot manual-ad-slot--display" data-manual-ad="display" data-ad-placement="after-interactive-lab-main" hidden></div>
<footer class="site-footer"><div class="footer-grid"><div><p class="footer-brand">情報Ⅰ Study Atlas</p><p class="footer-copy">知識を、ひろげ、つなげる</p></div><nav aria-label="フッターナビゲーション">${links(footer, prefix)}</nav></div><p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p></footer>
<script type="module" src="${local}navigation.mjs?v=1"></script>
</body></html>\n`;
}
