// Browser-local, versioned workbook. No server or external service is used.
export const VERSION = 2;
export const uid = () => `t-${globalThis.crypto.randomUUID()}`;
export const kinds = {
  fact: "事実",
  opinion: "意見",
  hypothesis: "仮説",
  result: "検証結果",
};
export const steps = [
  [
    "問題の明確化",
    "5W1H・ギャップ分析",
    "「何に困る？」を、確かめられる問題に。",
    "目標の認識がずれているとき、プロジェクトを始めるとき。",
  ],
  [
    "現状の調査・整理",
    "KJ法",
    "情報を読み合わせ、まとまり・関係・全体の説明を作る。",
    "アンケートやインタビューの声が散らばっているとき。",
  ],
  [
    "原因の分析",
    "特性要因図",
    "原因の候補と根拠を結び、確かめ方を考える。",
    "同じ失敗が繰り返され、原因が一つに決められないとき。",
  ],
  [
    "解決策の発想",
    "マインドマップ",
    "枝を広げて、対策の選択肢を増やす。",
    "最初のアイデアに固まりそうなとき、別の切り口を探すとき。",
  ],
  [
    "解決策の選択・計画",
    "意思決定マトリクス",
    "何を大事にするかを決め、対策を比べる。",
    "効果・負担・公平さなど、複数の条件がぶつかるとき。",
  ],
  [
    "実行・検証",
    "チェックシート・比較グラフ",
    "実施の記録と変化を並べ、目標と比べる。",
    "小さく試した対策の効果や副作用を確かめるとき。",
  ],
  [
    "評価・改善",
    "KPT法",
    "続けること・課題・次の試みを整理する。",
    "活動や試行を振り返り、次の改善につなげるとき。",
  ],
];
export function emptyWorkbook() {
  return {
    version: VERSION,
    mode: "free",
    step: 0,
    done: Array(7).fill(false),
    review: Array(7).fill(false),
    problem: {
      title: "",
      who: "",
      what: "",
      when: "",
      where: "",
      why: "",
      how: "",
      current: "",
      ideal: "",
      question: "",
    },
    measure: {
      label: "",
      kind: "rate",
      unit: "",
      direction: "higher",
      beforeCount: null,
      beforeTotal: null,
      beforeValue: null,
      target: null,
      conditions: "",
    },
    examples: [],
    relations: [],
    synthesis: "",
    groups: [],
    cards: [],
    factors: [],
    causes: [],
    focusCause: "",
    nodes: [],
    criteria: [],
    selectedIdea: "",
    plan: { who: "", when: "", test: "", risk: "" },
    checks: [],
    records: [],
    observation: "",
    resultFor: "",
    simulation: "",
    kpt: [],
    next: "",
  };
}
export const strategies = {
  display: {
    name: "昼休みに見られる展示コーナー",
    values: [5, 3, 4],
    returned: [6, 5, 6, 5],
    note: "返却は22/40件。場所を知る人は増えたが、部活動で昼休みに来られない生徒には届きにくい。担当の準備は週35分。前の期間と別の落とし物を数えたため、品物の違いも影響しうる。",
  },
  photos: {
    name: "個人情報を隠した写真一覧",
    values: [4, 2, 2],
    returned: [7, 6, 7, 7],
    note: "返却は27/40件。ただし写真の更新に週65分かかり、特徴を隠しすぎた品物は本人も判断しづらかった。写真を見られる環境の差も課題。返却率だけなら良いが、継続可能か？",
  },
  announce: {
    name: "学級で特徴だけを定期案内",
    values: [3, 4, 5],
    returned: [5, 5, 5, 6],
    note: "返却は21/40件。準備は週15分、個人情報の公開は少ない。一方、言葉だけで似た水筒を区別できず、誤った申し出が4件あった。品物の種類別にも調べたい。",
  },
  labels: {
    name: "記名しやすいラベルを配布",
    values: [2, 5, 5],
    returned: [4, 5, 4, 5],
    note: "返却は18/40件。新しく記名された物は返しやすくなったが、既に集まっている無記名の物には効果が小さい。紛失そのものの予防は、この返却率だけでは評価できない。",
  },
};
export function presetExample() {
  const s = emptyWorkbook();
  s.mode = "preset";
  s.problem = {
    title: "学校の落とし物が持ち主に戻らない",
    who: "物をなくした生徒・保管を担当する委員",
    what: "落とし物の7割が4週間たっても戻らない",
    when: "直近4週間。受け取りは放課後の15分間",
    where: "職員室の前の保管箱",
    why: "持ち主は困り、保管スペースもいっぱいになる",
    how: "拾った物を箱へ。月末に学級へ案内",
    current: "40件中12件だけが返却された（30%）",
    ideal: "4週間以内の返却率を60%以上に。担当者の負担も抑える",
    question: "気付く・確認する・受け取る、どこでつまずいている？",
  };
  s.measure = {
    label: "4週間以内の返却率",
    kind: "rate",
    unit: "%",
    direction: "higher",
    beforeCount: 12,
    beforeTotal: 40,
    beforeValue: null,
    target: 60,
    conditions:
      "同じ4週間で集まった物の返却を追う。品物の種類・記名の有無・行事の違いも確認する。",
  };
  s.groups = [];
  const data = [
    ["c-total", "40件中12件が4週間以内に返却された", "fact", "保管台帳・4週間"],
    [
      "c-name",
      "記名あり16件中9件、無記名24件中3件が返却された",
      "fact",
      "保管台帳・同じ40件",
    ],
    [
      "c-known",
      "回答24人中14人は箱の場所を知っていた",
      "fact",
      "匿名アンケート・回答者の偏りは未確認",
    ],
    ["c-time", "受け取り時間が部活動と重なる", "opinion", "生徒の声・3人"],
    [
      "c-shame",
      "箱を探す姿を見られるのが少し恥ずかしい",
      "opinion",
      "生徒の声・2人",
    ],
    [
      "c-look",
      "箱を通り過ぎた20人中、立ち止まって見たのは4人",
      "fact",
      "1日の放課後の観察・他の日は未調査",
    ],
    [
      "c-own",
      "なくした物がそこにあるとは思わなかった",
      "opinion",
      "受け取りに来た生徒の声・1人",
    ],
    [
      "c-work",
      "毎日写真を撮るのは負担が大きそう",
      "opinion",
      "担当委員の声・1人",
    ],
    [
      "c-hyp",
      "場所を知っていても、自分の物と気付けないのでは？",
      "hypothesis",
      "調査データからの推測・未検証",
    ],
  ];
  s.cards = data.map(([id, text, kind, source]) => ({
    id,
    text,
    kind,
    source,
    group: "",
  }));
  s.factors = [
    { id: "f-info", title: "情報の届き方" },
    { id: "f-time", title: "時間・場所" },
    { id: "f-feeling", title: "気持ち・運用" },
  ];
  s.causes = [
    {
      id: "h-notice",
      factor: "f-info",
      text: "箱を知っていても自分の物だと気付かない",
      evidence: "c-own",
      status: "hypothesis",
      test: "写真や特徴を見せる前後で、自分の物を認識できた人数を比べる",
    },
    {
      id: "h-time",
      factor: "f-time",
      text: "受け取り時間が合わない",
      evidence: "c-time",
      status: "hypothesis",
      test: "時間を広げた場合の利用人数を記録する",
    },
    {
      id: "h-shame",
      factor: "f-feeling",
      text: "人目が気になり箱を確認しづらい",
      evidence: "c-shame",
      status: "hypothesis",
      test: "匿名の意識調査と、見やすい置き方の試行を行う",
    },
  ];
  s.nodes = [
    {
      id: "n-access",
      parent: "",
      text: "確認する機会を変える",
      cause: "h-time",
      candidate: false,
      strategy: "",
      ratings: {},
    },
    {
      id: "n-notice",
      parent: "",
      text: "自分の物と気付く情報",
      cause: "h-notice",
      candidate: false,
      strategy: "",
      ratings: {},
    },
    {
      id: "n-prevent",
      parent: "",
      text: "返しやすくする・予防する",
      cause: "",
      candidate: false,
      strategy: "",
      ratings: {},
    },
  ];
  for (const [strategy, detail] of Object.entries(strategies))
    s.nodes.push({
      id: `n-${strategy}`,
      parent:
        strategy === "display"
          ? "n-access"
          : strategy === "labels"
            ? "n-prevent"
            : "n-notice",
      text: detail.name,
      cause: "",
      candidate: true,
      strategy,
      ratings: Object.fromEntries(detail.values.map((v, i) => [`v-${i}`, v])),
    });
  s.criteria = [
    { id: "v-0", title: "返却への効果", weight: 3 },
    { id: "v-1", title: "続けやすさ", weight: 3 },
    { id: "v-2", title: "個人情報への配慮", weight: 3 },
  ];
  s.plan = {
    who: "図書・生活委員の2人",
    when: "4週間試行し、各週の品物を4週間追跡（最終確認は開始7週間後）",
    test: "4週間以内の返却率と準備時間、困ったことを記録する",
    risk: "本人確認を行う。名前や中身を不用意に公開しない",
  };
  s.checks = [
    { id: "ck-0", text: "小さく試す場所・期間を決める", done: false, note: "" },
    {
      id: "ck-1",
      text: "本人確認と個人情報の扱いを確認する",
      done: false,
      note: "",
    },
    {
      id: "ck-2",
      text: "件数と担当者の準備時間を記録する",
      done: false,
      note: "",
    },
  ];
  s.factors.forEach((f) => (f.group = ""));
  return s;
}
export function presetWorkbook() {
  const s = emptyWorkbook();
  s.mode = "preset";
  return s;
}
export const exampleIds = [
  "context",
  "gap",
  "question",
  "cards",
  "groups",
  "relations",
  "synthesis",
  "causes",
  "tests",
  "branches",
  "criteria",
  "scores",
  "plan",
  "checks",
  "results",
  "kpt",
  "next",
];
// Examples add missing content only. Repeated clicks never overwrite a learner's edits.
export function fillExample(s, id) {
  if (
    s.mode !== "preset" ||
    !exampleIds.includes(id) ||
    s.examples.includes(id)
  )
    return false;
  const p = presetExample();
  const fill = (target, source, keys = Object.keys(source)) => {
    for (const k of keys)
      if (target[k] === "" || target[k] === null) target[k] = source[k];
  };
  const append = (key, rows) => {
    for (const row of rows)
      if (!s[key].some((x) => x.id === row.id))
        s[key].push(structuredClone(row));
  };
  if (id === "context")
    fill(s.problem, p.problem, [
      "title",
      "who",
      "what",
      "when",
      "where",
      "why",
      "how",
    ]);
  if (id === "gap") {
    fill(s.problem, p.problem, ["current", "ideal"]);
    fill(s.measure, p.measure);
  }
  if (id === "question") fill(s.problem, p.problem, ["question"]);
  if (id === "cards") append("cards", p.cards);
  if (id === "groups") {
    if (!s.cards.some((c) => c.id === "c-known")) return false;
    append("groups", [
      {
        id: "g-recognize",
        title: "箱の場所を知っていても、自分の物とは気付かない",
        parent: "",
      },
      {
        id: "g-access",
        title: "箱を確認し、受け取る行動に壁がある",
        parent: "",
      },
    ]);
    for (const c of s.cards)
      if (!c.group) {
        if (["c-known", "c-own", "c-hyp"].includes(c.id))
          c.group = "g-recognize";
        if (["c-time", "c-shame", "c-look"].includes(c.id))
          c.group = "g-access";
      }
  }
  if (id === "relations") {
    if (
      !s.groups.some((g) => g.id === "g-recognize") ||
      !s.groups.some((g) => g.id === "g-access")
    )
      return false;
    append("relations", [
      {
        id: "r-awareness",
        from: "g-recognize",
        to: "g-access",
        text: "気付いても、確認・受け取りの壁が残る可能性",
      },
    ]);
  }
  if (id === "synthesis") {
    if (!s.cards.length) return false;
    if (!s.synthesis)
      s.synthesis =
        "箱の場所を知っている人はいるが、自分の物だと気付かない声もある。一方、受け取り時間や人目が気になる声があり、案内を増やすだけでは行動につながらない可能性がある。記名の有無による差と、担当者の負担も残して調べたい。これはこの整理からの解釈であり、まだ原因の証明ではない。";
  }
  if (id === "causes") {
    // Preserve the learner's grouping. A group becomes a perspective, not a proven cause.
    for (const g of s.groups)
      if (!g.parent && !s.factors.some((f) => f.group === g.id))
        s.factors.push({
          id: uid(),
          title: g.title || "表札がないまとまり",
          group: g.id,
        });
    for (const c of p.causes) {
      const card = s.cards.find((x) => x.id === c.evidence);
      let f = s.factors.find((x) => x.group && x.group === card?.group);
      if (!f) {
        const original = p.factors.find((x) => x.id === c.factor);
        f = s.factors.find((x) => x.id === original.id);
        if (!f) {
          f = structuredClone(original);
          s.factors.push(f);
        }
      }
      append("causes", [
        { ...c, factor: f.id, evidence: card?.id || "", test: "" },
      ]);
    }
  }
  if (id === "tests") {
    if (!s.causes.length) return false;
    for (const c of s.causes) {
      const sample = p.causes.find((x) => x.id === c.id);
      if (sample && !c.test) c.test = sample.test;
    }
  }
  if (id === "branches") {
    const nodes = structuredClone(p.nodes);
    for (const n of nodes) {
      if (n.cause && !s.causes.some((c) => c.id === n.cause)) n.cause = "";
      n.ratings = {};
    }
    const focus = s.causes.find((c) => c.id === s.focusCause);
    // A custom cause also gets a real, editable branch and follows through to selection.
    if (focus && !nodes.some((n) => n.cause === focus.id))
      nodes.unshift({
        id: uid(),
        parent: "",
        text: `${focus.text}を変えるには？`,
        cause: focus.id,
        candidate: false,
        strategy: "",
        ratings: {},
      });
    nodes.sort(
      (a, b) =>
        Number(b.cause === s.focusCause && !!s.focusCause) -
        Number(a.cause === s.focusCause && !!s.focusCause),
    );
    append("nodes", nodes);
  }
  if (id === "criteria") append("criteria", p.criteria);
  if (id === "scores") {
    if (!s.criteria.length || !s.nodes.some((n) => n.candidate)) return false;
    for (const n of s.nodes) {
      const sample = p.nodes.find((x) => x.id === n.id && x.text === n.text);
      if (!sample) continue;
      for (const c of s.criteria) {
        const original = p.criteria.find(
          (x) => x.id === c.id && x.title === c.title,
        );
        if (
          original &&
          Number.isFinite(sample.ratings[c.id]) &&
          n.ratings[c.id] == null
        )
          n.ratings[c.id] = sample.ratings[c.id];
      }
    }
  }
  if (id === "plan") {
    const idea = s.nodes.find((n) => n.id === s.selectedIdea);
    if (!idea) return false;
    fill(s.plan, {
      ...p.plan,
      test: `「${idea.text}」を小さく試す。${p.plan.test}`,
    });
  }
  if (id === "checks") append("checks", p.checks);
  if (id === "results") {
    if (!canSimulate(s) || s.records.length || s.observation) return false;
    simulate(s);
  }
  if (id === "kpt") {
    const c = comparison(s),
      idea = s.nodes.find((n) => n.id === s.resultFor);
    if (c.after === null || !idea) return false;
    const source = s.simulation
      ? "教材の架空の実施結果"
      : "自分で記録した実施結果";
    append("kpt", [
      {
        id: "kp-keep",
        kind: "keep",
        text: `「${idea.text}」で役立った工夫を残す。${s.measure.label || "指標"}は${c.after.toFixed(1)}${s.measure.kind === "rate" ? "%" : s.measure.unit}。`,
        source,
      },
      {
        id: "kp-problem",
        kind: "problem",
        text:
          s.observation ||
          "数値に出ない負担や、取り残された人がいないか確認する",
        source,
      },
      {
        id: "kp-try",
        kind: "try",
        text: "受け取りに来られない人に話を聞き、届いていない理由を調べ直す",
        source: "結果だけで原因は断定できないため、次の調査で確かめる",
      },
    ]);
  }
  if (id === "next") {
    const attempt = s.kpt.find((k) => k.kind === "try" && k.text);
    if (!attempt) return false;
    if (!s.next)
      s.next = `来週、${s.plan.who || "担当者"}が「${attempt.text}」を始める。調査の段階に戻り、聞いた内容を新しいカードとして記録する。`;
  }
  s.examples.push(id);
  return true;
}

