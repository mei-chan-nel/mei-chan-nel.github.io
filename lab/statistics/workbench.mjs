import { learningViews } from "./learning.mjs?v=20261023-sampling-replacement";
// Recompose the lab's live nodes; all original event handlers and query scopes remain intact.
export function composeWorkbench(root, id, ui, onChange) {
  if (id === "correlation" || id === "histogram") {
    const nodes = [...root.children];
    const shell = document.createElement("div");
    shell.className = "workbench";
    shell.innerHTML = `<div class="workbench-body ${id}-body"><section class="workbench-display ${id}-display" aria-label="${id === "histogram" ? "データの分布と代表値計算" : "散布図と直線"}"></section></div>`;
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
  const group = (nodes) => {
    const div = document.createElement("div");
    div.className = "workbench-group";
    nodes.filter(Boolean).forEach((n) => div.append(n));
    return div;
  };
  if (id === "summary") {
    main = [panels[0], panels[2], panels[3]];
    controls = [panels[1]];
  }
  if (id === "sampling") {
    main = [panels[0], panels[2], panels[3], panels[4]];
    controls = [panels[1]];
  }
  if (id === "crosstab") {
    const top = root.querySelector(":scope>.controls"),
      tables = panels.filter((p) => p.querySelector("[data-cell]")),
      plot = root.querySelector(".chart-panel"),
      denominator = panels.find(
        (p) => p.querySelector("h3")?.textContent === "選んだセルの分子・分母",
      ),
      inspector = root.querySelector(".stat-grid>aside");
    main = [group(tables), plot, denominator];
    controls = [group([top, inspector])];
  }
  if (id === "time-series") {
    main = panels.slice(0, 3);
    controls = [panels[3]];
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
      '<h2>所得の取っ手を動かす</h2><p class="hint">1人ずつの所得を横にドラッグします。総額固定中は、残りの人の比率を保って調整します。</p>';
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
  if (id === "crosstab") side.querySelector("#ct-counts").hidden = true;

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
      ["sample-n", "sample-method", "sample-one", "sample-many"],
      ["sample-n", "sample-method", "sample-one", "sample-many"],
      ["sample-n", "sample-method", "sample-one", "sample-many"],
    ],
    crosstab: [
      ["ct-mode", "ct-view"],
      ["ct-view", "ct-share-0", "ct-share-1"],
      ["ct-mode", "ct-view"],
    ],
    "time-series": [
      ["period", "forecast", "selected"],
      ["indicator", "selected"],
      ["period", "forecast"],
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
  notes.innerHTML = "<summary>操作・読み取りのヒント</summary>";
  if (lessons[view].action) {
    const lead = document.createElement("p");
    lead.textContent = lessons[view].action;
    notes.append(lead);
  }
  for (const area of [active, side]) {
    area
      .querySelectorAll(area === side ? "p" : "p.hint,p.muted")
      .forEach((node) => {
        if (
          !node.hasAttribute("aria-live") &&
          node.getAttribute("role") !== "status"
        )
          notes.append(node);
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
