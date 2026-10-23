const layouts = new WeakMap();

// Original positions let the same live explanations return to the narrow view.
export function clearFullscreenExplanations(root) {
  const layout = layouts.get(root);
  if (layout) {
    for (const { node, marker } of layout.moves)
      if (root.contains(marker) && root.contains(node))
        marker.replaceWith(node);
    for (const details of layout.hidden) details.hidden = false;
    for (const rail of layout.rails) rail.remove();
    layouts.delete(root);
  }
  root.classList.remove("screen-with-explanations");
  root.style.removeProperty("--screen-left-width");
  root.style.removeProperty("--screen-right-width");
}

const help = {
  correlation: [
    "点や紫の予測点はドラッグできます。点を選んでDeleteキーで削除し、空白をクリックすると選択を解除します。",
    "残差は、点の実測値と回帰直線の予測値の差です。相関係数と直線の式を確かめながら、点を動かしてみましょう。",
  ],
  histogram: [
    "階級の幅や縦軸を変えて、積み上げた棒・箱ひげ図・元の値を見比べます。",
    "棒・箱ひげ図の外れ値・元の点を選ぶと、対応する階級を強調します。空白をクリックすると選択を解除します。",
  ],
};

export function arrangeFullscreenExplanations(root, desktop) {
  const scene = root.querySelector(":scope > .workbench");
  const current = layouts.get(root);
  if (!desktop || !scene) {
    clearFullscreenExplanations(root);
    return;
  }
  if (current?.scene === scene) return;
  clearFullscreenExplanations(root);
  const doc = root.ownerDocument;
  const makeRail = (side, label) => {
    const rail = doc.createElement("aside");
    rail.className = `screen-explanation-rail screen-explanation-${side}`;
    rail.setAttribute("aria-label", label);
    rail.tabIndex = 0;
    const heading = doc.createElement("h3");
    heading.textContent = label;
    rail.append(heading);
    return rail;
  };
  const left = makeRail("left", "操作・考え方");
  const right = makeRail("right", "凡例・読み取り");
  const layout = { scene, moves: [], hidden: [], rails: [left, right] };
  const move = (node, rail) => {
    const marker = doc.createComment("fullscreen explanation");
    node.before(marker);
    layout.moves.push({ node, marker });
    rail.append(node);
  };
  const notes = [...root.querySelectorAll(".analysis-notes > p")];
  const context = [
    ...root.querySelectorAll(
      ".legend, .corr-legend, .histogram-legend, .boxplot-summary, .boxplot-rule, .histogram-selection, p.annotation",
    ),
  ].filter(
    (node) =>
      !node.closest(
        "[hidden], .workbench-stash, .analysis-settings, .corr-details",
      ) && !node.querySelector("input, select, button, textarea"),
  );
  const split = context.length ? notes.length : Math.ceil(notes.length / 2);
  notes.forEach((node, i) => move(node, i < split ? left : right));
  context.forEach((node) => move(node, right));
  for (const text of help[doc.body.dataset.statLab] || []) {
    const paragraph = doc.createElement("p");
    paragraph.textContent = text;
    left.append(paragraph);
  }
  if (left.children.length === 1 && right.children.length === 1) return;
  for (const details of root.querySelectorAll(
    ".analysis-notes, .boxplot-help",
  )) {
    if (!details.hidden && details.children.length === 1) {
      details.hidden = true;
      layout.hidden.push(details);
    }
  }
  for (const [side, rail] of [
    ["left", left],
    ["right", right],
  ]) {
    const populated = rail.children.length > 1;
    root.style.setProperty(
      `--screen-${side}-width`,
      populated ? "clamp(160px, 16vw, 220px)" : "0px",
    );
    if (populated) root.append(rail);
  }
  layouts.set(root, layout);
  root.classList.add("screen-with-explanations");
}

// Give only the active plot a flexible viewport-height canvas. Hidden analysis
// nodes and disclosure contents must never participate in the height budget.
export function fullscreenCharts(root) {
  return [...root.querySelectorAll("svg.stat-chart")].filter(
    (svg) =>
      !svg.closest(
        "[hidden], .workbench-stash, .screen-details-bar, details:not([open])",
      ),
  );
}

export function prepareFullscreenCharts(root) {
  const charts = fullscreenCharts(root);
  if (!charts.length) {
    clearFullscreenExplanations(root);
    root.removeAttribute("data-screen-chart-flow");
    return charts;
  }
  for (const svg of charts) {
    svg.setAttribute("data-screen-chart", "");
    for (
      let node = svg.parentElement;
      node && root.contains(node);
      node = node.parentElement
    )
      node.setAttribute("data-screen-chart-flow", "");
  }
  // Keep supplementary controls accessible without adding several full rows
  // underneath the graph. Move live nodes, retaining their event handlers.
  const disclosures = [
    ...root.querySelectorAll(
      ".analysis-settings, .analysis-notes, .corr-details, .boxplot-help",
    ),
  ].filter((el) => !el.hidden);
  if (disclosures.length) {
    let footer = root.querySelector(":scope > .screen-details-bar");
    if (!footer) {
      footer = document.createElement("div");
      footer.className = "screen-details-bar";
      root.append(footer);
    }
    for (const details of disclosures)
      if (details.parentElement !== footer) footer.append(details);
  }
  arrangeFullscreenExplanations(
    root,
    root.ownerDocument.defaultView.innerWidth >= 900,
  );
  return charts;
}

export function fullscreenPlotWidth(width, height, ratio = 2.4) {
  return Math.max(0, Math.min(width, height * ratio));
}

export function sizeFullscreenCharts(root, charts) {
  const histogram = root.querySelector("#histogram-chart");
  if (histogram) {
    const box = histogram.getBoundingClientRect();
    const panel = root.querySelector(".distribution-composite");
    if (box.height > 0 && panel) {
      const width = fullscreenPlotWidth(panel.clientWidth, box.height, 3.2);
      if (width)
        panel.style.setProperty("--screen-distribution-width", `${width}px`);
    }
  }
  for (const svg of charts) {
    // The three distribution plots must retain exactly the same horizontal axis.
    if (svg.closest(".distribution-composite")) continue;
    const box = svg.getBoundingClientRect();
    if (box.height > 0 && svg.parentElement.clientWidth > 0)
      svg.style.setProperty(
        "--screen-plot-width",
        `${fullscreenPlotWidth(svg.parentElement.clientWidth, box.height)}px`,
      );
  }
}
