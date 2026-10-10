import { RoutingSimulator, TIMING } from "./simulator.mjs";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const svgNS = "http://www.w3.org/2000/svg";
let sim = new RoutingSimulator();
let playing = false, speed = 1, mode = "select", connectStart = null;
let selected = { kind: "node", id: "router-1" }, packetId = "";
let dirty = true, lastRevision = -1, lastUI = 0, lastFrame = performance.now();
const camera = { x: 0, y: 0, w: 1240, h: 650 };
const nodeElements = new Map(), linkElements = new Map();
let pickerSignature = null, packetSignature = null, inspectorHTML = "", historyHTML = "", messagesHTML = "", traceHTML = "";

function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("is-error", error);
}
function attempt(action) {
  try { action(); dirty = true; }
  catch (error) { status(error.message, true); }
}
function setPlaying(value) {
  playing = value;
  $("play").textContent = value ? "Ⅱ 一時停止" : "▶ 再生";
  $("play").setAttribute("aria-pressed", String(value));
  lastFrame = performance.now();
}

function updateCamera() {
  $("network").setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  for (const [key, value] of Object.entries({ x: camera.x, y: camera.y, width: camera.w, height: camera.h })) $("background").setAttribute(key, value);
}
function fit() {
  const nodes = [...sim.nodes.values()];
  const bounds = {
    left: Math.min(0, ...nodes.map((n) => n.x - 65)), right: Math.max(1240, ...nodes.map((n) => n.x + 65)),
    top: Math.min(-10, ...nodes.map((n) => n.y - 65)), bottom: Math.max(650, ...nodes.map((n) => n.y + 65)),
  };
  const aspect = $("network").clientWidth / $("network").clientHeight;
  camera.w = Math.max(bounds.right - bounds.left, (bounds.bottom - bounds.top) * aspect);
  camera.h = camera.w / aspect;
  camera.x = (bounds.left + bounds.right - camera.w) / 2;
  camera.y = (bounds.top + bounds.bottom - camera.h) / 2;
  updateCamera();
}
function stopFollowing() { $("follow").checked = false; }
function zoom(factor, point = { x: camera.x + camera.w / 2, y: camera.y + camera.h / 2 }) {
  const width = Math.max(240, Math.min(4000, camera.w * factor));
  const ratio = width / camera.w;
  camera.x = point.x - (point.x - camera.x) * ratio;
  camera.y = point.y - (point.y - camera.y) * ratio;
  camera.w = width;
  camera.h *= ratio;
  updateCamera();
}
function worldPoint(event) {
  const rect = $("network").getBoundingClientRect();
  return { x: camera.x + (event.clientX - rect.left) / rect.width * camera.w, y: camera.y + (event.clientY - rect.top) / rect.height * camera.h };
}

function updatePickers() {
  const signature = [...sim.nodes.values()].map((n) => `${n.id}:${n.address ?? ""}`).join("|") + [...sim.links.keys()].join("|");
  if (signature === pickerSignature) return;
  pickerSignature = signature;
  const pcOptions = sim.pcs.map((pc) => `<option value="${pc.id}">${esc(pc.label)} · ${esc(sim.lanForPC(pc.id)?.label ?? "未接続")}</option>`).join("");
  for (const id of ["source", "destination"]) {
    const previous = $(id).value;
    $(id).innerHTML = pcOptions;
    if (sim.nodes.has(previous)) $(id).value = previous;
    else $(id).value = id === "source" ? sim.pcs[0]?.id ?? "" : sim.pcs.at(-1)?.id ?? "";
  }
  const nodeOptions = ["router", "lan", "pc"].map((kind) => `<optgroup label="${{ router: "ルータ", lan: "LAN", pc: "PC" }[kind]}">${[...sim.nodes.values()].filter((n) => n.kind === kind).map((n) => `<option value="node:${n.id}">${esc(n.label)}</option>`).join("")}</optgroup>`).join("");
  const linkOptions = [...sim.links.values()].map((l) => `<option value="link:${l.id}">${esc(sim.name(l.a))} ↔ ${esc(sim.name(l.b))}</option>`).join("");
  $("selection").innerHTML = `${nodeOptions}<optgroup label="回線">${linkOptions}</optgroup>`;
  if (!sim.nodes.has(selected.id) && !sim.links.has(selected.id)) selected = { kind: "node", id: sim.nodes.keys().next().value ?? "" };
  $("selection").value = `${selected.kind}:${selected.id}`;
  $("send").disabled = sim.pcs.length < 2;
  $("repeat").disabled = sim.pcs.length < 2 && !sim.repeating;
}

