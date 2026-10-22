import { RoutingSimulator, TIMING } from "./simulator.mjs";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const svgNS = "http://www.w3.org/2000/svg";
let sim = new RoutingSimulator();
let mode = "select", connectStart = null;
let selected = { kind: "node", id: "" }, packetId = "";
let contextOpen = false, contextSelection = "";
let dirty = true, lastRevision = -1, lastUI = 0, lastFrame = performance.now();
const camera = { x: 0, y: 0, w: 1240, h: 650 };
const nodeElements = new Map(), linkElements = new Map();
let pickerSignature = null, packetSignature = null, inspectorHTML = "", historyHTML = "", messagesHTML = "", traceHTML = "";
let lastLossCount = 0, latestLoss = null, lossDismissed = false;
let wireDrag = null, paletteDrag = null, suppressPaletteClickUntil = 0;
const wallClock = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const clockText = (timestamp) => wallClock.format(new Date(timestamp));

function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("is-error", error);
}
function attempt(action) {
  try { action(); dirty = true; }
  catch (error) { status(error.message, true); }
}
function showTrace(reveal = false) {
  if (reveal) { $("trace-panel").scrollIntoView({ block: "start", behavior: "instant" }); $("packet-select").focus({ preventScroll: true }); }
}
function showSendSettings(open) {
  $("send-settings").hidden = !open;
  $("send-settings-toggle").setAttribute("aria-expanded", String(open));
  if (open) document.querySelector(".device-palette").open = false;
  else if (["source", "destination"].includes(mode)) setMode("select");
}
function setEndpoint(kind, id) {
  if (sim.nodes.get(id)?.kind !== "pc") return;
  $(kind).value = id;
  if (sim.repeating) sim.stopRepeating();
  packetId = ""; $("packet-select").value = "";
  setMode("select"); contextOpen = false; dirty = true;
  status(`${sim.name(id)}を${kind === "source" ? "送信元" : "宛先"}にしました。図のPCと送信設定のカードで変更できます。`);
}
function renderEndpoints() {
  for (const kind of ["source", "destination"]) {
    const pc = sim.nodes.get($(kind).value);
    $(kind + "-name").textContent = pc?.label ?? "PCを追加してください";
    $(kind + "-network").textContent = pc ? sim.lanForPC(pc.id)?.label ?? "未接続" : "図にドラッグして追加";
    $("pick-" + kind).disabled = !sim.pcs.length;
    $("pick-" + kind).setAttribute("aria-pressed", String(mode === kind));
  }
  $("endpoint-summary").textContent = `${sim.nodes.get($("source").value)?.label ?? "未選択"} → ${sim.nodes.get($("destination").value)?.label ?? "未選択"}`;
  if (["source", "destination"].includes(mode)) {
    $("pc-choice-heading").textContent = `${mode === "source" ? "送信元" : "宛先"}のPCを選ぶ`;
    const html = sim.pcs.map((pc) => `<button type="button" data-choose-pc="${pc.id}" aria-pressed="${$(mode).value === pc.id}"><strong>${esc(pc.label)}</strong><small>${esc(sim.lanForPC(pc.id)?.label ?? "未接続")}${pc.up ? "" : " · 故障中"}</small></button>`).join("");
    if ($("pc-choice-list").innerHTML !== html) $("pc-choice-list").innerHTML = html;
  }
}

