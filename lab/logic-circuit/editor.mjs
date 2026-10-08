import {
  parts,
  connect,
  evaluate,
  orderedNodes,
  truthTable,
} from "./circuit.mjs?v=6";
import { symbol, portOffset, miniSymbol } from "./symbols.mjs";
import { exampleCircuit, arithmeticReadout } from "./examples.mjs?v=6";
import { installDocumentControls } from "./document-ui.mjs?v=6";

const $ = (id) => document.getElementById(id);
const board = $("circuit-board"),
  stage = $("circuit-stage");
const clone = (graph) => structuredClone(graph);
const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const showValue = (value) => (value === null ? "—" : value);
const signalClass = (value) =>
  value === 1 ? "one" : value === 0 ? "zero" : "unknown";
const gateTypes = ["and", "or", "not"];
const minimumZoom = 0.12;
let graph,
  documentTools,
  selected,
  pendingPort,
  gesture,
  fitAfterResize,
  editingTerminal,
  stageResize,
  suppressPaletteClick = false;
let past = [],
  future = [],
  showIntermediate = true,
  announcementTimer,
  toastTimer;
const pointers = new Map();
const camera = { x: 0, y: 0, zoom: 1 };
const dimensions = () => ({
  width: stage.clientWidth,
  height: stage.clientHeight,
});
const worldPoint = (clientX, clientY) => {
  const rect = board.getBoundingClientRect();
  return {
    x: camera.x + (clientX - rect.left) / camera.zoom,
    y: camera.y + (clientY - rect.top) / camera.zoom,
  };
};
const insideStage = (clientX, clientY) => {
  const r = board.getBoundingClientRect();
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  );
};
const snap = (n) => Math.max(-9000, Math.min(9000, Math.round(n / 8) * 8));
const label = (node) =>
  node.type === "input"
    ? `入力${node.name || node.label}`
    : node.type === "output"
      ? `出力${node.name || node.label}`
      : node.type === "branch"
        ? `分岐${node.number}`
        : `ゲート${node.number} ${node.type.toUpperCase()}`;
const findNode = (id) => graph.nodes.find((n) => n.id === id);
const pointOf = (port) => {
  const node = findNode(port.node);
  const [x, y] = portOffset(node.type, port.direction, port.port);
  return { x: node.x + x, y: node.y + y };
};
function wireGeometry(edge) {
  const a = pointOf({ ...edge.from, direction: "out" }),
    b = pointOf({ ...edge.to, direction: "in" });
  const bend = Math.max(26, Math.min(120, Math.abs(b.x - a.x) * 0.48));
  return [a, { x: a.x + bend, y: a.y }, { x: b.x - bend, y: b.y }, b];
}
const curve = ([a, b, c, d]) =>
  `M${a.x} ${a.y}C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`;
