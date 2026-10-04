import { createResultPanels } from "./result-panels.js?v=20261005-desktop";

const HISTORY_KEY = "programTraceFullscreen";

/** 全画面APIを使えない端末でも、同じ横向きの操作画面を使う。 */
export function createFullscreen({ runner, surface, mount, entryButton, controls, speedPanel, closeSpeed, onLayout }) {
  const root = document.documentElement;
  const workspace = runner.querySelector(".workspace-grid");
  const workspaceAnchor = document.createComment("program workspace");
  workspace.before(workspaceAnchor);
  const speedAnchor = document.createComment("speed settings");
  speedPanel.before(speedAnchor);
  const errorMessage = runner.querySelector(".error-message");
  const errorAnchor = document.createComment("execution error");
  errorMessage.before(errorAnchor);
  const exitButton = surface.querySelector("[data-fullscreen-exit]");
  const proxies = new Map([...surface.querySelectorAll("[data-control]")].map((button) => [button.dataset.control, button]));
  let active = false, ownsNative = false, requestPending = false, session = 0, historyPending = false;
  let savedScroll = [0, 0], savedState = null, layoutFrame = null, selectedLine = null;
  const panels = createResultPanels(workspace, { onLayout: layout, isFullscreen: () => active });

  function layout() {
    if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      if (active) {
        const portrait = window.innerHeight > window.innerWidth;
        root.classList.toggle("trace-fullscreen-portrait", portrait);
        root.style.setProperty("--trace-fullscreen-width", `${portrait ? window.innerHeight : window.innerWidth}px`);
        root.style.setProperty("--trace-fullscreen-height", `${portrait ? window.innerWidth : window.innerHeight}px`);
      }
      onLayout();
      if (active) revealLine();
    });
  }

  function revealLine() {
    const line = workspace.querySelector(".program-line.is-current");
    const list = workspace.querySelector(".program-lines");
    if (!line) return;
    if (line.offsetTop < list.scrollTop) list.scrollTop = line.offsetTop;
    else if (line.offsetTop + line.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = line.offsetTop + line.offsetHeight - list.clientHeight;
    }
  }

  function sync() {
    panels.refresh();
    for (const [key, proxy] of proxies) {
      const original = controls[key];
      proxy.disabled = original.disabled;
      proxy.classList.toggle("is-running", original.classList.contains("is-running"));
      if (key === "play") {
        proxy.textContent = original.getAttribute("aria-pressed") === "true" ? "Ⅱ" : "▶";
        proxy.setAttribute("aria-pressed", original.getAttribute("aria-pressed"));
        proxy.setAttribute("aria-label", original.getAttribute("aria-pressed") === "true" ? "一時停止" : "自動実行");
      }
      if (key === "speed") proxy.setAttribute("aria-expanded", original.getAttribute("aria-expanded"));
      proxy.title = original.title || proxy.getAttribute("aria-label");
    }
    const current = workspace.querySelector(".program-line.is-current")?.dataset.line;
    if (active && current !== selectedLine) { selectedLine = current; revealLine(); }
  }

  function restorePosition() {
    requestAnimationFrame(() => {
      if (active) return;
      window.scrollTo(...savedScroll);
      entryButton.focus({ preventScroll: true });
    });
  }

  function leave({ restoreHistory = true } = {}) {
    if (!active) return;
    active = false;
    closeSpeed();
    workspaceAnchor.after(workspace);
    speedAnchor.after(speedPanel);
    errorAnchor.after(errorMessage);
    panels.leaveFullscreen();
    surface.hidden = true;
    root.classList.remove("trace-fullscreen", "trace-fullscreen-portrait");
    root.style.removeProperty("--trace-fullscreen-width");
    root.style.removeProperty("--trace-fullscreen-height");
    entryButton.setAttribute("aria-expanded", "false");
    try { window.screen.orientation?.unlock?.(); } catch { /* APIがない端末も通常表示へ戻る。 */ }
    if (ownsNative && document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
    ownsNative = false;
    if (history.state?.[HISTORY_KEY] === session) {
      if (restoreHistory) {
        historyPending = true;
        entryButton.disabled = true;
        history.back();
      } else history.replaceState(savedState, "", location.href);
    }
    layout();
    restorePosition();
  }

  async function nativeFullscreen(id) {
    if (!root.requestFullscreen || document.fullscreenElement) return;
    requestPending = true;
    try {
      await root.requestFullscreen({ navigationUI: "hide" });
      if (!active) { await document.exitFullscreen().catch(() => {}); return; }
      if (session !== id) return;
      ownsNative = document.fullscreenElement === root;
      try {
        await window.screen.orientation?.lock?.("landscape");
        if (!active) window.screen.orientation?.unlock?.();
      } catch { /* 画面回転を固定できない場合は横向きのCSS表示を使う。 */ }
    } catch { /* 全画面APIがなくても表示・操作・終了は同じ。 */ }
    finally { requestPending = false; if (active) layout(); }
  }

  function enter() {
    if (active || historyPending || runner.hidden) return;
    savedScroll = [window.scrollX, window.scrollY];
    savedState = history.state;
    session++;
    history.pushState({ [HISTORY_KEY]: session, previous: savedState }, "", location.href);
    active = true;
    selectedLine = null;
    closeSpeed();
    surface.hidden = false;
    mount.append(workspace);
    surface.append(speedPanel);
    surface.append(errorMessage);
    root.classList.add("trace-fullscreen");
    entryButton.setAttribute("aria-expanded", "true");
    panels.enterFullscreen();
    sync(); layout();
    exitButton.focus({ preventScroll: true });
    void nativeFullscreen(session);
  }

  entryButton.addEventListener("click", enter);
  exitButton.addEventListener("click", () => leave());
  for (const [key, proxy] of proxies) proxy.addEventListener("click", () => { controls[key].click(); sync(); });
  window.addEventListener("resize", () => { if (active) layout(); });
  document.addEventListener("fullscreenchange", () => {
    if (active && requestPending && document.fullscreenElement === root) ownsNative = true;
    if (active && ownsNative && document.fullscreenElement !== root) leave();
  });
  window.addEventListener("popstate", () => {
    if (active && history.state?.[HISTORY_KEY] !== session) leave({ restoreHistory: false });
    else if (!active && history.state?.[HISTORY_KEY]) history.replaceState(history.state.previous, "", location.href);
    if (historyPending) { historyPending = false; entryButton.disabled = false; restorePosition(); }
  });
  document.addEventListener("keydown", (event) => {
    if (!active || event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]") || !speedPanel.hidden) return;
    event.preventDefault(); leave();
  });
  // 再読み込みで残ったモード用の履歴を通常表示の状態に戻す。
  if (history.state?.[HISTORY_KEY]) history.replaceState(history.state.previous, "", location.href);
  return {
    sync,
    leave,
    get active() { return active; },
    control(key) { return active ? proxies.get(key) : controls[key]; },
    containsSpeedControl(node) { return speedPanel.contains(node) || proxies.get("speed").contains(node); },
  };
}
