import {
  emptyGraph,
  flowDocument,
  clone,
  addNode,
  removeNode,
  connect,
  syntax,
  parts,
  displayNode,
} from "./graph.mjs";
import { FlowCanvas } from "./canvas.mjs";
import { FlowRunner } from "./runner.mjs";
import { installDocuments } from "./document-ui.mjs";
import { exampleDocument } from "./examples.mjs";
import {
  defaultInput,
  settingsEditor,
  validateSettings,
  validateInput,
  formatValue,
  validName,
} from "./studio.mjs";
import { createAutoplay } from "../../program-trace/autoplay.js";
import { bindStepKeys } from "../../program-trace/step-keys.js";
const $ = (id) => document.getElementById(id),
  message = (text, error = false) => {
    $("circuit-message").textContent = text;
    $("circuit-message").classList.toggle("is-error", error);
  };
let graph = exampleDocument("decision").graph,
  scope = "main",
  asts = new Map(),
  runner = null,
  documents,
  editing = null,
  readInputSettings = null,
  inputResume = false,
  errorState = "",
  past = [],
  future = [];
const guard = (fn) => {
  try {
    return fn();
  } catch (e) {
    message(e.message || "操作できませんでした。", true);
    return false;
  }
};
const autoplay = createAutoplay({ advance: () => advance() });
function pause() {
  autoplay.stop();
  updateRunControls();
}
function refreshSyntax() {
  try {
    asts = syntax(graph).asts;
  } catch {
    asts = new Map();
  }
}
function transaction(mutator) {
  const old = clone(graph),
    candidate = clone(graph);
  mutator(candidate);
  graph = flowDocument(candidate).graph;
  past.push(old);
  if (past.length > 60) past.shift();
  future = [];
  runner = null;
  errorState = "";
  pause();
  refreshSyntax();
  sync();
  documents?.edited();
}
function undo(redo = false) {
  const source = redo ? future : past,
    target = redo ? past : future;
  if (!source.length) return;
  canvas.cancel();
  canvas.selected = null;
  target.push(clone(graph));
  graph = source.pop();
  runner = null;
  pause();
  if (!graph.scopes.some((s) => s.id === scope)) scope = "main";
  refreshSyntax();
  sync();
  documents.edited();
}
function updateRunControls() {
  if (!$("run-actions")) return;
  $("previous-button").disabled = !runner?.history.length;
  $("next-button").disabled =
    !runner ||
    !!errorState ||
    (runner.state.completed && runner.state.currentLine === null);
  $("play-button").textContent = autoplay.running ? "一時停止" : "自動実行";
  $("play-button").setAttribute("aria-pressed", String(autoplay.running));
  $("play-button").disabled =
    !runner ||
    !!errorState ||
    (runner.state.completed && runner.state.currentLine === null);
}
const canvas = new FlowCanvas({
  stage: $("circuit-stage"),
  board: $("flow-board"),
  read: () => graph,
  scope: () => scope,
  asts: () => asts,
  run: () => runner,
  change: (fn) => guard(() => transaction(fn)),
  edit: (id) => openNode(id),
  add: (type, p, edgeId) =>
    guard(() => {
      if (type === "return" && scope === "main")
        throw Error("値を返す部品は、関数の図に置きます。");
      if (type === "call" && !graph.scopes.some((s) => s.id !== "main"))
        throw Error(
          "「関数＋」で関数を追加するか、関数の例を読み込んでください。",
        );
      let id;
      transaction((g) => {
        const edge = g.edges.find((e) => e.id === edgeId),
          n = addNode(
            g,
            type,
            scope,
            Math.round(p.x / 8) * 8,
            Math.round(p.y / 8) * 8,
          );
        id = n.id;
        if (type === "call") {
          const s = g.scopes.find((s) => s.id !== "main");
          n.code = `${s.name}(${s.parameters.map(() => 0).join(", ")})`;
        }
        if (edge && !["start", "end", "return"].includes(type)) {
          connect(g, edge.from, edge.port, n.id);
          if (type === "loopStart") connect(g, n.pair, 0, edge.to);
          else {
            connect(g, n.id, 0, edge.to);
            if (type === "decision") connect(g, n.id, 1, edge.to);
          }
        }
      });
      canvas.selected = { kind: "node", id };
      canvas.render();
      canvas.reveal(id);
      if (!["start", "end", "loopEnd"].includes(type)) openNode(id);
    }),
  message,
  undo,
});
function sync() {
  const select = $("flow-scope");
  select.replaceChildren();
  for (const s of graph.scopes) {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent =
      s.id === "main" ? "メイン" : `${s.name}(${s.parameters.join(", ")})`;
    select.append(o);
  }
  select.value = scope;
  $("index-base").value = String(graph.settings.indexBase);
  $("index-base").disabled = !!runner;
  $("add-function").disabled = !!runner;
  $("delete-function").hidden = scope === "main";
  $("delete-function").disabled = !!runner;
  $("edit-actions").hidden = !!runner;
  $("run-actions").hidden = !runner;
  $("flow-results").hidden = !runner;
  document
    .querySelector(".flowchart-lab")
    .classList.toggle("is-executing", !!runner);
  document.querySelector(".circuit-hint").textContent = runner
    ? "青い部品が現在の処理、点線の部品が次の処理です。"
    : "図記号はドラッグ・タップで追加。入口と出口をつなぎ、図記号を押して内容を編集します。";
  $("undo-circuit").disabled = !past.length;
  $("redo-circuit").disabled = !future.length;
  for (const b of document.querySelectorAll("[data-part]"))
    b.disabled =
      !!runner ||
      (b.dataset.part === "return" && scope === "main") ||
      (["start", "end"].includes(b.dataset.part) &&
        graph.nodes.some(
          (n) => n.scope === scope && n.type === b.dataset.part,
        ));
  canvas.render();
  renderRun();
}
function dialogError(id, e) {
  const p = $(id).querySelector(".document-error");
  p.textContent = e?.message ?? "";
  p.hidden = !e;
}
const helps = {
  process: "例：x = x + 1、Data = [3, 7, 12]。図では代入を ← で表示します。",
  input: "入力を受け取る変数名を指定します。例：数",
  output: '表示する値・式を指定します。例："合計は", 合計',
  decision:
    "条件式を指定します。例：点数 >= 60。はい／いいえの2つの出口があります。",
  loopStart:
    "範囲：i を 1 から 5 まで 1 ずつ増やしながら繰り返す：\n条件：i < 5 の間繰り返す：",
  connector: "同じ図の矢印を合流できます。印は2文字以内（例：A）。",
  call: "例：二倍(7)。戻り値を変数に入れる場合は処理の部品で 結果 = 二倍(7) とします。",
  return: "返す値・式を指定します。例：n * 2。空欄なら値を返さず戻ります。",
};
function openNode(id) {
  if (runner) return;
  const n = graph.nodes.find((n) => n.id === id);
  if (!n || ["start", "end", "loopEnd"].includes(n.type)) {
    if (n) {
      canvas.selected = { kind: "node", id };
      canvas.render();
    }
    return;
  }
  editing = id;
  $("node-heading").textContent = `${parts[n.type]} ${n.id.slice(1)} の内容`;
  $("node-code-label").textContent =
    n.type === "decision"
      ? "条件"
      : n.type === "input"
        ? "変数名"
        : n.type === "loopStart"
          ? "繰返しの指定"
          : "内容";
  $("node-code").value = n.code;
  $("node-note").value = n.note ?? "";
  $("node-help").textContent = helps[n.type] ?? "";
  $("input-spec-fields").hidden = n.type !== "input";
  readInputSettings =
    n.type === "input"
      ? settingsEditor(
          $("input-spec-fields"),
          [n.code],
          graph.settings.inputs,
          () => {},
        )
      : null;
  dialogError("node-dialog", null);
  $("node-dialog").showModal();
  $("node-code").focus();
}
$("node-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const candidate = clone(graph),
      n = candidate.nodes.find((n) => n.id === editing);
    n.code = $("node-code").value.trim();
    n.note = $("node-note").value.trim();
    if (/[\r\n]/.test(n.code))
      throw Error("1つの図記号には1行の内容を指定してください。");
    if (n.type === "input") {
      candidate.settings.inputs[n.code] = Object.values(readInputSettings())[0];
      candidate.settings = validateSettings(candidate.settings);
    }
    syntax(candidate);
    transaction((g) => Object.assign(g, candidate));
    $("node-dialog").close();
    editing = null;
  } catch (e) {
    dialogError("node-dialog", e);
  }
};
$("flow-scope").onchange = () => {
  scope = $("flow-scope").value;
  canvas.cancel();
  canvas.selected = null;
  sync();
  canvas.fit();
};
$("index-base").onchange = () =>
  guard(() =>
    transaction((g) => {
      g.settings.indexBase = +$("index-base").value;
    }),
  );
