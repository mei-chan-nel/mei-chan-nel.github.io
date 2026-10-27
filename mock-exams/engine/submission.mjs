import { grade } from "./scoring.mjs";
import { mergeDelivery } from "./delivery.mjs";
import { statsConfig, recordBody, rpcOptions } from "./stats.mjs";
const inFlight = new Map();
export async function sendUnsentUnits(
  exam,
  attempt,
  store,
  { source = "exam", request = fetch, now = Date.now } = {},
) {
  if (source !== "exam" || !attempt.result || !attempt.gradedAnswers)
    return { status: "skipped", count: 0 };
  if (attempt.examId !== exam.id || attempt.examVersion !== exam.version)
    throw Error("受験履歴の模試・版が一致しません");
  while (inFlight.has(attempt.id)) await inFlight.get(attempt.id);
  let unlock;
  inFlight.set(
    attempt.id,
    new Promise((resolve) => {
      unlock = resolve;
    }),
  );
  async function send() {
    // Reading persisted markers also protects imports of older copies on this device.
    attempt.statsDelivery = mergeDelivery(
      attempt.statsDelivery,
      store.load(attempt.id)?.statsDelivery,
    );
    const units = grade(
      exam,
      attempt.gradedAnswers,
      attempt.sectionIds,
    ).units.filter((u) => u.answered && !attempt.statsDelivery[u.id]);
    if (!units.length) return { status: "idle", count: 0 };
    const body = recordBody(exam, units),
      options = rpcOptions(body),
      attemptedAt = now();
    for (const u of units)
      attempt.statsDelivery[u.id] = { state: "sending", attemptedAt };
    // Both primary and backup must contain the marker BEFORE fetch is called.
    try {
      store.saveStatistics(attempt);
    } catch {
      for (const u of units)
        attempt.statsDelivery[u.id] = { state: "unknown", attemptedAt };
      return { status: "storage-error", count: 0 };
    }
    let state = "unknown";
    try {
      const response = await request(
        statsConfig.url + "/rest/v1/rpc/record_mock_exam_results",
        options,
      );
      if (response.ok) {
        const ack = await response.json();
        // Missing/lost bodies or unexpected counts are ambiguous, never retry.
        if (ack?.updated_count === units.length) state = "sent";
      }
    } catch {
      /* A lost response may already have committed. Never auto-retry. */
    }
    for (const u of units) attempt.statsDelivery[u.id] = { state, attemptedAt };
    try {
      store.saveStatistics(attempt);
    } catch {
      return { status: "storage-error", count: units.length };
    }
    return { status: state, count: units.length };
  }
  try {
    if (globalThis.navigator?.locks)
      return await navigator.locks.request(
        "study-atlas-mock-statistics-" + attempt.id,
        send,
      );
    return await send();
  } finally {
    inFlight.delete(attempt.id);
    unlock();
  }
}
export function deliverySummary(attempt) {
  const counts = { sent: 0, sending: 0, unknown: 0 };
  for (const row of Object.values(attempt.statsDelivery || {}))
    counts[row.state]++;
  return counts;
}