function renderDiagram() {
  for (const [id, el] of linkElements) if (!sim.links.has(id)) { el.remove(); linkElements.delete(id); }
  for (const link of sim.links.values()) {
    const a = sim.nodes.get(link.a), b = sim.nodes.get(link.b);
    let group = linkElements.get(link.id);
    if (!group) {
      group = document.createElementNS(svgNS, "g");
      group.innerHTML = `<line class="network-link"/><line class="link-hit" data-link="${link.id}" role="button" tabindex="0"/><text class="link-cross" text-anchor="middle">×</text>`;
      $("links").append(group); linkElements.set(link.id, group);
    }
    const lines = group.querySelectorAll("line");
    for (const line of lines) for (const [key, value] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) line.setAttribute(key, value);
    lines[0].classList.toggle("is-down", !sim.linkUsable(link));
    lines[0].classList.toggle("is-selected", selected.kind === "link" && selected.id === link.id);
    lines[1].setAttribute("aria-label", `${a.label}と${b.label}の回線、${sim.linkUsable(link) ? "接続中" : "切断・機器故障"}、選択して操作`);
    const cross = group.querySelector("text");
    cross.setAttribute("x", (a.x + b.x) / 2); cross.setAttribute("y", (a.y + b.y) / 2 + 8);
    cross.style.display = !link.up ? "" : "none";
  }
  for (const [id, el] of nodeElements) if (!sim.nodes.has(id)) { el.remove(); nodeElements.delete(id); }
  for (const node of sim.nodes.values()) {
    let group = nodeElements.get(node.id);
    if (!group) {
      group = document.createElementNS(svgNS, "g");
      group.setAttribute("data-node", node.id); group.setAttribute("tabindex", "0"); group.setAttribute("role", "button");
      const body = node.kind === "router" ? '<circle class="device-body" r="22"/>' : '<rect class="device-body" x="-28" y="-20" width="56" height="40" rx="8"/>';
      group.innerHTML = `<circle class="selection-ring" r="32" fill="none"/><circle class="endpoint-ring" r="36" fill="none"/>${body}${node.kind === "router" ? `<text text-anchor="middle" y="6">${esc(node.label)}</text>` : node.kind === "lan" ? '<text text-anchor="middle" y="6" style="font-size:14px">LAN</text>' : '<path class="node-icon" d="M-14 -11H14V7H-14ZM0 7V13M-10 13H10"/>'}${node.kind !== "router" ? `<text class="node-label" text-anchor="middle" y="42">${esc(node.label)}</text>` : ""}<text class="fault-mark" x="20" y="-20">×</text>`;
      $("devices").append(group); nodeElements.set(node.id, group);
    }
    group.setAttribute("transform", `translate(${node.x} ${node.y})`);
    group.setAttribute("class", `device ${node.kind}${!node.up ? " is-down" : ""}${(selected.kind === "node" && selected.id === node.id) || connectStart === node.id ? " is-selected" : ""}${node.id === $("source").value ? " is-source" : ""}${node.id === $("destination").value ? " is-destination" : ""}`);
    group.setAttribute("aria-label", `${node.label}、${node.up ? "稼働中" : "故障中"}、選択して操作`);
    group.querySelector(".fault-mark").style.display = node.up ? "none" : "";
  }
}

