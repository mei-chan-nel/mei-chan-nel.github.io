/** 実行画面は、静的HTMLから noindex を指定する専用の入口に集約する。 */
export function executionHref(id, from = "") {
  const query = from ? `?${new URLSearchParams({ from })}` : "";
  return `./run.html${query}#${encodeURIComponent(id)}`;
}

export function traceRedirect(currentHref, programId) {
  const current = new URL(currentHref);
  const runner = new URL("./run.html", current);
  const isRunner = current.pathname === runner.pathname;
  if (programId && !isRunner) {
    runner.search = current.search;
    runner.hash = programId;
    return runner.href;
  }
  if (!programId && isRunner) return new URL("./", current).href;
  return null;
}
