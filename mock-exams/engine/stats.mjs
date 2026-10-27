export const statsConfig = {
  url: "https://yygezzpowsvpzarqdtls.supabase.co",
  publishableKey: "sb_publishable_rQmX7MCx_8W3nz-xWXQBpA_CHzdRQSk",
  submitUrl:
    "https://yygezzpowsvpzarqdtls.supabase.co/functions/v1/mock-exam-submit",
};
export async function fetchStats(exam, request = fetch) {
  const r = await request(
    statsConfig.url + "/rest/v1/rpc/get_mock_exam_stats",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: statsConfig.publishableKey,
      },
      body: JSON.stringify({
        p_exam_id: exam.id,
        p_exam_version: exam.version,
      }),
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!r.ok) throw new Error("統計を取得できませんでした");
  const rows = await r.json();
  if (!Array.isArray(rows)) throw Error("統計の応答形式を確認できませんでした");
  for (const row of rows) {
    const n = Number(row.answered_count),
      correct = Number(row.correct_count),
      points = Number(row.points_sum);
    if (
      typeof row.scoring_id !== "string" ||
      !Number.isSafeInteger(n) ||
      n < 0 ||
      !Number.isSafeInteger(correct) ||
      correct < 0 ||
      correct > n ||
      !Number.isFinite(points) ||
      points < 0
    )
      throw Error("統計の値を確認できませんでした");
  }
  return rows;
}
// The public config contains only the public Turnstile key. Backend readiness is
// checked through a service-only health RPC; a missing deployment fails closed.
export async function fetchSubmissionConfig(request = fetch) {
  const r = await request(statsConfig.submitUrl, {
    headers: { apikey: statsConfig.publishableKey },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok)
    throw Error(
      "統計送信の接続を確認できません。成績はこのブラウザに保存されています。",
    );
  const body = await r.json();
  if (
    body.protocol !== 2 ||
    body.ready !== true ||
    typeof body.turnstileSiteKey !== "string" ||
    !body.turnstileSiteKey
  )
    throw Error(
      "統計送信の準備が整っていません。成績はこのブラウザに保存されています。",
    );
  return {
    ...statsConfig,
    turnstileSiteKey: body.turnstileSiteKey,
    verificationEnabled: body.verificationEnabled === true,
  };
}