function tableHTML(node) {
  const state = sim.routers.get(node.id);
  const networks = new Map(sim.lans.map((n) => [n.id, n]));
  for (const lsa of state.db.values()) for (const lan of lsa.networks) networks.set(lan.id, lan);
  for (const route of state.table.values()) networks.set(route.id, route);
  const lastChange = sim.history.find((h) => h.type === "table" && h.router === node.id);
  const recentlyChanged = sim.time - (lastChange?.time ?? -100) < 3 ? new Set(lastChange.detail.map((c) => c.network)) : new Set();
  const destinationLAN = sim.lanForPC($("destination").value)?.id;
  return `<h4 class="routing-table-title">ルーティングテーブル</h4><p class="table-meta">v${state.tableVersion} · 更新 ${state.updatedAt.toFixed(1)}秒 · ${state.db.size}台のルータ情報${node.up ? "" : " · 停止中"}</p><div class="table-scroll" tabindex="0" role="region" aria-label="${esc(node.label)}のルーティングテーブル"><table class="routing-table"><thead><tr><th scope="col">宛先のLAN</th><th scope="col">次に送る先</th><th scope="col">コスト</th></tr></thead><tbody>${[...networks.values()].map((lan) => {
    const route = state.table.get(lan.id);
    return `<tr class="${lan.id === destinationLAN ? "is-target " : ""}${recentlyChanged.has(lan.id) ? "is-changed" : ""}"><td>${esc(lan.label)}<small>${esc(lan.prefix)}</small></td><td class="${route ? "" : "unreachable"}">${route ? esc(sim.name(route.next)) + (route.next === lan.id ? "<small>直接接続</small>" : "") : "経路なし"}</td><td>${route?.cost ?? "—"}</td></tr>`;
  }).join("") || '<tr><td colspan="3">まだLANの情報がありません</td></tr>'}</tbody></table></div><p class="selection-note">宛先PCが属するLANを見て、次の転送先を選びます。コストは回線の重みの合計。黄色の行は直近の更新です。${node.up ? "" : " このルータは故障中のため転送できません。"}</p>`;
}

