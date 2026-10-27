// Latest complete snapshot per attempt; never append increment-only events.
export function queueSubmission(exam, attempt) {
  if (!attempt.result) throw Error("No grade to submit");
  attempt.statsToken ||= Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  attempt.pendingSubmission = {
    attemptId: attempt.id,
    attemptToken: attempt.statsToken,
    examId: exam.id,
    examVersion: exam.version,
    revision: attempt.revision,
    sectionIds: [...attempt.sectionIds],
    answers: structuredClone(attempt.gradedAnswers || attempt.answers),
  };
}
export async function sendPending(
  attempt,
  config,
  challengeToken,
  request = fetch,
) {
  if (!config.submitUrl || !attempt.pendingSubmission)
    return { status: "disabled" };
  const sent = structuredClone(attempt.pendingSubmission);
  const r = await request(config.submitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...sent,
      challengeToken,
      challengeRequestId: crypto.randomUUID(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("集計送信を完了できませんでした。再送できます。");
  const ack = await r.json();
  if (
    !["recorded", "duplicate", "stale"].includes(ack.status) ||
    !Number.isInteger(ack.revision) ||
    ack.revision < sent.revision
  )
    throw Error("Invalid acknowledgement");
  if (attempt.pendingSubmission?.revision === sent.revision)
    delete attempt.pendingSubmission;
  attempt.statsAcknowledgedRevision = Math.max(
    attempt.statsAcknowledgedRevision || 0,
    ack.revision,
  );
  return ack;
}
