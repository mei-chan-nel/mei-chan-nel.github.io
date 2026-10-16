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
    if (
      Math.abs(Number(svg.dataset.layoutWidth) - width) < 0.5 &&
      Math.abs(Number(svg.dataset.layoutHeight) - height) < 0.5
    )
      continue;
    const totalX = Number(svg.dataset.scaleX || 1) * sx;
    const totalY = Number(svg.dataset.scaleY || 1) * sy;
    svg.dataset.layoutWidth = String(width);
    svg.dataset.layoutHeight = String(height);
    svg.dataset.scaleX = String(totalX);
    svg.dataset.scaleY = String(totalY);
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
        node.setAttribute("transform", `scale(${totalX} ${totalY})`);
        node.setAttribute("vector-effect", "non-scaling-stroke");
      }
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
}