function renderInspector() {
  let html = "";
  if (!(selected.kind === "node" ? sim.nodes.has(selected.id) : sim.links.has(selected.id))) {
    $("selection-detail").innerHTML = '<p class="muted">機器を追加すると、ここで選択して操作できます。</p>'; inspectorHTML = ""; return;
  }
  if (selected.kind === "node") {
    const node = sim.nodes.get(selected.id);
    if (!node) return;
    html = `<div class="device-title"><h3>${esc(node.label)}</h3><span class="badge ${node.up ? "" : "down"}">${node.up ? "稼働中" : "故障中"}</span></div>`;
    if (node.kind === "router") html += '<p class="device-meta">宛先に応じて次の送り先を判断する中継役</p>';
    if (node.kind === "lan") html += `<p class="device-meta">ネットワーク ${esc(node.prefix)}</p>`;
    if (node.kind === "pc") html += `<p class="device-meta">IP ${esc(node.address)}<br />所属：${esc(sim.lanForPC(node.id)?.label ?? "未接続")}</p>`;
    html += `<div class="selection-actions"><button type="button" data-action="toggle-node" class="${node.up ? "danger" : "primary"}">${node.up ? "故障させる" : "復旧する"}</button>${node.kind === "pc" ? '<button type="button" data-action="set-source">送信元にする</button><button type="button" data-action="set-destination">宛先にする</button>' : ""}<button type="button" data-action="remove-node">削除</button></div>`;
    if (node.kind === "router") html += tableHTML(node);
    else html += `<p class="selection-note">接続先：${sim.edges(node.id, false).map((l) => esc(sim.name(sim.other(l, node.id))) + (!l.up ? "（切断）" : "")).join("、") || "なし"}</p>`;
  } else {
    const link = sim.links.get(selected.id);
    if (!link) return;
    html = `<div class="device-title"><h3>${esc(sim.name(link.a))} ↔ ${esc(sim.name(link.b))}</h3></div><p class="device-meta"><span class="badge ${sim.linkUsable(link) ? "" : "down"}">${!link.up ? "切断中" : sim.linkUsable(link) ? "接続中" : "機器が故障中"}</span></p><div class="selection-actions"><button type="button" class="${link.up ? "danger" : "primary"}" data-action="toggle-link">${link.up ? "切断する" : "復旧する"}</button><button type="button" data-action="remove-link">回線を削除</button></div><label class="link-cost">回線コスト<select id="link-cost">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}"${link.cost === i + 1 ? " selected" : ""}>${i + 1}</option>`).join("")}</select></label><p class="selection-note">コストを大きくすると、この回線を通る経路が選ばれにくくなります。変更の情報もルータ間に伝わるまで時間がかかります。</p>`;
  }
  if (html !== inspectorHTML && document.activeElement?.id !== "link-cost") {
    const scroll = $("selection-detail").querySelector(".table-scroll")?.scrollTop ?? 0;
    const focusedAction = $("selection-detail").contains(document.activeElement) ? document.activeElement?.dataset.action : null;
    const tableFocused = document.activeElement?.classList.contains("table-scroll");
    $("selection-detail").innerHTML = html; inspectorHTML = html;
    if (focusedAction) $("selection-detail").querySelector(`[data-action="${focusedAction}"]`)?.focus({ preventScroll: true });
    if (tableFocused) $("selection-detail").querySelector(".table-scroll")?.focus({ preventScroll: true });
    const table = $("selection-detail").querySelector(".table-scroll"); if (table) table.scrollTop = scroll;
  }
}

function selectedPacket() { return sim.packets.find((p) => p.id === packetId); }
function packetPosition(packet) {
  const transit = packet.transit;
  if (!transit) return sim.nodes.get(packet.current);
  const from = sim.nodes.get(transit.from), to = sim.nodes.get(transit.to);
  if (!from || !to) return null;
  const progress = Math.min(1, Math.max(0, (sim.time - transit.start) / (transit.end - transit.start)));
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}

function renderTrace() {
  const signature = sim.packets.map((p) => `${p.id}:${p.status}`).join("|");
  if (signature !== packetSignature) {
    packetSignature = signature;
    $("packet-select").innerHTML = '<option value="">パケットを選択</option>' + [...sim.packets].reverse().map((p) => `<option value="${p.id}">${p.id} · ${p.message.id} (${p.index}/${p.total}) · ${{ active: "通信中", delivered: "到達", lost: "消失" }[p.status]}</option>`).join("");
    if (packetId && !sim.packets.some((p) => p.id === packetId)) packetId = sim.packets.at(-1)?.id ?? "";
    $("packet-select").value = packetId;
  }
  const packet = selectedPacket();
  if (!packet) { $("follow").disabled = true; $("follow").checked = false; if (traceHTML) { $("packet-detail").innerHTML = '<p class="muted">送信したパケットの通過経路と、ルータの判断を確認できます。</p>'; traceHTML = ""; } return; }
  $("follow").disabled = false;
  const html = `<div class="packet-title"><strong>${packet.id} · ${packet.index}/${packet.total}</strong><span class="badge ${packet.status}">${{ active: "通信中", delivered: "到達", lost: "消失" }[packet.status]}</span></div><p class="muted">${esc(sim.name(packet.source))} → ${esc(sim.name(packet.destination))}<br />宛先IP ${esc(packet.destinationAddress)}</p><p class="packet-fragment">「${esc(packet.fragment)}」</p><p class="packet-path">${packet.path.map((id) => esc(sim.name(id))).join(" → ")}${packet.transit ? " → " + esc(sim.name(packet.transit.to)) + "（移動中）" : ""}</p>${packet.reason ? `<p class="danger-text muted">${esc(packet.reason)}</p>` : ""}<ol class="packet-decisions">${packet.decisions.map((d) => `<li>${d.time.toFixed(1)}秒：${esc(sim.name(d.router))} → ${esc(d.next ? sim.name(d.next) : "経路なし")} <span class="muted">(v${d.version})</span></li>`).join("")}</ol>`;
  if (html !== traceHTML) { $("packet-detail").innerHTML = html; traceHTML = html; }
}

function renderMessages() {
  if (!sim.messages.length) return;
  const html = sim.messages.slice(0, 20).map((message) => `<article class="message-row"><div class="message-heading"><strong>${message.id} · ${esc(sim.name(message.source))} → ${esc(sim.name(message.destination))}</strong><span class="badge ${message.status}">${{ active: "通信中", delivered: "受信完了", lost: "受信失敗" }[message.status]}</span></div><p>${message.status === "delivered" ? "受信：" : "送信："}「${esc(message.text)}」</p><div class="packet-chips">${message.packets.map((p) => `<button type="button" data-packet="${p.id}" class="${p.status}" aria-label="${p.id}、${{ active: "通信中", delivered: "到達", lost: "消失" }[p.status]}、経路を表示">${p.id} ${p.status === "delivered" ? "✓" : p.status === "lost" ? "×" : "…"}</button>`).join("")}</div></article>`).join("");
  if (html !== messagesHTML) {
    const scroll = $("messages").scrollTop;
    $("messages").innerHTML = html; $("messages").scrollTop = scroll; messagesHTML = html;
  }
}

function renderHistory() {
  const filter = $("history-filter").value;
  const records = sim.history.filter((h) => filter === "all" || (filter === "selected" && h.router === selected.id) || (filter === "updates" && ["ready", "fault", "edit", "detect", "receive", "table"].includes(h.type)) || (filter === "packets" && ["send", "forward", "delivered", "lost"].includes(h.type))).slice(0, 100);
  const html = records.map((h) => `<div class="history-row ${h.type}" data-history="${h.id}"><time>${h.time.toFixed(1)}s</time><div>${esc(h.text)}${h.detail ? `<details><summary>変更した経路（${h.detail.length}件）</summary>${h.detail.map((c) => `<div>${esc(c.after?.label ?? c.before?.label ?? c.network)}：${c.before ? esc(sim.name(c.before.next)) + " / " + c.before.cost : "経路なし"} → ${c.after ? esc(sim.name(c.after.next)) + " / " + c.after.cost : "経路なし"}</div>`).join("")}</details>` : ""}</div></div>`).join("") || '<p class="empty-state">この種類の履歴はまだありません。</p>';
  if (html !== historyHTML) {
    const open = [...$("history").querySelectorAll("details[open]")].map((el) => el.closest("[data-history]").dataset.history);
    const scroll = $("history").scrollTop;
    $("history").innerHTML = html; historyHTML = html;
    for (const id of open) { const el = $("history").querySelector(`[data-history="${id}"] details`); if (el) el.open = true; }
    $("history").scrollTop = scroll;
  }
}

function renderUI() {
  updatePickers(); renderDiagram(); renderInspector(); renderTrace(); renderMessages(); renderHistory();
  $("active-count").textContent = sim.activePackets.length;
  $("delivered-count").textContent = sim.totals.delivered;
  $("lost-count").textContent = sim.totals.lost;
  $("update-state").textContent = sim.pendingUpdates ? `経路情報を更新中 · ${sim.pendingUpdates}件` : "経路情報は安定";
  $("update-state").classList.toggle("is-updating", !!sim.pendingUpdates);
  $("repeat").textContent = sim.repeating ? "連続送信を停止" : "連続送信";
  $("repeat").setAttribute("aria-pressed", String(!!sim.repeating));
  dirty = false; lastRevision = sim.revision;
}

function renderMotion() {
  const signals = [];
  for (const p of sim.activePackets) {
    const point = packetPosition(p);
    if (!point || sim.time < p.createdAt + (p.index - 1) * TIMING.fragment) continue;
    const offset = p.transit ? 0 : (p.index - 1) * 6;
    signals.push(`<circle class="signal-data" cx="${point.x + offset}" cy="${point.y - 6 - offset}" r="${p.id === packetId ? 7 : 5}"/>`);
    if (p.id === packetId || sim.activePackets.length < 7) signals.push(`<text class="signal-label" x="${point.x + 10 + offset}" y="${point.y - 12 - offset}">${p.id}</text>`);
  }
  const unique = new Set();
  for (const e of sim.events) {
    if (e.type !== "lsa" || e.at - sim.time > TIMING.flood || !sim.linkUsable(sim.links.get(e.data.link))) continue;
    const key = `${e.data.from}:${e.data.to}`;
    if (unique.has(key)) continue;
    unique.add(key);
    const from = sim.nodes.get(e.data.from), to = sim.nodes.get(e.data.to);
    if (!from || !to) continue;
    const t = Math.max(0, 1 - (e.at - sim.time) / TIMING.flood);
    const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
    signals.push(`<rect class="signal-update" x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})"/>`);
  }
  for (const p of sim.packets) if (p.status === "lost" && sim.time - p.endedAt < 1.4) {
    const point = sim.nodes.get(p.lostTransit?.from ?? p.current);
    if (point) signals.push(`<text class="signal-lost" x="${point.x + 10}" y="${point.y - 20}">×</text>`);
  }
  $("signals").innerHTML = signals.join("");
  const notices = [...sim.routers.entries()].filter(([id, state]) => sim.nodes.get(id)?.up && state.notice?.until > sim.time).sort(([idA, a], [idB, b]) => Number(idB === selected.id) - Number(idA === selected.id) || Number(b.notice.packet === packetId) - Number(a.notice.packet === packetId) || b.notice.until - a.notice.until).slice(0, 4);
  const bubbleBoxes = [];
  $("bubbles").innerHTML = notices.map(([id, state]) => {
    const n = sim.nodes.get(id), text = Array.from(state.notice.text).slice(0, 28).join("");
    const width = Math.max(125, Array.from(text).reduce((sum, char) => sum + (char.codePointAt(0) > 255 ? 13 : 7), 20));
    const x = n.x - width / 2; let y = n.y - 62;
    while (bubbleBoxes.some((box) => x < box.x + box.width + 5 && x + width + 5 > box.x && y < box.y + 29 && y + 29 > box.y)) y -= 32;
    bubbleBoxes.push({ x, y, width });
    return `<g class="bubble ${state.notice.type}"><line x1="${n.x}" y1="${n.y - 24}" x2="${n.x}" y2="${y + 26}" stroke="${state.notice.type === "update" ? "#805000" : "#102f35"}" stroke-width="1"/><rect x="${x}" y="${y}" width="${width}" height="26" rx="6"/><text x="${n.x}" y="${y + 18}" text-anchor="middle">${esc(text)}</text></g>`;
  }).join("");
  const p = selectedPacket();
  const path = p ? [...p.path, ...(p.transit ? [p.transit.to] : [])] : sim.forecast($("source").value, $("destination").value);
  $("route").innerHTML = path.slice(1).map((id, i) => {
    const from = sim.nodes.get(path[i]), to = sim.nodes.get(id);
    return from && to ? `<line class="route-line ${p ? "" : "forecast"}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>` : "";
  }).join("");
  if ($("follow").checked && p?.status === "active") {
    const pos = packetPosition(p);
    if (pos) { camera.x = pos.x - camera.w / 2; camera.y = pos.y - camera.h / 2; updateCamera(); }
  }
  $("time").textContent = sim.time.toFixed(1);
}

