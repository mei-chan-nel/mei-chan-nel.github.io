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
