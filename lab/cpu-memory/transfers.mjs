import { text } from "./model.mjs";
export function transferSteps(event) {
  if (!event) return [];
  if ("phaseTransfer" in event) {
    return event.phaseTransfer ? [event.phaseTransfer] : [];
  }
  const value = event.cell ? text(event.cell) : "取得前",
    address = event.address,
    base = event.base,
    steps = [];
  if (event.hit === null)
    return [
      {
        from: "cpu",
        to: "ram",
        kind: event.kind,
        address,
        base,
        request: true,
        label: `CPU → RAM：${address}番地へ要求`,
      },
      {
        from: event.kind === "write" ? "cpu" : "ram",
        to: event.kind === "write" ? "ram" : "cpu",
        kind: event.kind,
        address,
        base,
        label:
          event.kind === "write"
            ? `CPU → RAM ${address}番地：${value}`
            : `RAM ${address}番地 → CPU：${value}`,
      },
    ];
  steps.push({
    from: "cpu",
    to: "cache",
    kind: event.kind,
    address,
    base,
    request: true,
    label: `CPU → キャッシュ：${address}番地へ要求`,
  });
  if (event.hit === false)
    steps.push(
      {
        from: "cache",
        to: "ram",
        kind: event.kind === "fetch" ? "fetch" : "read",
        address,
        base,
        request: true,
        label: `キャッシュミス → RAM：${base}・${base + 1}番地を要求`,
      },
      {
        from: "ram",
        to: "cache",
        kind: event.kind === "fetch" ? "fetch" : "read",
        address,
        base,
        block: true,
        label: `RAM ${base}・${base + 1}番地 → キャッシュ（ブロック取得）`,
      },
    );
  if (event.kind === "write")
    steps.push(
      {
        from: "cpu",
        to: "cache",
        kind: "write",
        address,
        base,
        label: `CPU → キャッシュ ${address}番地：${value}`,
      },
      {
        from: "cpu",
        to: "ram",
        kind: "write",
        address,
        base,
        label: `CPU → RAM ${address}番地：${value}（ライトスルー）`,
      },
    );
  else
    steps.push({
      from: "cache",
      to: "cpu",
      kind: event.kind,
      address,
      base,
      label: `キャッシュ ${address}番地 → CPU：${value}`,
    });
  return steps;
}
// Endpoints are inside the receiving field, rather than on a panel's outer edge.
export function transferGeometry(a, b, source, target, rect, bypass = false) {
  const horizontal = a.right <= b.left || b.right <= a.left;
  let sx, sy, tx, ty, d;
  if (horizontal) {
    const forward = a.left < b.left;
    sx = (forward ? source.right - 3 : source.left + 3) - rect.left;
    sy = (source.top + source.bottom) / 2 - rect.top;
    tx = (forward ? target.left + 5 : target.right - 5) - rect.left;
    ty = (target.top + target.bottom) / 2 - rect.top;
    const exit = (forward ? a.right + 10 : a.left - 10) - rect.left,
      entry = (forward ? b.left - 10 : b.right + 10) - rect.left;
    if (bypass) {
      const top = 8;
      d = `M ${sx} ${sy} L ${exit} ${sy} L ${exit} ${top} L ${entry} ${top} L ${entry} ${ty} L ${tx} ${ty}`;
    } else {
      const cx = (exit + entry) / 2;
      d = `M ${sx} ${sy} L ${exit} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${entry} ${ty} L ${tx} ${ty}`;
    }
  } else {
    const down = a.top < b.top;
    sx = (source.left + source.right) / 2 - rect.left;
    sy = (down ? source.bottom - 3 : source.top + 3) - rect.top;
    tx = (target.left + target.right) / 2 - rect.left;
    ty = (down ? target.top + 5 : target.bottom - 5) - rect.top;
    const cy = (down ? a.bottom + b.top : a.top + b.bottom) / 2 - rect.top;
    d = `M ${sx} ${sy} L ${sx} ${cy} L ${tx} ${cy} L ${tx} ${ty}`;
  }
  return { d, sx, sy, tx, ty };
}
export function createTransfers(workspace) {
  const svg = workspace.querySelector("svg"),
    NS = "http://www.w3.org/2000/svg";
  let event;
  const node = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  function draw() {
    svg.replaceChildren();
    workspace
      .querySelectorAll(".transfer-source,.transfer-target")
      .forEach((n) => {
        n.classList.remove("transfer-source", "transfer-target");
        n.style.removeProperty("--transfer-color");
      });
    const steps = transferSteps(event);
    if (!steps.length) return;
    const rect = workspace.getBoundingClientRect();
    const defs = node("defs", {});
    for (const kind of ["request", "value"]) {
      const marker = node("marker", {
        id: `transfer-${kind}`,
        markerWidth: 13,
        markerHeight: 13,
        refX: 12,
        refY: 6,
        orient: "auto",
        markerUnits: "userSpaceOnUse",
      });
      marker.append(
        node("path", { d: "M 0 0 L 12 6 L 0 12 Z", class: `arrow-${kind}` }),
      );
      defs.append(marker);
    }
    svg.append(defs);
    if (rect.width && rect.height)
      svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    for (const step of steps) {
      const locate = (device) =>
        device === "cpu"
          ? workspace.querySelector(
              step.request
                ? step.kind === "fetch"
                  ? "#pc"
                  : "#current-command"
                : step.kind === "fetch"
                  ? "#current-command"
                  : step.to === "cpu"
                    ? "#received-value"
                    : ".cpu-value",
            )
          : device === "cache"
            ? workspace.querySelector(
                step.request
                  ? step.from === "ram" || step.to === "ram"
                    ? "#cache-ram-port"
                    : "#cache-request-port"
                  : step.block
                    ? `.cache-line[data-base="${step.base}"]`
                    : `.cache-cell[data-address="${step.address}"]`,
              )
            : workspace.querySelector(
                `tr[data-address="${step.address}"] .live-cell`,
              );
      const source = locate(step.from),
        target = locate(step.to);
      if (!source || !target) continue;
      const purpose = step.request ? "request" : "value",
        color = `var(--${purpose}-color)`;
      source.classList.add("transfer-source");
      target.classList.add("transfer-target");
      source.style.setProperty("--transfer-color", color);
      target.style.setProperty("--transfer-color", color);
      if (!rect.width || !rect.height) continue;
      const a = workspace
          .querySelector(`.${step.from}-panel`)
          .getBoundingClientRect(),
        b = workspace
          .querySelector(`.${step.to}-panel`)
          .getBoundingClientRect();
      const geometry = transferGeometry(
          a,
          b,
          source.getBoundingClientRect(),
          target.getBoundingClientRect(),
          rect,
          (step.from === "cpu" && step.to === "ram") ||
            (step.from === "ram" && step.to === "cpu"),
        ),
        { d, sx, sy, tx, ty } = geometry;
      svg.append(
        node("path", { d, class: "transfer-halo" }),
        node("path", {
          d,
          class: `transfer-path transfer-${purpose}`,
          "marker-end": `url(#transfer-${purpose})`,
        }),
        node("circle", {
          cx: sx,
          cy: sy,
          r: 3,
          class: `transfer-origin arrow-${purpose}`,
        }),
        node("circle", {
          cx: tx,
          cy: ty,
          r: 8,
          class: `transfer-endpoint transfer-${purpose}`,
        }),
      );
    }
  }
  workspace.addEventListener("scroll", draw, true);
  window.addEventListener("scroll", draw, { passive: true });
  window.addEventListener("resize", draw);
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(draw).observe(workspace);
  return {
    update(value) {
      event = value;
      draw();
    },
    draw,
  };
}