function nearestWire(point) {
  let best,
    distance = 16 / camera.zoom;
  for (const edge of graph.edges) {
    const [a, b, c, d] = wireGeometry(edge);
    for (let i = 1; i < 32; i++) {
      const t = i / 32,
        u = 1 - t;
      const x =
        u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x;
      const y =
        u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y;
      const delta = Math.hypot(point.x - x, point.y - y);
      if (delta < distance) {
        distance = delta;
        best = { edge, point: { x, y } };
      }
    }
  }
  return best;
}
function message(text, error = false, timed = false) {
  clearTimeout(toastTimer);
  $("circuit-message").textContent = text;
  $("circuit-message").classList.toggle("is-error", error);
  if (timed) toastTimer = setTimeout(() => message(""), 4500);
}
function save() {
  documentTools?.edited();
}
function remember(before) {
  past.push(before);
  if (past.length > 60) past.shift();
  future = [];
}
function change(action, text) {
  const before = clone(graph);
  action();
  graph.example = "";
  remember(before);
  pendingPort = undefined;
  render();
  save();
  if (text) message(text, false, true);
}
function undo(redo = false) {
  const source = redo ? future : past,
    target = redo ? past : future;
  if (!source.length) return;
  cancelGesture();
  target.push(clone(graph));
  graph = source.pop();
  selected = undefined;
  pendingPort = undefined;
  render();
  save();
  message(redo ? "やり直しました。" : "元に戻しました。", false, true);
}
function restoreCounters() {
  const minimums = {
    nextNode: Math.max(0, ...graph.nodes.map((n) => Number(n.id.slice(1)))) + 1,
    nextWire: Math.max(0, ...graph.edges.map((e) => Number(e.id.slice(1)))) + 1,
    nextGate:
      Math.max(
        0,
        ...graph.nodes
          .filter((n) => gateTypes.includes(n.type))
          .map((n) => n.number),
      ) + 1,
    nextBranch:
      Math.max(
        0,
        ...graph.nodes.filter((n) => n.type === "branch").map((n) => n.number),
      ) + 1,
  };
  for (const [key, min] of Object.entries(minimums))
    graph[key] = Number.isSafeInteger(graph[key])
      ? Math.max(min, graph[key])
      : min;
}
function nodeAt(type, point) {
  const node = {
    id: `n${graph.nextNode++}`,
    type,
    x: snap(point.x),
    y: snap(point.y),
  };
  if (type === "input") {
    node.label = [..."ABCD"].find(
      (letter) =>
        !graph.nodes.some((n) => n.type === type && n.label === letter),
    );
    node.value = 0;
  } else if (type === "output")
    node.label = [..."XYZW"].find(
      (letter) =>
        !graph.nodes.some((n) => n.type === type && n.label === letter),
    );
  else node.number = type === "branch" ? graph.nextBranch++ : graph.nextGate++;
  return node;
}
function freePoint() {
  const size = dimensions(),
    center = {
      x: camera.x + size.width / camera.zoom / 2,
      y: camera.y + size.height / camera.zoom / 2,
    };
  const candidates = [center];
  for (let ring = 1; ring <= 5; ring++)
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      candidates.push({
        x: center.x + dx * ring * 138,
        y: center.y + dy * ring * 96,
      });
  return (
    candidates.find((p) =>
      graph.nodes.every(
        (n) => Math.abs(n.x - p.x) > 104 || Math.abs(n.y - p.y) > 84,
      ),
    ) || candidates.at(-1)
  );
}
function reveal(node) {
  const size = dimensions(),
    margin = 45;
  if (
    node.x < camera.x + margin ||
    node.x > camera.x + size.width / camera.zoom - margin
  )
    camera.x = node.x - size.width / camera.zoom / 2;
  if (
    node.y < camera.y + margin ||
    node.y > camera.y + size.height / camera.zoom - margin
  )
    camera.y = node.y - size.height / camera.zoom / 2;
  updateCamera();
}
function addPart(type, point, fromDrag = false) {
  if (graph.nodes.length >= 40)
    return message("部品は40個まで配置できます。", true, true);
  if (
    ["input", "output"].includes(type) &&
    graph.nodes.filter((n) => n.type === type).length >= 4
  )
    return message(`${parts[type].name}は4つまで追加できます。`, true, true);
  let split;
  if (type === "branch") {
    if (fromDrag) split = nearestWire(point);
    else if (selected?.kind === "edge") {
      const edge = graph.edges.find((e) => e.id === selected.id);
      if (edge) {
        const [a, b, c, d] = wireGeometry(edge);
        split = {
          edge,
          point: {
            x: (a.x + 3 * b.x + 3 * c.x + d.x) / 8,
            y: (a.y + 3 * b.y + 3 * c.y + d.y) / 8,
          },
        };
      }
    }
  }
  let node;
  change(() => {
    node = nodeAt(type, split?.point || point || freePoint());
    graph.nodes.push(node);
    if (split) {
      graph.edges = graph.edges.filter((e) => e.id !== split.edge.id);
      graph = connect(
        graph,
        split.edge.from,
        { node: node.id, port: 0 },
        `w${graph.nextWire++}`,
      );
      graph = connect(
        graph,
        { node: node.id, port: 0 },
        split.edge.to,
        `w${graph.nextWire++}`,
      );
    }
    selected = { kind: "node", id: node.id };
  });
  if (!fromDrag) reveal(node);
  message(
    split
      ? "線の途中に分岐を入れました。もう一方の端子から配線できます。"
      : `${label(node)}を追加しました。`,
    false,
    true,
  );
}
function deleteSelected() {
  if (!selected) return;
  const node = selected.kind === "node" ? findNode(selected.id) : null;
  if (
    node &&
    ["input", "output"].includes(node.type) &&
    graph.nodes.filter((n) => n.type === node.type).length === 1
  )
    return message("入力と出力をそれぞれ1つ以上残してください。", true, true);
  change(
    () => {
      if (node) {
        graph.nodes = graph.nodes.filter((n) => n.id !== node.id);
        graph.edges = graph.edges.filter(
          (e) => e.from.node !== node.id && e.to.node !== node.id,
        );
      } else graph.edges = graph.edges.filter((e) => e.id !== selected.id);
      selected = undefined;
    },
    node ? `${label(node)}を削除しました。` : "配線を削除しました。",
  );
}
function connectPorts(a, b) {
  if (a.direction === b.direction)
    return message("出力端子と入力端子を1つずつ選んでください。", true, true);
  const from = a.direction === "out" ? a : b,
    to = a.direction === "in" ? a : b;
  const duplicate = graph.edges.find(
    (e) =>
      e.from.node === from.node &&
      e.from.port === from.port &&
      e.to.node === to.node &&
      e.to.port === to.port,
  );
  if (duplicate) {
    pendingPort = undefined;
    selected = { kind: "edge", id: duplicate.id };
    render();
    return message("この端子どうしは接続されています。", false, true);
  }
  let updated;
  try {
    updated = connect(
      graph,
      { node: from.node, port: from.port },
      { node: to.node, port: to.port },
      `w${graph.nextWire}`,
    );
  } catch (error) {
    message(error.message, true, true);
    return;
  }
  change(() => {
    graph = updated;
    graph.nextWire++;
    selected = { kind: "edge", id: updated.edges.at(-1).id };
  }, "接続しました。");
}
function choosePort(port) {
  if (
    pendingPort &&
    pendingPort.node === port.node &&
    pendingPort.port === port.port &&
    pendingPort.direction === port.direction
  ) {
    pendingPort = undefined;
    render();
    return message("接続の選択を解除しました。", false, true);
  }
  if (pendingPort && pendingPort.direction !== port.direction) {
    connectPorts(pendingPort, port);
    return;
  }
  pendingPort = port;
  selected = undefined;
  render();
  message(
    `${label(findNode(port.node))}の${port.direction === "out" ? "出力" : "入力"}端子 → ${port.direction === "out" ? "入力" : "出力"}端子を選択`,
  );
}
function toggleInput(id) {
  const node = findNode(id);
  node.value = 1 - node.value;
  render();
  save();
}
const terminalTitle = (node) =>
  node.name || `${node.type === "input" ? "入力" : "出力"} ${node.label}`;
