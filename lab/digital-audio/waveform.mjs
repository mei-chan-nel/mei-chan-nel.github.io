import { createSignal, PLAYBACK_RATE, DURATION } from "./pcm.mjs?v=3";
export const plotInsets = { left: 28, right: 8, top: 12, bottom: 24 };
export const minimumSpan = 0.0005;
export const formatMilliseconds = (seconds) =>
  String(Number((seconds * 1000).toFixed(3)));
const blue = "#286788",
  orange = "#a14908",
  originalColor = "#91a5ad",
  reconstructedColor = "#76559b",
  ink = "#58686d";
function surface(canvas) {
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (
    canvas.width !== Math.round(width * ratio) ||
    canvas.height !== Math.round(height * ratio)
  ) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}
function extent(canvas) {
  const s = surface(canvas),
    p = plotInsets;
  return {
    ...s,
    left: p.left,
    top: p.top,
    w: Math.max(1, s.width - p.left - p.right),
    h: s.height - p.top - p.bottom,
  };
}
function envelope(ctx, values, x, width, height, start, span, rate) {
  ctx.beginPath();
  for (let column = 0; column < width; column++) {
    const first = Math.max(
      0,
      Math.floor((start + (column / width) * span) * rate),
    );
    const last = Math.min(
      values.length - 1,
      Math.ceil((start + ((column + 1) / width) * span) * rate),
    );
    let min = Infinity,
      max = -Infinity;
    for (let j = first; j <= last; j++) {
      min = Math.min(min, values[j]);
      max = Math.max(max, values[j]);
    }
    if (!Number.isFinite(min)) continue;
    ctx.moveTo(x + column, height(max));
    ctx.lineTo(x + column, height(min));
  }
  ctx.stroke();
}
export class Waveforms {
  constructor({ overview, combined, density, onWindow }) {
    Object.assign(this, { overview, combined, density, onWindow });
    this.start = 0.04;
    this.span = 0.005;
    this.layers = {
      original: true,
      samples: true,
      quantized: true,
      reconstructed: false,
    };
    this.playhead = null;
    this.observer = new ResizeObserver(() => this.draw());
    for (const canvas of [overview, combined]) this.observer.observe(canvas);
    const pointer = (canvas, handler) => {
      canvas.addEventListener("pointerdown", (event) => {
        canvas.setPointerCapture(event.pointerId);
        handler(event);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) handler(event);
      });
    };
    pointer(overview, (event) => {
      const box = overview.getBoundingClientRect();
      this.onWindow(
        ((event.clientX - box.left) / box.width) * DURATION - this.span / 2,
      );
    });
    overview.addEventListener("keydown", (event) => {
      const step = (this.span / 2) * (event.shiftKey ? 10 : 1);
      const positions = {
        ArrowLeft: this.start - step,
        ArrowRight: this.start + step,
        Home: 0,
        End: DURATION - this.span,
      };
      if (!Object.hasOwn(positions, event.key)) return;
      event.preventDefault();
      this.onWindow(positions[event.key]);
    });
    this.installNavigation();
  }
  installNavigation() {
    const canvas = this.combined;
    const fraction = (clientX) => {
      const box = canvas.getBoundingClientRect();
      const width = Math.max(1, box.width - plotInsets.left - plotInsets.right);
      return (clientX - box.left - plotInsets.left) / width;
    };
    const clampSpan = (span) => Math.max(minimumSpan, Math.min(DURATION, span));
    const zoom = (scale, anchor) => {
      const span = clampSpan(this.span * scale);
      this.onWindow(this.start + anchor * (this.span - span), span);
    };
    const pointers = new Map();
    let gesture;
    const position = () => {
      const [first, second] = pointers.values();
      return second
        ? {
            x: (first.x + second.x) / 2,
            distance: Math.hypot(first.x - second.x, first.y - second.y),
          }
        : { x: first.x, distance: 0 };
    };
    const rebase = () => {
      gesture = pointers.size
        ? { ...position(), start: this.start, span: this.span }
        : null;
      canvas.classList.toggle("is-panning", pointers.size > 0);
    };
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const unit =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? canvas.clientHeight
              : 1;
        const delta = Math.max(-400, Math.min(400, event.deltaY * unit));
        zoom(
          Math.exp(delta * 0.0025),
          Math.max(0, Math.min(1, fraction(event.clientX))),
        );
        rebase();
      },
      { passive: false },
    );
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointers.size >= 2) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      rebase();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const current = position();
      const span =
        gesture.distance > 0
          ? clampSpan(
              (gesture.span * gesture.distance) / Math.max(1, current.distance),
            )
          : gesture.span;
      const anchorTime = gesture.start + fraction(gesture.x) * gesture.span;
      this.onWindow(anchorTime - fraction(current.x) * span, span);
    });
    const finish = (event) => {
      if (!pointers.delete(event.pointerId)) return;
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      rebase();
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(type, finish);
    window.addEventListener("blur", () => {
      for (const id of pointers.keys())
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      pointers.clear();
      rebase();
    });
    canvas.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const step = (this.span / 2) * (event.shiftKey ? 10 : 1);
      const positions = {
        ArrowLeft: this.start - step,
        ArrowRight: this.start + step,
        Home: 0,
        End: DURATION - this.span,
      };
      if (Object.hasOwn(positions, event.key)) {
        event.preventDefault();
        this.onWindow(positions[event.key]);
      } else if (["+", "=", "-"].includes(event.key)) {
        event.preventDefault();
        zoom(event.key === "-" ? 2 : 0.5, 0.5);
      }
    });
  }
  setData(data, config) {
    this.data = data;
    this.overviewCache = null;
    this.config = config;
    this.signal = createSignal(config);
    this.draw();
  }
  draw() {
    if (!this.data) return;
    this.drawOverview();
    this.drawDetail();
  }
  drawOverview() {
    if (!this.data) return;
    const { ctx, width, height } = surface(this.overview);
    const y = (value) => height / 2 - value * height * 0.45;
    if (
      !this.overviewCache ||
      this.overviewCache.width !== this.overview.width ||
      this.overviewCache.height !== this.overview.height
    ) {
      this.overviewCache = document.createElement("canvas");
      this.overviewCache.width = this.overview.width;
      this.overviewCache.height = this.overview.height;
      const background = this.overviewCache.getContext("2d");
      background.scale(
        this.overview.width / width,
        this.overview.height / height,
      );
      background.strokeStyle = "#7595a3";
      background.lineWidth = 1;
      envelope(
        background,
        this.data.reference,
        0,
        width,
        y,
        0,
        DURATION,
        PLAYBACK_RATE,
      );
    }
    ctx.drawImage(this.overviewCache, 0, 0, width, height);
    const x = (this.start / DURATION) * width,
      w = Math.max(3, (this.span / DURATION) * width);
    ctx.fillStyle = "rgba(40,103,136,.16)";
    ctx.fillRect(x, 0, w, height);
    ctx.strokeStyle = blue;
    ctx.strokeRect(x + 0.5, 0.5, w, height - 1);
    if (this.playhead !== null) {
      ctx.strokeStyle = orange;
      ctx.beginPath();
      ctx.moveTo((this.playhead / DURATION) * width, 0);
      ctx.lineTo((this.playhead / DURATION) * width, height);
      ctx.stroke();
    }
  }
  drawDetail() {
    const { ctx, left, top, w, h, height } = extent(this.combined);
    const x = (time) => left + ((time - this.start) / this.span) * w,
      y = (value) => top + h / 2 - (value * h) / 2.4;
    const { sampleRate, bits } = this.config;
    ctx.font = "10px sans-serif";
    ctx.fillStyle = ink;
    ctx.textAlign = "right";
    for (const v of [-1, 0, 1]) ctx.fillText(String(v), left - 5, y(v) + 3);
    ctx.textAlign = "center";
    for (let i = 0; i <= 2; i++) {
      const time = this.start + (i * this.span) / 2;
      ctx.textAlign = i === 0 ? "left" : i === 2 ? "right" : "center";
      ctx.fillText(formatMilliseconds(time), left + (w * i) / 2, height - 7);
    }
    ctx.textAlign = "right";
    ctx.fillText("ms", left + w, top + 4);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#dde5e8";
    const levels =
      this.layers.quantized && bits <= 4
        ? Array.from({ length: 2 ** bits }, (_, i) => -1 + (i * 2) / 2 ** bits)
        : [-1, -0.5, 0, 0.5, 1];
    for (const v of levels) {
      ctx.beginPath();
      ctx.moveTo(left, y(v));
      ctx.lineTo(left + w, y(v));
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(left + (w * i) / 4, top);
      ctx.lineTo(left + (w * i) / 4, top + h);
      ctx.stroke();
    }
    const curve = (values, analytic) => {
      if (this.span * PLAYBACK_RATE > w * 2) {
        envelope(ctx, values, left, w, y, this.start, this.span, PLAYBACK_RATE);
        return;
      }
      ctx.beginPath();
      for (let i = 0; i <= Math.ceil(w); i++) {
        const px = Math.min(w, i),
          time = this.start + (px / w) * this.span;
        const index = time * PLAYBACK_RATE,
          floor = Math.floor(index),
          fraction = index - floor;
        const value = analytic
          ? this.signal(time)
          : (values[floor] || 0) * (1 - fraction) +
            (values[floor + 1] || 0) * fraction;
        if (!i) ctx.moveTo(left + px, y(value));
        else ctx.lineTo(left + px, y(value));
      }
      ctx.stroke();
    };
    // Draw the reference underneath every digitized layer.
    if (this.layers.original) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = originalColor;
      curve(this.data.reference, true);
    }
    if (this.layers.reconstructed) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = reconstructedColor;
      ctx.setLineDash([5, 3]);
      curve(this.data.processed, false);
      ctx.setLineDash([]);
    }
    if (this.layers.quantized) {
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = orange;
      if (sampleRate * this.span > w * 2) {
        // At a full-clip scale, preserve the peaks in each display column.
        envelope(
          ctx,
          this.data.quantized,
          left,
          w,
          y,
          this.start,
          this.span,
          sampleRate,
        );
      } else {
        const values = this.data.quantized;
        const first = Math.max(0, Math.floor(this.start * sampleRate));
        const last = Math.min(
          values.length - 1,
          Math.floor((this.start + this.span) * sampleRate),
        );
        ctx.beginPath();
        ctx.moveTo(left, y(values[first]));
        for (let n = first; n <= last; n++) {
          const edge = Math.min(left + w, x((n + 1) / sampleRate));
          ctx.lineTo(edge, y(values[n]));
          if (n < last) ctx.lineTo(edge, y(values[n + 1]));
        }
        ctx.stroke();
      }
    }
    const spacing = w / (sampleRate * this.span),
      showDots = spacing >= 3;
    this.density.hidden = !this.layers.samples || showDots;
    if (showDots) {
      const first = Math.max(0, Math.ceil(this.start * sampleRate)),
        last = Math.min(
          this.data.raw.length - 1,
          Math.floor((this.start + this.span) * sampleRate),
        );
      for (let n = first; n <= last; n++) {
        const px = x(n / sampleRate),
          before = this.data.raw[n],
          after = this.data.quantized[n];
        if (this.layers.samples && this.layers.quantized) {
          ctx.strokeStyle = "#c39b74";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, y(before));
          ctx.lineTo(px, y(after));
          ctx.stroke();
        }
        const radius = Math.min(2.7, spacing * 0.34);
        if (this.layers.samples) {
          ctx.beginPath();
          ctx.arc(px, y(before), radius, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.strokeStyle = blue;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        if (this.layers.quantized) {
          ctx.beginPath();
          ctx.arc(px, y(after), Math.min(1.7, radius * 0.65), 0, Math.PI * 2);
          ctx.fillStyle = orange;
          ctx.fill();
        }
      }
    }
    ctx.restore();
    const names = {
      original: "原音の波形",
      samples: "標本点",
      quantized: "量子化後の階段",
      reconstructed: "再構成波形",
    };
    const visible = Object.entries(this.layers)
      .filter(([, on]) => on)
      .map(([key]) => names[key]);
    this.combined.setAttribute(
      "aria-label",
      `${visible.length ? visible.join("・") : "座標軸のみ"}。${formatMilliseconds(this.start)}から${formatMilliseconds(this.start + this.span)}ミリ秒。${this.layers.samples ? (showDots ? "標本点を表示しています。" : "標本点は拡大すると表示されます。") : ""}`,
    );
  }
}
