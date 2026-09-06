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
  const activeSection =
    pagePath.includes("/info1-quiz-app/app/") || /^\/app\//.test(pagePath)
      ? "app"
      : pagePath.includes("/info1-quiz-app/questions/") || /^\/questions\//.test(pagePath)
        ? "questions"
        : pagePath.includes("/terms/") || /^\/terms\//.test(pagePath)
          ? "terms"
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

  const navItems = [
    ["home", siteUrl(""), "トップページ"],
    ["app", siteUrl("info1-quiz-app/app/"), "学習アプリ"],
    ["questions", siteUrl("info1-quiz-app/questions/"), "問題を探す"],
    ["terms", siteUrl("terms/"), "用語一覧"],
    ["archive", siteUrl("archive/"), "解説動画"],
    ["lecture", siteUrl("LectureNote/"), "講義ノート"],
    ["study", siteUrl("study-guide.html"), "使い方"],
    ["about", siteUrl("about.html"), "このサイトについて"],
  ];
  const navHtml = navItems.map(([key, href, label]) => {
    const current = key === activeSection ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${label}</a>`;
  }).join("");

  let header = document.querySelector(".site-header");
  if (!header) {
    header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="${siteUrl("")}">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav class="global-nav" aria-label="メインナビゲーション">${navHtml}</nav>
      </div>`;
    const skipLink = document.querySelector(".skip-link");
    if (skipLink) skipLink.after(header);
    else document.body.prepend(header);
  } else {
    const expectedPaths = new Map(navItems.map(([key, href]) => [new URL(href).pathname.toLowerCase(), key]));
    header.querySelectorAll(".global-nav a").forEach((link) => {
      const key = expectedPaths.get(new URL(link.href).pathname.toLowerCase());
      if (key === activeSection) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    const subtitle = header.querySelector(".brand small");
    if (subtitle && subtitle.textContent !== "知識を、ひろげ、つなげる") {
      subtitle.textContent = "知識を、ひろげ、つなげる";
    }
  }

  let footer = document.querySelector(".site-footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="footer-grid">
        <a class="brand footer-brand" href="${siteUrl("")}">
          <span><strong>情報Ⅰ Study Atlas</strong><small>知識を、ひろげ、つなげる</small></span>
        </a>
        <nav aria-label="フッターナビゲーション">
          <a href="${siteUrl("")}">トップページ</a>
          <a href="${siteUrl("info1-quiz-app/app/")}">学習アプリ</a>
          <a href="${siteUrl("info1-quiz-app/questions/")}">問題を探す</a>
          <a href="${siteUrl("terms/")}">用語一覧</a>
          <a href="${siteUrl("archive/")}">解説動画</a>
          <a href="${siteUrl("LectureNote/")}">講義ノート</a>
          <a href="${siteUrl("study-guide.html")}">使い方</a>
          <a href="${siteUrl("books/")}">書籍案内</a>
          <a href="${siteUrl("about.html")}">このサイトについて</a>
          <a href="${siteUrl("privacy.html")}">プライバシーポリシー</a>
          <a href="${siteUrl("sitemap.html")}">サイトマップ</a>
        </nav>
      </div>
      <p class="copyright"><small>&copy; 2026 めいちゃんねる</small></p>`;
    document.body.append(footer);
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

    let updateFrame = 0;
    const update = () => {
      updateFrame = 0;
      const scrollWidth = scroller.scrollWidth;
      const clientWidth = scroller.clientWidth;
      const scrollLeft = scroller.scrollLeft;
      const overflow = scrollWidth - clientWidth > 2;
      const atStart = !overflow || scrollLeft <= 2;
      const atEnd = !overflow || scrollLeft + clientWidth >= scrollWidth - 2;
      shell.classList.toggle("has-overflow", overflow);
      shell.classList.toggle("is-at-start", atStart);
      shell.classList.toggle("is-at-end", atEnd);
    };
    const scheduleUpdate = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(update);
    };
    const reveal = (target, behavior = "smooth") => {
      if (!target || scroller.scrollWidth <= scroller.clientWidth) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.left >= scrollerRect.left + 8 && targetRect.right <= scrollerRect.right - 8) return;
      const left = scroller.scrollLeft + targetRect.left - scrollerRect.left - (scroller.clientWidth - targetRect.width) / 2;
      scroller.scrollTo({ left, behavior });
    };

    scroller.addEventListener("scroll", scheduleUpdate, { passive: true });
    scroller.addEventListener("focusin", (event) => reveal(event.target));
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    shell.classList.add("has-overflow", "is-at-start");
    if ("ResizeObserver" in window) {
      new ResizeObserver(scheduleUpdate).observe(scroller);
    } else {
      window.addEventListener("load", scheduleUpdate, { once: true });
    }
    const current = scroller.querySelector(options.currentSelector || '[aria-current="page"], .is-active');
    const runInitialUpdate = () => window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 900px)").matches) reveal(current, "auto");
      update();
    });
    if (document.readyState === "complete") runInitialUpdate();
    else window.addEventListener("load", runInitialUpdate, { once: true });
    return { shell, update: scheduleUpdate, reveal };
  };

  window.StudyAtlasScrollHints = { init: initHorizontalScrollCue };
  const globalNav = header?.querySelector(".global-nav");
  if (globalNav) initHorizontalScrollCue(globalNav, { variant: "global" });

  if (!header) return;

  const root = document.documentElement;
  const directionThreshold = 10;
  let lastY = 0;
  let directionAnchor = lastY;
  let direction = 0;
  let ticking = false;
  let headerHeight = 86;
  const readHeaderHeight = () => {
    headerHeight = header.getBoundingClientRect().height;
  };
  if ("ResizeObserver" in window) {
    new ResizeObserver((entries) => {
      const borderBox = entries[0]?.borderBoxSize;
      const size = Array.isArray(borderBox) ? borderBox[0]?.blockSize : borderBox?.blockSize;
      if (size > 0) headerHeight = size;
    }).observe(header);
  } else {
    const scheduleHeaderHeightRead = () => window.requestAnimationFrame(readHeaderHeight);
    window.addEventListener("load", scheduleHeaderHeightRead, { once: true });
    window.addEventListener("resize", scheduleHeaderHeightRead, { passive: true });
  }

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

    if (currentY <= headerHeight) {
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
