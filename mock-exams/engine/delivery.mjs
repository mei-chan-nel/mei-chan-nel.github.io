// Monotonic local-only send states. Missing entry means never attempted.
const rank = { sending: 1, unknown: 2, sent: 3 };
export function mergeDelivery(...maps) {
  const out = {};
  for (const map of maps) {
    if (map === undefined) continue;
    if (!map || typeof map !== "object" || Array.isArray(map))
      throw Error("Invalid statistics delivery state");
    for (const [id, row] of Object.entries(map)) {
      if (
        !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
        !row ||
        !Object.hasOwn(rank, row.state) ||
        !Number.isFinite(row.attemptedAt) ||
        row.attemptedAt < 0
      )
        throw Error("Invalid statistics delivery state");
      if (!out[id] || rank[row.state] > rank[out[id].state])
        out[id] = { state: row.state, attemptedAt: row.attemptedAt };
    }
  }
  return out;
}
export function recoverDelivery(map) {
  return Object.fromEntries(
    Object.entries(mergeDelivery(map)).map(([id, row]) => [
      id,
      { ...row, state: row.state === "sending" ? "unknown" : row.state },
    ]),
  );
}