function shortTitle(name) {
  let width = 0,
    result = "";
  for (const character of name) {
    width += /[ -~]/.test(character) ? 0.55 : 1;
    if (width > 8) return result + "…";
    result += character;
  }
  return result;
}
function openTerminalName(id) {
  const node = findNode(id);
  if (!node || !["input", "output"].includes(node.type)) return;
  cancelGesture();
  editingTerminal = id;
  $("terminal-name").value = terminalTitle(node);
  $("terminal-dialog").showModal();
  $("terminal-name").select();
}
$("terminal-form").onsubmit = (event) => {
  event.preventDefault();
  const node = findNode(editingTerminal),
    name = $("terminal-name").value.trim();
  $("terminal-dialog").close();
  if (node && name && name !== terminalTitle(node))
    change(() => {
      node.name = name;
    });
  if (node) restoreFocus(`name-${node.id}`);
  editingTerminal = undefined;
};
function applyRow(index) {
  const row = truthTable(graph)[index];
  for (const node of graph.nodes)
    if (node.type === "input") node.value = row.inputs[node.id];
  render();
  save();
}
function focusedKey() {
  return document.activeElement?.dataset.focusKey;
}
function restoreFocus(key) {
  if (!key) return;
  const target = [...document.querySelectorAll("[data-focus-key]")].find(
    (e) => e.dataset.focusKey === key,
  );
  target?.focus({ preventScroll: true });
}
function portHTML(node, direction, index, values) {
  const [x, y] = portOffset(node.type, direction, index);
  const edge =
    direction === "in"
      ? graph.edges.find((e) => e.to.node === node.id && e.to.port === index)
      : null;
  const value =
    direction === "out"
      ? values.get(node.id)
      : edge
        ? values.get(edge.from.node)
        : null;
  const isPending =
    pendingPort?.node === node.id &&
    pendingPort.direction === direction &&
    pendingPort.port === index;
  const key = `port-${node.id}-${direction}-${index}`;
  return `<g class="port port-${signalClass(value)}${isPending ? " port-pending" : ""}${pendingPort && pendingPort.direction !== direction ? " port-valid" : ""}" transform="translate(${x} ${y})" role="button" tabindex="0" data-focus-key="${key}" data-port="${index}" data-node="${node.id}" data-direction="${direction}" aria-label="${esc(label(node))}の${direction === "in" ? "入力" : "出力"}端子${parts[node.type][direction === "in" ? "inputs" : "outputs"] > 1 ? index + 1 : ""}、値${showValue(value)}"><circle class="port-hit" r="${Math.max(12, 13 / camera.zoom)}"/><circle class="port-dot" r="5"/></g>`;
}
function valueBadge(value, x, y) {
  return `<g class="value-${signalClass(value)}"><rect class="value-badge" x="${x - 13}" y="${y - 11}" width="26" height="22" rx="5"/><text class="value-text" x="${x}" y="${y + 1}">${showValue(value)}</text></g>`;
}
function renderBoard(values = evaluate(graph)) {
  const key = focusedKey();
  $("circuit-wires").innerHTML = graph.edges
    .map((edge) => {
      const value = values.get(edge.from.node),
        path = curve(wireGeometry(edge));
      return `<g class="wire wire-${signalClass(value)}${selected?.kind === "edge" && selected.id === edge.id ? " wire-selected" : ""}" data-edge="${edge.id}" data-from="${edge.from.node}" data-to="${edge.to.node}" role="button" tabindex="0" data-focus-key="wire-${edge.id}" aria-label="配線：${esc(label(findNode(edge.from.node)))}から${esc(label(findNode(edge.to.node)))}、値${showValue(value)}"><path class="wire-under" d="${path}"/><path class="wire-line" d="${path}"/><path class="wire-hit" d="${path}" stroke-width="${14 / camera.zoom}"/></g>`;
    })
    .join("");
  $("circuit-nodes").innerHTML = graph.nodes
    .map((node) => {
      const value = values.get(node.id),
        input = node.type === "input",
        output = node.type === "output";
      let body;
      if (input)
        body = `<rect class="input-body" x="-32" y="-20" width="64" height="40"/><text class="input-value" y="1">${value}</text><path class="symbol-stub" d="M32 0H44"/>${node.meaning ? `<text class="node-type" y="41">${esc(node.meaning)}</text>` : ""}`;
      else if (output)
        body = `<circle class="output-lamp" cx="8" r="23"/><text class="input-value" x="8" y="1">${showValue(value)}</text><path class="symbol-stub" d="M-34 0H-15"/>${node.meaning ? `<text class="node-type" x="8" y="41">${esc(node.meaning)}</text>` : ""}`;
      else if (node.type === "branch")
        body = `<text class="node-title" y="-35">分${node.number}</text>${symbol(node.type)}${valueBadge(value, 38, -35)}`;
      else
        body = `<circle class="number-circle" cx="-24" cy="-39" r="9"/><text class="number-text" x="-24" y="-39">${node.number}</text><text class="node-title" x="9" y="-35">${node.type.toUpperCase()}</text>${symbol(node.type)}${valueBadge(value, 55, -35)}`;
      const ports = [];
      for (let i = 0; i < parts[node.type].inputs; i++)
        ports.push(portHTML(node, "in", i, values));
      for (let i = 0; i < parts[node.type].outputs; i++)
        ports.push(portHTML(node, "out", i, values));
      const title =
        input || output
          ? `<g class="node-name" role="button" tabindex="0" data-node-name="${node.id}" data-focus-key="name-${node.id}" aria-label="${esc(shortTitle(terminalTitle(node)))}の名前を編集${shortTitle(terminalTitle(node)) === terminalTitle(node) ? "" : `：${esc(terminalTitle(node))}`}"><title>${esc(terminalTitle(node))}：名前を変更</title><rect class="node-name-hit" x="${output ? -58 : -66}" y="-53" width="132" height="27"/><text class="node-title" x="${output ? 8 : 0}" y="-35">${esc(shortTitle(terminalTitle(node)))}</text></g>`
          : "";
      return `<g class="circuit-node value-${signalClass(value)}" data-id="${node.id}" data-type="${node.type}" data-number="${node.number || ""}" data-label="${esc(node.label)}" transform="translate(${node.x} ${node.y})" role="group" aria-label="${esc(label(node))}、出力${showValue(value)}"><g class="node-body" role="button" tabindex="0" data-focus-key="node-${node.id}" aria-description="${esc(label(node))}${input ? `、現在${value}、押すと切り替え` : "を選択。矢印キーで移動"}">${selected?.kind === "node" && selected.id === node.id ? '<rect class="node-selected" x="-61" y="-54" width="133" height="100"/>' : ""}${body}</g>${ports.join("")}${title}</g>`;
    })
    .join("");
  updatePreview();
  restoreFocus(key);
}
function headerLabel(node) {
  if (gateTypes.includes(node.type))
    return `<span class="table-number">${node.number}</span>${node.type.toUpperCase()}`;
  return (
    esc(node.name || node.label) +
    (node.meaning ? `<small> ${esc(node.meaning)}</small>` : "")
  );
}
function renderTruth() {
  const key = focusedKey(),
    { inputs, gates, outputs } = orderedNodes(graph);
  const visibleGates = showIntermediate ? gates : [],
    columns = [...inputs, ...visibleGates, ...outputs];
  const toggle = $("toggle-intermediate");
  toggle.hidden = gates.length === 0;
  toggle.textContent = showIntermediate ? "中間値を非表示" : "中間値を表示";
  toggle.setAttribute("aria-expanded", String(showIntermediate));
  $("circuit-truth").querySelector("caption").textContent = visibleGates.length
    ? "すべての入力の組合せと、各ゲートおよび最終出力の値"
    : "すべての入力の組合せと、最終出力の値";
  $("circuit-truth").querySelector("thead").innerHTML =
    `<tr><th scope="colgroup" colspan="${inputs.length}">入力</th>${visibleGates.length ? `<th scope="colgroup" colspan="${visibleGates.length}">途中の出力</th>` : ""}<th scope="colgroup" colspan="${outputs.length}">最終出力</th></tr><tr>${columns.map((n) => `<th scope="col" data-column="${n.id}">${headerLabel(n)}</th>`).join("")}</tr>`;
  $("circuit-truth").querySelector("tbody").innerHTML = truthTable(graph)
    .map((row) => {
      const current = inputs.every((n) => n.value === row.inputs[n.id]);
      return `<tr class="${current ? "current-row" : ""}" data-row="${row.index}" tabindex="0" data-focus-key="row-${row.index}" aria-label="${inputs.map((n) => `${n.label}=${row.inputs[n.id]}`).join("、")}で試す"${current ? ' aria-current="true"' : ""}>${columns.map((n) => `<td class="cell-${signalClass(row.values.get(n.id))}" data-column="${n.id}">${showValue(row.values.get(n.id))}</td>`).join("")}</tr>`;
    })
    .join("");
  restoreFocus(key);
}
function render() {
  restoreCounters();
  const values = evaluate(graph);
  stage.classList.toggle("complex-circuit", graph.nodes.length > 20);
  const readout = arithmeticReadout(graph, values);
  $("circuit-calculation").textContent = readout;
  $("circuit-calculation").hidden = !readout;
  renderBoard(values);
  renderTruth();
  $("undo-circuit").disabled = !past.length;
  $("redo-circuit").disabled = !future.length;
  $("delete-selected").disabled = !selected;
  for (const type of ["input", "output"])
    document.querySelector(`[data-part="${type}"]`).disabled =
      graph.nodes.filter((n) => n.type === type).length >= 4;
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => {
    $("circuit-announcement").textContent = graph.nodes
      .filter((n) => n.type === "output")
      .map((n) => `${label(n)}は${showValue(values.get(n.id))}`)
      .join("、");
  }, 200);
}
function updateCamera() {
  const { width, height } = dimensions();
  board.setAttribute(
    "viewBox",
    `${camera.x} ${camera.y} ${width / camera.zoom} ${height / camera.zoom}`,
  );
  const background = $("board-background");
  for (const [key, value] of Object.entries({
    x: camera.x,
    y: camera.y,
    width: width / camera.zoom,
    height: height / camera.zoom,
  }))
    background.setAttribute(key, value);
  $("zoom-out-circuit").disabled = camera.zoom <= minimumZoom;
  $("zoom-in-circuit").disabled = camera.zoom >= 2;
  renderBoard();
}
function zoomAt(zoom, clientX, clientY) {
  const rect = board.getBoundingClientRect(),
    anchor = worldPoint(clientX, clientY);
  camera.zoom = Math.max(minimumZoom, Math.min(2, zoom));
  camera.x = anchor.x - (clientX - rect.left) / camera.zoom;
  camera.y = anchor.y - (clientY - rect.top) / camera.zoom;
  updateCamera();
}
function zoomBy(factor) {
  const r = board.getBoundingClientRect();
  zoomAt(camera.zoom * factor, r.left + r.width / 2, r.top + r.height / 2);
}
function fitAll(size = dimensions()) {
  const left = Math.min(...graph.nodes.map((n) => n.x)) - 72,
    right = Math.max(...graph.nodes.map((n) => n.x)) + 78;
  const top = Math.min(...graph.nodes.map((n) => n.y)) - 65,
    bottom = Math.max(...graph.nodes.map((n) => n.y)) + 56;
  camera.zoom = Math.max(
    minimumZoom,
    Math.min(1, size.width / (right - left), size.height / (bottom - top)),
  );
  camera.x = (left + right) / 2 - size.width / camera.zoom / 2;
  camera.y = (top + bottom) / 2 - size.height / camera.zoom / 2;
  updateCamera();
}
function updatePreview() {
  const path = $("wire-preview");
  if (gesture?.kind !== "wire" || !gesture.moved) {
    path.setAttribute("d", "");
    return;
  }
  const a = pointOf(gesture.port),
    b = gesture.point;
  const from = gesture.port.direction === "out" ? a : b,
    to = gesture.port.direction === "out" ? b : a;
  const bend = Math.max(26, Math.abs(to.x - from.x) * 0.4);
  path.setAttribute(
    "d",
    curve([
      from,
      { x: from.x + bend, y: from.y },
      { x: to.x - bend, y: to.y },
      to,
    ]),
  );
}
function portFromElement(element) {
  const p = element?.closest?.(".port");
  return p
    ? {
        node: p.dataset.node,
        direction: p.dataset.direction,
        port: Number(p.dataset.port),
      }
    : null;
}
function nearestPort(clientX, clientY, exclude) {
  const point = worldPoint(clientX, clientY);
  let best,
    distance = 19 / camera.zoom;
  for (const node of graph.nodes)
    for (const direction of ["in", "out"])
      for (
        let i = 0;
        i < parts[node.type][direction === "in" ? "inputs" : "outputs"];
        i++
      ) {
        const port = { node: node.id, direction, port: i };
        if (
          exclude &&
          exclude.node === port.node &&
          exclude.port === port.port &&
          exclude.direction === direction
        )
          continue;
        const p = pointOf(port),
          delta = Math.hypot(p.x - point.x, p.y - point.y);
        if (delta < distance) {
          distance = delta;
          best = port;
        }
      }
  return best;
}
function cancelGesture() {
  if (gesture?.kind === "move" && gesture.moved) graph = gesture.before;
  gesture = undefined;
  pointers.clear();
  $("part-ghost").hidden = true;
  updatePreview();
}
function startPinch() {
  const [a, b] = [...pointers.values()],
    x = (a.x + b.x) / 2,
    y = (a.y + b.y) / 2;
  if (gesture?.kind === "move" && gesture.moved) {
    graph = gesture.before;
    render();
  }
  gesture = {
    kind: "pinch",
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    zoom: camera.zoom,
    anchor: worldPoint(x, y),
  };
  updatePreview();
}
board.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  board.setPointerCapture(event.pointerId);
  if (pointers.size === 2) return startPinch();
  const nameElement = event.target.closest("[data-node-name]"),
    port = portFromElement(event.target),
    nodeElement = event.target.closest(".circuit-node"),
    edgeElement = event.target.closest("[data-edge]");
  const common = {
    pointer: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
  if (nameElement)
    gesture = { ...common, kind: "name", id: nameElement.dataset.nodeName };
  else if (port)
    gesture = {
      ...common,
      kind: "wire",
      port,
      point: worldPoint(event.clientX, event.clientY),
    };
  else if (nodeElement) {
    const node = findNode(nodeElement.dataset.id);
    selected = { kind: "node", id: node.id };
    gesture = {
      ...common,
      kind: "move",
      id: node.id,
      x: node.x,
      y: node.y,
      before: clone(graph),
    };
    render();
    restoreFocus(`node-${node.id}`);
  } else if (edgeElement) {
    selected = { kind: "edge", id: edgeElement.dataset.edge };
    gesture = { ...common, kind: "select" };
    render();
    message("線を選択しました。削除、または分岐パーツの追加ができます。");
  } else {
    selected = undefined;
    pendingPort = undefined;
    gesture = { ...common, kind: "pan", x: camera.x, y: camera.y };
    render();
  }
});
for (const button of document.querySelectorAll("[data-part]")) {
  const type = button.dataset.part;
  if (button.querySelector(".part-icon"))
    button.querySelector(".part-icon").innerHTML = miniSymbol(type);
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || button.disabled) return;
    button.setPointerCapture(event.pointerId);
    gesture = {
      kind: "new",
      pointer: event.pointerId,
      type,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  });
  button.addEventListener("click", () => {
    if (suppressPaletteClick) {
      suppressPaletteClick = false;
      return;
    }
    addPart(type);
  });
}
window.addEventListener(
  "pointermove",
  (event) => {
    if (pointers.has(event.pointerId))
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    if (gesture.kind === "pinch") {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const rect = board.getBoundingClientRect(),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      camera.zoom = Math.max(
        minimumZoom,
        Math.min(
          2,
          (gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
            Math.max(1, gesture.distance),
        ),
      );
      camera.x = gesture.anchor.x - (x - rect.left) / camera.zoom;
      camera.y = gesture.anchor.y - (y - rect.top) / camera.zoom;
      updateCamera();
      return;
    }
    if (event.pointerId !== gesture.pointer) return;
    const dx = event.clientX - gesture.startX,
      dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > 5) gesture.moved = true;
    if (!gesture.moved) return;
    if (gesture.kind === "new") {
      const ghost = $("part-ghost");
      ghost.hidden = false;
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
      ghost.innerHTML =
        miniSymbol(gesture.type) || `<span>${parts[gesture.type].name}</span>`;
    } else if (gesture.kind === "wire") {
      gesture.point = worldPoint(event.clientX, event.clientY);
      updatePreview();
    } else if (gesture.kind === "move") {
      const node = findNode(gesture.id);
      node.x = snap(gesture.x + dx / camera.zoom);
      node.y = snap(gesture.y + dy / camera.zoom);
      renderBoard();
    } else if (gesture.kind === "pan") {
      camera.x = gesture.x - dx / camera.zoom;
      camera.y = gesture.y - dy / camera.zoom;
      updateCamera();
    }
  },
  { passive: true },
);
window.addEventListener("pointerup", (event) => {
  pointers.delete(event.pointerId);
  if (gesture?.kind === "pinch") {
    if (!pointers.size) gesture = undefined;
    return;
  }
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const completed = gesture;
  gesture = undefined;
  $("part-ghost").hidden = true;
  updatePreview();
  if (completed.kind === "name") {
    if (!completed.moved) openTerminalName(completed.id);
  } else if (completed.kind === "new") {
    if (completed.moved) {
      suppressPaletteClick = true;
      setTimeout(() => (suppressPaletteClick = false), 0);
      if (insideStage(event.clientX, event.clientY))
        addPart(completed.type, worldPoint(event.clientX, event.clientY), true);
    }
  } else if (completed.kind === "wire") {
    const target = completed.moved
      ? nearestPort(event.clientX, event.clientY, completed.port)
      : null;
    if (target) {
      pendingPort = completed.port;
      connectPorts(completed.port, target);
    } else choosePort(completed.port);
  } else if (completed.kind === "move") {
    if (completed.moved) {
      remember(completed.before);
      graph.example = "";
      render();
      save();
    } else if (findNode(completed.id).type === "input")
      toggleInput(completed.id);
  }
});
window.addEventListener("pointercancel", () => {
  cancelGesture();
  render();
});
window.addEventListener("blur", () => {
  stageResize = undefined;
  cancelGesture();
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelGesture();
    render();
  }
});
board.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      zoomAt(
        camera.zoom * Math.exp(-event.deltaY * 0.005),
        event.clientX,
        event.clientY,
      );
    }
  },
  { passive: false },
);
board.addEventListener("keydown", (event) => {
  const nameElement = event.target.closest("[data-node-name]");
  if (nameElement) {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      openTerminalName(nameElement.dataset.nodeName);
    }
    return;
  }
  const port = portFromElement(event.target),
    nodeElement = event.target.closest(".circuit-node"),
    wireElement = event.target.closest("[data-edge]");
  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    if (port) choosePort(port);
    else if (wireElement) {
      selected = { kind: "edge", id: wireElement.dataset.edge };
      pendingPort = undefined;
      render();
      message("線を選択しました。削除、または分岐パーツの追加ができます。");
    } else if (nodeElement) {
      const node = findNode(nodeElement.dataset.id);
      selected = { kind: "node", id: node.id };
      if (node.type === "input") toggleInput(node.id);
      else render();
    }
  } else if (
    nodeElement &&
    !port &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    event.preventDefault();
    const node = findNode(nodeElement.dataset.id),
      step = event.shiftKey ? 24 : 8;
    change(() => {
      selected = { kind: "node", id: node.id };
      node.x +=
        event.key === "ArrowRight"
          ? step
          : event.key === "ArrowLeft"
            ? -step
            : 0;
      node.y +=
        event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    });
  } else if (event.key === "Escape") {
    cancelGesture();
    pendingPort = undefined;
    selected = undefined;
    render();
    message("選択を解除しました。", false, true);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input,select,textarea,dialog")) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo(event.shiftKey);
  }
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    event.target.closest(".circuit-lab") &&
    selected
  ) {
    event.preventDefault();
    deleteSelected();
  }
});
$("circuit-truth").addEventListener("click", (event) => {
  const row = event.target.closest("[data-row]");
  if (row) applyRow(Number(row.dataset.row));
});
$("circuit-truth").addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key)) {
    const row = event.target.closest("[data-row]");
    if (row) {
      event.preventDefault();
      applyRow(Number(row.dataset.row));
    }
  }
});
$("toggle-intermediate").onclick = () => {
  showIntermediate = !showIntermediate;
  renderTruth();
};
$("undo-circuit").onclick = () => undo();
$("redo-circuit").onclick = () => undo(true);
$("delete-selected").onclick = deleteSelected;
$("zoom-out-circuit").onclick = () => zoomBy(1 / 1.2);
$("zoom-in-circuit").onclick = () => zoomBy(1.2);
$("fit-circuit").onclick = () => fitAll();
const resizeHandle = $("resize-circuit");
function resizeStage(width, height) {
  const maximumWidth = stage.parentElement.clientWidth;
  stage.style.width = `${Math.max(Math.min(260, maximumWidth), Math.min(maximumWidth, width))}px`;
  stage.style.height = `${Math.max(260, Math.min(1400, height))}px`;
}
function resizeFromPointer(event) {
  if (stageResize?.pointer !== event.pointerId) return;
  resizeStage(
    stageResize.width +
      (stageResize.axis === "height" ? 0 : event.clientX - stageResize.x),
    stageResize.height +
      (stageResize.axis === "width" ? 0 : event.clientY - stageResize.y),
  );
}
for (const handle of stage.querySelectorAll("[data-resize-axis]")) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    cancelGesture();
    const size = stage.getBoundingClientRect();
    stageResize = {
      pointer: event.pointerId,
      axis: handle.dataset.resizeAxis,
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
    };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", resizeFromPointer);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    handle.addEventListener(type, (event) => {
      if (stageResize?.pointer !== event.pointerId) return;
      if (type === "pointerup") resizeFromPointer(event);
      stageResize = undefined;
    });
}
resizeHandle.addEventListener("keydown", (event) => {
  if (event.key === "Home") {
    event.preventDefault();
    stage.style.width = "";
    stage.style.height = "";
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
    return;
  event.preventDefault();
  const size = stage.getBoundingClientRect(),
    step = event.shiftKey ? 64 : 16,
    width = parseFloat(stage.style.width) || size.width,
    height = parseFloat(stage.style.height) || size.height;
  resizeStage(
    width +
      (event.key === "ArrowLeft"
        ? -step
        : event.key === "ArrowRight"
          ? step
          : 0),
    height +
      (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
  );
});

graph = exampleCircuit("and", stage.clientWidth, stage.clientHeight);
render();
updateCamera();
new ResizeObserver(([entry]) => {
  if (
    fitAfterResize?.graph === graph &&
    Math.abs(entry.contentRect.height - fitAfterResize.height) > 0.5
  ) {
    fitAfterResize = undefined;
    fitAll({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    });
  } else updateCamera();
}).observe(stage);
documentTools = installDocumentControls({
  read: () => graph,
  makeExample: (type) =>
    exampleCircuit(type, stage.clientWidth, stage.clientHeight),
  makeNew: () => exampleCircuit("blank", stage.clientWidth, stage.clientHeight),
  replace: (incoming) => {
    // A change in the drawing area's height commits after the modal closes.
    // Refit using the actual new size when ResizeObserver reports it.
    const largerStage = incoming.nodes.length > 20;
    fitAfterResize =
      stage.style.height ||
      stage.classList.contains("complex-circuit") === largerStage
        ? undefined
        : { graph: incoming, height: stage.clientHeight };
    graph = incoming;
    selected = pendingPort = undefined;
    past = [];
    future = [];
    render();
    fitAll();
  },
  cancel: cancelGesture,
  message,
});
documentTools.start();
