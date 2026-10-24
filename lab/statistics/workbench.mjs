import { learningViews } from "./learning.mjs?v=20261024-ts-axis";
import { readingNotes } from "./shared/reading.mjs?v=20261024-ts-axis";
// Recompose the lab's live nodes; all original event handlers and query scopes remain intact.
export function composeWorkbench(root, id, ui, onChange) {
  if (["correlation", "histogram", "crosstab", "time-series"].includes(id)) {
    const nodes = [...root.children];
    const shell = document.createElement("div");
    shell.className =
      "workbench" +
      (["crosstab", "time-series"].includes(id) ? " unified-workbench" : "");
    shell.innerHTML = `<div class="workbench-body ${id}-body"><section class="workbench-display ${id}-display" aria-label="${id === "histogram" ? "データの分布と代表値計算" : id === "crosstab" ? "クロス集計と割合" : id === "time-series" ? "時系列の分析" : "散布図と直線"}"></section></div>`;
    shell.querySelector(".workbench-display").append(...nodes);
    root.append(shell);
    if (id === "correlation") ui.view = 0;
    return learningViews(id, ui.state).map((lesson, i) => ({
      label: lesson.title,
      active: i === (ui.view || 0),
    }));
  }
  const panels = [...root.querySelectorAll(".panel,.chart-panel")].filter(
    (el) => !el.parentElement.closest(".panel,.chart-panel"),
  );
  let main = [],
    controls = [],
    prelude = [];
  if (id === "summary") {
    main = [panels[0], panels[2], panels[3]];
    controls = [panels[1]];
  }
  if (id === "sampling") {
    main = [panels[0], panels[2], panels[3]];
    controls = [panels[1]];
  }
  if (id === "hypothesis-test") {
    main = panels.slice(0, 2);
    controls = [panels[2]];
  }
  if (id === "lorenz") {
    const bars = root.querySelector("[data-income-chart]");
    const dragPanel = document.createElement("section");
    dragPanel.className = "panel chart-panel";
    dragPanel.innerHTML =
      '<h2>所得の取っ手を動かす</h2><p class="hint">各行の値を横にドラッグします。合計を固定すると、残りの値の比率を保って調整します。</p>';
    if (bars) dragPanel.append(bars);
    main = [dragPanel, panels[0], panels[2]];
    controls = [panels[1]];
  }
  if (id === "probability") {
    prelude = [panels[0]];
    main = [panels[1], panels[3]];
    controls = [panels[2]];
  }
  main = main.filter(Boolean);
  if (!main.length) return;
  // Keep inactive nodes under the same root for callbacks that query shared controls.
  const stash = document.createElement("div");
  stash.hidden = true;
  stash.className = "workbench-stash";
  [...root.children].forEach((node) => stash.append(node));
  root.append(stash);
  const shell = document.createElement("div");
  shell.className = "workbench unified-workbench";
  shell.innerHTML = `<div class="workbench-mode"></div><div class="workbench-body"><section class="workbench-display" aria-label="グラフと分析結果"><div class="analysis-toolbar" role="group" aria-label="このタブの操作"></div><div class="analysis-view"></div><details class="analysis-settings"><summary>詳細設定</summary><div class="workbench-controls"></div></details></section></div>`;
  root.append(shell);
  const view = Math.min(ui.view || 0, main.length - 1);
  ui.view = view;
  const display = shell.querySelector(".workbench-display"),
    toolbar = shell.querySelector(".analysis-toolbar"),
    settings = shell.querySelector(".analysis-settings"),
    side = shell.querySelector(".workbench-controls");
  prelude.forEach((node) =>
    shell.querySelector(".workbench-mode").append(node),
  );
  let active = main[view];
  if (active.tagName === "DETAILS") {
    // A tab is already the disclosure: its actual result stays open.
    const section = document.createElement("section");
    section.className = active.className;
    const title = document.createElement("h2");
    title.textContent = active.querySelector(":scope > summary").textContent;
    section.append(title);
    [...active.childNodes]
      .filter((node) => node.nodeName !== "SUMMARY")
      .forEach((node) => section.append(node));
    active.replaceWith(section);
    active = section;
  }
  shell.querySelector(".analysis-view").append(active);
  const metrics =
    stash.querySelector(":scope > .metrics") ||
    active.querySelector(":scope > .metrics");
  if (metrics) display.prepend(metrics);
  side.append(controls[view] || controls[0]);
  side.querySelectorAll("h2,h3").forEach((node) => node.remove());

  const primary = {
    summary: [
      [
        "summary-selected",
        "summary-value",
        "summary-lock",
        "summary-spread",
        "summary-box-mode",
      ],
      ["summary-selected", "summary-value", "summary-denominator"],
      ["summary-box-mode", "summary-denominator"],
    ],
    sampling: [
      ["sample-n", "sample-method", "sample-one", "sample-many"],
      [
        "sample-compare-mode",
        "sample-n",
        "sample-compare-second",
        "sample-method",
        "sample-one",
        "sample-many",
      ],
      [
        "sample-compare-mode",
        "sample-n",
        "sample-compare-second",
        "sample-method",
        "sample-one",
        "sample-many",
      ],
    ],
    "hypothesis-test": [
      ["alpha", "practical", "double", "halve"],
      ["nA", "nB", "alpha", "base", "effect", "trials"],
    ],
    lorenz: [
      [
        "lock-total",
        `income-${Number(ui.state?.selected) || 0}`,
        '[data-action="equal"]',
        '[data-action="concentrate"]',
      ],
      [
        "lock-total",
        '[data-action="equal"]',
        '[data-action="concentrate"]',
        '[data-action="same-gini"]',
        '[data-action="clear-reference"]',
      ],
      ["lock-total", '[data-action="equal"]'],
    ],
  };
  const probability =
    ui.state?.mode === "normal"
      ? [
          "normal-mu",
          "normal-sigma",
          "normal-low",
          "normal-high",
          "normal-one",
          "normal-two",
          "normal-center",
        ]
      : ui.state?.mode === "binomial"
        ? ["prob-p", "prob-n", "binomial-100", "binomial-1000"]
        : ["prob-p", "coin-10", "coin-100", "coin-1000", "prob-early"];
  const ids = id === "probability" ? probability : primary[id][view];
  for (const key of ids) {
    const input = root.querySelector(key.startsWith("[") ? key : "#" + key);
    if (!input) continue;
    const node = input.closest("label") || input;
    if (node.querySelector?.('input[type="checkbox"]'))
      node.classList.add("analysis-toggle");
    toolbar.append(node);
  }
  if (id === "lorenz") {
    // The graph selects one person; the shared data tab remains the full editor.
    side
      .querySelectorAll('[id^="income-"]')
      .forEach((input) => stash.append(input.closest("label")));
  }
  const settingsKey = `${id}-${view}-settings`;
  settings.open = ui.openSections?.[settingsKey] || false;
  settings.hidden = !side.querySelector("input,select,button,details");
  settings.addEventListener("toggle", () => {
    ui.openSections ??= {};
    ui.openSections[settingsKey] = settings.open;
  });

  const lessons = learningViews(id, ui.state);
  const notes = document.createElement("details");
  notes.className = "analysis-notes";
  notes.innerHTML = "<summary>解説</summary>";
  for (const text of readingNotes(id, view, ui.state)) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    notes.append(paragraph);
  }
  for (const area of [active, side]) {
    area
      .querySelectorAll(area === side ? "p" : "p.hint,p.muted")
      .forEach((node) => {
        if (
          !node.matches(".annotation") &&
          !node.querySelector("input,select,button,textarea") &&
          !node.hasAttribute("aria-live") &&
          node.getAttribute("role") !== "status"
        )
          node.remove();
      });
  }
  const notesKey = `${id}-${view}-notes`;
  notes.open = ui.openSections?.[notesKey] || false;
  notes.addEventListener("toggle", () => {
    ui.openSections ??= {};
    ui.openSections[notesKey] = notes.open;
  });
  if (notes.childElementCount > 1) display.append(notes);
  return main.map((_, i) => ({ label: lessons[i].title, active: i === view }));
}
