(function () {
  "use strict";

  const field = document.body.dataset.field || "society";
  const page = window.LECTURE_CONTENT && window.LECTURE_CONTENT[field];
  if (!page) return;

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));

  const clozeMarkup = (answer) => {
    const safe = escapeHtml(answer.trim());
    return `<button class="cloze" type="button" aria-expanded="true" aria-label="穴抜きの答えを隠す"><span class="cloze-answer">${safe}</span></button>`;
  };

  const renderMarkup = (markup) => markup.replace(/\{\{([^{}]+)\}\}/g, (_, answer) => clozeMarkup(answer));

  document.title = `${page.title}｜高校情報Ⅰ 講義ノート`;
  document.querySelector("#hero-kicker").textContent = page.kicker;
  document.querySelector("#hero-title").textContent = page.title;
  document.querySelector("#hero-lead").textContent = page.lead;
  document.querySelector("#hero-meta").innerHTML = `<strong class="hero-meta-label">重要キーワード</strong>${page.meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}`;

  const content = document.querySelector("#lecture-content");
  const courseNav = document.querySelector("#lecture-course-nav");
  const fieldPages = [
    { id: "society", label: "情報社会", href: "./index.html" },
    { id: "digital", label: "デジタル", href: "./digital.html" },
    { id: "network", label: "ネットワーク", href: "./network.html" },
    { id: "statistics", label: "統計", href: "./statistics.html" },
    { id: "programming", label: "プログラミング", href: "./programming.html" }
  ];

  courseNav.innerHTML = fieldPages.map((item) => {
    const link = `<a class="course-field-link" href="${item.href}"${item.id === field ? ' aria-current="page"' : ""}>${item.label}</a>`;
    return item.id === field
      ? `<div class="course-field-group is-current">${link}<div class="section-nav" id="section-nav"></div></div>`
      : link;
  }).join("");

  const sectionNav = courseNav.querySelector("#section-nav");
  content.innerHTML = page.sections.map((section, index) => `
    <section class="lecture-section" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
      <header class="section-heading">
        <span class="section-number">${String(index + 1).padStart(2, "0")}</span>
        <div>
          <p class="section-kicker">${escapeHtml(section.kicker)}</p>
          <h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2>
          <p class="section-lead">${escapeHtml(section.lead)}</p>
        </div>
      </header>
      <div class="section-body">${renderMarkup(section.html)}</div>
    </section>
  `).join("");

  sectionNav.innerHTML = page.sections.map((section, index) => `
    <a href="#${escapeHtml(section.id)}"><span>${String(index + 1).padStart(2, "0")}</span> ${escapeHtml(section.short || section.title)}</a>
  `).join("");

  const rasterFigures = Array.from(content.querySelectorAll(".raster-figure"));
  if (rasterFigures.length) {
    const lightbox = document.createElement("dialog");
    lightbox.className = "figure-lightbox";
    lightbox.setAttribute("aria-label", "図版を拡大表示");
    lightbox.innerHTML = `
      <div class="figure-lightbox__inner">
        <div class="figure-lightbox__toolbar"><button class="figure-lightbox__close" type="button">閉じる</button></div>
        <div class="figure-lightbox__viewport"><img alt=""></div>
        <p class="figure-lightbox__caption"></p>
      </div>`;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector("img");
    const lightboxCaption = lightbox.querySelector(".figure-lightbox__caption");
    const closeButton = lightbox.querySelector(".figure-lightbox__close");
    let lastTrigger = null;

    const closeLightbox = () => {
      if (typeof lightbox.close === "function" && lightbox.open) lightbox.close();
      else {
        lightbox.removeAttribute("open");
        lightbox.classList.remove("is-open");
        lightboxImage.removeAttribute("src");
        if (lastTrigger) lastTrigger.focus();
      }
    };

    const openLightbox = (trigger, image, caption) => {
      lastTrigger = trigger;
      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt;
      lightboxCaption.textContent = caption;
      if (typeof lightbox.showModal === "function") lightbox.showModal();
      else {
        lightbox.setAttribute("open", "");
        lightbox.classList.add("is-open");
      }
      closeButton.focus();
    };

    rasterFigures.forEach((figure) => {
      const image = figure.querySelector("img");
      if (!image) return;
      const caption = figure.querySelector("figcaption");
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "figure-zoom-trigger";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-label", `${image.alt}を拡大表示`);
      image.loading = "lazy";
      image.decoding = "async";
      image.replaceWith(trigger);
      trigger.appendChild(image);
      trigger.addEventListener("click", () => openLightbox(trigger, image, caption ? caption.textContent.trim() : image.alt));
    });

    closeButton.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    lightbox.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeLightbox();
    });
    lightbox.addEventListener("close", () => {
      lightboxImage.removeAttribute("src");
      if (lastTrigger) lastTrigger.focus();
    });
  }

  const toggle = document.querySelector("#cloze-toggle");
  const allCloze = () => Array.from(document.querySelectorAll(".cloze"));
  const syncToggle = () => {
    const hasHidden = allCloze().some((button) => button.classList.contains("is-hidden"));
    toggle.textContent = hasHidden ? "全部表示" : "穴抜きを隠す";
    toggle.setAttribute("aria-label", hasHidden ? "すべての穴抜きの答えを表示する" : "すべての穴抜きの答えを隠す");
  };

  const setCloze = (button, hidden) => {
    button.classList.toggle("is-hidden", hidden);
    button.setAttribute("aria-expanded", String(!hidden));
    button.setAttribute("aria-label", hidden ? "穴抜きの答えを表示する" : "穴抜きの答えを隠す");
  };

  content.addEventListener("click", (event) => {
    const button = event.target.closest(".cloze");
    if (!button) return;
    setCloze(button, !button.classList.contains("is-hidden"));
    syncToggle();
  });

  toggle.addEventListener("click", () => {
    const buttons = allCloze();
    const shouldShow = buttons.some((button) => button.classList.contains("is-hidden"));
    buttons.forEach((button) => setCloze(button, !shouldShow));
    syncToggle();
  });
  syncToggle();

  const links = Array.from(sectionNav.querySelectorAll("a"));
  const linkById = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.remove("is-active"));
      const active = linkById.get(visible.target.id);
      if (active) active.classList.add("is-active");
    }, { rootMargin: "-24% 0px -62%", threshold: [0.05, 0.25, 0.5] });
    document.querySelectorAll(".lecture-section").forEach((section) => observer.observe(section));
  }
  if (links[0]) links[0].classList.add("is-active");
})();
