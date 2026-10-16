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
  timer,
  selectedEvent = -1,
  revision = 0,
  comparing = false,
  runCount = 0;
const rows = [];
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
  clearTimeout(timer);
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
  $("run").replaceChildren(
    el("span", running ? "Ⅱ" : "▶"),
    document.createTextNode(running ? " 一時停止" : " 自動実行"),
  );
  $("run").firstElementChild.setAttribute("aria-hidden", "true");
  $("step").disabled =
    running || comparing || machine.halted || !!machine.error;
  $("save-result").disabled = running || comparing || !machine.steps;
  $("compare-off").disabled = running || comparing;
  $("state").textContent = comparing
    ? "比較中"
    : running
      ? "実行中"
      : machine.error
        ? "エラー"
        : machine.halted
          ? "終了"
          : machine.steps
            ? "一時停止"
            : "実行前";
  $("state").classList.toggle("running", running);
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
      ? `選択したアクセス直後 · 新しい参照順`
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
      const content = el("div");
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
  const e = machine.events[selectedEvent] ?? machine.events.at(-1);
  rows.forEach(({ row, live }, address) => {
    live.textContent = text(machine.ram[address]);
    row.classList.toggle(
      "next",
      !machine.halted && !machine.error && address === machine.pc,
    );
    row.classList.toggle("current", address === machine.currentAddress);
    row.classList.toggle(
      "accessed",
      e?.kind !== "fetch" && e?.address === address,
    );
    row.classList.toggle(
      "write-target",
      e?.kind === "write" && e?.address === address,
    );
    row.classList.toggle(
      "written",
      machine.ram[address].op === "data" &&
        JSON.stringify(machine.ram[address]) !==
          JSON.stringify(initial[address]),
    );
  });
  renderCache(e);
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
  $("access-reason").textContent = e
    ? `${e.reason} 転送内容：${text(e.cell)}。`
    : "";
  $("route").className =
    `transfer-route ${e ? (e.hit === null ? "off" : e.hit ? "hit" : "miss") : ""}`;
  const arrows = $("route").querySelectorAll("b");
  arrows.forEach((arrow) => {
    arrow.textContent = e ? (e.kind === "write" ? "→" : "←") : "↔";
  });
  if (e?.hit === true && e.kind !== "write") arrows[1].textContent = "·";
  $("route").setAttribute(
    "aria-label",
    e
      ? `${e.kind === "write" ? "CPUからRAMへの書き込み" : e.hit ? "キャッシュからCPUへ" : "RAMからCPUへ"}：${text(e.cell)}`
      : "データの移動",
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
function revealRam(address) {
  const row = rows[address]?.row,
    list = document.querySelector(".ram-scroll");
  if (!row || !list) return;
  const bounds = list.getBoundingClientRect(),
    target = row.getBoundingClientRect();
  const header = list.querySelector("thead").getBoundingClientRect().height;
  if (target.top < bounds.top + header)
    list.scrollTop += target.top - bounds.top - header;
  else if (target.bottom > bounds.bottom)
    list.scrollTop += target.bottom - bounds.bottom;
}
createMemoryFullscreen({
  surface: $("memory-lab"),
  button: $("memory-fullscreen"),
  onChange: () => {
    if (machine?.currentAddress !== null) revealRam(machine?.currentAddress);
  },
});
function execute() {
  machine.step();
  selectedEvent = -1;
  render();
  revealRam(machine.currentAddress);
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
  } else
    announce(
      `${machine.currentAddress}番地を実行。次は${machine.pc}番地です。`,
    );
}
function tick() {
  if (!running) return;
  execute();
  runCount++;
  if (runCount >= 10000 && running) {
    stop();
    announce(
      "10,000命令に達したため一時停止しました。分岐先を確認するか、自動実行で続けられます。",
    );
    renderControls();
  }
  if (running) timer = setTimeout(tick, Number($("speed").value));
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
    tick();
  });
});
$("step").addEventListener("click", () => guarded(execute));
window.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    ![" ", "Enter"].includes(event.key)
  )
    return;
  if (
    event.target instanceof HTMLElement &&
    event.target.closest(
      'input,select,textarea,button,a,summary,dialog,[contenteditable="true"]',
    )
  )
    return;
  if (document.querySelector("dialog[open]") || $("step").disabled) return;
  event.preventDefault();
  $("step").click();
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
presets.forEach((p) => {
  const option = el("option", p.name);
  option.value = p.id;
  $("preset").append(option);
});
$("load-preset").addEventListener("click", () => {
  const p = presets.find((item) => item.id === $("preset").value);
  initial = copy(p.memory);
  name = p.name;
  config.start = 0;
  renderInputs();
  reset("プリセットを適用しました。命令と数値を自由に変更できます。");
  $("preset-hint").textContent = p.hint;
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
    const status = result.error ? "エラー" : result.halted ? "終了" : "途中";
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
$("export-program").addEventListener("click", () =>
  guarded(() => {
    const blob = new Blob(
        [JSON.stringify({ version: 1, name, initial, config }, null, 2)],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = el("a");
    a.href = url;
    a.download = "cpu-memory-program.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("初期RAMと設定をJSON保存しました。");
  }),
);
$("import-program").addEventListener("click", () => $("program-file").click());
$("program-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 100000)
      throw new Error("100KB以下のプログラムJSONを選んでください。");
    const data = JSON.parse(await file.text());
    if (data.version !== 1) throw new Error("対応していないJSON形式です。");
    validateMemory(data.initial);
    validateConfig(data.config);
    initial = copy(data.initial);
    config = copy(data.config);
    name = String(data.name || "読み込んだ実験").slice(0, 60);
    renderInputs();
    reset("JSONから初期RAMと設定を読み込みました。");
    renderRecords();
    $("preset-hint").textContent = "読み込んだプログラムを実験できます。";
  } catch (error) {
    announce(`読込できませんでした：${error.message}`, true);
  }
  event.target.value = "";
});
window.addEventListener("pagehide", () => {
  stop();
  persist();
});
renderInputs();
machine = new Machine(initial, config);
render();
renderRecords();
$("preset-hint").textContent =
  presets.find((p) => JSON.stringify(p.memory) === JSON.stringify(initial))
    ?.hint ??
  "保存したプログラムを復元しました。命令と値を自由に変更できます。";
