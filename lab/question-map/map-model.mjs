// Only coordinates, term membership and references to the source questions live
// in this model. Question content is never generated or copied into map data.
export const STAGES = ["タグ", "単語", "問題文", "選択肢", "解説"];
export const STAGE_ZOOMS = [1, 3, 7, 17, 36];
const CUTS = [2.2, 5, 12, 26];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export async function verifySourceText(text, expectedHash) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = async source => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
  // The supplied map was generated from a Windows checkout. Git/Pages can
  // serve LF while its source fingerprint contains CRLF; accept either EOL.
  const lf = text.replace(/\r\n?/g, "\n");
  return await digest(lf) === expectedHash || await digest(lf.replace(/\n/g, "\r\n")) === expectedHash;
}

export function stageAt(zoom, previous = 0) {
  let stage = previous;
  while (stage < 4 && zoom >= CUTS[stage] * 1.08) stage++;
  while (stage > 0 && zoom < CUTS[stage - 1] * .92) stage--;
  return stage;
}

export function prepareMap(questions, pointData, termData, metadata) {
  if (!Array.isArray(questions) || !questions.length ||
      [pointData, termData, metadata].some(d => d?.schema_version !== 1) ||
      !pointData.points || !termData.terms || metadata.count !== questions.length ||
      !metadata.source_sha256 ||
      pointData.source_sha256 !== metadata.source_sha256 ||
      termData.source_sha256 !== metadata.source_sha256) {
    throw new Error("地図と問題データの組み合わせが一致しません。");
  }
  const byId = new Map();
  const tags = new Map();
  const terms = new Map();
  const points = questions.map(question => {
    const id = String(question.id);
    const xy = pointData.points[id];
    if (byId.has(id) || !Array.isArray(xy) || xy.length !== 2 || !xy.every(Number.isFinite) ||
        typeof question.stem !== "string" || !Array.isArray(question.choices) || !Array.isArray(question.tags)) {
      throw new Error("問題IDまたは座標に不整合があります。");
    }
    const point = { id, x: xy[0], y: xy[1], question, tags: question.tags, terms: [] };
    byId.set(id, point);
    for (const tag of new Set(point.tags)) tags.set(tag, (tags.get(tag) || 0) + 1);
    return point;
  });
  if (Object.keys(pointData.points).length !== byId.size) throw new Error("地図の問題数が一致しません。");
  for (const [term, ids] of Object.entries(termData.terms)) {
    if (!Array.isArray(ids) || ids.some(id => !byId.has(id))) throw new Error("用語の問題IDが一致しません。");
    // Automatic extraction includes fragments and personal names. Prefer a
    // conservative display vocabulary; the source candidates remain untouched.
    if (tags.has(term) || !isDisplayTerm(term)) continue;
    const unique = [...new Set(ids)];
    terms.set(term, unique.length);
    for (const id of unique) byId.get(id).terms.push(term);
  }
  const bounds = {
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)),
  };
  return { points, byId, tags, terms, bounds, index: new SpatialIndex(points), metadata };
}

export function isDisplayTerm(term) {
  if (term.length < 2 || term.length > 18 || /[\s。、「」？！=<>]/u.test(term)) return false;
  if (/^[a-z\d_.:/-]+$/u.test(term)) return false;
  if (/^[\p{Script=Hiragana}]+$/u.test(term)) return false;
  if (/[はがをにへとので]$/u.test(term) || /(?:する|した|して|され|でき|ない|ある|いる|もの|こと)$/u.test(term)) return false;
  return true;
}

export class SpatialIndex {
  constructor(points, cellSize = 4) {
    this.cells = new Map();
    this.cellSize = cellSize;
    for (const p of points) {
      const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(p);
    }
  }
  query(bounds) {
    const result = [];
    const size = this.cellSize;
    for (let x = Math.floor(bounds.minX / size); x <= Math.floor(bounds.maxX / size); x++) {
      for (let y = Math.floor(bounds.minY / size); y <= Math.floor(bounds.maxY / size); y++) {
        for (const p of this.cells.get(`${x},${y}`) || []) {
          if (p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY) result.push(p);
        }
      }
    }
    return result;
  }
}

export function fitCamera(bounds, width, height) {
  const dx = Math.max(1, bounds.maxX - bounds.minX), dy = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(Math.max(40, width - 110) / dx, Math.max(40, height - 120) / dy);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, scale };
}
export const project = (p, camera, width, height) => ({
  x: (p.x - camera.x) * camera.scale + width / 2,
  y: (p.y - camera.y) * camera.scale + height / 2,
});
export const unproject = (p, camera, width, height) => ({
  x: (p.x - width / 2) / camera.scale + camera.x,
  y: (p.y - height / 2) / camera.scale + camera.y,
});
export function viewBounds(camera, width, height, margin = 0) {
  return { minX: camera.x - (width / 2 + margin) / camera.scale, maxX: camera.x + (width / 2 + margin) / camera.scale,
    minY: camera.y - (height / 2 + margin) / camera.scale, maxY: camera.y + (height / 2 + margin) / camera.scale };
}
export function zoomAbout(camera, factor, anchor, width, height, minScale, maxScale) {
  const world = unproject(anchor, camera, width, height);
  const scale = clamp(camera.scale * factor, minScale, maxScale);
  return { scale, x: world.x - (anchor.x - width / 2) / scale, y: world.y - (anchor.y - height / 2) / scale };
}
export function overlaps(a, b, gap = 8) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