function selectNode(id) {
  if (mode === "connect") {
    if (!connectStart) { connectStart = id; status(`${sim.name(id)}を選択。接続するもう1台を選んでください。`); }
    else attempt(() => { const from = connectStart; sim.connect(from, id); connectStart = null; status(`${sim.name(from)}と${sim.name(id)}を接続しました。経路情報の変化を観察できます。`); });
  }
  selected = { kind: "node", id }; $("selection").value = `node:${id}`; $("selection").closest(".inspector").scrollTop = 0; dirty = true;
}
function selectLink(id) { selected = { kind: "link", id }; $("selection").value = `link:${id}`; $("selection").closest(".inspector").scrollTop = 0; dirty = true; }
function selectPacket(id) { packetId = id; $("packet-select").value = id; dirty = true; }
function setMode(value) {
  mode = value; connectStart = null;
  for (const button of document.querySelectorAll("[data-mode]")) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  $("network").classList.toggle("is-editing", mode !== "select");
  $("mode-hint").textContent = mode === "connect" ? "接続する2台の機器を順に選択" : mode === "select" ? "＋で拡大 / 機器・回線を選択 / 余白をドラッグで移動" : "図の余白を選んで追加";
  if (mode !== "select") status(mode === "connect" ? "接続する2台を選択。PC—LAN、LAN—ルータ、ルータ—ルータを接続できます。" : "図の余白を選ぶと機器を追加できます。IPアドレスは接続時に自動設定します。");
  dirty = true;
}

