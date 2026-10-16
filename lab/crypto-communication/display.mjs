// Native fullscreen where available; an in-page expansion also works on phones
// and embedded pages that do not support element fullscreen.
export function createDisplayController({
  document,
  target,
  button,
  announce,
}) {
  const body = document.body;
  let fallback = false;
  const expanded = () => fallback || document.fullscreenElement === target;
  function refresh() {
    const active = expanded();
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? "↙ 全画面を終了" : "⛶ 全画面表示";
    body.classList.toggle("game-screen-lock", active);
  }
  function leaveFallback() {
    fallback = false;
    target.classList.remove("is-expanded");
    refresh();
    button.focus({ preventScroll: true });
    announce("通常の表示に戻りました。");
  }
  async function toggle() {
    if (fallback) {
      leaveFallback();
      return;
    }
    if (document.fullscreenElement === target) {
      try {
        await document.exitFullscreen();
      } catch {
        announce(
          "全画面を終了するには、ブラウザーの戻る操作かEscキーを使ってください。",
        );
      }
      refresh();
      return;
    }
    try {
      if (typeof target.requestFullscreen !== "function")
        throw new Error("Use page expansion");
      await target.requestFullscreen();
      refresh();
      announce(
        "全画面表示にしました。「全画面を終了」またはEscキーで戻れます。",
      );
    } catch {
      fallback = true;
      target.classList.add("is-expanded");
      refresh();
      announce(
        "画面いっぱいに表示しました。「全画面を終了」またはEscキーで戻れます。",
      );
    }
  }
  document.addEventListener("fullscreenchange", refresh);
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      fallback &&
      !document.querySelector("dialog[open]")
    ) {
      e.preventDefault();
      leaveFallback();
    }
  });
  // Keep keyboard focus inside the expanded game on browsers without fullscreen.
  document.addEventListener("keydown", (e) => {
    if (!fallback || e.key !== "Tab" || document.querySelector("dialog[open]"))
      return;
    const items = [
      ...target.querySelectorAll("button, select, textarea, summary, a[href]"),
    ].filter(
      (el) =>
        !el.disabled &&
        !el.closest(
          "[hidden], dialog:not([open]), details:not([open]) :not(summary)",
        ),
    );
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  });
  button.addEventListener("click", toggle);
  refresh();
  return { toggle, expanded };
}
