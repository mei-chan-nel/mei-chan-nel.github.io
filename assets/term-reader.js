(() => {
  "use strict";
  const model = window.StudyAtlasTerms;
  const body = document.querySelector("#term-explanation");
  const controls = document.querySelector("[data-term-page-state]");
  const tag = document.querySelector('meta[name="study-atlas-term-tag"]')?.content;
  if (!model || !body || !controls || !tag) return;
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = { getItem() { throw Error("Storage disabled"); }, setItem() { throw Error("Storage disabled"); } }; }
  const store = model.createStore(storage, () => {
    document.querySelector("[data-term-storage-message]").textContent = "このブラウザでは既読・お気に入りを保存できません。";
  });
  if (store.read()[tag]?.manualUnread) store.beginReading(tag);
  const button = controls.querySelector("[data-term-favorite]");
  const status = controls.querySelector("[data-term-read-status]");
  function render() {
    const state = store.read()[tag] || {};
    controls.hidden = false;
    status.textContent = state.read ? "既読" : "未読";
    status.setAttribute("aria-pressed", String(Boolean(state.read)));
    status.setAttribute("aria-label", `${tag}を${state.read ? "未読に戻す" : "既読にする"}`);
    button.setAttribute("aria-pressed", String(Boolean(state.favorite)));
    button.setAttribute("aria-label", `${tag}をお気に入り${state.favorite ? "から解除" : "に登録"}`);
    button.firstElementChild.textContent = state.favorite ? "★" : "☆";
  }
  const active = () => document.visibilityState === "visible" && document.hasFocus();
  let pageActive = true;
  const clock = model.createReadingClock(performance.now(), active());
  let elapsed = 0;
  let ranges = [];
  function sample(force = false) {
    const foreground = pageActive && active();
    elapsed += clock(performance.now(), foreground);
    if (foreground) ranges = model.mergeCoverage([...ranges, ...model.visibleRange(body.getBoundingClientRect(), window.innerHeight)]);
    const state = store.read()[tag];
    const complete = (state?.time || 0) + elapsed >= model.CONFIG.readTimeMs || model.coverageRatio([...(state?.coverage || []), ...ranges]) >= model.CONFIG.readReach;
    if (force || elapsed >= 1000 || complete) {
      if (!state?.read && (elapsed > 0 || ranges.length > 0)) {
        store.progress(tag, elapsed, ranges);
        render();
      }
      elapsed = 0; ranges = [];
    }
  }
  status.addEventListener("click", () => {
    elapsed = 0; ranges = [];
    clock(performance.now(), pageActive && active());
    store.toggleRead(tag); render();
  });
  button.addEventListener("click", () => { sample(true); store.toggleFavorite(tag); render(); });
  window.addEventListener("scroll", () => sample(), { passive: true });
  window.addEventListener("resize", () => sample());
  window.addEventListener("focus", () => sample());
  window.addEventListener("blur", () => sample(true));
  document.addEventListener("visibilitychange", () => sample(true));
  window.addEventListener("pagehide", () => { pageActive = false; sample(true); });
  window.addEventListener("pageshow", () => { pageActive = true; store.reload(); render(); sample(); });
  window.addEventListener("storage", (event) => { if (event.key === null || event.key === model.CONFIG.storageKey) { store.reload(); render(); } });
  // Saved foreground time survives navigation; background time and BFCache suspension never count.
  window.setInterval(() => sample(), 1000);
  render();
  sample();
})();

// Locate normalized search words inside the explanation, preserving the article markup.
(() => {
  const model = window.StudyAtlasTerms;
  const body = document.querySelector('#term-explanation');
  if (!model || !body) return;
  function jumpToMatch() {
    if (!location.hash.startsWith('#term-find=')) return;
    let words;
    try { words = model.keywords(decodeURIComponent(location.hash.slice(11))).slice(0,20); } catch (_) { return; }
    body.querySelectorAll('mark.term-search-hit').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '', node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('script,style,nav,button,.choice-list,[data-manual-ad]')) continue;
      nodes.push({node, start:text.length});
      text += node.textContent;
    }
    const ranges = model.matchRanges(text, words);
    let first;
    for (const {node,start} of nodes) {
      const local = ranges.map(([a,b]) => [Math.max(0,a-start),Math.min(node.length,b-start)]).filter(([a,b])=>a<b);
      if (!local.length) continue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const [a,b] of local) {
        fragment.append(document.createTextNode(node.textContent.slice(cursor,a)));
        const mark = document.createElement('mark');
        mark.className = 'term-search-hit';
        mark.textContent = node.textContent.slice(a,b);
        fragment.append(mark);
        first ||= mark;
        cursor = b;
      }
      fragment.append(document.createTextNode(node.textContent.slice(cursor)));
      node.replaceWith(fragment);
    }
    if (first) {
      first.tabIndex = -1;
      first.focus({preventScroll:true});
      first.scrollIntoView({block:'center',behavior:'instant'});
    }
  }
  window.addEventListener('hashchange',jumpToMatch);
  window.addEventListener('load',jumpToMatch,{once:true});
  jumpToMatch();
})();
