import { esc } from "./shared/ui.mjs";
// Recompose the lab's live nodes; all original event handlers and query scopes remain intact.
export function composeWorkbench(root, id, ui, onChange) {
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
  if (id === "correlation") {
    main = [panels[0], panels[0], panels[3]];
    controls = [panels[1], panels[2], panels[1]];
  }
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
    main = [plot, group(tables), denominator];
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
    main = [panels[0], dragPanel, panels[2]];
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
  main[view].querySelectorAll("details").forEach((d) => {
    if (id === "correlation" && view === 2) d.open = true;
  });
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
  if (id === "correlation") {
    paired(["point-x", "point-y"]);
    fold(
      [
        "corr-manual",
        "line-slope",
        "line-intercept",
        "corr-best",
        "corr-residuals",
        "corr-squares",
      ],
      "直線と残差の表示",
      "regression",
    );
  }
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

  const names = {
    correlation: ["相関と直線", "予測を確かめる", "残差の表"],
    summary: ["分布と代表値", "分散の計算", "数値の一覧"],
    histogram: ["分布を見る", "度数分布表"],
    sampling: ["今回の抽出", "推定値の分布", "区間を比べる", "計算・標本一覧"],
    crosstab: ["割合を比べる", "クロス集計表", "分子・分母"],
    "time-series": ["推移と予測", "伸び率・指数", "予測方法を比較"],
    "hypothesis-test": ["観測された差を判断", "誤判定と検出力"],
    lorenz: ["曲線とジニ係数", "所得をバーで動かす", "累積比率の計算"],
    probability: ["実験結果", "標準化"],
  };
  return main.map((_, i) => ({
    label: names[id][i],
    active: i === view,
    choose: () => {
      ui.view = i;
      onChange();
    },
  }));
}
