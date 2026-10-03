const SVG_NS = "http://www.w3.org/2000/svg";
const CLEARANCE = 6;
let markerNumber = 0;

const sameReference = (a, b) => a.name === b.name && (a.indices ?? []).join(",") === (b.indices ?? []).join(",");
const referenceLabel = ({ name, indices = [] }) => `${name}${indices.length ? `[${indices.join(", ")}]` : ""}`;

/** 複数の代入が同じ行にあっても、各右辺を対応する代入先だけにつなぐ。 */
export function assignmentLinks(event) {
  const links = [];
  for (const assignment of event?.assignments ?? []) {
    const target = { name: assignment.name, indices: assignment.indices ?? [] };
    for (const source of assignment.sources ?? []) {
      if (!links.some((link) => sameReference(link.source, source) && sameReference(link.target, target))) {
        links.push({ source, target, self: sameReference(source, target) });
      }
    }
  }
  return links;
}

const point = (x, y) => ({ x, y });
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function simplify(points) {
  const result = [];
  for (const p of points) {
    if (result.length && distance(result.at(-1), p) < .01) continue;
    while (result.length > 1) {
      const a = result.at(-2), b = result.at(-1);
      if (!(a.x === b.x && b.x === p.x || a.y === b.y && b.y === p.y)) break;
      result.pop();
    }
    result.push(p);
  }
  return result;
}

/** 線分がマスの中を横切るか。境界に触れるだけなら許可する。 */
export function crossesBox(a, b, box) {
  if (a.x === b.x) return a.x > box.left + .1 && a.x < box.right - .1
    && Math.max(a.y, b.y) > box.top + .1 && Math.min(a.y, b.y) < box.bottom - .1;
  return a.y > box.top + .1 && a.y < box.bottom - .1
    && Math.max(a.x, b.x) > box.left + .1 && Math.min(a.x, b.x) < box.right - .1;
}

function ports(box) {
  const x = (box.left + box.right) / 2, y = (box.top + box.bottom) / 2;
  return [
    [point(box.left, y), point(box.left - CLEARANCE, y)],
    [point(box.right, y), point(box.right + CLEARANCE, y)],
    [point(x, box.top), point(x, box.top - CLEARANCE)],
    [point(x, box.bottom), point(x, box.bottom + CLEARANCE)],
  ];
}

/** マスの外側を通る短い経路を選ぶ。まず近い経路を調べ、必要なら外周へ回す。 */
export function routeAssignment(source, target, obstacles, bounds) {
  let best = null, bestScore = Infinity, bestCrossings = Infinity;
  const consider = (points) => {
    const path = simplify(points);
    if (path.some((p) => p.x < 1 || p.y < 1 || p.x > bounds.width - 1 || p.y > bounds.height - 1)) return;
    let crossings = 0, length = 0;
    for (let index = 1; index < path.length; index++) {
      length += distance(path[index - 1], path[index]);
      for (const box of obstacles) if (crossesBox(path[index - 1], path[index], box)) crossings++;
    }
    const score = crossings * 100000 + length + path.length * 5;
    if (score < bestScore) { best = path; bestScore = score; bestCrossings = crossings; }
  };
  const combinations = [];
  for (const [start, a] of ports(source)) for (const [end, b] of ports(target)) {
    combinations.push({ start, a, end, b });
    consider([start, a, point(a.x, b.y), b, end]);
    consider([start, a, point(b.x, a.y), b, end]);
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    consider([start, a, point(x, a.y), point(x, b.y), b, end]);
    consider([start, a, point(a.x, y), point(b.x, y), b, end]);
  }
  if (bestCrossings > 0) {
    const xs = new Set([CLEARANCE, bounds.width - CLEARANCE]);
    const ys = new Set([CLEARANCE, bounds.height - CLEARANCE]);
    for (const box of obstacles) {
      xs.add(box.left - CLEARANCE); xs.add(box.right + CLEARANCE);
      ys.add(box.top - CLEARANCE); ys.add(box.bottom + CLEARANCE);
    }
    for (const { start, a, end, b } of combinations) {
      for (const x of xs) consider([start, a, point(x, a.y), point(x, b.y), b, end]);
      for (const y of ys) consider([start, a, point(a.x, y), point(b.x, y), b, end]);
    }
  }
  // 無理に値の上へ線を引かない。狭いときは背景色による区別を保つ。
  return bestCrossings === 0 ? best : null;
}

function roundedPath(points) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1], current = points[index], after = points[index + 1];
    const radius = Math.min(5, distance(before, current) / 2, distance(current, after) / 2);
    const near = (other) => {
      const size = distance(current, other);
      return point(current.x + (other.x - current.x) * radius / size, current.y + (other.y - current.y) * radius / size);
    };
    const a = near(before), b = near(after);
    path += ` L ${a.x} ${a.y} Q ${current.x} ${current.y} ${b.x} ${b.y}`;
  }
  return `${path} L ${points.at(-1).x} ${points.at(-1).y}`;
}

