// Latest complete snapshot per attempt; never append increment-only events.
export function queueSubmission(exam, attempt, { source = "exam" } = {}) {
  if (source === "review") return false;
  if (
    source !== "exam" ||
    !attempt.result ||
    !attempt.gradedAnswers ||
    attempt.status !== "graded"
  )
    throw Error("No grade to submit");
  attempt.statsToken ||= Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  attempt.pendingSubmission = {
    kind: "attempt-grade",
    attemptId: attempt.id,
    attemptToken: attempt.statsToken,
    examId: exam.id,
    examVersion: exam.version,
    revision: attempt.revision,
    sectionIds: [...attempt.sectionIds],
    answers: structuredClone(attempt.gradedAnswers),
  };
  return true;
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
    headers: {
      "Content-Type": "application/json",
      ...(config.publishableKey ? { apikey: config.publishableKey } : {}),
    },
    body: JSON.stringify({
      ...sent,
      challengeToken,
      challengeRequestId: crypto.randomUUID(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 409)
    throw Error(
      "保存先に同じ受験の異なる記録があります。別端末の履歴を確認してください。この記録では上書きしません。",
    );
  if (r.status === 429)
    throw Error(
      "集計が混み合っています。時間をおいて再送してください。成績は保存済みです。",
    );
  if (!r.ok) throw Error("集計送信を完了できませんでした。再送できます。");
  const ack = await r.json();
  if (ack.status === "stale")
    throw Error(
      "保存先にこの受験の新しい採点があります。最新の履歴を使用してください。この記録では上書きしません。",
    );
  if (
    !["recorded", "duplicate"].includes(ack.status) ||
    !Number.isInteger(ack.revision) ||
    ack.revision !== sent.revision
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
