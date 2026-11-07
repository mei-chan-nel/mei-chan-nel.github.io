(() => {
  "use strict";
  const model = window.StudyAtlasTerms;
  const controls = document.querySelector("[data-term-controls]");
  if (!model || !controls) return;
  const { CONFIG } = model;
  const list = document.querySelector("#term-results");
  const countNode = document.querySelector("[data-term-count]");
  const search = document.querySelector("#term-search");
  const searchMessage = document.querySelector("#term-search-message");
  const searchRetry = document.querySelector("[data-search-retry]");
  const recommendationMessage = document.querySelector("[data-recommendation-message]");
  const recommendationRetry = document.querySelector("[data-recommendation-retry]");
  // Accessing the localStorage property itself can throw in private/blocked contexts.
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = { getItem() { throw Error("Storage disabled"); }, setItem() { throw Error("Storage disabled"); } }; }
  const storageError = () => { document.querySelector("[data-term-storage-message]").textContent = "このブラウザでは状態を保存できません。変更はこのページを開いている間だけ有効です。"; };
  const store = model.createStore(storage, storageError);
  let records = model.loadLearning(storage);
  let scores = new Map();
  let questionTags;
  let searchData;
  let searchState = "idle";
  let recommendationState = "idle";
  const terms = [...list.children].map((node) => {
    const link = node.querySelector("a");
    const tag = link.textContent.trim();
    const status = document.createElement("button");
    status.type = "button";
    status.dataset.termReadToggle = tag;
    status.className = "term-read-status";
    const star = document.createElement("button");
    star.type = "button";
    star.className = "term-favorite";
    star.dataset.termFavorite = tag;
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    star.append(icon);
    const snippet = document.createElement("p");
    snippet.className = "term-search-excerpt";
    snippet.hidden = true;
    node.append(status, star, snippet);
    return { tag, node, link, status, star, icon, snippet };
  });
  let view = model.hasWrongHistory(records) ? "recommended" : "all";
  let filter = view === "recommended" ? "unread" : "all";
  try {
    const saved = JSON.parse(storage.getItem(CONFIG.preferencesKey) || "null");
    if (["all", "recommended"].includes(saved?.view)) view = saved.view;
    if (["all", "unread", "read", "favorite"].includes(saved?.filter)) filter = saved.filter;
  } catch (_) { /* Use history-based defaults. */ }
  search.value = "";
  controls.hidden = false;

  const loadJSON = async (url) => {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return response.json();
  };
  const isObject = (data) => data && typeof data === "object" && !Array.isArray(data);
  const loadSearch = model.lazyData(() => loadJSON("../data/term-search.json"), (data) => isObject(data) && terms.every(({ tag }) => typeof data[tag]?.title === "string" && typeof data[tag]?.body === "string"));
  const loadTags = model.lazyData(() => loadJSON("../data/term-question-tags.json"), (data) => isObject(data) && Object.values(data).every((tags) => Array.isArray(tags) && tags.every((tag) => typeof tag === "string")));

  function render() {
    const focused = document.activeElement;
    const states = store.read();
    for (const term of terms) {
      const state = states[term.tag] || {};
      term.status.textContent = state.read ? "既読" : "未読";
      term.status.setAttribute("aria-pressed", String(Boolean(state.read)));
      term.status.setAttribute("aria-label", `${term.tag}を${state.read ? "未読に戻す" : "既読にする"}`);
      term.star.setAttribute("aria-pressed", String(Boolean(state.favorite)));
      term.star.setAttribute("aria-label", `${term.tag}をお気に入り${state.favorite ? "から解除" : "に登録"}`);
      term.icon.textContent = state.favorite ? "★" : "☆";
      term.node.hidden = true;
    }
    const searching = model.keywords(search.value).length > 0;
    const ready = searching && searchState === "ready";
    const fallback = view === "recommended" && recommendationState === "error";
    const selected = model.selectTerms(terms, { view: fallback ? "all" : view, filter, query: ready ? search.value : "", scores, states, searchData });
    for (const term of selected) {
      term.node.hidden = false;
      term.snippet.replaceChildren();
      const words = model.keywords(search.value);
      term.link.href = `./${new URL(term.link.href).pathname.split("/").filter(Boolean).at(-1)}/${ready ? "#term-find=" + encodeURIComponent(words.join(" ")) : ""}`;
      if (term.excerpt) {
        const jump = document.createElement("a");
        jump.href = term.link.href;
        jump.className = "term-excerpt-link";
        let cursor = 0;
        for (const [start,end] of model.matchRanges(term.excerpt, words)) {
          jump.append(document.createTextNode(term.excerpt.slice(cursor,start)));
          const strong = document.createElement("strong");
          strong.textContent = term.excerpt.slice(start,end);
          jump.append(strong);
          cursor = end;
        }
        jump.append(document.createTextNode(term.excerpt.slice(cursor)));
        term.snippet.append(jump);
      }
      term.snippet.hidden = !term.excerpt;
      list.append(term.node);
    }
    // Nodes retain their identity (and keyboard focus) when reordered.
    for (const term of terms) if (term.node.hidden) list.append(term.node);
    if (focused?.matches("[data-term-favorite], [data-term-read-toggle]") && !focused.closest("li").hidden) focused.focus({ preventScroll: true });
    list.setAttribute("aria-busy", String(searching && searchState === "loading" || view === "recommended" && recommendationState === "loading"));
    countNode.textContent = `${ready ? "検索結果 " : ""}${selected.length}件${searching && !ready ? "（通常の一覧）" : ""}`;
    if (!selected.length && !(view === "recommended" && recommendationState === "loading")) countNode.textContent += " — 条件に合う用語はありません";
    searchMessage.textContent = !searching ? "" : searchState === "loading" ? "解説本文を読み込んでいます…" : searchState === "error" ? "検索データを読み込めませんでした。通常の一覧は引き続き利用できます。" : "";
    searchRetry.hidden = !(searching && searchState === "error");
    recommendationMessage.textContent = view !== "recommended" ? "" : recommendationState === "loading" ? "おすすめを読み込んでいます…" : fallback ? "おすすめを読み込めませんでした。用語一覧を表示しています。" : "";
    recommendationRetry.hidden = !(view === "recommended" && recommendationState === "error");
    controls.querySelector(`input[name="term-view"][value="${view}"]`).checked = true;
    controls.querySelector(`input[name="term-filter"][value="${filter}"]`).checked = true;
  }

  async function ensureSearch() {
    if (!model.keywords(search.value).length || searchState === "loading" || searchState === "ready") return;
    searchState = "loading";
    render();
    try { searchData = await loadSearch(); searchState = "ready"; }
    catch (_) { searchState = "error"; }
    render(); // Always uses the latest input, including an input cleared during loading.
  }
  async function ensureRecommendations() {
    if (!model.hasWrongHistory(records)) { scores = new Map(); render(); return; }
    if (questionTags) { scores = model.recommendationScores(records, questionTags); render(); return; }
    if (recommendationState === "loading") return;
    recommendationState = "loading";
    render();
    try {
      questionTags = await loadTags();
      scores = model.recommendationScores(records, questionTags);
      recommendationState = "ready";
    } catch (_) { recommendationState = "error"; }
    render();
  }
  controls.addEventListener("change", (event) => {
    if (event.target.name === "term-view") view = event.target.value;
    else if (event.target.name === "term-filter") filter = event.target.value;
    else return;
    search.value = "";
    try { storage.setItem(CONFIG.preferencesKey, JSON.stringify({ view, filter })); } catch (_) { storageError(); }
    render();
    if (view === "recommended") void ensureRecommendations();
  });
  function broadenSearch() {
    view = "all";
    filter = "all";
    try { storage.setItem(CONFIG.preferencesKey, JSON.stringify({ view, filter })); } catch (_) { storageError(); }
  }
  search.addEventListener("input", () => {
    if (model.keywords(search.value).length) broadenSearch();
    render(); void ensureSearch();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (model.keywords(search.value).length) broadenSearch();
    render(); void ensureSearch(); search.blur();
  });
  searchRetry.addEventListener("click", () => { void ensureSearch(); });
  recommendationRetry.addEventListener("click", () => { void ensureRecommendations(); });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-term-favorite], [data-term-read-toggle]");
    if (!button) return;
    if (button.hasAttribute("data-term-read-toggle")) store.toggleRead(button.dataset.termReadToggle);
    else store.toggleFavorite(button.dataset.termFavorite);
    render();
    if (button.closest("li").hidden) controls.querySelector('input[name="term-filter"]:checked').focus({ preventScroll: true });
  });
  const refresh = () => {
    store.reload();
    records = model.loadLearning(storage);
    if (questionTags) scores = model.recommendationScores(records, questionTags);
    render();
    if (view === "recommended") void ensureRecommendations();
  };
  window.addEventListener("storage", (event) => {
    if (event.key === null || [CONFIG.storageKey, CONFIG.learningKey, CONFIG.legacyLearningKey].includes(event.key)) refresh();
  });
  window.addEventListener("pageshow", (event) => { if (event.persisted) refresh(); });
  render();
  if (view === "recommended") void ensureRecommendations();
})();