$("add-function").onclick = () => {
  $("function-name").value = "";
  $("function-args").value = "";
  dialogError("function-dialog", null);
  $("function-dialog").showModal();
};
$("function-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const name = $("function-name").value.trim(),
      parameters = $("function-args").value.trim()
        ? $("function-args")
            .value.split(/[,、，]/)
            .map((v) => v.trim())
        : [];
    if (
      !validName(name) ||
      parameters.some((p) => !validName(p)) ||
      new Set(parameters).size !== parameters.length
    )
      throw Error("関数名・引数は文字で始まる、重複しない名前にしてください。");
    let added;
    transaction((g) => {
      if (g.scopes.some((s) => s.id !== "main" && s.name === name))
        throw Error("同じ名前の関数があります。");
      added =
        "f" +
        (Math.max(
          0,
          ...g.scopes.filter((s) => s.id !== "main").map((s) => +s.id.slice(1)),
        ) +
          1);
      g.scopes.push({ id: added, name, parameters });
      const start = addNode(g, "start", added, 400, 80),
        end = addNode(g, "end", added, 400, 300);
      connect(g, start.id, 0, end.id);
      syntax(g);
    });
    scope = added;
    sync();
    canvas.fit();
    $("function-dialog").close();
  } catch (e) {
    dialogError("function-dialog", e);
  }
};
$("delete-function").onclick = () =>
  guard(() => {
    const s = graph.scopes.find((s) => s.id === scope);
    if (!s || s.id === "main") return;
    const id = scope;
    const candidate = clone(graph);
    candidate.scopes = candidate.scopes.filter((v) => v.id !== id);
    const ids = new Set(
      candidate.nodes.filter((n) => n.scope === id).map((n) => n.id),
    );
    candidate.nodes = candidate.nodes.filter((n) => !ids.has(n.id));
    candidate.edges = candidate.edges.filter(
      (e) => !ids.has(e.from) && !ids.has(e.to),
    );
    try {
      syntax(candidate);
    } catch {
      throw Error(
        "この関数を使う部品があります。先に呼び出しを変更または削除してください。",
      );
    }
    scope = "main";
    transaction((g) => Object.assign(g, candidate));
    canvas.fit();
  });
