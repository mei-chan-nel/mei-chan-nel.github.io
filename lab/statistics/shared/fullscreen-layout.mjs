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
  root.style.removeProperty("--screen-explanation-width");
}

const help = {
  correlation: [
    "相関係数rは、2つの量の直線的な関係の強さを表します。",
    "残差は実測値と予測値の差です。点を動かし、直線と残差の変化を見ましょう。",
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
  const rail = doc.createElement("aside");
  rail.className = "screen-explanation-rail screen-explanation-right";
  rail.setAttribute("aria-label", "凡例と解説");
  rail.tabIndex = 0;
  const makeSection = (label) => {
    const section = doc.createElement("section");
    section.className = "screen-explanation-section";
    section.setAttribute("aria-label", label);
    const heading = doc.createElement("h3");
    heading.textContent = label;
    section.append(heading);
    return section;
  };
  const legendSection = makeSection("凡例");
  const explanationSection = makeSection("解説");
  const layout = { scene, moves: [], hidden: [], rails: [rail] };
  const move = (node, section) => {
    const marker = doc.createComment("fullscreen explanation");
    node.before(marker);
    layout.moves.push({ node, marker });
    section.append(node);
  };
  const visible = (node) =>
    !node.closest(
      "[hidden], .workbench-stash, .analysis-settings, .corr-details",
    ) && !node.querySelector("input, select, button, textarea");
  const legends = [
    ...root.querySelectorAll(".legend, .corr-legend, .histogram-legend"),
  ].filter(visible);
  const paragraphs = [
    ...new Set([
      ...root.querySelectorAll(".analysis-notes > p"),
      ...root.querySelectorAll("p.annotation, .histogram-selection"),
    ]),
  ].filter(
    (node) => visible(node) && !legends.some((legend) => legend.contains(node)),
  );
  legends.forEach((node) => move(node, legendSection));
  paragraphs.forEach((node) => move(node, explanationSection));
  for (const text of help[doc.body.dataset.statLab] || []) {
    const paragraph = doc.createElement("p");
    paragraph.textContent = text;
    explanationSection.append(paragraph);
  }
  for (const section of [legendSection, explanationSection])
    if (section.children.length > 1) rail.append(section);
  if (!rail.children.length) return;
  for (const details of root.querySelectorAll(
    ".analysis-notes, .boxplot-help",
  )) {
    if (!details.hidden && details.children.length === 1) {
      details.hidden = true;
      layout.hidden.push(details);
    }
  }
  root.style.setProperty(
    "--screen-explanation-width",
    "clamp(210px, 22vw, 280px)",
  );
  root.append(rail);
  layouts.set(root, layout);
  root.classList.add("screen-with-explanations");
}

// Give only the active plot a flexible viewport-height canvas. Hidden analysis
// nodes and disclosure contents must never participate in the height budget.
export function fullscreenCharts(root) {
  return [...root.querySelectorAll("svg.stat-chart")].filter(
    (svg) =>
      !svg.hasAttribute("data-scroll-chart") &&
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
    // An interval history has a short fixed axis above a scrolling plot.
    if (svg.hasAttribute("data-sampling-axis")) continue;
    const box = svg.getBoundingClientRect();
    if (box.height > 0 && svg.parentElement.clientWidth > 0)
      svg.style.setProperty(
        "--screen-plot-width",
        `${fullscreenPlotWidth(svg.parentElement.clientWidth, box.height)}px`,
      );
  }
}
