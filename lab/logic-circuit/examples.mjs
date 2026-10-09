export const circuitExamples = Object.freeze(
  [
    { id: "xor", name: "排他的論理和", description: "2つの入力が異なると1" },
    { id: "adder", name: "半加算器", description: "1ビット＋1ビット" },
    {
      id: "full-adder",
      name: "全加算器（3入力）",
      description: "2つの数と桁上がりを足す",
    },
    { id: "two-bit-adder", name: "2ビット加算", description: "2桁＋2桁 → 3桁" },
    { id: "majority", name: "多数決（3入力）", description: "2つ以上が1なら1" },
    {
      id: "selector",
      name: "入力切替（3入力）",
      description: "CでA・Bを切り替える",
    },
    {
      id: "parity",
      name: "偶数パリティ",
      description: "3ビットに検査ビットを足す",
    },
  ].map(Object.freeze),
);

export function exampleCircuit(type, width = 900, height = 340) {
  const nodes = [],
    edges = [];
  let nextNode = 1,
    nextWire = 1,
    nextGate = 1,
    nextBranch = 1;
  const add = (kind, x, y, label = "", meaning = "") => {
    const node = { id: `n${nextNode++}`, type: kind, x, y };
    if (kind === "input")
      Object.assign(node, { label, value: 0, ...(meaning ? { meaning } : {}) });
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
  // XOR = (a OR b) AND NOT(a AND b). The AND output is also
  // the half-adder's carry, so a full adder can reuse both XOR blocks' ANDs.
  const xorBlock = (
    a,
    b,
    x,
    y,
    { aPort = 0, bPort = 0, splitCarry = false } = {},
  ) => {
    const ja = add("branch", x - 180, y - 20),
      jb = add("branch", x - 180, y + 160);
    const either = add("or", x, y),
      both = add("and", x, y + 150);
    const invert = add("not", x + 180, y + 150),
      sum = add("and", x + 370, y + 65);
    wire(a, ja, 0, aPort);
    wire(b, jb, 0, bPort);
    wire(ja, either);
    wire(jb, either, 1);
    wire(ja, both, 0, 1);
    wire(jb, both, 1, 1);
    const carryFork = splitCarry ? add("branch", x + 120, y + 230) : null;
    if (carryFork) {
      wire(both, carryFork);
      wire(carryFork, invert);
    } else wire(both, invert);
    wire(either, sum);
    wire(invert, sum, 1);
    return { sum, carry: carryFork || both, carryPort: carryFork ? 1 : 0 };
  };
  if (type === "majority") {
    const a = add("input", 44, 100, "A"),
      b = add("input", 44, 270, "B"),
      c = add("input", 44, 440, "C");
    const ja = add("branch", 170, 100),
      jb = add("branch", 170, 270),
      jc = add("branch", 170, 440);
    wire(a, ja);
    wire(b, jb);
    wire(c, jc);
    const ab = add("and", 370, 110),
      ac = add("and", 370, 280),
      bc = add("and", 370, 450);
    wire(ja, ab);
    wire(jb, ab, 1);
    wire(ja, ac, 0, 1);
    wire(jc, ac, 1);
    wire(jb, bc, 0, 1);
    wire(jc, bc, 1, 1);
    const two = add("or", 570, 180),
      result = add("or", 770, 300);
    wire(ab, two);
    wire(ac, two, 1);
    wire(two, result);
    wire(bc, result, 1);
    wire(result, add("output", 940, 300, "X", "多数決"));
  } else if (type === "selector") {
    const a = add("input", 44, 100, "A", "選択肢0"),
      b = add("input", 44, 420, "B", "選択肢1");
    const c = add("input", 44, 265, "C", "選択信号"),
      jc = add("branch", 170, 265);
    const inverse = add("not", 350, 240),
      zero = add("and", 545, 120),
      one = add("and", 545, 405),
      result = add("or", 750, 265);
    wire(c, jc);
    wire(jc, inverse);
    wire(a, zero);
    wire(inverse, zero, 1);
    wire(b, one);
    wire(jc, one, 1, 1);
    wire(zero, result);
    wire(one, result, 1);
    wire(result, add("output", 930, 265, "X", "選んだ値"));
  } else if (["full-adder", "parity"].includes(type)) {
    const a = add("input", 44, 80, "A"),
      b = add("input", 44, 260, "B");
    const first = xorBlock(a, b, 350, 100, {
      splitCarry: type === "full-adder",
    });
    const c = add(
      "input",
      565,
      420,
      "C",
      type === "full-adder" ? "桁上がり入力" : "データ",
    );
    const second = xorBlock(first.sum, c, 1050, 145, {
      splitCarry: type === "full-adder",
    });
    wire(
      second.sum,
      add(
        "output",
        1590,
        210,
        "X",
        type === "full-adder" ? "和（1の位）" : "検査ビット",
      ),
    );
    if (type === "full-adder") {
      const carry = add("or", 1420, 425);
      wire(first.carry, carry, 0, first.carryPort);
      wire(second.carry, carry, 1, second.carryPort);
      wire(carry, add("output", 1590, 425, "Y", "桁上がり"));
    }
  } else if (type === "two-bit-adder") {
    // AB and CD are two two-bit unsigned operands. X,Y,Z are the result's
    // 4,2,1 places. No fifth input: the first stage's carry-in is 0 (half adder).
    const a = add("input", 44, 405, "A", "a：2の位"),
      b = add("input", 44, 80, "B", "a：1の位");
    const c = add("input", 44, 585, "C", "b：2の位"),
      d = add("input", 44, 260, "D", "b：1の位");
    const low = xorBlock(b, d, 350, 100, { splitCarry: true });
    const high = xorBlock(a, c, 350, 425, { splitCarry: true });
    const second = xorBlock(high.sum, low.carry, 1050, 465, {
      bPort: low.carryPort,
      splitCarry: true,
    });
    const carry = add("or", 1420, 735);
    wire(high.carry, carry, 0, high.carryPort);
    wire(second.carry, carry, 1, second.carryPort);
    wire(carry, add("output", 1590, 735, "X", "4の位"));
    wire(second.sum, add("output", 1590, 530, "Y", "2の位"));
    wire(low.sum, add("output", 1590, 165, "Z", "1の位"));
  } else if (["xor", "adder"].includes(type)) {
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

// Read the actual output signals, including an edited/incomplete circuit. An
// arrow (not an assumed equality) keeps the input/output comparison truthful.
export function arithmeticReadout(graph, values) {
  const inputs = new Map(
    graph.nodes.filter((n) => n.type === "input").map((n) => [n.label, n]),
  );
  const outputs = new Map(
    graph.nodes.filter((n) => n.type === "output").map((n) => [n.label, n]),
  );
  const bit = (n) => values.get(n.id);
  const binary = (nodes) => {
    const bits = nodes.map(bit);
    return bits.some((v) => v === null)
      ? "未接続"
      : `${bits.join("")}₂（${parseInt(bits.join(""), 2)}）`;
  };
  if (
    inputs.size === 4 &&
    outputs.size === 3 &&
    inputs.get("A")?.meaning === "a：2の位" &&
    inputs.get("B")?.meaning === "a：1の位" &&
    inputs.get("C")?.meaning === "b：2の位" &&
    inputs.get("D")?.meaning === "b：1の位" &&
    outputs.get("X")?.meaning === "4の位" &&
    outputs.get("Y")?.meaning === "2の位" &&
    outputs.get("Z")?.meaning === "1の位"
  ) {
    return `a ${binary([inputs.get("A"), inputs.get("B")])} ＋ b ${binary([inputs.get("C"), inputs.get("D")])} → ${binary([outputs.get("X"), outputs.get("Y"), outputs.get("Z")])}`;
  }
  if (
    (inputs.size === 2 || inputs.size === 3) &&
    outputs.size === 2 &&
    inputs.has("A") &&
    inputs.has("B") &&
    ["和", "和（1の位）"].includes(outputs.get("X")?.meaning) &&
    outputs.get("Y")?.meaning === "桁上がり" &&
    (inputs.size === 2 || inputs.get("C")?.meaning === "桁上がり入力")
  ) {
    return `${bit(inputs.get("A"))} ＋ ${bit(inputs.get("B"))}${inputs.size === 3 ? ` ＋ ${bit(inputs.get("C"))}（桁上がり）` : ""} → ${binary([outputs.get("Y"), outputs.get("X")])}`;
  }
  return "";
}
