// Reflow coordinates to keep text and handles readable at the displayed chart size.
// Points keep their hit area and text keeps its readable font size.
export function fitWorkspaceCharts(container) {
  for (const svg of container.querySelectorAll("svg")) {
    const box = svg.getBoundingClientRect(),
      original = svg.viewBox.baseVal;
    if (
      box.width < 40 ||
      box.height < (svg.hasAttribute("data-fixed-row-chart") ? 24 : 60) ||
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
    if (
      svg.matches("[data-sampling-population]") &&
      svg.closest(".statistics-chart-fullscreen")
    ) {
      // Reflow this pictogram grid instead of squeezing neighboring pupils
      // together when the shared navigation takes more horizontal space.
      const people = [...svg.querySelectorAll("[data-population-id]")];
      const columns = Math.max(
        1,
        Math.min(
          people.length,
          Math.ceil(Math.sqrt((people.length * width) / height)),
        ),
      );
      const rows = Math.max(1, Math.ceil(people.length / columns));
      const dx = width / columns,
        dy = height / rows;
      const scale = Math.min(1, Math.min(dx, dy) / 36);
      people.forEach((person, index) => {
        const x = ((index % columns) + 0.5) * dx;
        const y = (Math.floor(index / columns) + 0.5) * dy;
        const count = Number(person.dataset.drawCount);
        const circle = person.querySelector("circle");
        circle.setAttribute("cx", String(x));
        circle.setAttribute("cy", String(y));
        circle.setAttribute(
          "r",
          String((count > 1 ? 16 : count ? 14 : 8) * scale),
        );
        for (const label of person.querySelectorAll("text")) {
          label.setAttribute("x", String(x));
          label.setAttribute(
            "y",
            String(y + Number(label.dataset.labelOffset || 0) * scale),
          );
          label.style.fontSize = `${(label.classList.contains("sampling-repeat-count") ? 9 : 12) * scale}px`;
        }
      });
      svg.dataset.layoutWidth = String(width);
      svg.dataset.layoutHeight = String(height);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      continue;
    }
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
          const offset =
            node.tagName === "text" && key === "y"
              ? Number(node.dataset.labelOffset || 0)
              : 0;
          let value = (Number(node.getAttribute(key)) - offset) * sy + offset;
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
        if (node.hasAttribute("data-marker-radius")) {
          // Position follows the shared axes; the observation symbol keeps its
          // pixel size and shape instead of becoming a flattened diamond.
          const x = Number(node.dataset.markerX) * totalX;
          const y = Number(node.dataset.markerY) * totalY;
          const r = Number(node.dataset.markerRadius);
          node.setAttribute(
            "d",
            `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`,
          );
          node.removeAttribute("transform");
        } else node.setAttribute("transform", `scale(${totalX} ${totalY})`);
        node.setAttribute("vector-effect", "non-scaling-stroke");
      }
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
}
