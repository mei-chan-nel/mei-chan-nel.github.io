import {
  addNode,
  connect,
  flowDocument,
  checkFlowDirection,
} from "./graph.mjs";
import { portPoint } from "./symbols.mjs";
import { wireGeometry, pointOnWire } from "./wires.mjs";

// Split the exact rendered segment. The junction has no height and never runs
// the original line's source operation a second time. Retain both halves' bends.
export function joinWire(graph, from, port, edgeId, point) {
  const candidate = flowDocument(graph).graph,
    edge = candidate.edges.find((e) => e.id === edgeId),
    source = candidate.nodes.find((n) => n.id === from);
  if (!edge || !source || (edge.from === from && edge.port === port))
    throw Error("自分から出ている線には合流できません。");
  const target = candidate.nodes.find((n) => n.id === edge.from);
  if (target.scope !== source.scope)
    throw Error("同じ図の線へつないでください。");
  const projection = pointOnWire(candidate, edge, point);
  if (!projection) throw Error("線の途中を選んでください。");
  const p = projection.point,
    a = candidate.nodes.find((n) => n.id === edge.from),
    b = candidate.nodes.find((n) => n.id === edge.to),
    near = (position) => Math.hypot(p.x - position.x, p.y - position.y) < 0.001;
  // Reuse a junction or the destination input when its exact point is selected.
  const existing = near(portPoint(b, "in"))
    ? b
    : a.junction && near(portPoint(a, "out", edge.port))
      ? a
      : null;
  if (existing) {
    connect(candidate, from, port, existing.id);
    checkFlowDirection(candidate);
    return { graph: flowDocument(candidate).graph, id: existing.id };
  }
  const points = wireGeometry(candidate, edge).points,
    junction = addNode(candidate, "connector", source.scope, p.x, p.y);
  junction.junction = true;
  const via = (positions) => {
    const unique = positions.filter(
      (p, i) =>
        i === 0 || p.x !== positions[i - 1].x || p.y !== positions[i - 1].y,
    );
    return unique.slice(1, -1).map((p) => ({ x: p.x, y: p.y }));
  };
  candidate.edges = candidate.edges.filter((e) => e.id !== edge.id);
  candidate.edges.push(
    {
      id: edge.id,
      from: edge.from,
      port: edge.port,
      to: junction.id,
      via: via([...points.slice(0, projection.segment + 1), p]),
    },
    {
      id: `w${candidate.nextWire++}`,
      from: junction.id,
      port: 0,
      to: edge.to,
      via: via([p, ...points.slice(projection.segment + 1)]),
    },
  );
  connect(candidate, from, port, junction.id);
  checkFlowDirection(candidate);
  return { graph: flowDocument(candidate).graph, id: junction.id };
}

export function collapseJunctions(graph) {
  for (;;) {
    const node = graph.nodes.find(
      (n) =>
        n.junction &&
        graph.edges.filter((e) => e.to === n.id).length === 1 &&
        graph.edges.filter((e) => e.from === n.id).length === 1,
    );
    if (!node) return;
    const before = graph.edges.find((e) => e.to === node.id),
      after = graph.edges.find((e) => e.from === node.id);
    if (before.from === after.to) return;
    const points = [
        ...wireGeometry(graph, before).points,
        ...wireGeometry(graph, after).points.slice(1),
      ],
      simple = [];
    for (const point of points) {
      const a = simple.at(-2),
        b = simple.at(-1);
      if (
        a &&
        ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))
      )
        simple.pop();
      simple.push(point);
    }
    const via = simple.slice(1, -1);
    if (via.length > 8) return;
    graph.edges = graph.edges.filter(
      (e) => e.id !== before.id && e.id !== after.id,
    );
    graph.edges.push({
      id: before.id,
      from: before.from,
      port: before.port,
      to: after.to,
      ...(via.length ? { via } : {}),
    });
    graph.nodes = graph.nodes.filter((n) => n.id !== node.id);
  }
}
