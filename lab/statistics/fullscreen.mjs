import { fitWorkspaceCharts } from "./shared/chart-layout.mjs?v=20261024-ts-axis";
import {
  clearFullscreenExplanations,
  prepareFullscreenCharts,
  sizeFullscreenCharts,
} from "./shared/fullscreen-layout.mjs?v=20261024-ts-axis";

// Browser-contained focus mode: the original live nodes are moved, not copied.
// Native dialog supplies focus containment, Escape and background inertness.
export function setupFullscreen(workspace, redraw) {
  const dialog = document.createElement("dialog");
  dialog.id = "statistics-fullscreen";
  dialog.className = "statistics-fullscreen";
  dialog.setAttribute(
    "aria-label",
    document.querySelector("h1").textContent + "・全画面",
  );
  workspace.after(dialog);
  const marker = document.createComment("statistics workspace");
  const button = workspace.querySelector("[data-stat-fullscreen]");
  const screenbar = workspace.querySelector(".workspace-screenbar");
  const title = screenbar.querySelector(".workspace-screen-title");
  title.id = "statistics-fullscreen-title";
  const actions = document.createElement("div");
  actions.className = "screen-header-actions";
  actions.append(button);
  screenbar.append(actions);
  const tabs = workspace.querySelector(".view-tabs");
  const tabPosition = document.createComment("statistics tabs");
  button.setAttribute("aria-controls", dialog.id);
  button.setAttribute("aria-haspopup", "dialog");
  const pager = document.createElement("nav");
  pager.className = "screen-pager";
  pager.setAttribute("aria-label", "全画面の表示切り替え");
  pager.hidden = true;
  pager.innerHTML =
    '<button type="button" data-screen-prev>← 前の表示</button><span role="status" aria-live="polite"></span><button type="button" data-screen-next>次の表示 →</button>';
  workspace.append(pager);
  let page = 0,
    key = "",
    savedScroll = 0,
    pending = 0;
  const reset = () => {
    workspace
      .querySelectorAll("[data-screen-hidden]")
      .forEach((el) => el.removeAttribute("data-screen-hidden"));
    workspace.querySelectorAll("[data-screen-scale]").forEach((el) => {
      el.style.removeProperty("zoom");
      el.removeAttribute("data-screen-scale");
    });
  };
  const refresh = () => {
    cancelAnimationFrame(pending);
    if (!dialog.open) return;
    pending = requestAnimationFrame(() => {
      if (!dialog.open) return;
      reset();
      const root =
        workspace.querySelector("#project-view") ||
        workspace.querySelector("#experiment");
      if (!root) return;
      const dataView = root.querySelector(".data-view");
      dialog.classList.toggle("statistics-data-fullscreen", !!dataView);
      const analysis =
        root.querySelector(".workbench,.histogram-calculations") ||
        (root.id === "project-view" && !dataView ? root : null);
      dialog.classList.toggle("statistics-analysis-fullscreen", !!analysis);
      const charts = prepareFullscreenCharts(root, refresh);
      dialog.classList.toggle("statistics-chart-fullscreen", charts.length > 0);
      const frequency = root.querySelector(".histogram-frequency-table");
      root.classList.toggle("histogram-table-screen", !!frequency);
      const histogram = root.querySelector("#histogram-chart");
      root.classList.toggle("histogram-chart-screen", !!histogram);
      const nextKey =
        [
          ...workspace.querySelectorAll(
            '.view-tabs button[aria-pressed="true"]',
          ),
        ]
          .map((el) => el.textContent)
          .join("|") +
        (frequency ? "|" + root.querySelector("#bin-width").value : "");
      if (key !== nextKey) {
        page = 0;
        key = nextKey;
        dialog.scrollTop = 0;
      }
      pager.hidden = !!histogram;
      if (dataView) {
        // Keep every rendered person visible. The dialog supplies the single
        // page scrollbar; generic analysis pagination must not hide data rows.
        pager.hidden = true;
        return;
      }
      if (charts.length) {
        // The live plot gets the space left after the actual controls, metrics
        // and legends, instead of a constant height in a scrolling document.
        pager.hidden = true;
        sizeFullscreenCharts(root, charts);
        fitWorkspaceCharts(root);
        return;
      }
      if (frequency) {
        // Keep the heading and controls in place. The table owns the remaining
        // viewport height; only its body rows change when paging.
        const table = frequency.querySelector("table");
        const rows = [...table.tBodies[0].rows];
        const fixedHeight =
          table.tHead.getBoundingClientRect().height +
          table.tFoot.getBoundingClientRect().height;
        const capacity = () =>
          Math.max(
            1,
            Math.floor(
              (frequency.getBoundingClientRect().height - fixedHeight) / 32,
            ),
          );
        pager.hidden = true;
        if (rows.length > capacity()) pager.hidden = false;
        const rowCount = capacity();
        const pageCount = Math.max(1, Math.ceil(rows.length / rowCount));
        page = Math.min(page, pageCount - 1);
        const first = page * rowCount;
        rows.forEach((row, i) => {
          if (i < first || i >= first + rowCount)
            row.setAttribute("data-screen-hidden", "");
        });
        pager.querySelector("[data-screen-prev]").disabled = page === 0;
        pager.querySelector("[data-screen-next]").disabled =
          page === pageCount - 1;
        pager.querySelector("span").textContent =
          `${first + 1}〜${Math.min(rows.length, first + rowCount)}階級 / ${rows.length}階級`;
        pager.hidden = pageCount === 1;
        return;
      }
      if (analysis) {
        // Calculation walkthroughs and large tables remain readable at their
        // natural text size and can scroll independently of the fixed header.
        pager.hidden = true;
        return;
      }
      pager.hidden = true;
    });
  };
  pager.querySelector("[data-screen-prev]").onclick = () => {
    page--;
    refresh();
  };
  pager.querySelector("[data-screen-next]").onclick = () => {
    page++;
    refresh();
  };
  const enter = () => {
    savedScroll = window.scrollY;
    workspace.before(marker);
    dialog.append(workspace);
    document.documentElement.classList.add("statistics-immersive");
    button.textContent = "全画面を終了";
    button.setAttribute("aria-expanded", "true");
    if (tabs) {
      tabs.before(tabPosition);
      screenbar.insertBefore(tabs, actions);
    }
    dialog.showModal();
    redraw();
    refresh();
  };
  const exit = () => {
    reset();
    const root =
      workspace.querySelector("#project-view") ||
      workspace.querySelector("#experiment");
    if (root) clearFullscreenExplanations(root);
    document.documentElement.classList.remove("statistics-immersive");
    marker.replaceWith(workspace);
    button.textContent = "⛶ 全画面";
    button.setAttribute("aria-expanded", "false");
    if (tabPosition.parentNode) tabPosition.replaceWith(tabs);
    pager.hidden = true;
    page = 0;
    key = "";
    redraw();
    window.scrollTo({ top: savedScroll, behavior: "instant" });
    button.focus({ preventScroll: true });
  };
  button.onclick = () => (dialog.open ? dialog.close() : enter());
  dialog.addEventListener("close", exit);
  const observer = new MutationObserver((records) => {
    if (records.some((record) => !record.target.closest?.(".screen-pager")))
      refresh();
  });
  observer.observe(workspace, { childList: true, subtree: true });
  workspace.addEventListener("toggle", refresh, true);
  window.addEventListener("resize", refresh);
  return { refresh, isOpen: () => dialog.open };
}
