import { text } from "./model.mjs";
export function transferSteps(event) {
  if (!event) return [];
  const value = text(event.cell),
    address = event.address,
    steps = [];
  if (event.hit === null)
    return [
      {
        from: event.kind === "write" ? "cpu" : "ram",
        to: event.kind === "write" ? "ram" : "cpu",
        kind: event.kind,
        label:
          event.kind === "write"
            ? `CPU → RAM ${address}番地：${value}`
            : `RAM ${address}番地 → CPU：${value}`,
      },
    ];
  if (!event.hit)
    steps.push({
      from: "ram",
      to: "cache",
      kind: "read",
      label: `RAM ${event.base}・${event.base + 1}番地 → キャッシュ（ブロック取得）`,
    });
  if (event.kind === "write")
    steps.push(
      {
        from: "cpu",
        to: "cache",
        kind: "write",
        label: `CPU → キャッシュ ${address}番地：${value}`,
      },
      {
        from: "cache",
        to: "ram",
        kind: "write",
        label: `キャッシュ → RAM ${address}番地：${value}（ライトスルー）`,
      },
    );
  else
    steps.push({
      from: "cache",
      to: "cpu",
      kind: event.kind,
      label: `キャッシュ ${address}番地 → CPU：${value}`,
    });
  return steps;
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
    if (!event) return;
    const rect = workspace.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    const defs = node("defs", {});
    for (const kind of ["fetch", "read", "write"]) {
      const marker = node("marker", {
        id: `transfer-${kind}`,
        markerWidth: 8,
        markerHeight: 8,
        refX: 7,
        refY: 4,
        orient: "auto",
        markerUnits: "userSpaceOnUse",
      });
      marker.append(
        node("path", { d: "M 0 0 L 8 4 L 0 8 Z", class: `arrow-${kind}` }),
      );
      defs.append(marker);
    }
    svg.append(defs);
    const panels = Object.fromEntries(
      ["cpu", "cache", "ram"].map((k) => [
        k,
        workspace.querySelector(`.${k}-panel`).getBoundingClientRect(),
      ]),
    );
    const content = {
      cpu: workspace.querySelector(
        event.kind === "fetch" ? "#current-command" : ".cpu-value",
      ),
      cache:
        workspace.querySelector(`.cache-line[data-base="${event.base}"]`) ??
        workspace.querySelector(".cache-controls"),
      ram:
        workspace.querySelector(`tr[data-address="${event.address}"]`) ??
        workspace.querySelector(".ram-panel .panel-heading"),
    };
    transferSteps(event).forEach((step, i) => {
      const a = panels[step.from],
        b = panels[step.to];
      let d, x, y;
      const mid = (n) => {
        const r = content[n].getBoundingClientRect(),
          p = panels[n];
        return Math.max(
          p.top + 48,
          Math.min(p.bottom - 16, (r.top + r.bottom) / 2),
        );
      };
      if (a.right <= b.left || b.right <= a.left) {
        const forward = a.left < b.left,
          sx = (forward ? a.right : a.left) - rect.left,
          tx = (forward ? b.left : b.right) - rect.left,
          sy = mid(step.from) - rect.top + (i - 1) * 10,
          ty = mid(step.to) - rect.top + (i - 1) * 10,
          cx = (sx + tx) / 2;
        d = `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`;
        x = cx;
        y = (sy + ty) / 2;
        if (
          (step.from === "cpu" && step.to === "ram") ||
          (step.from === "ram" && step.to === "cpu")
        ) {
          const top = 8;
          d = `M ${sx} ${sy} L ${sx + (forward ? 9 : -9)} ${sy} L ${sx + (forward ? 9 : -9)} ${top} L ${tx + (forward ? -9 : 9)} ${top} L ${tx + (forward ? -9 : 9)} ${ty} L ${tx} ${ty}`;
          y = top;
        }
      } else {
        const down = a.top < b.top,
          sx = (a.left + a.right) / 2 - rect.left,
          tx = (b.left + b.right) / 2 - rect.left,
          sy = (down ? a.bottom : a.top) - rect.top,
          ty = (down ? b.top : b.bottom) - rect.top,
          cy = (sy + ty) / 2;
        d = `M ${sx} ${sy} C ${sx} ${cy}, ${tx} ${cy}, ${tx} ${ty}`;
        x = (sx + tx) / 2;
        y = cy;
      }
      const p = node("path", {
        d,
        class: `transfer-path transfer-${step.kind}`,
        "marker-end": `url(#transfer-${step.kind})`,
      });
      svg.append(p);
      const circle = node("circle", {
          cx: x,
          cy: y,
          r: 7,
          class: `transfer-number-bg transfer-${step.kind}`,
        }),
        label = node("text", {
          x,
          y: y + 3,
          "text-anchor": "middle",
          class: "transfer-number",
        });
      label.textContent = String(i + 1);
      svg.append(circle, label);
    });
  }
  workspace.addEventListener("scroll", draw, true);
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
