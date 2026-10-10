import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RoutingSimulator, TIMING } from "../lab/packet-routing/simulator.mjs";
import { contents } from "../lab/catalog.mjs";

function diamond() {
  const s = new RoutingSimulator({ initial: false });
  const r = Array.from({ length: 4 }, (_, i) => s.addNode("router", i * 100, 0, { announce: false }));
  for (const [a, b, cost] of [[0, 1, 1], [1, 3, 1], [0, 2, 2], [2, 3, 2]]) s.connect(r[a].id, r[b].id, { cost, announce: false });
  const lans = r.filter((_, i) => i === 0 || i === 3).map((router) => {
    const lan = s.addNode("lan", 0, 0, { announce: false });
    s.connect(router.id, lan.id, { announce: false });
    return lan;
  });
  const pcs = lans.map((lan) => {
    const pc = s.addNode("pc", 0, 0, { announce: false });
    s.connect(pc.id, lan.id, { announce: false });
    return pc;
  });
  for (const router of r) s.originate(router.id);
  s.advance(12);
  return { s, r, lans, pcs, send: (text = "テスト") => s.send(pcs[0].id, pcs[1].id, text) };
}

// Independent physical-graph shortest-path oracle, used only in tests after convergence.
function physicalCosts(s, source) {
  const distance = new Map([[source, 0]]), settled = new Set();
  while (true) {
    const candidate = [...distance].filter(([id]) => !settled.has(id)).sort((a, b) => a[1] - b[1])[0];
    if (!candidate) break;
    const [id, cost] = candidate;
    settled.add(id);
    if (s.nodes.get(id)?.kind !== "router") continue;
    for (const link of s.edges(id)) {
      const other = s.other(link, id);
      if (s.nodes.get(other)?.kind === "pc") continue;
      const next = cost + link.cost;
      if (next < (distance.get(other) ?? Infinity)) distance.set(other, next);
    }
  }
  return distance;
}

function assertConverged(s) {
  assert.equal(s.pendingUpdates, 0);
  for (const [id, state] of s.routers) {
    if (!s.nodes.get(id).up) continue;
    const costs = physicalCosts(s, id);
    for (const lan of s.lans) assert.equal(state.table.get(lan.id)?.cost ?? Infinity, costs.get(lan.id) ?? Infinity, `${s.name(id)} → ${lan.label}`);
    for (const route of state.table.values()) assert.ok(s.linkUsable(s.between(id, route.next)), `Usable next hop from ${s.name(id)}`);
  }
}

test("完成済みネットワークでは初期障害を避け、独立したテーブルで複数ルータ経由の通信が届く", () => {
  const s = new RoutingSimulator();
  assert.equal(s.routers.size, 20); assert.equal(s.lans.length, 6); assert.equal(s.pcs.length, 8);
  assert.equal(s.nodes.get("router-13").up, false);
  assert.equal(s.between("router-7", "router-8").up, false);
  assert.notEqual(s.routers.get("router-1").db, s.routers.get("router-2").db);
  assertConverged(s);
  const m = s.send("pc-1", "pc-8", "こんにちは！ネットワークの向こうへ。");
  s.advance(30);
  assert.equal(m.status, "delivered"); assert.ok(m.packets.length > 1);
  assert.equal(m.packets.map((p) => p.fragment).join(""), m.text);
  for (const p of m.packets) {
    assert.ok(p.decisions.length >= 4);
    assert.equal(p.path.at(-1), "pc-8");
    assert.ok(!p.path.includes("router-13"));
    assert.ok(p.decisions.every((d) => d.next && d.version > 0));
  }
});

test("切断で転送中パケットが消失し、検知と伝達の後に各ルータが時間差で更新・迂回する", () => {
  const { s, r, lans, send } = diamond();
  const initial = send(); s.advance(12); assert.equal(initial.status, "delivered");
  const inFlight = send(); s.advance(2.5);
  assert.equal(inFlight.packets[0].transit?.to, r[1].id);
  const link = s.between(r[0].id, r[1].id), failedAt = s.time;
  const oldRemoteVersion = s.routers.get(r[3].id).tableVersion;
  s.setLink(link.id, false);
  assert.equal(inFlight.packets[0].status, "lost");
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[1].id);
  const stale = send(); s.advance(TIMING.detect + .1);
  assert.equal(stale.status, "lost");
  assert.match(stale.packets[0].reason, /経路更新待ち/);
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[1].id);
  s.advance(.31);
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[2].id);
  assert.equal(s.routers.get(r[3].id).tableVersion, oldRemoteVersion);
  s.advance(12); assertConverged(s);
  const after = send(); s.advance(15);
  assert.equal(after.status, "delivered"); assert.ok(after.packets[0].path.includes(r[2].id));
  assert.ok(!after.packets[0].path.includes(r[1].id));
  const updates = s.history.filter((h) => h.type === "table" && h.time > failedAt);
  assert.ok(updates.some((h) => h.detail.some((c) => c.before?.next !== c.after?.next)));
  assert.ok(updates.find((h) => h.router === r[3].id).time > updates.find((h) => h.router === r[0].id).time);
});

