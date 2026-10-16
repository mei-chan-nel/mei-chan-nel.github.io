// Keep the existing workspace and its execution state, as in the other Labs.
// Fullscreen API is optional: embedded browsers use the same viewport layout.
export function createMemoryFullscreen({
  surface,
  button,
  onChange = () => {},
}) {
  const root = document.documentElement;
  const setup = surface.querySelector("#experiment-setup");
  const records = surface.querySelector("#comparison-records");
  let active = false,
    ownsNative = false,
    requestPending = false;
  let scroll = [0, 0],
    panelState,
    outside = [];

  function restoreScroll() {
    window.scrollTo({ left: scroll[0], top: scroll[1], behavior: "instant" });
    button.focus({ preventScroll: true });
  }
  function setActive(next) {
    if (next === active) return;
    active = next;
    if (next) {
      scroll = [window.scrollX, window.scrollY];
      panelState = [setup.open, records.open];
      setup.open = false;
      records.open = false;
      outside = [];
      // Inert siblings at every ancestor level; dialogs appended to body remain usable.
      for (
        let node = surface;
        node && node !== document.body;
        node = node.parentElement
      ) {
        for (const sibling of node.parentElement.children) {
          if (
            sibling !== node &&
            sibling.tagName !== "DIALOG" &&
            !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)
          ) {
            outside.push([sibling, sibling.inert]);
            sibling.inert = true;
          }
        }
      }
    } else {
      setup.open = panelState[0];
      records.open = panelState[1];
      for (const [node, inert] of outside) node.inert = inert;
      outside = [];
    }
    surface.classList.toggle("is-fullscreen", next);
    root.classList.toggle("memory-fullscreen", next);
    button.textContent = next ? "元に戻す" : "全画面";
    button.setAttribute("aria-pressed", String(next));
    button.setAttribute(
      "aria-label",
      next ? "全画面表示を終了する" : "実験画面を全画面で表示",
    );
    onChange(next);
    if (next) button.focus({ preventScroll: true });
    else restoreScroll();
  }
  function leave() {
    if (!active) return;
    setActive(false);
    if (ownsNative && document.fullscreenElement === root) {
      ownsNative = false;
      void document.exitFullscreen().catch(() => {});
    }
  }
  async function enter() {
    if (active) return;
    setActive(true);
    if (!root.requestFullscreen || document.fullscreenElement || requestPending)
      return;
    requestPending = true;
    try {
      await root.requestFullscreen({ navigationUI: "hide" });
      if (active) ownsNative = document.fullscreenElement === root;
      else if (document.fullscreenElement === root)
        await document.exitFullscreen().catch(() => {});
    } catch {
      /* Viewport layout stays usable when native fullscreen is unavailable. */
    } finally {
      requestPending = false;
    }
  }
  button.addEventListener("click", () => {
    if (active) leave();
    else void enter();
  });
  document.addEventListener("fullscreenchange", () => {
    if (active && document.fullscreenElement === root) ownsNative = true;
    if (active && ownsNative && document.fullscreenElement !== root) {
      ownsNative = false;
      setActive(false);
    }
  });
  window.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      !active ||
      event.defaultPrevented ||
      document.querySelector("dialog[open]")
    )
      return;
    event.preventDefault();
    leave();
  });
  return {
    leave,
    get active() {
      return active;
    },
  };
}