function updateCamera() {
  $("network").setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  for (const [key, value] of Object.entries({ x: camera.x, y: camera.y, width: camera.w, height: camera.h })) $("background").setAttribute(key, value);
  updateRings(); positionContext();
}
function updateRings() {
  const scale = Math.max(1, camera.w / Math.max(1, $("network").clientWidth));
  for (const element of nodeElements.values()) {
    const radius = Math.max(40, 24 * scale);
    element.querySelector(".selection-ring").setAttribute("r", radius);
    const hit = element.querySelector(".connection-ring");
    hit.setAttribute("r", radius); hit.setAttribute("stroke-width", 14 * scale);
  }
}
function positionContext() {
  const panel = $("selection-context"), map = $("network");
  const node = selected.kind === "node" ? sim.nodes.get(selected.id) : null;
  const link = selected.kind === "link" ? sim.links.get(selected.id) : null;
  const a = link && sim.nodes.get(link.a), b = link && sim.nodes.get(link.b);
  const point = node ?? (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);
  const x = point ? (point.x - camera.x) / camera.w * map.clientWidth : -100;
  const y = point ? (point.y - camera.y) / camera.h * map.clientHeight : -100;
  panel.hidden = !contextOpen || !point || !!wireDrag || !!paletteDrag?.moved || !!drag?.moved || x < 0 || y < 0 || x > map.clientWidth || y > map.clientHeight;
  if (panel.hidden) return;
  const gap = 10;
  const controls = document.querySelector(".map-controls");
  panel.style.maxHeight = `${map.clientHeight - controls.offsetHeight - gap * 3}px`;
  const width = panel.offsetWidth, height = panel.offsetHeight;
  const radius = node ? Math.max(40 * map.clientWidth / camera.w, 24) + 12 : 15;
  const candidates = [
    { left: x + radius, top: y - height / 2 }, { left: x - radius - width, top: y - height / 2 },
    { left: x - width / 2, top: y + radius }, { left: x - width / 2, top: y - radius - height },
  ].map((p, order) => {
    p.left = Math.max(gap, Math.min(map.clientWidth - width - gap, p.left));
    p.top = Math.max(gap, Math.min(map.clientHeight - height - gap, p.top));
    if (p.left + width > controls.offsetLeft - gap) p.top = Math.min(p.top, controls.offsetTop - height - gap);
    const covers = (px, py, padding) => px + padding > p.left && px - padding < p.left + width && py + padding > p.top && py - padding < p.top + height;
    p.score = order + (covers(x, y, radius - 4) ? 10000 : 0);
    for (const n of sim.nodes.values()) if (n.id !== node?.id && covers((n.x - camera.x) / camera.w * map.clientWidth, (n.y - camera.y) / camera.h * map.clientHeight, 8)) p.score += 100;
    if (p.left + width > controls.offsetLeft - gap && p.top + height > controls.offsetTop - gap) p.score += 1000;
    return p;
  }).sort((a, b) => a.score - b.score);
  panel.style.left = `${candidates[0].left}px`; panel.style.top = `${candidates[0].top}px`;
}
function fit() {
  const nodes = [...sim.nodes.values()];
  const bounds = {
    left: Math.min(0, ...nodes.map((n) => n.x - 65)), right: Math.max(1240, ...nodes.map((n) => n.x + 65)),
    top: Math.min(-40, ...nodes.map((n) => n.y - 65)), bottom: Math.max(670, ...nodes.map((n) => n.y + 65)),
  };
  const aspect = $("network").clientWidth / $("network").clientHeight;
  camera.w = Math.max(bounds.right - bounds.left, (bounds.bottom - bounds.top) * aspect);
  camera.h = camera.w / aspect;
  camera.x = (bounds.left + bounds.right - camera.w) / 2;
  camera.y = (bounds.top + bounds.bottom - camera.h) / 2;
  updateCamera();
}
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
  for (const id of ["source", "destination"]) {
    const previous = $(id).value;
    if (!sim.nodes.has(previous)) $(id).value = id === "source" ? sim.pcs[0]?.id ?? "" : sim.pcs.at(-1)?.id ?? "";
  }
  if (!sim.nodes.has(selected.id) && !sim.links.has(selected.id)) { selected = { kind: "node", id: "" }; contextOpen = false; }
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
      group.innerHTML = `<circle class="selection-ring" r="40"/><circle class="connection-ring" data-connect="${node.id}" r="40" aria-hidden="true"/><circle class="endpoint-ring" r="36" fill="none"/>${body}${node.kind === "router" ? `<text text-anchor="middle" y="6">${esc(node.label)}</text>` : node.kind === "lan" ? '<text text-anchor="middle" y="6" style="font-size:14px">LAN</text>' : '<path class="node-icon" d="M-14 -11H14V7H-14ZM0 7V13M-10 13H10"/>'}${node.kind !== "router" ? `<text class="node-label" text-anchor="middle" y="42">${esc(node.label)}</text>` : ""}<text class="endpoint-tag" text-anchor="middle" y="-45"></text><text class="fault-mark" x="20" y="-20">×</text>`;
      $("devices").append(group); nodeElements.set(node.id, group);
    }
    group.setAttribute("transform", `translate(${node.x} ${node.y})`);
    group.setAttribute("class", `device ${node.kind}${!node.up ? " is-down" : ""}${(selected.kind === "node" && selected.id === node.id) || connectStart === node.id ? " is-selected" : ""}${node.id === $("source").value ? " is-source" : ""}${node.id === $("destination").value ? " is-destination" : ""}`);
    group.setAttribute("aria-label", `${node.label}、${node.up ? "稼働中" : "故障中"}、選択して操作`);
    const connectionFrom = wireDrag?.from ?? (mode === "connect" ? connectStart : null);
    group.classList.toggle("is-connect-candidate", !!connectionFrom && !sim.connectionError(connectionFrom, node.id));
    group.classList.toggle("is-pc-candidate", ["source", "destination"].includes(mode) && node.kind === "pc");
    group.querySelector(".endpoint-tag").textContent = node.id === $("source").value && node.id === $("destination").value ? "送信元・宛先" : node.id === $("source").value ? "送信元" : node.id === $("destination").value ? "宛先" : "";
    group.querySelector(".fault-mark").style.display = node.up ? "none" : "";
  }
  const selectedElement = selected.kind === "node" && nodeElements.get(selected.id);
  if (selectedElement && $("devices").lastElementChild !== selectedElement) {
    const focused = document.activeElement === selectedElement;
    $("devices").append(selectedElement);
    if (focused) selectedElement.focus({ preventScroll: true });
  }
  updateRings();
}

