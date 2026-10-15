// Only coordinates, term membership and references to the source questions live
// in this model. Question content is never generated or copied into map data.
export const STAGES = ["タグ", "単語", "問題文"];
export const STAGE_ZOOMS = [2.1, 4.5, 9];
const CUTS = [1.5, 3.1, 6];
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

export function stageAt(zoom, previous = -1) {
  let stage = Math.min(previous, CUTS.length - 1);
  while (stage < CUTS.length - 1 && zoom >= CUTS[stage + 1] * 1.08) stage++;
  while (stage >= 0 && zoom < CUTS[stage] * .92) stage--;
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
  const scale = Math.min(Math.max(40, width - (width < 600 ? 48 : 100)) / dx, Math.max(40, height - 100) / dy);
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
// Both regions use all points in their bounds, including questions whose
// cards are currently hidden to avoid overlap.
export const PRACTICE_LIMIT = 5;
export function practiceCandidates(model, camera, width, height, circle = null) {
  if (!circle) return model.index.query(viewBounds(camera, width, height));
  const { x, y, radius } = circle;
  if (![x, y, radius].every(Number.isFinite) || radius <= 0) return [];
  return model.index.query({ minX: x - radius, maxX: x + radius, minY: y - radius, maxY: y + radius })
    .filter(p => (p.x - x) ** 2 + (p.y - y) ** 2 <= radius ** 2);
}
export function samplePractice(points, random = Math.random) {
  const pool = [...points], count = Math.min(PRACTICE_LIMIT, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
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
  if (limit <= 0) return [];
  const placed = [], boxes = [...reserved];
  for (const label of candidates) {
    const w = measure(label.text, label.size, label.kind) + 6, h = label.size * 1.4 + 4;
    const box = { x: label.x - w / 2, y: label.y - h / 2, w, h };
    if (box.x < 8 || box.y < 8 || box.x + w > width - 8 || box.y + h > height - 28 || boxes.some(b => overlaps(box, b))) continue;
    placed.push({ ...label, box }); boxes.push(box);
    if (placed.length >= limit) break;
  }
  return placed;
}

// Take a turn from every occupied screen region before returning to a dense
// region. Existing nodes can receive a small score bonus, never a whole quota.
export function spatialOrder(candidates, width, height, cellWidth = 180, cellHeight = 130, spread = false) {
  const columns = Math.max(2, Math.ceil(width / cellWidth)), rows = Math.max(2, Math.ceil(height / cellHeight));
  const buckets = new Map();
  for (const candidate of candidates) {
    const key = `${clamp(Math.floor(candidate.x / width * columns), 0, columns - 1)},${clamp(Math.floor(candidate.y / height * rows), 0, rows - 1)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(candidate);
  }
  const compare = (a, b) => (b.score || 0) - (a.score || 0) || String(a.id || a.key).localeCompare(String(b.id || b.key));
  let groups = [...buckets.values()].map(group => group.sort(compare)).sort((a, b) => compare(a[0], b[0]));
  if (spread && groups.length) {
    const remaining = groups.slice(1), ordered = [groups[0]];
    while (remaining.length) {
      let best = 0, distance = -1;
      for (let i = 0; i < remaining.length; i++) {
        const point = remaining[i][0];
        const nearest = Math.min(...ordered.map(group => Math.hypot((point.x - group[0].x) / width, (point.y - group[0].y) / height)));
        if (nearest > distance) { distance = nearest; best = i; }
      }
      ordered.push(remaining.splice(best, 1)[0]);
    }
    groups = ordered;
  }
  const result = [];
  for (let round = 0; groups.some(group => round < group.length); round++) {
    for (const group of groups) if (group[round]) result.push(group[round]);
  }
  return result;
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

export function colorRate(rate, range = [0, 1]) {
  return rate == null ? null : clamp((rate - range[0]) / (range[1] - range[0]), 0, 1);
}

// Stretch the observed regional range, not the source scores. A minimum
// 16-point span keeps tiny differences from looking like opposite extremes.
export function regionalColorRange(rates) {
  if (!rates.length) return [0, 1];
  const sorted = [...rates].sort((a, b) => a - b);
  const low = sorted[Math.floor((sorted.length - 1) * .05)];
  const high = sorted[Math.ceil((sorted.length - 1) * .95)];
  const center = (low + high) / 2, span = Math.max(.16, (high - low) * 1.1);
  const min = clamp(center - span / 2, 0, Math.max(0, 1 - span));
  return [min, Math.min(1, min + span)];
}

export function heatField(model, records, resolution = 240, { contrast = false, spread = .018 } = {}) {
  const spanX = Math.max(1, model.bounds.maxX - model.bounds.minX), spanY = Math.max(1, model.bounds.maxY - model.bounds.minY);
  const padding = Math.max(spanX, spanY) * .055;
  const bounds = { minX: model.bounds.minX - padding, maxX: model.bounds.maxX + padding,
    minY: model.bounds.minY - padding, maxY: model.bounds.maxY + padding };
  const width = resolution, height = Math.round(resolution * (spanY + 2 * padding) / (spanX + 2 * padding));
  const density = new Float32Array(width * height), attempts = new Float32Array(width * height), correct = new Float32Array(width * height);
  const sx = width / (bounds.maxX - bounds.minX), sy = height / (bounds.maxY - bounds.minY);
  const sigma = Math.max(spanX, spanY) * spread * sx, radius = Math.ceil(sigma * 3);
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
  const rates = new Float32Array(density.length).fill(-1), sampleBands = [[], [], []];
  for (let i = 0; i < density.length; i++) {
    if (attempts[i] > .035) rates[i] = correct[i] / attempts[i];
    if (density[i] >= .8) {
      for (const [band, minimum] of [4, 2, 1].entries()) if (attempts[i] >= minimum) sampleBands[band].push(rates[i]);
    }
  }
  // First-pass records contain only 0/1 results. Prefer regions with several
  // overlapping answers for the color domain, falling back for sparse data.
  // The heat rates themselves, and question details, remain unchanged.
  const samples = sampleBands.find(b => b.length >= 32) || sampleBands[2];
  const colorRange = contrast ? regionalColorRange(samples) : [0, 1];
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < density.length; i++) {
    const rate = rates[i] >= 0 ? rates[i] : null;
    const rgb = rateColor(colorRate(rate, colorRange));
    pixels.set(rgb, i * 4);
    pixels[i * 4 + 3] = (1 - Math.exp(-density[i] * .35)) * (rate == null ? 50 : contrast ? 178 : 140);
  }
  return { width, height, bounds, pixels, density, colorRange };
}

export function labelPresentation(baseSize, birthScale, scale, zoom, kind, mode = "auto") {
  if (mode === "on" || mode === "off") {
    // Forced layers remain readable at overview, and grow gently instead of
    // becoming enormous when they are kept on at high magnification.
    const size = clamp(baseSize * .82 * Math.max(1, zoom) ** .15, kind === "tag" ? 14 : 12, kind === "tag" ? 28 : 22);
    return { growth: size / baseSize, size, opacity: mode === "on" ? 1 : 0 };
  }
  const growth = clamp(scale / birthScale, .6, 5);
  const enter = clamp((zoom - (kind === "tag" ? 1.4 : 3)) / .65, 0, 1);
  const pass = clamp((3.1 - growth) / 1.7, 0, 1);
  const depth = clamp(((kind === "tag" ? 10 : 24) - zoom) / (kind === "tag" ? 4 : 9), 0, 1);
  return { growth, size: baseSize * growth, opacity: enter * pass * depth };
}

export function cardFocus(x, y, width, height) {
  const distance = Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2));
  const t = clamp((distance - .18) / .9, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

export function questionPresentation(zoom, mode = "auto", mobile = false, focus = 1) {
  const center = mode === "on" ? {
    fontSize: Math.round(clamp(12.5 + Math.log2(Math.max(1, zoom) / 2) * 1.4, 12.5, 18) * 10) / 10,
    width: Math.min(mobile ? 224 : 264, 192 + Math.log2(Math.max(1, zoom)) * 20),
    lines: zoom < 3 ? 4 : 7, opacity: 1,
  } : { fontSize: Math.round(clamp(14 + Math.log2(zoom / 9) * 1.2, 14, 18) * 10) / 10,
    width: mobile ? 224 : 264, lines: 7, opacity: mode === "off" ? 0 : clamp((zoom - 6) / 1.5, 0, 1) };
  focus = clamp(focus, 0, 1);
  return { ...center, focus,
    fontSize: Math.round(((mobile ? 11 : 11.5) + (center.fontSize - (mobile ? 11 : 11.5)) * focus) * 4) / 4,
    width: Math.round(((mobile ? 116 : 136) + (center.width - (mobile ? 116 : 136)) * focus) / 2) * 2,
    lines: Math.round(3 + (center.lines - 3) * focus), padding: Math.round(7 + 5 * focus),
    leading: 1.45 + .15 * focus, backgroundAlpha: .78 + .1 * focus,
  };
}

export function surroundingQuestions(model, center, radius = 5, limit = 10) {
  const points = model.index.query({ minX: center.x - radius, maxX: center.x + radius, minY: center.y - radius, maxY: center.y + radius });
  return points.filter(p => Math.hypot(p.x - center.x, p.y - center.y) <= radius)
    .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function placeQuestionCards(candidates, width, height, reserved = [], previous = new Map(), limit = 36) {
  const placed = [], area = b => b.w * b.h;
  const intersection = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  for (const candidate of candidates) {
    const { x, y, w, h, id } = candidate, prior = previous.get(id);
    const offsets = [[-w / 2, 12], [-w / 2, -h - 12], [12, -h / 2], [-w - 12, -h / 2]];
    for (const dx of [-w - 12, -w / 2, 12]) for (const dy of [-2 * h - 24, -h - 12, 12, h + 24]) offsets.push([dx, dy]);
    for (const dx of [-w / 2, -w * .15, -w * .85]) for (const dy of [12, -h - 12, -h / 2]) offsets.push([dx, dy]);
    if (prior) offsets.unshift([prior.dx, prior.dy]);
    let best = null;
    for (const [dx, dy] of offsets) {
      const box = { x: clamp(x + dx, 10, width - w - 10), y: clamp(y + dy, 10, height - h - 35), w, h };
      if (reserved.some(b => intersection(box, b) > 0)) continue;
      const fractions = placed.map(p => intersection(box, p.box) / Math.min(area(box), area(p.box)));
      if (fractions.some(f => f > .18) || fractions.reduce((s, f) => s + f, 0) > .24) continue;
      const distance = Math.hypot(box.x + w / 2 - x, box.y + h / 2 - y);
      const drift = prior ? Math.hypot(box.x - x - prior.dx, box.y - y - prior.dy) : 0;
      const score = distance + drift * .35 + fractions.reduce((s, f) => s + f, 0) * 500;
      if (!best || score < best.score) best = { ...candidate, box, dx: box.x - x, dy: box.y - y, score };
    }
    if (best) placed.push(best);
    if (placed.length >= limit) break;
  }
  return placed;
}

// Marching squares on the coordinate density, independent of answer records.
// The coast therefore stays in place when the score source changes.
export function coastContours(field, level = .65) {
  const { width, height, density, bounds } = field, segments = [], links = new Map();
  const key = p => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)}`;
  const add = (a, b) => {
    const i = segments.length; segments.push([a, b]);
    for (const p of [a, b]) { const k = key(p); if (!links.has(k)) links.set(k, []); links.get(k).push(i); }
  };
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const values = [density[y * width + x], density[y * width + x + 1], density[(y + 1) * width + x + 1], density[(y + 1) * width + x]];
    const code = values.reduce((s, v, i) => s | (v >= level ? 1 << i : 0), 0);
    if (code === 0 || code === 15) continue;
    const corners = [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }];
    const edge = i => {
      const j = (i + 1) % 4, t = clamp((level - values[i]) / (values[j] - values[i]), 0, 1);
      return { x: corners[i].x + (corners[j].x - corners[i].x) * t, y: corners[i].y + (corners[j].y - corners[i].y) * t };
    };
    const crossings = [];
    for (let i = 0; i < 4; i++) if ((values[i] >= level) !== (values[(i + 1) % 4] >= level)) crossings.push(i);
    if (crossings.length === 2) add(edge(crossings[0]), edge(crossings[1]));
    else if (crossings.length === 4) {
      const center = values.reduce((a, b) => a + b, 0) / 4;
      const pairs = (code === 5) === (center >= level) ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
      for (const [a, b] of pairs) add(edge(a), edge(b));
    }
  }
  const used = new Set(), contours = [];
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    used.add(i); const path = [...segments[i]];
    for (let n = 0; n < segments.length; n++) {
      const end = path.at(-1), next = (links.get(key(end)) || []).find(j => !used.has(j));
      if (next == null) break;
      used.add(next); const segment = segments[next];
      path.push(key(segment[0]) === key(end) ? segment[1] : segment[0]);
      if (key(path[0]) === key(path.at(-1))) break;
    }
    if (path.length > 3 && key(path[0]) === key(path.at(-1))) contours.push(path.map(p => ({
      x: bounds.minX + p.x / width * (bounds.maxX - bounds.minX),
      y: bounds.minY + p.y / height * (bounds.maxY - bounds.minY),
    })));
  }
  return contours;
}
