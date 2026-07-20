(function () {
  "use strict";

  const header = document.querySelector(".site-header");
  if (!header) return;

  // Keep the shared brand wording and footer link in sync across every
  // static page.  The footer markup is intentionally upgraded here so pages
  // that use the common shell all receive the same accessible brand link.
  const headerSubtitle = header.querySelector(".brand small");
  if (headerSubtitle) headerSubtitle.textContent = "知識を、ひろげ、つなげる";

  const footer = document.querySelector(".site-footer");
  const sharedScript = document.currentScript;
  if (footer && sharedScript?.src) {
    const siteRoot = new URL("../", sharedScript.src);
    const siteUrl = (path) => new URL(path, siteRoot).href;

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
