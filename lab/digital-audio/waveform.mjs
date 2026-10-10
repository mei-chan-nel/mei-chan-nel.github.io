import { createSignal, PLAYBACK_RATE, DURATION } from "./pcm.mjs?v=2";
export const plotInsets = { left: 28, right: 8, top: 12, bottom: 24 };
const blue = "#286788",
  orange = "#a14908",
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
  constructor({ overview, original, processed, onWindow }) {
    Object.assign(this, { overview, original, processed, onWindow });
    this.start = 0.04;
    this.span = 0.01;
    this.playhead = null;
    this.observer = new ResizeObserver(() => this.draw());
    for (const canvas of [overview, original, processed])
      this.observer.observe(canvas);
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
    this.drawDetail(this.original, false);
    this.drawDetail(this.processed, true);
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
  drawDetail(canvas, processed) {
    const { ctx, left, top, w, h, height } = extent(canvas);
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
      ctx.fillText(
        `${(time * 1000).toFixed(this.span <= 0.002 ? 1 : 0)}`,
        left + (w * i) / 2,
        height - 7,
      );
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
      processed && bits <= 4
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
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = processed ? orange : blue;
    const values = processed ? this.data.processed : this.data.reference;
    if (this.span * PLAYBACK_RATE > w * 2)
      envelope(ctx, values, left, w, y, this.start, this.span, PLAYBACK_RATE);
    else {
      ctx.beginPath();
      for (let i = 0; i <= w; i++) {
        const time = this.start + (i / w) * this.span;
        let value;
        if (!processed) value = this.signal(time);
        else {
          const index = time * PLAYBACK_RATE,
            floor = Math.floor(index),
            fraction = index - floor;
          value =
            (values[floor] || 0) * (1 - fraction) +
            (values[floor + 1] || 0) * fraction;
        }
        if (!i) ctx.moveTo(left + i, y(value));
        else ctx.lineTo(left + i, y(value));
      }
      ctx.stroke();
    }
    const showDots = w / (sampleRate * this.span) >= 3;
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
        if (processed) {
          ctx.strokeStyle = "#c39b74";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, y(before));
          ctx.lineTo(px, y(after));
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(px, y(processed ? after : before), 2.4, 0, Math.PI * 2);
        ctx.fillStyle = processed ? orange : "#20576d";
        ctx.fill();
      }
    }
    ctx.restore();
    canvas.setAttribute(
      "aria-label",
      `${processed ? "量子化後の標本と再構成した波形" : "元の波形と標本点"}。${(this.start * 1000).toFixed(1)}から${((this.start + this.span) * 1000).toFixed(1)}ミリ秒。${showDots ? "標本点を表示しています。" : "標本点は拡大すると表示されます。"}`,
    );
    canvas.nextElementSibling.querySelector(
      processed ? ".key-quantized" : ".key-sample",
    ).textContent = processed
      ? showDots
        ? "量子化後の点"
        : "量子化後の点（拡大で表示）"
      : showDots
        ? "標本点"
        : "標本点（拡大で表示）";
    if (processed)
      canvas.nextElementSibling.querySelector(".key-levels").hidden = bits > 4;
  }
}
