import {
  Machine,
  OPS,
  SIZE,
  defaults,
  copy,
  text,
  validateMemory,
  validateConfig,
  conditionKey,
} from "./model.mjs";
import { presets } from "./presets.mjs";
import { createMemoryFullscreen } from "./fullscreen.mjs";
import { createAutoplay } from "../../program-trace/autoplay.js";
import { bindStepKeys } from "../../program-trace/step-keys.js";
import { installSpeed } from "./speed.mjs";
import { installProgramDocuments } from "./document-ui.mjs";
import { createTransfers, transferSteps } from "./transfers.mjs";
import {
  field,
  selection,
} from "../../program-trace/studio/expression-editor.js?v=20261009-function-help3";
const $ = (id) => document.getElementById(id);
const el = (tag, value, className = "") => {
  const item = document.createElement(tag);
  if (value !== undefined) item.textContent = value;
  item.className = className;
  return item;
};
const button = (label, action, className = "") => {
  const b = el("button", label, className);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
};
const format = (n) => Number(n.toFixed(3)).toLocaleString("ja-JP");
const rate = (result) => {
  const s = result.stats;
  return result.config.enabled && s.hits + s.misses
    ? `${((s.hits / (s.hits + s.misses)) * 100).toFixed(1)}%`
    : "—";
};
const storageKey = "study-atlas-cpu-memory-v1";
let initial = copy(presets[0].memory),
  config = copy(defaults),
  name = presets[0].name,
  records = [],
  machine,
  running = false,
  selectedEvent = -1,
  revision = 0,
  comparing = false,
  runCount = 0;
