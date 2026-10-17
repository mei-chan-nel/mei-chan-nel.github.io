export const SIZE = 32;
export const OPS = [
  ["data", "数値", "数値"],
  ["set", "値の設定", "値を設定する"],
  ["load", "読み出し", "番地の値を読み出す"],
  ["add", "加算", "番地の値を加える"],
  ["sub", "減算", "番地の値を引く"],
  ["store", "書き込み", "番地へ値を書き込む"],
  ["jump", "無条件分岐", "番地へ移る"],
  ["zero", "0の場合の条件分岐", "値が0なら番地へ移る"],
  ["halt", "終了", "実行を終了する"],
];
export const defaults = {
  enabled: true,
  blocks: 2,
  cacheTime: 2,
  ramTime: 40,
  cpuTime: 1,
  start: 0,
};
export const copy = (value) => structuredClone(value);
export const text = (cell) =>
  cell.op === "data"
    ? String(cell.arg)
    : cell.op === "halt"
      ? "終了"
      : cell.op === "set"
        ? `値を ${cell.arg} に設定`
        : cell.op === "zero"
          ? `0なら ${cell.arg} 番地へ`
          : {
              load: `${cell.arg} 番地を読み出す`,
              add: `${cell.arg} 番地を加える`,
              sub: `${cell.arg} 番地を引く`,
              store: `${cell.arg} 番地へ書き込む`,
              jump: `${cell.arg} 番地へ移る`,
            }[cell.op];
