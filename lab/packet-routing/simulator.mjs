// Deterministic, browser-local, single-area link-state teaching model.
// Each router owns its LSDB and forwarding table. Data never uses global SPF.
export const TIMING = Object.freeze({ detect: 2.4, flood: 0.75, spf: 0.4, hop: 0.85, decision: 0.65, fragment: 0.55, repeat: 2.8 });

export class RoutingSimulator {
  constructor({ initial = true, now = () => Date.now() } = {}) {
    this.now = now;
    this.time = 0;
    this.nodes = new Map();
    this.names = new Map();
    this.links = new Map();
    this.routers = new Map();
    this.packets = [];
    this.messages = [];
    this.history = [];
    this.events = [];
    this.serial = 0;
    this.ids = { router: 0, lan: 0, pc: 0, link: 0, packet: 0, message: 0 };
    this.repeating = null;
    this.revision = 0;
    this.totals = { sent: 0, delivered: 0, lost: 0 };
    if (initial) this.createInitial();
  }

  log(type, text, router = null, detail = null) {
    const record = { id: ++this.serial, time: this.time, timestamp: this.now(), type, text, router, detail };
    this.history.unshift(record);
    this.history.length = Math.min(this.history.length, 600);
    this.revision++;
    return record;
  }

  schedule(delay, type, data) {
    this.events.push({ at: this.time + delay, order: ++this.serial, type, data });
    this.events.sort((a, b) => a.at - b.at || a.order - b.order);
  }

  advance(seconds) {
    const end = this.time + Math.max(0, seconds);
    let count = 0;
    while (this.events.length && this.events[0].at <= end) {
      const event = this.events.shift();
      this.time = event.at;
      this.handle(event);
      if (++count > 20000) throw new Error("Event queue limit exceeded");
    }
    this.time = end;
  }

  step() {
    this.advance(this.events.length ? Math.max(0, this.events[0].at - this.time) : 0.5);
  }