$("send-form").addEventListener("submit", (e) => {
  e.preventDefault(); attempt(() => {
    const message = sim.send($("source").value, $("destination").value, $("message").value);
    selectPacket(message.packets[0].id); setPlaying(true);
    status(`${message.id}を${message.packets.length}個のパケットに分けて送信しました。機器や回線を選んで実験できます。`);
  });
});
$("repeat").addEventListener("click", () => attempt(() => {
  if (sim.repeating) { sim.stopRepeating(); status("連続送信を停止しました。通信中のパケットは転送を続けます。"); }
  else { const m = sim.startRepeating($("source").value, $("destination").value, $("message").value); selectPacket(m.packets[0].id); setPlaying(true); status("2.8実験秒ごとに連続送信中。経路上の回線を切って、前後のパケットを比べてみよう。"); }
}));
for (const id of ["source", "destination"]) $(id).addEventListener("change", () => { if (sim.repeating) { sim.stopRepeating(); status("送信設定を変更したため、連続送信を停止しました。新しい設定で再開できます。"); } dirty = true; packetId = ""; $("packet-select").value = ""; });
$("play").addEventListener("click", () => setPlaying(!playing));
$("step").addEventListener("click", () => { setPlaying(false); sim.step(); dirty = true; status("次のイベントまで進めました。パケット到着・検知・情報受信・テーブル更新を1段階ずつ観察できます。"); });
$("speed").addEventListener("change", () => { speed = Number($("speed").value); });
$("zoom-in").addEventListener("click", () => { stopFollowing(); zoom(0.75); });
$("zoom-out").addEventListener("click", () => { stopFollowing(); zoom(1.33); });
$("fit").addEventListener("click", () => { stopFollowing(); fit(); });
$("follow").addEventListener("change", () => { if ($("follow").checked) zoom(Math.min(1, 650 / camera.w)); });
$("reset").addEventListener("click", () => {
  setPlaying(false); sim = new RoutingSimulator(); selected = { kind: "node", id: "router-1" }; packetId = ""; setMode("select"); stopFollowing();
  pickerSignature = packetSignature = null; inspectorHTML = historyHTML = messagesHTML = traceHTML = "";
  $("source").innerHTML = $("destination").innerHTML = "";
  $("messages").innerHTML = '<p class="empty-state">最初のメッセージを送ってみよう。<br />パケットをすべて受信できたか、ここに表示します。</p>';
  $("packet-detail").innerHTML = '<p class="muted">送信したパケットの通過経路と、ルータの判断を確認できます。</p>';
  for (const el of [...nodeElements.values(), ...linkElements.values()]) el.remove(); nodeElements.clear(); linkElements.clear();
  dirty = true; fit(); status("ネットワークと実験結果を初期状態に戻しました。");
});
for (const button of document.querySelectorAll("[data-mode]")) button.addEventListener("click", () => setMode(button.dataset.mode));
$("selection").addEventListener("change", () => { const [kind, id] = $("selection").value.split(":"); if (kind === "node") selectNode(id); else selectLink(id); });
$("packet-select").addEventListener("change", () => selectPacket($("packet-select").value));
$("history-filter").addEventListener("change", () => { historyHTML = ""; dirty = true; });
$("messages").addEventListener("click", (e) => { const button = e.target.closest("[data-packet]"); if (button) { selectPacket(button.dataset.packet); $("inspector-heading").closest(".inspector").scrollTop = 10000; status(`${button.dataset.packet}の経路と判断を表示しています。`); } });
$("selection-detail").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  attempt(() => {
    const node = sim.nodes.get(selected.id), link = sim.links.get(selected.id);
    if (action === "toggle-node") { sim.setNode(node.id, !node.up); status(`${node.label}を${node.up ? "復旧" : "故障"}しました。周辺のルータが検知してから経路情報を伝えます。`); }
    if (action === "toggle-link") { sim.setLink(link.id, !link.up); status(`回線を${link.up ? "復旧" : "切断"}しました。テーブルに変化が伝わるまでのパケットを観察してみよう。`); }
    if (action === "remove-node") { sim.removeNode(node.id); pickerSignature = null; status(`${node.label}を削除しました。`); }
    if (action === "remove-link") { sim.removeLink(link.id); pickerSignature = null; status("回線を削除しました。「回線を接続」でつなぎ直せます。"); }
    if (action === "set-source") { sim.stopRepeating(); $("source").value = node.id; packetId = ""; status(`${node.label}を送信元にしました。`); }
    if (action === "set-destination") { sim.stopRepeating(); $("destination").value = node.id; packetId = ""; status(`${node.label}を宛先にしました。`); }
  });
});
$("selection-detail").addEventListener("change", (e) => { if (e.target.id === "link-cost") attempt(() => { sim.setCost(selected.id, Number(e.target.value)); status("回線コストを変更しました。経路の再計算と更新を待って観察できます。"); }); });
$("break-route").addEventListener("click", () => attempt(() => {
  const path = sim.forecast($("source").value, $("destination").value);
  const links = path.slice(1).map((id, i) => sim.between(path[i], id)).filter((l) => l && sim.linkUsable(l) && sim.nodes.get(l.a)?.kind === "router" && sim.nodes.get(l.b)?.kind === "router");
  const movingLink = sim.activePackets.map((p) => sim.links.get(p.transit?.link)).find((l) => links.includes(l));
  const link = movingLink ?? links[0];
  if (!link) throw new Error("選択したPC間に切断できるルータ間の経路がありません。送信元・宛先や接続を確認してください。");
  sim.setLink(link.id, false); selectLink(link.id); status(`${sim.name(link.a)} ↔ ${sim.name(link.b)}を切断。連続送信で、更新前の消失と更新後の迂回を比べてみよう。`);
}));

