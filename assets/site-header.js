(function () {
  "use strict";

  const sharedScript = document.currentScript;
  if (!sharedScript?.src) return;

  const siteRoot = new URL("../", sharedScript.src);
  const siteUrl = (path) => new URL(path, siteRoot).href;
  const pagePath = window.location.pathname.toLowerCase();
  const siteRootPath = siteRoot.pathname.endsWith("/") ? siteRoot.pathname : `${siteRoot.pathname}/`;
  const homePaths = new Set([siteRootPath.toLowerCase(), `${siteRootPath}index.html`.toLowerCase()]);
  const activeSection = pagePath.includes("/info1-quiz-app/app/") || /^\/app\//.test(pagePath)
    ? "app"
    : pagePath.includes("/info1-quiz-app/questions/") || /^\/questions\//.test(pagePath)
      ? "questions"
      : pagePath.includes("/archive/")
        ? "archive"
        : pagePath.includes("/lecturenote/")
          ? "lecture"
          : pagePath.endsWith("/study-guide.html")
            ? "study"
            : pagePath.endsWith("/about.html")
              ? "about"
              : homePaths.has(pagePath)
                ? "home"
                : "";

  const header = document.querySelector(".site-header");
  if (header) {
    const navItems = [
      ["home", siteUrl("index.html"), "トップページ"],
      ["app", siteUrl("info1-quiz-app/app/"), "学習アプリ"],
      ["questions", siteUrl("info1-quiz-app/questions/index.html"), "問題一覧"],
      ["archive", siteUrl("archive/index.html"), "動画問題"],
      ["lecture", siteUrl("LectureNote/index.html"), "講義ノート"],
      ["study", siteUrl("study-guide.html"), "勉強法"],
      ["about", siteUrl("about.html"), "このサイトについて"],
    ];
    const navHtml = navItems.map(([key, href, label]) => {
      const current = key === activeSection ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${label}</a>`;
    }).join("");

    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="${siteUrl("index.html")}" aria-label="情報Ⅰ Study Atlas トップ">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">${navHtml}</nav>
      </div>`;
  }

  const footer = document.querySelector(".site-footer");
  if (footer) {

    footer.innerHTML = `
      <div class="footer-grid">
        <a class="brand footer-brand" href="${siteUrl("index.html")}" aria-label="情報Ⅰ Study Atlas トップ">
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav aria-label="フッターナビゲーション">
          <a href="${siteUrl("index.html")}">トップページ</a>
          <a href="${siteUrl("info1-quiz-app/app/")}">学習アプリ</a>
          <a href="${siteUrl("info1-quiz-app/questions/index.html")}">問題一覧</a>
          <a href="${siteUrl("archive/index.html")}">動画問題</a>
          <a href="${siteUrl("LectureNote/index.html")}">講義ノート</a>
          <a href="${siteUrl("study-guide.html")}">勉強法</a>
          <a href="${siteUrl("books/index.html")}">書籍案内</a>
          <a href="${siteUrl("about.html")}">このサイトについて</a>
          <a href="${siteUrl("privacy.html")}">プライバシーポリシー</a>
          <a href="${siteUrl("sitemap.html")}">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>`;
  }

  if (!header) return;

  const root = document.documentElement;
  const directionThreshold = 10;
  let lastY = Math.max(window.scrollY, 0);
  let directionAnchor = lastY;
  let direction = 0;
  let ticking = false;

  const showHeader = () => {
    header.classList.remove("is-header-hidden");
    root.classList.remove("header-is-hidden");
  };

  const hideHeader = () => {
    if (header.contains(document.activeElement)) return;
    header.classList.add("is-header-hidden");
    root.classList.add("header-is-hidden");
  };

  const updateHeader = () => {
    const currentY = Math.max(window.scrollY, 0);
    const delta = currentY - lastY;

    if (currentY <= header.offsetHeight) {
      showHeader();
      direction = 0;
      directionAnchor = currentY;
    } else if (delta > 0) {
      if (direction !== 1) {
        direction = 1;
        directionAnchor = currentY;
      }
      if (currentY - directionAnchor >= directionThreshold) hideHeader();
    } else if (delta < 0) {
      if (direction !== -1) {
        direction = -1;
        directionAnchor = currentY;
      }
      if (directionAnchor - currentY >= directionThreshold) showHeader();
    }

    lastY = currentY;
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateHeader);
  }, { passive: true });

  header.addEventListener("focusin", showHeader);
  window.addEventListener("pageshow", showHeader);
})();
