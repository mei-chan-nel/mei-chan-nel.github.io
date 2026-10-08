// Acyclic, combinational logic. null means an incomplete path, never implicit 0.
export const parts = {
  input: { inputs: 0, outputs: 1, name: "入力" },
  output: { inputs: 1, outputs: 0, name: "出力" },
  and: { inputs: 2, outputs: 1, name: "論理積" },
  or: { inputs: 2, outputs: 1, name: "論理和" },
  not: { inputs: 1, outputs: 1, name: "否定" },
  branch: { inputs: 1, outputs: 2, name: "分岐" },
};

export function connectionProblem(graph, from, to) {
  const source = graph.nodes.find((n) => n.id === from.node);
  const target = graph.nodes.find((n) => n.id === to.node);
  if (
    !source ||
    !target ||
    !parts[source.type] ||
    !parts[target.type] ||
    !Number.isInteger(from.port) ||
    !Number.isInteger(to.port) ||
    from.port < 0 ||
    from.port >= parts[source.type].outputs ||
    to.port < 0 ||
    to.port >= parts[target.type].inputs
  )
    return "出力端子から入力端子へつないでください。";
  const remaining = graph.edges.filter(
    (e) => e.to.node !== to.node || e.to.port !== to.port,
  );
  const visit = (id) => {
    if (id === source.id) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    return remaining.some((e) => e.from.node === id && visit(e.to.node));
  };
  const visited = new Set();
  if (visit(target.id))
    return "組合せ回路のため、信号が一周して戻る接続はできません。";
  return "";
}

export function connect(graph, from, to, id) {
  const problem = connectionProblem(graph, from, to);
  if (problem) throw new Error(problem);
  return {
    ...graph,
    edges: [
      ...graph.edges.filter(
        (e) => e.to.node !== to.node || e.to.port !== to.port,
      ),
      { id, from: { ...from }, to: { ...to } },
    ],
  };
}

export function evaluate(graph, inputs = {}) {
  const values = new Map(),
    visiting = new Set();
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Map(
    graph.edges.map((e) => [`${e.to.node}:${e.to.port}`, e]),
  );
  const read = (id) => {
    if (values.has(id)) return values.get(id);
    const node = nodes.get(id);
    if (!node || visiting.has(id)) return null;
    visiting.add(id);
    let value = null;
    if (node.type === "input") {
      const candidate = inputs[id] ?? node.value;
      value = candidate === 0 || candidate === 1 ? candidate : null;
    } else {
      const signals = Array.from(
        { length: parts[node.type]?.inputs || 0 },
        (_, port) => {
          const edge = incoming.get(`${id}:${port}`);
          return edge ? read(edge.from.node) : null;
        },
      );
      if (signals.length && signals.every((v) => v !== null)) {
        if (node.type === "and") value = signals[0] & signals[1];
        if (node.type === "or") value = signals[0] | signals[1];
        if (node.type === "not") value = 1 - signals[0];
        if (node.type === "branch" || node.type === "output")
          value = signals[0];
      }
    }
    visiting.delete(id);
    values.set(id, value);
    return value;
  };
  for (const node of graph.nodes) read(node.id);
  return values;
}

export function orderedNodes(graph) {
  const inputs = graph.nodes
    .filter((n) => n.type === "input")
    .sort((a, b) => a.label.localeCompare(b.label));
  const gates = graph.nodes
    .filter((n) => ["and", "or", "not"].includes(n.type))
    .sort((a, b) => a.number - b.number);
  const branches = graph.nodes
    .filter((n) => n.type === "branch")
    .sort((a, b) => a.number - b.number);
  const outputs = graph.nodes
    .filter((n) => n.type === "output")
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    inputs,
    gates,
    branches,
    outputs,
    columns: [...inputs, ...gates, ...branches, ...outputs],
  };
}

export function truthTable(graph) {
  const { inputs } = orderedNodes(graph);
  return Array.from({ length: 2 ** inputs.length }, (_, index) => {
    const signals = Object.fromEntries(
      inputs.map((n, bit) => [n.id, (index >> (inputs.length - 1 - bit)) & 1]),
    );
    return { index, inputs: signals, values: evaluate(graph, signals) };
  });
}

// Imported, shared and local circuits are checked before replacing the editor.
export function validCircuit(graph) {
  if (
    !graph ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    graph.nodes.length > 40 ||
    graph.edges.length > 80
  )
    return false;
  const ids = new Set(),
    gateNumbers = new Set(),
    branchNumbers = new Set();
  for (const node of graph.nodes) {
    if (
      !node ||
      typeof node !== "object" ||
      typeof node.id !== "string" ||
      !/^n[1-9]\d{0,8}$/.test(node.id) ||
      ids.has(node.id) ||
      typeof node.type !== "string" ||
      !Object.hasOwn(parts, node.type) ||
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      Math.abs(node.x) > 10000 ||
      Math.abs(node.y) > 10000
    )
      return false;
    ids.add(node.id);
    if (
      node.type === "input" &&
      (typeof node.label !== "string" || !/^[A-D]$/.test(node.label))
    )
      return false;
    if (
      node.type === "output" &&
      (typeof node.label !== "string" || !/^[XYZW]$/.test(node.label))
    )
      return false;
    if (
      node.meaning !== undefined &&
      (!["input", "output"].includes(node.type) ||
        typeof node.meaning !== "string" ||
        node.meaning.length > 80)
    )
      return false;
    if (
      !["input", "output"].includes(node.type) &&
      (!Number.isInteger(node.number) ||
        node.number < 1 ||
        node.number > 999999)
    )
      return false;
    if (!["input", "output"].includes(node.type)) {
      const numbers = node.type === "branch" ? branchNumbers : gateNumbers;
      if (numbers.has(node.number)) return false;
      numbers.add(node.number);
    }
    if (node.type === "input" && ![0, 1].includes(node.value)) return false;
  }
  const { inputs, outputs } = orderedNodes(graph);
  if (
    !inputs.length ||
    inputs.length > 4 ||
    !outputs.length ||
    outputs.length > 4 ||
    new Set(inputs.map((n) => n.label)).size !== inputs.length ||
    new Set(outputs.map((n) => n.label)).size !== outputs.length
  )
    return false;
  const connected = new Set(),
    wireIds = new Set();
  const staged = { nodes: graph.nodes, edges: [] };
  for (const edge of graph.edges) {
    if (
      !edge ||
      typeof edge.id !== "string" ||
      !/^w[1-9]\d{0,8}$/.test(edge.id) ||
      wireIds.has(edge.id) ||
      !edge.from ||
      !edge.to ||
      connectionProblem(staged, edge.from, edge.to)
    )
      return false;
    const key = `${edge.to.node}:${edge.to.port}`;
    if (connected.has(key)) return false;
    connected.add(key);
    wireIds.add(edge.id);
    staged.edges.push(edge);
  }
  return true;
}
