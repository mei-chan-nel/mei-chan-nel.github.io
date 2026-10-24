const labelWidth = (text) =>
  [...text].reduce(
    (sum, char) => sum + (/[\u0000-\u00ff]/.test(char) ? 7 : 12),
    0,
  );

function fitMosaicLabels(svg) {
  const root =
    svg.closest("#experiment") || svg.closest(".crosstab-denominator");
  for (const box of svg.querySelectorAll("[data-ct-region]")) {
    const key = box.dataset.ctRegion;
    const name = svg.querySelector(`[data-ct-region-label="${key}"]`),
      number = svg.querySelector(`[data-ct-region-number="${key}"]`);
    const legend = root?.querySelector(`[data-ct-region-legend="${key}"]`);
    const x = Number(box.getAttribute("x")),
      y = Number(box.getAttribute("y")),
      width = Number(box.getAttribute("width")),
      height = Number(box.getAttribute("height"));
    const title = name.dataset.ctLabelName,
      count = `${box.dataset.ctCount}人`;
    const twoLines =
      height >= 34 &&
      width >= Math.max(labelWidth(title), labelWidth(count)) + 8;
    const oneLine =
      !twoLines &&
      height >= 18 &&
      width >= labelWidth(title) + labelWidth(count) + 18;
    const countOnly =
      !twoLines && !oneLine && height >= 18 && width >= labelWidth(count) + 6;
    const shownTitle = oneLine ? `${title} ${count}` : title;
    if (name.textContent !== shownTitle) name.textContent = shownTitle;
    name.style.display = twoLines || oneLine ? "" : "none";
    number.style.display = twoLines || countOnly ? "" : "none";
    for (const label of [name, number]) {
      label.setAttribute("x", String(x + width / 2));
      label.style.fontSize = "12px";
    }
    name.setAttribute("y", String(y + height / 2 + (twoLines ? -4 : 4)));
    number.setAttribute("y", String(y + height / 2 + (twoLines ? 12 : 4)));
    if (legend) legend.hidden = twoLines || oneLine;
  }
}

function fitMosaic(svg, width, height) {
  const left = Math.min(80, Math.max(55, width * 0.09)),
    top = 12;
  const plotWidth = Math.max(1, width - left - 8),
    plotHeight = Math.max(1, height - 20);
  const sx = plotWidth / Number(svg.dataset.ctPlotWidth),
    sy = plotHeight / Number(svg.dataset.ctPlotHeight);
  for (const box of svg.querySelectorAll("[data-ct-region]")) {
    const key = box.dataset.ctRegion.replaceAll(",", "-");
    const clip = svg.querySelector(`#ct-region-clip-${key} rect`);
    const geometry = {
      x: left + (Number(box.dataset.ctX) - 80) * sx,
      y: top + (Number(box.dataset.ctY) - 12) * sy,
      width: Number(box.dataset.ctWidth) * sx,
      height: Number(box.dataset.ctHeight) * sy,
    };
    for (const node of [box, clip])
      for (const [name, value] of Object.entries(geometry))
        node.setAttribute(name, String(value));
  }
  for (const label of svg.querySelectorAll("[data-ct-method-y]")) {
    label.setAttribute("x", String(left - 8));
    label.setAttribute(
      "y",
      String(top + (Number(label.dataset.ctMethodY) - 12) * sy + 5),
    );
  }
  for (const line of svg.querySelectorAll("[data-ct-row-divider]")) {
    const y = top + (Number(line.dataset.ctLineY) - 12) * sy;
    line.setAttribute("x1", String(left));
    line.setAttribute("x2", String(left + plotWidth));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
  }
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  fitMosaicLabels(svg);
}

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
    if (svg.hasAttribute("data-ct-mosaic")) {
      fitMosaic(svg, width, height);
      svg.dataset.layoutWidth = String(width);
      svg.dataset.layoutHeight = String(height);
      continue;
    }
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