const rows = [];
const transfers = createTransfers(document.querySelector(".memory-workspace"));
const autoplay = createAutoplay({
  advance: () => {
    tick();
    return running;
  },
});
let speedControls;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored?.version === 1) {
    validateMemory(stored.initial);
    validateConfig(stored.config);
    initial = stored.initial;
    config = stored.config;
    name = String(stored.name || "実験").slice(0, 60);
    records = (stored.records || []).slice(-12).filter((r) => {
      try {
        validateMemory(r.initial);
        validateConfig(r.config);
        return (
          r.stats &&
          [
            "cpu",
            "wait",
            "hits",
            "misses",
            "fetch",
            "read",
            "write",
            "ramReads",
            "ramWrites",
          ].every((k) => Number.isFinite(r.stats[k]) && r.stats[k] >= 0) &&
          Number.isSafeInteger(r.acc) &&
          Number.isInteger(r.steps) &&
          typeof r.name === "string"
        );
      } catch {
        return false;
      }
    });
  }
} catch {
  /* Start with a usable preset when saved data is unavailable. */
}
function announce(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
}
function persist() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, initial, config, name, records }),
    );
  } catch {
    announce(
      "ブラウザへの保存ができません。必要なプログラムはJSON保存で残してください。",
      true,
    );
  }
}
function stop() {
  autoplay.stop();
  running = false;
}
function reset(message = "初期RAMに戻し、CPUとキャッシュを初期化しました。") {
  stop();
  revision++;
  machine = new Machine(initial, config);
  selectedEvent = -1;
  runCount = 0;
  render();
  renderRecords();
  if (message) announce(message);
  persist();
}
function integer(value) {
  if (!value.trim() || !Number.isSafeInteger(Number(value)))
    throw new Error("値と番地には整数を入力してください。");
  return Number(value);
}
function readDraft() {
  const next = rows.map(({ kind, operand }) => ({
    op: kind.input.value,
    arg: kind.input.value === "halt" ? 0 : integer(operand.input.value),
  }));
  const nextConfig = {
    enabled: $("cache-enabled").checked,
    blocks: integer($("capacity").value),
    start: integer($("start").value),
    cacheTime: Number($("cache-time").value),
    ramTime: Number($("ram-time").value),
    cpuTime: Number($("cpu-time").value),
  };
  for (const id of ["cache-time", "ram-time", "cpu-time"])
    if (!$(id).value.trim())
      throw new Error("仮想アクセス時間を入力してください。");
  validateMemory(next);
  validateConfig(nextConfig);
  if (
    JSON.stringify(next) !== JSON.stringify(initial) ||
    JSON.stringify(nextConfig) !== JSON.stringify(config)
  ) {
    initial = next;
    config = nextConfig;
    reset("編集を反映し、実行状態とキャッシュを初期化しました。");
  }
  return true;
}
function guarded(action) {
  try {
    readDraft();
    action();
  } catch (error) {
    stop();
    render();
    announce(error.message, true);
  }
}
function renderInputs() {
  $("experiment-name").value = name;
  $("setup-name").textContent = name || "名前のないプログラム";
  $("start").value = config.start;
  $("capacity").value = config.blocks;
  $("cache-enabled").checked = config.enabled;
  for (const [id, key] of [
    ["cpu-time", "cpuTime"],
    ["cache-time", "cacheTime"],
    ["ram-time", "ramTime"],
  ])
    $(id).value = config[key];
  rows.length = 0;
  $("ram-rows").replaceChildren();
  initial.forEach((cell, address) => {
    const row = el("tr");
    row.dataset.address = address;
    const index = el("th", String(address).padStart(2, "0"));
    index.scope = "row";
    const kind = selection(
      `${address}番地の種類`,
      OPS.map(([op, label]) => [op, label]),
      cell.op,
    );
    kind.input.setAttribute("aria-label", `${address}番地の種類`);
    const operand = field(
      `${address}番地の値または対象番地`,
      String(cell.arg),
      "number",
    );
    operand.input.setAttribute(
      "aria-label",
      `${address}番地の値または対象番地`,
    );
    operand.input.step = "1";
    const kindCell = el("td"),
      operandCell = el("td"),
      live = el("td", "", "live-cell"),
      wrap = el("div", undefined, "operand-wrap");
    function updateOperand() {
      const noArg = kind.input.value === "halt",
        value = ["data", "set"].includes(kind.input.value);
      operand.input.disabled = noArg;
      operand.input.min = value ? String(Number.MIN_SAFE_INTEGER) : "0";
      operand.input.max = value
        ? String(Number.MAX_SAFE_INTEGER)
        : String(SIZE - 1);
    }
    kind.input.addEventListener("change", () => {
      updateOperand();
      guarded(() => {});
    });
    operand.input.addEventListener("input", () => {
      stop();
      renderControls();
    });
    operand.input.addEventListener("change", () => guarded(() => {}));
    kindCell.append(kind.input);
    wrap.append(operand.input);
    operandCell.append(wrap);
    row.append(index, kindCell, operandCell, live);
    $("ram-rows").append(row);
    rows.push({ row, kind, operand, live });
    updateOperand();
  });
}
function renderControls() {
  $("run").disabled = comparing || machine.halted || !!machine.error;
  $("run").setAttribute("aria-pressed", String(running));
  $("run").classList.toggle("is-running", running);
  $("play-label").textContent = running ? "一時停止" : "自動実行";
  $("play-icon").setAttribute(
    "d",
    running ? "M5 3h4v14H5zM12 3h4v14h-4z" : "m6 3 10 7-10 7Z",
  );
  $("step").disabled =
    running || comparing || machine.halted || !!machine.error;
  $("save-result").disabled = running || comparing || !machine.actions;
  $("compare-off").disabled = running || comparing;
  $("state").textContent = comparing
    ? "比較中"
    : running
      ? "実行中"
      : machine.error
        ? "エラー"
        : machine.halted
          ? "終了"
          : machine.actions
            ? "一時停止"
            : "実行前";
  $("state").classList.toggle("running", running);
  fullscreen.sync();
  $("cache-enabled").nextElementSibling.textContent = config.enabled
    ? "ON"
    : "OFF";
}
function renderCache(event) {
  const snapshot = event?.cache ?? machine.cache,
    sorted = [...snapshot].sort((a, b) => b.used - a.used);
  $("cache-caption").textContent = !config.enabled
    ? "OFF · RAMへ直接アクセス"
    : event
      ? selectedEvent >= 0
        ? `選択したアクセスの記録`
        : `現在の段階 · 新しい参照順`
      : "最新の状態 · 新しい参照順";
  $("cache-lines").replaceChildren();
  for (let i = 0; i < config.blocks; i++) {
    const line = sorted[i];
    if (!line) {
      $("cache-lines").append(el("div", "空きブロック", "cache-empty"));
      continue;
    }
    const card = el(
        "article",
        undefined,
        `cache-line${line.base === event?.base ? " active" : ""}`,
      ),
      header = el("header");
    card.dataset.base = line.base;
    header.append(
      el("span", `${line.base}・${line.base + 1} 番地`),
      el(
        "span",
        i === 0
          ? "最新"
          : i === sorted.length - 1 && sorted.length === config.blocks
            ? "LRU：次の置換候補"
            : `参照順 ${i + 1}`,
      ),
    );
    const cells = el("div", undefined, "cache-cells");
    line.cells.forEach((cell, j) => {
      const content = el("div", undefined, "cache-cell");
      content.dataset.address = line.base + j;
      content.append(
        el("small", `${line.base + j}番地`),
        el("span", text(cell)),
      );
      cells.append(content);
    });
    card.append(header, cells);
    $("cache-lines").append(card);
  }
  if (!config.enabled)
    $("cache-lines").replaceChildren(
      el("div", "キャッシュを使いません", "cache-empty"),
    );
}
function render() {
  renderControls();
  $("acc").textContent = format(machine.acc);
  $("pc").textContent = machine.halted ? "—" : machine.pc;
  $("current-address").textContent =
    machine.currentAddress === null ? "" : `（${machine.currentAddress}番地）`;
  $("current-command").textContent = machine.current
    ? text(machine.current)
    : "—";
  $("steps").textContent = machine.steps;
  $("phase-kind").textContent = machine.phase
    ? `動作 ${machine.actions} · ${{ lookup: "参照先を確認", "ram-request": "参照先を確認", "block-fill": "ブロック取得", "cpu-receive": "CPUへ取込", decode: "命令を実行", "cache-write": "キャッシュへ書込", "ram-write": "RAMへ書込", complete: "命令完了", error: "エラー" }[machine.phase.stage]}`
    : "実行前";
  $("phase-title").textContent = machine.phase?.title ?? "「次へ」で命令を取得";
  $("phase-detail").textContent =
    machine.phase?.detail ?? "命令の取得から計算まで、1つの動作ずつ進みます。";
  $("received-field").hidden = !machine.received;
  $("received-value").textContent = machine.received
    ? text(machine.received)
    : "—";
  const e = machine.events[selectedEvent] ?? machine.events.at(-1);
  rows.forEach(({ row, live }, address) => {
    live.textContent = text(machine.ram[address]);
    row.classList.toggle(
      "next",
      !machine.halted && !machine.error && address === machine.pc,
    );
    row.classList.toggle(
      "current",
      address === machine.currentAddress && !!machine.current,
    );
    const transfer = machine.phase?.transfer,
      usesRam = transfer && (transfer.from === "ram" || transfer.to === "ram");
    const addressed =
      usesRam &&
      (transfer.block
        ? address === transfer.base || address === transfer.base + 1
        : address === transfer.address);
    row.classList.toggle("accessed", !!addressed);
    row.classList.toggle("write-target", !!addressed && transfer.to === "ram");
    row.classList.toggle(
      "requested",
      !transfer &&
        machine.phase?.focus?.device === "ram" &&
        machine.phase.focus.address === address,
    );
    row.classList.toggle(
      "written",
      machine.ram[address].op === "data" &&
        JSON.stringify(machine.ram[address]) !==
          JSON.stringify(initial[address]),
    );
  });
  renderCache(selectedEvent >= 0 ? e : machine.phase?.event);
  $("access-events").replaceChildren();
  if (!machine.events.length) {
    const p = el(
      "p",
      "「次へ」を押して、最初の命令を取得しよう。",
      "empty-note",
    );
    $("access-events").append(p);
  }
  machine.events.forEach((event, i) => {
    const b = button(
      "",
      () => {
        selectedEvent = i;
        render();
        if (event.hit === null || !event.hit) revealRam(event.address);
        transfers.draw();
      },
      "access-event",
    );
    b.setAttribute("aria-pressed", String(event === e));
    b.append(
      el(
        "span",
        `${{ fetch: "命令取得", read: "データ読出", write: "データ書込" }[event.kind]} · ${event.address}番地`,
      ),
      el(
        "b",
        event.hit === null ? "直接" : event.hit ? "HIT" : "MISS",
        event.hit === false ? "miss" : "",
      ),
      el("small", `${format(event.cost)} ns`),
    );
    $("access-events").append(b);
  });
  $("access-reason").replaceChildren();
  if (e) {
    const flow = el("ol", undefined, "transfer-steps");
    transferSteps(
      selectedEvent >= 0 && e.complete
        ? e
        : { ...e, phaseTransfer: machine.phase?.transfer ?? null },
    ).forEach((step) => flow.append(el("li", step.label, `flow-${step.kind}`)));
    $("access-reason").append(flow, el("p", e.reason));
  }
  transfers.update(
    e
      ? selectedEvent >= 0 && e.complete
        ? e
        : { ...e, phaseTransfer: machine.phase?.transfer ?? null }
      : null,
  );
  const s = machine.stats,
    total = s.cpu + s.wait;
  $("total-time").replaceChildren(
    document.createTextNode(format(total)),
    el("small", "ns"),
  );
  $("cpu-metric").textContent = format(s.cpu);
  $("wait-metric").textContent = format(s.wait);
  $("hit-rate").textContent = rate(machine);
  $("access-count").textContent = s.fetch + s.read + s.write;
  $("cpu-track").style.width = `${total ? (s.cpu / total) * 100 : 0}%`;
  $("wait-track").style.width = `${total ? (s.wait / total) * 100 : 0}%`;
  $("access-summary").textContent =
    `命令取得 ${s.fetch} · 読出 ${s.read} · 書込 ${s.write}　 /　ヒット ${s.hits} · ミス ${s.misses}　 /　RAM転送 ${s.ramReads + s.ramWrites}（取得 ${s.ramReads}・書込 ${s.ramWrites}）`;
}
function revealIn(list, target, header = 0) {
  if (!list || !target) return;
  const bounds = list.getBoundingClientRect(),
    r = target.getBoundingClientRect();
  if (!bounds.height) return;
  if (r.top < bounds.top + header || r.bottom > bounds.bottom)
    list.scrollTop +=
      (r.top + r.bottom) / 2 - (bounds.top + header + bounds.bottom) / 2;
}
function revealRam(address) {
  const list = document.querySelector(".ram-scroll");
  revealIn(
    list,
    rows[address]?.row,
    list?.querySelector("thead").getBoundingClientRect().height ?? 0,
  );
}
function focusPhase() {
  const focus = machine.phase?.focus;
  if (!focus) return;
  if (focus.device === "ram") revealRam(focus.address);
  if (focus.device === "cache") {
    const block = document.querySelector(
      `.cache-line[data-base="${Math.floor(focus.address / 2) * 2}"]`,
    );
    revealIn($("cache-lines"), block);
    if (fullscreen.active)
      revealIn(document.querySelector(".cache-panel"), block, 38);
  }
  const t = machine.phase?.transfer;
  if (t) {
    if (t.from === "ram" || t.to === "ram") revealRam(t.address);
    if (t.from === "cache" || t.to === "cache") {
      const card = document.querySelector(`.cache-line[data-base="${t.base}"]`);
      revealIn($("cache-lines"), card);
      if (fullscreen.active)
        revealIn(document.querySelector(".cache-panel"), card, 38);
    }
    if (fullscreen.active && (t.to === "cpu" || t.from === "cpu"))
      revealIn(
        document.querySelector(".cpu-panel"),
        t.to === "cpu"
          ? t.kind === "fetch"
            ? $("current-command")
            : $("received-value")
          : document.querySelector(".cpu-value"),
        38,
      );
  } else if (focus.device === "cpu" && fullscreen.active)
    revealIn(document.querySelector(".cpu-panel"), $("phase-title"), 38);
  transfers.draw();
}
const fullscreen = createMemoryFullscreen({
  surface: $("memory-lab"),
  button: $("memory-fullscreen"),
  closeSpeed: () => speedControls?.close(),
  speedPanel: $("speed-panel"),
  onChange: () => {
    if (machine) focusPhase();
    transfers.draw();
  },
});
function execute() {
  machine.advance();
  selectedEvent = -1;
  render();
  focusPhase();
  if (machine.error) {
    stop();
    announce(machine.error, true);
    renderControls();
  } else if (machine.halted) {
    stop();
    announce(
      `終了しました。計算中の値は ${format(machine.acc)}、合計時間は ${format(machine.stats.cpu + machine.stats.wait)} ns です。`,
    );
    renderControls();
  } else announce(`${machine.phase.title}。${machine.phase.detail}`);
}
function tick() {
  if (!running) return;
  const before = machine.steps;
  execute();
  runCount += machine.steps - before;
  if (runCount >= 10000 && running) {
    stop();
    announce(
      "10,000命令に達したため一時停止しました。分岐先を確認するか、自動実行で続けられます。",
    );
    renderControls();
  }
}
$("run").addEventListener("click", () => {
  if (running) {
    stop();
    renderControls();
    announce("一時停止しました。同じ状態から続けられます。");
    return;
  }
  guarded(() => {
    if (machine.halted || machine.error) return;
    running = true;
    runCount = 0;
    autoplay.start();
  });
});
$("step").addEventListener("click", () => guarded(execute));
bindStepKeys({
  isActive: () => true,
  canAdvance: () => !$("step").disabled,
  advance: () => $("step").click(),
  nextButton: () =>
    fullscreen.active
      ? document.querySelector('[data-control="next"]')
      : $("step"),
});
speedControls = installSpeed({
  autoplay,
  changed: () => {
    if (machine) renderControls();
  },
});
$("reset").addEventListener("click", () => guarded(() => reset()));
for (const id of [
  "start",
  "cache-enabled",
  "capacity",
  "cpu-time",
  "ram-time",
  "cache-time",
]) {
  $(id).addEventListener("input", () => {
    stop();
    renderControls();
  });
  $(id).addEventListener("change", () => guarded(() => {}));
}
$("experiment-name").addEventListener("input", () => {
  name = $("experiment-name").value;
  $("setup-name").textContent = name || "名前のないプログラム";
  persist();
});
$("help-toggle").addEventListener("click", () => {
  const open = $("lab-guide").hidden;
  $("lab-guide").hidden = !open;
  $("help-toggle").setAttribute("aria-expanded", String(open));
});
OPS.filter(([op]) => op !== "data").forEach(([, title, description]) => {
  const node = el("div");
  node.append(el("strong", title), el("small", description));
  $("instruction-guide").append(node);
});
function addRecord(result, label = name) {
  records.push({ ...copy(result), name: label.slice(0, 80), date: Date.now() });
  records = records.slice(-12);
  persist();
  renderRecords();
}
function renderRecords() {
  $("record-count").textContent = `${records.length}件`;
  const conditions = [];
  $("result-rows").replaceChildren();
  $("comparison-empty").hidden = !!records.length;
  records.forEach((result, index) => {
    const key = conditionKey(result.initial, result.config.start);
    if (!conditions.includes(key)) conditions.push(key);
    const same = key === conditionKey(initial, config.start),
      tr = el("tr"),
      title = el("td"),
      c = result.config,
      s = result.stats;
    title.append(
      el("strong", result.name),
      el(
        "small",
        `条件 ${String.fromCharCode(65 + conditions.indexOf(key))} · ${same ? "現在と同じ初期RAM" : "現在とは異なる初期RAM"}`,
        same ? "" : "different",
      ),
    );
    const status = result.error
      ? "エラー"
      : result.halted
        ? "終了"
        : result.inProgress
          ? "命令の途中"
          : "途中";
    tr.append(
      title,
      el("td", c.enabled ? `ON · ${c.blocks}個` : "OFF"),
      el("td", `${format(result.acc)} / ${result.steps}命令（${status}）`),
      el("td", `${format(s.cpu + s.wait)} ns`),
      el("td", `${format(s.cpu)} / ${format(s.wait)}`),
      el("td", rate(result)),
      el("td", `${s.fetch + s.read + s.write} / ${s.ramReads + s.ramWrites}`),
    );
    const actions = el("td"),
      restore = button("条件を復元", () => {
        initial = copy(result.initial);
        config = copy(result.config);
        name = result.name;
        renderInputs();
        reset(
          "記録の初期RAM・設定を復元しました。空のキャッシュから再実行できます。",
        );
        $("preset-hint").textContent = "保存した条件を復元しています。";
        renderRecords();
      });
    const details = el(
      "small",
      `CPU ${format(c.cpuTime)} / cache ${format(c.cacheTime)} / RAM ${format(c.ramTime)} ns`,
    );
    title.append(details);
    const remove = button("×", () => {
      records.splice(index, 1);
      persist();
      renderRecords();
    });
    remove.setAttribute("aria-label", `記録${index + 1}を削除`);
    actions.append(restore, remove);
    tr.append(actions);
    $("result-rows").append(tr);
  });
}
$("save-result").addEventListener("click", () => {
  addRecord(machine.result());
  announce("結果と初期条件を保存しました。設定を変えて比べてみよう。");
});
$("clear-results").addEventListener("click", () => {
  records = [];
  persist();
  renderRecords();
  announce("比較の記録を消しました。");
});
$("compare-off").addEventListener("click", () =>
  guarded(async () => {
    comparing = true;
    renderControls();
    const rev = revision,
      source = copy(initial),
      settings = copy(config),
      title = name;
    announce("同じ初期RAMから、キャッシュON / OFFを比較しています。");
    const results = [];
    try {
      for (const enabled of [true, false]) {
        const simulation = new Machine(source, { ...settings, enabled });
        for (
          let n = 0;
          n < 10000 && !simulation.halted && !simulation.error;
          n++
        ) {
          simulation.step();
          if (n % 250 === 249) {
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (revision !== rev)
              throw new Error("条件が変更されたため比較を中止しました。");
          }
        }
        if (simulation.error) throw new Error(simulation.error);
        if (!simulation.halted)
          throw new Error(
            "10,000命令以内に終了しませんでした。終了命令と分岐先を確認してください。",
          );
        results.push(simulation.result());
      }
      if (revision !== rev)
        throw new Error("条件が変更されたため比較を中止しました。");
      results.forEach((r) =>
        addRecord(r, `${title} · ${r.config.enabled ? "ON" : "OFF"}`),
      );
      const a = results[0].stats,
        b = results[1].stats,
        delta = b.cpu + b.wait - a.cpu - a.wait;
      announce(
        `同じ初期条件で比較しました。${delta >= 0 ? "ON" : "OFF"}の方が ${format(Math.abs(delta))} ns 短くなりました。`,
      );
    } catch (error) {
      announce(error.message, true);
    } finally {
      comparing = false;
      renderControls();
    }
  }),
);
installProgramDocuments({
  read: () => {
    readDraft();
    return { version: 1, name, initial: copy(initial), config: copy(config) };
  },
  settings: () => copy(config),
  pause: () => {
    stop();
    renderControls();
  },
  message: announce,
  replace: (doc) => {
    initial = copy(doc.initial);
    config = copy(doc.config);
    name = doc.name;
    renderInputs();
    reset("プログラムを読み込み、CPUとキャッシュを初期化しました。");
    $("preset-hint").textContent =
      presets.find((p) => JSON.stringify(p.memory) === JSON.stringify(initial))
        ?.hint ?? "読み込んだプログラムを実験できます。";
  },
});
window.addEventListener("pagehide", () => {
  stop();
  persist();
});
renderInputs();
machine = new Machine(initial, config);
render();
renderRecords();
speedControls.sync();
$("preset-hint").textContent =
  presets.find((p) => JSON.stringify(p.memory) === JSON.stringify(initial))
    ?.hint ??
  "保存したプログラムを復元しました。命令と値を自由に変更できます。";
