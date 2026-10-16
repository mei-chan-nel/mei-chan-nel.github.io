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
    this.cache = [];
    this.seen = new Set();
    this.clock = 0;
    this.steps = 0;
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
  access(address, kind, value) {
    if (!Number.isInteger(address) || address < 0 || address >= SIZE)
      throw new Error("RAMの範囲外を参照しました。");
    const { config: c, stats: s } = this,
      base = Math.floor(address / 2) * 2;
    s[kind]++;
    this.clock++;
    let line = this.cache.find((item) => item.base === base),
      hit = !!line,
      evicted = null,
      reason,
      cost = 0;
    if (c.enabled) {
      cost += c.cacheTime;
      if (hit) {
        s.hits++;
        reason = `${base}・${base + 1}番地のブロックがキャッシュ内にあります。`;
      } else {
        s.misses++;
        reason = this.seen.has(base)
          ? "以前のブロックは容量不足で追い出されています。"
          : "このブロックを初めて参照しました（初回ミス）。";
        if (this.cache.length >= c.blocks) {
          const oldest = this.cache.reduce((a, b) => (a.used < b.used ? a : b));
          evicted = oldest.base;
          this.cache.splice(this.cache.indexOf(oldest), 1);
          reason += ` LRUにより、最も長く使っていない${evicted}・${evicted + 1}番地を置換。`;
        }
        line = {
          base,
          cells: copy(this.ram.slice(base, base + 2)),
          used: this.clock,
        };
        this.cache.push(line);
        this.seen.add(base);
        s.ramReads++;
        cost += c.ramTime;
        reason += ` RAMから${base}・${base + 1}番地をまとめて取得。`;
      }
      line.used = this.clock;
    } else reason = "キャッシュOFF：RAMへ直接アクセスします。";
    if (kind === "write") {
      this.ram[address] = { op: "data", arg: value };
      if (c.enabled) line.cells[address - base] = copy(this.ram[address]);
      s.ramWrites++;
      cost += c.ramTime;
      reason += c.enabled
        ? " ライトスルーでキャッシュとRAMの両方に書き込み。"
        : " RAMに書き込み。";
    } else if (!c.enabled) {
      s.ramReads++;
      cost += c.ramTime;
    }
    s.wait += cost;
    const cell = copy(
      c.enabled ? line.cells[address - base] : this.ram[address],
    );
    const event = {
      address,
      base,
      kind,
      hit: c.enabled ? hit : null,
      evicted,
      cost,
      reason,
      cell,
      cache: copy(this.cache),
    };
    this.events.push(event);
    this.history.push({ ...event, step: this.steps + 1 });
    if (this.history.length > 200) this.history.shift();
    return cell;
  }
  step() {
    if (this.halted || this.error) return;
    this.events = [];
    try {
      this.currentAddress = this.pc;
      const instruction = this.access(this.pc, "fetch");
      this.current = instruction;
      if (instruction.op === "data")
        throw new Error(
          `${this.pc}番地は数値です。命令を置くか、分岐先を変更してください。`,
        );
      const { op, arg } = instruction;
      let next = this.pc + 1;
      const read = () => {
        const cell = this.access(arg, "read");
        if (cell.op !== "data")
          throw new Error(
            `${arg}番地は命令です。計算に使う番地には数値を置いてください。`,
          );
        return cell.arg;
      };
      if (op === "set") this.acc = arg;
      if (op === "load") this.acc = read();
      if (op === "add" || op === "sub") {
        const operand = read(),
          result = op === "add" ? this.acc + operand : this.acc - operand;
        if (!Number.isSafeInteger(result))
          throw new Error("計算結果が安全に扱える整数の範囲を超えました。");
        this.acc = result;
      }
      if (op === "store") this.access(arg, "write", this.acc);
      if (op === "jump" || (op === "zero" && this.acc === 0)) next = arg;
      if (op === "halt") this.halted = true;
      this.pc = next;
      this.steps++;
      this.stats.cpu += this.config.cpuTime;
      if (!this.halted && this.pc >= SIZE)
        throw new Error(
          "31番地の次に命令がありません。「終了」または分岐を置いてください。",
        );
    } catch (error) {
      this.error = error.message;
    }
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
    };
  }
}
export const conditionKey = (memory, start) => JSON.stringify([memory, start]);