export function validateCell(cell) {
  if (
    !cell ||
    !OPS.some(([op]) => op === cell.op) ||
    !Number.isSafeInteger(cell.arg)
  )
    throw new Error("値は安全に計算できる範囲の整数で入力してください。");
  if (
    !["set", "data", "halt"].includes(cell.op) &&
    (cell.arg < 0 || cell.arg >= SIZE)
  )
    throw new Error(`番地は0〜${SIZE - 1}で指定してください。`);
}
export function validateConfig(config) {
  if (
    typeof config.enabled !== "boolean" ||
    !Number.isInteger(config.blocks) ||
    config.blocks < 1 ||
    config.blocks > 16
  )
    throw new Error("キャッシュは1〜16ブロックで指定してください。");
  for (const key of ["cacheTime", "ramTime", "cpuTime"])
    if (
      !Number.isFinite(config[key]) ||
      config[key] < 0 ||
      config[key] > 100000
    )
      throw new Error("仮想時間は0〜100,000 nsで指定してください。");
  if (
    !Number.isInteger(config.start) ||
    config.start < 0 ||
    config.start >= SIZE
  )
    throw new Error("開始番地は0〜31で指定してください。");
}
export function validateMemory(memory) {
  if (!Array.isArray(memory) || memory.length !== SIZE)
    throw new Error("RAMは32番地必要です。");
  memory.forEach(validateCell);
}
// One generator yield is one observable action. The same sequence also drives
// whole-instruction runs, so comparison and interactive execution cannot diverge.
export class Machine {
  constructor(memory, config = defaults) {
    validateMemory(memory);
    validateConfig(config);
    this.initial = copy(memory);
    this.ram = copy(memory);
    this.config = copy(config);
    this.pc = config.start;
    this.acc = 0;
    this.current = null;
    this.currentAddress = null;
    this.received = null;
    this.phase = null;
    this.sequence = null;
    this.checkpoints = [];
    this.atBoundary = true;
    this.cache = [];
    this.seen = new Set();
    this.clock = 0;
    this.steps = 0;
    this.actions = 0;
    this.halted = false;
    this.error = "";
    this.stats = {
      hits: 0,
      misses: 0,
      fetch: 0,
      read: 0,
      write: 0,
      ramReads: 0,
      ramWrites: 0,
      cpu: 0,
      wait: 0,
    };
    this.events = [];
    this.history = [];
  }
  show(stage, title, detail, event = null, transfer = null, focus = null) {
    if (event) event.cache = copy(this.cache);
    this.phase = { stage, title, detail, event, transfer, focus };
    return this.phase;
  }
  *accessStages(address, kind, value) {
    if (!Number.isInteger(address) || address < 0 || address >= SIZE)
      throw new Error("RAMの範囲外を参照しました。");
    const c = this.config,
      s = this.stats,
      base = Math.floor(address / 2) * 2;
    s[kind]++;
    this.clock++;
    let line = this.cache.find((item) => item.base === base);
    const event = {
      address,
      base,
      kind,
      hit: c.enabled ? undefined : null,
      evicted: null,
      cost: 0,
      reason: "",
      cell: null,
      cache: copy(this.cache),
      complete: false,
    };
    this.events.push(event);
    const charge = (cost) => {
      event.cost += cost;
      s.wait += cost;
    };
    if (c.enabled) {
      charge(c.cacheTime);
      event.hit = !!line;
      if (line) {
        s.hits++;
        line.used = this.clock;
        event.reason = `${base}・${base + 1}番地のブロックがキャッシュ内にあります。`;
      } else {
        s.misses++;
        event.reason = this.seen.has(base)
          ? "以前のブロックは容量不足で追い出されています。"
          : "このブロックを初めて参照しました（初回ミス）。";
      }
      yield this.show(
        "lookup",
        `${kind === "fetch" ? "命令" : "データ"} ${address}番地：${line ? "キャッシュヒット" : "キャッシュミス"}`,
        line
          ? kind === "write"
            ? "キャッシュを更新し、ライトスルーでRAMにも同じ値を書き込みます。"
            : "RAMへはアクセスせず、キャッシュの値を使います。"
          : "次にRAMから2番地分のブロックを取得します。",
        event,
        {
          from: "cpu",
          to: "cache",
          kind,
          address,
          base,
          request: true,
          label: `CPU → キャッシュ：${address}番地を要求（${line ? "ヒット" : "ミス"}）`,
        },
        { device: "cache", address },
      );
      if (!line) {
        yield this.show(
          "ram-request",
          `キャッシュミス → RAM ${address}番地へ読出要求`,
          `メモリ側へ要求し、${base}・${base + 1}番地のブロックを読み出します。`,
          event,
          {
            from: "cache",
            to: "ram",
            kind: kind === "fetch" ? "fetch" : "read",
            address,
            base,
            request: true,
            label: `キャッシュ → RAM：${base}・${base + 1}番地のブロックを要求`,
          },
          { device: "ram", address },
        );
        if (this.cache.length >= c.blocks) {
          const oldest = this.cache.reduce((a, b) => (a.used < b.used ? a : b));
          event.evicted = oldest.base;
          this.cache.splice(this.cache.indexOf(oldest), 1);
          event.reason += ` LRUにより、最も長く使っていない${oldest.base}・${oldest.base + 1}番地を置換。`;
        }
        line = {
          base,
          cells: copy(this.ram.slice(base, base + 2)),
          used: this.clock,
        };
        this.cache.push(line);
        this.seen.add(base);
        s.ramReads++;
        charge(c.ramTime);
        event.reason += ` RAMから${base}・${base + 1}番地をまとめて取得。`;
        yield this.show(
          "block-fill",
          `RAM ${base}・${base + 1}番地 → キャッシュ`,
          "ブロックを取得しました。CPUにはまだ値を渡していません。",
          event,
          {
            from: "ram",
            to: "cache",
            kind: kind === "fetch" ? "fetch" : "read",
            label: `RAM ${base}・${base + 1}番地 → キャッシュ（ブロック取得）`,
            address,
            base,
            block: true,
          },
          { device: "ram", address },
        );
      }
    } else {
      event.reason = "キャッシュOFF：RAMへ直接アクセスします。";
      yield this.show(
        "ram-request",
        `RAM ${address}番地へ${kind === "write" ? "書込" : "読出"}要求`,
        event.reason,
        event,
        {
          from: "cpu",
          to: "ram",
          kind,
          address,
          base,
          request: true,
          label: `CPU → RAM：${address}番地へ${kind === "write" ? "書込" : "読出"}要求`,
        },
        { device: "ram", address },
      );
    }
    if (kind === "write") {
      event.cell = { op: "data", arg: value };
      if (c.enabled) {
        line.cells[address - base] = copy(event.cell);
        yield this.show(
          "cache-write",
          `CPU → キャッシュ ${address}番地：${value}`,
          "キャッシュへ反映しました。RAMへの書き込みは次の段階です。",
          event,
          {
            from: "cpu",
            to: "cache",
            kind: "write",
            label: `CPU → キャッシュ ${address}番地：${value}`,
            address,
            base,
          },
          { device: "cache", address },
        );
      }
      this.ram[address] = copy(event.cell);
      s.ramWrites++;
      charge(c.ramTime);
      event.reason += c.enabled
        ? " ライトスルーで同じ書込値をRAMにも反映。"
        : " RAMに書き込み。";
      event.complete = true;
      yield this.show(
        "ram-write",
        `CPU → RAM ${address}番地：${value}`,
        c.enabled
          ? "ライトスルー：同じCPUの書込値をRAMにも反映しました。"
          : "RAMへ直接書き込みました。",
        event,
        {
          from: "cpu",
          to: "ram",
          kind: "write",
          label: `CPU → RAM ${address}番地：${value}${c.enabled ? "（ライトスルー）" : ""}`,
          address,
          base,
        },
        { device: "ram", address },
      );
    } else {
      if (!c.enabled) {
        s.ramReads++;
        charge(c.ramTime);
      }
      event.cell = copy(
        c.enabled ? line.cells[address - base] : this.ram[address],
      );
      if (kind === "fetch") this.current = copy(event.cell);
      else this.received = copy(event.cell);
      const from = c.enabled ? "cache" : "ram",
        label = `${c.enabled ? "キャッシュ" : "RAM"} ${address}番地 → CPU：${text(event.cell)}`;
      event.complete = true;
      yield this.show(
        "cpu-receive",
        label,
        kind === "fetch"
          ? "命令をCPUに取り込みました。次に、この命令を実行します。"
          : "数値をCPUに取り込みました。次に計算中の値へ反映します。",
        event,
        { from, to: "cpu", kind, label, address, base },
        { device: c.enabled ? "cache" : "ram", address },
      );
    }
    event.complete = true;
    event.cache = copy(this.cache);
    this.history.push({ ...copy(event), step: this.steps + 1 });
    if (this.history.length > 200) this.history.shift();
    return copy(event.cell);
  }
  access(address, kind, value) {
    const stages = this.accessStages(address, kind, value);
    let next;
    do {
      next = stages.next();
    } while (!next.done);
    return next.value;
  }
  *instructionStages() {
    this.events = [];
    this.currentAddress = this.pc;
    this.current = null;
    this.received = null;
    this.atBoundary = false;
    const instruction = yield* this.accessStages(this.pc, "fetch");
    if (instruction.op === "data")
      throw new Error(
        `${this.pc}番地は数値です。命令を置くか、分岐先を変更してください。`,
      );
    const { op, arg } = instruction;
    let next = this.pc + 1;
    const detail =
      op === "set"
        ? `値 ${arg} を計算中の値に設定します。`
        : op === "halt"
          ? "プログラムを終了します。"
          : op === "jump" || op === "zero"
            ? `次に実行する番地を決めます。`
            : `${arg}番地の${op === "store" ? "書き込み" : "数値"}を${this.config.enabled ? "キャッシュ経由" : "RAMへの直接アクセス"}で扱います。`;
    yield this.show(
      "decode",
      `命令を実行：${text(instruction)}`,
      detail,
      null,
      null,
      { device: "cpu", address: this.currentAddress },
    );
    let operand;
    if (["load", "add", "sub"].includes(op)) {
      const cell = yield* this.accessStages(arg, "read");
      if (cell.op !== "data")
        throw new Error(
          `${arg}番地は命令です。計算に使う番地には数値を置いてください。`,
        );
      operand = cell.arg;
    }
    if (op === "set") this.acc = arg;
    if (op === "load") this.acc = operand;
    if (op === "add" || op === "sub") {
      const result = op === "add" ? this.acc + operand : this.acc - operand;
      if (!Number.isSafeInteger(result))
        throw new Error("計算結果が安全に扱える整数の範囲を超えました。");
      this.acc = result;
    }
    if (op === "store") yield* this.accessStages(arg, "write", this.acc);
    if (op === "jump" || (op === "zero" && this.acc === 0)) next = arg;
    if (op === "halt") this.halted = true;
    this.pc = next;
    this.steps++;
    this.stats.cpu += this.config.cpuTime;
    this.atBoundary = true;
    if (!this.halted && this.pc >= SIZE)
      throw new Error(
        "31番地の次に命令がありません。「終了」または分岐を置いてください。",
      );
    const title = ["load", "add", "sub", "set"].includes(op)
      ? `計算中の値を ${this.acc} に更新`
      : op === "store"
        ? `${arg}番地への書き込み完了`
        : op === "halt"
          ? "実行を終了"
          : `次に実行する番地は ${this.pc} 番地`;
    yield this.show(
      "complete",
      title,
      this.halted
        ? "すべての命令を実行しました。"
        : `${this.currentAddress}番地の命令が完了しました。次は${this.pc}番地です。`,
      null,
      null,
      { device: "cpu", address: this.currentAddress },
    );
  }
  advance() {
    if (this.halted || this.error) return;
    // Checkpoint only at instruction boundaries: generators cannot be cloned.
    // Recent undo replays at most one instruction. Older undo can replay from
    // the initial state, so the bounded checkpoint cache does not limit undo.
    if (
      !this.sequence &&
      this.atBoundary &&
      this.checkpoints.at(-1)?.actions !== this.actions
    ) {
      const { sequence, checkpoints, ...state } = this;
      this.checkpoints.push({ actions: this.actions, state: copy(state) });
      if (this.checkpoints.length > 64) this.checkpoints.shift();
    }
    this.actions++;
    try {
      this.sequence ??= this.instructionStages();
      const result = this.sequence.next();
      if (result.done || this.phase?.stage === "complete") this.sequence = null;
    } catch (error) {
      this.error = error.message;
      this.sequence = null;
      this.show("error", "実行できません", this.error);
    }
    return this.phase;
  }
  back() {
    if (!this.actions) return this;
    const target = this.actions - 1,
      restored = new Machine(this.initial, this.config),
      checkpoint = this.checkpoints.findLast((item) => item.actions <= target);
    if (checkpoint) {
      Object.assign(restored, copy(checkpoint.state));
      restored.checkpoints = this.checkpoints.filter(
        (item) => item.actions <= checkpoint.actions,
      );
    }
    while (restored.actions < target) restored.advance();
    return restored;
  }
  step() {
    const target = this.steps + 1;
    while (this.steps < target && !this.halted && !this.error) this.advance();
  }
  result() {
    return {
      acc: this.acc,
      ram: copy(this.ram),
      steps: this.steps,
      halted: this.halted,
      error: this.error,
      stats: copy(this.stats),
      config: copy(this.config),
      initial: copy(this.initial),
      inProgress: !this.atBoundary,
      phase: this.phase?.stage ?? null,
    };
  }
}
export const conditionKey = (memory, start) => JSON.stringify([memory, start]);
