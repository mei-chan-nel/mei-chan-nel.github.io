import {
  parts,
  outputs,
  incoming,
  connect,
  nextOf,
  displayNode,
  backwardEdges,
} from "./graph.mjs";
import {
  esc,
  shape,
  dimensions,
  portPoint,
  linesOf,
  mini,
} from "./symbols.mjs";
import { installCanvasResize } from "../shared/resize.mjs";
import { wireGeometry, pointOnWire } from "./wires.mjs";
import { joinWire } from "./connections.mjs";
export class FlowCanvas {
  constructor({
    stage,
    board,
    read,
    scope,
    asts,
    run,
    change,
    edit,
    add,
    message,
    undo,
  }) {
    Object.assign(this, {
      stage,
      board,
      read,
      scope,
      asts,
      run,
      change,
      edit,
      add,
      message,
      undo,
    });
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.selected = null;
    this.pending = null;
    this.pointers = new Map();
    this.gesture = null;
    this.suppress = false;
    installCanvasResize(stage, { onStart: () => this.cancel() });
    new ResizeObserver(() => this.updateCamera()).observe(stage);
    for (const b of document.querySelectorAll("[data-part]")) {
      b.querySelector(".part-icon").innerHTML = mini(b.dataset.part);
      b.addEventListener("pointerdown", (e) =>
        this.paletteDown(e, b.dataset.part),
      );
      b.addEventListener("click", () => {
        if (!this.suppress && !this.run()) this.place(b.dataset.part);
      });
    }
    board.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    window.addEventListener("pointercancel", () => {
      this.cancel();
      this.render();
    });
    window.addEventListener("blur", () => {
      this.cancel();
    });
    board.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        this.zoomAt(
          this.camera.zoom * Math.exp(-e.deltaY * 0.005),
          e.clientX,
          e.clientY,
        );
      },
      { passive: false },
    );
    board.addEventListener("keydown", (e) => this.key(e));
  }
  cancel() {
    if (this.gesture?.kind === "node") {
      const n = this.read().nodes.find((n) => n.id === this.gesture.id);
      if (n) Object.assign(n, this.gesture.initial);
    }
    this.gesture = null;
    this.pointers.clear();
    this.pending = null;
    document.getElementById("part-ghost").hidden = true;
    this.render();
  }
  point(x, y) {
    const r = this.board.getBoundingClientRect();
    return {
      x: this.camera.x + (x - r.left) / this.camera.zoom,
      y: this.camera.y + (y - r.top) / this.camera.zoom,
    };
  }
  inStage(x, y) {
    const r = this.stage.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  visibleNodes() {
    return this.read().nodes.filter((n) => n.scope === this.scope());
  }
  updateCamera() {
    const { x, y, zoom } = this.camera;
    this.board.setAttribute(
      "viewBox",
      `${x} ${y} ${this.stage.clientWidth / zoom} ${this.stage.clientHeight / zoom}`,
    );
  }
  fit() {
    const nodes = this.visibleNodes();
    if (!nodes.length) {
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.updateCamera();
      return;
    }
    const ids = new Set(nodes.map((n) => n.id)),
      wires = this.read()
        .edges.filter((e) => ids.has(e.from))
        .map((e) => wireGeometry(this.read(), e).bounds);
    const minX =
        Math.min(
          ...nodes.map((n) => n.x - dimensions(n.type).w / 2),
          ...wires.map((w) => w.minX),
        ) - 70,
      maxX =
        Math.max(
          ...nodes.map((n) => n.x + dimensions(n.type).w / 2),
          ...wires.map((w) => w.maxX),
        ) + 70,
      minY =
        Math.min(
          ...nodes.map((n) => n.y - dimensions(n.type).h / 2),
          ...wires.map((w) => w.minY),
        ) - 45,
      maxY =
        Math.max(
          ...nodes.map((n) => n.y + dimensions(n.type).h / 2),
          ...wires.map((w) => w.maxY),
        ) + 45;
    const zoom = Math.max(
      0.12,
      Math.min(
        1.2,
        this.stage.clientWidth / (maxX - minX),
        this.stage.clientHeight / (maxY - minY),
      ),
    );
    this.camera = {
      x: (minX + maxX) / 2 - this.stage.clientWidth / zoom / 2,
      y: (minY + maxY) / 2 - this.stage.clientHeight / zoom / 2,
      zoom,
    };
    this.updateCamera();
  }
  reveal(id) {
    const n = this.read().nodes.find((n) => n.id === id);
    if (!n) return;
    const { w, h } = dimensions(n.type),
      c = this.camera;
    if (
      n.x - w / 2 < c.x ||
      n.x + w / 2 > c.x + this.stage.clientWidth / c.zoom ||
      n.y - h / 2 < c.y ||
      n.y + h / 2 > c.y + this.stage.clientHeight / c.zoom
    ) {
      c.x = n.x - this.stage.clientWidth / c.zoom / 2;
      c.y = n.y - this.stage.clientHeight / c.zoom / 2;
      this.updateCamera();
    }
  }
  zoomAt(zoom, x, y) {
    const p = this.point(x, y),
      r = this.board.getBoundingClientRect();
    this.camera.zoom = Math.max(0.12, Math.min(2.4, zoom));
    this.camera.x = p.x - (x - r.left) / this.camera.zoom;
    this.camera.y = p.y - (y - r.top) / this.camera.zoom;
    this.updateCamera();
  }
  zoom(factor) {
    const r = this.board.getBoundingClientRect();
    this.zoomAt(
      this.camera.zoom * factor,
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
  }
  render() {
    const g = this.read(),
      scope = this.scope(),
      r = this.run(),
      asts = this.asts(),
      focus = document.activeElement?.dataset?.focusKey;
    const wires = document.getElementById("flow-wires"),
      nodes = document.getElementById("flow-nodes"),
      bad = new Set(backwardEdges(g).map((e) => e.id));
    wires.innerHTML = g.edges
      .filter((e) => g.nodes.find((n) => n.id === e.from).scope === scope)
      .map((e) => {
        const { path, arrow } = wireGeometry(g, e);
        return `<g class="flow-wire ${bad.has(e.id) ? "is-invalid" : ""} ${r?.lastEdge === e.id ? "is-current" : ""} ${this.selected?.kind === "edge" && this.selected.id === e.id ? "is-selected" : ""}" data-edge="${e.id}" tabindex="${r ? -1 : 0}" role="button" aria-label="${e.from.slice(1)}番から${e.to.slice(1)}番への矢印を選択" data-focus-key="edge-${e.id}"><path class="flow-wire-hit" d="${path}"/><path class="flow-wire-line" d="${path}"${arrow ? ` marker-end="url(#flow-arrow${r?.lastEdge === e.id ? "-active" : ""})"` : ""}/></g>`;
      })
      .join("");
    document.getElementById("flow-pairs").innerHTML = this.visibleNodes()
      .filter(
        (n) => n.type === "loopStart" && g.nodes.some((v) => v.id === n.pair),
      )
      .map((n) => {
        const end = g.nodes.find((v) => v.id === n.pair),
          x = Math.min(n.x, end.x) - 145;
        return `<path class="flow-loop-pair" d="M${x + 15} ${n.y}H${x}V${end.y}H${x + 15}"/><text class="flow-pair-label" x="${x - 6}" y="${(n.y + end.y) / 2}">L${n.id.slice(1)}</text>`;
      })
      .join("");
    nodes.innerHTML = this.visibleNodes()
      .map((n) => {
        const text = displayNode(n, asts),
          lines = linesOf(text, n.type),
          { w, h } = n.junction ? { w: 24, h: 0 } : dimensions(n.type),
          current = r?.active === n.id,
          next =
            r?.state.pc !== null && r?.graph.nodes[r.state.pc]?.id === n.id;
        let ports = "";
        if (!r && !n.junction) {
          for (const direction of ["in", "out"])
            for (
              let p = 0;
              p < (direction === "in" ? incoming(n) : outputs(n));
              p++
            ) {
              const point = portPoint(n, direction, p),
                label =
                  direction === "in"
                    ? "入口"
                    : n.type === "decision"
                      ? p === 0
                        ? "はい"
                        : "いいえ"
                      : "出口";
              ports += `<g class="flow-port ${this.pending?.node === n.id && this.pending.direction === direction && this.pending.port === p ? "is-pending" : ""}" data-node="${n.id}" data-direction="${direction}" data-port="${p}" transform="translate(${point.x - n.x} ${point.y - n.y})" role="button" tabindex="0" aria-label="${n.id.slice(1)}番の${label}" data-focus-key="${n.id}-${direction}-${p}"><circle class="flow-port-hit" r="15"/><circle r="5"/></g>`;
            }
        }
        const labels =
          n.type === "decision"
            ? `<text class="flow-branch-label" data-branch="yes" x="-23" y="${h / 2 + 24}">はい</text><text class="flow-branch-label" data-branch="no" x="${w / 2 + 34}" y="-12">いいえ</text>`
            : "";
        const hit = n.junction
          ? '<rect class="flow-merge-hit" x="-8" y="-8" width="16" height="16"/>'
          : n.type === "connector"
            ? '<rect class="flow-merge-hit" x="-20" y="-18" width="40" height="36"/>'
            : "";
        const body = n.junction
          ? current
            ? '<circle class="flow-junction-active" r="3"/>'
            : ""
          : shape(n.type);
        return `<g class="flow-node ${current ? "is-current" : ""} ${next ? "is-next" : ""} ${this.selected?.id === n.id ? "is-selected" : ""}" data-id="${n.id}" data-type="${n.type}" data-junction="${!!n.junction}" transform="translate(${n.x} ${n.y})"><g class="flow-node-body" role="button" tabindex="0" data-focus-key="node-${n.id}" aria-label="${esc(lines.join(" ") || parts[n.type])} ${n.id.slice(1)}を${r ? "選択" : "編集"}"><title>${esc(text || parts[n.type])}</title>${hit}${body}<text class="flow-node-code"${n.type === "connector" ? ' transform="translate(-28 0)"' : ""}>${lines.map((line, i) => `<tspan x="0" y="${(i - (lines.length - 1) / 2) * 18 + 5}">${esc(line)}</tspan>`).join("")}</text></g><text class="flow-node-number" x="${w / 2 - 5}" y="${-h / 2 - 10}">${n.id.slice(1)}</text>${labels}${ports}</g>`;
      })
      .join("");
    const selectedEdge =
      !r && this.selected?.kind === "edge"
        ? g.edges.find((e) => e.id === this.selected.id)
        : null;
    document.getElementById("flow-wire-handles").innerHTML = selectedEdge
      ? (() => {
          const point = portPoint(
            g.nodes.find((n) => n.id === selectedEdge.to),
            "in",
          );
          return `<g class="flow-edge-end" data-rewire-edge="${selectedEdge.id}" transform="translate(${point.x} ${point.y})" role="button" tabindex="0" data-focus-key="head-${selectedEdge.id}" aria-label="矢印の先をドラッグ・選択して接続先を変更"><circle class="flow-end-hit" r="15"/><circle r="6"/></g>`;
        })()
      : "";
    this.updateCamera();
    this.preview();
    if (focus)
      this.board
        .querySelector(`[data-focus-key="${CSS.escape(focus)}"]`)
        ?.focus({ preventScroll: true });
    document.getElementById("delete-selected").disabled = !!r || !this.selected;
  }
  preview(point) {
    const path = document.getElementById("flow-preview");
    const indicator = document.getElementById("flow-join-preview");
    indicator.toggleAttribute("hidden", true);
    for (const wire of this.board.querySelectorAll(".flow-wire.is-target"))
      wire.classList.remove("is-target");
    if (!this.pending || !point) {
      path.setAttribute("d", "");
      return;
    }
    const n = this.read().nodes.find((n) => n.id === this.pending.node);
    if (!n) return;
    const a = portPoint(n, this.pending.direction, this.pending.port);
    const target =
      this.pending.direction === "out"
        ? this.nearestWire(point, this.pending)
        : null;
    if (target && target.point.y >= a.y) {
      point = target.point;
      indicator.setAttribute("cx", point.x);
      indicator.setAttribute("cy", point.y);
      indicator.toggleAttribute("hidden", false);
      this.board
        .querySelector(`[data-edge="${target.edge.id}"]`)
        ?.classList.add("is-target");
    }
    path.classList.toggle(
      "is-invalid",
      this.pending.direction === "out" && point.y < a.y,
    );
    path.setAttribute("d", `M${a.x} ${a.y}L${point.x} ${point.y}`);
  }
  nearestWire(point, from = this.pending) {
    let best,
      distance = 14 / this.camera.zoom;
    const g = this.read(),
      scope = this.scope();
    for (const edge of g.edges) {
      if (
        (edge.from === from?.node && edge.port === from?.port) ||
        g.nodes.find((n) => n.id === edge.from).scope !== scope
      )
        continue;
      const hit = pointOnWire(g, edge, point);
      if (hit && hit.distance < distance) {
        distance = hit.distance;
        best = { ...hit, edge };
      }
    }
    return best;
  }
  join(target) {
    if (this.run() || this.pending?.direction !== "out") return;
    const from = this.pending;
    this.pending = null;
    let id;
    const changed = this.change((g) => {
      const result = joinWire(
        g,
        from.node,
        from.port,
        target.edge.id,
        target.point,
      );
      Object.assign(g, result.graph);
      id = result.id;
    });
    if (changed !== false) {
      this.selected = { kind: "node", id };
      this.message("線の途中に合流しました。");
    }
    this.render();
  }
  rewire(id) {
    const edge = this.read().edges.find((e) => e.id === id);
    if (!edge) return;
    this.pending = { node: edge.from, port: edge.port, direction: "out" };
    this.render();
    this.message("矢印の先を入口・線の途中へつなぎます。");
  }
  choose(port) {
    if (this.run()) return;
    if (!this.pending) {
      this.pending = port;
      this.render();
      return;
    }
    const from = this.pending.direction === "out" ? this.pending : port,
      to = this.pending.direction === "in" ? this.pending : port;
    if (from.direction !== "out" || to.direction !== "in") {
      this.pending = port;
      this.render();
      return;
    }
    this.pending = null;
    if (this.change((g) => connect(g, from.node, from.port, to.node)) === false)
      this.render();
  }
  port(el) {
    const p = el?.closest?.(".flow-port");
    return p
      ? {
          node: p.dataset.node,
          direction: p.dataset.direction,
          port: +p.dataset.port,
        }
      : null;
  }
  nearest(point, direction) {
    let nearest = null,
      distance = 22 / this.camera.zoom;
    for (const n of this.visibleNodes().filter((n) => !n.junction))
      for (
        let p = 0;
        p < (direction === "in" ? incoming(n) : outputs(n));
        p++
      ) {
        const a = portPoint(n, direction, p),
          d = Math.hypot(point.x - a.x, point.y - a.y);
        if (d < distance) {
          nearest = { node: n.id, direction, port: p };
          distance = d;
        }
      }
    return nearest;
  }
  paletteDown(e, type) {
    if (e.button !== 0 || this.run()) return;
    e.preventDefault();
    this.cancel();
    this.gesture = {
      kind: "new",
      type,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.board.setPointerCapture(e.pointerId);
    if (this.pointers.size === 2) {
      if (this.gesture?.kind === "node") {
        const n = this.read().nodes.find((n) => n.id === this.gesture.id);
        if (n) Object.assign(n, this.gesture.initial);
        this.render();
      }

      const [a, b] = [...this.pointers.values()];
      this.gesture = {
        kind: "pinch",
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: this.camera.zoom,
        anchor: this.point((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
      return;
    }
    const common = {
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      },
      port = this.port(e.target),
      node = e.target.closest(".flow-node"),
      edge = e.target.closest("[data-edge]"),
      handle = e.target.closest("[data-rewire-edge]");
    if (handle && !this.run()) {
      this.rewire(handle.dataset.rewireEdge);
      this.gesture = {
        ...common,
        kind: "wire",
        port: this.pending,
        oldPending: this.pending,
      };
    } else if (port && !this.run()) {
      this.gesture = {
        ...common,
        kind: "wire",
        port,
        oldPending: this.pending,
      };
      this.pending = port;
      this.render();
    } else if (
      this.pending?.direction === "out" &&
      !this.run() &&
      this.nearestWire(this.point(e.clientX, e.clientY))
    ) {
      this.join(this.nearestWire(this.point(e.clientX, e.clientY)));
    } else if (node && !this.run()) {
      const n = this.read().nodes.find((n) => n.id === node.dataset.id),
        wasSelected =
          this.selected?.kind === "node" && this.selected.id === n.id;
      this.selected = { kind: "node", id: n.id };
      this.gesture = {
        ...common,
        kind: "node",
        id: n.id,
        wasSelected,
        initial: { x: n.x, y: n.y },
        point: this.point(e.clientX, e.clientY),
      };
      this.pending = null;
      this.render();
    } else if (edge && !this.run()) {
      this.selected = { kind: "edge", id: edge.dataset.edge };
      this.render();
      this.gesture = { ...common, kind: "edge" };
    } else {
      this.gesture = { ...common, kind: "pan", camera: { ...this.camera } };
      this.selected = null;
      this.pending = null;
      this.render();
    }
  }
  move(e) {
    if (this.pointers.has(e.pointerId))
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t = this.gesture;
    if (!t) {
      if (this.pending && this.inStage(e.clientX, e.clientY))
        this.preview(this.point(e.clientX, e.clientY));
      return;
    }
    if (t.kind === "pinch") {
      if (this.pointers.size !== 2) return;
      const [a, b] = [...this.pointers.values()],
        rect = this.board.getBoundingClientRect(),
        zoom = Math.max(
          0.12,
          Math.min(
            2.4,
            (t.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
              Math.max(1, t.distance),
          ),
        );
      this.camera = {
        zoom,
        x: t.anchor.x - ((a.x + b.x) / 2 - rect.left) / zoom,
        y: t.anchor.y - ((a.y + b.y) / 2 - rect.top) / zoom,
      };
      this.updateCamera();
      return;
    }
    if (t.pointer !== e.pointerId) return;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 5) t.moved = true;
    const p = this.point(e.clientX, e.clientY);
    if (t.kind === "new" && t.moved) {
      const ghost = document.getElementById("part-ghost");
      ghost.hidden = false;
      ghost.innerHTML = mini(t.type);
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
    }
    if (t.kind === "pan" && t.moved) {
      this.camera.x = t.camera.x - (e.clientX - t.x) / this.camera.zoom;
      this.camera.y = t.camera.y - (e.clientY - t.y) / this.camera.zoom;
      this.updateCamera();
    }
    if (t.kind === "node" && t.moved) {
      const n = this.read().nodes.find((n) => n.id === t.id);
      n.x = Math.max(
        -9500,
        Math.min(9500, Math.round((t.initial.x + p.x - t.point.x) / 8) * 8),
      );
      n.y = Math.max(
        -9500,
        Math.min(9500, Math.round((t.initial.y + p.y - t.point.y) / 8) * 8),
      );
      this.render();
    }
    if (t.kind === "wire") this.preview(p);
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    const t = this.gesture;
    if (!t) return;
    if (t.kind === "pinch") {
      this.gesture = null;
      return;
    }
    if (t.pointer !== e.pointerId) return;
    this.gesture = null;
    document.getElementById("part-ghost").hidden = true;
    if (t.kind === "new" && t.moved) {
      this.suppress = true;
      setTimeout(() => {
        this.suppress = false;
      }, 0);
      if (this.inStage(e.clientX, e.clientY))
        this.place(
          t.type,
          this.point(e.clientX, e.clientY),
          document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest("[data-edge]")?.dataset.edge,
        );
    } else if (t.kind === "node") {
      if (t.moved) {
        const n = this.read().nodes.find((n) => n.id === t.id),
          position = { x: n.x, y: n.y };
        n.x = t.initial.x;
        n.y = t.initial.y;
        if (
          this.change((g) =>
            Object.assign(
              g.nodes.find((n) => n.id === t.id),
              position,
            ),
          ) === false
        )
          this.render();
      } else if (t.wasSelected) this.edit(t.id);
    } else if (t.kind === "wire") {
      if (t.moved) {
        const point = this.point(e.clientX, e.clientY),
          element = document.elementFromPoint(e.clientX, e.clientY),
          direct = this.port(element),
          target =
            direct && direct.direction !== t.port.direction ? direct : null,
          wire =
            t.port.direction === "out" ? this.nearestWire(point, t.port) : null,
          nearby = this.nearest(
            point,
            t.port.direction === "out" ? "in" : "out",
          );
        if (target) this.choose(target);
        else if (wire) this.join(wire);
        else if (nearby) this.choose(nearby);
        else {
          this.pending = null;
          this.render();
        }
      } else {
        this.pending = t.oldPending;
        this.choose(t.port);
      }
    }
  }
  place(type, point, edgeId) {
    const p = point ?? {
      x: this.camera.x + this.stage.clientWidth / this.camera.zoom / 2,
      y: this.camera.y + this.stage.clientHeight / this.camera.zoom / 2,
    };
    if (!point) {
      let tries = 0;
      while (
        this.visibleNodes().some(
          (n) => Math.abs(n.x - p.x) < 220 && Math.abs(n.y - p.y) < 95,
        ) &&
        tries++ < 12
      ) {
        p.x += 80;
        p.y += 80;
      }
    }
    this.add(
      type,
      p,
      edgeId ?? (this.selected?.kind === "edge" ? this.selected.id : null),
    );
  }
  key(e) {
    if (document.querySelector("dialog[open]")) return;
    const port = this.port(e.target),
      node = e.target.closest(".flow-node"),
      edge = e.target.closest("[data-edge]"),
      handle = e.target.closest("[data-rewire-edge]");
    if (["Enter", " "].includes(e.key) && !this.run()) {
      e.preventDefault();
      if (handle) this.rewire(handle.dataset.rewireEdge);
      else if (port) this.choose(port);
      else if (node) this.edit(node.dataset.id);
      else if (edge) {
        if (this.pending?.direction === "out") {
          const model = this.read().edges.find(
              (w) => w.id === edge.dataset.edge,
            ),
            points = wireGeometry(this.read(), model).points;
          const a = portPoint(
            this.read().nodes.find((n) => n.id === this.pending.node),
            "out",
            this.pending.port,
          );
          const segments = points
            .slice(1)
            .map((p, i) => ({
              edge: model,
              point: { x: (p.x + points[i].x) / 2, y: (p.y + points[i].y) / 2 },
              length: Math.hypot(p.x - points[i].x, p.y - points[i].y),
            }))
            .filter((s) => s.point.y >= a.y)
            .sort((a, b) => b.length - a.length);
          if (segments.length) this.join(segments[0]);
          else {
            this.pending = null;
            this.render();
            this.message("上方向へ戻る矢印はつなげません。", true);
          }
          return;
        }
        this.selected = { kind: "edge", id: edge.dataset.edge };
        this.render();
      }
      return;
    }
    if (this.run()) return;
    if (node && !port && e.key.startsWith("Arrow")) {
      e.preventDefault();
      this.selected = { kind: "node", id: node.dataset.id };
      const step = e.shiftKey ? 32 : 8;
      this.change((g) => {
        const n = g.nodes.find((n) => n.id === node.dataset.id);
        n.x +=
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        n.y += e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      });
    }
  }
}