const pointers = new Map();
let drag = null, pinch = null;
$("network").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  $("network").setPointerCapture(e.pointerId);
  if (pointers.size === 2) { drag = null; pinch = null; stopFollowing(); return; }
  const target = e.target.closest("[data-node], [data-link]");
  const node = target?.dataset.node ? sim.nodes.get(target.dataset.node) : null;
  drag = { pointer: e.pointerId, target, node: mode === "select" ? node : null, clientX: e.clientX, clientY: e.clientY, originalX: node?.x, originalY: node?.y, cameraX: camera.x, cameraY: camera.y, moved: false };
});
$("network").addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
    const center = { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 };
    if (pinch) {
      zoom(pinch.distance / Math.max(1, distance), worldPoint(center));
      camera.x -= (center.clientX - pinch.x) / $("network").clientWidth * camera.w;
      camera.y -= (center.clientY - pinch.y) / $("network").clientHeight * camera.h;
      updateCamera();
    }
    pinch = { distance, x: center.clientX, y: center.clientY }; return;
  }
  if (!drag || drag.pointer !== e.pointerId) return;
  const dx = e.clientX - drag.clientX, dy = e.clientY - drag.clientY;
  if (Math.hypot(dx, dy) > 5) drag.moved = true;
  if (!drag.moved) return;
  $("network").classList.add("is-dragging");
  const wx = dx / $("network").clientWidth * camera.w, wy = dy / $("network").clientHeight * camera.h;
  if (drag.node) { drag.node.x = drag.originalX + wx; drag.node.y = drag.originalY + wy; renderDiagram(); }
  else { stopFollowing(); camera.x = drag.cameraX - wx; camera.y = drag.cameraY - wy; updateCamera(); }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (e.type !== "pointercancel" && drag && drag.pointer === e.pointerId && !drag.moved) {
    if (drag.target?.dataset.node) selectNode(drag.target.dataset.node);
    else if (drag.target?.dataset.link) selectLink(drag.target.dataset.link);
    else if (["pc", "lan", "router"].includes(mode)) attempt(() => { const point = worldPoint(e), node = sim.addNode(mode, point.x, point.y); selected = { kind: "node", id: node.id }; setMode("select"); status(`${node.label}を追加しました。「回線を接続」でネットワークにつなげてみよう。`); });
  }
  drag = null; pinch = null; $("network").classList.remove("is-dragging");
}
$("network").addEventListener("pointerup", endPointer);
$("network").addEventListener("pointercancel", endPointer);
$("network").addEventListener("wheel", (e) => { e.preventDefault(); stopFollowing(); zoom(e.deltaY > 0 ? 1.1 : 0.9, worldPoint(e)); }, { passive: false });
$("network").addEventListener("keydown", (e) => {
  const nodeId = e.target.closest("[data-node]")?.dataset.node, linkId = e.target.closest("[data-link]")?.dataset.link;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (nodeId) selectNode(nodeId); else if (linkId) selectLink(linkId); }
  if (e.key === "Enter" && !nodeId && !linkId && ["pc", "lan", "router"].includes(mode)) attempt(() => { const node = sim.addNode(mode, camera.x + camera.w / 2, camera.y + camera.h / 2); selected = { kind: "node", id: node.id }; setMode("select"); status(`${node.label}を図の中央に追加しました。`); });
  if (e.key === "Escape") { setMode("select"); status("選択・移動モードに戻しました。"); }
  if (e.key === "+" || e.key === "=") { e.preventDefault(); stopFollowing(); zoom(.8); }
  if (e.key === "-") { e.preventDefault(); stopFollowing(); zoom(1.25); }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault(); stopFollowing();
    const x = e.key === "ArrowLeft" ? -25 : e.key === "ArrowRight" ? 25 : 0, y = e.key === "ArrowUp" ? -25 : e.key === "ArrowDown" ? 25 : 0;
    if (nodeId) { const n = sim.nodes.get(nodeId); n.x += x; n.y += y; dirty = true; }
    else { camera.x += x; camera.y += y; updateCamera(); }
  }
});
let previousWidth = $("network").clientWidth;
new ResizeObserver(() => { const width = $("network").clientWidth; if (Math.abs(width - previousWidth) > 1) { previousWidth = width; fit(); } }).observe($("network"));

setMode("select"); renderUI(); fit();
function frame(now) {
  const elapsed = Math.min(.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (playing) sim.advance(elapsed * speed);
  if (now - lastUI > 120 && (dirty || lastRevision !== sim.revision || playing)) { renderUI(); lastUI = now; }
  renderMotion(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
