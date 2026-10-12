import {
  uid,
  kinds,
  steps,
  emptyWorkbook,
  presetWorkbook,
  presetExample,
  presetValue,
  presetActive,
  brainstormToCards,
  stageSummary,
  togglePreset,
  removeItem,
  cleanReferences,
  changeNotes,
  markEdited,
  descendants,
  causeForNode,
  ranking,
  comparison,
  canSimulate,
  simulationChanged,
  parseWorkbook,
  report,
  strategies,
} from "./model.mjs?v=7";

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const short = (v, n = 54) => (v.length > n ? `${v.slice(0, n)}…` : v);
const fmt = (v) =>
  v === null || v === undefined
    ? "未記録"
    : new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(v);
const key = (mode) => `study-atlas.thinking-tools.v1.${mode}`;
const cache = new Map();
const pickedCards = new Set();
const diagramZoom = { fish: 0, map: 0 };
let mutationBefore, lastPresetChange;
let state,
  selectedNode = "",
  selectedCause = "",
  selectedFactor = "",
  saveTimer;
let storageOK = true,
  startNotice = "";
const unreadableModes = new Set();
function load(mode) {
  if (cache.has(mode)) return cache.get(mode);
  let s;
  try {
    const raw = localStorage.getItem(key(mode));
    if (raw) {
      s = parseWorkbook(raw);
      if (JSON.parse(raw).version === 1)
        startNotice =
          "以前の保存内容を引き継いでいます。空欄から新版の体験を始めるには、必要に応じて保存ファイルを残し、「最初から」を押してください。";
      if (s.mode !== mode) throw Error();
    }
  } catch {
    unreadableModes.add(mode);
    storageOK = false;
    startNotice =
      "保存内容を読み込めませんでした。保存ファイルがあれば開いてください。現在の作業はJSONで保存できます。";
  }
  s ??= mode === "free" ? emptyWorkbook() : presetWorkbook();
  cache.set(mode, s);
  return s;
}
let mode = "preset";
try {
  mode =
    localStorage.getItem("study-atlas.thinking-tools.mode") === "free"
      ? "free"
      : "preset";
} catch {
  storageOK = false;
}
state = load(mode);
function status(text) {
  $("#save-status").textContent = text;
}
function save() {
  clearTimeout(saveTimer);
  try {
    if (unreadableModes.has(state.mode))
      throw Error("Unreadable draft is preserved");
    localStorage.setItem(key(state.mode), JSON.stringify(state));
    localStorage.setItem("study-atlas.thinking-tools.mode", state.mode);
    storageOK = true;
    status("このブラウザに保存済み · プリセットと自由作成は別々に保存されます");
  } catch {
    storageOK = false;
    status("自動保存できません · 「保存ファイル」でJSONを手元に残してください");
  }
}
function scheduleSave() {
  status("変更を保存中…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}
window.addEventListener("pagehide", save);
function notify(text) {
  const el = $("#notice");
  el.textContent = text;
  el.hidden = !text;
}
function changed(step = state.step) {
  cleanReferences(state);
  markEdited(
    state,
    step,
    mutationBefore ? changeNotes(mutationBefore, state, step) : [],
  );
  mutationBefore = structuredClone(state);
  scheduleSave();
  renderNav();
}
function resolve(path) {
  const parts = path.split(".");
  let obj = state;
  for (const p of parts.slice(0, -1))
    obj = Array.isArray(obj) ? obj.find((x) => x.id === p) : obj[p];
  return [obj, parts.at(-1)];
}
function value(path) {
  const [o, k] = resolve(path);
  return o[k];
}
function presetControl(id, label, enabled = true, extra = "") {
  if (state.mode !== "preset") return "";
  const active = presetActive(state, id);
  return `<div class="preset-control" data-preset-control="${esc(id)}">${btn("preset", active ? "空欄に戻す" : "プリセット記入", id, "preset-button", `aria-pressed="${active}" aria-label="${esc(label)}：${active ? "空欄に戻す" : "プリセット記入"}" ${!enabled && !active ? "disabled" : ""} ${extra}`)}</div>`;
}
function fieldPreset(path, label) {
  if (!["problem.question", "synthesis", "observation", "next"].includes(path))
    return "";
  const example = presetValue(state, path);
  return presetControl(
    `field:${path}`,
    label,
    example !== undefined &&
      example !== "" &&
      (path !== "synthesis" || state.cards.length > 0) &&
      (path !== "observation" ||
        (canSimulate(state) && state.resultFor === state.selectedIdea)),
  );
}
function itemHeading(title, id, label = title, enabled = true) {
  return `<div class="item-heading"><h3>${esc(title)}</h3>${presetControl(id, label, enabled)}</div>`;
}
function fieldHeading(label, path, extra = "") {
  return `<div class="field-heading"><label for="input-${esc(path)}" ${extra}>${esc(label)}</label>${fieldPreset(path, label)}</div>`;
}
function input(label, path, placeholder = "", type = "text", extra = "") {
  return `<div class="field-frame" data-preset-target="${esc(path)}">${fieldHeading(label, path)}<input id="input-${esc(path)}" type="${type}" data-bind="${esc(path)}" value="${esc(value(path))}" placeholder="${esc(placeholder)}" ${type === "text" ? 'maxlength="10000"' : ""} ${extra}></div>`;
}
function area(label, path, placeholder = "", extra = "") {
  return `<div class="field-frame" data-preset-target="${esc(path)}">${fieldHeading(label, path, extra)}<textarea id="input-${esc(path)}" rows="2" data-bind="${esc(path)}" placeholder="${esc(placeholder)}" maxlength="10000">${esc(value(path))}</textarea></div>`;
}
function select(label, path, options, extra = "") {
  return `<div class="field-frame" data-preset-target="${esc(path)}">${fieldHeading(label, path)}<select id="input-${esc(path)}" data-bind="${esc(path)}" ${extra}>${options.map(([v, t]) => `<option value="${esc(v)}" ${value(path) === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
}
function btn(action, label, id = "", classes = "", extra = "") {
  return `<button type="button" data-action="${action}" ${id ? `data-id="${esc(id)}"` : ""} class="${classes}" ${extra}>${label}</button>`;
}
function del(action, id, label) {
  return btn(action, "×", id, "icon-button", `aria-label="${esc(label)}"`);
}
function handoff(label, text) {
  return `<div class="handoff"><span>${esc(label)}</span>${esc(text || "まだ入力されていません。前の段階で考えるか、この段階から始められます。")}</div>`;
}
function tip(text) {
  return `<p class="tip">${esc(text)}</p>`;
}
function empty(text) {
  return `<p class="empty-note">${esc(text)}</p>`;
}
const causeOptions = () => [
  ["", "原因はまだ結び付けない"],
  ...state.causes.map((c) => [c.id, c.text || "（名前のない原因）"]),
];
const evidenceOptions = () => [
  ["", "根拠は未接続"],
  ...state.cards.map((c) => [c.id, `${kinds[c.kind]}：${short(c.text)}`]),
];
function reviewNotice() {
  if (!state.review[state.step]) return "";
  const notes = state.reviewNotes[state.step];
  const help = [
    "",
    "調査する対象・内容に反映されているか、カードを確認します。",
    "変更したカードを根拠にした原因と、確かめ方を確認します。",
    "原因との接続が残っているか、枝の「対応する原因」を確認します。",
    "比較する案・評価軸・試す案・計画が、変更内容と合っているか確認します。",
    "今回試す案・指標・実施前の値と、記録した結果の条件を確認します。",
    "選んだ案・結果・観察メモを読み、KPTの根拠と次の行動を確認します。",
  ][state.step];
  const row = (n) =>
    `<li><b>${esc(steps[n.source][0])} · ${esc(n.label)}</b><span>${esc(n.before)} → ${esc(n.after)}</span>${btn("step", "変更元を確認", String(n.source), "quiet-button")}</li>`;
  return `<section class="review-notice" aria-label="前の段階の変更内容"><strong>この段階で見直す変更</strong>${notes.length ? `<ul>${notes.slice(-3).map(row).join("")}</ul>${notes.length > 3 ? `<details><summary>ほか${notes.length - 3}件の変更</summary><ul>${notes.slice(0, -3).map(row).join("")}</ul></details>` : ""}` : "<p>以前の保存内容で見直しが付いています。この保存には変更前後の履歴がありません。</p>"}<p>${esc(help)}</p>${btn("reviewed", "この変更を確認した")}</section>`;
}
function highlightPreset() {
  if (!lastPresetChange) return;
  const mark = (selector) =>
    document.querySelectorAll(selector).forEach((el) => {
      const item = el.closest(
        "[data-preset-item], [data-preset-collection][data-preset-row]",
      );
      (item || el).classList.add("preset-changed");
    });
  const shapeActions = {
    cards: "kj-card",
    groups: "kj-group",
    relations: "kj-relation",
    factors: "factor",
    causes: "cause",
    nodes: "node",
  };
  for (const path of lastPresetChange.paths) {
    mark(`[data-preset-target="${CSS.escape(path)}"]`);
    const [collection, id, field] = path.split(".");
    if (shapeActions[collection])
      mark(
        `[data-action="${shapeActions[collection]}"][data-id="${CSS.escape(id)}"]`,
      );
    if (collection === "cards") mark(`[data-card="${CSS.escape(id)}"]`);
    if (collection === "groups" && field === "parent")
      mark(`[data-action="kj-parent"][data-id="${CSS.escape(id)}"]`);
  }
  for (const row of lastPresetChange.rows)
    mark(
      `[data-preset-collection="${row.collection}"][data-preset-row="${CSS.escape(row.id)}"]`,
    );
  if (lastPresetChange.id === "block:gap" && !lastPresetChange.cleared)
    for (const path of ["measure.kind", "measure.direction"])
      if (value(path) === presetValue(state, path))
        mark(`[data-preset-target="${path}"]`);
  if (lastPresetChange.paths.includes("selectedIdea"))
    mark('[data-preset-item="matrix"]');
  if (lastPresetChange.paths.includes("kjDiagramReady"))
    mark('[data-preset-item="kj-diagram"]');
  document
    .querySelectorAll(".preset-changed .preset-changed")
    .forEach((el) => el.classList.remove("preset-changed"));
}
function clearPresetHighlight() {
  lastPresetChange = null;
  document
    .querySelectorAll(".preset-changed")
    .forEach((el) => el.classList.remove("preset-changed"));
}
function viewportAnchor(el) {
  const control = el.closest("[data-preset-control]");
  return {
    id: control?.dataset.presetControl,
    top: control?.getBoundingClientRect().top,
    x: scrollX,
    y: scrollY,
  };
}
function restoreViewport(anchor) {
  const control = anchor.id
    ? $(`[data-preset-control="${CSS.escape(anchor.id)}"]`)
    : null;
  const delta =
    control && anchor.top !== undefined
      ? control.getBoundingClientRect().top - anchor.top
      : 0;
  window.scrollTo({
    left: anchor.x,
    // Replacing a long stage can already change scrollY while layout settles.
    // The new control's rectangle is relative to that current scroll position.
    top: Math.max(0, control ? window.scrollY + delta : anchor.y),
    behavior: "instant",
  });
}
const toolGuides = [
  [
    [
      "5W1H",
      "誰が・何に・いつ・どこで・なぜ困る・現在のやり方を、それぞれ書きます。",
      "問題が起きている状況と、まだ分からないこと。",
    ],
    [
      "ギャップ分析",
      "現状と理想を、同じ指標・数え方で並べます。",
      "目指す改善と、現状からの差。",
    ],
  ],
  [
    [
      "ブレーンストーミング",
      "批判を控え、自由な発言を多く出し、ほかの発言を結び付けて発展させます。",
      "問題を見る視点・可能性・思い付き。まだ正解や対策を決めません。",
    ],
    [
      "KJ法",
      "1枚1情報で記録し、内容を読み合わせて寄せ、表札・関係図・全体の説明を作ります。",
      "集めた情報のまとまり・つながり・食い違い。分類名を先に決めません。",
    ],
  ],
  [
    [
      "特性要因図",
      "大骨に原因を考える切り口、小骨に原因の候補を書き、根拠と確かめ方を結びます。",
      "一つの問題に関わる原因の候補。図に書いても、原因が証明されたわけではありません。",
    ],
  ],
  [
    [
      "マインドマップ",
      "中心から関連する言葉を枝に広げ、子の枝で具体化します。比較したい案を候補にします。",
      "対策の選択肢と、それぞれが対応する原因。",
    ],
  ],
  [
    [
      "意思決定マトリクス",
      "共通の評価軸・重み・点数で案を比べ、試す案を選びます。",
      "案ごとの強み・弱みと、重視する条件による違い。",
    ],
  ],
  [
    [
      "チェックシート",
      "作業を並べ、行った作業の「実施済み」にチェックし、メモを残します。",
      "実施したこと・まだ行っていないこと・実行中の気付き。効果は別に検証します。",
    ],
    [
      "比較グラフ",
      "実施前と実施後の記録を、同じ指標・条件で比べます。グラフは記録から自動計算されます。",
      "変化と目標との差。数値以外の変化や、比較の限界も併記します。",
    ],
  ],
  [
    [
      "KPT法",
      "Keep・Problem・Tryに、続けること・残った課題・次に試すことを分けて書きます。",
      "結果を踏まえた振り返りと、次の改善で取る行動。",
    ],
  ],
];
function toolGuide() {
  return `<section class="tool-guide" aria-label="この段階で使う思考ツール"><p class="tool-guide-label">この段階で使うツール</p><div class="tool-guide-grid">${toolGuides[state.step].map(([name, use, result]) => `<article><h3>${name}</h3><dl><dt>使い方</dt><dd>${use}</dd><dt>整理できるもの</dt><dd>${result}</dd></dl></article>`).join("")}</div></section>`;
}
function summaryRows(rows) {
  return `<dl class="summary-rows">${rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join("")}</dl>`;
}
function stageTransfer() {
  if (!state.step) return "";
  const previous = state.step - 1,
    data = stageSummary(state, previous);
  return `<section class="stage-transfer" aria-label="前の段階からの引き継ぎ"><div class="transfer-heading"><h3>前の段階「${esc(steps[previous][0])}」から</h3></div><p class="transfer-status">${state.done[previous] ? "前の段階はまとめ済みです。" : "前の段階はまだまとめていません。記入済みの内容から続けられます。"}</p><div class="transfer-grid"><div><h4>前の段階で${state.done[previous] ? "まとまった" : "記入した"}内容</h4>${summaryRows(data.completed)}</div><div><h4>この段階へ引き継いだ内容</h4>${summaryRows(data.passed)}</div></div>${data.pending.length ? `<p class="transfer-pending">${data.pending.map(esc).join(" ")}</p>` : ""}</section>`;
}
function stageOutcome() {
  const data = stageSummary(state);
  return `<section class="stage-outcome" aria-label="この段階のまとめと次へ渡す内容"><h3>この段階のまとめ</h3><div class="transfer-grid"><div><h4>ここで整理したもの</h4>${summaryRows(data.completed)}</div><div><h4>${state.step === 6 ? "次の改善へ持っていく内容" : "次の段階へ渡す内容"}</h4>${summaryRows(data.passed)}</div></div>${data.pending.length ? `<p class="transfer-pending">${data.pending.map(esc).join(" ")} 未記入のまま進んでも、後から戻って編集できます。</p>` : ""}</section>`;
}
function header() {
  const step = steps[state.step];
  return `<header class="stage-header"><p class="eyebrow">STEP ${String(state.step + 1).padStart(2, "0")} / ${esc(step[1])}</p><h2 id="stage-title" tabindex="-1">${esc(step[0])}</h2><p>${esc(step[2])}</p><details data-detail="usage"><summary>現実では、どんなときに使える？</summary><p>${esc(step[3])}</p></details></header>${toolGuide()}${reviewNotice()}${stageTransfer()}`;
}
function renderNav() {
  $("#step-nav").innerHTML = steps
    .map(
      (s, i) =>
        `<button type="button" data-action="step" data-id="${i}" ${state.step === i ? 'aria-current="step"' : ""}><span class="step-number" aria-hidden="true">${i + 1}</span><span><b>${esc(s[0])}</b><small>${esc(s[1])}</small>${state.review[i] ? '<span class="step-status needs-review">見直し</span>' : state.done[i] ? '<span class="step-status">まとめ済み</span>' : ""}</span></button>`,
    )
    .join("");
}
function context() {
  for (const m of ["preset", "free"])
    $(`#mode-${m}`).setAttribute("aria-pressed", String(state.mode === m));
  $("#mode-context").innerHTML =
    state.mode === "preset"
      ? '<span class="fiction-label">架空の題材・データ</span><strong>学校の落とし物が、持ち主に戻らない。</strong><p>空欄からスタート。各項目のそばの「プリセット記入」で、5W1H・調査カード・採点などを順に試します。もう一度押すと、その項目を空欄に戻せます。入った内容は自由に編集できます。気になる段階からでもOK。</p>'
      : "<strong>自分の題材で、ゼロから。</strong><p>例のデータは入りません。必要な情報・枝・評価軸を自分で追加して、考えを育てていきましょう。</p>";
}
function render(focus = false) {
  const old = $("#stage").querySelector(":focus");
  const bound = old?.dataset.bind;
  const restoreAttr = [
    "data-focus-cause",
    "data-selected-idea",
    "data-id",
  ].find((attr) => old?.hasAttribute(attr));
  const restoreAction = old?.dataset.action;
  const sel =
    old && "selectionStart" in old
      ? [old.selectionStart, old.selectionEnd]
      : null;
  const openDetails = [
    ...$("#stage").querySelectorAll("details[open][data-detail]"),
  ].map((el) => el.dataset.detail);
  const mapScroll = $(".mindmap-scroll");
  const fishScroll = $(".fishbone-scroll");
  const fishPosition = fishScroll
    ? [fishScroll.scrollLeft, fishScroll.scrollTop]
    : null;
  const scroll = mapScroll ? [mapScroll.scrollLeft, mapScroll.scrollTop] : null;
  context();
  renderNav();
  $("#stage").innerHTML =
    header() +
    [clarify, organize, analyze, ideate, decide, verify, reflect][
      state.step
    ]() +
    stageOutcome();
  $("#stage-actions").innerHTML =
    `${btn("back", "← 前の段階", "", "", state.step === 0 ? "disabled" : "")}${btn("next", state.step === 6 ? "振り返りをまとめて全体を見る" : "この段階をまとめて次へ →", "", "primary-button")}`;
  fitDiagrams();
  highlightPreset();
  for (const id of openDetails) {
    const detail = $(`[data-detail="${CSS.escape(id)}"]`);
    if (detail) detail.open = true;
  }
  if (focus) $("#stage-title").focus({ preventScroll: true });
  else if (bound) {
    const el = $(`[data-bind="${CSS.escape(bound)}"]`);
    el?.focus({ preventScroll: true });
    if (sel && el?.setSelectionRange && ["text", "textarea"].includes(el.type))
      el.setSelectionRange(...sel);
  } else if (restoreAttr) {
    const selector = `[${restoreAttr}="${CSS.escape(old.getAttribute(restoreAttr))}"]${restoreAction ? `[data-action="${restoreAction}"]` : ""}`;
    $(selector)?.focus({ preventScroll: true });
  }
  if (fishPosition && $(".fishbone-scroll")) {
    $(".fishbone-scroll").scrollLeft = fishPosition[0];
    $(".fishbone-scroll").scrollTop = fishPosition[1];
  }
  if (scroll && $(".mindmap-scroll")) {
    $(".mindmap-scroll").scrollLeft = scroll[0];
    $(".mindmap-scroll").scrollTop = scroll[1];
  }
}
function clarify() {
  const m = state.measure;
  const c = comparison(state);
  const gap =
    c.before !== null && m.target !== null
      ? Math.abs(m.target - c.before)
      : null;
  return `${tip(state.mode === "preset" ? "最初に困っている状況を整理します。原因や対策を決める前に、誰に何が起きているかを確かめましょう。" : "最初は困っていることを一文に。埋まらない項目は、後で調べる問いにできます。")}
  ${lesson("context", "① 誰に、何が起きているかを整理する", "学校の保管箱には落とし物がたまっています。担当委員として、困っている人・場所・今のやり方を書きます。", "「落とし物が多い」から、「誰の何が戻らず、どんな影響があるか」という具体的な問題になります。")}
  ${itemHeading("問題・課題と5W1H", "block:context")}
  ${input("問題・課題", "problem.title", "何に困っていますか？")}
  <h3>5W1Hで、問題の輪郭をつくる</h3><div class="form-grid">${Object.entries({
    who: ["Who · 誰が", "困っている人・関係する人"],
    what: ["What · 何に", "具体的に起きていること"],
    when: ["When · いつ", "起こる時間・期間"],
    where: ["Where · どこで", "場所・範囲"],
    why: ["Why · なぜ困る", "影響・解決する意味"],
    how: ["How · 現在のやり方", "今はどのように対応している？"],
  })
    .map(([k, [label, place]]) => area(label, `problem.${k}`, place))
    .join("")}</div>
  ${lesson("gap", "② 今の状態と、目指す状態を比べる", "4週間で集まった40件のうち12件が戻りました。委員会は返却率60%以上を目指します。現状と目標を同じ数え方で書きます。", "今は30%、目標は60%。差は30ポイント。対策の名前ではなく、何をどれだけ改善したいかが見えます。")}${itemHeading("ギャップ分析 · 現状と理想を並べる", "block:gap")}<div class="gap-layout">${area("現状", "problem.current", "観察できたこと・今の数値")}<span class="gap-arrow" aria-hidden="true">→</span>${area("理想", "problem.ideal", "いつまでに、どうなっていたい？")}</div>
  <h3>確かめる指標を決める</h3><div class="form-grid">${input("指標の名前", "measure.label", "例：返却率、探す時間、利用人数")}${select(
    "数え方",
    "measure.kind",
    [
      ["rate", "割合（成功件数 ÷ 対象件数）"],
      ["value", "数値（記録した値の平均）"],
    ],
  )}
  ${m.kind === "rate" ? input("実施前 · 成功件数", "measure.beforeCount", "", "number", 'min="0" max="1000000000" step="any"') + input("実施前 · 対象件数", "measure.beforeTotal", "", "number", 'min="0" max="1000000000" step="any"') : input("単位", "measure.unit", "分、件、点など") + input("実施前の値", "measure.beforeValue", "", "number", 'min="-1000000000" max="1000000000" step="any"')}
  ${input(`目標値${m.kind === "rate" ? "（%）" : ""}`, "measure.target", "", "number", `min="${m.kind === "rate" ? 0 : -1000000000}" max="${m.kind === "rate" ? 100 : 1000000000}" step="any"`)}${select(
    "良くなる方向",
    "measure.direction",
    [
      ["higher", "大きいほど良い"],
      ["lower", "小さいほど良い"],
    ],
  )}</div>
  ${m.kind === "rate" && m.beforeCount !== null && m.beforeTotal !== null && (m.beforeCount > m.beforeTotal || m.beforeTotal === 0) ? '<p class="notice">対象件数は0より大きく、成功件数以上にしてください。</p>' : ""}
  <div class="gap-result"><span>実施前 <strong>${fmt(c.before)}${m.kind === "rate" && c.before !== null ? "%" : ""}</strong></span> → 目標 <strong>${fmt(m.target)}${m.kind === "rate" && m.target !== null ? "%" : ""}</strong>${gap !== null ? `<p>差は ${fmt(gap)} ${m.kind === "rate" ? "ポイント" : esc(m.unit)}。この差を埋めるには、何を確かめたい？</p>` : ""}</div>
  ${area("測定の条件・比較するときの注意", "measure.conditions", "同じ期間・同じ対象で数える？どんな違いが影響しそう？")}
  ${lesson("question", "③ 分からないことを、調査する内容にする", "返却が少ない理由はまだ分かりません。「案内を増やす」と先に決めず、気付く・確認する・受け取る行動のどこが難しいかを書きます。", "次の段階で集めるのは、対策を正当化する情報ではなく、実際の困り方を知る情報です。")}<h3>調査で何を確かめる？</h3>${area("調査で確かめること", "problem.question", "例：箱の場所を知っているか、自分の物と気付くか、受け取れるかを調べる")}
  ${tip("「なぜ困るか」と「原因」は別の問いです。5W1Hを埋めただけで原因が分かったとは言えません。")}`;
}
function lesson(id, title, watch, discover, enabled = true) {
  const freeInstructions = {
    context:
      "困っている状況を、誰が・何に・いつ・どこで・なぜ困る・今のやり方に分けて書きます。原因は後から考えます。",
    gap: "現在の状態と目指す状態を並べ、同じ指標と数え方で比べます。まだ分からない値は空欄で残せます。",
    question: "まだ分からないこと、調査して確かめたいことを具体的に書きます。",
    brainstorm:
      "自由な発言を1件ずつ書き、ほかの発言を発展させます。批判を控え、自由奔放に、量を重視し、結合・改善します。",
    cards:
      "観察したこと・聞いた声を、1枚に1つ具体的に記録します。種類と出典も残します。",
    groups:
      "内容を読み合わせ、近いと感じるカードを2〜3枚から寄せ、表札を考えます。単独の情報も残します。",
    relations:
      "表札と単独の情報を見渡し、つながり・食い違いを図にします。必要なら上位のまとまりを作ります。",
    synthesis:
      "図を読み、全体を説明します。分かったことと、まだ確かめていないことを分けましょう。",
    causes:
      "大骨は原因を考える切り口、小骨は原因の候補。調査のカードを根拠として結び付けます。",
    tests: "原因の説明と、観察・比較などの確かめ方をセットで考えます。",
    branches:
      "中心の問題から関連する言葉を左右に広げ、子の枝で具体化します。比較したい具体策を候補にします。",
    criteria:
      "効果・費用・負担・公平さなど、比べる基準を追加し、重みを決めます。",
    scores:
      "基準ごとに1〜5で採点します。根拠がない点数は空欄のままで構いません。",
    plan: "比較表から試す案を選び、担当・期間・確かめ方・注意点を決めます。",
    checks:
      "作業を追加し、実際に行ったら「実施済み」にチェックしてメモを残します。これは作業の実施記録で、効果の証明ではありません。",
    results:
      "同じ期間・対象・数え方で、実際に試した結果を記録します。未入力は0として扱いません。",
    kpt: "記録を根拠に、続けたい工夫・残った課題・次に試すことをカードにします。",
    next: "Tryから具体的な行動を選び、誰が何をいつまでに行うかを書きます。",
  };
  if (state.mode === "free") watch = freeInstructions[id] || watch;
  return `<div class="lesson"><div><strong>${esc(title)}</strong><p>${esc(watch)}</p></div></div>`;
}
function groupDescendants(id) {
  const ids = new Set([id]);
  let again = true;
  while (again) {
    again = false;
    for (const g of state.groups)
      if (ids.has(g.parent) && !ids.has(g.id)) {
        ids.add(g.id);
        again = true;
      }
  }
  return ids;
}
function isBrainstormCard(c) {
  return (
    state.brainstorm.some((n) => n.card === c.id) ||
    c.source.startsWith("ブレーンストーミング")
  );
}
function card(c) {
  const origin = isBrainstormCard(c);
  return `<article class="note-card" data-preset-collection="cards" data-preset-row="${c.id}" data-card="${c.id}" data-kind="${c.kind}" draggable="true"><div class="card-top"><label class="card-pick"><input type="checkbox" data-select-card="${c.id}" ${pickedCards.has(c.id) ? "checked" : ""}><span class="visually-hidden">${esc(c.text || "情報カード")}をまとめるために選択</span><span class="drag-handle" draggable="true" aria-hidden="true">⠿</span></label>${del("delete-card", c.id, "この情報カードを削除")}</div>
  <span class="card-origin">${origin ? "ブレーンストーミングの発言から" : "調査・観察の記録"}</span>
  <div class="field-frame card-content" data-preset-target="cards.${c.id}.text"><label class="visually-hidden" for="input-cards.${c.id}.text">情報カードの内容</label><textarea id="input-cards.${c.id}.text" rows="2" data-bind="cards.${c.id}.text" placeholder="情報や発言を、具体的に記入" maxlength="10000">${esc(c.text)}</textarea></div>
  ${select("情報の種類", `cards.${c.id}.kind`, Object.entries(kinds))}
  ${input("出典・観察条件", `cards.${c.id}.source`, "誰の声？いつ・何件を観察？")}
  ${select("まとまり", `cards.${c.id}.group`, [["", "単独で置く"], ...state.groups.map((g) => [g.id, g.title || "（表札なし）"])])}</article>`;
}
function blankPresetCard(c, i) {
  return `<article class="note-card blank-preset-card" data-preset-collection="cards" data-preset-row="${c.id}"><b>調査記録 ${i + 1} / 9</b><small>${esc(c.source)}</small><p>情報カードは「プリセット記入」で読み込めます。</p></article>`;
}
function groupCards(id) {
  const cards = state.cards.filter((c) => c.group === id);
  if (id || state.mode !== "preset")
    return (
      cards.map(card).join("") ||
      empty("内容が近いと感じるカードをここへ。空のまとまりは × で解けます。")
    );
  const sample = presetExample().cards;
  return (
    sample
      .map((c, i) => {
        const found = state.cards.find((x) => x.id === c.id);
        return found ? (found.group ? "" : card(found)) : blankPresetCard(c, i);
      })
      .join("") +
    cards
      .filter((c) => !sample.some((x) => x.id === c.id))
      .map(card)
      .join("")
  );
}
function missingGroups() {
  if (state.mode !== "preset") return "";
  return ["g-recognize", "g-access"]
    .filter((id) => !state.groups.some((g) => g.id === id))
    .map(
      (id, index) =>
        `<section class="card-group blank-preset-card" data-preset-collection="groups" data-preset-row="${id}"><h3>まとまりの例 ${index + 1}</h3><p>カードを寄せ、中の情報が語ることを表札に書きます。</p></section>`,
    )
    .join("");
}
function groupPanel(g, depth = 0) {
  const blocked = groupDescendants(g.id);
  return `<section class="card-group ${g.id ? "" : "ungathered"}" data-preset-collection="groups" data-preset-row="${g.id}" data-drop-group="${g.id}" aria-label="${esc(g.title || "単独のカード")}"><div class="group-heading">${g.id ? input("表札 · 中の情報が語ることを一文で", `groups.${g.id}.title`, "例：案内を知っていても、受け取りには壁がある") : "<h3>単独のカード<small>まとまらない情報も、大切に残す</small></h3>"}${g.id ? del("delete-group", g.id, "まとまりを解く（カードは単独へ）") : ""}</div>
  ${g.id ? `<div class="group-controls">${btn("move-group", "←", `${g.id}:left`, "icon-button", 'aria-label="まとまりを左へ並べる"')}${btn("move-group", "→", `${g.id}:right`, "icon-button", 'aria-label="まとまりを右へ並べる"')}${select("上位のまとまり", `groups.${g.id}.parent`, [["", "上位のまとまりを作らない"], ...state.groups.filter((x) => !blocked.has(x.id)).map((x) => [x.id, x.title || "（表札がないまとまり）"])])}</div>` : ""}
  <div class="card-stack">${groupCards(g.id)}</div>
  ${state.groups
    .filter((x) => x.parent === g.id && g.id)
    .map((x) => groupPanel(x, depth + 1))
    .join("")}
  <div class="inline-actions local-add">${btn("add-card", "＋ カード", g.id)}${g.id ? btn("add-group", "＋ 内側のまとまり", g.id) : ""}</div></section>`;
}
function relationOptions() {
  return [
    ...state.groups.map((g) => [g.id, `まとまり：${g.title || "表札なし"}`]),
    ...state.cards.map((c) => [
      c.id,
      `カード：${short(c.text || "未入力", 32)}`,
    ]),
  ];
}
function kjDiagram() {
  const endpoints = [
    ...state.groups,
    ...state.cards.filter(
      (c) =>
        !c.group ||
        state.relations.some((r) => r.from === c.id || r.to === c.id),
    ),
  ];
  if (!endpoints.length || (state.mode === "preset" && !state.kjDiagramReady))
    return `<div class="kj-diagram-placeholder" data-preset-item="kj-diagram"><p>${state.mode === "preset" ? "上で整理したカードと表札を、ここの「プリセット記入」で図に並べます。" : "カードとまとまりを作ると、ここに関係図が現れます。"}</p></div>`;
  const cols = 2,
    width = 670,
    height = Math.max(150, Math.ceil(endpoints.length / cols) * 155);
  const positions = new Map(
    endpoints.map((e, i) => [
      e.id,
      { x: 25 + (i % cols) * 325, y: 25 + Math.floor(i / cols) * 155 },
    ]),
  );
  const lines = state.relations
    .map((r) => {
      const a = positions.get(r.from),
        b = positions.get(r.to);
      if (!a || !b) return "";
      // Route same-row links below the cards so the arrow and its label remain visible.
      const sameRow = a.y === b.y;
      const path = sameRow
        ? `M${a.x + 140} ${a.y + 92} V${a.y + 120} H${b.x + 140} V${b.y + 92}`
        : `M${a.x + 280} ${a.y + 45} C${a.x + 305} ${a.y + 45},${b.x + 305} ${b.y + 45},${b.x + 280} ${b.y + 45}`;
      return `<g tabindex="0" role="button" data-action="kj-relation" data-id="${r.id}" aria-label="${esc(r.text || "関係線")}。Deleteで削除"><path class="relation-hit" d="${path}"/><path d="${path}" marker-end="url(#kj-arrow)"/><text x="${(a.x + b.x) / 2 + 140}" y="${sameRow ? a.y + 142 : (a.y + b.y) / 2 + 36}" text-anchor="middle">${esc(short(r.text || "関係を説明する", 24))}</text></g>`;
    })
    .join("");
  const parents = state.groups
    .filter((g) => g.parent)
    .map((g) => {
      const a = positions.get(g.id),
        b = positions.get(g.parent);
      return `<g tabindex="0" role="button" data-action="kj-parent" data-id="${g.id}" aria-label="上位のまとまりとの関係。Deleteで解除"><path class="relation-hit" d="M${a.x + 140} ${a.y + 36} L${b.x + 140} ${b.y + 36}"/><path class="hierarchy-line" d="M${a.x + 140} ${a.y + 36} L${b.x + 140} ${b.y + 36}"/></g>`;
    })
    .join("");
  return `<div class="kj-diagram-scroll" data-preset-item="kj-diagram" tabindex="0" role="region" aria-label="情報の関係図。まとまりの左右ボタンで並びを変えられます。"><div class="kj-diagram" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" role="group" aria-label="まとまりとカードをつなぐ線"><defs><marker id="kj-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#9f492f"/></marker></defs>${parents}${lines}</svg>${endpoints
    .map((e) => {
      const p = positions.get(e.id);
      return `<button type="button" data-action="${e.title !== undefined ? "kj-group" : "kj-card"}" data-id="${e.id}" class="kj-island ${e.title !== undefined ? "" : "single"}" style="left:${p.x}px;top:${p.y}px"><small>${e.title !== undefined ? "表札" : `単独のカード · ${kinds[e.kind]}`}</small><span>${esc(e.title ?? e.text)}</span></button>`;
    })
    .join("")}</div></div>`;
}
function kjReading() {
  const text = (id) =>
    state.groups.find((g) => g.id === id)?.title ||
    state.cards.find((c) => c.id === id)?.text ||
    "名前未入力";
  return `<div class="kj-reading"><strong>図から説明できること</strong>${state.relations.length ? `<ul>${state.relations.map((r) => `<li>${esc(text(r.from))} → ${esc(text(r.to))}<br><b>${esc(r.text || "どんな関係か、下の編集欄に記入してください。")}</b></li>`).join("")}</ul>` : "<p>まだ関係線はありません。「線でつなぐ・関係を説明する」のプリセットか、下の「＋ 関係線」で、始点・終点とその関係を記入します。</p>"}</div>`;
}
function brainstorming() {
  const remaining = state.brainstorm.filter(
    (n) => n.text.trim() && !n.card,
  ).length;
  return `<section class="brainstorming-workspace" aria-label="ブレーンストーミングの発言ボード">
  ${lesson("brainstorm", "① ブレーンストーミングで、考える材料を広げる", "問題に関する気付き・調べる視点・思い付いた案を、1件ずつ出します。一人でも練習できます。グループなら順に発言して記録し、この時点で良し悪しを決めません。")}
  <ul class="brainstorm-rules"><li><b>批判を控える</b> 否定・評価は後で</li><li><b>自由奔放</b> 意外な発言も歓迎</li><li><b>量を重視</b> まず多く出す</li><li><b>結合・改善</b> 発言をつなげて発展</li></ul>
  ${itemHeading("発言を出す・ほかの発言から広げる", "block:brainstorm", "ブレーンストーミングの発言")}
  <div class="brainstorm-board">${
    state.brainstorm
      .map(
        (n) =>
          `<article class="brainstorm-note" data-preset-collection="brainstorm" data-preset-row="${n.id}"><div class="card-top"><span>${n.parent ? "発言を発展" : "自由な発言"}</span>${del("delete-brainstorm", n.id, "この発言を削除")}</div>${n.parent ? `<p class="brainstorm-parent">発展元：${esc(state.brainstorm.find((p) => p.id === n.parent)?.text || "まだ名前のない発言")}</p>` : ""}${area("発言・アイデア", `brainstorm.${n.id}.text`, "どんな可能性がある？思い付くままに書こう")}${select(
            "今の位置付け",
            `brainstorm.${n.id}.kind`,
            [
              ["hypothesis", "仮説・まだ確かめていない"],
              ["opinion", "意見・思い付きの案"],
            ],
          )}<div class="inline-actions">${btn("extend-brainstorm", "＋ この発言を発展", n.id)}${btn("transfer-brainstorm", n.card ? "KJのカードに渡しました" : "この発言をKJへ", n.id, "", n.card || !n.text.trim() ? "disabled" : "")}</div></article>`,
      )
      .join("") ||
    empty(
      "発言ボードは空です。「＋ 発言」から自由に書くか、プリセットで4件の発言と発展の例を試します。",
    )
  }</div>
  <div class="inline-actions">${btn("add-brainstorm", "＋ 発言")}${btn("transfer-brainstorm", `未整理の${remaining}件をKJのカードへ渡す`, "all", "", remaining ? "" : "disabled")}</div><p class="brainstorm-caption">発言は意見・仮説のまま渡します。調査で確認した事実とは区別し、KJ法で読み合わせます。</p></section>`;
}
function organize() {
  const endpoints = relationOptions();
  const fromBrainstorm = state.cards.filter(isBrainstormCard).length;
  const pendingBrainstorm = state.brainstorm.filter(
    (n) => n.text.trim() && !n.card,
  ).length;
  return `${brainstorming()}
  ${lesson("cards", "② KJ法 · 情報を1枚に1つ書く", "上で出した発言をカードにして、台帳・観察・生徒の声と読み合わせます。発言由来の意見・仮説と、調査で確認した事実を区別しましょう。", "「箱の場所を知っている」と「箱を見る」は別の情報です。声や推測は、観察した数値と区別して残せます。")}
  <details class="kind-example"><summary>種類と、まとまりは別のもの</summary><p><b>種類</b>は1枚ごとの情報の性質（事実・意見・仮説・検証結果）。<b>まとまり</b>は、カードの内容を読み合わせて見えてくる共通の意味です。違う種類のカードが同じまとまりに入ることもあります。</p><p>例：「受け取りが部活と重なる」（意見）と「放課後に箱を見る人が少ない」（事実）を寄せて、「受け取りたい人が確認できる機会は限られる」と表札を考えます。「時間」のような分類名で終わらせず、中の情報が何を語るかを表します。</p></details>
  ${itemHeading("ブレーンストーミングの発言と調査記録をカードに", "block:cards", "発言の引き継ぎと調査カード")}
  <p class="kj-card-connection"><strong>ブレーンストーミングから ${fromBrainstorm}枚 ／ 調査・観察などの記録 ${state.cards.length - fromBrainstorm}枚</strong><br>${state.mode === "preset" ? "このプリセットで、上の未転記の発言と9件の調査記録をカードにします。" : "上の発言ボードの「KJのカードへ渡す」で、発言をここに引き継げます。"}${pendingBrainstorm ? ` まだカードにしていない発言は${pendingBrainstorm}件です。` : ""}</p>
  <div class="card-board">${groupPanel({ id: "", title: "単独のカード" })}</div>
  ${lesson("groups", "③ KJ法 · 読み合わせて、まとまりと表札を作る", "先に箱の名前を決めず、近いと感じるカードを2〜3枚から寄せます。合わないカードは単独のままでOK。例は一つの読み方なので、動かして別の表札も試せます。", "同じ「意見」でも、気付く問題・時間の問題・負担の問題があります。多数の声だけでなく、単独の情報も残します。", state.cards.length > 0)}
  ${itemHeading("カードを寄せて、まとまりを作る", "block:groups", "まとまりと表札", state.cards.length > 0)}
  <div class="group-workspace"><div class="gather-toolbar"><span>カードの □ を選んで寄せる</span>${btn("gather-picked", `選んだ${pickedCards.size}枚でまとまりを作る`, "", "primary-button", pickedCards.size ? "" : "disabled")}${btn("add-group", "＋ 空のまとまり")}<small>PCではドラッグ。スマートフォンでは「このカードを置くまとまり」でも動かせます。</small></div>
  <div class="gathered-groups">${state.groups
    .filter((g) => !g.parent)
    .map((g) => groupPanel(g))
    .join("")}${missingGroups()}</div>
  <div class="inline-actions local-add">${btn("add-group", "＋ まとまり")}</div></div>
  ${lesson("relations", "④ KJ法 · まとまり同士の関係を図にする", "表札と単独の情報を見渡し、つながり・食い違いを言葉にします。矢印はあなたの解釈であり、因果関係の証明ではありません。必要なら上位のまとまりも作れます。", "「気付くこと」と「受け取れること」の両方に壁がありそうです。つなぎ方を変えると、全体の説明も変わります。", state.groups.some((g) => g.id === "g-recognize") && state.groups.some((g) => g.id === "g-access"))}
  <p class="kj-diagram-purpose">この図では、表札や単独の情報を線でつなぎ、関連・食い違い・次に確かめることを見渡します。つながりを言葉にし、最後の「全体の説明」へまとめます。</p>
  ${itemHeading("情報同士のつながりを見渡す", "block:diagram", "KJ法の関係図", state.cards.length > 0 || state.groups.length > 0)}
  ${itemHeading("線でつなぐ・関係を説明する", "relation:awareness", "関係線と説明", state.groups.some((g) => g.id === "g-recognize") && state.groups.some((g) => g.id === "g-access"))}
  ${kjDiagram()}${kjReading()}<p class="graph-caption">破線は上位のまとまりとの関係。実線の矢印は、入力した関係の説明です。図の表札・カードを選ぶと、元の入力欄を編集できます。</p>
  <h3>関係線の編集</h3>
  ${state.relations
    .map(
      (r) =>
        `<div class="relation-row" data-preset-collection="relations" data-preset-row="${r.id}">${select("つながりの始点", `relations.${r.id}.from`, endpoints)}<span aria-hidden="true">→</span>${select(
          "つながりの終点",
          `relations.${r.id}.to`,
          endpoints.filter((e) => e[0] !== r.from),
        )}${input("どんな関係？（解釈）", `relations.${r.id}.text`, "例：同時に起きる／食い違う／次の行動への壁")}${del("delete-relation", r.id, "この関係を削除")}</div>`,
    )
    .join(
      "",
    )}<div class="inline-actions">${btn("add-relation", "＋ 関係線", "", "", endpoints.length < 2 ? "disabled" : "")}</div>
  ${lesson("synthesis", "⑤ KJ法 · 図を読み、全体を文章で説明する", "表札と単独のカードの両方を使い、分かったこと・まだ分からないことを説明します。説明しにくいときはカードの寄せ方に戻りましょう。", "情報の一覧が、次に確かめる原因の候補へつながる説明になります。", state.cards.length > 0)}
  ${area("整理した情報から説明できること", "synthesis", "どの情報がつながる？食い違う？まだ確かめていないことは？")}
`;
}
function zoomTools(kind) {
  return `<div class="zoom-tools" aria-label="図の表示倍率">${btn("zoom", "全体", `${kind}:fit`, "", 'aria-label="図の全体を表示"')}${btn("zoom", "−", `${kind}:out`, "", 'aria-label="図を縮小"')}${btn("zoom", "＋", `${kind}:in`, "", 'aria-label="図を拡大"')}${btn("zoom", "100%", `${kind}:actual`, "", 'aria-label="図を100%で表示"')}<span>拡大時は図の中をスクロール</span></div>`;
}
function fitDiagrams() {
  for (const drawing of document.querySelectorAll(".diagram-drawing")) {
    const kind = drawing.dataset.zoomKind,
      width = Number(drawing.dataset.width),
      height = Number(drawing.dataset.height);
    const scale =
      diagramZoom[kind] ||
      Math.min(1, (drawing.parentElement.clientWidth - 2) / width);
    drawing.style.width = `${width * scale}px`;
    drawing.style.height = `${height * scale}px`;
    drawing.firstElementChild.style.transform = `scale(${scale})`;
    drawing.dataset.scale = scale;
    drawing.parentElement.style.height =
      innerWidth <= 700
        ? `${Math.min(300, Math.max(160, height * scale + 8))}px`
        : "";
  }
}
window.addEventListener("resize", () => requestAnimationFrame(fitDiagrams));
function fishbone() {
  if (!state.factors.length)
    return `<div class="fishbone-scroll diagram-empty" tabindex="0" role="region" aria-label="空の特性要因図"><p>大骨を1本置き、その骨に原因を追加します。</p></div>`;

  const columns = Math.max(1, Math.ceil(state.factors.length / 2));
  const most = Math.max(
    1,
    ...state.factors.map(
      (f) => state.causes.filter((c) => c.factor === f.id).length,
    ),
  );
  const half = Math.max(210, most * 85 + 110),
    height = half * 2 + 40,
    width = Math.max(760, columns * 340 + 210),
    spine = half + 20;
  const parts = state.factors.map((f, i) => {
    const x = 20 + Math.floor(i / 2) * 340,
      sign = i % 2 ? 1 : -1,
      end = spine + sign * (half - 60);
    const causes = state.causes.filter((c) => c.factor === f.id);
    return { f, x, sign, end, causes };
  });
  const lines = parts
    .map(
      ({ x, sign, end, causes }) =>
        `<path d="M${x + 285} ${spine} L${x + 140} ${end}"/>${causes
          .map((c, j) => {
            const cy = spine + sign * (70 + j * 85),
              cx = x + 285 - (145 * (70 + j * 85)) / (half - 60);
            return `<path d="M${cx} ${cy} H${x + 25}"/>`;
          })
          .join("")}`,
    )
    .join("");
  return `<div class="fishbone-scroll" role="region" aria-label="特性要因図。大骨や原因をタップして、すぐ隣で編集できます。" tabindex="0"><div class="diagram-drawing" data-zoom-kind="fish" data-width="${width}" data-height="${height}"><div class="fishbone-canvas" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" aria-hidden="true"><path d="M20 ${spine} H${width - 160}"/>${lines}</svg><button type="button" data-action="fish-root" class="fish-head" style="left:${width - 150}px;top:${spine - 40}px" aria-label="特性要因図の問題。Deleteでこの原因図を空にできます"><small>起きている問題</small>${esc(state.problem.what || state.problem.title || "問題・課題は未入力")}</button>${parts.map(({ f, x, sign, end, causes }) => `${btn("factor", `<small>大骨 · 考える切り口</small><span data-factor-display="${f.id}">${esc(f.title || "新しい切り口")}</span>`, f.id, `bone-label ${selectedFactor === f.id && !selectedCause ? "selected" : ""}`, `style="left:${x + 15}px;top:${end + (sign > 0 ? 8 : -68)}px"`)}${btn("add-cause", "＋ 原因", f.id, "bone-add", `style="left:${x + 245}px;top:${end + (sign > 0 ? 8 : -50)}px" aria-label="${esc(f.title || "この大骨")}に原因を追加"`)}${causes.map((c, j) => btn("cause", `<span data-cause-display="${c.id}">${esc(c.text || "新しい原因の候補")}</span><small>${c.id === state.focusCause ? "次の発想に使う原因" : "仮説・根拠を確認"}</small>`, c.id, `cause-chip ${c.id === selectedCause ? "selected" : ""} ${c.id === state.focusCause ? "is-focus" : ""}`, `style="left:${x + 10}px;top:${spine + sign * (70 + j * 85) - 55}px" aria-pressed="${c.id === selectedCause}"`)).join("")}`).join("")}</div></div></div>`;
}
function causeEditor() {
  const c = state.causes.find((c) => c.id === selectedCause),
    f = state.factors.find((f) => f.id === (c?.factor || selectedFactor));
  if (!f)
    return `<aside class="diagram-editor"><h3>大骨を1本ずつ置く</h3>${empty("「＋ 大骨」で原因を考える切り口を置き、その骨に原因を追加します。プリセットは図の上から記入できます。")}</aside>`;
  const evidence = state.cards.find((x) => x.id === c?.evidence),
    group = state.groups.find((g) => g.id === f.group);
  return `<aside class="diagram-editor"><h3>${c ? "選んだ小骨を編集" : "選んだ大骨を編集"}</h3>${group ? handoff("調査で作った表札から", group.title) : ""}${
    c
      ? `${area("原因の候補（仮説）", `causes.${c.id}.text`, "〜が影響しているのでは？")}${select("調査から引き継いだ根拠", `causes.${c.id}.evidence`, evidenceOptions())}${evidence ? `<div class="evidence-preview"><b>${kinds[evidence.kind]}</b> ${esc(evidence.text)}<small>出典：${esc(evidence.source || "未記録")}</small></div>` : empty("原因はまだ仮説です。支える情報があれば上で選びます。")}${select(
          "今の確かさ",
          `causes.${c.id}.status`,
          [
            ["hypothesis", "仮説 · 未検証"],
            ["supported", "支持する根拠あり"],
            ["disproved", "反証する根拠あり"],
          ],
        )}${area("この原因をどう確かめる？", `causes.${c.id}.test`, "何を観察・比較すると確かめられる？")}${select(
          "この原因を置く大骨",
          `causes.${c.id}.factor`,
          state.factors.map((f) => [f.id, f.title || "新しい切り口"]),
        )}<label class="checkbox-label" data-preset-target="focusCause"><input type="radio" name="focus-cause" data-focus-cause="${c.id}" ${c.id === state.focusCause ? "checked" : ""}>この原因への対策を次で考える</label><div class="inline-actions">${btn("add-cause", "＋ 同じ骨に原因", f.id)}${btn("delete-cause", "選んだ原因を削除", c.id)}</div>`
      : `${input("大骨 · 考える切り口", `factors.${f.id}.title`, "関連する原因を考える視点")}${btn("add-cause", "＋ この骨に原因を追加", f.id)}${btn("delete-factor", "この大骨を削除", f.id)}`
  }</aside>`;
}
function analyze() {
  if (selectedCause && !state.causes.some((c) => c.id === selectedCause))
    selectedCause = state.causes[0]?.id || "";
  if (!state.factors.some((f) => f.id === selectedFactor))
    selectedFactor = state.factors[0]?.id || "";
  const focus = state.causes.find((c) => c.id === state.focusCause);
  return `<div class="source-strip"><strong>調査から使える根拠：${state.cards.length}枚</strong>${btn("step", "元のカードを確認する", "1")}</div>
  ${lesson("causes", "① 情報から、原因の候補を図に置く", "大骨は原因を考える切り口、小骨は具体的な原因の候補です。整理した情報を根拠として接続します。情報をそのまま原因と決め付けず、どう影響するかを考えます。", "自分で作った表札を大骨の切り口に使えます。例の原因は、実際にある調査カードにだけ根拠を結びます。")}
  ${itemHeading("原因の候補と、次で考える原因を記入する", "block:causes", "原因図と次に使う原因の選択")}
  <div class="diagram-toolbar">${btn("add-factor", "＋ 大骨（切り口）")}${btn("groups-factors", "自分の表札を大骨にする")}<span>図の大骨・小骨を選ぶ → 隣で編集 → 次に使う原因を選ぶ</span></div>
  ${lesson("tests", "② 仮説の確かめ方を考える", "原因の説明と、確かめる方法をセットにします。小骨を選び、どんな記録・比較で確かめられるかを書きます。")}
  ${itemHeading("仮説を確かめる方法も記入する", "block:tests", "原因の確かめ方", state.causes.length > 0)}
  <div class="diagram-workbench fish-workbench"><div class="diagram-view">${zoomTools("fish")}${fishbone()}</div>${causeEditor()}</div>
  ${handoff("発想へ引き継ぐ原因", focus?.text || "図の原因を選び、「この原因への対策を次で考える」を押してください。")}`;
}
function mapLayout() {
  const positions = new Map(),
    branches = state.nodes.filter((n) => !n.parent),
    sides = new Map();
  let maxLeft = 1,
    maxRight = 1;
  function depths(n, depth, side) {
    sides.set(n.id, side);
    if (side < 0) maxLeft = Math.max(maxLeft, depth);
    else maxRight = Math.max(maxRight, depth);
    state.nodes
      .filter((c) => c.parent === n.id)
      .forEach((c) => depths(c, depth + 1, side));
  }
  branches.forEach((n, i) => depths(n, 1, i % 2 ? -1 : 1));
  const rootX = 30 + maxLeft * 220,
    width = 60 + (maxLeft + maxRight) * 220 + 172;
  const counts = { left: 0, right: 0 };
  function place(n, depth, side) {
    const children = state.nodes.filter((c) => c.parent === n.id),
      key = side < 0 ? "left" : "right";
    let y;
    if (children.length) {
      children.forEach((c) => place(c, depth + 1, side));
      y =
        (positions.get(children[0].id).y +
          positions.get(children.at(-1).id).y) /
        2;
    } else {
      y = counts[key] * 108 + 30;
      counts[key]++;
    }
    positions.set(n.id, { x: rootX + side * depth * 220, y, side });
  }
  branches.forEach((n) => place(n, 1, sides.get(n.id)));
  const rows = Math.max(2, counts.left, counts.right),
    height = rows * 108 + 60;
  for (const p of positions.values()) {
    const own = p.side < 0 ? counts.left : counts.right;
    p.y += (rows - own) * 54;
  }
  return { positions, height, width, root: { x: rootX, y: height / 2 - 46 } };
}
function mindmap() {
  if (!state.nodes.length)
    return `<div class="mindmap-scroll diagram-empty" tabindex="0" role="region" aria-label="空のマインドマップ"><p>枝を1本置くと、中心の問題から広がる図になります。</p></div>`;

  const { positions, height, width, root } = mapLayout();
  const lines = state.nodes
    .map((n) => {
      const from = n.parent ? positions.get(n.parent) : root,
        to = positions.get(n.id),
        sign = to.side;
      const a = from.x + (sign > 0 ? 172 : 0),
        b = to.x + (sign > 0 ? 0 : 172);
      return `<path class="branch-${sign > 0 ? "right" : "left"}" d="M${a} ${from.y + 46} C${a + sign * 65} ${from.y + 46} ${b - sign * 65} ${to.y + 46} ${b} ${to.y + 46}"/>`;
    })
    .join("");
  return `<div class="mindmap-scroll" role="region" aria-label="マインドマップ。枝を選択し、Enterで編集、Insertで子の枝、Deleteで削除できます。" tabindex="0"><div class="diagram-drawing" data-zoom-kind="map" data-width="${width}" data-height="${height}"><div class="mindmap-canvas" style="width:${width}px;height:${height}px"><svg class="map-lines" width="${width}" height="${height}" aria-hidden="true">${lines}</svg><button type="button" data-action="map-root" class="map-node root" style="left:${root.x}px;top:${root.y}px" aria-label="マインドマップの中心。Deleteでこのマップを空にできます"><span data-root-display>${esc(short(state.problem.title || "解決したい問題", 36))}</span></button>${state.nodes
    .map((n) => {
      const p = positions.get(n.id);
      return btn(
        "node",
        `<span data-node-display="${n.id}">${esc(short(n.text || "新しい枝", 36))}</span>${n.candidate ? "<small>比較する候補</small>" : ""}`,
        n.id,
        `map-node branch-${p.side > 0 ? "right" : "left"} ${n.id === selectedNode ? "selected" : ""} ${n.candidate ? "candidate" : ""}`,
        `style="left:${p.x}px;top:${p.y}px" aria-pressed="${n.id === selectedNode}"`,
      );
    })
    .join("")}</div></div></div>`;
}
function nodeEditor() {
  if (selectedNode === "root")
    return `<aside class="diagram-editor node-editor"><h3>マップの中心</h3>${area("中心の問題・課題", "problem.title", "解決したい問題")}${btn("add-node", "＋ 中心から枝")}${btn("clear-map", "このマップを空にする")}</aside>`;
  const node = state.nodes.find((n) => n.id === selectedNode),
    blocked = node ? descendants(state, node.id) : new Set();
  return `<aside class="diagram-editor node-editor"><h3>${node ? "選んだ枝を育てる" : "中心から連想を広げる"}</h3>${node ? `${area("枝の内容", `nodes.${node.id}.text`, "短い言葉から、具体的な案へ")}${select("親の枝", `nodes.${node.id}.parent`, [["", "中心の問題"], ...state.nodes.filter((n) => !blocked.has(n.id)).map((n) => [n.id, n.text || "新しい枝"])])}${select("対応する原因", `nodes.${node.id}.cause`, causeOptions())}${causeForNode(state, node) ? handoff("原因図からのつながり（親の枝も参照）", causeForNode(state, node).text) : ""}<label class="checkbox-label" data-preset-target="nodes.${node.id}.candidate"><input type="checkbox" data-bind="nodes.${node.id}.candidate" ${node.candidate ? "checked" : ""}>具体的な案として、比較表へ送る</label><div class="inline-actions">${btn("add-child", "＋ 子の枝", node.id)}${btn("add-sibling", "＋ 同じ階層の枝", node.id)}${btn("delete-node", "この枝を削除", node.id)}</div>` : empty("図の枝をタップすると、ここで編集できます。中心に問題を置き、関連する言葉を左右に広げ、子の枝で具体化しましょう。")}</aside>`;
}
function ideate() {
  const focus = state.causes.find((c) => c.id === state.focusCause);
  if (
    selectedNode !== "root" &&
    !state.nodes.some((n) => n.id === selectedNode)
  )
    selectedNode = "";
  return `  ${lesson("branches", "原因から連想し、枝を広げて具体化する", "中心の問題から、関連する言葉を左右に広げます。一つの方向に絞らず、「時間を変える」「見せ方を変える」などの枝から具体策を増やしましょう。プリセットを記入したら、自分の枝を1本足してみてください。", "親の枝から具体的な案へ広がる構造が見えます。選んだ原因とのつながりを確認し、実際に比べたい案だけを比較候補にします。")}
  <div class="branch-presets">${[
    ["n-access", "受け取りの機会を変える"],
    ["n-notice", "見せ方を変える"],
    ["n-prevent", "記名しやすくする"],
  ]
    .map(([id, title]) =>
      state.mode === "preset"
        ? `<div class="branch-preset"><span>${title}</span>${presetControl(`branchset:${id}`, title + "の枝と具体案")}</div>`
        : "",
    )
    .join("")}</div>
  <div class="diagram-toolbar">${btn("add-node", "＋ 中心から枝")}${focus ? btn("cause-node", "この原因から枝を作る") : ""}<span>枝を選択 → Enter：編集 / Insert：子の枝 / Shift＋Enter：同じ階層 / Delete：削除</span></div>
  <div class="diagram-workbench map-workbench"><div class="diagram-view">${zoomTools("map")}${mindmap()}</div>${nodeEditor()}</div>
  ${handoff("比較表へ引き継ぐ案", `${state.nodes.filter((n) => n.candidate).length}案。枝の内容・親から引き継いだ原因を次の比較表で確認できます。`)}`;
}
function decide() {
  const ranks = ranking(state);
  const scored = ranks.filter((r) => r.score !== null);
  const top = scored[0];
  const ties = top
    ? scored.filter((r) => Math.abs(r.score - top.score) < 1e-9)
    : [];
  const selected = state.nodes.find((n) => n.id === state.selectedIdea);
  return `${tip("重みは「何を大事にするか」、点数は「どれくらい満たすか」。プリセットなら「効果」と「続けやすさ」の重みを変えて、順位の変化を見てみよう。")}
  ${lesson("criteria", "① 比べる基準と、その大切さを決める", "効果だけで選ぶと、担当者の負担や個人情報を見落とすかもしれません。評価軸を並べ、何を大事にするかを重みで表します。", "重みは利用者の判断です。「効果」と「続けやすさ」の重みを変えると、順位が変わります。")}${itemHeading("評価軸と重みを編集する", "block:criteria")}${state.criteria
    .map(
      (c) =>
        `<div class="criterion-row" data-preset-collection="criteria" data-preset-row="${c.id}">${input("評価軸", `criteria.${c.id}.title`, "何を大事にする？")}${select(
          "重み",
          `criteria.${c.id}.weight`,
          [1, 2, 3, 4, 5].map((n) => [n, `${n}${n === 5 ? " · 大" : ""}`]),
          'data-number="true"',
        )}${del("delete-criterion", c.id, "この評価軸を削除")}</div>`,
    )
    .join("")}
  <div class="inline-actions">${btn("add-criterion", "＋ 評価軸")}${btn("step", "発想に戻って案を追加", "3")}</div>
  ${lesson("scores", "② 同じ基準で案を比べる", "1は低く、5は高く満たすという予想の点数です。プリセットでは点数と、試す案の例を入れます。選ぶ案や重みは自由に変えられます。点数は実測結果ではありません。", "どの案が良いかは、重視する基準で変わります。点数の理由・制約を確認し、試す案は自分で選びます。", ranks.length > 0 && state.criteria.length > 0)}
  ${itemHeading("比較表の点数と試す案", "block:scores", "比較表の採点と試す案の選択", ranks.length > 0 && state.criteria.length > 0)}
  ${ranks.length && state.criteria.length ? `<div class="table-scroll" data-preset-item="matrix" role="region" aria-label="候補の比較表。横にスクロールできます。" tabindex="0"><table class="matrix"><caption>1＝低い、5＝高い。負担や費用の軸なら「少ないほど高得点」に統一します。</caption><thead><tr><th scope="col">試す案を選ぶ</th>${state.criteria.map((c) => `<th scope="col"><span data-criterion-display="${c.id}">${esc(c.title)}</span><br>重み ${c.weight}</th>`).join("")}<th scope="col">加重平均 / 5</th></tr></thead><tbody>${ranks.map((r) => `<tr class="${r.node.id === state.selectedIdea ? "chosen" : ""}"><th scope="row"><label class="checkbox-label"><input type="radio" name="selected-idea" data-selected-idea="${r.node.id}" ${r.node.id === state.selectedIdea ? "checked" : ""}>${esc(r.node.text || "名前のない案")}</label>${causeForNode(state, r.node) ? `<small>原因：${esc(short(causeForNode(state, r.node).text, 30))}</small>` : ""}</th>${state.criteria.map((c) => `<td data-preset-target="nodes.${r.node.id}.ratings.${c.id}"><label><span class="visually-hidden">${esc(r.node.text)}の${esc(c.title)}の点数</span><select data-bind="nodes.${r.node.id}.ratings.${c.id}" data-number="true"><option value="" ${r.node.ratings[c.id] == null ? "selected" : ""}>—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${r.node.ratings[c.id] === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>${fieldPreset(`nodes.${r.node.id}.ratings.${c.id}`, c.title)}</td>`).join("")}<td data-score-display="${r.node.id}"><strong>${r.score?.toFixed(2) ?? "未採点"}</strong></td></tr>`).join("")}</tbody></table></div>` : empty("発想の枝を比較候補にして、評価軸を1つ以上追加してください。")}
  <p class="rank-message" aria-live="polite">${top ? `今の重みでは「${esc(ties.map((r) => r.node.text).join("」「"))}」${ties.length > 1 ? "が同点で上位" : "が上位"}。${scored.length < ranks.length ? "未採点の案は順位に入っていません。" : ""}` : "採点すると、重みに応じた比較結果をここに表示します。"}点数だけで決めず、理由や制約も考えて試す案を選ぼう。</p>
  ${tip("加重平均＝Σ（点数×重み）÷Σ（重み）。プリセットの点数は予想であり、実測値ではありません。選択は上位案に限りません。")}
  ${lesson("plan", "③ 案を選び、小さく試す計画を書く", "比較表で試す案を選択してから、担当・期間・確かめ方を書きます。順位だけで決めず、実際に続けられるかも考えます。", "選んだ案が、そのまま次の実行・検証に引き継がれます。", !!selected)}${itemHeading("選んだ案を小さく試す計画に", "block:plan", "実行計画", !!selected)}${handoff("今回試す案", selected?.text)}<div class="form-grid">${input("担当・協力する人", "plan.who", "誰が動く？")}${input("いつ・どれくらい試す？", "plan.when", "開始日・試す期間")}${area("確かめる方法・選んだ理由", "plan.test", "何を記録する？この案を選ぶ理由は？")}${area("注意点・副作用への備え", "plan.risk", "負担、費用、個人情報、届かない人など")}</div>`;
}
function graph() {
  const c = comparison(state),
    m = state.measure,
    unit = m.kind === "rate" ? "%" : m.unit;
  const nums = [c.before, c.after, m.target].filter((v) => v !== null);
  const negative = nums.some((v) => v < 0);
  const max = m.kind === "rate" ? 100 : Math.max(1, ...nums);
  return `<div class="graph-box"><h3 data-measure-display>${esc(m.label || "選んだ指標")}</h3>${[
    ["実施前", c.before, ""],
    ["実施後", c.after, "after"],
    ["目標", m.target, "target"],
  ]
    .map(
      ([label, num, cls]) =>
        `<div class="graph-line"><span>${label}</span><div class="graph-track" aria-hidden="true"><div class="graph-bar ${cls}" style="width:${num === null || negative ? 0 : Math.min(100, Math.max(0, (num / max) * 100))}%"></div></div><span class="graph-number">${fmt(num)}${num === null ? "" : esc(unit)}</span></div>`,
    )
    .join("")}
  <p class="graph-caption">${negative ? "負の値を含むため、棒は表示せず数値で比較します。" : m.kind === "rate" ? "横軸：0〜100%。成功件数の合計 ÷ 対象件数の合計。" : `横軸：0〜${fmt(max)} ${esc(unit)}。実施後は記録した値の平均。`}未入力の行は集計しません。</p>
  ${c.invalid ? '<p class="notice">各行の対象件数を0より大きく、成功件数以上にしてください。片方だけ入力した行も確認してください。</p>' : ""}
  ${c.after !== null && m.target !== null ? `<p class="result-callout">目標は${c.met ? "達成" : "未達成"}。${c.change !== null ? `実施前から ${c.change > 0 ? "+" : ""}${fmt(c.change)} ${m.kind === "rate" ? "ポイント" : esc(unit)}。` : ""}</p>` : ""}</div>`;
}
function verify() {
  const selected = state.nodes.find((n) => n.id === state.selectedIdea);
  const eligible = canSimulate(state);
  return `${state.resultFor && state.resultFor !== state.selectedIdea ? '<p class="notice">下の結果は、以前選んだ案の記録です。今の案とは異なるため、結果を入れ替えるか、以前の記録として保存してください。</p>' : ""}
  ${simulationChanged(state) ? '<p class="notice">架空結果は編集前の題材・案・指標のものです。現在の条件には当てはめられません。</p>' : ""}
  ${tip("実施したかどうかと、効果があったかどうかは別に記録します。条件を揃えた比較と、数値に出ない困りごとの両方を残しましょう。")}
  ${lesson("checks", "① 実施する作業を並べ、実施したらチェックする", "「実施済み」のチェックは作業を行った記録です。プリセットでは、実施したつもりでチェックして体験できます。効果は下の結果で別に検証します。", "実施の記録と効果の記録が分かれます。チェックとメモは、自分で操作して残しましょう。")}${itemHeading("チェックシート · 実施と気付きを記録する", "block:checks")}${state.checks.map((c) => `<div class="check-row" data-preset-collection="checks" data-preset-row="${c.id}"><label class="check-complete"><input type="checkbox" data-bind="checks.${c.id}.done" ${c.done ? "checked" : ""}><span>実施済み</span><span class="visually-hidden"> · ${esc(c.text || "作業")}</span></label><div>${input("確認する作業", `checks.${c.id}.text`, "実施すること")}${input("メモ", "checks." + c.id + ".note", "できたこと・困ったこと")}</div>${del("delete-check", c.id, "この確認項目を削除")}</div>`).join("") || empty("小さく試すための作業を追加してください。")}
  <div class="inline-actions">${btn("add-check", "＋ 確認項目")}</div>
  <h3>結果を記録して、比較する</h3>
  ${lesson("results", "② 試した結果を記録し、前後を比べる", "この例では、選んだ案を4週間試し、毎週集まった10件ずつを各4週間追跡したとします。「プリセット記入」で4週分の架空の記録を入れます。数値以外の観察メモは、下の入力欄で別に記入して、返却率と負担を見比べましょう。", "実施前と実施後の変化、目標との差が見えます。同じ案でも、返却率以外の副作用や負担に注目します。", eligible && !state.records.length && !state.observation)}
  ${state.mode === "preset" && !eligible ? '<p class="notice">教材の結果を試すには、問題設定の例を入れ、比較表で教材の案を選びます。自分の案・指標に変えた場合は、実際の結果を入力してください。</p>' : ""}
  ${itemHeading("4週間の実施結果", "block:results", "4週間の実施結果", eligible)}
  ${state.records.length ? `<div class="inline-actions">${btn("clear-results", "結果の記録を空にする")}</div>` : ""}
  ${state.simulation ? `<p><span class="fiction-label">架空の実施結果</span>${esc(strategies[state.simulation].name)}の試行。編集しても架空データが元です。</p>` : ""}
  ${state.records.map((r) => `<div data-preset-collection="records" data-preset-row="${r.id}" class="record-row ${state.measure.kind === "value" ? "value-row" : ""}">${input("日付・対象・測定の名前", `records.${r.id}.label`, "何を、いつ数えた？")}${state.measure.kind === "rate" ? input("成功件数", `records.${r.id}.count`, "", "number", 'min="0" max="1000000000" step="any"') + input("対象件数", `records.${r.id}.total`, "", "number", 'min="0" max="1000000000" step="any"') : input(`値（${state.measure.unit || "単位未設定"}）`, `records.${r.id}.value`, "", "number", 'min="-1000000000" max="1000000000" step="any"')}${del("delete-record", r.id, "この結果の行を削除")}<div class="record-note">${input("測定条件・補足", `records.${r.id}.note`, "期間・対象の違いなど")}</div></div>`).join("") || empty("自由作成では、実際に試した結果を自分で入力します。未記録は0として扱いません。")}
  <div class="inline-actions">${btn("add-record", "＋ 結果の行")}${btn("step", "指標・実施前の値を編集", "0")}</div>${graph()}
  ${area("数値以外の変化・副作用・比較の限界", "observation", "負担は増えた？別の要因が結果に影響していない？")}${tip("前後の差だけでは対策が原因とは断定できません。対象の違い・偶然・行事なども確認し、必要ならもう一度小さく試します。")}`;
}
function reflect() {
  const c = comparison(state);
  const idea = state.nodes.find((n) => n.id === state.selectedIdea);
  const unit = state.measure.kind === "rate" ? "%" : state.measure.unit;
  return `${handoff("ここまでのつながり", `${state.problem.title || "題材未入力"} → ${idea?.text || "対策未選択"} → ${fmt(c.before)}${c.before === null ? "" : unit} から ${fmt(c.after)}${c.after === null ? "" : unit}`)}
  ${state.resultFor && state.resultFor !== state.selectedIdea ? '<p class="notice">結果は以前の対策の記録です。振り返る前に、対策と結果の対応を確認しましょう。</p>' : ""}
  ${simulationChanged(state) ? '<p class="notice">架空結果は編集前の条件のものです。検証の段階に戻って対応を確認しましょう。</p>' : ""}
  ${tip("Keepには続けたい工夫、Problemには残った課題、Tryには次に確かめる行動を。カードは別の列へ動かせます。根拠も一言残そう。")}
  ${lesson("kpt", "① 結果をもとに、振り返りを3つに分ける", "返却率と、選んだ案の観察メモを読みます。Keepに続けたいこと、Problemに残った課題、Tryに次の行動を書きます。", "同じ返却率でも、負担や届かなかった人に着目すると、次の改善は変わります。", c.after !== null && !!state.resultFor)}
${itemHeading("結果からKeep・Problem・Tryを考える", "block:kpt", "KPTの3枚のカード", c.after !== null && !!state.resultFor)}<div class="kpt-board">${Object.entries(
    {
      keep: ["Keep", "続けること"],
      problem: ["Problem", "残った課題"],
      try: ["Try", "次に試すこと"],
    },
  )
    .map(
      ([k, [title, desc]]) =>
        `<section class="kpt-column ${k}"><h3>${title}<small>${desc}</small></h3>${
          state.kpt
            .filter((n) => n.kind === k)
            .map(
              (n) =>
                `<article class="kpt-card" data-preset-collection="kpt" data-preset-row="${n.id}"><div class="card-top">${del("delete-kpt", n.id, "振り返りのカードを削除")}</div>${area("内容", `kpt.${n.id}.text`, desc)}${input("根拠・つながる記録", `kpt.${n.id}.source`, "どの事実・結果から考えた？")}${select(
                  "列を移動する",
                  `kpt.${n.id}.kind`,
                  [
                    ["keep", "Keep"],
                    ["problem", "Problem"],
                    ["try", "Try"],
                  ],
                )}</article>`,
            )
            .join("") || empty("自分の言葉で1枚追加。")
        }${btn("add-kpt", "＋ カード", k)}</section>`,
    )
    .join("")}</div>
  ${lesson(
    "next",
    "② 次の一歩を具体的にする",
    "Tryの内容から、誰が・何を・いつまでに行うかを決めます。Tryは発想へ、検証結果は調査カードへ戻せます。",
    "振り返りで終わらず、調査や発想に戻って次の試行を始められます。",
    state.kpt.some((k) => k.kind === "try" && k.text),
  )}<h3>次の一歩を決める</h3>${area("次に、誰が・何を・いつまでに？", "next", "例：受け取りに来られない人に聞き取り、時間帯の仮説を調べ直す")}
  <div class="inline-actions">${btn("step", "調査に戻る", "1")}${btn("step", "対策を考え直す", "3")}${btn("try-idea", "Tryを発想の枝へつなぐ")}${btn("result-card", "検証の要約を情報カードにする")}</div>
  ${tip("「Try」は次の仮説です。今回の結果を根拠に、問題設定や原因に戻って考え直せます。完成した図より、考えが変わった理由を持ち帰ろう。")}`;
}

function newNode(parent = "", text = "", cause = "") {
  const n = {
    id: uid(),
    parent,
    text,
    cause,
    candidate: false,
    strategy: "",
    ratings: {},
  };
  state.nodes.push(n);
  selectedNode = n.id;
  return n;
}
function remove(collection, id) {
  removeItem(state, collection, id);
}
function jump(step) {
  state.step = Math.max(0, Math.min(6, Number(step)));
  scheduleSave();
  render(true);
  $("#workbook").scrollIntoView({
    block: "start",
    behavior: "instant",
  });
}
function summary() {
  const text = report(state);
  $("#summary-content").innerHTML = text
    .split("\n")
    .map((line) =>
      line.startsWith("### ")
        ? `<h4>${esc(line.slice(4))}</h4>`
        : line.startsWith("## ")
          ? `<h3>${esc(line.slice(3))}</h3>`
          : line.startsWith("# ")
            ? `<h3>${esc(line.slice(2))}</h3>`
            : `<p>${esc(line)}</p>`,
    )
    .join("");
  $("#summary-dialog").showModal();
}
function download(text, ext, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `思考ツール-${state.mode === "preset" ? "プリセット" : "自由作成"}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const message = $("#download-status");
  message.hidden = false;
  message.innerHTML = `<strong>↓ ${esc(a.download)} のダウンロードを開始しました</strong><p>通常は「ダウンロード」フォルダに保存されます。ブラウザのダウンロード一覧で確認してください。保存先を選ぶ設定の場合は、選んだフォルダに保存されます。</p>`;
  return a.download;
}
$("#confirm-dialog").addEventListener("click", (event) => {
  const button = event.target.closest("[data-confirm-value]");
  if (button) $("#confirm-dialog").close(button.dataset.confirmValue);
});
async function confirmInApp(message, actionLabel = "実行する") {
  const dialog = $("#confirm-dialog");
  $("#confirm-message").textContent = message;
  $("#confirm-accept").textContent = actionLabel;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    ),
  );
}
async function action(el) {
  const a = el.dataset.action,
    id = el.dataset.id;
  mutationBefore = structuredClone(state);
  let focusPath = "";
  if (a === "zoom") {
    const [kind, choice] = id.split(":");
    const current = Number(
      $(`.diagram-drawing[data-zoom-kind="${kind}"]`)?.dataset.scale || 1,
    );
    diagramZoom[kind] =
      choice === "fit"
        ? 0
        : choice === "actual"
          ? 1
          : Math.max(
              0.25,
              Math.min(2, current + (choice === "in" ? 0.2 : -0.2)),
            );
    fitDiagrams();
    return;
  }
  if (a === "map-root") {
    selectedNode = "root";
    render();
    return;
  }
  if (a === "fish-root") {
    jump(0);
    return;
  }
  if (a === "clear-map" || a === "clear-fish") {
    if (
      !(await confirmInApp(
        a === "clear-map"
          ? "このマップの枝をすべて消して、図を空にします。問題設定と記録した結果は保持します。"
          : "この原因図の大骨・小骨をすべて消します。調査カードと発想の枝は保持します。",
        "図を空にする",
      ))
    )
      return;
    if (a === "clear-map") {
      state.nodes = [];
      state.selectedIdea = "";
      selectedNode = "";
    } else {
      state.factors = [];
      state.causes = [];
      state.focusCause = "";
      selectedFactor = "";
      selectedCause = "";
    }
    cleanReferences(state);
    changed();
    save();
    render();
    return;
  }
  if (a === "preset") {
    const anchor = viewportAnchor(el);
    const result = togglePreset(state, id, {
      factor: el.dataset.targetFactor,
      parent: el.dataset.targetParent,
    });
    if (!result.ok) {
      notify(
        "この場所には既に入力があるか、必要な前の内容がありません。入力済みの内容はそのまま残します。",
      );
      return;
    }
    lastPresetChange = { id, ...result };
    const added =
      result.rows.find((r) => r.collection === "causes") || result.rows[0];
    if (id === "block:tests" && !selectedCause) {
      selectedCause = state.causes[0]?.id || "";
      selectedFactor = state.causes[0]?.factor || "";
    }
    if (!result.cleared && added?.collection === "causes") {
      selectedCause = added.id;
      selectedFactor = state.causes.find((c) => c.id === added.id).factor;
    }
    if (!result.cleared && added?.collection === "factors") {
      selectedFactor = added.id;
      selectedCause = "";
    }
    if (!result.cleared && added?.collection === "nodes")
      selectedNode = added.id;
    if (id === "block:causes" && state.focusCause) {
      selectedCause = state.focusCause;
      selectedFactor = state.causes.find(
        (c) => c.id === state.focusCause,
      ).factor;
    }
    changed();
    save();
    notify("");
    render();
    restoreViewport(anchor);
    return;
  }
  if (
    a === "kj-group" ||
    a === "kj-card" ||
    a === "kj-relation" ||
    a === "kj-parent"
  ) {
    const path =
      a === "kj-group" || a === "kj-parent"
        ? `groups.${id}.title`
        : a === "kj-relation"
          ? `relations.${id}.text`
          : `cards.${id}.text`;
    $(`[data-bind="${CSS.escape(path)}"]`)?.scrollIntoView({
      block: "center",
      behavior: "instant",
    });
    return;
  }
  if (a === "gather-picked") {
    if (!pickedCards.size) return;
    const g = { id: uid(), title: "", parent: "" };
    state.groups.push(g);
    for (const c of state.cards) if (pickedCards.has(c.id)) c.group = g.id;
    pickedCards.clear();
    focusPath = `groups.${g.id}.title`;
    notify(
      "選んだカードを寄せました。読み合わせて、この情報が語ることを表札に書きましょう。",
    );
  }
  if (a === "move-group") {
    const [groupId, direction] = id.split(":");
    const i = state.groups.findIndex((g) => g.id === groupId),
      j = i + (direction === "left" ? -1 : 1);
    if (j >= 0 && j < state.groups.length)
      [state.groups[i], state.groups[j]] = [state.groups[j], state.groups[i]];
  }
  if (a === "add-relation") {
    const opts = relationOptions();
    if (opts.length < 2) return;
    const r = { id: uid(), from: opts[0][0], to: opts[1][0], text: "" };
    state.relations.push(r);
    focusPath = `relations.${r.id}.text`;
  }
  if (a === "delete-relation") remove("relations", id);
  if (a === "unlink-parent") {
    const g = state.groups.find((g) => g.id === id);
    if (g) g.parent = "";
  }
  if (a === "clear-results") {
    if (
      !(await confirmInApp(
        "結果の行と観察メモを空にします。必要なら先に保存ファイルを書き出してください。",
      ))
    )
      return;
    state.records = [];
    state.observation = "";
    state.resultFor = "";
    state.simulation = "";
    state.examples = state.examples.filter((x) => x !== "results");
  }
  if (a === "cause" || a === "factor") {
    selectedCause = a === "cause" ? id : "";
    selectedFactor =
      a === "factor" ? id : state.causes.find((c) => c.id === id)?.factor || "";
    render();
    return;
  }
  if (
    [
      "add-brainstorm",
      "extend-brainstorm",
      "delete-brainstorm",
      "transfer-brainstorm",
    ].includes(a)
  ) {
    if (a === "delete-brainstorm") removeItem(state, "brainstorm", id);
    else if (a === "transfer-brainstorm") {
      brainstormToCards(state, id === "all" ? undefined : [id]);
    } else {
      if (state.brainstorm.length >= 300) {
        notify(
          "発言は300件まで記録できます。不要な発言を整理してから追加してください。",
        );
        return;
      }
      const note = {
        id: uid(),
        text: "",
        kind: "hypothesis",
        parent: a === "extend-brainstorm" ? id : "",
        card: "",
      };
      state.brainstorm.push(note);
      focusPath = `brainstorm.${note.id}.text`;
    }
    changed();
    save();
    render();
    if (focusPath)
      $(`[data-bind="${CSS.escape(focusPath)}"]`)?.focus({
        preventScroll: true,
      });
    return;
  }
  if (a === "step") {
    jump(id);
    return;
  }
  if (a === "back") {
    jump(state.step - 1);
    return;
  }
  if (a === "next") {
    state.done[state.step] = true;
    state.review[state.step] = false;
    state.reviewNotes[state.step] = [];
    save();
    if (state.step === 6) {
      render();
      summary();
    } else jump(state.step + 1);
    return;
  }
  if (a === "reviewed") {
    state.review[state.step] = false;
    state.reviewNotes[state.step] = [];
    save();
    render();
    return;
  }
  if (a === "mode") {
    save();
    state = load(el.dataset.mode);
    selectedNode = "";
    lastPresetChange = null;
    mutationBefore = null;
    selectedCause = "";
    selectedFactor = "";
    pickedCards.clear();
    save();
    render();
    notify(startNotice);
    return;
  }
  if (a === "reset") {
    if (
      !(await confirmInApp(
        "このモードの作業を最初からやり直します。必要なら先に保存ファイルを書き出してください。",
      ))
    )
      return;
    state = state.mode === "preset" ? presetWorkbook() : emptyWorkbook();
    cache.set(state.mode, state);
    unreadableModes.delete(state.mode);
    selectedNode = "";
    lastPresetChange = null;
    mutationBefore = null;
    selectedCause = "";
    selectedFactor = "";
    pickedCards.clear();
    save();
    render();
    startNotice = "";
    jump(0);
    notify(
      "このモードの作業を空欄に戻し、第1段階から開始しました。もう一方のモードは保持しています。",
    );
    return;
  }
  if (a === "export-json") {
    save();
    download(JSON.stringify(state, null, 2), "json", "application/json");
    notify(
      "JSONファイルのダウンロードを開始しました。保存先は通常「ダウンロード」フォルダです。保存したファイルを「ファイルを開く」から選ぶと再開できます。",
    );
    return;
  }
  if (a === "import") {
    $("#import-file").click();
    return;
  }
  if (a === "summary") {
    summary();
    return;
  }
  if (a === "close-summary") {
    $("#summary-dialog").close();
    return;
  }
  if (a === "export-report") {
    download(report(state), "md", "text/markdown;charset=utf-8");
    return;
  }
  if (a === "print") {
    window.print();
    return;
  }
  if (a === "add-card") {
    const item = {
      id: uid(),
      text: "",
      kind: "fact",
      source: "",
      group: id || "",
    };
    state.cards.push(item);
    focusPath = `cards.${item.id}.text`;
  }
  if (a === "delete-card") {
    remove("cards", id);
    pickedCards.delete(id);
    state.relations = state.relations.filter(
      (r) => r.from !== id && r.to !== id,
    );
    for (const c of state.causes) if (c.evidence === id) c.evidence = "";
  }
  if (a === "add-group") {
    const item = { id: uid(), title: "", parent: id || "" };
    state.groups.push(item);
    focusPath = `groups.${item.id}.title`;
  }
  if (a === "delete-group") {
    const oldGroup = state.groups.find((g) => g.id === id);
    for (const g of state.groups)
      if (g.parent === id) g.parent = oldGroup.parent;
    for (const f of state.factors) if (f.group === id) f.group = "";
    state.relations = state.relations.filter(
      (r) => r.from !== id && r.to !== id,
    );
    remove("groups", id);
    for (const c of state.cards) if (c.group === id) c.group = "";
  }
  if (a === "add-factor") {
    const item = { id: uid(), title: "", group: "" };
    state.factors.push(item);
    selectedFactor = item.id;
    selectedCause = "";
    focusPath = `factors.${item.id}.title`;
  }
  if (a === "groups-factors") {
    let count = 0;
    for (const g of state.groups) {
      if (!g.title.trim() || state.factors.some((f) => f.title === g.title))
        continue;
      state.factors.push({ id: uid(), title: g.title, group: g.id });
      count++;
    }
    notify(
      count
        ? `${count}個のまとまりを大骨にしました。情報の分類と原因の切り口は、違っていても構いません。`
        : "名前を付けたまとまりが必要です。同じ名前の大骨は重ねて作りません。",
    );
  }
  if (a === "delete-factor") {
    const attached = state.causes.filter((c) => c.factor === id);
    let other = state.factors.find((f) => f.id !== id);
    if (attached.length && !other) {
      other = { id: uid(), title: "移動した原因", group: "" };
      state.factors.push(other);
    }
    for (const c of attached) c.factor = other.id;
    remove("factors", id);
  }
  if (a === "add-cause") {
    const c = {
      id: uid(),
      factor: id,
      text: "",
      evidence: "",
      status: "hypothesis",
      test: "",
    };
    state.causes.push(c);
    selectedCause = c.id;
    selectedFactor = c.factor;
    focusPath = `causes.${c.id}.text`;
  }
  if (a === "delete-cause") {
    remove("causes", id);
    if (state.focusCause === id) state.focusCause = "";
    for (const n of state.nodes) if (n.cause === id) n.cause = "";
  }
  if (a === "node") {
    selectedNode = id;
    render();
    return;
  }
  if (a === "add-node") newNode();
  if (a === "add-child") newNode(id);
  if (a === "add-sibling")
    newNode(state.nodes.find((n) => n.id === id)?.parent || "");
  if (a === "cause-node") {
    const c = state.causes.find((c) => c.id === state.focusCause);
    if (c) newNode("", `${c.text}への対策`, c.id);
  }
  if (a === "delete-node") {
    const children = state.nodes.filter((n) => n.parent === id);
    const node = state.nodes.find((n) => n.id === id);
    if (
      children.length &&
      !(await confirmInApp(
        "この枝を削除し、子の枝を一つ上につなぎ直します。続けますか？",
      ))
    )
      return;
    for (const n of children) n.parent = node.parent;
    if (selectedNode === id)
      selectedNode = node.parent || children[0]?.id || "";
    remove("nodes", id);
    if (state.selectedIdea === id) state.selectedIdea = "";
  }
  if (a === "add-criterion") {
    const item = { id: uid(), title: "", weight: 3 };
    state.criteria.push(item);
    focusPath = `criteria.${item.id}.title`;
  }
  if (a === "delete-criterion") {
    remove("criteria", id);
    for (const n of state.nodes) delete n.ratings[id];
  }
  if (a === "add-check") {
    const item = { id: uid(), text: "", done: false, note: "" };
    state.checks.push(item);
    focusPath = `checks.${item.id}.text`;
  }
  if (a === "delete-check") remove("checks", id);
  if (a === "add-record") {
    const item = {
      id: uid(),
      label: "",
      count: null,
      total: null,
      value: null,
      note: "",
    };
    state.records.push(item);
    focusPath = `records.${item.id}.label`;
    if (!state.resultFor) state.resultFor = state.selectedIdea;
  }
  if (a === "delete-record") remove("records", id);
  if (a === "add-kpt") {
    const item = { id: uid(), kind: id, text: "", source: "" };
    state.kpt.push(item);
    focusPath = `kpt.${item.id}.text`;
  }
  if (a === "delete-kpt") remove("kpt", id);
  if (a === "try-idea") {
    const cards = state.kpt.filter((n) => n.kind === "try" && n.text.trim());
    let count = 0;
    for (const c of cards)
      if (!state.nodes.some((n) => n.text === c.text)) {
        newNode("", c.text);
        count++;
      }
    if (count) {
      markEdited(state, 3);
      changed();
      jump(3);
      notify(
        `${count}枚のTryを発想の枝につなぎました。必要なら原因や親の枝と結び付けてください。`,
      );
      return;
    }
    notify("内容のあるTryカードが必要です。同じ内容の枝は重ねて作りません。");
  }
  if (a === "result-card") {
    const c = comparison(state);
    if (c.after === null) {
      notify("結果の数値を入力してから、検証カードにつなげられます。");
      return;
    }
    const unit = state.measure.kind === "rate" ? "%" : state.measure.unit;
    state.cards.push({
      id: uid(),
      text: `${state.measure.label || "指標"}：${fmt(c.before)}${unit} → ${fmt(c.after)}${unit}。${state.observation}`,
      kind: "result",
      source: state.simulation
        ? "教材の架空の実施結果"
        : state.measure.conditions || "自分で記録した実施結果",
      group: "",
    });
    markEdited(state, 1);
    changed();
    jump(1);
    notify(
      "検証結果を単独の情報カードにつなぎました。調査を見直して、次の仮説へ。",
    );
    return;
  }
  changed();
  render();
  if (["add-node", "add-child", "add-sibling", "cause-node"].includes(a))
    focusPath = `nodes.${selectedNode}.text`;
  if (focusPath) $(`[data-bind="${CSS.escape(focusPath)}"]`)?.focus();
}

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  clearPresetHighlight();
  if (el && !el.disabled) action(el);
});
function update(event) {
  const el = event.target;
  if (!el.dataset.bind) return;
  if (el.type === "number" && !el.validity.valid) {
    el.reportValidity();
    return;
  }
  const path = el.dataset.bind;
  const [obj, k] = resolve(path);
  let v;
  if (el.type === "checkbox") v = el.checked;
  else if (el.type === "number" || el.dataset.number === "true")
    v = el.value === "" ? null : Number(el.value);
  else v = el.value;
  // The blur-time change event repeats the input value. Keep navigation buttons
  // mounted while that blur occurs, so a tap on the next stage is not cancelled.
  if (obj[k] === v) return;
  clearPresetHighlight();
  mutationBefore = structuredClone(state);
  obj[k] = v;
  if (
    path.startsWith("nodes.") &&
    k === "candidate" &&
    !v &&
    state.selectedIdea === obj.id
  )
    state.selectedIdea = "";
  if (
    path.startsWith("nodes.") &&
    k === "text" &&
    obj.strategy &&
    v !== strategies[obj.strategy].name
  )
    obj.strategy = "";
  changed();
  if (el.type === "number") {
    if ($(".graph-box")) $(".graph-box").outerHTML = graph();
    const gap = $(".gap-result");
    if (gap) {
      const c = comparison(state),
        m = state.measure;
      const difference =
        c.before !== null && m.target !== null
          ? Math.abs(m.target - c.before)
          : null;
      gap.innerHTML = `実施前 <strong>${fmt(c.before)}${m.kind === "rate" && c.before !== null ? "%" : ""}</strong> → 目標 <strong>${fmt(m.target)}${m.kind === "rate" && m.target !== null ? "%" : ""}</strong>${difference !== null ? `<p>差は ${fmt(difference)} ${m.kind === "rate" ? "ポイント" : esc(m.unit)}。この差を埋めるには、何を確かめたい？</p>` : ""}`;
    }
  }
  if ($(".stage-outcome")) $(".stage-outcome").outerHTML = stageOutcome();
  if (path.startsWith("brainstorm.")) {
    for (const note of state.brainstorm) {
      const transfer = $(
        `[data-action="transfer-brainstorm"][data-id="${note.id}"]`,
      );
      if (transfer) transfer.disabled = Boolean(note.card || !note.text.trim());
      const parent = $(
        `.brainstorm-note[data-preset-row="${note.id}"] .brainstorm-parent`,
      );
      if (parent)
        parent.textContent = `発展元：${state.brainstorm.find((n) => n.id === note.parent)?.text || "まだ名前のない発言"}`;
    }
    const remaining = state.brainstorm.filter(
      (n) => n.text.trim() && !n.card,
    ).length;
    const transferAll = $('[data-action="transfer-brainstorm"][data-id="all"]');
    if (transferAll) {
      transferAll.textContent = `未整理の${remaining}件をKJのカードへ渡す`;
      transferAll.disabled = !remaining;
    }
  }
  // Text inputs stay mounted for IME, caret and touch keyboard stability.
  for (const g of state.groups)
    for (const option of document.querySelectorAll(
      `[data-bind^="cards."][data-bind$=".group"] option[value="${g.id}"]`,
    ))
      option.textContent = g.title || "（表札がないまとまり）";
  for (const f of state.factors)
    for (const option of document.querySelectorAll(
      `[data-bind^="causes."][data-bind$=".factor"] option[value="${f.id}"]`,
    ))
      option.textContent = f.title || "（名前のない大骨）";
  for (const c of state.criteria) {
    const display = $(`[data-criterion-display="${c.id}"]`);
    if (display) display.textContent = c.title;
  }
  for (const n of state.nodes) {
    for (const option of document.querySelectorAll(
      `[data-bind$=".parent"] option[value="${n.id}"]`,
    ))
      option.textContent = n.text || "（名前のない枝）";
    const display = $(`[data-node-display="${n.id}"]`);
    if (display) display.textContent = short(n.text || "（新しい枝）", 36);
  }
  for (const c of state.causes) {
    const display = $(`[data-cause-display="${c.id}"]`);
    if (display) display.textContent = c.text || "新しい原因の候補";
  }
  for (const c of state.cards) {
    const card = $(`[data-card="${c.id}"]`);
    if (card) card.dataset.kind = c.kind;
  }
  if ($(".kj-diagram-scroll") && /^(groups|cards|relations)\./.test(path))
    $(".kj-diagram-scroll").outerHTML = kjDiagram();
  if ($(".kj-reading") && /^(groups|cards|relations)\./.test(path))
    $(".kj-reading").outerHTML = kjReading();
  for (const f of state.factors) {
    const display = $(`[data-factor-display="${f.id}"]`);
    if (display) display.textContent = short(f.title, 14);
  }
  if ($("[data-root-display]"))
    $("[data-root-display]").textContent = short(
      state.problem.title || "解決したい問題",
      36,
    );
  if ($("[data-measure-display]"))
    $("[data-measure-display]").textContent =
      state.measure.label || "選んだ指標";
}
$("#stage").addEventListener("input", update);
$("#stage").addEventListener("change", (event) => {
  const el = event.target;
  if (el.dataset.selectCard) {
    if (el.checked) pickedCards.add(el.dataset.selectCard);
    else pickedCards.delete(el.dataset.selectCard);
    const button = $('[data-action="gather-picked"]');
    button.textContent = `選んだ${pickedCards.size}枚でまとまりを作る`;
    button.disabled = !pickedCards.size;
    return;
  }
  if (el.dataset.focusCause) {
    mutationBefore = structuredClone(state);
    state.focusCause = el.dataset.focusCause;
    changed();
    render();
    return;
  }
  if (el.dataset.selectedIdea) {
    mutationBefore = structuredClone(state);
    state.selectedIdea = el.dataset.selectedIdea;
    changed();
    render();
    return;
  }
  if (el.dataset.bind) {
    update(event);
    if (
      el.dataset.bind.startsWith("relations.") &&
      el.dataset.bind.endsWith(".from")
    ) {
      const [r] = resolve(el.dataset.bind);
      if (r.from === r.to)
        r.to = relationOptions().find((o) => o[0] !== r.from)[0];
    }
    if (["SELECT"].includes(el.tagName) || ["checkbox"].includes(el.type))
      render();
  }
});
$("#stage").addEventListener("keydown", async (event) => {
  if (
    event.isComposing ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
  )
    return;
  const shape = event.target.closest(
    '[data-action="node"],[data-action="cause"],[data-action="factor"],[data-action="kj-group"],[data-action="kj-card"],[data-action="kj-relation"],[data-action="kj-parent"],[data-action="map-root"],[data-action="fish-root"]',
  );
  if (!shape) return;
  const id = shape.dataset.id,
    kind = shape.dataset.action;
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    const actions = {
      node: "delete-node",
      cause: "delete-cause",
      factor: "delete-factor",
      "kj-group": "delete-group",
      "kj-card": "delete-card",
      "kj-relation": "delete-relation",
      "kj-parent": "unlink-parent",
      "map-root": "clear-map",
      "fish-root": "clear-fish",
    };
    await action({ dataset: { action: actions[kind], id } });
    $(".mindmap-scroll,.fishbone-scroll,.kj-diagram-scroll")?.focus();
  } else if (
    kind === "node" &&
    (event.key === "Insert" || (event.key === "Enter" && event.shiftKey))
  ) {
    event.preventDefault();
    await action({
      dataset: { action: event.shiftKey ? "add-sibling" : "add-child", id },
    });
  } else if (event.key === "Enter" || event.key === "F2") {
    event.preventDefault();
    if (kind === "node") {
      selectedNode = id;
      render();
      $(`[data-bind="nodes.${id}.text"]`)?.focus();
    } else {
      await action(shape);
      const path =
        kind === "cause"
          ? `causes.${id}.text`
          : kind === "factor"
            ? `factors.${id}.title`
            : kind === "kj-group"
              ? `groups.${id}.title`
              : kind === "kj-relation"
                ? `relations.${id}.text`
                : kind === "kj-parent"
                  ? `groups.${id}.title`
                  : kind === "map-root" || kind === "fish-root"
                    ? "problem.title"
                    : `cards.${id}.text`;
      $(`[data-bind="${path}"]`)?.focus();
    }
  }
});
let dragged = "";
$("#stage").addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-card]");
  if (!card) return;
  dragged = card.dataset.card;
  event.dataTransfer.setData("text/plain", dragged);
  event.dataTransfer.effectAllowed = "move";
});
$("#stage").addEventListener("dragover", (event) => {
  const group = event.target.closest("[data-drop-group]");
  if (group && dragged) {
    event.preventDefault();
    group.classList.add("drag-over");
  }
});
$("#stage").addEventListener("dragleave", (event) =>
  event.target.closest("[data-drop-group]")?.classList.remove("drag-over"),
);
$("#stage").addEventListener("drop", (event) => {
  const group = event.target.closest("[data-drop-group]");
  const card = state.cards.find((c) => c.id === dragged);
  if (!group || !card) return;
  event.preventDefault();
  mutationBefore = structuredClone(state);
  card.group = group.dataset.dropGroup;
  dragged = "";
  changed();
  render();
  notify(
    "カードを移動しました。まとまりに名前を付けて、見えてきたことを言葉にしましょう。",
  );
});
$("#stage").addEventListener("dragend", () => {
  dragged = "";
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
});
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 2_000_000)
      throw Error("ファイルが大きすぎます（上限2MB）。");
    const imported = parseWorkbook(await file.text());
    if (
      !(await confirmInApp(
        `${imported.mode === "preset" ? "プリセット" : "自由作成"}の保存内容を、このファイルの内容で置き換えます。続けますか？`,
      ))
    )
      return;
    save();
    state = imported;
    cache.set(state.mode, state);
    unreadableModes.delete(state.mode);
    selectedNode = "";
    lastPresetChange = null;
    mutationBefore = null;
    selectedCause = "";
    selectedFactor = "";
    pickedCards.clear();
    save();
    render();
    notify("保存ファイルを読み込みました。続きから作業できます。");
  } catch (error) {
    notify(
      error instanceof SyntaxError
        ? "JSONを読み込めませんでした。現在の作業内容は保持しています。"
        : `${error.message} 現在の作業内容は保持しています。`,
    );
  }
});
render();
status(
  storageOK
    ? "このブラウザに自動保存 · JSONファイルでも保存・再開できます"
    : "自動保存できません · 「保存ファイル」を使ってください",
);
notify(startNotice);