export function markEdited(s, step) {
  for (let i = step + 1; i < 7; i++) if (s.done[i]) s.review[i] = true;
}
export function descendants(s, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of s.nodes)
      if (ids.has(n.parent) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
  }
  return ids;
}
export function causeForNode(s, node) {
  const visited = new Set();
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    if (node.cause) return s.causes.find((c) => c.id === node.cause);
    node = s.nodes.find((n) => n.id === node.parent);
  }
  return undefined;
}
export function ranking(s) {
  const totalWeight = s.criteria.reduce((sum, c) => sum + c.weight, 0);
  return s.nodes
    .filter((n) => n.candidate)
    .map((n) => {
      const complete =
        s.criteria.length > 0 &&
        s.criteria.every((c) => Number.isFinite(n.ratings[c.id]));
      return {
        node: n,
        score: complete
          ? s.criteria.reduce((sum, c) => sum + c.weight * n.ratings[c.id], 0) /
            totalWeight
          : null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
export function comparison(s) {
  const m = s.measure;
  let before = null,
    after = null,
    invalid = false;
  if (m.kind === "rate") {
    if (
      m.beforeTotal > 0 &&
      m.beforeCount !== null &&
      m.beforeCount <= m.beforeTotal
    )
      before = (100 * m.beforeCount) / m.beforeTotal;
    const entered = s.records.filter(
      (r) => r.total !== null || r.count !== null,
    );
    invalid = entered.some(
      (r) =>
        r.total === null ||
        r.count === null ||
        r.total < r.count ||
        r.total <= 0,
    );
    if (entered.length && !invalid) {
      const total = entered.reduce((a, r) => a + r.total, 0);
      after = (100 * entered.reduce((a, r) => a + r.count, 0)) / total;
    }
  } else {
    before = m.beforeValue;
    const values = s.records.map((r) => r.value).filter((v) => v !== null);
    if (values.length)
      after = values.reduce((a, v) => a + v, 0) / values.length;
  }
  const met =
    after !== null &&
    m.target !== null &&
    (m.direction === "higher" ? after >= m.target : after <= m.target);
  return {
    before,
    after,
    invalid,
    met,
    change: before !== null && after !== null ? after - before : null,
  };
}
function simulationTarget(s, id = s.selectedIdea) {
  const n = s.nodes.find((n) => n.id === id);
  const p = presetExample();
  if (
    s.mode !== "preset" ||
    s.problem.title !== p.problem.title ||
    !n ||
    !strategies[n.strategy] ||
    n.text !== strategies[n.strategy].name ||
    s.measure.label !== p.measure.label ||
    s.measure.kind !== "rate" ||
    s.measure.beforeCount !== 12 ||
    s.measure.beforeTotal !== 40
  )
    return null;
  return n;
}
export function simulate(s) {
  const n = simulationTarget(s);
  if (!n) return false;
  const v = strategies[n.strategy];
  s.records = v.returned.map((count, i) => ({
    id: uid(),
    label: `第${i + 1}週に集まった物（各4週間追跡）`,
    count,
    total: 10,
    value: null,
    note: "教材の架空データ",
  }));
  s.observation = v.note;
  s.resultFor = n.id;
  s.simulation = n.strategy;
  return true;
}
export function canSimulate(s) {
  return Boolean(simulationTarget(s));
}
export function simulationChanged(s) {
  if (!s.simulation) return false;
  return simulationTarget(s, s.resultFor)?.strategy !== s.simulation;
}

// Strict bounded import; unknown fields are discarded and all relationships checked.
const textField = (v) => typeof v === "string" && v.length <= 10000;
const numberField = (v) =>
  v === null || (Number.isFinite(v) && Math.abs(v) <= 1e9);
function assert(test) {
  if (!test)
    throw new Error(
      "形式が不正です。この教材から書き出したJSONファイルを選んでください。",
    );
}
function object(v, shape) {
  assert(v && typeof v === "object" && !Array.isArray(v));
  return Object.fromEntries(
    Object.entries(shape).map(([key, check]) => {
      assert(check(v[key]));
      return [key, v[key]];
    }),
  );
}
const base = { id: textField };
function list(v, shape) {
  assert(Array.isArray(v) && v.length <= 300);
  const result = v.map((item) => object(item, shape));
  assert(new Set(result.map((x) => x.id)).size === result.length);
  assert(
    result.every((x) => /^[-a-zA-Z0-9]+$/.test(x.id) && x.id.length <= 100),
  );
  return result;
}
export function parseWorkbook(raw) {
  assert(typeof raw === "string" && raw.length <= 2_000_000);
  const input = JSON.parse(raw);
  const s = emptyWorkbook();
  assert(
    [1, VERSION].includes(input.version) &&
      ["free", "preset"].includes(input.mode),
  );
  s.mode = input.mode;
  assert(Number.isInteger(input.step) && input.step >= 0 && input.step < 7);
  s.step = input.step;
  for (const k of ["done", "review"]) {
    assert(
      Array.isArray(input[k]) &&
        input[k].length === 7 &&
        input[k].every((x) => typeof x === "boolean"),
    );
    s[k] = input[k];
  }
  s.problem = object(
    input.problem,
    Object.fromEntries(Object.keys(s.problem).map((k) => [k, textField])),
  );
  s.measure = object(input.measure, {
    label: textField,
    kind: (v) => ["rate", "value"].includes(v),
    unit: textField,
    direction: (v) => ["higher", "lower"].includes(v),
    beforeCount: numberField,
    beforeTotal: numberField,
    beforeValue: numberField,
    target: numberField,
    conditions: textField,
  });
  assert(
    [s.measure.beforeCount, s.measure.beforeTotal].every(
      (v) => v === null || v >= 0,
    ),
  );
  s.groups = list(
    input.groups.map((g) => ({ parent: "", ...g })),
    { ...base, title: textField, parent: textField },
  );
  s.examples = input.examples ?? [];
  assert(
    Array.isArray(s.examples) &&
      s.examples.length <= 30 &&
      s.examples.every((x) => exampleIds.includes(x)),
  );
  s.synthesis = input.synthesis ?? "";
  assert(textField(s.synthesis));
  s.relations = list(input.relations ?? [], {
    ...base,
    from: textField,
    to: textField,
    text: textField,
  });
  s.cards = list(input.cards, {
    ...base,
    text: textField,
    kind: (v) => Object.hasOwn(kinds, v),
    source: textField,
    group: textField,
  });
  s.factors = list(
    input.factors.map((f) => ({ group: "", ...f })),
    { ...base, title: textField, group: textField },
  );
  s.causes = list(input.causes, {
    ...base,
    factor: textField,
    text: textField,
    evidence: textField,
    status: (v) => ["hypothesis", "supported", "disproved"].includes(v),
    test: textField,
  });
  s.criteria = list(input.criteria, {
    ...base,
    title: textField,
    weight: (v) => Number.isInteger(v) && v >= 1 && v <= 5,
  });
  s.nodes = list(input.nodes, {
    ...base,
    parent: textField,
    text: textField,
    cause: textField,
    candidate: (v) => typeof v === "boolean",
    strategy: (v) => v === "" || Object.hasOwn(strategies, v),
    ratings: (v) => v && typeof v === "object" && !Array.isArray(v),
  });
  for (const n of s.nodes)
    n.ratings = object(
      n.ratings,
      Object.fromEntries(
        Object.keys(n.ratings).map((k) => {
          assert(s.criteria.some((c) => c.id === k));
          return [
            k,
            (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5),
          ];
        }),
      ),
    );
  s.plan = object(
    input.plan,
    Object.fromEntries(Object.keys(s.plan).map((k) => [k, textField])),
  );
  s.checks = list(input.checks, {
    ...base,
    text: textField,
    done: (v) => typeof v === "boolean",
    note: textField,
  });
  s.records = list(input.records, {
    ...base,
    label: textField,
    count: numberField,
    total: numberField,
    value: numberField,
    note: textField,
  });
  assert(
    s.records.every((r) =>
      [r.count, r.total].every((v) => v === null || v >= 0),
    ),
  );
  s.kpt = list(input.kpt, {
    ...base,
    kind: (v) => ["keep", "problem", "try"].includes(v),
    text: textField,
    source: textField,
  });
  for (const k of [
    "focusCause",
    "selectedIdea",
    "observation",
    "resultFor",
    "simulation",
    "next",
  ]) {
    assert(textField(input[k]));
    s[k] = input[k];
  }
  const has = (array, id) => array.some((x) => x.id === id);
  assert(s.cards.every((c) => !c.group || has(s.groups, c.group)));
  assert(s.groups.every((g) => !g.parent || has(s.groups, g.parent)));
  for (const g of s.groups) {
    const seen = new Set([g.id]);
    let parent = g.parent;
    while (parent) {
      assert(!seen.has(parent));
      seen.add(parent);
      parent = s.groups.find((x) => x.id === parent).parent;
    }
  }
  assert(s.factors.every((f) => !f.group || has(s.groups, f.group)));
  const endpoint = (id) => has(s.groups, id) || has(s.cards, id);
  assert(
    s.relations.every(
      (r) => endpoint(r.from) && endpoint(r.to) && r.from !== r.to,
    ),
  );
  assert(
    s.causes.every(
      (c) =>
        has(s.factors, c.factor) && (!c.evidence || has(s.cards, c.evidence)),
    ),
  );
  assert(!s.focusCause || has(s.causes, s.focusCause));
  assert(
    s.nodes.every(
      (n) =>
        (!n.parent || has(s.nodes, n.parent)) &&
        (!n.cause || has(s.causes, n.cause)),
    ),
  );
  for (const n of s.nodes) {
    const visited = new Set([n.id]);
    let p = n.parent;
    while (p) {
      assert(!visited.has(p));
      visited.add(p);
      p = s.nodes.find((x) => x.id === p).parent;
    }
  }
  assert(
    !s.selectedIdea ||
      s.nodes.some((n) => n.id === s.selectedIdea && n.candidate),
  );
  assert(!s.simulation || Object.hasOwn(strategies, s.simulation));
  return s;
}
export function report(s) {
  const lines = [
    `# ${s.problem.title || "問題解決のワークシート"}`,
    "",
    s.mode === "preset"
      ? "プリセット体験：題材・調査・シミュレーションは架空です。"
      : "自由作成：入力した内容をそのまま記録しています。",
  ];
  const add = (label, value) => lines.push(`- ${label}：${value ?? "未入力"}`);
  lines.push("\n## 1. 問題の明確化");
  for (const [k, label] of Object.entries({
    who: "誰が",
    what: "何に",
    when: "いつ",
    where: "どこで",
    why: "なぜ困る",
    how: "現在のやり方",
    current: "現状",
    ideal: "理想",
    question: "調査で確かめること",
  }))
    add(label, s.problem[k]);
  add("指標", s.measure.label);
  add(
    "数え方",
    s.measure.kind === "rate"
      ? "割合（件数を合計して計算）"
      : `数値（記録した値の平均）：${s.measure.unit}`,
  );
  add(
    "実施前の元の記録",
    s.measure.kind === "rate"
      ? `${s.measure.beforeCount ?? "未記録"} / ${s.measure.beforeTotal ?? "未記録"}`
      : `${s.measure.beforeValue ?? "未記録"} ${s.measure.unit}`,
  );
  add(
    "目標",
    `${s.measure.target ?? "未入力"} ${s.measure.kind === "rate" ? "%" : s.measure.unit}（${s.measure.direction === "higher" ? "大きいほど良い" : "小さいほど良い"}）`,
  );
  add("測定条件", s.measure.conditions);
  lines.push("\n## 2. 現状の調査・整理");
  for (const g of [{ id: "", title: "未分類" }, ...s.groups]) {
    lines.push(`\n### ${g.title}`);
    for (const c of s.cards.filter((c) => c.group === g.id))
      add(kinds[c.kind], `${c.text}（出典：${c.source || "未記録"}）`);
  }
  for (const g of s.groups)
    if (g.parent)
      add(
        "上位のまとまり",
        `${g.title} → ${s.groups.find((p) => p.id === g.parent).title}`,
      );
  const endpointText = (id) =>
    [...s.groups, ...s.cards].find((x) => x.id === id)?.title ??
    s.cards.find((x) => x.id === id)?.text;
  for (const r of s.relations)
    add(
      "情報の関係（解釈）",
      `${endpointText(r.from)} → ${endpointText(r.to)}：${r.text}`,
    );
  add("整理した情報から説明できること", s.synthesis);
  lines.push("\n## 3. 原因の分析");
  for (const f of s.factors) {
    lines.push(`\n### ${f.title}`);
    for (const c of s.causes.filter((c) => c.factor === f.id)) {
      add(
        c.status === "hypothesis"
          ? "仮説"
          : c.status === "supported"
            ? "根拠あり（因果は別途確認）"
            : "反証あり",
        c.text,
      );
      add("根拠", s.cards.find((x) => x.id === c.evidence)?.text || "未接続");
      add("確かめ方", c.test);
    }
  }
  add(
    "今回調べる原因",
    s.causes.find((c) => c.id === s.focusCause)?.text || "未選択",
  );
  lines.push("\n## 4. 解決策の発想");
  function walk(parent, depth) {
    for (const n of s.nodes.filter((n) => n.parent === parent)) {
      lines.push(
        `${"  ".repeat(depth)}- ${n.text}${n.candidate ? "【比較候補】" : ""}`,
      );
      const cause = causeForNode(s, n);
      if (cause)
        lines.push(`${"  ".repeat(depth + 1)}- 対応する原因：${cause.text}`);
      walk(n.id, depth + 1);
    }
  }
  walk("", 0);
  lines.push("\n## 5. 解決策の選択・計画");
  for (const c of s.criteria) add("評価軸", `${c.title}（重み${c.weight}）`);
  for (const r of ranking(s)) {
    add("候補", `${r.node.text}：加重平均 ${r.score?.toFixed(2) ?? "未採点"}`);
    for (const c of s.criteria) add(c.title, r.node.ratings[c.id] ?? "未採点");
  }
  add(
    "選んだ対策",
    s.nodes.find((n) => n.id === s.selectedIdea)?.text || "未選択",
  );
  for (const [k, label] of Object.entries({
    who: "担当",
    when: "期間",
    test: "検証の方法",
    risk: "注意点・副作用",
  }))
    add(label, s.plan[k]);
  lines.push("\n## 6. 実行・検証");
  for (const c of s.checks)
    add(c.done ? "実施済み" : "未実施", `${c.text}：${c.note}`);
  for (const r of s.records)
    add(
      r.label,
      s.measure.kind === "rate"
        ? `${r.count ?? "未記録"} / ${r.total ?? "未記録"}（${r.note}）`
        : `${r.value ?? "未記録"} ${s.measure.unit}（${r.note}）`,
    );
  const c = comparison(s);
  const unit = s.measure.kind === "rate" ? "%" : s.measure.unit;
  add("実施前", `${c.before?.toFixed(2) ?? "未記録"} ${unit}`);
  add("実施後", `${c.after?.toFixed(2) ?? "未記録"} ${unit}`);
  add("観察・限界", s.observation);
  if (s.simulation)
    add(
      "結果の出所",
      `教材の架空シミュレーション（${strategies[s.simulation].name}）`,
    );
  if (s.resultFor && s.resultFor !== s.selectedIdea)
    add("注意", "結果は以前選んだ対策の記録。現在の選択とは異なる。");
  if (simulationChanged(s))
    add(
      "注意",
      "架空結果は編集前の題材・案・指標のものです。現在の条件には当てはめられません。",
    );
  if (c.invalid)
    add("注意", "結果の行が未入力または件数不整合のため集計していません。");
  lines.push("\n## 7. 評価・改善");
  for (const [k, label] of Object.entries({
    keep: "Keep 続ける",
    problem: "Problem 課題",
    try: "Try 次に試す",
  })) {
    lines.push(`\n### ${label}`);
    for (const n of s.kpt.filter((n) => n.kind === k))
      add(n.text, n.source || "根拠未記録");
  }
  add("次の一歩", s.next);
  return lines.join("\n");
}
