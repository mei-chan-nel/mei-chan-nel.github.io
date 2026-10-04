export const MIN_PANEL_HEIGHT = 80;
export const MAX_PANEL_HEIGHT = 1600;

export function resizedPanelHeight(height, delta) {
  return Math.round(Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, height + delta)));
}

/** PCの配置を保持しながら、スマホの全画面では独立した折りたたみ状態を使う。 */
export function createResultPanels(workspace, { onLayout, isFullscreen }) {
  const desktop = window.matchMedia("(min-width: 801px)");
  const records = [...workspace.querySelectorAll(".result-column > .panel")].map((panel) => {
    const toggle = panel.querySelector(".panel-toggle");
    const title = toggle.textContent.replace("▾", "").trim();
    const handle = document.createElement("div");
    handle.className = "panel-resize-handle";
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "horizontal");
    handle.setAttribute("aria-label", `${title}の高さを変更`);
    handle.setAttribute("aria-valuemin", String(MIN_PANEL_HEIGHT));
    handle.setAttribute("aria-valuemax", String(MAX_PANEL_HEIGHT));
    handle.title = "上下にドラッグして高さを変更。矢印キーでも調整できます。";
    panel.append(handle);
    return { panel, toggle, handle, title, collapsed: false, fullscreenCollapsed: false };
  });
  let drag = null;

  function apply() {
    const fullscreen = isFullscreen(), adjustable = desktop.matches && !fullscreen;
    workspace.classList.toggle("has-adjustable-panels", adjustable);
    for (const record of records) {
      const collapsed = fullscreen ? record.fullscreenCollapsed : adjustable && record.collapsed;
      record.panel.classList.toggle("is-collapsed", collapsed);
      record.toggle.disabled = !fullscreen && !adjustable;
      record.toggle.setAttribute("aria-expanded", String(!collapsed));
      record.toggle.title = collapsed ? `${record.title}を開く` : `${record.title}を折りたたむ`;
      record.handle.hidden = !adjustable || collapsed;
      if (!collapsed && record.panel.offsetHeight) record.handle.setAttribute("aria-valuenow", String(resizedPanelHeight(record.panel.offsetHeight, 0)));
    }
  }

  function setHeight(record, height) {
    record.panel.setAttribute("data-height-adjusted", "");
    record.panel.style.setProperty("--user-panel-height", `${height}px`);
    record.handle.setAttribute("aria-valuenow", String(height));
  }
  function finishDrag() {
    if (!drag) return;
    const { record, pointerId } = drag;
    drag = null;
    if (record.handle.hasPointerCapture(pointerId)) record.handle.releasePointerCapture(pointerId);
    document.documentElement.classList.remove("is-resizing-panel");
    onLayout();
  }
  for (const record of records) {
    record.panel.querySelector(".panel-heading").addEventListener("click", (event) => {
      if (record.toggle.disabled) return;
      const control = event.target.closest("button, a, input, select");
      if (control && control !== record.toggle) return;
      if (isFullscreen()) record.fullscreenCollapsed = !record.fullscreenCollapsed;
      else record.collapsed = !record.collapsed;
      apply(); onLayout();
    });
    record.handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || record.handle.hidden) return;
      event.preventDefault();
      record.handle.focus({ preventScroll: true });
      drag = { record, pointerId: event.pointerId, y: event.clientY, height: record.panel.offsetHeight };
      record.handle.setPointerCapture(event.pointerId);
      document.documentElement.classList.add("is-resizing-panel");
    });
    record.handle.addEventListener("pointermove", (event) => {
      if (drag?.record !== record || drag.pointerId !== event.pointerId) return;
      setHeight(record, resizedPanelHeight(drag.height, event.clientY - drag.y));
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) record.handle.addEventListener(name, finishDrag);
    record.handle.addEventListener("keydown", (event) => {
      if (record.handle.hidden || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const height = event.key === "Home" ? MIN_PANEL_HEIGHT : event.key === "End" ? MAX_PANEL_HEIGHT
        : resizedPanelHeight(record.panel.offsetHeight, (event.key === "ArrowUp" ? -1 : 1) * (event.shiftKey ? 100 : 20));
      setHeight(record, height); onLayout();
    });
  }
  desktop.addEventListener("change", () => { finishDrag(); apply(); onLayout(); });
  apply();
  return {
    refresh: apply,
    enterFullscreen() {
      finishDrag();
      for (const record of records) record.fullscreenCollapsed = !record.panel.classList.contains("variables-panel");
      apply();
    },
    leaveFullscreen() { finishDrag(); apply(); },
  };
}
