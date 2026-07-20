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
    { id: "society", label: "情報社会", href: "./society.html" },
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
    lightbox.setAttribute("aria-label", "図版を拡大表示。マウスホイールまたはピンチ操作で拡大縮小できます");
    lightbox.innerHTML = `
      <div class="figure-lightbox__inner">
        <div class="figure-lightbox__toolbar"><button class="figure-lightbox__close" type="button">閉じる</button></div>
        <div class="figure-lightbox__viewport" tabindex="0" role="group" aria-label="図版表示領域">
          <div class="figure-lightbox__canvas"><img class="figure-lightbox__image" alt=""></div>
        </div>
        <p class="figure-lightbox__caption"></p>
      </div>`;
    document.body.appendChild(lightbox);

    const viewport = lightbox.querySelector(".figure-lightbox__viewport");
    const canvas = lightbox.querySelector(".figure-lightbox__canvas");
    const lightboxImage = lightbox.querySelector(".figure-lightbox__image");
    const lightboxCaption = lightbox.querySelector(".figure-lightbox__caption");
    const closeButton = lightbox.querySelector(".figure-lightbox__close");
    const minZoom = () => fitScale;
    const maxZoom = () => Math.max(fitScale * 4, fitScale + 0.5);
    let fitScale = 1;
    let zoomScale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let imageReady = false;
    let panStart = null;
    let pinchStart = null;
    const activePointers = new Map();
    let lastTrigger = null;

    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    const clampOffsets = () => {
      if (!imageReady) return;
      const maxX = Math.max(0, (lightboxImage.naturalWidth * zoomScale - viewport.clientWidth) / 2);
      const maxY = Math.max(0, (lightboxImage.naturalHeight * zoomScale - viewport.clientHeight) / 2);
      offsetX = clamp(offsetX, -maxX, maxX);
      offsetY = clamp(offsetY, -maxY, maxY);
    };

    const renderImage = () => {
      if (!imageReady) return;
      canvas.style.width = `${lightboxImage.naturalWidth * zoomScale}px`;
      canvas.style.height = `${lightboxImage.naturalHeight * zoomScale}px`;
      canvas.style.left = `calc(50% + ${offsetX}px)`;
      canvas.style.top = `calc(50% + ${offsetY}px)`;
      viewport.classList.toggle("is-zoomed", zoomScale > fitScale + 0.001);
    };

    const fitImage = () => {
      if (!lightboxImage.naturalWidth || !lightboxImage.naturalHeight || !viewport.clientWidth || !viewport.clientHeight) return;
      fitScale = Math.min(1, viewport.clientWidth / lightboxImage.naturalWidth, viewport.clientHeight / lightboxImage.naturalHeight);
      zoomScale = fitScale;
      offsetX = 0;
      offsetY = 0;
      imageReady = true;
      lightboxImage.classList.add("is-ready");
      renderImage();
    };

    const resetImageView = () => {
      zoomScale = fitScale;
      offsetX = 0;
      offsetY = 0;
      renderImage();
    };

    const zoomAt = (clientX, clientY, requestedScale) => {
      if (!imageReady) return;
      const rect = viewport.getBoundingClientRect();
      const pointerX = clientX - rect.left - rect.width / 2;
      const pointerY = clientY - rect.top - rect.height / 2;
      const nextScale = clamp(requestedScale, minZoom(), maxZoom());
      const imagePointX = (pointerX - offsetX) / zoomScale;
      const imagePointY = (pointerY - offsetY) / zoomScale;
      zoomScale = nextScale;
      offsetX = pointerX - imagePointX * zoomScale;
      offsetY = pointerY - imagePointY * zoomScale;
      clampOffsets();
      renderImage();
    };

    const pointerDistance = (first, second) => Math.hypot(second.x - first.x, second.y - first.y);
    const pointerMidpoint = (first, second) => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });

    const beginPinch = () => {
      const points = Array.from(activePointers.values());
      if (points.length < 2 || !imageReady) return;
      const [first, second] = points;
      const midpoint = pointerMidpoint(first, second);
      const rect = viewport.getBoundingClientRect();
      const midpointX = midpoint.x - rect.left - rect.width / 2;
      const midpointY = midpoint.y - rect.top - rect.height / 2;
      pinchStart = {
        distance: Math.max(1, pointerDistance(first, second)),
        scale: zoomScale,
        imagePointX: (midpointX - offsetX) / zoomScale,
        imagePointY: (midpointY - offsetY) / zoomScale
      };
      panStart = null;
    };

    const continuePinch = () => {
      const points = Array.from(activePointers.values());
      if (points.length < 2 || !pinchStart) return;
      const [first, second] = points;
      const midpoint = pointerMidpoint(first, second);
      const rect = viewport.getBoundingClientRect();
      const midpointX = midpoint.x - rect.left - rect.width / 2;
      const midpointY = midpoint.y - rect.top - rect.height / 2;
      zoomScale = clamp(pinchStart.scale * pointerDistance(first, second) / pinchStart.distance, minZoom(), maxZoom());
      offsetX = midpointX - pinchStart.imagePointX * zoomScale;
      offsetY = midpointY - pinchStart.imagePointY * zoomScale;
      clampOffsets();
      renderImage();
    };

    const closeLightbox = () => {
      if (typeof lightbox.close === "function" && lightbox.open) lightbox.close();
      else {
        lightbox.removeAttribute("open");
        lightbox.classList.remove("is-open");
        lightboxImage.removeAttribute("src");
        lightboxImage.classList.remove("is-ready");
        imageReady = false;
        if (lastTrigger) lastTrigger.focus();
      }
    };

    const openLightbox = (trigger, image, caption) => {
      lastTrigger = trigger;
      imageReady = false;
      lightboxImage.classList.remove("is-ready");
      lightboxImage.style.width = "";
      lightboxImage.style.height = "";
      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt;
      lightboxCaption.textContent = caption;
      if (typeof lightbox.showModal === "function") lightbox.showModal();
      else {
        lightbox.setAttribute("open", "");
        lightbox.classList.add("is-open");
      }
      if (lightboxImage.complete) window.requestAnimationFrame(fitImage);
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

    lightboxImage.addEventListener("load", fitImage);
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
      lightboxImage.classList.remove("is-ready");
      imageReady = false;
      if (lastTrigger) lastTrigger.focus();
    });

    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
      zoomAt(event.clientX, event.clientY, zoomScale * factor);
    }, { passive: false });

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture?.(event.pointerId);
      if (activePointers.size >= 2) beginPinch();
      else panStart = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX, offsetY };
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!activePointers.has(event.pointerId)) return;
      event.preventDefault();
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        continuePinch();
      } else if (panStart && panStart.id === event.pointerId && imageReady) {
        offsetX = panStart.offsetX + event.clientX - panStart.x;
        offsetY = panStart.offsetY + event.clientY - panStart.y;
        clampOffsets();
        renderImage();
      }
    });

    const endPointer = (event) => {
      activePointers.delete(event.pointerId);
      if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (activePointers.size >= 2) {
        beginPinch();
      } else if (activePointers.size === 1) {
        const [remainingId, remaining] = Array.from(activePointers.entries())[0];
        panStart = { id: remainingId, x: remaining.x, y: remaining.y, offsetX, offsetY };
        pinchStart = null;
      } else {
        panStart = null;
        pinchStart = null;
      }
    };

    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);
    viewport.addEventListener("dragstart", (event) => event.preventDefault());

    lightbox.addEventListener("keydown", (event) => {
      if (["+", "=", "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      if (event.key === "+" || event.key === "=") zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoomScale * 1.16);
      if (event.key === "-") zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoomScale / 1.16);
      if (event.key === "0") resetImageView();
      if (event.key === "ArrowLeft") { offsetX += 40; clampOffsets(); renderImage(); }
      if (event.key === "ArrowRight") { offsetX -= 40; clampOffsets(); renderImage(); }
      if (event.key === "ArrowUp") { offsetY += 40; clampOffsets(); renderImage(); }
      if (event.key === "ArrowDown") { offsetY -= 40; clampOffsets(); renderImage(); }
    });

    window.addEventListener("resize", () => {
      if (!lightbox.open || !imageReady) return;
      const wasFit = Math.abs(zoomScale - fitScale) < 0.001;
      const previousScale = zoomScale;
      fitScale = Math.min(1, viewport.clientWidth / lightboxImage.naturalWidth, viewport.clientHeight / lightboxImage.naturalHeight);
      zoomScale = wasFit ? fitScale : Math.max(fitScale, previousScale);
      clampOffsets();
      renderImage();
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