function tableHTML(node) {
  const state = sim.routers.get(node.id);
  const networks = new Map(sim.lans.map((n) => [n.id, n]));
  for (const lsa of state.db.values()) for (const lan of lsa.networks) networks.set(lan.id, lan);
  for (const route of state.table.values()) networks.set(route.id, route);
  const lastChange = sim.history.find((h) => h.type === "table" && h.router === node.id);
  const recentlyChanged = sim.time - (lastChange?.time ?? -100) < 3 ? new Set(lastChange.detail.map((c) => c.network)) : new Set();
  const destinationLAN = sim.lanForPC($("destination").value)?.id;
  return `<p class="table-meta">経路情報 v${state.tableVersion} · ${state.db.size}台のルータ情報${node.up ? "" : " · 停止中"}</p><div class="table-scroll" tabindex="0" role="region" aria-label="${esc(node.label)}のルーティングテーブル"><table class="routing-table"><thead><tr><th scope="col">宛先のLAN</th><th scope="col">次に送る先</th><th scope="col">コスト</th></tr></thead><tbody>${[...networks.values()].map((lan) => {
    const route = state.table.get(lan.id);
    return `<tr class="${lan.id === destinationLAN ? "is-target " : ""}${recentlyChanged.has(lan.id) ? "is-changed" : ""}"><td>${esc(lan.label)}<small>${esc(lan.prefix)}</small></td><td class="${route ? "" : "unreachable"}">${route ? esc(sim.name(route.next)) + (route.next === lan.id ? "<small>直接接続</small>" : "") : "経路なし"}</td><td>${route?.cost ?? "—"}</td></tr>`;
  }).join("") || '<tr><td colspan="3">まだLANの情報がありません</td></tr>'}</tbody></table></div><p class="selection-note">宛先PCが属するLANを見て、次の転送先を選びます。コストは回線の重みの合計。黄色の行は直近の更新です。${node.up ? "" : " このルータは故障中のため転送できません。"}</p>`;
}

