import {
  initialState,
  step as studioStep,
  finish,
  validateInput,
  defaultInput,
} from "./studio.mjs";
import {
  flowDocument,
  syntax,
  nextOf,
  outputs,
  checkFlowDirection,
} from "./graph.mjs";
export function compileFlow(graph) {
  const g = flowDocument(graph).graph,
    { parsed, asts } = syntax(g);
  checkFlowDirection(g);
  const ids = new Map(g.nodes.map((n, i) => [n.id, i])),
    byId = new Map(g.nodes.map((n) => [n.id, n]));
  const entryFor = (scope) => {
    const starts = g.nodes.filter(
      (n) => n.scope === scope && n.type === "start",
    );
    if (starts.length !== 1) throw Error("各図に開始を1つ配置してください。");
    return ids.get(starts[0].id);
  };
  const reachable = new Set();
  function visit(id) {
    if (!id || reachable.has(id)) return;
    reachable.add(id);
    for (const e of g.edges.filter((e) => e.from === id)) visit(e.to);
    const n = byId.get(id);
    if (n.type === "loopStart") visit(n.pair);
  }
  for (const s of g.scopes) visit(g.nodes[entryFor(s.id)].id);
  for (const n of g.nodes.filter((n) => reachable.has(n.id)))
    for (let p = 0; p < outputs(n); p++)
      if (!nextOf(g, n.id, p))
        throw Error(
          `${n.id.slice(1)}番の${n.type === "decision" ? (p === 0 ? "「はい」" : "「いいえ」") : "出口"}をつないでください。`,
        );
  if (
    !g.nodes.some(
      (n) => n.scope === "main" && n.type === "end" && reachable.has(n.id),
    )
  )
    throw Error("メインの開始から終了までつながる経路を作ってください。");
  const index = (id) => (id === null ? null : ids.get(id));
  const instructions = g.nodes.map((n, i) => {
    const ast = asts.get(n.id),
      next = index(nextOf(g, n.id));
    let instruction = {
      ...(ast ?? { kind: "else" }),
      line: i + 1,
      depth: 0,
      next,
      bodyEntry: next,
      falseEntry: next,
      bodyLines: [],
    };
    if (n.type === "decision") {
      instruction.bodyEntry = index(nextOf(g, n.id, 0));
      instruction.falseEntry = index(nextOf(g, n.id, 1));
    }
    if (n.type === "loopStart") {
      instruction.next = index(nextOf(g, n.pair));
      instruction.falseEntry = instruction.next;
      instruction.bodyEntry = next;
    }
    if (n.type === "loopEnd") instruction.bodyEntry = ids.get(n.pair);
    if (n.type === "end" && n.scope === "main")
      instruction = {
        ...instruction,
        kind: "else",
        bodyEntry: null,
        next: null,
      };
    return instruction;
  });
  const functions = Object.create(null);
  for (const s of g.scopes.filter((s) => s.id !== "main"))
    functions[s.name] = { parameters: s.parameters, entry: entryFor(s.id) };
  return {
    graph: g,
    asts,
    compiled: {
      ...parsed,
      instructions,
      entry: entryFor("main"),
      functions,
      variableNames: parsed.variableNames.filter(
        (n) => n !== "__flow_placeholder",
      ),
    },
  };
}
export class FlowRunner {
  constructor(graph, seed = 0xc0ffee) {
    const built = compileFlow(graph);
    Object.assign(this, built);
    this.seed = seed;
    this.history = [];
    this.state = initialState(this.compiled, seed);
    this.active = null;
    this.lastEdge = null;
  }
  get request() {
    const n = this.state.pc === null ? null : this.graph.nodes[this.state.pc];
    return n?.type === "input"
      ? {
          name: n.code,
          spec: this.graph.settings.inputs[n.code] ?? defaultInput(),
        }
      : null;
  }
  next(input) {
    const before = {
      state: this.state,
      active: this.active,
      lastEdge: this.lastEdge,
    };
    if (this.state.completed) {
      this.history.push(before);
      this.state = finish(this.state);
      this.active = null;
      this.lastEdge = null;
      return;
    }
    const n = this.graph.nodes[this.state.pc];
    if (n.type === "input") {
      if (input === undefined) return this.request;
      validateInput(input, this.request.spec);
    } else if (input !== undefined)
      throw Error("この部品では入力を受け付けません。");
    const next = studioStep(
      this.compiled,
      this.state,
      this.graph.settings,
      input,
    );
    this.history.push(before);
    this.state = next;
    this.active = n.id;
    const target =
      this.state.pc === null ? null : this.graph.nodes[this.state.pc].id;
    this.lastEdge =
      this.graph.edges.find(
        (e) =>
          e.from === n.id &&
          e.to === target &&
          (n.type !== "decision" ||
            e.port === (next.event?.condition?.result ? 0 : 1)),
      )?.id ??
      (n.type === "loopStart"
        ? this.graph.edges.find((e) => e.from === n.pair && e.to === target)?.id
        : null);
    if (
      ["start", "connector", "loopEnd"].includes(n.type) ||
      (n.type === "end" && n.scope === "main")
    )
      this.state = {
        ...this.state,
        event: {
          title:
            n.type === "start"
              ? "開始"
              : n.type === "connector"
                ? "合流"
                : n.type === "loopEnd"
                  ? "繰返しの判定へ"
                  : "終了",
          explanation:
            n.type === "loopEnd"
              ? "対応する始端で、続けるかどうかを判定します。"
              : n.type === "end"
                ? "メインの処理が終了しました。"
                : "矢印の先へ進みます。",
        },
      };
  }
  previous() {
    const v = this.history.pop();
    if (v) {
      this.state = v.state;
      this.active = v.active;
      this.lastEdge = v.lastEdge;
    }
  }
  reset() {
    this.history = [];
    this.state = initialState(this.compiled, this.seed);
    this.active = null;
    this.lastEdge = null;
  }
}