test("連続送信の実験で消失と後続の到達が両方残り、別経路で通信が回復する", () => {
  const s = new RoutingSimulator();
  s.startRepeating("pc-1", "pc-8", "通信の実験"); s.advance(3);
  s.setLink(s.between("router-1", "router-2").id, false);
  s.advance(35); s.stopRepeating(); s.advance(25);
  assert.ok(s.totals.lost > 0); assert.ok(s.totals.delivered > 0);
  const last = s.messages[0]; assert.equal(last.status, "delivered");
  assert.ok(last.packets[0].path.includes("router-6"));
  assert.ok(!last.packets[0].path.includes("router-2"));
  assert.equal(s.activePackets.length, 0); assertConverged(s);
});

test("ルータ故障・復旧では独立したDBを再学習し、短い故障でも古い制御情報を受け取らない", () => {
  const { s, r, lans, send } = diamond();
  s.setNode(r[1].id, false); s.advance(15); assertConverged(s);
  const m = send(); s.advance(15); assert.equal(m.status, "delivered");
  assert.ok(!m.packets[0].path.includes(r[1].id));
  s.setNode(r[1].id, true);
  assert.equal(s.routers.get(r[1].id).db.size, 0);
  assert.equal(s.routers.get(r[1].id).table.size, 0);
  s.advance(20); assertConverged(s);
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[1].id);
  s.setNode(r[1].id, false); s.advance(.2); s.setNode(r[1].id, true); s.advance(20);
  assertConverged(s);
});

test("ネットワークの分断では到達不能になり、回線の復旧情報が伝わると通信が戻る", () => {
  const { s, r, lans, send } = diamond();
  const a = s.between(r[1].id, r[3].id), b = s.between(r[2].id, r[3].id);
  s.setLink(a.id, false); s.setLink(b.id, false); s.advance(20);
  assert.equal(s.routers.get(r[0].id).table.has(lans[1].id), false);
  const m = send(); s.advance(12); assert.equal(m.status, "lost"); assertConverged(s);
  s.setLink(b.id, true); s.advance(20); assertConverged(s);
  const restored = send(); s.advance(12); assert.equal(restored.status, "delivered");
});

test("LAN・PC・ルータの追加は接続先から広告され、IP自動設定と新しい宛先への通信が動く", () => {
  const { s, r, pcs } = diamond();
  const router = s.addNode("router", 450, 100);
  const lan = s.addNode("lan", 550, 100);
  const pc = s.addNode("pc", 650, 100);
  s.connect(r[3].id, router.id); s.connect(router.id, lan.id); s.connect(lan.id, pc.id);
  assert.equal(pc.address, "10.0.3.10");
  assert.equal(s.routers.get(r[0].id).table.has(lan.id), false);
  s.advance(20); assertConverged(s);
  assert.ok(s.routers.get(r[0].id).table.has(lan.id));
  const m = s.send(pcs[0].id, pc.id, "新しいネットワークへ"); s.advance(20);
  assert.equal(m.status, "delivered");
  assert.ok(m.packets[0].path.includes(router.id));
  s.removeNode(router.id); s.advance(20); assertConverged(s);
  assert.equal(s.routers.get(r[0].id).table.has(lan.id), false);
  s.removeNode(lan.id); assert.equal(pc.address, "未接続"); s.advance(20); assertConverged(s);
});

test("回線コストの変更も即時の全体更新をせず、削除と再接続を含めて最小コストへ収束する", () => {
  const { s, r, lans } = diamond();
  const link = s.between(r[0].id, r[1].id);
  s.setCost(link.id, 9);
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[1].id);
  s.advance(20); assertConverged(s);
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[2].id);
  s.removeLink(link.id); s.advance(20); assertConverged(s);
  s.connect(r[0].id, r[1].id); s.advance(20); assertConverged(s);
  assert.equal(s.routers.get(r[0].id).table.get(lans[1].id).next, r[1].id);
});

test("不正な接続を説明して止め、同じLAN内の通信ではルータを通らない", () => {
  const s = new RoutingSimulator();
  assert.throws(() => s.connect("pc-1", "router-1"), /PCとLAN/);
  assert.throws(() => s.connect("pc-1", "lan-2"), /1つのLAN/);
  assert.throws(() => s.connect("lan-1", "router-2"), /1台のルータ/);
  assert.throws(() => s.connect("router-1", "router-1"), /異なる2台/);
  assert.throws(() => s.send("pc-1", "pc-1", "自分"), /異なる/);
  assert.throws(() => s.send("pc-1", "pc-2", "   "), /メッセージ/);
  const m = s.send("pc-1", "pc-2", "LAN内"); s.advance(8);
  assert.equal(m.status, "delivered"); assert.equal(m.packets[0].decisions.length, 0);
  assert.deepEqual(m.packets[0].path, ["pc-1", "lan-1", "pc-2"]);
});

