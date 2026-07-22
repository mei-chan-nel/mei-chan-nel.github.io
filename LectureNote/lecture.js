(async function () {
  "use strict";

  const field = document.body.dataset.field || "society";
  const page = window.LECTURE_CONTENT && window.LECTURE_CONTENT[field];
  if (!page) return;
  const progressKey = "info1LectureProgress:v1";
  const fieldLabels = {
    society: "情報社会",
    digital: "デジタル",
    network: "ネットワーク",
    statistics: "統計",
    programming: "プログラミング"
  };

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

  const readProgress = () => {
    try {
      const value = JSON.parse(localStorage.getItem(progressKey));
      if (!value || !fieldLabels[value.field] || typeof value.sectionId !== "string" || typeof value.sectionTitle !== "string") return null;
      if (!Number.isInteger(value.sectionIndex) || value.sectionIndex < 0 || typeof value.updatedAt !== "number") return null;
      if (value.field === field && !page.sections.some((section) => section.id === value.sectionId)) return null;
      return value;
    } catch (_error) {
      return null;
    }
  };

  const writeProgress = (section, sectionIndex) => {
    try {
      localStorage.setItem(progressKey, JSON.stringify({
        field,
        sectionId: section.id,
        sectionTitle: section.short || section.title,
        sectionIndex,
        updatedAt: Date.now()
      }));
    } catch (_error) {
      // Storage can be unavailable in private or restricted browsing modes.
    }
  };

  const savedProgress = readProgress();
  const resumeRequested = new URLSearchParams(window.location.search).get("resume") === "1";
  const keywordGroups = Array.isArray(page.keywordGroups) ? page.keywordGroups : [];
  const keywords = keywordGroups.flatMap((group) => group.keywords || []);
  const keywordByTargetId = new Map(keywords.map((keyword) => [keyword.targetId, keyword]));
  let readingMode = "sequential";
  let keywordIndexBrowsing = false;
  let progressTrackingStarted = resumeRequested;

  const learningGuide = document.createElement("section");
  learningGuide.className = "lecture-learning-guide";
  learningGuide.setAttribute("aria-labelledby", "lecture-learning-guide-title");
  const resumeHref = savedProgress
    ? `./${savedProgress.field}.html?resume=1#${encodeURIComponent(savedProgress.sectionId)}`
    : "";
  learningGuide.innerHTML = `
    <div class="lecture-learning-guide__heading">
      <p>READING GUIDE</p>
      <h2 id="lecture-learning-guide-title">学び方を選ぶ</h2>
    </div>
    <div class="lecture-learning-guide__choices">
      <a class="lecture-learning-choice" data-reading-start href="#${escapeHtml(page.sections[0]?.id || "")}">
        <strong>最初から順に読む</strong><span>基礎から順番に学習します</span>
      </a>
      ${savedProgress ? `<a class="lecture-learning-choice" data-reading-resume href="${escapeHtml(resumeHref)}"><strong>前回の続きから読む</strong><span>前回：${escapeHtml(fieldLabels[savedProgress.field])}「${escapeHtml(savedProgress.sectionTitle)}」</span></a>` : ""}
    </div>
    <details class="lecture-keyword-index" id="lecture-keyword-index">
      <summary><span><strong>重要キーワード</strong><small>用語や仕組みを選んで、必要な部分だけ確認します</small></span></summary>
      <div class="lecture-keyword-index__groups">
        ${keywordGroups.map((group) => `<section><h3>${escapeHtml(group.title)}</h3><div>${group.keywords.map((keyword) => `<a href="#${escapeHtml(keyword.targetId)}" data-keyword-id="${escapeHtml(keyword.id)}">${escapeHtml(keyword.label)}</a>`).join("")}</div></section>`).join("")}
      </div>
    </details>
    <p class="lecture-reading-state" aria-live="polite">順番に読んでいます</p>`;
  document.querySelector(".course-hero").after(learningGuide);
  const readingState = learningGuide.querySelector(".lecture-reading-state");
  const keywordIndex = learningGuide.querySelector(".lecture-keyword-index");
  keywordIndex.addEventListener("toggle", () => {
    keywordIndexBrowsing = keywordIndex.open;
    if (keywordIndexBrowsing) progressTrackingStarted = false;
  });

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
  const sectionMarkup = page.sections.map((section, index) => `
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
  `);
  content.replaceChildren();
  await new Promise((resolve) => {
    let nextIndex = 0;
    const appendBatch = () => {
      const template = document.createElement("template");
      template.innerHTML = sectionMarkup.slice(nextIndex, nextIndex + 1).join("");
      content.appendChild(template.content);
      nextIndex += 1;
      if (nextIndex < sectionMarkup.length) window.requestAnimationFrame(appendBatch);
      else resolve();
    };
    appendBatch();
  });

  const keywordTargets = new Map();
  const installKeywordTarget = (keyword) => {
    const section = document.getElementById(keyword.sectionId);
    const sectionBody = section?.querySelector(".section-body");
    if (!sectionBody) return null;
    const walker = document.createTreeWalker(sectionBody, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data.includes(keyword.targetText) || node.parentElement?.closest(".keyword-target")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let remaining = keyword.occurrence || 0;
    let node;
    while ((node = walker.nextNode())) {
      let fromIndex = 0;
      let matchIndex = node.data.indexOf(keyword.targetText, fromIndex);
      while (matchIndex >= 0) {
        if (remaining === 0) {
          const matchNode = node.splitText(matchIndex);
          matchNode.splitText(keyword.targetText.length);
          const target = document.createElement("span");
          target.id = keyword.targetId;
          target.className = "keyword-target";
          target.tabIndex = -1;
          target.dataset.keywordId = keyword.id;
          matchNode.replaceWith(target);
          target.append(matchNode);
          return target;
        }
        remaining -= 1;
        fromIndex = matchIndex + keyword.targetText.length;
        matchIndex = node.data.indexOf(keyword.targetText, fromIndex);
      }
    }
    return null;
  };

  keywords.forEach((keyword) => {
    const target = installKeywordTarget(keyword);
    if (target) keywordTargets.set(keyword.targetId, target);
    else console.warn(`重要キーワードの移動先を作成できませんでした: ${keyword.id}`);
  });

  const keywordTools = document.createElement("aside");
  keywordTools.className = "keyword-reading-tools";
  keywordTools.hidden = true;
  keywordTools.setAttribute("aria-live", "polite");
  keywordTools.innerHTML = `
    <p><span data-keyword-field></span><span data-keyword-section></span><strong data-keyword-status></strong></p>
    <nav aria-label="キーワード確認中の操作">
      <a href="#lecture-keyword-index" data-keyword-index-link>重要キーワード一覧へ戻る</a>
      <a href="#" data-keyword-section-link>この節の先頭へ</a>
      <button type="button" data-keyword-sequential>ここから順番に読む</button>
    </nav>`;
  let highlightedTarget = null;
  let highlightTimer = 0;

  const clearKeywordHighlight = () => {
    window.clearTimeout(highlightTimer);
    highlightedTarget?.classList.remove("is-keyword-highlighted");
    highlightedTarget = null;
  };

  const setReadingMode = (mode, label = "") => {
    readingMode = mode;
    if (mode === "keyword") {
      progressTrackingStarted = false;
      readingState.textContent = `索引から確認中：${label}`;
      readingState.classList.add("is-keyword-reading");
    } else {
      readingState.textContent = "順番に読んでいます";
      readingState.classList.remove("is-keyword-reading");
    }
  };

  const placeKeywordTools = (target, keyword) => {
    const section = document.getElementById(keyword.sectionId);
    const sectionBody = section?.querySelector(".section-body");
    let block = target;
    while (block.parentElement && block.parentElement !== sectionBody) block = block.parentElement;
    if (block.parentElement === sectionBody) block.before(keywordTools);
    else sectionBody?.prepend(keywordTools);
    const sectionData = page.sections.find((item) => item.id === keyword.sectionId);
    keywordTools.querySelector("[data-keyword-field]").textContent = fieldLabels[field];
    keywordTools.querySelector("[data-keyword-section]").textContent = sectionData?.short || sectionData?.title || "";
    keywordTools.querySelector("[data-keyword-status]").textContent = `索引から確認中：${keyword.label}`;
    keywordTools.querySelector("[data-keyword-section-link]").href = `#${keyword.sectionId}`;
    keywordTools.hidden = false;
  };

  const showKeyword = (keyword, focusTarget = true) => {
    const target = keywordTargets.get(keyword.targetId);
    if (!target) return false;
    setReadingMode("keyword", keyword.label);
    placeKeywordTools(target, keyword);
    clearKeywordHighlight();
    highlightedTarget = target;
    target.classList.add("is-keyword-highlighted");
    target.scrollIntoView({ block: "center", behavior: "auto" });
    if (focusTarget) target.focus({ preventScroll: true });
    highlightTimer = window.setTimeout(() => {
      target.classList.remove("is-keyword-highlighted");
      if (highlightedTarget === target) highlightedTarget = null;
    }, 3600);
    return true;
  };

  sectionNav.innerHTML = page.sections.map((section, index) => `
    <a href="#${escapeHtml(section.id)}"><span>${String(index + 1).padStart(2, "0")}</span> ${escapeHtml(section.short || section.title)}</a>
  `).join("");

  const sectionScrollCue = window.StudyAtlasScrollHints?.init(sectionNav, { variant: "section", currentSelector: ".is-active" });

  const animations = Array.from(content.querySelectorAll("video.lecture-animation"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prepareAnimation = (video, includeSources) => {
    if (video.dataset.poster && !video.poster) video.poster = video.dataset.poster;
    if (!includeSources || video.dataset.sourcesReady) return;
    video.querySelectorAll("source[data-src]").forEach((source) => {
      source.src = source.dataset.src;
      source.removeAttribute("data-src");
    });
    video.dataset.sourcesReady = "true";
    video.load();
  };
  const pauseAnimations = () => animations.forEach((video) => video.pause());

  animations.forEach((video) => {
    const figure = video.closest(".raster-figure");
    const caption = figure?.querySelector("figcaption");
    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "lecture-animation__expand";
    expandButton.textContent = "動画を拡大";
    expandButton.setAttribute("aria-label", `${video.getAttribute("aria-label") || "アニメーション"}を拡大表示`);
    (caption || figure || video.parentElement)?.appendChild(expandButton);
    const loadForUser = () => prepareAnimation(video, true);
    video.addEventListener("pointerdown", loadForUser, { once: true });
    video.addEventListener("focus", loadForUser, { once: true });
    expandButton.addEventListener("click", async () => {
      prepareAnimation(video, true);
      try {
        if (video.requestFullscreen) await video.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch (_error) {
        video.scrollIntoView({ block: "center" });
      }
    });
  });

  if ("IntersectionObserver" in window) {
    const mediaObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          prepareAnimation(video, !reduceMotion.matches);
          if (!reduceMotion.matches) video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { rootMargin: "320px 0px", threshold: 0.01 });
    animations.forEach((video) => mediaObserver.observe(video));
  } else {
    animations.forEach((video) => prepareAnimation(video, !reduceMotion.matches));
  }
  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches) pauseAnimations();
  });

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
    let pinchInProgress = false;
    let lastTap = null;
    let lastPointerDoubleTapAt = 0;
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
      pinchInProgress = true;
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

    const toggleDoubleZoom = (clientX, clientY) => {
      if (!imageReady) return;
      if (zoomScale > fitScale + 0.001) {
        resetImageView();
        return;
      }
      zoomAt(clientX, clientY, Math.min(maxZoom(), fitScale * 2));
    };

    const closeLightbox = () => {
      if (typeof lightbox.close === "function" && lightbox.open) lightbox.close();
      else {
        lightbox.removeAttribute("open");
        lightbox.classList.remove("is-open");
        lightboxImage.removeAttribute("src");
        lightboxImage.classList.remove("is-ready");
        imageReady = false;
        lastTap = null;
        pinchInProgress = false;
        if (lastTrigger) lastTrigger.focus();
      }
    };

    const openLightbox = (trigger, image, caption) => {
      lastTrigger = trigger;
      imageReady = false;
      lastTap = null;
      pinchInProgress = false;
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
      if (figure.querySelector("video")) return;
      const image = figure.querySelector("img");
      if (!image) return;
      const caption = figure.querySelector("figcaption");
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "figure-zoom-trigger";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-label", `${image.alt}を拡大表示`);
      const media = image.closest("picture") || image;
      media.replaceWith(trigger);
      trigger.appendChild(media);
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
      lastTap = null;
      pinchInProgress = false;
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
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
      viewport.setPointerCapture?.(event.pointerId);
      if (activePointers.size >= 2) beginPinch();
      else panStart = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX, offsetY };
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!activePointers.has(event.pointerId)) return;
      event.preventDefault();
      const pointer = activePointers.get(event.pointerId);
      activePointers.set(event.pointerId, {
        ...pointer,
        x: event.clientX,
        y: event.clientY,
        moved: pointer.moved || Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 10
      });
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
      const pointer = activePointers.get(event.pointerId);
      const wasTap = pointer && !pointer.moved;
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
        if (event.pointerType !== "mouse") {
          if (wasTap && !pinchInProgress) {
            const now = performance.now();
            const closeToPrevious = lastTap && now - lastTap.time < 360 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 36;
            if (closeToPrevious) {
              lastPointerDoubleTapAt = now;
              lastTap = null;
              toggleDoubleZoom(event.clientX, event.clientY);
            } else {
              lastTap = { time: now, x: event.clientX, y: event.clientY };
            }
          } else {
            lastTap = null;
          }
        }
        pinchInProgress = false;
      }
    };

    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);
    viewport.addEventListener("dragstart", (event) => event.preventDefault());
    viewport.addEventListener("dblclick", (event) => {
      if (performance.now() - lastPointerDoubleTapAt < 600) return;
      event.preventDefault();
      toggleDoubleZoom(event.clientX, event.clientY);
    });

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
  sectionNav.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    event.preventDefault();
    if (readingMode === "sequential") {
      keywordIndex.open = false;
      keywordIndexBrowsing = false;
      progressTrackingStarted = true;
    }
    navigateToHash(link.getAttribute("href").slice(1), readingMode);
  });
  const linkById = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
  const mobilePosition = document.createElement("div");
  mobilePosition.className = "mobile-lecture-position";
  mobilePosition.innerHTML = `
    <button class="mobile-lecture-position__toggle" type="button" aria-expanded="false" aria-controls="mobile-lecture-sections">
      <span class="mobile-lecture-position__field">${escapeHtml(fieldLabels[field])}</span>
      <span class="mobile-lecture-position__count"></span>
      <strong class="mobile-lecture-position__title"></strong>
      <span aria-hidden="true">⌄</span>
    </button>
    <nav class="mobile-lecture-position__panel" id="mobile-lecture-sections" aria-label="このページの節" hidden>
      ${page.sections.map((section, index) => `<a href="#${escapeHtml(section.id)}"><span>${index + 1} / ${page.sections.length}</span>${escapeHtml(section.short || section.title)}</a>`).join("")}
    </nav>`;
  document.body.appendChild(mobilePosition);
  const mobileToggle = mobilePosition.querySelector(".mobile-lecture-position__toggle");
  const mobilePanel = mobilePosition.querySelector(".mobile-lecture-position__panel");
  const mobileLinks = Array.from(mobilePanel.querySelectorAll("a"));
  const closeMobilePanel = (restoreFocus = false) => {
    mobilePanel.hidden = true;
    mobileToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) mobileToggle.focus();
  };
  mobileToggle.addEventListener("click", () => {
    const opening = mobilePanel.hidden;
    mobilePanel.hidden = !opening;
    mobileToggle.setAttribute("aria-expanded", String(opening));
    if (opening) (mobilePanel.querySelector("a[aria-current]") || mobileLinks[0])?.focus();
  });
  mobileLinks.forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    if (readingMode === "sequential") {
      keywordIndex.open = false;
      keywordIndexBrowsing = false;
      progressTrackingStarted = true;
    }
    closeMobilePanel();
    navigateToHash(link.getAttribute("href").slice(1), readingMode);
  }));
  mobilePosition.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || mobilePanel.hidden) return;
    event.preventDefault();
    closeMobilePanel(true);
  });

  const backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "lecture-back-to-top";
  backToTop.setAttribute("aria-label", "ページの先頭へ戻る");
  backToTop.textContent = "↑";
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" }));
  document.body.appendChild(backToTop);

  let activeId = "";
  const setActiveSection = (section, persist = progressTrackingStarted) => {
    if (!section || activeId === section.id) return;
    activeId = section.id;
    const index = page.sections.findIndex((item) => item.id === section.id);
    links.forEach((link) => link.classList.toggle("is-active", link === linkById.get(section.id)));
    mobileLinks.forEach((link) => {
      const current = link.getAttribute("href") === `#${section.id}`;
      link.classList.toggle("is-active", current);
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    mobilePosition.querySelector(".mobile-lecture-position__count").textContent = `${index + 1} / ${page.sections.length}`;
    mobilePosition.querySelector(".mobile-lecture-position__title").textContent = page.sections[index].short || page.sections[index].title;
    if (persist && readingMode === "sequential" && !keywordIndexBrowsing) writeProgress(page.sections[index], index);
    if (progressTrackingStarted && window.matchMedia("(max-width: 680px)").matches) sectionScrollCue?.reveal(linkById.get(section.id));
  };

  if ("IntersectionObserver" in window) {
    const visibleSections = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleSections.set(entry.target.id, entry);
        else visibleSections.delete(entry.target.id);
      });
      const readingLine = Math.min(window.innerHeight * 0.34, 300);
      const visible = Array.from(visibleSections.values()).sort((a, b) => (
        Math.abs(a.boundingClientRect.top - readingLine) - Math.abs(b.boundingClientRect.top - readingLine)
      ))[0];
      if (!visible) return;
      setActiveSection(visible.target);
    }, { rootMargin: "-24% 0px -62%", threshold: [0.05, 0.25, 0.5] });
    document.querySelectorAll(".lecture-section").forEach((section) => observer.observe(section));
  }
  const firstSection = document.querySelector(".lecture-section");
  if (firstSection) setActiveSection(firstSection, false);

  let scrollTicking = false;
  const initialScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      if (readingMode === "sequential" && !keywordIndexBrowsing && Math.abs(window.scrollY - initialScrollY) > 80) progressTrackingStarted = true;
      const readingLine = Math.min(window.innerHeight * 0.34, 300);
      const sections = Array.from(document.querySelectorAll(".lecture-section"));
      const currentSection = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= readingLine && rect.bottom >= readingLine;
      }) || sections.sort((left, right) => (
        Math.abs(left.getBoundingClientRect().top - readingLine) - Math.abs(right.getBoundingClientRect().top - readingLine)
      ))[0];
      setActiveSection(currentSection);
      backToTop.classList.toggle("is-visible", window.scrollY > 720);
      scrollTicking = false;
    });
  }, { passive: true });

  const decodedHash = () => {
    try {
      return decodeURIComponent(window.location.hash.slice(1));
    } catch (_error) {
      return "";
    }
  };

  const replaceHistoryState = (mode, url = window.location.href) => {
    window.history.replaceState({ ...(window.history.state || {}), lectureReading: mode }, "", url);
  };

  const navigateToHash = (id, mode, replace = false) => {
    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ ...(window.history.state || {}), lectureReading: mode }, "", `#${encodeURIComponent(id)}`);
    revealLocationHash();
  };

  const beginSequentialReading = (sectionId, replace = false) => {
    const section = document.getElementById(sectionId);
    const sectionIndex = page.sections.findIndex((item) => item.id === sectionId);
    if (!section || sectionIndex < 0) return;
    setReadingMode("sequential");
    keywordIndex.open = false;
    keywordIndexBrowsing = false;
    progressTrackingStarted = true;
    keywordTools.hidden = true;
    clearKeywordHighlight();
    writeProgress(page.sections[sectionIndex], sectionIndex);
    setActiveSection(section, false);
    navigateToHash(sectionId, "sequential", replace);
  };

  const revealLocationHash = () => {
    const hashId = decodedHash();
    if (!hashId) return;
    if (hashId.startsWith("keyword-")) {
      const keyword = keywordByTargetId.get(hashId);
      if (!keyword || !showKeyword(keyword)) {
        keywordTools.hidden = true;
        setReadingMode("sequential");
        progressTrackingStarted = false;
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      return;
    }
    if (hashId === "lecture-keyword-index") {
      keywordIndex.open = true;
      keywordIndex.scrollIntoView({ block: "start", behavior: "auto" });
      keywordIndex.querySelector("summary")?.focus({ preventScroll: true });
      return;
    }
    const section = document.getElementById(hashId);
    if (!section?.classList.contains("lecture-section")) return;
    const stateMode = window.history.state?.lectureReading === "keyword" ? "keyword" : "sequential";
    if (stateMode === "sequential") {
      setReadingMode("sequential");
      keywordTools.hidden = true;
      clearKeywordHighlight();
    } else {
      readingMode = "keyword";
    }
    setActiveSection(section, stateMode === "sequential" && progressTrackingStarted);
    section.scrollIntoView({ block: "start", behavior: "auto" });
  };

  learningGuide.querySelector("[data-reading-start]")?.addEventListener("click", (event) => {
    event.preventDefault();
    beginSequentialReading(page.sections[0].id);
  });
  learningGuide.querySelectorAll("[data-keyword-id]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateToHash(link.getAttribute("href").slice(1), "keyword");
    });
  });
  keywordTools.querySelector("[data-keyword-index-link]").addEventListener("click", (event) => {
    event.preventDefault();
    keywordIndex.open = true;
    navigateToHash("lecture-keyword-index", "keyword");
  });
  keywordTools.querySelector("[data-keyword-section-link]").addEventListener("click", (event) => {
    event.preventDefault();
    navigateToHash(event.currentTarget.getAttribute("href").slice(1), "keyword");
  });
  keywordTools.querySelector("[data-keyword-sequential]").addEventListener("click", () => {
    const section = keywordTools.closest(".lecture-section");
    if (section) beginSequentialReading(section.id);
  });

  const initialHash = decodedHash();
  const initialMode = initialHash.startsWith("keyword-") ? "keyword" : "sequential";
  replaceHistoryState(initialMode);
  window.addEventListener("hashchange", revealLocationHash);
  window.addEventListener("popstate", revealLocationHash);
  if (resumeRequested) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("resume");
    replaceHistoryState("sequential", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }
  if (initialHash) {
    window.requestAnimationFrame(revealLocationHash);
    window.setTimeout(() => window.requestAnimationFrame(revealLocationHash), 180);
  }
})();
