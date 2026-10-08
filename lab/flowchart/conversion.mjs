import {
  parseProgram,
  statement,
  expressionText,
  validateDraft,
} from "./studio.mjs";
import {
  emptyGraph,
  addNode,
  connect,
  nextOf,
  syntax,
  flowDocument,
  clone,
} from "./graph.mjs";
export function fromProgram(value) {
  const draft = validateDraft(value);
  if (draft.builder && !draft.source.trim())
    throw Error("処理を設定してからフローチャートに変換してください。");
  const parsed = parseProgram(draft.source),
    g = emptyGraph();
  g.nodes = [];
  g.edges = [];
  g.nextNode = 1;
  g.nextWire = 1;
  g.settings = clone(draft.settings);
  g.comments = parsed.lines
    .filter((l) => !l.code && l.comment)
    .map((l) => l.comment.replace(/^#\s*/, ""));
  const definitions = parsed.nodes.filter((n) => n.kind === "define");
  g.scopes.push(
    ...definitions.map((n, i) => ({
      id: `f${i + 1}`,
      name: n.name,
      parameters: [...n.parameters],
    })),
  );
  const put = (type, scope, x, y, code = "") => {
    const n = addNode(g, type, scope, x, y);
    n.code = code;
    return n;
  };
  const attach = (tails, id) =>
    tails.forEach((t) => connect(g, t.id, t.port, id));
  function block(items, scope, x, y, tails) {
    for (const a of items) {
      if (a.kind === "define") continue;
      let n;
      if (a.kind === "if") {
        n = put("decision", scope, x, y, expressionText(a.condition));
        attach(tails, n.id);
        n.note = parsed.lines[a.line - 1].comment.replace(/^#\s*/, "");
        const left = block(a.body, scope, x - 220, y + 150, [
          { id: n.id, port: 0 },
        ]);
        const right = a.otherwise
          ? a.otherwise.kind === "else"
            ? block(a.otherwise.body, scope, x + 220, y + 150, [
                { id: n.id, port: 1 },
              ])
            : block([a.otherwise], scope, x + 220, y + 150, [
                { id: n.id, port: 1 },
              ])
          : { tails: [{ id: n.id, port: 1 }], y: y + 100 };
        y = Math.max(left.y, right.y) + 20;
        const join = put("connector", scope, x, y);
        attach([...left.tails, ...right.tails], join.id);
        tails = [{ id: join.id, port: 0 }];
        y += 90;
        continue;
      }
      if (["for", "while"].includes(a.kind)) {
        n = put("loopStart", scope, x, y, statement(a));
        attach(tails, n.id);
        const end = g.nodes.find((e) => e.id === n.pair);
        g.edges = g.edges.filter((e) => e.from !== n.id);
        const body = block(a.body, scope, x, y + 130, [{ id: n.id, port: 0 }]);
        end.y = body.y + 30;
        attach(body.tails, end.id);
        tails = [{ id: end.id, port: 0 }];
        y = end.y + 120;
        continue;
      }
      const types = {
        assign: "process",
        input: "input",
        print: "output",
        call: "call",
        return: "return",
      };
      if (!types[a.kind]) throw Error("この処理を図記号に変換できません。");
      const code =
        a.kind === "input"
          ? a.name
          : a.kind === "print"
            ? a.args.map(expressionText).join(", ")
            : a.kind === "return"
              ? a.expression
                ? expressionText(a.expression)
                : ""
              : statement(a);
      n = put(types[a.kind], scope, x, y, code);
      n.note = parsed.lines[a.line - 1].comment.replace(/^#\s*/, "");
      attach(tails, n.id);
      tails = a.kind === "return" ? [] : [{ id: n.id, port: 0 }];
      y += 130;
    }
    return { tails, y };
  }
  for (const s of g.scopes) {
    const items =
      s.id === "main"
        ? parsed.nodes.filter((n) => n.kind !== "define")
        : definitions.find((n) => n.name === s.name).body;
    const begin = put("start", s.id, 400, 65);
    const built = block(items, s.id, 400, 175, [{ id: begin.id, port: 0 }]);
    const end = put("end", s.id, 400, built.y + 20);
    attach(built.tails, end.id);
  }
  const extent = Math.max(
    1,
    ...g.nodes.flatMap((n) => [Math.abs(n.x), Math.abs(n.y)]),
  );
  if (extent > 9000)
    for (const n of g.nodes) {
      n.x *= 9000 / extent;
      n.y *= 9000 / extent;
    }
  return flowDocument(g, draft.title);
}
export function toProgram(document) {
  const g = flowDocument(document.graph, document.title).graph;
  syntax(g);
  const byId = new Map(g.nodes.map((n) => [n.id, n])),
    allVisited = new Set();
  const out = [];
  for (const c of g.comments ?? []) out.push("# " + c);
  const distances = (id, stop) => {
    const map = new Map(),
      queue = [[id, 0]];
    for (let i = 0; i < queue.length; i++) {
      const [key, d] = queue[i];
      if (!key || map.has(key)) continue;
      map.set(key, d);
      if (key === stop) continue;
      const n = byId.get(key);
      if (!n) continue;
      for (const e of g.edges.filter((e) => e.from === key))
        queue.push([e.to, d + 1]);
    }
    return map;
  };
  for (const s of g.scopes) {
    const begin = g.nodes.find((n) => n.scope === s.id && n.type === "start");
    if (!begin) throw Error(`${s.name} に開始を配置してください。`);
    allVisited.add(begin.id);
    const seen = new Set();
    function walk(id, stop, depth) {
      const lines = [];
      let current = id;
      while (current && current !== stop) {
        if (seen.has(current))
          throw Error(
            "この矢印は途中へ戻っています。プログラムへの変換では繰返し始端・終端を使ってください。",
          );
        seen.add(current);
        allVisited.add(current);
        const n = byId.get(current);
        if (!n || n.scope !== s.id)
          throw Error("同じ図の中で矢印をつないでください。");
        const indent = "  ".repeat(depth),
          note = n.note ? " # " + n.note : "";
        if (n.type === "end") {
          if (s.id !== "main") lines.push(indent + "返す");
          return lines;
        }
        if (n.type === "return") {
          lines.push(indent + "返す" + (n.code ? " " + n.code : "") + note);
          return lines;
        }
        if (n.type === "decision") {
          const yes = nextOf(g, n.id, 0),
            no = nextOf(g, n.id, 1);
          if (!yes || !no)
            throw Error("判断の「はい」「いいえ」の両方をつないでください。");
          const a = distances(yes, stop),
            b = distances(no, stop);
          const joins = [...a.keys()].filter((k) => b.has(k));
          joins.sort(
            (x, y) =>
              Math.max(a.get(x), b.get(x)) - Math.max(a.get(y), b.get(y)) ||
              a.get(x) + b.get(x) - a.get(y) - b.get(y),
          );
          const join = joins[0] ?? null;
          const left = walk(yes, join, depth + 1),
            right = walk(no, join, depth + 1);
          if (!left.length && !right.length)
            throw Error(
              "判断の少なくとも一方に処理を置いてから変換してください。",
            );
          lines.push(
            indent +
              `もし ${left.length ? n.code : "not (" + n.code + ")"} ならば：` +
              note,
            ...(left.length ? left : right),
          );
          if (left.length && right.length)
            lines.push(indent + "そうでなければ：", ...right);
          current = join;
          continue;
        }
        if (n.type === "loopStart") {
          const end = byId.get(n.pair),
            body = walk(nextOf(g, n.id), end.id, depth + 1);
          if (!body.length) throw Error("繰返しの内側に処理を置いてください。");
          seen.add(end.id);
          allVisited.add(end.id);
          lines.push(indent + n.code + note, ...body);
          current = nextOf(g, end.id);
          continue;
        }
        if (n.type === "loopEnd")
          throw Error(
            "繰返しの始端から終端までを、ひとまとまりにつないでください。",
          );
        if (n.type !== "connector")
          lines.push(
            indent +
              ({
                input: `${n.code} = 【外部からの入力】`,
                output: `表示する(${n.code})`,
              }[n.type] ?? n.code) +
              note,
          );
        current = nextOf(g, n.id);
        if (!current)
          throw Error(`${n.id.slice(1)}番の部品の出口をつないでください。`);
      }
      if (!current && stop)
        throw Error("繰返しや分岐の途中から範囲外へ抜けています。");
      return lines;
    }
    if (s.id !== "main")
      out.push(`定義する ${s.name}(${s.parameters.join(", ")})：`);
    out.push(...walk(nextOf(g, begin.id), null, s.id === "main" ? 0 : 1));
  }
  const unreachable = g.nodes.filter(
    (n) => !allVisited.has(n.id) && !["connector", "end"].includes(n.type),
  );
  if (unreachable.length)
    throw Error(
      `開始からたどれない部品があります（${unreachable.map((n) => n.id.slice(1)).join("・")}）。接続するか削除してください。`,
    );
  const draft = validateDraft({
    version: 1,
    title: document.title,
    source: out.join("\n"),
    settings: clone(g.settings),
  });
  parseProgram(draft.source);
  return draft;
}
