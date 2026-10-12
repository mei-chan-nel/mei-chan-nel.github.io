// Browser-local, versioned workbook. No server or external service is used.
export const VERSION = 3;
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
    "ブレーンストーミング・KJ法",
    "発言を広げ、情報を読み合わせ、まとまり・関係・全体の説明を作る。",
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
    presetWrites: [],
    reviewNotes: Array.from({ length: 7 }, () => []),
    brainstorm: [],
    relations: [],
    kjDiagramReady: false,
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

export function brainstormingExample() {
  return [
    {
      id: "bs-notice",
      text: "なくした物が箱にあると思っていないのでは？",
      kind: "hypothesis",
      parent: "",
      card: "",
    },
    {
      id: "bs-time",
      text: "箱を見たい時間に見られないのでは？",
      kind: "hypothesis",
      parent: "",
      card: "",
    },
    {
      id: "bs-chance",
      text: "見る時間を変えたり、別の場所でも確認できたりしたらどうだろう",
      kind: "opinion",
      parent: "bs-time",
      card: "",
    },
    {
      id: "bs-shame",
      text: "人前で箱を探すのを避ける人もいるのでは？",
      kind: "hypothesis",
      parent: "",
      card: "",
    },
  ];
}
export function brainstormToCards(s, ids = s.brainstorm.map((n) => n.id)) {
  const selected = new Set(ids),
    added = [];
  for (const note of s.brainstorm) {
    if (
      !selected.has(note.id) ||
      !note.text.trim() ||
      note.card ||
      s.cards.length >= 300
    )
      continue;
    const card = {
      id: uid(),
      text: note.text,
      kind: note.kind,
      group: "",
      source: "ブレーンストーミングの発言・未調査／未検証",
    };
    s.cards.push(card);
    note.card = card.id;
    added.push(card.id);
  }
  return added;
}
// Show concrete outputs and the actual data available to the following stage.
export function stageSummary(s, step = s.step) {
  const row = (label, value) => ({ label, value: String(value || "未入力") });
  const count = (list, field = "text") =>
    list.filter((n) => n[field]?.trim()).length;
  const done = [],
    passed = [],
    pending = [];
  const metric = () => {
    const c = comparison(s),
      unit = s.measure.kind === "rate" ? "%" : s.measure.unit;
    return `${s.measure.label || "指標未入力"}：実施前 ${c.before ?? "未記録"}${c.before === null ? "" : unit} → 目標 ${s.measure.target ?? "未入力"}${s.measure.target === null ? "" : unit}`;
  };
  const focus = s.causes.find((c) => c.id === s.focusCause);
  const chosen = s.nodes.find((n) => n.id === s.selectedIdea);
  if (step === 0) {
    done.push(
      row("問題・課題", s.problem.title),
      row(
        "5W1H",
        `${["who", "what", "when", "where", "why", "how"].filter((k) => s.problem[k].trim()).length}/6項目を記入`,
      ),
      row("現状と目標", metric()),
    );
    passed.push(
      row("問題・課題", s.problem.title),
      row("調査で確かめること", s.problem.question),
      row("比較する指標", metric()),
    );
    if (!s.problem.question.trim())
      pending.push("調査で何を確かめるかは、まだ記入されていません。");
  } else if (step === 1) {
    done.push(
      row(
        "ブレーンストーミング",
        `${count(s.brainstorm)}件の発言、${s.brainstorm.filter((n) => n.card).length}件をKJ法へ`,
      ),
      row(
        "KJ法",
        `${s.cards.length}枚の情報、${s.groups.length}個のまとまり、${s.relations.length}本の関係線`,
      ),
      row("全体の説明", s.synthesis),
    );
    passed.push(
      row(
        "原因を考える材料",
        `${s.cards.length}枚（事実 ${s.cards.filter((c) => c.kind === "fact").length}・意見 ${s.cards.filter((c) => c.kind === "opinion").length}・仮説 ${s.cards.filter((c) => c.kind === "hypothesis").length}・検証結果 ${s.cards.filter((c) => c.kind === "result").length}）。種類と出典を保って使います。`,
      ),
      row(
        "まとまりの表札",
        s.groups
          .map((g) => g.title)
          .filter(Boolean)
          .join(" ／ "),
      ),
      row("整理した情報からの説明", s.synthesis),
    );
    if (!s.synthesis.trim())
      pending.push("情報全体から説明できることは、まだ文章にしていません。");
    if (s.brainstorm.some((n) => n.text.trim() && !n.card))
      pending.push(
        "KJ法へ渡していない発言が残っています。発言ボードで続けられます。",
      );
  } else if (step === 2) {
    done.push(
      row(
        "特性要因図",
        `${s.factors.length}本の大骨、${s.causes.length}個の原因の候補`,
      ),
      row(
        "仮説の確かめ方",
        `${count(s.causes, "test")}/${s.causes.length}件を記入`,
      ),
    );
    passed.push(
      row("次に対策を考える原因", focus?.text || "未選択"),
      row(
        "結び付けた根拠",
        s.cards.find((c) => c.id === focus?.evidence)?.text || "未接続",
      ),
      row("確かめる方法", focus?.test),
    );
    if (!focus)
      pending.push(
        "次に使う原因は、まだ選んでいません。原因の編集欄で選べます。",
      );
  } else if (step === 3) {
    const candidates = s.nodes.filter((n) => n.candidate);
    done.push(
      row(
        "マインドマップ",
        `${s.nodes.length}本の枝、${candidates.length}件の比較候補`,
      ),
      row(
        "比較する案",
        candidates
          .map((n) => n.text)
          .filter(Boolean)
          .join(" ／ "),
      ),
    );
    passed.push(
      row(
        "比較表に入る案",
        candidates
          .map((n) => n.text)
          .filter(Boolean)
          .join(" ／ "),
      ),
      row(
        "原因とのつながり",
        candidates
          .map(
            (n) =>
              `${n.text || "名前未入力"} → ${causeForNode(s, n)?.text || "原因未接続"}`,
          )
          .join(" ／ "),
      ),
    );
    if (!candidates.length)
      pending.push(
        "比較したい具体案には、枝の編集欄で「比較表へ送る」を付けます。",
      );
  } else if (step === 4) {
    done.push(
      row(
        "意思決定マトリクス",
        `${s.criteria.length}個の評価軸、${ranking(s).filter((r) => r.score !== null).length}件を採点`,
      ),
      row("試す案", chosen?.text || "未選択"),
    );
    passed.push(
      row("今回試す案", chosen?.text || "未選択"),
      row(
        "担当・期間",
        `${s.plan.who || "担当未入力"} ／ ${s.plan.when || "期間未入力"}`,
      ),
      row(
        "確かめ方・注意点",
        [s.plan.test, s.plan.risk].filter(Boolean).join(" ／ "),
      ),
      row("比べる指標", metric()),
    );
    if (!chosen) pending.push("試す案は、比較表の選択欄で選べます。");
  } else if (step === 5) {
    const c = comparison(s),
      unit = s.measure.kind === "rate" ? "%" : s.measure.unit;
    done.push(
      row(
        "実施の記録",
        `${s.checks.filter((n) => n.done).length}/${s.checks.length}件の作業が実施済み`,
      ),
      row(
        "検証の記録",
        `${s.records.length}行。実施前 ${c.before ?? "未記録"}${c.before === null ? "" : unit} → 実施後 ${c.after ?? "未記録"}${c.after === null ? "" : unit}`,
      ),
    );
    passed.push(
      row(
        "試した案と結果",
        `${s.nodes.find((n) => n.id === s.resultFor)?.text || chosen?.text || "案未選択"}：${c.after ?? "未記録"}${c.after === null ? "" : unit}${s.simulation ? "（架空の結果）" : ""}`,
      ),
      row("数値以外の変化・比較の限界", s.observation),
      row("測定条件", s.measure.conditions),
    );
    if (c.after === null)
      pending.push("比較できる実施結果は、まだ記録されていません。");
  } else {
    done.push(
      row(
        "KPT",
        `Keep ${s.kpt.filter((n) => n.kind === "keep").length}件・Problem ${s.kpt.filter((n) => n.kind === "problem").length}件・Try ${s.kpt.filter((n) => n.kind === "try").length}件`,
      ),
    );
    passed.push(row("次の改善で試すこと", s.next));
    if (!s.next.trim())
      pending.push("次の具体的な行動は、まだ記入されていません。");
  }
  return { completed: done, passed, pending };
}
export function markEdited(s, step, notes = []) {
  for (let i = step + 1; i < 7; i++)
    if (s.done[i]) {
      s.review[i] = true;
      for (const note of notes) {
        const existing = s.reviewNotes[i].find(
          (n) => n.source === note.source && n.path === note.path,
        );
        if (existing) {
          existing.after = note.after;
          existing.label = note.label;
        } else s.reviewNotes[i].push({ ...note });
      }
      s.reviewNotes[i] = s.reviewNotes[i].slice(-20);
    }
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

const collections = [
  "brainstorm",
  "cards",
  "groups",
  "relations",
  "factors",
  "causes",
  "nodes",
  "criteria",
  "checks",
  "records",
  "kpt",
];
export function binding(s, path) {
  const parts = path.split(".");
  let object = s;
  for (const key of parts.slice(0, -1)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) return null;
    object = Array.isArray(object)
      ? object.find((x) => x.id === key)
      : object?.[key];
    if (!object) return null;
  }
  return [object, parts.at(-1)];
}
export function presetValue(s, path) {
  const p = presetExample();
  if (path === "focusCause")
    return p.causes.find((original) =>
      s.causes.some((c) => c.id === original.id && c.text === original.text),
    )?.id;
  if (path === "selectedIdea")
    return p.nodes.find((original) =>
      s.nodes.some(
        (n) => n.id === original.id && n.candidate && n.text === original.text,
      ),
    )?.id;
  if (path === "synthesis")
    return "箱の場所を知っている人はいるが、自分の物と気付かない声もある。受け取り時間や人目が気になる声もあり、案内だけでは行動につながらない可能性がある。記名の有無と担当者の負担も残して調べたい。これは解釈であり、原因の証明ではない。";
  if (path.includes(".ratings.")) {
    const parts = path.split("."),
      node = s.nodes.find((n) => n.id === parts[1]),
      original = p.nodes.find((n) => n.id === parts[1]);
    const criterion = s.criteria.find((c) => c.id === parts[3]),
      sample = p.criteria.find((c) => c.id === parts[3]);
    if (
      !node ||
      !original ||
      node.text !== original.text ||
      !criterion ||
      criterion.title !== sample?.title
    )
      return undefined;
  }
  if (path === "observation") {
    if (
      !canSimulate(s) ||
      s.resultFor !== s.selectedIdea ||
      simulationChanged(s)
    )
      return undefined;
    const note =
      strategies[s.nodes.find((n) => n.id === s.selectedIdea)?.strategy]?.note;
    const c = comparison(s);
    if (!note || c.after === null) return undefined;
    const entered = s.records.filter(
      (r) => r.count !== null && r.total !== null,
    );
    return `記入済みの${entered.length}行では、返却は${entered.reduce((sum, r) => sum + r.count, 0)}/${entered.reduce((sum, r) => sum + r.total, 0)}件（${c.after.toFixed(1)}%）。以下はこの案の4週間の架空の観察メモ：${note.replace(/^返却は[0-9]+\/[0-9]+件。/, "")}`;
  }
  if (path === "next") {
    const attempt = s.kpt.find((k) => k.kind === "try" && k.text);
    return attempt
      ? `来週、${s.plan.who || "担当者"}が「${attempt.text}」を始める。聞いた内容を新しい調査カードとして記録する。`
      : undefined;
  }
  if (path === "plan.test") {
    const n = s.nodes.find((n) => n.id === s.selectedIdea);
    return n ? `「${n.text}」を小さく試す。${p.plan.test}` : undefined;
  }
  const pair = binding(p, path);
  return pair?.[0]?.[pair[1]];
}
const presetPattern =
  /^(field:(?:problem\.[a-z]+|measure\.[a-zA-Z]+|plan\.[a-z]+|(?:causes|nodes|criteria)\.[-a-zA-Z0-9]+\.(?:text|test|title|weight|ratings\.v-[0-2])|observation|next|synthesis|selectedIdea|focusCause)|(?:card|factor|cause|branch|criterion|check):[-a-zA-Z0-9]+|group:(?:recognize|access)|relation:awareness|link:brainstorm|record:[0-3]|kpt:(?:keep|problem|try))$/;