  get pcs() { return [...this.nodes.values()].filter((n) => n.kind === "pc"); }
  get lans() { return [...this.nodes.values()].filter((n) => n.kind === "lan"); }
  get activePackets() { return this.packets.filter((p) => p.status === "active"); }
  get pendingUpdates() { return this.events.filter((e) => ["detect", "lsa", "spf"].includes(e.type)).length; }
  prunePackets() { this.packets = [...this.packets.filter((p) => p.status !== "active").slice(-200), ...this.activePackets]; }
  name(id) { return this.nodes.get(id)?.label ?? this.names.get(id) ?? id; }
  edges(id, upOnly = true) {
    return [...this.links.values()].filter((l) => (l.a === id || l.b === id) && (!upOnly || this.linkUsable(l)));
  }
  other(link, id) { return link.a === id ? link.b : link.a; }
  linkUsable(link) { return !!link?.up && !!this.nodes.get(link.a)?.up && !!this.nodes.get(link.b)?.up; }
  between(a, b) { return [...this.links.values()].find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)); }
  lanForPC(id) {
    const l = this.edges(id, false).find((edge) => this.nodes.get(this.other(edge, id))?.kind === "lan");
    return l ? this.nodes.get(this.other(l, id)) : null;
  }

  addNode(kind, x, y, { announce = true } = {}) {
    if (!Object.hasOwn(this.ids, kind) || !["router", "lan", "pc"].includes(kind)) throw new Error("機器の種類が不正です。");
    if (this.nodes.size >= 80) throw new Error("この実験では機器を80台まで配置できます。");
    const number = ++this.ids[kind];
    const id = `${kind}-${number}`;
    const letter = (n) => n <= 26 ? String.fromCharCode(64 + n) : String(n);
    const node = { id, kind, x, y, up: true, label: kind === "router" ? `R${number}` : `${kind === "lan" ? "LAN" : "PC"}-${letter(number)}` };
    if (kind === "lan") node.prefix = `10.0.${number}.0/24`;
    this.nodes.set(id, node);
    this.names.set(id, node.label);
    if (kind === "router") this.routers.set(id, { db: new Map(), table: new Map(), sequence: 0, generation: 0, tableVersion: 0, updatedAt: 0, notice: null });
    if (announce) {
      this.log("edit", `${node.label}を追加。回線を接続すると通信できます。`);
      if (kind === "router") this.schedule(TIMING.detect, "detect", { router: id });
    }
    this.revision++;
    return node;
  }

  connectionError(a, b) {
    const left = this.nodes.get(a), right = this.nodes.get(b);
    if (!left || !right || a === b) return "異なる2台を選んでください。";
    if (this.between(a, b)) return "この2台にはすでに回線があります。";
    const kinds = [left.kind, right.kind].sort().join("-");
    if (!["router-router", "lan-router", "lan-pc"].includes(kinds)) return "PCとLAN、LANとルータ、またはルータ同士を接続できます。";
    const pc = left.kind === "pc" ? left : right.kind === "pc" ? right : null;
    if (pc && this.edges(pc.id, false).length) return "PCは1つのLANに接続します。先に現在の回線を削除してください。";
    const lan = left.kind === "lan" ? left : right.kind === "lan" ? right : null;
    if (kinds === "lan-router" && this.edges(lan.id, false).some((l) => this.nodes.get(this.other(l, lan.id))?.kind === "router")) return "この教材ではLANを1台のルータに接続します。先に現在の回線を削除してください。";
    return null;
  }

  connect(a, b, { up = true, cost = 1, announce = true } = {}) {
    const error = this.connectionError(a, b);
    if (error) throw new Error(error);
    if (!Number.isInteger(cost) || cost < 1 || cost > 9) throw new Error("回線コストは1〜9です。");
    const link = { id: `link-${++this.ids.link}`, a, b, up, cost, epoch: 0 };
    this.links.set(link.id, link);
    this.assignAddresses();
    if (announce) this.topologyChanged([a, b], `${this.name(a)}と${this.name(b)}の回線を追加`, "edit");
    this.revision++;
    return link;
  }

  assignAddresses() {
    for (const pc of this.pcs) {
      const lan = this.lanForPC(pc.id);
      if (!lan) { pc.address = "未接続"; pc.addressLAN = null; continue; }
      if (pc.addressLAN !== lan.id) {
        const used = new Set(this.pcs.filter((p) => p.addressLAN === lan.id).map((p) => p.host));
        pc.host = 10; while (used.has(pc.host)) pc.host++;
        pc.addressLAN = lan.id;
        pc.address = lan.prefix.replace("0/24", String(pc.host));
      }
    }
  }

  topologyChanged(ids, text, type = "fault") {
    this.log(type, `${text}。周辺のルータが変化を検知するまで約${TIMING.detect}秒。`);
    const affected = new Set();
    for (const id of ids) {
      if (this.nodes.get(id)?.kind === "router") affected.add(id);
      for (const l of this.edges(id, false)) {
        const other = this.other(l, id);
        if (this.nodes.get(other)?.kind === "router") affected.add(other);
      }
    }
    for (const router of affected) this.schedule(TIMING.detect, "detect", { router });
    this.revision++;
  }

  setLink(id, up) {
    const link = this.links.get(id);
    if (!link || link.up === up) return;
    link.up = up;
    link.epoch++;
    if (!up) for (const p of this.activePackets) if (p.transit?.link === id) this.drop(p, "通過中の回線が切断された");
    this.topologyChanged([link.a, link.b], `${this.name(link.a)} ↔ ${this.name(link.b)}を${up ? "復旧" : "切断"}`);
  }

  setNode(id, up) {
    const node = this.nodes.get(id);
    if (!node || node.up === up) return;
    node.up = up;
    for (const link of this.edges(id, false)) link.epoch++;
    if (!up) for (const p of this.activePackets) if (p.current === id || p.transit?.from === id || p.transit?.to === id) this.drop(p, `${node.label}が故障した`);
    if (node.kind === "router") {
      const state = this.routers.get(id);
      state.generation++;
      if (up) {
        // A rebooted router does not inherit a globally converged database.
        state.db = new Map();
        state.table = new Map();
      }
    }
    this.topologyChanged([id], `${node.label}を${up ? "復旧" : "故障"}`);
  }

  setCost(id, cost) {
    const link = this.links.get(id);
    if (!link || !Number.isInteger(cost) || cost < 1 || cost > 9) throw new Error("回線コストは1〜9です。");
    if (link.cost === cost) return;
    link.cost = cost;
    this.topologyChanged([link.a, link.b], "回線コストを変更", "edit");
  }

  removeLink(id) {
    const link = this.links.get(id);
    if (!link) return;
    for (const p of this.activePackets) if (p.transit?.link === id) this.drop(p, "通過中の回線が削除された");
    this.links.delete(id);
    this.assignAddresses();
    this.topologyChanged([link.a, link.b], `${this.name(link.a)} ↔ ${this.name(link.b)}の回線を削除`, "edit");
  }

  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    const neighbors = this.edges(id, false).map((l) => this.other(l, id));
    for (const p of this.activePackets) if (p.current === id || p.transit?.from === id || p.transit?.to === id) this.drop(p, `${node.label}が削除された`);
    for (const l of this.edges(id, false)) this.links.delete(l.id);
    this.nodes.delete(id);
    this.routers.delete(id);
    this.assignAddresses();
    this.topologyChanged(neighbors, `${node.label}を削除`, "edit");
  }

  advertisement(router) {
    const state = this.routers.get(router);
    const links = [], networks = [];
    for (const l of this.edges(router)) {
      const other = this.nodes.get(this.other(l, router));
      if (other.kind === "router") links.push({ id: other.id, cost: l.cost });
      if (other.kind === "lan") networks.push({ id: other.id, label: other.label, prefix: other.prefix, cost: l.cost });
    }
    return { origin: router, seq: state.sequence, links: links.sort((a, b) => a.id.localeCompare(b.id)), networks: networks.sort((a, b) => a.id.localeCompare(b.id)) };
  }

  originate(router) {
    if (!this.nodes.get(router)?.up || !this.routers.has(router)) return;
    const state = this.routers.get(router);
    const lsa = this.advertisement(router);
    const old = state.db.get(router);
    if (!old || JSON.stringify([old.links, old.networks]) !== JSON.stringify([lsa.links, lsa.networks])) {
      lsa.seq = ++state.sequence;
      state.db.set(router, lsa);
      state.notice = { text: "変化を検知 → 経路情報を伝達", until: this.time + 2.5, type: "update" };
      this.log("detect", `${this.name(router)}が接続の変化を検知。経路情報 #${lsa.seq} を隣のルータへ送信。`, router);
      this.schedule(TIMING.spf, "spf", { router, generation: state.generation });
      this.flood(router, lsa);
    }
    // Newly established adjacency synchronizes the local databases, including reboot.
    for (const l of this.edges(router)) {
      const neighbor = this.other(l, router);
      const neighborState = this.routers.get(neighbor);
      if (!neighborState) continue;
      for (const record of state.db.values()) this.sendLSA(router, neighbor, record, l.id);
      for (const record of neighborState.db.values()) this.sendLSA(neighbor, router, record, l.id);
    }
  }

  sendLSA(from, to, lsa, link) {
    this.schedule(TIMING.flood, "lsa", { from, to, lsa, link, epoch: this.links.get(link)?.epoch, generation: this.routers.get(to)?.generation, senderGeneration: this.routers.get(from)?.generation });
  }

  flood(router, lsa, except = null) {
    for (const l of this.edges(router)) {
      const to = this.other(l, router);
      if (to !== except && this.nodes.get(to)?.kind === "router") this.sendLSA(router, to, lsa, l.id);
    }
  }

  calculate(router) {
    const state = this.routers.get(router);
    const distance = new Map([[router, 0]]), first = new Map(), visited = new Set();
    while (true) {
      const candidate = [...distance.entries()].filter(([id]) => !visited.has(id)).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "en", { numeric: true }))[0];
      if (!candidate) break;
      const [id, cost] = candidate;
      visited.add(id);
      for (const edge of state.db.get(id)?.links ?? []) {
        // Bidirectional adjacency prevents paths through unadvertised/failed neighbors.
        if (!state.db.get(edge.id)?.links.some((e) => e.id === id)) continue;
        const next = cost + edge.cost;
        if (next < (distance.get(edge.id) ?? Infinity)) {
          distance.set(edge.id, next);
          first.set(edge.id, id === router ? edge.id : first.get(id));
        }
      }
    }
    const table = new Map();
    for (const [id, cost] of distance) {
      for (const lan of state.db.get(id)?.networks ?? []) {
        const total = cost + lan.cost;
        if (total < (table.get(lan.id)?.cost ?? Infinity)) table.set(lan.id, { ...lan, cost: total, next: id === router ? lan.id : first.get(id), via: id });
      }
    }
    return table;
  }

  rebuild(router, { quiet = false } = {}) {
    const state = this.routers.get(router);
    const table = this.calculate(router);
    const changes = [];
    for (const id of new Set([...state.table.keys(), ...table.keys()])) {
      const before = state.table.get(id), after = table.get(id);
      if (before?.next !== after?.next || before?.cost !== after?.cost) changes.push({ network: id, before: before ? { ...before } : null, after: after ? { ...after } : null });
    }
    state.table = table;
    if (changes.length || quiet) {
      state.tableVersion++;
      state.updatedAt = this.time;
      if (!quiet) {
        state.notice = { text: `テーブル更新 · ${changes.length}経路`, until: this.time + 2.5, type: "update" };
        this.log("table", `${this.name(router)}が自分の情報から経路を再計算。${changes.length}件の経路を更新。`, router, changes);
      }
    }
  }

  send(source, destination, text) {
    if (!this.nodes.has(source) || !this.nodes.has(destination) || source === destination || this.nodes.get(source).kind !== "pc" || this.nodes.get(destination).kind !== "pc") throw new Error("異なる送信元PCと宛先PCを選んでください。");
    if (!text.trim()) throw new Error("メッセージを入力してください。");
    if (this.activePackets.length > 120) throw new Error("通信中のパケットが多いため、少し待ってください。");
    const parts = Array.from(text).slice(0, 120), fragments = [];
    for (let i = 0; i < parts.length; i += 12) fragments.push(parts.slice(i, i + 12).join(""));
    const message = { id: `M${++this.ids.message}`, source, destination, text: parts.join(""), time: this.time, packets: [], status: "active" };
    this.messages.unshift(message);
    this.messages.length = Math.min(80, this.messages.length);
    const lan = this.lanForPC(destination);
    fragments.forEach((fragment, i) => {
      const packet = { id: `P${++this.ids.packet}`, message, source, destination, destinationLAN: lan?.id, destinationAddress: this.nodes.get(destination).address, fragment, index: i + 1, total: fragments.length, createdAt: this.time, current: source, path: [source], status: "active", transit: null, ttl: 32, decisions: [] };
      message.packets.push(packet);
      this.packets.push(packet);
      this.totals.sent++;
      this.schedule(i * TIMING.fragment, "forward", { packet });
    });
    // Keep active traffic and recent results; event references are independent of this list.
    this.prunePackets();
    this.log("send", `${message.id}：${this.name(source)} → ${this.name(destination)}へ${fragments.length}個のパケットを送信。`);
    return message;
  }

  startRepeating(source, destination, text) {
    this.stopRepeating();
    const token = ++this.serial;
    this.repeating = { token, source, destination, text };
    const result = this.send(source, destination, text);
    this.schedule(TIMING.repeat, "repeat", { token });
    return result;
  }
  stopRepeating() {
    this.repeating = null;
    this.events = this.events.filter((e) => e.type !== "repeat");
    this.revision++;
  }

  forward(packet) {
    if (packet.status !== "active") return;
    const node = this.nodes.get(packet.current);
    if (!node?.up) return this.drop(packet, "転送先の機器が使えない");
    if (packet.current === packet.destination) return this.deliver(packet);
    let next;
    if (node.kind === "pc") next = this.lanForPC(node.id)?.id;
    if (node.kind === "lan") {
      if (node.id === packet.destinationLAN && this.nodes.get(packet.destination)?.address !== packet.destinationAddress) return this.drop(packet, "宛先LANにそのIPアドレスのPCがない（削除・接続変更）");
      next = node.id === packet.destinationLAN ? packet.destination : this.edges(node.id, false).map((l) => this.nodes.get(this.other(l, node.id))).find((n) => n?.kind === "router")?.id;
    }
    if (node.kind === "router") {
      if (--packet.ttl <= 0) return this.drop(packet, "転送回数の上限（TTL）に達した。更新途中の経路が循環した可能性があります");
      const state = this.routers.get(node.id), route = state.table.get(packet.destinationLAN);
      next = route?.next;
      const text = `${this.name(packet.destinationLAN ?? "未接続の宛先")}宛 → ${next ? this.name(next) : "経路なし"}`;
      state.notice = { text, until: this.time + 1.9, type: "data", packet: packet.id };
      packet.decisions.push({ router: node.id, next: next ?? null, time: this.time, timestamp: this.now(), version: state.tableVersion });
      this.log("forward", `${node.label}：${packet.id}の宛先を確認。テーブル v${state.tableVersion} から${next ? this.name(next) + "へ転送" : "経路なしと判断"}。`, node.id);
    }
    if (!next) return this.drop(packet, "宛先への経路がない");
    const link = this.between(node.id, next);
    if (!this.linkUsable(link)) return this.drop(packet, "テーブルが示す次の回線・機器が使えない（経路更新待ち）");
    packet.transit = { from: node.id, to: next, link: link.id, start: this.time, end: this.time + TIMING.hop };
    this.schedule(TIMING.hop, "arrival", { packet, transit: packet.transit });
    this.revision++;
  }

  drop(packet, reason) {
    if (packet.status !== "active") return;
    const from = this.nodes.get(packet.transit?.from ?? packet.current);
    const to = this.nodes.get(packet.transit?.to);
    const progress = packet.transit ? Math.max(0, Math.min(1, (this.time - packet.transit.start) / (packet.transit.end - packet.transit.start))) : 0;
    if (from) packet.lostPosition = { x: from.x + ((to?.x ?? from.x) - from.x) * progress, y: from.y + ((to?.y ?? from.y) - from.y) * progress };
    packet.lostTransit = packet.transit;
    packet.status = "lost";
    this.totals.lost++;
    packet.reason = reason;
    packet.endedAt = this.time;
    packet.transit = null;
    this.prunePackets();
    this.finishMessage(packet.message);
    packet.lossOrder = this.log("lost", `${packet.id}が${this.name(packet.current)}付近で消失：${reason}。`).id;
  }

  deliver(packet) {
    packet.status = "delivered";
    this.totals.delivered++;
    packet.endedAt = this.time;
    this.prunePackets();
    this.finishMessage(packet.message);
    this.log("delivered", `${packet.id}が${this.name(packet.destination)}に到達（ルータ${packet.decisions.length}台を通過）。`);
  }

  finishMessage(message) {
    if (message.packets.some((p) => p.status === "active")) return;
    message.status = message.packets.every((p) => p.status === "delivered") ? "delivered" : "lost";
    this.log(message.status, message.status === "delivered" ? `${message.id}：すべて到達。メッセージ「${message.text}」を組み立てました。` : `${message.id}：一部が消失し、メッセージを組み立てられませんでした。`);
  }

  handle({ type, data }) {
    if (type === "detect") this.originate(data.router);
    if (type === "spf" && this.nodes.get(data.router)?.up && this.routers.get(data.router)?.generation === data.generation) this.rebuild(data.router);
    if (type === "lsa") {
      const state = this.routers.get(data.to);
      if (!state || state.generation !== data.generation || this.routers.get(data.from)?.generation !== data.senderGeneration || this.links.get(data.link)?.epoch !== data.epoch || !this.linkUsable(this.links.get(data.link))) return;
      const old = state.db.get(data.lsa.origin);
      if (old && old.seq >= data.lsa.seq) return;
      state.db.set(data.lsa.origin, data.lsa);
      state.notice = { text: `${this.name(data.from)}から経路情報を受信`, until: this.time + 1.6, type: "update" };
      this.log("receive", `${this.name(data.to)}が${this.name(data.from)}から${this.name(data.lsa.origin)}の経路情報 #${data.lsa.seq} を受信。`, data.to);
      this.schedule(TIMING.spf, "spf", { router: data.to, generation: state.generation });
      this.flood(data.to, data.lsa, data.from);
    }
    if (type === "forward") this.forward(data.packet);
    if (type === "arrival") {
      const p = data.packet;
      if (p.status !== "active" || p.transit !== data.transit) return;
      if (!this.linkUsable(this.links.get(data.transit.link))) return this.drop(p, "転送中に回線・機器が使えなくなった");
      p.current = data.transit.to;
      p.path.push(p.current);
      p.transit = null;
      if (p.current === p.destination) this.deliver(p);
      else this.schedule(this.nodes.get(p.current)?.kind === "router" ? TIMING.decision : 0.12, "forward", { packet: p });
      this.revision++;
    }
    if (type === "repeat" && this.repeating?.token === data.token) {
      try {
        const r = this.repeating;
        this.send(r.source, r.destination, r.text);
        this.schedule(TIMING.repeat, "repeat", data);
      } catch (error) {
        this.stopRepeating();
        this.log("lost", `連続送信を停止：${error.message}`);
      }
    }
  }

  // Read each current router's own table, as a forecast, not a forwarding shortcut.
  forecast(source, destination) {
    const fromLAN = this.lanForPC(source), toLAN = this.lanForPC(destination);
    if (!fromLAN || !toLAN) return [];
    const path = [source, fromLAN.id];
    if (fromLAN.id === toLAN.id) return [...path, destination];
    let id = this.edges(fromLAN.id, false).map((l) => this.other(l, fromLAN.id)).find((n) => this.nodes.get(n)?.kind === "router");
    const seen = new Set(path);
    while (id && !seen.has(id)) {
      path.push(id);
      seen.add(id);
      if (id === toLAN.id) return [...path, destination];
      id = this.routers.get(id)?.table.get(toLAN.id)?.next;
    }
    return path;
  }

  createInitial() {
    const routers = [];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) routers.push(this.addNode("router", 300 + col * 155, 135 + row * 120, { announce: false }));
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
      const i = row * 5 + col;
      if (col < 4) this.connect(routers[i].id, routers[i + 1].id, { up: i !== 6, announce: false });
      if (row < 3) this.connect(routers[i].id, routers[i + 5].id, { announce: false });
    }
    this.connect(routers[1].id, routers[7].id, { cost: 2, announce: false });
    this.connect(routers[8].id, routers[14].id, { cost: 2, announce: false });
    this.connect(routers[10].id, routers[16].id, { cost: 2, announce: false });
    routers[12].up = false;
    const groups = [
      { x: 145, y: 135, router: 0, pcs: [[55, 90], [55, 185]] },
      { x: 145, y: 495, router: 15, pcs: [[55, 495]] },
      { x: 610, y: 45, router: 2, pcs: [[495, 45]] },
      { x: 610, y: 585, router: 17, pcs: [[495, 585]] },
      { x: 1075, y: 135, router: 4, pcs: [[1175, 135]] },
      { x: 1075, y: 495, router: 19, pcs: [[1175, 450], [1175, 545]] },
    ];
    for (const group of groups) {
      const lan = this.addNode("lan", group.x, group.y, { announce: false });
      this.connect(lan.id, routers[group.router].id, { announce: false });
      for (const [x, y] of group.pcs) this.connect(this.addNode("pc", x, y, { announce: false }).id, lan.id, { announce: false });
    }
    const records = routers.filter((r) => r.up).map((r) => {
      this.routers.get(r.id).sequence = 1;
      return this.advertisement(r.id);
    });
    for (const router of routers.filter((r) => r.up)) {
      this.routers.get(router.id).db = new Map(records.map((lsa) => [lsa.origin, lsa]));
      this.rebuild(router.id, { quiet: true });
    }
    this.log("ready", "20台のルータ・6つのLAN・8台のPCを配置済み。R13の故障とR7 ↔ R8の切断は検知済みです。");
  }
}