function selfPath(box, obstacles, bounds) {
  for (const [right, top] of [[true, true], [false, true], [true, false], [false, false]]) {
    const x = right ? box.right : box.left, y = top ? box.top : box.bottom;
    const sx = right ? 1 : -1, sy = top ? -1 : 1;
    const loopBox = { left: right ? x - 28 : x - 14, right: right ? x + 14 : x + 28,
      top: top ? y - 20 : y - 10, bottom: top ? y + 10 : y + 20 };
    if (loopBox.left < 0 || loopBox.right > bounds.width || loopBox.top < 0 || loopBox.bottom > bounds.height) continue;
    if (obstacles.some((other) => other !== box && other.left < loopBox.right && other.right > loopBox.left && other.top < loopBox.bottom && other.bottom > loopBox.top)) continue;
    return `M ${x - sx * 28} ${y} C ${x - sx * 28} ${y + sy * 24}, ${x + sx * 14} ${y + sy * 24}, ${x + sx * 14} ${y + sy * 3} C ${x + sx * 14} ${y - sy * 7}, ${x + sx * 8} ${y - sy * 10}, ${x} ${y - sy * 10}`;
  }
  return null;
}

/** SVGは値の上に重ねるだけで、高さやクリック操作を変えない。 */
export function createAssignmentFlow(table, rows) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("assignment-flow");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const markerId = `assignment-arrow-${++markerNumber}`;
  const defs = document.createElementNS(SVG_NS, "defs");
  const marker = document.createElementNS(SVG_NS, "marker");
  for (const [key, value] of Object.entries({ id: markerId, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 8, markerHeight: 8, markerUnits: "userSpaceOnUse", orient: "auto" })) marker.setAttribute(key, value);
  const head = document.createElementNS(SVG_NS, "path");
  head.setAttribute("d", "M 0 0 L 7 4 L 0 8 Z");
  marker.append(head); defs.append(marker);
  const group = document.createElementNS(SVG_NS, "g");
  svg.append(defs, group); table.append(svg);
  let links = [], frame = null;
  function draw() {
    frame = null; group.replaceChildren();
    if (!links.length || !table.getClientRects().length) return;
    const origin = table.getBoundingClientRect();
    const bounds = { width: origin.width, height: origin.height };
    svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    const boxes = new Map();
    const boxFor = (node) => {
      if (!boxes.has(node)) {
        const rect = node.getBoundingClientRect();
        boxes.set(node, { left: rect.left - origin.left, right: rect.right - origin.left, top: rect.top - origin.top, bottom: rect.bottom - origin.top });
      }
      return boxes.get(node);
    };
    const obstacleNodes = [...rows.querySelectorAll(".variable-row:not(.is-array), .array-element, .matrix-element, .matrix-axis, .is-array .variable-name, .is-array .variable-change")];
    const nodeFor = ({ name, indices = [] }) => {
      const row = [...rows.children].find((node) => node.dataset.variable === name);
      if (!row) return null;
      return indices.length ? [...row.querySelectorAll("[data-index]")].find((node) => node.dataset.index === indices.join(",")) : row;
    };
    for (const link of links) {
      const from = nodeFor(link.source), to = nodeFor(link.target);
      if (!from || !to) continue;
      const source = boxFor(from), target = boxFor(to);
      const obstacles = obstacleNodes.filter((node) => !(from !== node && from.contains(node)) && !(to !== node && to.contains(node))).map(boxFor);
      if (!obstacles.includes(source)) obstacles.push(source);
      if (!obstacles.includes(target)) obstacles.push(target);
      const points = link.self ? null : routeAssignment(source, target, obstacles, bounds);
      const path = link.self ? selfPath(source, obstacles, bounds) : points && roundedPath(points);
      if (!path) continue;
      const item = document.createElementNS(SVG_NS, "g");
      item.dataset.source = referenceLabel(link.source); item.dataset.target = referenceLabel(link.target);
      item.classList.toggle("is-self", link.self);
      for (const className of ["assignment-flow-halo", "assignment-flow-arrow"]) {
        const line = document.createElementNS(SVG_NS, "path");
        line.setAttribute("d", path); line.setAttribute("class", className);
        if (className === "assignment-flow-arrow") line.setAttribute("marker-end", `url(#${markerId})`);
        item.append(line);
      }
      group.append(item);
    }
  }
  function redraw() { if (frame === null && links.length) frame = requestAnimationFrame(draw); }
  const observer = new ResizeObserver(redraw);
  observer.observe(table);
  return {
    update(event) {
      links = assignmentLinks(event);
      group.replaceChildren();
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      redraw();
    },
    redraw,
  };
}
