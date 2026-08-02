(() => {
  "use strict";

  const root = document.querySelector("[data-video-filter]");
  if (!root) return;

  const parameter = root.dataset.filterParam || "keyword";
  const searchStateKeys = new Set(["tag", "keyword", "question"]);
  const results = root.querySelector("[data-filter-results]");
  const resultsSection = root.querySelector(".filter-results");
  const heading = root.querySelector("[data-filter-heading]");
  const summary = root.querySelector("[data-filter-summary]");
  const clear = root.querySelector("[data-filter-clear]");
  let payload = null;
  let selected = [];
  let focusNumber = null;
  let lastAppliedLocation = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const hasStateParameter = (params) =>
    params.getAll(parameter).some((value) => value.trim()) || Boolean(params.get("question")?.trim());

  const hasRecognizedStateParameter = (params) =>
    [...params.keys()].some((key) => searchStateKeys.has(key));

  const queryWithoutSearchState = (url = new URL(window.location.href)) => {
    const params = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (!searchStateKeys.has(key)) params.append(key, value);
    }
    return params;
  };

  const preservedQuerySuffix = () => {
    const query = queryWithoutSearchState().toString();
    return query ? `?${query}` : "";
  };

  const parseStateFromParams = (params) => ({
    selected: [...new Set(params.getAll(parameter).map((value) => value.trim()).filter(Boolean))],
    question: params.get("question") || null,
  });

  const parseStateFromLocation = () => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
    const useHash = hasStateParameter(hashParams);
    return {
      state: parseStateFromParams(useHash ? hashParams : url.searchParams),
      hasHashState: useHash,
      hasQueryState: hasStateParameter(url.searchParams),
    };
  };

  const serializeStateToHash = (state) => {
    const params = new URLSearchParams();
    state.selected.forEach((value) => params.append(parameter, value));
    if (state.question) params.set("question", state.question);
    const serialized = params.toString();
    return serialized ? `#${serialized}` : "";
  };

  const locationKey = (url = new URL(window.location.href)) =>
    `${url.pathname}${url.search}${url.hash}`;

  const stateLocationKey = (state) => {
    const url = new URL(window.location.href);
    url.search = queryWithoutSearchState(url).toString();
    url.hash = serializeStateToHash(state);
    return locationKey(url);
  };

  const filterHref = (values, questionNumber = null) =>
    `keywords.html${preservedQuerySuffix()}${serializeStateToHash({
      selected: values,
      question: questionNumber === null ? null : String(questionNumber),
    })}`;

  const synchronizeLocation = (state) => {
    const current = new URL(window.location.href);
    const target = new URL(current);
    target.search = queryWithoutSearchState(current).toString();
    target.hash = serializeStateToHash(state);
    const hashParams = new URLSearchParams(current.hash.startsWith("#") ? current.hash.slice(1) : "");
    const targetKey = locationKey(target);
    if ((hasRecognizedStateParameter(current.searchParams) || hasRecognizedStateParameter(hashParams)) && locationKey(current) !== targetKey) {
      window.history.replaceState(window.history.state, "", `${target.pathname}${target.search}${target.hash}`);
    }
    return targetKey;
  };

  const applySearchState = (state) => {
    selected = [...state.selected];
    focusNumber = state.question === null ? null : Number(state.question);
    render();
  };

  const applyLocationState = () => {
    const parsed = parseStateFromLocation();
    const targetKey = synchronizeLocation(parsed.state);
    if (targetKey === lastAppliedLocation) return;
    applySearchState(parsed.state);
    lastAppliedLocation = targetKey;
  };

  const navigateToSearchState = (state) => {
    const nextState = {
      selected: [...new Set(state.selected)],
      question: state.question || null,
    };
    const targetKey = stateLocationKey(nextState);
    if (targetKey === locationKey()) return;
    const url = new URL(window.location.href);
    url.search = queryWithoutSearchState(url).toString();
    url.hash = serializeStateToHash(nextState);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    applySearchState(nextState);
    lastAppliedLocation = targetKey;
  };

  const toggledSelection = (value) => {
    const values = new Set(selected);
    if (values.has(value)) values.delete(value);
    else values.add(value);
    return [...values];
  };

  const matchesSelection = (question, values) =>
    values.every((value) => question.keywords.includes(value));

  const countMatches = (values) =>
    payload ? payload.questions.filter((question) => matchesSelection(question, values)).length : null;

  const syncFacetVisibility = () => {
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const hasResults = link.dataset.filterZero !== "true";
      link.hidden = !hasResults;
    });
    root.querySelectorAll("[data-facet-group]").forEach((group) => {
      const visible = [...group.querySelectorAll(".facet-link")].some((link) => !link.hidden);
      group.hidden = !visible;
    });
  };

  const syncFacetLinks = () => {
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const value = link.dataset.facetValue;
      const active = selected.includes(value);
      link.classList.toggle("is-selected", active);
      link.setAttribute("aria-pressed", String(active));
      link.href = filterHref(toggledSelection(value));
      const count = link.querySelector("[data-facet-count]");
      if (count) {
        if (active) {
          count.hidden = true;
          link.dataset.filterZero = "false";
        } else {
          const matches = countMatches([...selected, value]);
          if (matches !== null) {
            count.textContent = `${matches}問`;
            link.dataset.filterZero = String(matches === 0);
          } else {
            link.dataset.filterZero = "false";
          }
          count.hidden = false;
        }
      }
    });
    if (clear) {
      clear.hidden = selected.length === 0;
      clear.href = filterHref([]);
    }
    syncFacetVisibility();
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
      summary.textContent = `${payload.question_count}問からAND条件で絞り込みます。`;
      results.append(element("p", "filter-message", "上の一覧から、学習したい用語を選んでください。"));
      return;
    }
    const matches = payload.questions.filter((question) => matchesSelection(question, selected));
    if (focusNumber !== null) {
      const originIndex = matches.findIndex((question) => question.number === focusNumber);
      if (originIndex > 0) matches.unshift(...matches.splice(originIndex, 1));
    }
    heading.replaceChildren(
      document.createTextNode(`「${selected.join("」「")}」の問題`),
      element("span", "filter-hit-count", `${matches.length}問`),
    );
    summary.textContent = `${selected.length}キーワードのAND検索で${matches.length}問が見つかりました。`;
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

  const setSelection = (values) => {
    navigateToSearchState({ selected: values, question: null });
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

  window.addEventListener("popstate", applyLocationState);
  window.addEventListener("hashchange", applyLocationState);

  applyLocationState();
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
