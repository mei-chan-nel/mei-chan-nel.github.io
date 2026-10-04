/** 緑の全表示・表示量、赤の全表示・表示量の順で、スクロール位置を選ぶ。 */
export function highlightScrollTop({ current, height, extent, targets = [], sources = [], padding = 8 }) {
  const maximum = Math.max(0, extent - height);
  const clamp = (value) => Math.max(0, Math.min(maximum, value));
  current = clamp(current);
  if (height <= 0 || !maximum || (!targets.length && !sources.length)) return current;

  const candidates = new Set([current, 0, maximum]);
  for (const { top, bottom } of [...targets, ...sources]) {
    for (const position of [top, bottom - height, top - padding, bottom + padding - height]) candidates.add(clamp(position));
  }
  const scoreGroup = (boxes, position) => {
    let complete = 0, visible = 0, inset = 0;
    for (const { top, bottom } of boxes) {
      const overlap = Math.max(0, Math.min(bottom, position + height) - Math.max(top, position));
      visible += overlap;
      if (top >= position && bottom <= position + height) {
        complete++;
        inset += Math.min(padding, top - position, position + height - bottom);
      }
    }
    return [complete, visible, inset];
  };
  let best = current, bestScore = null;
  for (const position of candidates) {
    const green = scoreGroup(targets, position), red = scoreGroup(sources, position);
    const score = [green[0], green[1], red[0], red[1], green[2], red[2], -Math.abs(position - current)];
    const difference = bestScore && score.findIndex((value, index) => value !== bestScore[index]);
    if (!bestScore || (difference >= 0 && score[difference] > bestScore[difference])) {
      best = position;
      bestScore = score;
    }
  }
  return best;
}

/** 回転した全画面でも使える、CSS変換前の縦位置。 */
function layoutTop(node) {
  let top = 0;
  for (let current = node; current; current = current.offsetParent) {
    top += current.offsetTop + (current.offsetParent?.clientTop ?? 0);
  }
  return top;
}

export function createVariableScroll(pane, rows) {
  let frame = null, lastEvent = null;
  function reveal() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!pane.clientHeight || pane.scrollHeight <= pane.clientHeight || !/^(auto|scroll|overlay)$/.test(getComputedStyle(pane).overflowY)) return;
      const targets = [], sources = [];
      const paneTop = layoutTop(pane) + pane.clientTop;
      const boxFor = (node) => {
        let top = layoutTop(node) - paneTop;
        for (let parent = node.parentElement; parent && parent !== pane; parent = parent.parentElement) top -= parent.scrollTop;
        return { top, bottom: top + node.offsetHeight };
      };
      for (const row of rows.children) {
        // 配列の枠全体ではなく、このステップの要素を優先する。
        const cells = row.querySelectorAll(".array-element, .matrix-element");
        if (row.classList.contains("is-array") && cells.length) {
          for (const cell of cells) {
            if (cell.matches(".is-changed-element, .is-assignment-target")) targets.push(boxFor(cell));
            else if (cell.classList.contains("is-assignment-source")) sources.push(boxFor(cell));
          }
        } else {
          if (row.matches(".is-changed, .is-assignment-target")) targets.push(boxFor(row));
          else if (row.classList.contains("is-source")) sources.push(boxFor(row));
        }
      }
      pane.scrollTop = highlightScrollTop({ current: pane.scrollTop, height: pane.clientHeight, extent: pane.scrollHeight, targets, sources });
    });
  }
  return {
    reveal,
    update(event) {
      // 速度の変更や一時停止では、手でスクロールした位置を奪わない。
      if (event !== lastEvent) { lastEvent = event; reveal(); }
    },
  };
}
