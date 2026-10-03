/** 最後の行の結果を読んだ後、選択を解除する。最終値と出力は保持する。 */
export function finishTrace(state) {
  if (!state.completed || state.currentLine === null) return state;
  return { ...state, currentLine: null, event: null, changes: [], reads: [], skippedLines: [] };
}
