import { clamp, unproject, zoomAbout } from "./map-model.mjs?v=9";

// A separate camera keeps a cancelled selection from moving the main map.
export class RegionPicker {
  constructor(canvas, { circle, bounds, drawMap, onChange }) {
    Object.assign(this, { canvas, bounds, drawMap, onChange, initialCircle: circle, pointers: new Map(), frame: 0 });
    canvas.tabIndex = 0;
    this.ctx = canvas.getContext("2d"); this.events = new AbortController();
    const listen = (name, handler, options = {}) => canvas.addEventListener(name, handler, { ...options, signal: this.events.signal });
    listen("pointerdown", e => this.down(e)); listen("pointermove", e => this.move(e));
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) listen(name, e => this.up(e));
    listen("wheel", e => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1);
      this.zoom(Math.exp(clamp(-delta * .002, -.5, .5)));
    }, { passive: false });
    listen("keydown", e => {
      if (e.key === "+" || e.key === "=") this.zoom(1.4);
      else if (e.key === "-") this.zoom(1 / 1.4);
      else if (e.key.startsWith("Arrow")) {
        const step = (e.shiftKey ? 40 : 16) / this.camera.scale;
        if (e.key === "ArrowLeft") this.camera.x -= step;
        if (e.key === "ArrowRight") this.camera.x += step;
        if (e.key === "ArrowUp") this.camera.y -= step;
        if (e.key === "ArrowDown") this.camera.y += step;
        this.changed();
      } else return;
      e.preventDefault();
    });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h || (w === this.width && h === this.height)) return;
    const previous = this.camera && this.selection(), oldWidth = this.width, oldHeight = this.height;
    this.center = { x: oldWidth ? this.center.x / oldWidth * w : w / 2, y: oldHeight ? this.center.y / oldHeight * h : h / 2 };
    this.width = w; this.height = h; this.radius = Math.min(w, h) * .32;
    const pad = this.radius + 5;
    this.center.x = clamp(this.center.x, pad, w - pad); this.center.y = clamp(this.center.y, pad, h - pad);
    const b = this.bounds;
    this.minScale = Math.min((w - 24) / (b.maxX - b.minX + 4), (h - 24) / (b.maxY - b.minY + 4)) * .7;
    this.maxScale = this.minScale * 192;
    const circle = previous || this.initialCircle, scale = this.radius / circle.radius;
    this.minScale = Math.min(this.minScale, scale); this.maxScale = Math.max(this.maxScale, scale);
    this.camera = { scale, x: circle.x - (this.center.x - w / 2) / scale, y: circle.y - (this.center.y - h / 2) / scale };
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.ratio); this.canvas.height = Math.round(h * this.ratio);
    this.pointers.clear(); this.gesture = null; this.canvas.classList.remove("is-dragging");
    this.changed();
  }
  selection() {
    return { ...unproject(this.center, this.camera, this.width, this.height), radius: this.radius / this.camera.scale };
  }
  zoom(factor) {
    // Zoom around the circle, preserving its geographic centre.
    this.camera = zoomAbout(this.camera, factor, this.center, this.width, this.height, this.minScale, this.maxScale);
    this.changed();
  }
  local(event) {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  rebase() {
    const points = [...this.pointers.values()];
    this.gesture = points.length >= 2 ? { camera: { ...this.camera }, midpoint: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
      distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)) } :
      points.length ? { start: points[0], center: { ...this.center } } : null;
  }
  down(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault(); this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, this.local(event));
    this.rebase(); this.canvas.classList.add("is-dragging");
  }
  move(event) {
    if (!this.pointers.has(event.pointerId)) return;
    event.preventDefault(); this.pointers.set(event.pointerId, this.local(event));
    const points = [...this.pointers.values()], gesture = this.gesture;
    if (points.length >= 2) {
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      this.camera = zoomAbout(gesture.camera, distance / gesture.distance, gesture.midpoint, this.width, this.height, this.minScale, this.maxScale);
      this.camera.x -= (midpoint.x - gesture.midpoint.x) / this.camera.scale;
      this.camera.y -= (midpoint.y - gesture.midpoint.y) / this.camera.scale;
    } else {
      const pad = this.radius + 5;
      this.center.x = clamp(gesture.center.x + points[0].x - gesture.start.x, pad, this.width - pad);
      this.center.y = clamp(gesture.center.y + points[0].y - gesture.start.y, pad, this.height - pad);
    }
    this.changed();
  }
  up(event) {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.rebase(); this.canvas.classList.toggle("is-dragging", this.pointers.size > 0);
  }
  changed() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); this.onChange(this.selection()); });
  }
  paint() {
    if (!this.camera) return;
    const { ctx, width: w, height: h } = this;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.fillStyle = "#e8efed"; ctx.fillRect(0, 0, w, h); this.drawMap(ctx, this.camera, w, h);
    const { x, y } = this.center, r = this.radius;
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(255 255 255 / 62%)"; ctx.fill("evenodd");
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = "#267765"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = "#267765"; ctx.fill();
  }
  destroy() {
    this.events.abort(); this.observer.disconnect(); cancelAnimationFrame(this.frame);
    for (const id of this.pointers.keys()) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.pointers.clear();
  }
}
