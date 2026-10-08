import {
  validateSettings,
  validName,
  parseProgram,
  statement,
  expressionText,
} from "./studio.mjs";
export const FORMAT = "interactive-lab-flowchart";
export const MAX_BYTES = 300000;
export const parts = {
  start: "開始",
  end: "終了",
  process: "処理",
  input: "入力",
  output: "出力",
  decision: "判断",
  loopStart: "繰返し始端",
  loopEnd: "繰返し終端",
  connector: "結合子",
  call: "定義済み処理",
  return: "値を返す",
};
export const clone = (value) => structuredClone(value);
export const outputs = (node) =>
  ["end", "return"].includes(node.type) ? 0 : node.type === "decision" ? 2 : 1;
export const incoming = (node) => (node.type === "start" ? 0 : 1);
export function emptyGraph() {
  return {
    scopes: [{ id: "main", name: "メイン", parameters: [] }],
    nodes: [
      { id: "n1", scope: "main", type: "start", x: 360, y: 80, code: "" },
      { id: "n2", scope: "main", type: "end", x: 360, y: 320, code: "" },
    ],
    edges: [{ id: "w1", from: "n1", port: 0, to: "n2" }],
    nextNode: 3,
    nextWire: 2,
    settings: { indexBase: 0, inputs: {} },
    comments: [],
  };
}
export function flowDocument(graph, title = "名前のないフローチャート") {
  return validateDocument({ format: FORMAT, version: 1, title, graph });
}
export function validateDocument(value) {
  if (
    !value ||
    value.format !== FORMAT ||
    value.version !== 1 ||
    typeof value.title !== "string" ||
    value.title.length > 120
  )
    throw Error("フローチャートの保存形式を読み取れません。");
  const g = value.graph;
  if (
    !g ||
    !Array.isArray(g.nodes) ||
    !Array.isArray(g.edges) ||
    !Array.isArray(g.scopes) ||
    g.nodes.length > 120 ||
    g.edges.length > 240 ||
    !g.scopes.length ||
    g.scopes.length > 16
  )
    throw Error("部品・矢印・関数の数を確認してください（部品は120個まで）。");
  const scopeIds = new Set(),
    names = new Set();
  const scopes = g.scopes.map((s) => {
    if (
      !s ||
      typeof s.id !== "string" ||
      !/^(main|f[1-9]\d{0,5})$/.test(s.id) ||
      scopeIds.has(s.id) ||
      typeof s.name !== "string" ||
      s.name.length > 80 ||
      !Array.isArray(s.parameters) ||
      s.parameters.length > 32 ||
      s.parameters.some((p) => typeof p !== "string" || !validName(p)) ||
      new Set(s.parameters).size !== s.parameters.length ||
      (s.id !== "main" && (!validName(s.name) || names.has(s.name)))
    )
      throw Error("関数名や引数を読み取れません。");
    scopeIds.add(s.id);
    if (s.id !== "main") names.add(s.name);
    return { id: s.id, name: s.name, parameters: [...s.parameters] };
  });
  if (scopes[0].id !== "main" || scopes[0].parameters.length)
    throw Error("メインの開始位置を読み取れません。");
  const ids = new Set();
  const nodes = g.nodes.map((n) => {
    if (
      !n ||
      typeof n.id !== "string" ||
      !/^n[1-9]\d{0,6}$/.test(n.id) ||
      ids.has(n.id) ||
      !scopeIds.has(n.scope) ||
      !Object.hasOwn(parts, n.type) ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      Math.abs(n.x) > 10000 ||
      Math.abs(n.y) > 10000 ||
      typeof n.code !== "string" ||
      n.code.length > 2000 ||
      /[\r\n]/.test(n.code) ||
      (n.type === "return" && n.scope === "main")
    )
      throw Error("部品の内容や配置を読み取れません。");
    if (n.type === "connector" && [...n.code].length > 2)
      throw Error("結合子の印は2文字以内にしてください。");
    ids.add(n.id);
    if (
      n.note !== undefined &&
      (typeof n.note !== "string" ||
        n.note.length > 2000 ||
        /[\r\n]/.test(n.note))
    )
      throw Error("メモを読み取れません。");
    return {
      id: n.id,
      scope: n.scope,
      type: n.type,
      x: n.x,
      y: n.y,
      code: n.code,
      ...(n.pair ? { pair: n.pair } : {}),
      ...(n.note ? { note: n.note } : {}),
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes)
    if (["loopStart", "loopEnd"].includes(n.type)) {
      const p = byId.get(n.pair);
      if (
        !p ||
        p.pair !== n.id ||
        p.scope !== n.scope ||
        p.type !== (n.type === "loopStart" ? "loopEnd" : "loopStart")
      )
        throw Error("繰返しの始端と終端を対にしてください。");
    }
  for (const s of scopes)
    if (
      nodes.filter((n) => n.scope === s.id && n.type === "start").length > 1 ||
      nodes.filter((n) => n.scope === s.id && n.type === "end").length > 1
    )
      throw Error("開始と終了は各図に1つずつ配置します。");
  const wires = new Set(),
    ports = new Set();
  const edges = g.edges.map((e) => {
    const a = byId.get(e?.from),
      b = byId.get(e?.to);
    if (
      !e ||
      typeof e.id !== "string" ||
      !/^w[1-9]\d{0,6}$/.test(e.id) ||
      wires.has(e.id) ||
      !a ||
      !b ||
      a.scope !== b.scope ||
      a.id === b.id ||
      !incoming(b) ||
      !Number.isInteger(e.port) ||
      e.port < 0 ||
      e.port >= outputs(a) ||
      ports.has(`${a.id}:${e.port}`)
    )
      throw Error("矢印のつながりを読み取れません。");
    wires.add(e.id);
    ports.add(`${a.id}:${e.port}`);
    return { id: e.id, from: e.from, port: e.port, to: e.to };
  });
  const counter = (key, min) => {
    const v = g[key] ?? min;
    if (!Number.isSafeInteger(v) || v < 1 || v > 9999999)
      throw Error("部品の番号を読み取れません。");
    return Math.max(min, v);
  };
  const comments = g.comments ?? [];
  if (
    !Array.isArray(comments) ||
    comments.length > 500 ||
    comments.some(
      (c) => typeof c !== "string" || c.length > 2000 || /[\r\n]/.test(c),
    )
  )
    throw Error("メモを読み取れません。");
  const result = {
    format: FORMAT,
    version: 1,
    title: value.title.trim() || "名前のないフローチャート",
    graph: {
      scopes,
      nodes,
      edges,
      nextNode: counter(
        "nextNode",
        Math.max(0, ...nodes.map((n) => +n.id.slice(1))) + 1,
      ),
      nextWire: counter(
        "nextWire",
        Math.max(0, ...edges.map((e) => +e.id.slice(1))) + 1,
      ),
      settings: validateSettings(g.settings),
      comments: [...comments],
    },
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BYTES)
    throw Error("ファイルは300KB以内にしてください。");
  return result;
}
export function connect(graph, from, port, to) {
  const a = graph.nodes.find((n) => n.id === from),
    b = graph.nodes.find((n) => n.id === to);
  if (
    !a ||
    !b ||
    from === to ||
    a.scope !== b.scope ||
    !incoming(b) ||
    port < 0 ||
    port >= outputs(a)
  )
    throw Error("出口から、同じ図の部品の入口へつないでください。");
  graph.edges = graph.edges.filter(
    (e) => !(e.from === from && e.port === port),
  );
  graph.edges.push({ id: `w${graph.nextWire++}`, from, port, to });
}
export const nextOf = (g, id, port = 0) =>
  g.edges.find((e) => e.from === id && e.port === port)?.to ?? null;
export function addNode(g, type, scope, x, y) {
  if (g.nodes.length + (type === "loopStart" ? 2 : 1) > 120)
    throw Error("部品は120個までです。");
  if (
    ["start", "end"].includes(type) &&
    g.nodes.some((n) => n.scope === scope && n.type === type)
  )
    throw Error(`${parts[type]}はこの図に1つだけ置けます。`);
  const defaults = {
    process: "x = 0",
    input: "x",
    output: "x",
    decision: "x >= 0",
    loopStart: "i を 1 から 5 まで 1 ずつ増やしながら繰り返す：",
    call: "",
    return: "x",
  };
  const n = {
    id: `n${g.nextNode++}`,
    type,
    scope,
    x,
    y,
    code: defaults[type] ?? "",
  };
  g.nodes.push(n);
  if (type === "loopStart") {
    const end = addNode(g, "loopEnd", scope, x, y + 220);
    n.pair = end.id;
    end.pair = n.id;
    connect(g, n.id, 0, end.id);
  }
  return n;
}
export function removeNode(g, id) {
  const n = g.nodes.find((n) => n.id === id),
    ids = new Set([id, ...(n?.pair ? [n.pair] : [])]);
  g.nodes = g.nodes.filter((n) => !ids.has(n.id));
  g.edges = g.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to));
}
export function sourceCode(n) {
  switch (n.type) {
    case "process":
    case "call":
      return n.code;
    case "input":
      return `${n.code} = 【外部からの入力】`;
    case "output":
      return `表示する(${n.code})`;
    case "decision":
      return `もし ${n.code} ならば：`;
    case "loopStart":
      return n.code;
    case "return":
      return `返す${n.code ? " " + n.code : ""}`;
    case "end":
      return "返す";
    default:
      return "";
  }
}
// Parse all definitions together, so calls (including recursion) are checked by
// Studio rather than by a second expression parser. Placeholder bodies never run.
export function syntax(g) {
  const lines = ["__flow_placeholder = 0"],
    lineIds = new Map();
  for (const s of g.scopes) {
    const depth = s.id === "main" ? 0 : 1;
    if (depth) lines.push(`定義する ${s.name}(${s.parameters.join(", ")})：`);
    let count = 0;
    for (const n of g.nodes.filter((n) => n.scope === s.id)) {
      if (
        ![
          "process",
          "input",
          "output",
          "decision",
          "loopStart",
          "call",
          "return",
        ].includes(n.type) &&
        !(n.type === "end" && depth)
      )
        continue;
      lineIds.set(lines.length + 1, n.id);
      lines.push("  ".repeat(depth) + sourceCode(n));
      count++;
      if (["decision", "loopStart"].includes(n.type))
        lines.push("  ".repeat(depth + 1) + "__flow_placeholder = 0");
    }
    if (depth && !count) lines.push("  返す");
  }
  const parsed = parseProgram(lines.join("\n")),
    asts = new Map();
  const visit = (nodes) => {
    for (const n of nodes) {
      if (lineIds.has(n.line)) asts.set(lineIds.get(n.line), n);
      if (n.body) visit(n.body);
      if (n.otherwise) visit([n.otherwise]);
    }
  };
  visit(parsed.nodes);
  for (const n of g.nodes) {
    const a = asts.get(n.id);
    const kind = {
      process: "assign",
      input: "input",
      output: "print",
      decision: "if",
      call: "call",
      return: "return",
    }[n.type];
    if (
      (kind && a?.kind !== kind) ||
      (n.type === "loopStart" && !["for", "while"].includes(a?.kind))
    )
      throw Error(
        `${parts[n.type]} ${n.id.slice(1)} の内容を確認してください。`,
      );
  }
  return { parsed, asts };
}
export function displayNode(n, asts) {
  const a = asts?.get(n.id);
  if (n.type === "start") return "開始";
  if (n.type === "end") return "終了";
  if (n.type === "connector") return n.code || "";
  if (n.type === "loopEnd") return `繰返し終端 L${n.pair?.slice(1)}`;
  if (a?.kind === "assign")
    return a.assignments
      .map(
        (v) =>
          `${v.target.name}${v.target.indices.length ? "[" + v.target.indices.map(expressionText).join(", ") + "]" : ""} ← ${expressionText(v.expression)}`,
      )
      .join(", ");
  if (n.type === "input") return `${n.code} を入力`;
  if (n.type === "output") return `${n.code} を表示`;
  if (n.type === "decision")
    return (
      n.code.replace(
        /"(?:\\.|[^"\\])*"|>=|<=|!=|==/g,
        (t) =>
          ({ " >=": "≧", ">=": "≧", "<=": "≦", "!=": "≠", "==": "=" })[t] ?? t,
      ) + "？"
    );
  if (n.type === "loopStart")
    return (
      n.code.replace(/：$/, "").replace("繰り返す", "") + ` [L${n.id.slice(1)}]`
    );
  if (n.type === "return") return n.code ? `${n.code} を返す` : "戻る";
  return n.code;
}