$("undo-circuit").onclick = () => undo();
$("redo-circuit").onclick = () => undo(true);
$("delete-selected").onclick = () =>
  guard(() => {
    if (!canvas.selected) return;
    const selected = canvas.selected;
    transaction((g) => {
      if (selected.kind === "edge")
        g.edges = g.edges.filter((e) => e.id !== selected.id);
      else removeNode(g, selected.id);
    });
    canvas.selected = null;
    canvas.pending = null;
    canvas.render();
  });
$("zoom-out-circuit").onclick = () => canvas.zoom(1 / 1.2);
$("zoom-in-circuit").onclick = () => canvas.zoom(1.2);
$("fit-circuit").onclick = () => canvas.fit();
function renderRun() {
  updateRunControls();
  if (!runner) {
    $("flow-step-count").textContent = "実行前";
    return;
  }
  const s = runner.state,
    n = graph.nodes.find((n) => n.id === runner.active);
  $("flow-step-count").textContent =
    `${s.steps} ステップ${s.completed ? " · 終了" : ""}`;
  $("current-node").textContent = n ? ` ${n.id.slice(1)}番` : "";
  $("detail-title").textContent = errorState
    ? "実行を停止しました"
    : (s.event?.title ?? "実行前");
  $("detail-explanation").textContent =
    errorState || s.event?.explanation || "「次へ」で開始から進みます。";
  $("condition-result").hidden = !s.event?.condition;
  $("condition-result").textContent = s.event?.condition
    ? `${s.event.condition.resolved} → ${s.event.condition.result ? "真（はい）" : "偽（いいえ）"}`
    : "";
  const next = s.pc === null ? null : graph.nodes[s.pc];
  $("next-node").textContent = next
    ? `次：${next.id.slice(1)}番 ${parts[next.type]}`
    : "";
  $("variable-scope").textContent = s.frames.at(-1)?.name
    ? `（${s.frames.at(-1).name} の中）`
    : "（メイン）";
  const rows = $("variable-rows");
  rows.replaceChildren();
  for (const [name, value] of Object.entries(s.variables)) {
    const row = document.createElement("tr"),
      changes = s.changes.filter((c) => c.name === name),
      read = s.reads.some((r) => r.name === name);
    row.className = changes.length ? "is-changed" : read ? "is-read" : "";
    for (const text of [
      name,
      formatValue(value, 160),
      changes
        .map(
          (c) =>
            `${c.before === undefined ? "未代入" : formatValue(c.before, 60)} → ${formatValue(c.after, 60)}`,
        )
        .join(" / "),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    }
    rows.append(row);
  }
  if (!rows.children.length) {
    const row = document.createElement("tr"),
      cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "まだ変数に値はありません。";
    row.append(cell);
    rows.append(row);
  }
  $("output-count").textContent = `${s.output.length}件`;
  $("output-full").disabled = !s.output.length;
  $("output-placeholder").hidden = !!s.output.length;
  $("output-lines").replaceChildren();
  $("output-lines").start = Math.max(1, s.output.length - 2);
  for (const text of s.output.slice(-3)) {
    const li = document.createElement("li");
    li.textContent = text;
    $("output-lines").append(li);
  }
}
function advance(input) {
  if (!runner || errorState) return false;
  try {
    if (runner.request && input === undefined) {
      inputResume = autoplay.running;
      autoplay.stop();
      const { name, spec } = runner.request;
      $("input-label").textContent = name;
      $("input-value").value = "";
      $("input-help").textContent =
        spec.kind === "number"
          ? `${spec.min}～${spec.max}の${spec.integer ? "整数" : "数値"}を入力します。`
          : spec.kind === "text"
            ? "文字列を入力します。"
            : spec.kind === "array"
              ? `JSON形式の配列（${spec.minLength}～${spec.maxLength}個）。例：[1, 2, 3]`
              : `JSON形式の${spec.rows}行・${spec.columns}列の配列。`;
      dialogError("input-dialog", null);
      $("input-dialog").showModal();
      updateRunControls();
      return false;
    }
    runner.next(input);
    if (runner.active) {
      const n = graph.nodes.find((n) => n.id === runner.active);
      if (scope !== n.scope) {
        scope = n.scope;
        sync();
        fitForRun();
      } else {
        canvas.render();
        renderRun();
      }
      canvas.reveal(n.id);
    } else {
      canvas.render();
      renderRun();
    }
    return !(runner.state.completed && runner.state.currentLine === null);
  } catch (e) {
    errorState = e.message;
    autoplay.stop();
    renderRun();
    message(`実行を止めました：${e.message}`, true);
    return false;
  }
}
function fitForRun() {
  canvas.fit();
  if (
    runner &&
    $("circuit-stage").clientWidth < 600 &&
    canvas.camera.zoom < 0.7
  ) {
    canvas.camera.zoom = 0.7;
    canvas.reveal(runner.active ?? graph.nodes[runner.state.pc]?.id);
    canvas.updateCamera();
  }
}
$("prepare-run").onclick = () =>
  guard(() => {
    canvas.cancel();
    runner = new FlowRunner(
      graph,
      crypto.getRandomValues(new Uint32Array(1))[0],
    );
    scope = "main";
    errorState = "";
    sync();
    fitForRun();
    message("");
  });
$("next-button").onclick = () => advance();
$("previous-button").onclick = () => {
  pause();
  errorState = "";
  runner?.previous();
  if (runner?.active)
    scope = graph.nodes.find((n) => n.id === runner.active).scope;
  sync();
  if (runner?.active) canvas.reveal(runner.active);
};
$("reset-button").onclick = () => {
  pause();
  errorState = "";
  runner?.reset();
  scope = "main";
  sync();
  fitForRun();
  message("");
};
$("edit-button").onclick = () => {
  pause();
  runner = null;
  errorState = "";
  sync();
  message("");
};
$("play-button").onclick = () => {
  if (autoplay.running) pause();
  else autoplay.start();
  updateRunControls();
};
$("speed-input").onchange = () => {
  const ms = Math.round(Number($("speed-input").value) * 1000);
  if (ms < 1 || ms > 10000 || !autoplay.setInterval(ms)) {
    message(
      "間隔は0.001～10秒。0.1秒以上は0.1秒刻みで指定してください。",
      true,
    );
    $("speed-input").value = String(autoplay.interval / 1000);
  }
};
$("input-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const spec = runner.request.spec,
      raw = $("input-value").value;
    let input;
    if (spec.kind === "text") input = raw;
    else if (spec.kind === "number") {
      if (!raw.trim()) throw Error("値を入力してください。");
      input = Number(raw);
    } else {
      try {
        input = JSON.parse(raw);
      } catch {
        throw Error("配列をJSON形式で入力してください。");
      }
    }
    validateInput(input, spec);
    const resume = inputResume;
    inputResume = false;
    $("input-dialog").close();
    advance(input);
    if (resume && !errorState) autoplay.start({ immediate: false });
    updateRunControls();
  } catch (e) {
    dialogError("input-dialog", e);
  }
};
$("input-dialog").addEventListener("cancel", () => {
  inputResume = false;
});
$("output-full").onclick = () => {
  pause();
  $("all-outputs").replaceChildren();
  for (const text of runner?.state.output ?? []) {
    const li = document.createElement("li");
    li.textContent = text;
    $("all-outputs").append(li);
  }
  $("output-dialog").showModal();
};
bindStepKeys({
  isActive: () => !!runner,
  canAdvance: () =>
    !!runner &&
    !errorState &&
    !autoplay.running &&
    !(runner.state.completed && runner.state.currentLine === null),
  advance: () => advance(),
  nextButton: () => $("next-button"),
});
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
documents = installDocuments({
  read: () => graph,
  replace: (incoming) => {
    graph = incoming;
    runner = null;
    past = [];
    future = [];
    scope = "main";
    canvas.cancel();
    canvas.selected = null;
    refreshSyntax();
    sync();
    canvas.fit();
  },
  pause,
  message,
});
refreshSyntax();
sync();
canvas.fit();
documents.start();
