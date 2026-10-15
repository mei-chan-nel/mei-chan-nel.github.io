// Reflow coordinates to keep text and handles readable at the displayed chart size.
// Points keep their hit area and text keeps its readable font size.
export function fitWorkspaceCharts(container) {
  for (const svg of container.querySelectorAll("svg")) {
    const box = svg.getBoundingClientRect(),
      original = svg.viewBox.baseVal;
    if (
      box.width < 40 ||
      box.height < 60 ||
      !original.width ||
      !original.height
    )
      continue;
    const width = box.width,
      height = box.height,
      sx = width / original.width,
      sy = height / original.height;
    if (svg.dataset.layoutWidth) continue;
    svg.dataset.layoutWidth = String(width);
    svg.dataset.scaleX = String(sx);
    svg.dataset.scaleY = String(sy);
    for (const node of svg.querySelectorAll("*")) {
      if (["title", "desc", "style"].includes(node.tagName)) continue;
      for (const key of ["x", "x1", "x2", "cx", "dx", "width"])
        if (
          node.hasAttribute(key) &&
          /^[-+.\deE]+$/.test(node.getAttribute(key))
        )
          node.setAttribute(key, String(Number(node.getAttribute(key)) * sx));
      for (const key of ["y", "y1", "y2", "cy", "dy", "height"])
        if (
          node.hasAttribute(key) &&
          /^[-+.\deE]+$/.test(node.getAttribute(key))
        ) {
          let value = Number(node.getAttribute(key)) * sy;
          if (node.tagName === "text" && key === "y")
            value = Math.max(15, Math.min(height - 3, value));
          node.setAttribute(key, String(value));
        }
      if (node.hasAttribute("points")) {
        const numbers = node
          .getAttribute("points")
          .trim()
          .split(/[ ,]+/)
          .map(Number);
        node.setAttribute(
          "points",
          numbers.map((v, i) => v * (i % 2 ? sy : sx)).join(" "),
        );
      }
      if (node.tagName === "path") {
        node.setAttribute("transform", `scale(${sx} ${sy})`);
        node.setAttribute("vector-effect", "non-scaling-stroke");
      }
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
}
