// Same interaction as the color-vision and image-compression Labs: native
// fullscreen when available, viewport mode otherwise, with the same live DOM.
export function initFullscreen({ panel, button, doc = document, win = window }) {
  let active = false;
  let nativeOwned = false;
  let nativePending = false;
  let nativeExit = null;
  let scroll = [0, 0];

  function setMode(next) {
    if (next === active) return;
    if (next) scroll = [win.scrollX, win.scrollY];
    active = next;
    panel.classList.toggle("is-fullscreen", active);
    doc.body.classList.toggle("has-fullscreen-card", active);
    button.textContent = active ? "全画面を終了" : "全画面";
    button.setAttribute("aria-pressed", String(active));
    if (!active) {
      win.requestAnimationFrame(() => {
        if (active) return;
        win.scrollTo(...scroll);
        button.focus({ preventScroll: true });
      });
    }
  }

  async function exitNative() {
    if (nativeExit) return nativeExit;
    nativeExit = (async () => {
      try {
        await doc.exitFullscreen();
      } catch { /* Keep the exit control available if the browser refuses. */ }
      if (doc.fullscreenElement === panel) {
        setMode(true);
        return false;
      }
      return true;
    })();
    try { return await nativeExit; }
    finally { nativeExit = null; }
  }

  async function toggle() {
    if (active) {
      if (doc.fullscreenElement === panel && !(await exitNative())) return;
      setMode(false);
      return;
    }
    setMode(true);
    if (panel.requestFullscreen && doc.fullscreenEnabled && !nativePending
      && !doc.fullscreenElement) {
      nativePending = true;
      try {
        await panel.requestFullscreen();
        nativeOwned = doc.fullscreenElement === panel;
        // A second click may have left viewport mode before the API resolved.
        if (!active && nativeOwned) await exitNative();
      } catch { /* Embedded browsers may deny native fullscreen; keep viewport mode. */ }
      finally { nativePending = false; }
    }
  }

  button.addEventListener("click", () => { void toggle(); });
  doc.addEventListener("fullscreenchange", () => {
    if (doc.fullscreenElement === panel) {
      nativeOwned = true;
      if (!active) void exitNative();
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
    if (event.key !== "Tab") return;
    const elements = [...panel.querySelectorAll(
      'button, input, select, summary, a[href], [tabindex="0"]',
    )].filter((el) => !el.disabled && el.getClientRects().length);
    const first = elements[0], last = elements.at(-1);
    if (!first) return;
    if (event.shiftKey && (doc.activeElement === first || !panel.contains(doc.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (doc.activeElement === last || !panel.contains(doc.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  return { toggle, get active() { return active; } };
}