export function labelCandidates(visible, model, camera, width, height, stage, previous = new Map()) {
  const buckets = new Map();
  const cellSize = 200 / camera.scale;
  for (const point of visible) {
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(point);
  }
  const candidates = new Map();
  for (const bucket of buckets.values()) {
    for (const kind of stage ? ["tag", "term"] : ["tag"]) {
      const memberships = new Map();
      for (const point of bucket) for (const text of point[kind === "tag" ? "tags" : "terms"]) {
        if (!memberships.has(text)) memberships.set(text, []);
        memberships.get(text).push(point);
      }
      const totals = kind === "tag" ? model.tags : model.terms;
      for (const [text, members] of memberships) {
        if (members.length < (visible.length > 35 ? 2 : 1)) continue;
        const cx = members.reduce((s, p) => s + p.x, 0) / members.length;
        const cy = members.reduce((s, p) => s + p.y, 0) / members.length;
        const global = totals.get(text) || 1;
        const specificity = Math.log(1 + model.points.length / global);
        const score = Math.sqrt(members.length) * specificity * (members.length / bucket.length) ** .4 * (kind === "tag" ? 1.2 : 1);
        const key = `${kind}:${text}`;
        const prior = previous.get(key);
        // Keep an existing geographical anchor while it remains relevant and
        // in view. This prevents centroid jumps during tiny camera changes.
        const anchor = members.find(p => p.id === prior?.anchor.id) || members.reduce((a, p) =>
          Math.hypot(p.x - cx, p.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? p : a);
        const size = kind === "tag" ? clamp(14 + Math.log2(members.length + 1) * 1.6, 15, 24) : clamp(12 + Math.log2(members.length + 1), 13, 17);
        const position = project(anchor, camera, width, height);
        const candidate = { key, text, kind, anchor, score: score * (prior ? 1.35 : 1), size,
          x: position.x, y: position.y, count: members.length };
        if (!candidates.has(key) || candidate.score > candidates.get(key).score) candidates.set(key, candidate);
      }
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

export function placeLabels(candidates, width, height, measure, reserved = [], limit = 36) {
  const placed = [], boxes = [...reserved];
  for (const label of candidates) {
    const w = measure(label.text, label.size, label.kind) + 14, h = label.size * 1.4 + 6;
    const box = { x: label.x - w / 2, y: label.y - h / 2, w, h };
    if (box.x < 8 || box.y < 8 || box.x + w > width - 8 || box.y + h > height - 28 || boxes.some(b => overlaps(box, b))) continue;
    placed.push({ ...label, box }); boxes.push(box);
    if (placed.length >= limit) break;
  }
  return placed;
}

const count = n => Number.isInteger(n) && n > 0 ? n : 0;
export function historyRecords(current, legacy) {
  const records = new Map();
  // An existing v1 store is authoritative, including an empty cleared store.
  if (current?.v === 1 && current.q && typeof current.q === "object" && !Array.isArray(current.q)) {
    for (const [id, raw] of Object.entries(current.q)) {
      if (!Array.isArray(raw)) continue;
      const attempts = count(raw[0]), correct = Math.min(count(raw[1]), attempts);
      if (attempts) records.set(id, { attempts, correct, rate: correct / attempts });
    }
  } else if (legacy && typeof legacy === "object") {
    for (const [id, raw] of Object.entries(legacy)) {
      const attempts = count(raw?.attempts), correct = Math.min(count(raw?.correct), attempts);
      if (attempts) records.set(id, { attempts, correct, rate: correct / attempts });
    }
  }
  return records;
}

export function rateColor(rate) {
  if (rate == null) return [146, 157, 152];
  const colors = [[212, 85, 67], [232, 186, 75], [81, 161, 128], [64, 139, 192]];
  const t = clamp(rate, 0, 1) * 3, i = Math.min(2, Math.floor(t)), fraction = t - i;
  return colors[i].map((v, j) => Math.round(v + (colors[i + 1][j] - v) * fraction));
}

export function heatField(model, records, resolution = 240) {
  const spanX = Math.max(1, model.bounds.maxX - model.bounds.minX), spanY = Math.max(1, model.bounds.maxY - model.bounds.minY);
  const padding = Math.max(spanX, spanY) * .055;
  const bounds = { minX: model.bounds.minX - padding, maxX: model.bounds.maxX + padding,
    minY: model.bounds.minY - padding, maxY: model.bounds.maxY + padding };
  const width = resolution, height = Math.round(resolution * (spanY + 2 * padding) / (spanX + 2 * padding));
  const density = new Float32Array(width * height), attempts = new Float32Array(width * height), correct = new Float32Array(width * height);
  const sx = width / (bounds.maxX - bounds.minX), sy = height / (bounds.maxY - bounds.minY);
  const sigma = Math.max(spanX, spanY) * .018 * sx, radius = Math.ceil(sigma * 3);
  for (const point of model.points) {
    const px = (point.x - bounds.minX) * sx, py = (point.y - bounds.minY) * sy;
    const record = records.get(point.id);
    for (let y = Math.max(0, Math.floor(py - radius)); y <= Math.min(height - 1, Math.ceil(py + radius)); y++) {
      for (let x = Math.max(0, Math.floor(px - radius)); x <= Math.min(width - 1, Math.ceil(px + radius)); x++) {
        const weight = Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * sigma ** 2)), i = y * width + x;
        density[i] += weight;
        if (record) { attempts[i] += weight * record.attempts; correct[i] += weight * record.correct; }
      }
    }
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < density.length; i++) {
    const rate = attempts[i] > .035 ? correct[i] / attempts[i] : null;
    const rgb = rateColor(rate);
    pixels.set(rgb, i * 4);
    pixels[i * 4 + 3] = (1 - Math.exp(-density[i] * .35)) * (rate == null ? 50 : 122);
  }
  return { width, height, bounds, pixels };
}
