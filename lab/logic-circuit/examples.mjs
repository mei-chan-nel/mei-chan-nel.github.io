export function exampleCircuit(type, width = 900, height = 340) {
  const nodes = [],
    edges = [];
  let nextNode = 1,
    nextWire = 1,
    nextGate = 1,
    nextBranch = 1;
  const add = (kind, x, y, label = "", meaning = "") => {
    const node = { id: `n${nextNode++}`, type: kind, x, y };
    if (kind === "input") Object.assign(node, { label, value: 0 });
    else if (kind === "output") Object.assign(node, { label, meaning });
    else node.number = kind === "branch" ? nextBranch++ : nextGate++;
    nodes.push(node);
    return node;
  };
  const wire = (a, b, toPort = 0, fromPort = 0) =>
    edges.push({
      id: `w${nextWire++}`,
      from: { node: a.id, port: fromPort },
      to: { node: b.id, port: toPort },
    });
  const center = height / 2;
  if (["xor", "adder"].includes(type)) {
    const a = add("input", 44, 92, "A"),
      b = add("input", 44, 268, "B");
    const ja = add("branch", 150, 92),
      jb = add("branch", 150, 268);
    const either = add("or", 340, 112),
      both = add("and", 340, 236);
    const split = type === "adder" ? add("branch", 465, 236) : null;
    const invert = add("not", 620, 218),
      sum = add("and", 785, 150);
    const x = add("output", 920, 150, "X", type === "adder" ? "和" : "");
    wire(a, ja);
    wire(b, jb);
    wire(ja, either);
    wire(jb, either, 1);
    wire(ja, both, 0, 1);
    wire(jb, both, 1, 1);
    if (split) {
      wire(both, split);
      wire(split, invert);
    } else wire(both, invert);
    wire(either, sum);
    wire(invert, sum, 1);
    wire(sum, x);
    if (split) wire(split, add("output", 920, 300, "Y", "桁上がり"), 0, 1);
  } else {
    const left = Math.max(36, width * 0.08),
      right = width - Math.max(40, width * 0.08);
    const a = add("input", left, type === "not" ? center : center - 62, "A");
    const b = type === "not" ? null : add("input", left, center + 62, "B");
    const gate = type === "blank" ? null : add(type, width * 0.5, center);
    const output = add("output", right, center, "X");
    if (gate) {
      wire(a, gate);
      if (b) wire(b, gate, 1);
      wire(gate, output);
    }
  }
  return {
    nodes,
    edges,
    nextNode,
    nextWire,
    nextGate,
    nextBranch,
    example: type === "blank" ? "" : type,
  };
}