function renderContext() {
  const key = `${selected.kind}:${selected.id}`;
  const changedSelection = key !== contextSelection;
  const node = selected.kind === "node" ? sim.nodes.get(selected.id) : null;
  const link = selected.kind === "link" ? sim.links.get(selected.id) : null;
  if (!node && !link) { $("selection-context").hidden = true; return; }
  const label = node ? node.label : `${sim.name(link.a)} ↔ ${sim.name(link.b)}`;
  const up = node ? node.up : sim.linkUsable(link);
  const state = node ? node.up ? "稼働中" : "故障中" : !link.up ? "切断中" : up ? "接続中" : "機器が故障中";
  let html = `<div class="context-heading"><h3>${esc(label)} <span class="context-state ${up ? "" : "down"}">${state}</span></h3><div class="context-controls"><button type="button" data-action="${node ? "remove-node" : "remove-link"}" class="context-delete" aria-label="${esc(label)}を削除">削除</button><button type="button" data-action="close-context" aria-label="機器・回線の操作を閉じる">×</button></div></div><div class="selection-actions">`;
  if (node) {
    if (node.kind === "pc") html += '<button type="button" data-action="set-source">送信元にする</button><button type="button" data-action="set-destination">宛先にする</button>';
    html += `<button type="button" data-action="toggle-node" class="${node.up ? "danger" : "primary"}">${node.up ? "故障させる" : "復旧する"}</button></div>`;
    html += '<div class="connect-action"><button type="button" data-action="connect-node">他の機器と接続</button></div>';
    if (node.kind === "router") html += `<details class="context-details" data-section="routes"><summary>ルーティングテーブル</summary>${tableHTML(node)}</details>`;
    const info = node.kind === "pc" ? `IP ${esc(node.address)} · ${esc(sim.lanForPC(node.id)?.label ?? "未接続")}` : node.kind === "lan" ? `ネットワーク ${esc(node.prefix)}` : "宛先に応じて次の送り先を判断する中継役";
    html += `<details class="context-details" data-section="settings"><summary>詳細</summary><p class="device-meta">${info}</p><p class="selection-note">接続先：${sim.edges(node.id, false).map((l) => esc(sim.name(sim.other(l, node.id))) + (!l.up ? "（切断）" : "")).join("、") || "なし"}</p></details>`;
  } else {
    html += `<button type="button" class="${link.up ? "danger" : "primary"}" data-action="toggle-link">${link.up ? "切断する" : "復旧する"}</button></div><details class="context-details" data-section="settings"><summary>詳細</summary><label class="link-cost">回線コスト<select id="link-cost">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}"${link.cost === i + 1 ? " selected" : ""}>${i + 1}</option>`).join("")}</select></label><p class="selection-note">コストが大きい回線は選ばれにくくなります。変更は各ルータへ順に伝わります。</p></details>`;
  }
  if (changedSelection || (html !== inspectorHTML && document.activeElement?.id !== "link-cost")) {
    const detail = $("selection-detail");
    const scroll = changedSelection ? 0 : detail.querySelector(".table-scroll")?.scrollTop ?? 0;
    const expanded = changedSelection ? [] : [...detail.querySelectorAll("details[open]")].map((el) => el.dataset.section);
    const focusedAction = !changedSelection && detail.contains(document.activeElement) ? document.activeElement?.dataset.action : null;
    const focusedSection = !changedSelection && document.activeElement?.tagName === "SUMMARY" ? document.activeElement.parentElement.dataset.section : null;
    const tableFocused = !changedSelection && document.activeElement?.classList.contains("table-scroll");
    detail.innerHTML = html; inspectorHTML = html; contextSelection = key;
    for (const section of expanded) detail.querySelector(`[data-section="${section}"]`).open = true;
    if (focusedAction) detail.querySelector(`[data-action="${focusedAction}"]`)?.focus({ preventScroll: true });
    if (focusedSection) detail.querySelector(`[data-section="${focusedSection}"] summary`)?.focus({ preventScroll: true });
    if (tableFocused) detail.querySelector(".table-scroll")?.focus({ preventScroll: true });
    const table = detail.querySelector(".table-scroll"); if (table) table.scrollTop = scroll;
  }
  positionContext();
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
  if (!packet) { if (traceHTML) { $("packet-detail").innerHTML = '<p class="muted">送信したパケットの通過経路と、ルータの判断を確認できます。</p>'; traceHTML = ""; } return; }
  const html = `<div class="packet-title"><strong>${packet.id} · ${packet.index}/${packet.total}</strong><span class="badge ${packet.status}">${{ active: "通信中", delivered: "到達", lost: "消失" }[packet.status]}</span></div><p class="muted">${esc(sim.name(packet.source))} → ${esc(sim.name(packet.destination))}<br />宛先IP ${esc(packet.destinationAddress)}</p><p class="packet-fragment">「${esc(packet.fragment)}」</p><p class="packet-path">${packet.path.map((id) => esc(sim.name(id))).join(" → ")}${packet.transit ? " → " + esc(sim.name(packet.transit.to)) + "（移動中）" : ""}</p>${packet.reason ? `<p class="loss-explanation">× パケット消失<br />${esc(packet.reason)}</p>` : ""}<ol class="packet-decisions" tabindex="0" aria-label="ルータの判断履歴">${packet.decisions.map((d) => `<li><time datetime="${new Date(d.timestamp).toISOString()}">${clockText(d.timestamp)}</time>：${esc(sim.name(d.router))} → ${esc(d.next ? sim.name(d.next) : "経路なし")} <span class="muted">(v${d.version})</span></li>`).join("")}</ol>`;
  if (html !== traceHTML) { $("packet-detail").innerHTML = html; traceHTML = html; }
}

function renderMessages() {
  if (!sim.messages.length) return;
  const html = sim.messages.slice(0, 20).map((message) => {
    const lost = message.packets.filter((p) => p.status === "lost").length;
    return `<article class="message-row${lost ? " has-loss" : ""}"><div class="message-heading"><strong>${message.id} · ${esc(sim.name(message.source))} → ${esc(sim.name(message.destination))}</strong><span class="badge ${lost ? "lost" : message.status}">${lost ? "パケット消失" : { active: "通信中", delivered: "受信完了", lost: "受信失敗" }[message.status]}</span></div><p>${message.status === "delivered" ? "受信：" : "送信："}「${esc(message.text)}」</p>${lost ? `<p class="loss-explanation">× ${lost}個のパケットが消失。メッセージを組み立てられません。</p>` : ""}<div class="packet-chips">${message.packets.map((p) => `<button type="button" data-packet="${p.id}" class="${p.status}" aria-label="${p.id}、${{ active: "通信中", delivered: "到達", lost: "消失" }[p.status]}、経路を表示">${p.id} ${p.status === "delivered" ? "✓" : p.status === "lost" ? "× 消失" : "…"}</button>`).join("")}</div></article>`;
  }).join("");
  if (html !== messagesHTML) {
    const scroll = $("messages").scrollTop;
    $("messages").innerHTML = html; $("messages").scrollTop = scroll; messagesHTML = html;
  }
}

function renderHistory() {
  const filter = $("history-filter").value;
  const records = sim.history.filter((h) => filter === "all" || (filter === "selected" && h.router === selected.id) || (filter === "updates" && ["ready", "fault", "edit", "detect", "receive", "table"].includes(h.type)) || (filter === "packets" && ["send", "forward", "delivered", "lost"].includes(h.type))).slice(0, 100);
  const html = records.map((h) => `<div class="history-row ${h.type}" data-history="${h.id}"><time datetime="${new Date(h.timestamp).toISOString()}" title="${new Date(h.timestamp).toLocaleString("ja-JP")}">${clockText(h.timestamp)}</time><div>${esc(h.text)}${h.detail ? `<details><summary>変更した経路（${h.detail.length}件）</summary>${h.detail.map((c) => `<div>${esc(c.after?.label ?? c.before?.label ?? c.network)}：${c.before ? esc(sim.name(c.before.next)) + " / " + c.before.cost : "経路なし"} → ${c.after ? esc(sim.name(c.after.next)) + " / " + c.after.cost : "経路なし"}</div>`).join("")}</details>` : ""}</div></div>`).join("") || '<p class="empty-state">この種類の履歴はまだありません。</p>';
  if (html !== historyHTML) {
    const open = [...$("history").querySelectorAll("details[open]")].map((el) => el.closest("[data-history]").dataset.history);
    const scroll = $("history").scrollTop;
    $("history").innerHTML = html; historyHTML = html;
    for (const id of open) { const el = $("history").querySelector(`[data-history="${id}"] details`); if (el) el.open = true; }
    $("history").scrollTop = scroll;
  }
}

function renderUI() {
  updatePickers(); renderEndpoints(); renderDiagram(); renderContext(); renderTrace(); renderMessages(); renderHistory(); renderLossNotice();
  $("active-count").textContent = sim.activePackets.length;
  $("delivered-count").textContent = sim.totals.delivered;
  $("lost-count").textContent = sim.totals.lost;
  $("update-state").textContent = sim.pendingUpdates ? `経路情報を更新中 · ${sim.pendingUpdates}件` : "経路情報は安定";
  $("update-state").classList.toggle("is-updating", !!sim.pendingUpdates);
  $("repeat").textContent = sim.repeating ? "連続送信を停止" : "連続送信";
  $("repeat").setAttribute("aria-pressed", String(!!sim.repeating));
  dirty = false; lastRevision = sim.revision;
}

function renderLossNotice() {
  if (sim.totals.lost !== lastLossCount) {
    lastLossCount = sim.totals.lost;
    latestLoss = sim.packets.filter((p) => p.status === "lost").sort((a, b) => b.lossOrder - a.lossOrder)[0] ?? null;
    lossDismissed = false;
  }
  $("loss-notice").hidden = !latestLoss || lossDismissed;
  if (!latestLoss) return;
  const heading = `パケット ${latestLoss.id} が消失しました`;
  if ($("loss-heading").textContent !== heading) $("loss-heading").textContent = heading;
  if ($("loss-reason").textContent !== latestLoss.reason) $("loss-reason").textContent = latestLoss.reason;
  $("loss-inspect").disabled = !sim.packets.some((p) => p.id === latestLoss.id);
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
  const lossMarkers = new Map();
  for (const p of sim.packets) if (p.status === "lost" && p.lostPosition && (sim.time - p.endedAt < 5 || (p.id === packetId))) {
    const point = p.lostPosition, key = `${Math.round(point.x / 50)}:${Math.round(point.y / 50)}`;
    lossMarkers.set(key, `<g class="loss-marker"><circle cx="${point.x}" cy="${point.y}" r="16"/><text class="loss-cross" text-anchor="middle" x="${point.x}" y="${point.y + 8}">×</text><text class="loss-label" x="${point.x + 22}" y="${point.y - 7}">${p.id} 消失</text></g>`);
  }
  signals.push(...[...lossMarkers.values()].slice(-5));
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
  $("connection-preview").innerHTML = wireDrag ? `<line class="connection-preview" x1="${sim.nodes.get(wireDrag.from).x}" y1="${sim.nodes.get(wireDrag.from).y}" x2="${wireDrag.point.x}" y2="${wireDrag.point.y}"/>` : "";
  positionContext();
}

function selectNode(id, reveal = true) {
  if (["source", "destination"].includes(mode)) {
    if (sim.nodes.get(id)?.kind === "pc") { const kind = mode; setEndpoint(kind, id); $("pick-" + kind).focus({ preventScroll: true }); }
    else status("送信元・宛先にはPCを選んでください。青いPCが候補です。", true);
    return;
  }
  if (mode === "connect") {
    if (!connectStart) { connectStart = id; selected = { kind: "node", id }; contextOpen = false; dirty = true; status(`${sim.name(id)}を選択。接続するもう1台を選んでください。`); }
    else {
      const from = connectStart, error = sim.connectionError(from, id);
      if (error) { status(error, true); return; }
      attempt(() => { sim.connect(from, id); setMode("select"); contextOpen = false; status(`${sim.name(from)}と${sim.name(id)}を接続しました。経路情報の変化を観察できます。`); });
    }
    return;
  }
  selected = { kind: "node", id }; contextOpen = reveal; dirty = true;
}
function selectLink(id) { if (["source", "destination"].includes(mode)) { status("図のPCを選んでください。", true); return; } if (mode === "connect") { status("緑の機器を選ぶと接続できます。余白を押すと取り消します。"); return; } selected = { kind: "link", id }; contextOpen = true; dirty = true; }
function selectPacket(id) { packetId = id; $("packet-select").value = id; dirty = true; }
function setMode(value) {
  mode = value; connectStart = null;
  if (mode !== "select") contextOpen = false;
  for (const button of document.querySelectorAll("[data-mode]")) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  $("network").classList.toggle("is-editing", mode !== "select");
  $("pc-choices").hidden = !["source", "destination"].includes(mode);
  $("mode-hint").textContent = mode === "connect" ? "緑の接続先を選択 / 余白でキャンセル" : ["source", "destination"].includes(mode) ? `${mode === "source" ? "送信元" : "宛先"}のPCを選ぶ` : mode === "select" ? "" : "図の余白を選んで追加";
  if (mode !== "select") status(mode === "connect" ? "接続する2台を選択。PC—LAN、LAN—ルータ、ルータ—ルータを接続できます。" : ["source", "destination"].includes(mode) ? "図のPC、または送信設定のPCカードを選んでください。" : "図の余白を選ぶと機器を追加できます。ヘッダーの「機器を追加」からドラッグして置くこともできます。");
  dirty = true;
}

$("send-form").addEventListener("submit", (e) => {
  e.preventDefault(); attempt(() => {
    const message = sim.send($("source").value, $("destination").value, $("message").value);
    setMode("select"); showSendSettings(false); selectPacket(message.packets[0].id);
    status(`${message.id}を${message.packets.length}個のパケットに分けて送信しました。機器や回線を選んで実験できます。`);
  });
});
$("send-settings-toggle").addEventListener("click", () => showSendSettings($("send-settings").hidden));
$("send-form").addEventListener("invalid", (e) => { showSendSettings(true); status("メッセージを入力してください。", true); e.target.focus({ preventScroll: true }); }, true);
$("repeat").addEventListener("click", () => attempt(() => {
  if (sim.repeating) { sim.stopRepeating(); status("連続送信を停止しました。通信中のパケットは転送を続けます。"); }
  else { const m = sim.startRepeating($("source").value, $("destination").value, $("message").value); setMode("select"); selectPacket(m.packets[0].id); status("連続送信中。経路上の回線を切って、消失と迂回を観察してみよう。"); }
}));
for (const kind of ["source", "destination"]) $("pick-" + kind).addEventListener("click", () => { setMode(mode === kind ? "select" : kind); renderEndpoints(); });
$("pc-choice-list").addEventListener("click", (e) => { const id = e.target.closest("[data-choose-pc]")?.dataset.choosePc; if (id) { const kind = mode; setEndpoint(kind, id); $("pick-" + kind).focus({ preventScroll: true }); } });
$("cancel-pick").addEventListener("click", () => { const kind = mode; setMode("select"); $("pick-" + kind)?.focus({ preventScroll: true }); });
document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (["source", "destination"].includes(mode)) { const kind = mode; setMode("select"); $("pick-" + kind).focus({ preventScroll: true }); } else if (mode === "connect") { setMode("select"); nodeElements.get(selected.id)?.focus({ preventScroll: true }); status("接続を取り消しました。"); } else if (!$("send-settings").hidden) { showSendSettings(false); $("send-settings-toggle").focus({ preventScroll: true }); } else document.querySelector(".device-palette").open = false; });
$("zoom-in").addEventListener("click", () => { zoom(0.75); });
$("zoom-out").addEventListener("click", () => { zoom(1.33); });
$("fit").addEventListener("click", () => { fit(); });
$("reset").addEventListener("click", () => {
  sim = new RoutingSimulator(); lastFrame = performance.now(); selected = { kind: "node", id: "" }; contextOpen = false; contextSelection = ""; packetId = ""; setMode("select");
  latestLoss = null; lastLossCount = 0; lossDismissed = false; wireDrag = null;
  showSendSettings(false); document.querySelector(".device-palette").open = false;
  pickerSignature = packetSignature = null; inspectorHTML = historyHTML = messagesHTML = traceHTML = "";
  $("source").value = $("destination").value = "";
  $("messages").innerHTML = '<p class="empty-state">最初のメッセージを送ってみよう。<br />パケットをすべて受信できたか、ここに表示します。</p>';
  $("packet-detail").innerHTML = '<p class="muted">送信したパケットの通過経路と、ルータの判断を確認できます。</p>';
  for (const el of [...nodeElements.values(), ...linkElements.values()]) el.remove(); nodeElements.clear(); linkElements.clear();
  dirty = true; fit(); status("ネットワークと実験結果を初期状態に戻しました。");
});
for (const button of document.querySelectorAll("[data-mode]")) button.addEventListener("click", () => { if (Date.now() >= suppressPaletteClickUntil) { setMode(button.dataset.mode); document.querySelector(".device-palette").open = false; } });
$("packet-select").addEventListener("change", () => selectPacket($("packet-select").value));
$("history-filter").addEventListener("change", () => { historyHTML = ""; dirty = true; });
$("messages").addEventListener("click", (e) => { const button = e.target.closest("[data-packet]"); if (button) { selectPacket(button.dataset.packet); showTrace(true); status(`${button.dataset.packet}の経路と判断を表示しています。`); } });
$("loss-inspect").addEventListener("click", () => { if (latestLoss) { selectPacket(latestLoss.id); showTrace(true); status(`${latestLoss.id}の消失原因と通過経路を表示しています。`); } });
$("loss-dismiss").addEventListener("click", () => { lossDismissed = true; dirty = true; });
$("selection-detail").addEventListener("toggle", positionContext, true);
document.querySelector(".device-palette").addEventListener("toggle", (e) => { if (e.target.open) showSendSettings(false); });
$("selection-detail").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "close-context") { contextOpen = false; positionContext(); nodeElements.get(selected.id)?.focus({ preventScroll: true }); return; }
  attempt(() => {
    const node = sim.nodes.get(selected.id), link = sim.links.get(selected.id);
    if (action === "connect-node") {
      if (![...sim.nodes.values()].some((other) => !sim.connectionError(node.id, other.id))) throw new Error("接続できる相手がありません。新しい機器を追加するか、今の回線を削除してから接続してください。");
      setMode("connect"); connectStart = node.id; status(`${node.label}と接続する機器を選んでください。緑の機器が接続できる候補です。`);
    }
    if (action === "toggle-node") { sim.setNode(node.id, !node.up); status(`${node.label}を${node.up ? "復旧" : "故障"}しました。周辺のルータが検知してから経路情報を伝えます。`); }
    if (action === "toggle-link") { sim.setLink(link.id, !link.up); status(`回線を${link.up ? "復旧" : "切断"}しました。テーブルに変化が伝わるまでのパケットを観察してみよう。`); }
    if (action === "remove-node") { sim.removeNode(node.id); pickerSignature = null; status(`${node.label}を削除しました。`); }
    if (action === "remove-link") { sim.removeLink(link.id); pickerSignature = null; status("回線を削除しました。周囲のサークルから引いてつなぎ直せます。"); }
    if (action === "set-source") setEndpoint("source", node.id);
    if (action === "set-destination") setEndpoint("destination", node.id);
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
function connectionTarget(point) {
  return [...sim.nodes.values()].filter((n) => n.id !== wireDrag?.from && Math.hypot(n.x - point.x, n.y - point.y) < Math.max(40, 20 * camera.w / $("network").clientWidth)).sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
}
$("network").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  document.querySelector(".device-palette").open = false;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  $("network").setPointerCapture(e.pointerId);
  if (pointers.size === 2) { drag = null; wireDrag = null; pinch = null; dirty = true; return; }
  const handle = e.target.closest("[data-connect]");
  if (handle) {
    setMode("select"); contextOpen = false;
    selected = { kind: "node", id: handle.dataset.connect };
    wireDrag = { from: handle.dataset.connect, pointer: e.pointerId, point: worldPoint(e) };
    status("緑で強調された相手まで引いて離すと、回線を接続できます。");
    renderDiagram(); positionContext(); return;
  }
  const target = e.target.closest("[data-node], [data-link]");
  const node = target?.dataset.node ? sim.nodes.get(target.dataset.node) : null;
  if (node && mode === "select") { selectNode(node.id); renderDiagram(); renderContext(); }
  drag = { pointer: e.pointerId, target, node: mode === "select" ? node : null, clientX: e.clientX, clientY: e.clientY, originalX: node?.x, originalY: node?.y, cameraX: camera.x, cameraY: camera.y, moved: false };
});
$("network").addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (wireDrag?.pointer === e.pointerId && pointers.size === 1) {
    wireDrag.point = worldPoint(e);
    const target = connectionTarget(wireDrag.point);
    if (target && !sim.connectionError(wireDrag.from, target.id)) wireDrag.point = { x: target.x, y: target.y };
    return;
  }
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
  else { camera.x = drag.cameraX - wx; camera.y = drag.cameraY - wy; updateCamera(); }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (wireDrag?.pointer === e.pointerId) {
    const from = wireDrag.from, target = connectionTarget(worldPoint(e));
    if (e.type !== "pointercancel" && target) attempt(() => { sim.connect(from, target.id); status(`${sim.name(from)}と${target.label}を接続しました。経路情報の更新は自動で進みます。`); });
    else if (e.type !== "pointercancel") status("接続を取り消しました。周囲のサークルから、緑の候補まで引いてください。");
    wireDrag = null; dirty = true; renderDiagram();
    drag = null; pinch = null; return;
  }
  if (e.type !== "pointercancel" && drag && drag.pointer === e.pointerId && !drag.moved) {
    if (drag.target?.dataset.node) selectNode(drag.target.dataset.node);
    else if (drag.target?.dataset.link) selectLink(drag.target.dataset.link);
    else if (["pc", "lan", "router"].includes(mode)) attempt(() => { const point = worldPoint(e), node = sim.addNode(mode, point.x, point.y); setMode("select"); selectNode(node.id, false); status(`${node.label}を追加しました。周囲のサークルから引いてネットワークにつなげてみよう。`); });
    else { if (mode === "connect") { setMode("select"); status("接続を取り消しました。"); } selected = { kind: "node", id: "" }; contextOpen = false; dirty = true; }
  }
  drag = null; pinch = null; $("network").classList.remove("is-dragging");
}
$("network").addEventListener("pointerup", endPointer);
$("network").addEventListener("pointercancel", endPointer);

for (const button of document.querySelectorAll('[data-mode="router"], [data-mode="lan"], [data-mode="pc"]')) {
  button.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    paletteDrag = { pointer: e.pointerId, kind: button.dataset.mode, x: e.clientX, y: e.clientY, moved: false };
    button.setPointerCapture(e.pointerId);
  });
  button.addEventListener("pointermove", (e) => {
    if (!paletteDrag || paletteDrag.pointer !== e.pointerId) return;
    if (Math.hypot(e.clientX - paletteDrag.x, e.clientY - paletteDrag.y) > 7) paletteDrag.moved = true;
    if (!paletteDrag.moved) return;
    const box = $("network").getBoundingClientRect(), inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
    $("palette-preview").hidden = false;
    $("palette-preview").textContent = { router: "ルータ", lan: "LAN", pc: "PC" }[paletteDrag.kind];
    $("palette-preview").style.left = `${e.clientX}px`; $("palette-preview").style.top = `${e.clientY}px`;
    $("palette-preview").classList.toggle("outside", !inside);
    $("network").closest(".canvas-wrap").classList.toggle("is-drop-target", inside);
  });
  const end = (e) => {
    if (!paletteDrag || paletteDrag.pointer !== e.pointerId) return;
    const kind = paletteDrag.kind, moved = paletteDrag.moved;
    const box = $("network").getBoundingClientRect();
    if (moved) {
      suppressPaletteClickUntil = Date.now() + 400;
      if (e.type !== "pointercancel" && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) attempt(() => {
        const point = worldPoint(e), node = sim.addNode(kind, point.x, point.y);
        setMode("select"); selectNode(node.id, false);
        status(`${node.label}を追加しました。周囲のサークルから相手へ引いて接続できます。`);
      });
    }
    if (moved) document.querySelector(".device-palette").open = false;
    paletteDrag = null; $("palette-preview").hidden = true; $("network").closest(".canvas-wrap").classList.remove("is-drop-target");
  };
  button.addEventListener("pointerup", end); button.addEventListener("pointercancel", end);
}
$("network").addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9, worldPoint(e)); }, { passive: false });
$("network").addEventListener("keydown", (e) => {
  const nodeId = e.target.closest("[data-node]")?.dataset.node, linkId = e.target.closest("[data-link]")?.dataset.link;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (nodeId) selectNode(nodeId); else if (linkId) selectLink(linkId); }
  if (e.key === "Enter" && !nodeId && !linkId && ["pc", "lan", "router"].includes(mode)) attempt(() => { const node = sim.addNode(mode, camera.x + camera.w / 2, camera.y + camera.h / 2); setMode("select"); selectNode(node.id, false); status(`${node.label}を図の中央に追加しました。`); });
  if (e.key.toLowerCase() === "c" && nodeId) { e.preventDefault(); setMode("connect"); connectStart = nodeId; selected = { kind: "node", id: nodeId }; status(`${sim.name(nodeId)}から接続する機器を選び、Enterを押してください。`); }
  if (e.key === "Escape") { setMode("select"); contextOpen = false; status("操作を終了しました。機器を選んで実験できます。"); }
  if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(.8); }
  if (e.key === "-") { e.preventDefault(); zoom(1.25); }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
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
  sim.advance(elapsed);
  if (now - lastUI > 120 && (dirty || lastRevision !== sim.revision || now - lastUI > 1000)) { renderUI(); lastUI = now; }
  renderMotion(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
