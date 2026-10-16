import { flowDocument, clone, parts } from "./graph.mjs";

export function copyPart(graph, id) {
  const source = flowDocument(graph).graph,
    node = source.nodes.find((n) => n.id === id);
  if (!node) return null;
  // Loop endpoints form one unit, including when the end is selected.
  const ids = new Set([id, ...(node.pair ? [node.pair] : [])]);
  return {
    selected: id,
    nodes: source.nodes.filter((n) => ids.has(n.id)),
    edges: source.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    inputs:
      node.type === "input" && Object.hasOwn(source.settings.inputs, node.code)
        ? { [node.code]: source.settings.inputs[node.code] }
        : {},
  };
}

export function pastePart(graph, data, scope, point) {
  if (
    !Array.isArray(data?.nodes) ||
    ![1, 2].includes(data.nodes.length) ||
    !Array.isArray(data.edges) ||
    data.edges.length > 2
  )
    throw Error("コピーした図形を読み取れません。");
  const ids = new Set(data.nodes.map((n) => n?.id)),
    anchor = data.nodes.find((n) => n?.id === data.selected);
  if (
    !anchor ||
    ids.size !== data.nodes.length ||
    data.nodes.some(
      (n) => !n || typeof n.id !== "string" || !Object.hasOwn(parts, n.type),
    )
  )
    throw Error("コピーした図形を読み取れません。");
  if (
    data.nodes.length === 2 &&
    (data.nodes.some((n) => !["loopStart", "loopEnd"].includes(n.type)) ||
      data.nodes[0].type === data.nodes[1].type)
  )
    throw Error("繰返しの始端と終端を対にしてください。");
  for (const n of data.nodes) {
    if (["loopStart", "loopEnd"].includes(n.type)) {
      const pair = data.nodes.find((p) => p.id === n.pair);
      if (!pair || pair.pair !== n.id)
        throw Error("繰返しの始端と終端を対にしてください。");
    } else if (n.pair !== undefined)
      throw Error("コピーした図形を読み取れません。");
  }
  const candidate = flowDocument(graph).graph,
    mapping = new Map(
      data.nodes.map((n) => [n.id, `n${candidate.nextNode++}`]),
    );
  for (const source of data.nodes) {
    candidate.nodes.push({
      id: mapping.get(source.id),
      scope,
      type: source.type,
      x: point.x + source.x - anchor.x,
      y: point.y + source.y - anchor.y,
      code: source.code,
      ...(source.note !== undefined ? { note: source.note } : {}),
      ...(source.pair ? { pair: mapping.get(source.pair) } : {}),
      ...(source.junction !== undefined ? { junction: source.junction } : {}),
    });
    if (
      source.type === "input" &&
      data.inputs &&
      Object.hasOwn(data.inputs, source.code) &&
      !Object.hasOwn(candidate.settings.inputs, source.code)
    )
      Object.defineProperty(candidate.settings.inputs, source.code, {
        value: clone(data.inputs[source.code]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  for (const edge of data.edges) {
    if (!edge || !mapping.has(edge.from) || !mapping.has(edge.to))
      throw Error("コピーした矢印を読み取れません。");
    candidate.edges.push({
      id: `w${candidate.nextWire++}`,
      from: mapping.get(edge.from),
      port: edge.port,
      to: mapping.get(edge.to),
    });
  }
  return {
    graph: flowDocument(candidate).graph,
    id: mapping.get(data.selected),
  };
}
