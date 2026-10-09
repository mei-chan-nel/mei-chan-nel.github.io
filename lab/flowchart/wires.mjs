import { dimensions, portPoint } from "./symbols.mjs";

function branchNodes(graph, source, stop) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n])),
    visited = new Set([source.id, stop]),
    queue = graph.edges
      .filter((e) => e.from === source.id && e.port === 0)
      .map((e) => e.to),
    nodes = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      node = byId.get(id);
    if (visited.has(id) || !node || node.scope !== source.scope) continue;
    visited.add(id);
    nodes.push(node);
    queue.push(...graph.edges.filter((e) => e.from === id).map((e) => e.to));
  }
  return nodes;
}

// Port 0 is the downward YES path. Port 1 leaves the right of the diamond.
// Orthogonal paths express the same graph edges used by execution and exports;
// visual crossings never create implicit connections.
export function wireGeometry(graph, edge) {
  const source = graph.nodes.find((n) => n.id === edge.from),
    target = graph.nodes.find((n) => n.id === edge.to),
    a = portPoint(source, "out", edge.port),
    b = portPoint(target, "in"),
    aligned = a.x === b.x,
    downward = b.y > a.y + 4,
    merging = target.type === "connector";
  let points;
  if (source.type === "decision" && edge.port === 1) {
    if (downward && b.x > a.x + 24) {
      // A NO-side block: right, then down, with one corner.
      points = [a, { x: b.x, y: a.y }, b];
    } else if (downward && merging) {
      // No else block: bypass YES, then point left into the main line.
      const lane = Math.max(
        a.x + 80,
        ...branchNodes(graph, source, target.id)
          .filter((n) => n.y > a.y && n.y < b.y)
          .map((n) => n.x + dimensions(n.type).w / 2 + 50),
      );
      points = [a, { x: lane, y: a.y }, { x: lane, y: b.y }, b];
    } else {
      const lane = Math.max(a.x + 60, b.x + dimensions(target.type).w / 2 + 50);
      points = [
        a,
        { x: lane, y: a.y },
        { x: lane, y: b.y - 30 },
        { x: b.x, y: b.y - 30 },
        b,
      ];
    }
  } else if (downward && aligned) {
    points = [a, b];
  } else if (downward && merging) {
    // Right-hand processing joins the trunk with a left-pointing arrow.
    points = [a, { x: a.x, y: b.y }, b];
  } else if (downward) {
    const mid = (a.y + b.y) / 2;
    points = [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b];
  } else {
    // Manually created back edges are valid. Keep their destination arrow
    // directed downward at the input, without making a fake merge/cycle.
    const lane = Math.min(
      source.x - dimensions(source.type).w / 2 - 55,
      target.x - dimensions(target.type).w / 2 - 55,
    );
    points = [
      a,
      { x: a.x, y: a.y + 25 },
      { x: lane, y: a.y + 25 },
      { x: lane, y: b.y - 25 },
      { x: b.x, y: b.y - 25 },
      b,
    ];
  }
  const path = points
    .map((p, i) =>
      i === 0
        ? `M${p.x} ${p.y}`
        : p.x === points[i - 1].x
          ? `V${p.y}`
          : `H${p.x}`,
    )
    .join("");
  return {
    path,
    arrow: !(downward && aligned && merging),
    bounds: {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)),
    },
  };
}
