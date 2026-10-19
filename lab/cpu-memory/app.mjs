import {
  Machine,
  OPS,
  defaults,
  copy,
  text,
  validateMemory,
  validateConfig,
  conditionKey,
  timeBreakdown,
} from "./model.mjs";
import { presets } from "./presets.mjs";
import { createMemoryFullscreen } from "./fullscreen.mjs";
import { createAutoplay } from "../../program-trace/autoplay.js";
import { bindStepKeys } from "../../program-trace/step-keys.js";
import { installSpeed } from "./speed.mjs";
import { installProgramDocuments } from "./document-ui.mjs";
import { createTransfers, transferSteps } from "./transfers.mjs";
import { createRamEditor } from "./ram-editor.mjs";
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
const fixedConfig = (value) => ({ ...copy(value), start: 0 });
const storageKey = "study-atlas-cpu-memory-v1";
let initial = copy(presets[0].memory),
  config = copy(defaults),
  name = presets[0].name,
  records = [],
  machine,
  running = false,
  selectedEvent = -1,
  completedSaved = false,
  runCount = 0;
const rows = [];
const ramEditor = createRamEditor({
  apply(address, cell) {
    if (JSON.stringify(initial[address]) === JSON.stringify(cell)) return;
    initial[address] = copy(cell);
    reset(
      `${address}番地の編集を反映し、実行状態とキャッシュを初期化しました。`,
    );
  },
});
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
    config = fixedConfig(stored.config);
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
          ["cache", "ram"].every(
            (k) =>
              r.stats[k] === undefined ||
              (Number.isFinite(r.stats[k]) && r.stats[k] >= 0),
          ) &&
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
    return true;
  } catch {
    announce(
      "ブラウザへの保存ができません。必要なプログラムはJSON保存で残してください。",
      true,
    );
    return false;
  }
}
function stop() {
  autoplay.stop();
  running = false;
}
function reset(message = "初期RAMに戻し、CPUとキャッシュを初期化しました。") {
  stop();
  machine = new Machine(initial, config);
  completedSaved = false;
  selectedEvent = -1;
  runCount = 0;
  render();
  focusPhase();
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
  const nextConfig = {
    enabled: $("cache-enabled").checked,
    blocks: integer($("capacity").value),
    start: 0,
    cacheTime: Number($("cache-time").value),
    ramTime: Number($("ram-time").value),
    cpuTime: Number($("cpu-time").value),
  };
  for (const id of ["cache-time", "ram-time", "cpu-time"])
    if (!$(id).value.trim())
      throw new Error("仮想アクセス時間を入力してください。");
  validateConfig(nextConfig);
  if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
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
    const live = el("td", "", "live-cell"),
      edit = button(text(cell), () => {}, "ram-row-edit");
    live.append(edit);
    row.append(index, live);
    row.addEventListener("click", () => {
      stop();
      renderControls();
      ramEditor.open(address, initial[address], machine.ram[address], edit);
    });
    $("ram-rows").append(row);
    rows.push({ row, live, edit });
  });
}
function renderControls() {
  $("run").disabled = machine.halted || !!machine.error;
  $("run").setAttribute("aria-pressed", String(running));
  $("run").classList.toggle("is-running", running);
  $("play-label").textContent = running ? "一時停止" : "自動実行";
  $("play-icon").setAttribute(
    "d",
    running ? "M5 3h4v14H5zM12 3h4v14h-4z" : "m6 3 10 7-10 7Z",
  );
  $("step").disabled = running || machine.halted || !!machine.error;
  $("previous").disabled = !machine.actions;
  $("save-result").disabled = running || machine.halted || !machine.actions;
  $("state").textContent = running
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
    machine.currentAddress === null
      ? "（—番地）"
      : `（${machine.currentAddress}番地）`;
  $("current-command").textContent = machine.current
    ? text(machine.current)
    : "—";
  $("current-command").classList.toggle(
    "is-executing",
    machine.phase?.stage === "decode",
  );
  $("steps").textContent = machine.steps;
  $("received-value").textContent = machine.received
    ? text(machine.received)
    : "—";
  const e = machine.events[selectedEvent] ?? machine.events.at(-1);
  const targetAddress = ramTarget();
  rows.forEach(({ row, edit }, address) => {
    edit.textContent = text(machine.ram[address]);
    edit.setAttribute(
      "aria-label",
      `${address}番地、${edit.textContent}、初期内容を編集`,
    );
    row.classList.toggle(
      "next",
      !machine.halted && !machine.error && address === machine.pc,
    );
    row.classList.toggle("targeted", address === targetAddress);
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
    row.classList.toggle(
      "write-target",
      !!addressed && transfer.to === "ram" && !transfer.request,
    );
    row.classList.toggle(
      "requested",
      !!transfer?.request &&
        transfer.to === "ram" &&
        transfer.address === address,
    );
    row.classList.toggle(
      "written",
      machine.ram[address].op === "data" &&
        JSON.stringify(machine.ram[address]) !==
          JSON.stringify(initial[address]),
    );
  });
  renderCache(selectedEvent >= 0 ? e : machine.phase?.event);
  const activeEvent = selectedEvent >= 0 ? e : machine.phase?.event;
  const request = $("cache-request");
  request.replaceChildren();
  if (config.enabled && activeEvent) {
    request.append(
      document.createTextNode(
        `${activeEvent.address}番地 · ${{ fetch: "命令取得", read: "データ読出", write: "データ書込" }[activeEvent.kind]} · `,
      ),
      el(
        "strong",
        activeEvent.hit === undefined
          ? "判定前"
          : activeEvent.hit
            ? "ヒット"
            : "ミス",
        `cache-outcome${activeEvent.hit === undefined ? "" : activeEvent.hit ? " is-hit" : " is-miss"}`,
      ),
    );
  } else
    request.textContent = config.enabled
      ? "CPUからの要求待ち"
      : "OFF · RAMへ直接要求";
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
        revealRam(event.address);
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
        event.hit === undefined
          ? "要求"
          : event.hit === null
            ? "直接"
            : event.hit
              ? "HIT"
              : "MISS",
        event.hit === false ? "miss" : "",
      ),
      el("small", `${format(event.cost)} ns`),
    );
    $("access-events").append(b);
  });
  $("access-reason").replaceChildren();
  const displayedAccess = e
    ? selectedEvent >= 0 && e.complete
      ? e
      : {
          ...e,
          phaseStage: machine.phase?.stage,
          phaseTransfer: machine.phase?.transfer ?? null,
        }
    : null;
  if (e) {
    const flow = el("ol", undefined, "transfer-steps");
    transferSteps(displayedAccess).forEach((step) =>
      flow.append(
        el("li", step.label, step.request ? "flow-request" : "flow-value"),
      ),
    );
    $("access-reason").append(flow, el("p", e.reason));
  }
  transfers.update(displayedAccess);
  const s = machine.stats,
    total = s.cpu + s.wait,
    times = timeBreakdown(machine);
  $("total-time").replaceChildren(
    document.createTextNode(format(total)),
    el("small", "ns"),
  );
  $("cpu-metric").textContent = format(s.cpu);
  $("wait-metric").textContent = format(s.wait);
  $("hit-rate").textContent = rate(machine);
  $("access-count").textContent = s.fetch + s.read + s.write;
  for (const part of ["cpu", "cache", "ram"]) {
    $(`${part}-track`).style.width =
      `${total ? (times[part] / total) * 100 : 0}%`;
    $(`${part}-legend-value`).textContent = `${format(times[part])} ns`;
  }
  $("time-track").setAttribute(
    "aria-label",
    `時間の内訳：CPU処理 ${format(times.cpu)} ns、キャッシュ参照 ${format(times.cache)} ns、RAM転送 ${format(times.ram)} ns。合計 ${format(total)} ns。`,
  );
  $("access-summary").textContent =
    `命令取得 ${s.fetch} · 読出 ${s.read} · 書込 ${s.write}　 /　ヒット ${s.hits} · ミス ${s.misses}　 /　RAM転送 ${s.ramReads + s.ramWrites}（取得 ${s.ramReads}・書込 ${s.ramWrites}）`;
}
function revealIn(list, target, header = 0) {
  if (!list || !target) return;
  const bounds = list.getBoundingClientRect(),
    r = target.getBoundingClientRect();
  if (!bounds.height) return;
  if (r.top < bounds.top + header || r.bottom > bounds.bottom)
    list.scrollTop = Math.max(
      0,
      list.scrollTop +
        (r.top + r.bottom) / 2 -
        (bounds.top + header + bounds.bottom) / 2,
    );
}
function ramTarget() {
  const selected = machine.events[selectedEvent];
  if (selected) return selected.address;
  if (machine.phase?.event) return machine.phase.event.address;
  if (machine.phase?.stage === "complete" && !machine.halted && !machine.error)
    return machine.pc;
  return machine.currentAddress ?? machine.pc;
}
function revealRam(address) {
  const list = document.querySelector(".ram-scroll");
  revealIn(
    list,
    rows[address]?.row,
    list?.querySelector("thead").getBoundingClientRect().height ?? 0,
  );
  const row = rows[address]?.row,
    bounds = row?.getBoundingClientRect();
  if (bounds?.height && (bounds.top < 0 || bounds.bottom > window.innerHeight))
    row.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
}
function focusPhase() {
  revealRam(ramTarget());
  const focus = machine.phase?.focus;
  if (!focus) {
    transfers.draw();
    return;
  }
  if (focus.device === "ram") revealRam(focus.address);
  if (focus.device === "cache") {
    const block =
      machine.phase.stage === "lookup"
        ? document.querySelector(".cache-request-panel")
        : document.querySelector(
            `.cache-line[data-base="${Math.floor(focus.address / 2) * 2}"]`,
          );
    if (machine.phase.stage !== "lookup") revealIn($("cache-lines"), block);
    if (fullscreen.active)
      revealIn(document.querySelector(".cache-panel"), block, 38);
  }
  const t = transferSteps({
    ...machine.phase?.event,
    phaseStage: machine.phase?.stage,
    phaseTransfer: machine.phase?.transfer ?? null,
  })[0];
  if (t) {
    if (t.from === "ram" || t.to === "ram") revealRam(t.address);
    if (t.from === "cache" || t.to === "cache") {
      const card = t.request
        ? document.querySelector(".cache-request-panel")
        : document.querySelector(`.cache-line[data-base="${t.base}"]`);
      if (!t.request) revealIn($("cache-lines"), card);
      if (fullscreen.active)
        revealIn(document.querySelector(".cache-panel"), card, 38);
    }
    if (fullscreen.active && (t.to === "cpu" || t.from === "cpu"))
      revealIn(
        document.querySelector(".cpu-panel"),
        t.request
          ? t.kind === "fetch"
            ? $("pc")
            : $("current-command")
          : t.to === "cpu"
            ? t.kind === "fetch"
              ? $("current-command")
              : $("received-value")
            : document.querySelector(".cpu-value"),
        38,
      );
  } else if (focus.device === "cpu" && fullscreen.active)
    revealIn(
      document.querySelector(".cpu-panel"),
      machine.phase.stage === "complete"
        ? document.querySelector(".cpu-value")
        : $("current-command"),
      38,
    );
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
    const finished = `終了しました。計算中の値は ${format(machine.acc)}、合計時間は ${format(machine.stats.cpu + machine.stats.wait)} ns です。`;
    let saved;
    if (!completedSaved) {
      completedSaved = true;
      saved = addRecord(machine.result());
    }
    announce(
      finished +
        (saved === true
          ? "結果と初期条件を自動保存しました。"
          : saved === false
            ? "結果はこの画面に記録しましたが、ブラウザに保存できませんでした。"
            : ""),
      saved === false,
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
$("previous").addEventListener("click", () => {
  stop();
  machine = machine.back();
  selectedEvent = -1;
  runCount = 0;
  render();
  focusPhase();
  announce(
    machine.phase
      ? `一つ戻りました。${machine.phase.title}`
      : "実行前に戻りました。",
  );
});
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
  const saved = persist();
  renderRecords();
  return saved;
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
      s = result.stats,
      times = timeBreakdown(result);
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
      el(
        "td",
        `${format(times.cpu)} / ${format(times.cache)} / ${format(times.ram)}`,
      ),
      el("td", rate(result)),
      el("td", `${s.fetch + s.read + s.write} / ${s.ramReads + s.ramWrites}`),
    );
    const actions = el("td"),
      restore = button("条件を復元", () => {
        initial = copy(result.initial);
        config = fixedConfig(result.config);
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
  const saved = addRecord(machine.result());
  announce(
    saved
      ? "途中の結果と初期条件を保存しました。"
      : "結果はこの画面に記録しましたが、ブラウザに保存できませんでした。",
    !saved,
  );
});
$("clear-results").addEventListener("click", () => {
  records = [];
  persist();
  renderRecords();
  announce("比較の記録を消しました。");
});
const programDocuments = installProgramDocuments({
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
    config = fixedConfig(doc.config);
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
programDocuments.receiveLocation();
