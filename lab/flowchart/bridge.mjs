import { fromProgram } from "./conversion.mjs";
import { encodeProgram, defaultInput } from "./studio.mjs";
export async function toFlowURL(draft, base) {
  fromProgram(draft); // Validate before opening another page; never discard a failed conversion.
  const encoded = new URL(await encodeProgram(draft, base)),
    target = new URL(base);
  target.hash = encoded.hash;
  target.search = "";
  return target.href;
}
// Adapt the original, structured trace instructions rather than replacing text
// inside string literals. Initial values are the currently edited values.
export function traceDraft(example, parameters) {
  const inputs = Object.create(null),
    notes = [],
    prefix = [];
  let base = 0;
  for (const [name, value] of Object.entries(
    example.initialize?.(parameters) ?? {},
  )) {
    if (value?.kind === "matrix") {
      const cells = Object.entries(value.cells).map(([key, v]) => ({
        indices: key.split(",").map(Number),
        value: v,
      }));
      const low = Math.min(...cells.flatMap((c) => c.indices));
      if (![0, 1].includes(low))
        throw Error("この配列の番号には対応していません。");
      if (prefix.length && base !== low)
        throw Error("配列の開始番号をそろえてから変換してください。");
      base = low;
      const rows = Math.max(...cells.map((c) => c.indices[0])) - base + 1,
        cols = Math.max(...cells.map((c) => c.indices[1])) - base + 1;
      const data = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const cell = cells.find(
            (v) => v.indices[0] === r + base && v.indices[1] === c + base,
          );
          if (!cell) throw Error("値のない配列要素があります。");
          return cell.value;
        }),
      );
      prefix.push(`${name} = ${JSON.stringify(data)}`);
    } else prefix.push(`${name} = ${JSON.stringify(value)}`);
  }
  for (const [name, shape] of Object.entries(example.arrayShapes ?? {})) {
    const size = (v) => (typeof v === "string" ? parameters[v] : v);
    const rows = size(shape.rows),
      columns = size(shape.columns);
    base = shape.start ?? 0;
    if (
      !Number.isSafeInteger(rows) ||
      !Number.isSafeInteger(columns) ||
      rows * columns > 1000
    )
      throw Error("配列の大きさを確認してください。");
    prefix.push(
      `${name} = ${JSON.stringify(Array.from({ length: rows }, () => Array(columns).fill(0)))}`,
    );
  }
  function expression(e) {
    switch (e.type) {
      case "literal":
        return JSON.stringify(e.value);
      case "parameter":
        if (!Object.hasOwn(parameters, e.name))
          throw Error("初期値を読み取れません。");
        return JSON.stringify(parameters[e.name]);
      case "variable":
        return e.name;
      case "index":
        return `${e.name}[${e.indices.map(expression).join(", ")}]`;
      case "array":
        return `[${e.items.map(expression).join(", ")}]`;
      case "length":
        return `要素数(${expression(e.expression)})`;
      case "random":
        return "乱数()";
      case "unary":
        return `(${e.operator} (${expression(e.expression)}))`;
      case "binary":
        return `(${expression(e.left)} ${e.operator} ${expression(e.right)})`;
      case "call":
        return `${e.name}(${e.args.map(expression).join(", ")})`;
      case "builtin": {
        const name = e.name === "結合" ? "配列結合" : e.name,
          args = e.name.startsWith("ランダム") ? e.args.slice(0, -1) : e.args;
        return `${name}(${args.map(expression).join(", ")})`;
      }
      case "text":
        return JSON.stringify(
          e.parts
            .map((v) => {
              if (typeof v === "string") return v;
              if (v.type === "parameter") return String(parameters[v.name]);
              if (v.type === "literal") return String(v.value);
              throw Error("この文字列の組立ては変換できません。");
            })
            .join(""),
        );
      default:
        throw Error("この式はフローチャートに変換できません。");
    }
  }
  function block(nodes, depth = 0, elseIf = false) {
    return nodes.flatMap((n) => {
      const indent = "  ".repeat(depth),
        ex = expression;
      let line;
      switch (n.type) {
        case "assign":
          line = n.assignments
            .map(
              (a) =>
                `${a.name}${a.indices?.length ? "[" + a.indices.map(ex).join(", ") + "]" : ""} = ${ex(a.expression)}`,
            )
            .join(", ");
          break;
        case "input": {
          const f = n.field,
            spec = defaultInput();
          spec.kind =
            f.type === "choice"
              ? typeof f.defaultValue === "string"
                ? "text"
                : "number"
              : f.type;
          if (f.choices && new Set(f.choices.map((v) => typeof v)).size > 1)
            throw Error(
              "数値と文字列が混在する選択入力は変換できません。この問題はプログラムトレースで実行してください。",
            );
          for (const k of [
            "min",
            "max",
            "integer",
            "minLength",
            "maxLength",
            "rows",
            "columns",
          ])
            if (f[k] !== undefined) spec[k] = f[k];
          if (f.elementType)
            spec.elementKind =
              f.elementType === "string" ? "text" : f.elementType;
          inputs[n.name] = spec;
          if (f.sorted || f.choices)
            notes.push(
              `${n.name} の入力条件：${f.sorted ? "昇順の配列" : f.choices.map((v) => JSON.stringify(v)).join("、")}`,
            );
          line = `${n.name} = 【外部からの入力】`;
          break;
        }
        case "print":
          line = `表示する(${n.args.map(ex).join(", ")})`;
          break;
        case "if":
          return [
            indent +
              `${elseIf ? "そうでなくもし" : "もし"} ${ex(n.condition)} ならば：`,
            ...block(n.body, depth + 1),
            ...(n.otherwise
              ? block([n.otherwise], depth, n.otherwise.type === "if")
              : []),
          ];
        case "else":
          return [indent + "そうでなければ：", ...block(n.body, depth + 1)];
        case "for": {
          const negative =
            (n.step.type === "unary" && n.step.operator === "-") ||
            (n.step.type === "literal" && n.step.value < 0);
          const amount = negative ? `-(${ex(n.step)})` : ex(n.step);
          return [
            indent +
              `${n.name} を ${ex(n.start)} から ${ex(n.end)} まで ${amount} ずつ${negative ? "減らし" : "増やし"}ながら繰り返す：`,
            ...block(n.body, depth + 1),
          ];
        }
        case "while":
          return [
            indent + `${ex(n.condition)} の間繰り返す：`,
            ...block(n.body, depth + 1),
          ];
        case "define":
          return [
            indent + `定義する ${n.name}(${n.parameters.join(", ")})：`,
            ...block(n.body, depth + 1),
          ];
        case "return":
          line = "返す" + (n.expression ? " " + ex(n.expression) : "");
          break;
        case "append":
          line = `${n.name} = 配列結合(${n.name}, [${ex(n.expression)}])`;
          break;
        case "reverse":
          line = `${n.name} = 逆順(${n.name})`;
          break;
        case "plot":
          throw Error(
            "グラフ描画の命令はフローチャートでは実行できません。この問題はプログラムトレースで実行してください。",
          );
        default:
          throw Error("この命令はフローチャートに変換できません。");
      }
      return [indent + line];
    });
  }
  const source = [...prefix, ...block(example.program)];
  return {
    version: 1,
    title: example.title,
    source: [...notes.map((n) => "# " + n), ...source].join("\n"),
    settings: { indexBase: base, inputs },
  };
}