export const validPresetId = (id) =>
  typeof id === "string" &&
  (presetPattern.test(id) ||
    /^block:(context|gap|brainstorm|cards|groups|diagram|causes|tests|criteria|scores|plan|checks|results|kpt)$/.test(
      id,
    ) ||
    /^branchset:n-(access|notice|prevent)$/.test(id));
export function removeItem(s, collection, id) {
  const item = s[collection].find((x) => x.id === id);
  if (!item) return;
  if (collection === "nodes")
    for (const n of s.nodes) if (n.parent === id) n.parent = item.parent;
  if (collection === "groups")
    for (const g of s.groups) if (g.parent === id) g.parent = item.parent;
  if (collection === "factors") {
    const attached = s.causes.filter((c) => c.factor === id);
    if (attached.length) {
      let other = s.factors.find((f) => f.id !== id);
      if (!other) {
        other = { id: uid(), title: "残した原因の切り口", group: "" };
        s.factors.push(other);
      }
      attached.forEach((c) => (c.factor = other.id));
    }
  }
  s[collection] = s[collection].filter((x) => x.id !== id);
  cleanReferences(s);
}
export function cleanReferences(s) {
  const has = (key, id) => s[key].some((x) => x.id === id);
  for (const n of s.brainstorm) {
    if (n.parent && !has("brainstorm", n.parent)) n.parent = "";
    if (n.card && !has("cards", n.card)) n.card = "";
  }
  for (const c of s.cards) if (c.group && !has("groups", c.group)) c.group = "";
  for (const f of s.factors)
    if (f.group && !has("groups", f.group)) f.group = "";
  for (const c of s.causes)
    if (c.evidence && !has("cards", c.evidence)) c.evidence = "";
  for (const n of s.nodes) {
    if (n.cause && !has("causes", n.cause)) n.cause = "";
    if (n.parent && !has("nodes", n.parent)) n.parent = "";
    for (const id of Object.keys(n.ratings))
      if (!has("criteria", id)) delete n.ratings[id];
  }
  for (const g of s.groups)
    if (g.parent && !has("groups", g.parent)) g.parent = "";
  if (s.focusCause && !has("causes", s.focusCause)) s.focusCause = "";
  if (
    s.selectedIdea &&
    !s.nodes.some((n) => n.id === s.selectedIdea && n.candidate)
  )
    s.selectedIdea = "";
  const endpoint = (id) => has("groups", id) || has("cards", id);
  s.relations = s.relations.filter(
    (r) => endpoint(r.from) && endpoint(r.to) && r.from !== r.to,
  );
  for (const write of s.presetWrites) {
    write.rows = write.rows.filter((r) => has(r.collection, r.id));
    write.fields = write.fields.filter(
      (p) =>
        binding(s, p.path) &&
        (!p.path.includes(".ratings.") ||
          has("criteria", p.path.split(".")[3])),
    );
  }
  s.presetWrites = s.presetWrites.filter(
    (w) => w.rows.length || w.fields.length,
  );
  if (!s.records.length && !s.observation) {
    s.resultFor = "";
    s.simulation = "";
  }
}
function leaves(s) {
  const map = new Map();
  for (const key of ["problem", "measure", "plan"])
    for (const [field, value] of Object.entries(s[key]))
      map.set(`${key}.${field}`, value);
  for (const key of [
    "synthesis",
    "observation",
    "next",
    "selectedIdea",
    "focusCause",
    "kjDiagramReady",
  ])
    map.set(key, s[key]);
  for (const key of collections)
    for (const row of s[key])
      for (const [field, value] of Object.entries(row)) {
        if (field === "id") continue;
        if (field === "ratings")
          for (const [criterion, score] of Object.entries(value))
            map.set(`${key}.${row.id}.ratings.${criterion}`, score);
        else map.set(`${key}.${row.id}.${field}`, value);
      }
  return map;
}
function toggleSinglePreset(s, id, options = {}) {
  if (s.mode !== "preset" || !validPresetId(id)) return { ok: false };
  const active = s.presetWrites.find((w) => w.id === id);
  if (active) {
    for (const patch of active.fields) {
      const pair = binding(s, patch.path);
      if (pair) pair[0][pair[1]] = patch.before;
    }
    // Remove children before parents, so references from other work stay valid.
    for (const row of [...active.rows].reverse())
      removeItem(s, row.collection, row.id);
    s.presetWrites = s.presetWrites.filter((w) => w.id !== id);
    cleanReferences(s);
    return {
      ok: true,
      cleared: true,
      paths: active.fields.map((p) => p.path),
      rows: active.rows,
    };
  }
  const before = structuredClone(s),
    p = presetExample();
  const add = (collection, row) => {
    if (
      s[collection].length >= 300 ||
      s[collection].some((x) => x.id === row.id)
    )
      return false;
    s[collection].push(structuredClone(row));
    return true;
  };
  const set = (path, value) => {
    if (value === undefined) return;
    const pair = binding(s, path);
    if (
      pair &&
      (pair[0][pair[1]] === "" ||
        pair[0][pair[1]] === null ||
        pair[0][pair[1]] === undefined)
    )
      pair[0][pair[1]] = value;
  };
  const [type, key] = id.split(":");
  if (type === "field") set(key, presetValue(s, key));
  if (id === "link:brainstorm") brainstormToCards(s);
  if (id === "block:brainstorm")
    for (const note of brainstormingExample()) add("brainstorm", note);
  if (id === "block:diagram" && (s.cards.length || s.groups.length))
    s.kjDiagramReady = true;
  if (type === "card") {
    const c = p.cards.find((c) => c.id === key);
    if (!c) return { ok: false };
    add("cards", c);
  }
  if (type === "group") {
    const recognize = key === "recognize",
      groupId = recognize ? "g-recognize" : "g-access";
    const ids = recognize
      ? ["c-known", "c-own", "c-hyp"]
      : ["c-time", "c-shame", "c-look"];
    if (!s.cards.some((c) => ids.includes(c.id) && c.text))
      return { ok: false };
    add("groups", {
      id: groupId,
      title: recognize
        ? "箱の場所を知っていても、自分の物とは気付かない"
        : "箱を確認し、受け取る行動に壁がある",
      parent: "",
    });
    for (const c of s.cards)
      if (ids.includes(c.id) && !c.group) c.group = groupId;
  }
  if (type === "relation") {
    if (
      !s.groups.some((g) => g.id === "g-recognize") ||
      !s.groups.some((g) => g.id === "g-access")
    )
      return { ok: false };
    add("relations", {
      id: "r-awareness",
      from: "g-recognize",
      to: "g-access",
      text: "気付いても、確認・受け取りの壁が残る可能性",
    });
  }
  if (type === "factor") {
    const f = p.factors.find((f) => f.id === key);
    if (!f) return { ok: false };
    add("factors", f);
  }
  if (type === "cause") {
    const c = p.causes.find((c) => c.id === key),
      factor = s.factors.find((f) => f.id === options.factor);
    if (!c || !factor) return { ok: false };
    add("causes", {
      ...c,
      factor: factor.id,
      test: "",
      evidence: s.cards.some((x) => x.id === c.evidence) ? c.evidence : "",
    });
  }
  if (type === "branch") {
    const n = p.nodes.find((n) => n.id === key);
    if (!n) return { ok: false };
    const parent = n.parent
      ? s.nodes.find((n) => n.id === options.parent)
      : null;
    if (n.parent && !parent) return { ok: false };
    add("nodes", {
      ...n,
      parent: parent?.id || "",
      cause: n.cause && s.causes.some((c) => c.id === n.cause) ? n.cause : "",
      ratings: {},
    });
  }
  if (type === "criterion") {
    const c = p.criteria.find((c) => c.id === key);
    if (!c) return { ok: false };
    add("criteria", c);
  }
  if (type === "check") {
    const c = p.checks.find((c) => c.id === key);
    if (!c) return { ok: false };
    add("checks", c);
  }
  if (type === "record") {
    if (!canSimulate(s) || (s.resultFor && s.resultFor !== s.selectedIdea))
      return { ok: false };
    const strategy = s.nodes.find((n) => n.id === s.selectedIdea).strategy;
    add("records", {
      id: `record-${key}`,
      label: `第${Number(key) + 1}週に集まった物（各4週間追跡）`,
      count: strategies[strategy].returned[Number(key)],
      total: 10,
      value: null,
      note: "教材の架空データ",
    });
    s.resultFor = s.selectedIdea;
    s.simulation = strategy;
  }
  if (type === "kpt") {
    const result = comparison(s),
      n = s.nodes.find((n) => n.id === s.resultFor);
    if (result.after === null || !n) return { ok: false };
    const text =
      key === "keep"
        ? `「${n.text}」で役立った工夫を残す。${s.measure.label}は${result.after.toFixed(1)}${s.measure.kind === "rate" ? "%" : s.measure.unit}。`
        : key === "problem"
          ? s.observation || "数値に出ない負担や、届かなかった人を確かめる"
          : "受け取りに来られない人に話を聞き、届いていない理由を調べ直す";
    add("kpt", {
      id: `kp-${key}`,
      kind: key,
      text,
      source: s.simulation ? "教材の架空の実施結果" : "自分で記録した実施結果",
    });
  }
  const old = leaves(before),
    current = leaves(s),
    rows = [];
  for (const collection of collections)
    for (const row of s[collection])
      if (!before[collection].some((x) => x.id === row.id))
        rows.push({ collection, id: row.id });
  const fields = [];
  for (const [path, value] of current)
    if (
      (old.has(path) || (type === "field" && path === key)) &&
      old.get(path) !== value
    )
      fields.push({ path, before: old.get(path) ?? null, after: value });
  if (!rows.length && !fields.length) return { ok: false };
  s.presetWrites.push({ id, fields, rows });
  return { ok: true, cleared: false, paths: fields.map((p) => p.path), rows };
}
// Group only a coherent piece of work; later stages are never filled implicitly.
function presetRequests(s, id) {
  const p = presetExample(),
    fields = (paths) => paths.map((path) => ({ id: `field:${path}` })),
    rows = (type, list) => list.map((row) => ({ id: `${type}:${row.id}` }));
  const key = id.split(":")[1];
  if (id.startsWith("branchset:")) {
    const root = p.nodes.find((n) => n.id === key && !n.parent);
    return root
      ? [
          { id: `branch:${root.id}` },
          ...p.nodes
            .filter((n) => n.parent === root.id)
            .map((n) => ({ id: `branch:${n.id}`, parent: root.id })),
        ]
      : [];
  }
  if (!id.startsWith("block:")) return [];
  if (key === "context")
    return fields(
      ["title", "who", "what", "when", "where", "why", "how"].map(
        (k) => `problem.${k}`,
      ),
    );
  if (key === "gap")
    return fields([
      "problem.current",
      "problem.ideal",
      "measure.label",
      "measure.beforeCount",
      "measure.beforeTotal",
      "measure.target",
      "measure.conditions",
    ]);
  if (key === "cards")
    return [...rows("card", p.cards), { id: "link:brainstorm" }];
  if (key === "groups")
    return [{ id: "group:recognize" }, { id: "group:access" }];
  if (key === "causes")
    return [
      ...p.factors.flatMap((f) => [
        { id: `factor:${f.id}` },
        ...p.causes
          .filter((c) => c.factor === f.id)
          .map((c) => ({ id: `cause:${c.id}`, factor: f.id })),
      ]),
      { id: "field:focusCause" },
    ];
  if (key === "tests")
    return fields(s.causes.map((c) => `causes.${c.id}.test`));
  if (key === "criteria") return rows("criterion", p.criteria);
  if (key === "scores")
    return [
      ...fields(
        s.nodes
          .filter((n) => n.candidate)
          .flatMap((n) =>
            s.criteria.map((c) => `nodes.${n.id}.ratings.${c.id}`),
          ),
      ),
      { id: "field:selectedIdea" },
    ];
  if (key === "plan")
    return fields(Object.keys(s.plan).map((k) => `plan.${k}`));
  if (key === "checks") return rows("check", p.checks);
  if (key === "results")
    return [0, 1, 2, 3].map((i) => ({ id: `record:${i}` }));
  if (key === "kpt")
    return ["keep", "problem", "try"].map((k) => ({ id: `kpt:${k}` }));
  return [];
}
export function presetActive(s, id) {
  const targets = new Set([id, ...presetRequests(s, id).map((r) => r.id)]);
  return s.presetWrites.some((w) => targets.has(w.id));
}
export function presetChanges(before, s) {
  const old = leaves(before),
    current = leaves(s),
    paths = [];
  for (const path of new Set([...old.keys(), ...current.keys()])) {
    if (old.get(path) === current.get(path)) continue;
    if (!old.has(path) && ["", null, false].includes(current.get(path)))
      continue;
    paths.push(path);
  }
  for (const key of ["focusCause", "selectedIdea", "resultFor", "simulation"])
    if (before[key] !== s[key] && !paths.includes(key)) paths.push(key);
  const rows = [];
  for (const collection of collections)
    for (const id of new Set([
      ...before[collection].map((r) => r.id),
      ...s[collection].map((r) => r.id),
    ]))
      if (
        before[collection].some((r) => r.id === id) !==
        s[collection].some((r) => r.id === id)
      )
        rows.push({ collection, id });
  const gap = (x) => [
    comparison(x).before,
    x.measure.target,
    x.measure.kind,
    x.measure.unit,
  ];
  const graph = (x) => [
    comparison(x),
    x.measure.target,
    x.measure.label,
    x.measure.kind,
    x.measure.unit,
  ];
  const matrix = (x) => ranking(x).map((r) => [r.node.id, r.score]);
  return {
    paths,
    rows,
    derived: {
      gap: JSON.stringify(gap(before)) !== JSON.stringify(gap(s)),
      graph: JSON.stringify(graph(before)) !== JSON.stringify(graph(s)),
      matrix: JSON.stringify(matrix(before)) !== JSON.stringify(matrix(s)),
    },
  };
}
export function togglePreset(s, id, options = {}) {
  if (s.mode !== "preset" || !validPresetId(id)) return { ok: false };
  const requests = presetRequests(s, id),
    before = structuredClone(s);
  if (!requests.length) {
    const result = toggleSinglePreset(s, id, options);
    return result.ok ? { ...result, ...presetChanges(before, s) } : result;
  }
  // Existing individual receipts remain reversible through the new grouped control.
  const targets = new Set(requests.map((r) => r.id)),
    prior = s.presetWrites.filter((w) => w.id === id || targets.has(w.id));
  if (prior.length) {
    const fields = [],
      rows = [];
    for (const write of prior) {
      for (const patch of write.fields)
        if (!fields.some((p) => p.path === patch.path)) fields.push(patch);
      for (const row of write.rows)
        if (
          !rows.some((r) => r.collection === row.collection && r.id === row.id)
        )
          rows.push(row);
    }
    s.presetWrites = s.presetWrites.filter(
      (w) => w.id !== id && !targets.has(w.id),
    );
    s.presetWrites.push({ id, fields, rows });
    const result = toggleSinglePreset(s, id, options);
    return { ...result, ...presetChanges(before, s) };
  }
  if (
    id === "block:results" &&
    (!canSimulate(s) || (s.resultFor && s.resultFor !== s.selectedIdea))
  )
    return { ok: false };
  const receipts = [];
  for (const request of requests) {
    const result = toggleSinglePreset(s, request.id, request);
    if (result.ok)
      receipts.push(s.presetWrites.find((w) => w.id === request.id));
  }
  if (!receipts.length) return { ok: false };
  const fields = receipts.flatMap((w) => w.fields),
    rows = receipts.flatMap((w) => w.rows);
  s.presetWrites = s.presetWrites.filter((w) => !targets.has(w.id));
  s.presetWrites.push({ id, fields, rows });
  return { ok: true, cleared: false, ...presetChanges(before, s) };
}
export function changeNotes(before, s, source) {
  const labels = {
    title: "問題・課題",
    who: "誰が",
    what: "起きている問題",
    when: "時期・期間",
    where: "場所",
    why: "困る理由",
    how: "現在のやり方",
    current: "現状",
    ideal: "理想",
    question: "調査で確かめること",
    label: "指標",
    beforeCount: "実施前の成功件数",
    beforeTotal: "実施前の対象件数",
    target: "目標値",
    conditions: "測定条件",
    test: "確かめ方",
    text: "内容",
    evidence: "根拠カード",
    parent: "親の枝",
    cause: "対応する原因",
    group: "まとまり",
    weight: "重み",
    candidate: "比較候補",
    source: "出典",
    kind: "情報の種類",
    status: "確かさ",
    direction: "改善する方向",
    unit: "単位",
    count: "成功件数",
    total: "対象件数",
    value: "測定値",
    ratings: "点数",
  };
  const names = {
    brainstorm: "ブレーンストーミングの発言",
    cards: "調査カード",
    groups: "表札",
    relations: "関係線",
    factors: "大骨",
    causes: "原因の候補",
    nodes: "発想の枝",
    criteria: "評価軸",
    checks: "確認項目",
    records: "実施結果",
    kpt: "振り返り",
  };
  const notes = [],
    old = leaves(before),
    current = leaves(s);
  const display = (v) =>
    v === null || v === "" || v === undefined
      ? "空欄"
      : String(v).slice(0, 180);
  const name = (key, id) => {
    const row = [...s[key], ...before[key]].find((x) => x.id === id);
    return `${names[key]}「${String(row?.title || row?.text || row?.label || "名前なし").slice(0, 45)}」`;
  };
  for (const collection of collections) {
    for (const row of s[collection])
      if (!before[collection].some((x) => x.id === row.id))
        notes.push({
          source,
          path: `${collection}.${row.id}`,
          label: name(collection, row.id),
          before: "なし",
          after: "追加",
        });
    for (const row of before[collection])
      if (!s[collection].some((x) => x.id === row.id))
        notes.push({
          source,
          path: `${collection}.${row.id}`,
          label: name(collection, row.id),
          before: "あり",
          after: "削除",
        });
  }
  for (const [path, value] of current)
    if (
      !["selectedIdea", "focusCause", "kjDiagramReady"].includes(path) &&
      (old.has(path) || path.includes(".ratings.")) &&
      old.get(path) !== value
    ) {
      const [key, id, field] = path.split(".");
      const label = collections.includes(key)
        ? `${name(key, id)}の${field === "ratings" ? `${s.criteria.find((c) => c.id === path.split(".")[3])?.title || "評価軸"}の点数` : key === "groups" && field === "parent" ? "上位のまとまり" : labels[field] || field}`
        : {
            synthesis: "整理した情報から説明できること",
            observation: "数値以外の変化・副作用・比較の限界",
            next: "次の一歩",
          }[key] ||
          labels[id] ||
          key;
      notes.push({
        source,
        path,
        label:
          key === "brainstorm" && ["parent", "card"].includes(field)
            ? `${name(key, id)}の${field === "parent" ? "発展元の発言" : "KJ法へ渡したカード"}`
            : label,
        before:
          key === "brainstorm" && ["parent", "card"].includes(field)
            ? before[field === "parent" ? "brainstorm" : "cards"].find(
                (n) => n.id === old.get(path),
              )?.text || "なし"
            : display(old.get(path)),
        after:
          key === "brainstorm" && ["parent", "card"].includes(field)
            ? s[field === "parent" ? "brainstorm" : "cards"].find(
                (n) => n.id === value,
              )?.text || "なし"
            : display(value),
      });
    }
  for (const key of ["focusCause", "selectedIdea"])
    if (before[key] !== s[key]) {
      const list = key === "focusCause" ? "causes" : "nodes";
      notes.push({
        source,
        path: key,
        label: key === "focusCause" ? "発想に使う原因" : "今回試す案",
        before:
          before[list].find((x) => x.id === before[key])?.text || "未選択",
        after: s[list].find((x) => x.id === s[key])?.text || "未選択",
      });
    }
  return notes.slice(0, 20);
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
    [1, 2, VERSION].includes(input.version) &&
      ["free", "preset"].includes(input.mode),
  );
  s.mode = input.mode;
  s.kjDiagramReady =
    input.kjDiagramReady === undefined
      ? Boolean(input.cards?.length || input.groups?.length)
      : input.kjDiagramReady;
  assert(typeof s.kjDiagramReady === "boolean");
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
  s.presetWrites = input.presetWrites ?? [];
  assert(Array.isArray(s.presetWrites) && s.presetWrites.length <= 150);
  s.presetWrites = s.presetWrites.map((w) => {
    assert(
      w &&
        validPresetId(w.id) &&
        Array.isArray(w.fields) &&
        w.fields.length <= 300 &&
        Array.isArray(w.rows) &&
        w.rows.length <= 300,
    );
    const fields = w.fields.map((p) => {
      assert(
        p &&
          typeof p.path === "string" &&
          /^(problem|measure|plan|brainstorm|cards|groups|relations|factors|causes|nodes|criteria|checks|records|kpt|synthesis|observation|next|selectedIdea|focusCause|kjDiagramReady)(\.[-a-zA-Z0-9]+){0,3}$/.test(
            p.path,
          ),
      );
      assert(
        !p.path
          .split(".")
          .some((k) =>
            ["__proto__", "prototype", "constructor", "id"].includes(k),
          ),
      );
      const primitive = (v) =>
        v === null ||
        typeof v === "boolean" ||
        textField(v) ||
        (typeof v === "number" && numberField(v));
      assert(primitive(p.before) && primitive(p.after));
      return { path: p.path, before: p.before, after: p.after };
    });
    const rows = w.rows.map((r) => {
      assert(
        r &&
          collections.includes(r.collection) &&
          typeof r.id === "string" &&
          /^[-a-zA-Z0-9]+$/.test(r.id),
      );
      return { collection: r.collection, id: r.id };
    });
    return { id: w.id, fields, rows };
  });
  if (
    input.kjDiagramReady === undefined &&
    s.mode === "preset" &&
    s.kjDiagramReady &&
    !s.presetWrites.some((w) => w.id === "block:diagram")
  )
    s.presetWrites.push({
      id: "block:diagram",
      fields: [{ path: "kjDiagramReady", before: false, after: true }],
      rows: [],
    });
  assert(
    new Set(s.presetWrites.map((w) => w.id)).size === s.presetWrites.length,
  );
  const previousResults = s.presetWrites.find((w) => w.id === "block:results");
  const previousObservation =
    previousResults?.fields.filter((p) => p.path === "observation") ?? [];
  if (previousObservation.length) {
    previousResults.fields = previousResults.fields.filter(
      (p) => p.path !== "observation",
    );
    if (!s.presetWrites.some((w) => w.id === "field:observation"))
      s.presetWrites.push({
        id: "field:observation",
        fields: previousObservation,
        rows: [],
      });
  }
  s.reviewNotes = input.reviewNotes ?? Array.from({ length: 7 }, () => []);
  assert(Array.isArray(s.reviewNotes) && s.reviewNotes.length === 7);
  s.reviewNotes = s.reviewNotes.map((notes) => {
    assert(Array.isArray(notes) && notes.length <= 20);
    return notes.map((n) =>
      object(n, {
        source: (v) => Number.isInteger(v) && v >= 0 && v < 7,
        path: textField,
        label: textField,
        before: textField,
        after: textField,
      }),
    );
  });
  s.synthesis = input.synthesis ?? "";
  assert(textField(s.synthesis));
  s.relations = list(input.relations ?? [], {
    ...base,
    from: textField,
    to: textField,
    text: textField,
  });
  s.brainstorm = list(input.brainstorm ?? [], {
    ...base,
    text: textField,
    kind: (v) => ["opinion", "hypothesis"].includes(v),
    parent: textField,
    card: textField,
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
  assert(
    s.brainstorm.every(
      (n) =>
        (!n.parent || has(s.brainstorm, n.parent)) &&
        (!n.card || has(s.cards, n.card)),
    ),
  );
  for (const n of s.brainstorm) {
    const seen = new Set([n.id]);
    let parent = n.parent;
    while (parent) {
      assert(!seen.has(parent));
      seen.add(parent);
      parent = s.brainstorm.find((p) => p.id === parent).parent;
    }
  }
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
  const editable = leaves(s);
  for (const write of s.presetWrites) {
    for (const patch of write.fields) {
      const pair = binding(s, patch.path),
        current = pair?.[0]?.[pair[1]];
      const rating = /^nodes\.[-a-zA-Z0-9]+\.ratings\.[-a-zA-Z0-9]+$/.test(
        patch.path,
      );
      assert(
        pair &&
          (editable.has(patch.path) ||
            (rating && s.criteria.some((c) => c.id === pair[1]))),
      );
      for (const v of [patch.before, patch.after]) {
        if (rating)
          assert(v === null || (Number.isInteger(v) && v >= 1 && v <= 5));
        else if (current === null || typeof current === "number")
          assert(numberField(v));
        else assert(typeof v === typeof current);
      }
      if (patch.path.endsWith(".weight"))
        assert(
          [patch.before, patch.after].every(
            (v) => Number.isInteger(v) && v >= 1 && v <= 5,
          ),
        );
    }
    assert(write.rows.every((r) => s[r.collection].some((x) => x.id === r.id)));
  }
  if (input.version < 3 && s.mode === "preset") {
    const p = presetExample();
    const field = (path) => {
      const current = binding(s, path),
        original = presetValue(s, path);
      if (
        current &&
        original !== undefined &&
        current[0][current[1]] !== undefined &&
        current[0][current[1]] !== "" &&
        current[0][current[1]] !== null &&
        current[0][current[1]] === original
      )
        s.presetWrites.push({
          id: `field:${path}`,
          fields: [
            {
              path,
              before: typeof original === "number" ? null : "",
              after: original,
            },
          ],
          rows: [],
        });
    };
    if (s.examples.includes("context"))
      for (const key of ["title", "who", "what", "when", "where", "why", "how"])
        field(`problem.${key}`);
    if (s.examples.includes("gap")) {
      for (const key of ["current", "ideal"]) field(`problem.${key}`);
      for (const key of [
        "label",
        "beforeCount",
        "beforeTotal",
        "target",
        "conditions",
      ])
        field(`measure.${key}`);
    }
    if (s.examples.includes("question")) field("problem.question");
    for (const [flag, collection, type] of [
      ["cards", "cards", "card"],
      ["causes", "factors", "factor"],
      ["causes", "causes", "cause"],
      ["branches", "nodes", "branch"],
      ["criteria", "criteria", "criterion"],
      ["checks", "checks", "check"],
    ])
      if (s.examples.includes(flag))
        for (const row of s[collection])
          if (p[collection].some((x) => x.id === row.id))
            s.presetWrites.push({
              id: `${type}:${row.id}`,
              fields: [],
              rows: [{ collection, id: row.id }],
            });
    if (s.examples.includes("tests"))
      for (const c of s.causes) field(`causes.${c.id}.test`);
    if (s.examples.includes("scores"))
      for (const n of s.nodes)
        for (const c of s.criteria) field(`nodes.${n.id}.ratings.${c.id}`);
    if (s.examples.includes("plan"))
      for (const key of Object.keys(s.plan)) field(`plan.${key}`);
    if (s.examples.includes("groups"))
      for (const key of ["recognize", "access"]) {
        const id = `g-${key}`;
        if (s.groups.some((g) => g.id === id))
          s.presetWrites.push({
            id: `group:${key}`,
            fields: s.cards
              .filter((c) => c.group === id)
              .map((c) => ({
                path: `cards.${c.id}.group`,
                before: "",
                after: id,
              })),
            rows: [{ collection: "groups", id }],
          });
      }
    if (
      s.examples.includes("relations") &&
      s.relations.some((r) => r.id === "r-awareness")
    )
      s.presetWrites.push({
        id: "relation:awareness",
        fields: [],
        rows: [{ collection: "relations", id: "r-awareness" }],
      });
    if (s.examples.includes("synthesis") && s.synthesis)
      s.presetWrites.push({
        id: "field:synthesis",
        fields: [{ path: "synthesis", before: "", after: s.synthesis }],
        rows: [],
      });
    if (s.examples.includes("results") && s.simulation) {
      for (let index = 0; index < 4; index++) {
        const row = s.records.find(
          (r) =>
            r.label === `第${index + 1}週に集まった物（各4週間追跡）` &&
            r.note === "教材の架空データ",
        );
        if (
          !row ||
          s.records.some((r) => r !== row && r.id === `record-${index}`)
        )
          continue;
        row.id = `record-${index}`;
        s.presetWrites.push({
          id: `record:${index}`,
          fields: [],
          rows: [{ collection: "records", id: row.id }],
        });
      }
      if (s.observation)
        s.presetWrites.push({
          id: "field:observation",
          fields: [{ path: "observation", before: "", after: s.observation }],
          rows: [],
        });
    }
    if (s.examples.includes("kpt"))
      for (const key of ["keep", "problem", "try"])
        if (s.kpt.some((k) => k.id === `kp-${key}`))
          s.presetWrites.push({
            id: `kpt:${key}`,
            fields: [],
            rows: [{ collection: "kpt", id: `kp-${key}` }],
          });
    if (s.examples.includes("next") && s.next)
      s.presetWrites.push({
        id: "field:next",
        fields: [{ path: "next", before: "", after: s.next }],
        rows: [],
      });
  }
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
  if (s.brainstorm.length) {
    lines.push("\n### ブレーンストーミングの発言（未検証）");
    for (const n of s.brainstorm) {
      add(kinds[n.kind], n.text);
      if (n.parent)
        add("発展元の発言", s.brainstorm.find((p) => p.id === n.parent)?.text);
      if (n.card)
        add("KJ法へ渡したカード", s.cards.find((c) => c.id === n.card)?.text);
    }
  }
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