test("更新途中の循環はTTLで終了し、一部消失したメッセージを受信完了にしない", () => {
  const { s, r, lans, send } = diamond();
  const route = s.routers.get(r[0].id).table.get(lans[1].id);
  s.routers.get(r[0].id).table.set(lans[1].id, { ...route, next: r[1].id });
  s.routers.get(r[1].id).table.set(lans[1].id, { ...route, next: r[0].id });
  const m = send("長いメッセージを複数のパケットに分けて送ります"); s.advance(80);
  assert.equal(m.status, "lost"); assert.equal(s.activePackets.length, 0);
  assert.ok(m.packets.every((p) => /TTL/.test(p.reason)));
});

test("受信先の削除を遠くのルータが即座に知ることはなく、他のPCのIPも変わらない", () => {
  const s = new RoutingSimulator();
  const m = s.send("pc-1", "pc-8", "宛先の削除");
  s.advance(.2); s.removeNode("pc-8");
  assert.equal(s.name("pc-8"), "PC-H");
  assert.equal(m.packets[0].status, "active");
  s.advance(25);
  assert.equal(m.status, "lost");
  assert.equal(m.packets[0].current, "lan-6");
  assert.match(m.packets[0].reason, /宛先LAN/);
  const address = s.nodes.get("pc-2").address;
  s.removeNode("pc-1");
  assert.equal(s.nodes.get("pc-2").address, address);
});

test("LAN内の転送はTTLを減らさず、一片だけ失われた場合もメッセージの受信は失敗する", () => {
  const s = new RoutingSimulator();
  const m = s.send("pc-1", "pc-2", "abcdefghijklmnopqrstuvwx");
  s.advance(2);
  assert.equal(m.packets[0].status, "delivered");
  assert.equal(m.packets[0].ttl, 32);
  assert.equal(m.packets[1].status, "active");
  s.setLink(s.between("lan-1", "pc-2").id, false);
  assert.equal(m.packets[1].status, "lost");
  assert.equal(m.status, "lost");
  assert.equal(s.totals.delivered, 1); assert.equal(s.totals.lost, 1);
});

test("ステップ実行と時間経過は同じイベント結果になり、履歴・パケットの保存数を制限する", () => {
  const a = new RoutingSimulator(), b = new RoutingSimulator();
  const m = a.send("pc-1", "pc-8", "イベントテスト"); b.send("pc-1", "pc-8", "イベントテスト");
  a.advance(30);
  while (b.events.length) b.step();
  assert.deepEqual(a.packets.map((p) => [p.status, p.path, p.decisions]), b.packets.map((p) => [p.status, p.path, p.decisions]));
  for (let i = 0; i < 200; i++) { a.send("pc-1", "pc-2", "テスト"); a.advance(3); }
  assert.ok(a.packets.length <= 201); assert.ok(a.messages.length <= 80); assert.ok(a.history.length <= 600);
  assert.equal(a.totals.delivered, 200 + m.packets.length);
  assert.ok(a.totals.delivered > a.packets.length);
});

test("複数の障害・復旧・コスト変更後、20台すべての局所計算が物理グラフの正解と一致する", () => {
  const s = new RoutingSimulator();
  let seed = 731;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let round = 0; round < 12; round++) {
    const routerLinks = [...s.links.values()].filter((l) => s.nodes.get(l.a).kind === "router" && s.nodes.get(l.b).kind === "router");
    for (let i = 0; i < 3; i++) { const link = routerLinks[Math.floor(random() * routerLinks.length)]; s.setLink(link.id, !link.up); }
    const router = [...s.routers.keys()][Math.floor(random() * s.routers.size)]; s.setNode(router, !s.nodes.get(router).up);
    const link = routerLinks[Math.floor(random() * routerLinks.length)]; s.setCost(link.id, 1 + Math.floor(random() * 9));
    s.advance(40); assertConverged(s);
  }
});

test("Lab一覧に登録し、未公開設定とローカル資産を維持する", async () => {
  assert.ok(contents.some((c) => c.id === "packet-routing" && c.group === "network"));
  const page = await readFile(new URL("../lab/packet-routing/index.html", import.meta.url), "utf8");
  const index = await readFile(new URL("../lab/index.html", import.meta.url), "utf8");
  assert.match(index, /href="\.\/packet-routing\/"/);
  assert.match(page, /name="robots" content="noindex, nofollow"/);
  assert.ok(!page.includes("site-header.js"));
  assert.ok(!/src="https?:/.test(page));
});
