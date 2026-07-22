(function () {
  "use strict";

  const sharedScript = document.currentScript;
  if (!sharedScript?.src) return;

  const GA_MEASUREMENT_ID = "G-JEG0V1ZZF2";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);

  if (!document.querySelector(`script[data-site-analytics="ga4"][data-measurement-id="${GA_MEASUREMENT_ID}"]`)) {
    const analyticsScript = document.createElement("script");
    analyticsScript.async = true;
    analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    analyticsScript.dataset.siteAnalytics = "ga4";
    analyticsScript.dataset.measurementId = GA_MEASUREMENT_ID;
    document.head.append(analyticsScript);
  }

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

  const initHorizontalScrollCue = (scroller, options = {}) => {
    if (!scroller || scroller.closest(".horizontal-scroll-cue")) return;
    const shell = document.createElement("div");
    shell.className = `horizontal-scroll-cue ${options.variant ? `horizontal-scroll-cue--${options.variant}` : ""}`.trim();
    const leftCue = document.createElement("span");
    const rightCue = document.createElement("span");
    leftCue.className = "horizontal-scroll-cue__edge horizontal-scroll-cue__edge--left";
    rightCue.className = "horizontal-scroll-cue__edge horizontal-scroll-cue__edge--right";
    leftCue.setAttribute("aria-hidden", "true");
    rightCue.setAttribute("aria-hidden", "true");
    scroller.before(shell);
    shell.append(scroller, leftCue, rightCue);

    const update = () => {
      const overflow = scroller.scrollWidth - scroller.clientWidth > 2;
      shell.classList.toggle("has-overflow", overflow);
      shell.classList.toggle("is-at-start", !overflow || scroller.scrollLeft <= 2);
      shell.classList.toggle("is-at-end", !overflow || scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2);
    };
    const reveal = (target, behavior = "smooth") => {
      if (!target || scroller.scrollWidth <= scroller.clientWidth) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.left >= scrollerRect.left + 8 && targetRect.right <= scrollerRect.right - 8) return;
      const left = scroller.scrollLeft + targetRect.left - scrollerRect.left - (scroller.clientWidth - targetRect.width) / 2;
      scroller.scrollTo({ left, behavior });
    };

    scroller.addEventListener("scroll", update, { passive: true });
    scroller.addEventListener("focusin", (event) => reveal(event.target));
    window.addEventListener("resize", update, { passive: true });
    shell.classList.add("has-overflow", "is-at-start");
    if ("ResizeObserver" in window) {
      new ResizeObserver(update).observe(scroller);
    } else {
      window.addEventListener("load", update, { once: true });
    }
    const current = scroller.querySelector(options.currentSelector || '[aria-current="page"], .is-active');
    if (window.matchMedia("(max-width: 680px)").matches) reveal(current, "auto");
    return { shell, update, reveal };
  };

  window.StudyAtlasScrollHints = { init: initHorizontalScrollCue };
  if (!document.querySelector("style[data-horizontal-scroll-cue]")) {
    const cueStyle = document.createElement("style");
    cueStyle.dataset.horizontalScrollCue = "";
    cueStyle.textContent = `
      .horizontal-scroll-cue { position: relative; min-width: 0; }
      .horizontal-scroll-cue--global { min-width: 0; margin-left: auto; flex: 0 1 auto; }
      .horizontal-scroll-cue__edge { position: absolute; top: 0; bottom: 0; z-index: 5; width: 44px; display: none; align-items: center; color: #173042; pointer-events: none; opacity: 0; transition: opacity .18s ease; }
      .horizontal-scroll-cue__edge::after { width: 24px; height: 24px; display: grid; place-items: center; border: 1px solid rgb(23 48 66 / 18%); border-radius: 50%; background: rgb(255 255 255 / 88%); box-shadow: 0 3px 10px rgb(20 48 63 / 12%); font-size: 16px; font-weight: 900; }
      .horizontal-scroll-cue__edge--left { left: 0; justify-content: flex-start; background: linear-gradient(90deg, #f7f5ef 38%, rgb(247 245 239 / 0%)); }
      .horizontal-scroll-cue__edge--left::after { content: "‹"; }
      .horizontal-scroll-cue__edge--right { right: 0; justify-content: flex-end; background: linear-gradient(270deg, #f7f5ef 38%, rgb(247 245 239 / 0%)); }
      .horizontal-scroll-cue__edge--right::after { content: "›"; }
      @media (max-width: 1040px) {
        .horizontal-scroll-cue--section { order: 10; flex: 1 0 100%; width: 100%; }
      }
      @media (max-width: 680px) {
        .horizontal-scroll-cue--global { width: 100%; margin-left: 0; flex: 1 0 auto; }
        .horizontal-scroll-cue.has-overflow .horizontal-scroll-cue__edge { display: flex; opacity: 1; }
        .horizontal-scroll-cue.is-at-start .horizontal-scroll-cue__edge--left,
        .horizontal-scroll-cue.is-at-end .horizontal-scroll-cue__edge--right { opacity: 0; }
        .horizontal-scroll-cue > .global-nav,
        .horizontal-scroll-cue > .section-nav { scroll-snap-type: x proximity; scroll-padding-inline: 14px 42px; }
        .horizontal-scroll-cue > .global-nav a,
        .horizontal-scroll-cue > .section-nav a { scroll-snap-align: start; }
      }
      @media (prefers-reduced-motion: reduce) { .horizontal-scroll-cue__edge { transition: none; } }
    `;
    document.head.append(cueStyle);
  }
  const globalNav = header?.querySelector(".global-nav");
  if (globalNav) initHorizontalScrollCue(globalNav, { variant: "global" });

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
