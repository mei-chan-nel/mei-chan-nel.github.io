// Match the color-vision Lab: native fullscreen when available, otherwise a
// viewport-sized panel. Escape, scroll restoration and keyboard focus work in
// the fallback too. Zoom and compression settings stay in the same DOM.
export function initFullscreen({
  panel,
  button,
  redraw,
  onEnter = () => {},
  doc = document,
  win = window,
}) {
  let active = false,
    nativeOwned = false,
    scrollY = 0;
  function setMode(next) {
    if (next === active) return;
    if (next) {
      scrollY = win.scrollY;
      onEnter();
    }
    active = next;
    panel.classList.toggle("is-fullscreen", active);
    doc.body.classList.toggle("has-fullscreen-card", active);
    button.textContent = active ? "全画面を終了" : "全画面";
    button.setAttribute("aria-pressed", String(active));
    win.requestAnimationFrame(() => {
      if (!active) {
        win.scrollTo(0, scrollY);
        button.focus({ preventScroll: true });
      }
      redraw();
    });
  }
  async function toggle() {
    if (active) {
      if (doc.fullscreenElement === panel) {
        try {
          await doc.exitFullscreen();
        } catch {}
        if (doc.fullscreenElement === panel) return;
      }
      setMode(false);
      return;
    }
    setMode(true);
    if (panel.requestFullscreen && doc.fullscreenEnabled) {
      try {
        await panel.requestFullscreen();
        nativeOwned = doc.fullscreenElement === panel;
      } catch {
        // Embedded browsers may deny native fullscreen; keep viewport mode.
      }
    }
  }
  button.addEventListener("click", toggle);
  doc.addEventListener("fullscreenchange", () => {
    if (doc.fullscreenElement === panel) {
      nativeOwned = true;
      setMode(true);
    } else if (nativeOwned) {
      nativeOwned = false;
      setMode(false);
    }
  });
  doc.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.key === "Escape" && !doc.fullscreenElement) {
      event.preventDefault();
      setMode(false);
    }
    if (event.key === "Tab") {
      const elements = [
        ...panel.querySelectorAll(
          'button, input, select, summary, a[href], [tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (!first) return;
      if (
        event.shiftKey &&
        (doc.activeElement === first || !panel.contains(doc.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (doc.activeElement === last || !panel.contains(doc.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  return {
    toggle,
    get active() {
      return active;
    },
  };
}
