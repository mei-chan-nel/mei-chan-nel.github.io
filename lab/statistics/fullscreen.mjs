import { fitWorkspaceCharts } from "./shared/chart-layout.mjs";

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
        root.querySelector(
          ".unified-workbench,.distribution-composite,.histogram-calculations",
        ) || (root.id === "project-view" && !dataView ? root : null);
      dialog.classList.toggle("statistics-analysis-fullscreen", !!analysis);
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
      if (analysis) {
        // Full-width labs retain the active controls, plot and result together.
        // Long results use the dialog scrollbar instead of hiding live nodes.
        pager.hidden = true;
        workspace.style.setProperty(
          "--screen-chart-height",
          `${Math.max(180, Math.min(460, window.innerHeight - 260))}px`,
        );
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
      const available = Math.max(
        110,
        dialog.getBoundingClientRect().bottom -
          root.getBoundingClientRect().top -
          pager.offsetHeight -
          20,
      );
      workspace.style.setProperty(
        "--screen-chart-height",
        `${Math.max(150, available - 200)}px`,
      );
      if (histogram) {
        const otherHeight = [...histogram.parentElement.children]
          .filter(
            (el) => el !== histogram && getComputedStyle(el).display !== "none",
          )
          .reduce((sum, el) => sum + el.getBoundingClientRect().height + 8, 0);
        workspace.style.setProperty(
          "--screen-chart-height",
          `${Math.max(150, available - otherHeight - 12)}px`,
        );
        // Keep the chart and its linked observations together in focus mode.
        // Generic analysis pagination must not move the observations offscreen.
        fitWorkspaceCharts(root);
        return;
      }
      const units = [];
      const wrappers =
        ".workbench,.workbench-mode,.workbench-body,.workbench-display,.workbench-controls,.workbench-group,.stat-grid,.panel,#project-view,.data-view,.data-table,.table-scroll,.histogram-frequency-table,#data-upload,.data-editor,.data-editor-grid,.data-editor-grid>section,.data-editor-grid>aside,#csv-preview,#csv-columns";
      const collect = (el) => {
        if (el.hidden || getComputedStyle(el).display === "none") return;
        if (el.matches("table")) {
          const rows = [...el.tBodies].flatMap((body) => [...body.rows]);
          const height = el.getBoundingClientRect().height;
          const rowHeight = Math.max(
            24,
            ...rows.map((row) => row.getBoundingClientRect().height),
          );
          const header =
            height -
            rows.reduce(
              (sum, row) => sum + row.getBoundingClientRect().height,
              0,
            );
          const count = Math.max(
            1,
            Math.floor((available - 180 - header) / rowHeight),
          );
          if (rows.length > count) {
            for (let from = 0; from < rows.length; from += count)
              units.push({
                el,
                height:
                  header + Math.min(count, rows.length - from) * rowHeight,
                rows,
                from,
                to: from + count,
              });
          } else units.push({ el, height });
        } else if (
          el.matches(wrappers) ||
          el.matches("div:has(>table)") ||
          (el.matches("details[open]") && !el.matches(".data-bulk-edit"))
        ) {
          [...el.children].forEach(collect);
        } else {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.height)
            units.push({
              el,
              height:
                box.height +
                (parseFloat(style.marginTop) || 0) +
                (parseFloat(style.marginBottom) || 0),
            });
        }
      };
      [...root.children].forEach(collect);
      const paginate = (items) => {
        const pages = [[]];
        let used = 0;
        for (const unit of items) {
          if (
            used &&
            (used + unit.height > available ||
              pages.at(-1).some((previous) => previous.el === unit.el))
          ) {
            pages.push([]);
            used = 0;
          }
          pages.at(-1).push(unit);
          used += unit.height;
        }
        return pages;
      };
      const pages = paginate(units);
      const pageCount = pages.length;
      page = Math.min(page, pageCount - 1);
      const shown = pages[page];
      const visible = new Set(shown.map((unit) => unit.el));
      for (const unit of units)
        if (!visible.has(unit.el))
          unit.el.setAttribute("data-screen-hidden", "");
      for (const unit of shown) {
        if (unit.rows)
          unit.rows.forEach((row, i) => {
            if (i < unit.from || i >= unit.to)
              row.setAttribute("data-screen-hidden", "");
          });
        if (unit.height > available) {
          unit.el.style.zoom = String(available / unit.height);
          unit.el.setAttribute("data-screen-scale", "");
        }
      }
      pager.querySelector("[data-screen-prev]").disabled = page === 0;
      pager.querySelector("[data-screen-next]").disabled =
        page === pageCount - 1;
      pager.querySelector("span").textContent =
        pageCount > 1 ? `表示 ${page + 1} / ${pageCount}` : "";
      pager.hidden = pageCount === 1;
      fitWorkspaceCharts(root);
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
    dialog.showModal();
    redraw();
    refresh();
  };
  const exit = () => {
    reset();
    document.documentElement.classList.remove("statistics-immersive");
    marker.replaceWith(workspace);
    button.textContent = "⛶ 全画面";
    button.setAttribute("aria-expanded", "false");
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
