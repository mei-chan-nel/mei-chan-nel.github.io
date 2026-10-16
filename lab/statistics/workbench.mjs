import { learningViews } from "./learning.mjs";
import { esc } from "./shared/ui.mjs";
// Recompose the lab's live nodes; all original event handlers and query scopes remain intact.
export function composeWorkbench(root, id, ui, onChange) {
  if (id === "correlation") {
    const nodes = [...root.children];
    const shell = document.createElement("div");
    shell.className = "workbench";
    shell.innerHTML =
      '<div class="workbench-body correlation-body"><section class="workbench-display correlation-display" aria-label="散布図と直線"></section></div>';
    shell.querySelector(".workbench-display").append(...nodes);
    root.append(shell);
    ui.view = 0;
    return [{ label: learningViews(id, ui.state)[0].title, active: true }];
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
  if (id === "histogram") {
    main = [panels[0], panels[2]];
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
  // Original panes are kept under this root so callbacks can still locate their controls.
  const stash = document.createElement("div");
  stash.hidden = true;
  stash.className = "workbench-stash";
  [...root.children].forEach((n) => stash.append(n));
  root.append(stash);
  const shell = document.createElement("div");
  shell.className = "workbench";
  shell.innerHTML =
    '<div class="workbench-mode"></div><div class="workbench-body"><section class="workbench-display" aria-label="グラフと分析結果"></section><aside class="workbench-controls" aria-label="分析の操作"></aside></div>';
  root.append(shell, stash);
  const topMetrics = stash.querySelector(":scope>.metrics");
  const view = Math.min(ui.view || 0, main.length - 1);
  ui.view = view;
  const display = shell.querySelector(".workbench-display"),
    side = shell.querySelector(".workbench-controls");
  prelude.forEach((n) => shell.querySelector(".workbench-mode").append(n));
  if (topMetrics) display.append(topMetrics);
  display.append(main[view]);
  side.append(controls[view] || controls[0]);
  if (main[view].tagName === "DETAILS") main[view].open = true;
  // Keep instructions beside the graph they explain. Advanced controls remain optional.
  if (id === "histogram") {
    const old = side.querySelector("#raw-details");
    if (old) old.hidden = true;
    display.classList.add("histogram-display");
  }
  if (id === "crosstab") {
    const old = side.querySelector("#ct-counts");
    if (old) old.hidden = true;
  }
  const fold = (ids, label, key, open = false) => {
    const nodes = ids
      .map((k) => root.querySelector("#" + k))
      .filter((n) => n && side.contains(n))
      .map((n) => n.closest("label") || n);
    if (!nodes.length) return;
    const d = document.createElement("details");
    d.className = "control-section";
    d.innerHTML = "<summary>" + esc(label) + "</summary>";
    d.open = ui.openSections?.[key] ?? open;
    nodes[0].before(d);
    nodes.forEach((n) => d.append(n));
    d.addEventListener("toggle", () => {
      ui.openSections ??= {};
      ui.openSections[key] = d.open;
    });
  };
  const paired = (ids) => {
    const nodes = ids
      .map((k) => root.querySelector("#" + k)?.closest("label"))
      .filter((n) => n && side.contains(n));
    if (nodes.length < 2) return;
    const g = document.createElement("div");
    g.className = "paired-controls";
    nodes[0].before(g);
    nodes.forEach((n) => g.append(n));
  };
  if (id === "summary") {
    fold(
      ["summary-sd", "summary-denominator"],
      "表示と分散の定義",
      "summary-def",
    );
  }
  if (id === "sampling") {
    fold(["sample-seed", "sample-replay"], "乱数・実験の再現", "sample-seed");
  }
  if (id === "probability") {
    fold(["prob-seed", "prob-new-seed"], "乱数と再現", "prob-seed");
  }
  if (id === "time-series") {
    if (side.querySelector("#trend:disabled")) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent =
        "生成条件は教材サンプルで試す操作です。現在は読み込んだ実測値を分析しています。";
      side.append(note);
    }
    fold(
      ["trend", "seasonal", "noise", "resample"],
      "サンプルの生成条件",
      "series-generator",
      !side.querySelector("#trend:disabled"),
    );
  }
  if (id === "crosstab") {
    fold(["ct-equal-share", "ct-align"], "人数構成をそろえて比較", "ct-align");
  }
  if (id === "hypothesis-test") {
    paired(["nA", "successA", "nB", "successB"]);
    fold(
      ["repetitions", "seed", "same-seed", "next-seed"],
      "反復数・乱数の設定",
      "test-seed",
    );
    fold(
      ["base", "effect", "trials"],
      "反復実験の真の条件",
      "test-truth",
      view === 1,
    );
  }
  if (id === "lorenz") {
    const transfer = side.querySelector("[data-action=transfer]");
    if (transfer) transfer.id = "income-transfer-button";
    fold(
      ["from", "to", "transfer-amount", "income-transfer-button"],
      "2人の間で再分配",
      "income-transfer",
    );
  }

  const lessons = learningViews(id, ui.state);
  return main.map((_, i) => ({
    label: lessons[i].title,
    active: i === view,
    choose: () => {
      ui.view = i;
      onChange();
    },
  }));
}
