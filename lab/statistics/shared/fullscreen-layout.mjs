const layouts = new WeakMap();
const preferences = new WeakMap();

// Restore the same live nodes to their original positions when fullscreen ends.
export function clearFullscreenExplanations(root) {
  const layout = layouts.get(root);
  if (layout) {
    for (const { node, marker } of layout.moves)
      if (root.contains(marker) && root.contains(node))
        marker.replaceWith(node);
    for (const details of layout.hidden) details.hidden = false;
    for (const rail of layout.rails) rail.remove();
    layout.scene.removeAttribute("data-screen-navigation-scene");
    layouts.delete(root);
  }
  root.classList.remove(
    "screen-with-explanations",
    "screen-navigation-collapsed",
    "screen-navigation-narrow",
  );
  root.style.removeProperty("--screen-explanation-width");
}

const help = {
  correlation: [
    "相関係数rは、2つの量の直線的な関係の強さを表します。",
    "残差は実測値と予測値の差です。点を動かし、直線と残差の変化を見ましょう。",
  ],
};

function applyNavigationState(root, layout, desktop) {
  const collapsed = layout.preference.collapsed ?? !desktop;
  root.classList.toggle("screen-navigation-collapsed", collapsed);
  root.classList.toggle("screen-navigation-narrow", !desktop);
  layout.rail.classList.toggle("screen-navigation-collapsed", collapsed);
  layout.content.hidden = collapsed;
  layout.label.hidden = collapsed;
  layout.toggle.setAttribute("aria-expanded", String(!collapsed));
  const title = collapsed ? "ナビ欄を開く" : "ナビ欄を折りたたむ";
  layout.toggle.setAttribute("aria-label", title);
  layout.toggle.title = title;
  const glyph = collapsed ? "‹" : "›";
  if (layout.toggle.textContent !== glyph) layout.toggle.textContent = glyph;
  root.style.setProperty(
    "--screen-explanation-width",
    collapsed ? "40px" : "clamp(210px, 22vw, 280px)",
  );
}

export function arrangeFullscreenExplanations(root, desktop, onLayout) {
  const scene = root.querySelector(
    ":scope > .workbench, :scope > .project-surface",
  );
  const current = layouts.get(root);
  if (!scene) {
    clearFullscreenExplanations(root);
    return;
  }
  if (current?.scene === scene) {
    current.onLayout = onLayout;
    applyNavigationState(root, current, desktop);
    return;
  }
  clearFullscreenExplanations(root);
  const doc = root.ownerDocument,
    owner = root.closest(".statistics-fullscreen") || root;
  let preference = preferences.get(owner);
  if (!preference) {
    preference = { collapsed: null, scrollTop: 0, tab: "" };
    preferences.set(owner, preference);
  }
  const tab =
    doc.querySelector('.view-tabs button[aria-pressed="true"]')?.textContent ||
    "";
  if (preference.tab !== tab) preference.scrollTop = 0;
  preference.tab = tab;
  const rail = doc.createElement("aside");
  rail.className = "screen-explanation-rail screen-explanation-right";
  rail.setAttribute("aria-label", "数値集計・凡例・解説");
  const header = doc.createElement("div");
  header.className = "screen-navigation-header";
  const label = doc.createElement("span");
  label.textContent = "表示情報";
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.id = "statistics-screen-navigation-toggle";
  toggle.setAttribute("data-screen-nav-toggle", "");
  const content = doc.createElement("div");
  content.className = "screen-navigation-content";
  content.id = "statistics-screen-navigation-content";
  content.tabIndex = 0;
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", "数値集計・凡例・解説");
  toggle.setAttribute("aria-controls", content.id);
  header.append(label, toggle);
  const makeSection = (label) => {
    const section = doc.createElement("section");
    section.className = "screen-explanation-section";
    section.setAttribute("aria-label", label);
    const heading = doc.createElement("h3");
    heading.textContent = label;
    section.append(heading);
    return section;
  };
  const metricsSection = makeSection("数値集計");
  const legendSection = makeSection("凡例");
  const explanationSection = makeSection("解説");
  const layout = {
    scene,
    moves: [],
    hidden: [],
    rails: [rail],
    rail,
    content,
    label,
    toggle,
    preference,
    onLayout,
  };
  const move = (node, section) => {
    const marker = doc.createComment("fullscreen navigation");
    node.before(marker);
    layout.moves.push({ node, marker });
    section.append(node);
  };
  const visible = (node) =>
    !node.closest(
      "[hidden], .workbench-stash, .analysis-settings, .corr-details",
    ) && !node.querySelector("input, select, button, textarea");
  // Move summary strips, keeping calculation results beside their formulas.
  const metrics = [
    ...scene.querySelectorAll(
      ".workbench-display > .metrics, .workbench-mode .metrics, :scope.project-surface > .metrics",
    ),
  ].filter(visible);
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
  metrics.forEach((node) => move(node, metricsSection));
  legends.forEach((node) => move(node, legendSection));
  paragraphs.forEach((node) => move(node, explanationSection));
  for (const text of help[doc.body.dataset.statLab] || []) {
    const paragraph = doc.createElement("p");
    paragraph.textContent = text;
    explanationSection.append(paragraph);
  }
  for (const section of [metricsSection, legendSection, explanationSection])
    if (section.children.length > 1) content.append(section);
  if (!content.children.length) return;
  for (const details of root.querySelectorAll(
    ".analysis-notes, .boxplot-help",
  )) {
    if (!details.hidden && details.children.length === 1) {
      details.hidden = true;
      layout.hidden.push(details);
    }
  }
  rail.append(header, content);
  scene.setAttribute("data-screen-navigation-scene", "");
  root.append(rail);
  layouts.set(root, layout);
  root.classList.add("screen-with-explanations");
  applyNavigationState(root, layout, desktop);
  toggle.addEventListener("click", () => {
    preference.collapsed = !content.hidden;
    applyNavigationState(
      root,
      layout,
      root.ownerDocument.defaultView.innerWidth >= 760,
    );
    layout.onLayout?.();
  });
  content.addEventListener(
    "scroll",
    () => {
      preference.scrollTop = content.scrollTop;
    },
    { passive: true },
  );
  doc.defaultView.requestAnimationFrame(() => {
    if (root.contains(content)) content.scrollTop = preference.scrollTop;
  });
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

export function prepareFullscreenCharts(root, onLayout) {
  const charts = fullscreenCharts(root);
  if (!charts.length) {
    arrangeFullscreenExplanations(
      root,
      root.ownerDocument.defaultView.innerWidth >= 760,
      onLayout,
    );
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
    root.ownerDocument.defaultView.innerWidth >= 760,
    onLayout,
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
