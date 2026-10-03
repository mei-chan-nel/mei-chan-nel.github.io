export const MIN_INTERVAL_MS = 1;
export const INTERVAL_STEP_MS = 100;
export const DEFAULT_INTERVAL_MS = 500;
// setTimeout が扱える範囲内で整数のミリ秒として保持する。
export const MAX_INTERVAL_MS = 2147483600;

export function intervalSeconds(milliseconds) {
  return (milliseconds / 1000).toFixed(milliseconds >= 100 ? 1 : milliseconds >= 10 && milliseconds % 10 === 0 ? 2 : 3);
}

/** 0.1秒未満では桁を変え、0.1秒以上では0.1秒ずつ調整する。 */
export function adjustInterval(milliseconds, direction) {
  if (direction < 0) return Math.max(MIN_INTERVAL_MS, milliseconds <= 100 ? Math.round(milliseconds / 10) : milliseconds - INTERVAL_STEP_MS);
  return Math.min(MAX_INTERVAL_MS, milliseconds < 100 ? Math.min(100, milliseconds * 10) : milliseconds + INTERVAL_STEP_MS);
}

/** advance が false を返すと終了する。停止後も選択中の速度を保持する。 */
export function createAutoplay({
  advance,
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (timer) => globalThis.clearTimeout(timer),
}) {
  let interval = DEFAULT_INTERVAL_MS;
  let running = false;
  let timer = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function stop() {
    running = false;
    cancelTimer();
  }

  function schedule() {
    if (!running) return;
    timer = setTimer(() => {
      timer = null;
      if (!running) return;
      if (!advance()) { stop(); return; }
      schedule();
    }, interval);
  }

  return {
    get running() { return running; },
    get interval() { return interval; },
    start({ immediate = true } = {}) {
      if (running) return;
      running = true;
      if (immediate && !advance()) { stop(); return; }
      schedule();
    },
    setInterval(milliseconds) {
      if (!Number.isSafeInteger(milliseconds) || milliseconds < MIN_INTERVAL_MS || milliseconds > MAX_INTERVAL_MS || (milliseconds >= 100 && milliseconds % INTERVAL_STEP_MS !== 0)) return false;
      if (interval !== milliseconds) {
        interval = milliseconds;
        if (running) { cancelTimer(); schedule(); }
      }
      return true;
    },
    stop,
  };
}
