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
  const button = controls.querySelector("[data-term-favorite]");
  const status = controls.querySelector("[data-term-read-status]");
  function render() {
    const state = store.read()[tag] || {};
    controls.hidden = false;
    status.textContent = state.read ? "既読" : "未読";
    button.setAttribute("aria-pressed", String(Boolean(state.favorite)));
    button.setAttribute("aria-label", `${tag}をお気に入り${state.favorite ? "から解除" : "に登録"}`);
    button.firstElementChild.textContent = state.favorite ? "★" : "☆";
  }
  const active = () => document.visibilityState === "visible" && document.hasFocus();
  let pageActive = true;
  const clock = model.createReadingClock(performance.now(), active());
  let elapsed = 0;
  let reach = 0;
  function sample(force = false) {
    const foreground = pageActive && active();
    elapsed += clock(performance.now(), foreground);
    if (foreground) reach = Math.max(reach, model.reachRatio(body.getBoundingClientRect(), window.innerHeight));
    const state = store.read()[tag];
    const complete = (state?.time || 0) + elapsed >= model.CONFIG.readTimeMs && Math.max(reach, state?.reach || 0) >= model.CONFIG.readReach;
    if (force || elapsed >= 1000 || complete) {
      if (!state?.read && (elapsed > 0 || reach > (state?.reach || 0))) {
        store.progress(tag, elapsed, reach);
        render();
      }
      elapsed = 0;
    }
  }
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
