import { parts } from "./circuit.mjs?v=6";
import { circuitDocument } from "./documents.mjs?v=6";

export function copyPart(graph, id) {
  const node = circuitDocument(graph).circuit.nodes.find((n) => n.id === id);
  return node ? { node } : null;
}

export function pastePart(graph, data, point) {
  const source = data?.node;
  if (!source || !Object.hasOwn(parts, source.type))
    throw Error("コピーした部品を読み取れません。");
  const candidate = circuitDocument(graph).circuit;
  if (candidate.nodes.length >= 40) throw Error("部品は40個まで配置できます。");
  const node = {
    id: `n${candidate.nextNode++}`,
    type: source.type,
    x: point.x,
    y: point.y,
  };
  if (["input", "output"].includes(source.type)) {
    node.label = [...(source.type === "input" ? "ABCD" : "XYZW")].find(
      (letter) =>
        !candidate.nodes.some(
          (n) => n.type === source.type && n.label === letter,
        ),
    );
    if (!node.label)
      throw Error(`${parts[source.type].name}は4つまで追加できます。`);
    if (source.type === "input") node.value = source.value;
    for (const key of ["name", "meaning"])
      if (source[key] !== undefined) node[key] = source[key];
  } else {
    node.number =
      source.type === "branch" ? candidate.nextBranch++ : candidate.nextGate++;
  }
  candidate.nodes.push(node);
  // Validate before editing: failed pastes must not mutate the original graph.
  return { graph: circuitDocument(candidate).circuit, id: node.id };
}
