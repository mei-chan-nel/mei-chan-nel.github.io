(() => {
  "use strict";

  const root = document.querySelector("[data-video-filter]");
  if (!root) return;

  const parameter = root.dataset.filterParam || "keyword";
  const results = root.querySelector("[data-filter-results]");
  const resultsSection = root.querySelector(".filter-results");
  const heading = root.querySelector("[data-filter-heading]");
  const summary = root.querySelector("[data-filter-summary]");
  const search = root.querySelector("[data-facet-search]");
  const clear = root.querySelector("[data-filter-clear]");
  let payload = null;
  let selected = [];
  let focusNumber = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const readSelection = () => {
    const params = new URL(window.location.href).searchParams;
    return [...new Set(params.getAll(parameter).map((value) => value.trim()).filter(Boolean))];
  };

  const readFocus = () => {
    const value = new URL(window.location.href).searchParams.get("question");
    return value ? Number(value) : null;
  };

  const filterHref = (values, questionNumber = null) => {
    const params = new URLSearchParams();
    values.forEach((value) => params.append(parameter, value));
    if (questionNumber !== null) params.set("question", String(questionNumber));
    const query = params.toString();
    return `keywords.html${query ? `?${query}` : ""}${questionNumber !== null ? "#filter-results-heading" : ""}`;
  };

  const toggledSelection = (value) => {
    const values = new Set(selected);
    if (values.has(value)) values.delete(value);
    else values.add(value);
    return [...values];
  };

  const syncFacetLinks = () => {
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const value = link.dataset.facetValue;
      const active = selected.includes(value);
      link.classList.toggle("is-selected", active);
      link.setAttribute("aria-pressed", String(active));
      link.href = filterHref(toggledSelection(value));
    });
    if (clear) {
      clear.hidden = selected.length === 0;
      clear.href = filterHref([]);
    }
  };

  const appendKeywords = (container, keywords, questionNumber) => {
    keywords.forEach((keyword) => {
      const item = element("li");
      const link = element("a", "keyword-link", keyword);
      link.href = filterHref([keyword], questionNumber);
      item.append(link);
      container.append(item);
    });
  };

  const renderQuestion = (question) => {
    const article = element("article", "video-question-card filtered-question-card");
    article.id = `filtered-q-${question.number}`;
    if (focusNumber === question.number) article.classList.add("is-origin-question");

    const meta = element("div", "video-question-meta");
    meta.append(element("span", "", `${question.section_label} · QUESTION ${String(question.number).padStart(3, "0")}`));
    const source = element("a", "", "通常ページで開く");
    source.href = question.source_href;
    meta.append(source);
    article.append(meta, element("h2", "", question.question));

    if (question.code) {
      const pre = element("pre", "question-code");
      pre.tabIndex = 0;
      pre.setAttribute("aria-label", `Q${String(question.number).padStart(3, "0")}のプログラム`);
      pre.append(element("code", "", question.code));
      article.append(pre);
    }

    const details = element("details", "video-answer-panel");
    const detailSummary = element("summary");
    detailSummary.append(element("span", "", "答えを見る"), element("span", "detail-icon"));
    detailSummary.lastElementChild.setAttribute("aria-hidden", "true");
    const content = element("div", "video-answer-content");
    const answer = element("p");
    answer.append(element("span", "", "答え"), element("strong", "", question.answer));
    content.append(answer);
    details.append(detailSummary, content);
    article.append(details);

    const tools = element("div", "video-question-tools");
    const keywordRow = element("div", "video-keywords");
    keywordRow.append(element("span", "", "キーワード"));
    const keywords = element("ul");
    appendKeywords(keywords, question.keywords, question.number);
    keywordRow.append(keywords);
    tools.append(keywordRow);

    question.videos.forEach((video, index) => {
      const control = element("div", "video-control");
      const frameId = `filtered-video-${question.number}-${index + 1}`;
      const button = element("button", "video-trigger", `解説動画を表示${question.videos.length > 1 ? ` ${index + 1}` : ""}`);
      button.type = "button";
      button.dataset.videoId = video.id;
      button.dataset.videoTitle = video.title;
      button.setAttribute("aria-controls", frameId);
      button.setAttribute("aria-expanded", "false");
      const frame = element("div", "video-frame");
      frame.id = frameId;
      frame.hidden = true;
      control.append(button, frame);
      tools.append(control);
    });
    article.append(tools);
    return article;
  };

  const render = () => {
    syncFacetLinks();
    results.replaceChildren();
    if (!payload) return;
    if (selected.length === 0) {
      heading.textContent = "キーワードを選択してください";
      summary.textContent = `${payload.question_count}問からOR条件で抽出します。`;
      results.append(element("p", "filter-message", "上の一覧から、学習したい用語を選んでください。"));
      return;
    }
    const matches = payload.questions.filter((question) =>
      question.keywords.some((keyword) => selected.includes(keyword)),
    );
    if (focusNumber !== null) {
      const originIndex = matches.findIndex((question) => question.number === focusNumber);
      if (originIndex > 0) matches.unshift(...matches.splice(originIndex, 1));
    }
    heading.textContent = `「${selected.join("」「")}」の問題`;
    summary.textContent = `${selected.length}キーワードのOR検索で${matches.length}問が見つかりました。`;
    if (matches.length === 0) {
      results.append(element("p", "filter-message", "条件に合う問題はありません。選び直してください。"));
      return;
    }
    const fragment = document.createDocumentFragment();
    matches.forEach((question) => fragment.append(renderQuestion(question)));
    results.append(fragment);
    syncFacetLinks();
    if (focusNumber !== null && matches.some((question) => question.number === focusNumber)) {
      window.requestAnimationFrame(() => resultsSection.scrollIntoView({ block: "start" }));
    }
  };

  const setSelection = (values, push = true) => {
    selected = [...new Set(values)];
    focusNumber = null;
    if (push) window.history.pushState({}, "", filterHref(selected));
    render();
  };

  root.addEventListener("click", (event) => {
    const facet = event.target.closest("[data-facet-value]");
    if (facet && root.contains(facet)) {
      event.preventDefault();
      setSelection(toggledSelection(facet.dataset.facetValue));
      return;
    }
    if (event.target.closest("[data-filter-clear]")) {
      event.preventDefault();
      setSelection([]);
    }
  });

  if (search) {
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase("ja");
      root.querySelectorAll(".facet-links > .facet-link").forEach((link) => {
        link.hidden = Boolean(query) && !link.dataset.facetValue.toLocaleLowerCase("ja").includes(query);
      });
      root.querySelectorAll("[data-facet-group]").forEach((group) => {
        const visible = [...group.querySelectorAll(".facet-link")].some((link) => !link.hidden);
        group.hidden = Boolean(query) && !visible;
        if (query && visible) group.open = true;
      });
    });
  }

  window.addEventListener("popstate", () => {
    selected = readSelection();
    focusNumber = readFocus();
    render();
  });

  selected = readSelection();
  focusNumber = readFocus();
  syncFacetLinks();
  fetch(root.dataset.filterData)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      payload = data;
      render();
    })
    .catch(() => {
      heading.textContent = "問題データを読み込めませんでした";
      summary.textContent = "時間をおいて再読み込みしてください。";
      results.replaceChildren(element("p", "filter-message", "通常の動画問題一覧は引き続き利用できます。"));
    });
})();
