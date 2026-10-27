export const statsConfig = {
  url: "https://yygezzpowsvpzarqdtls.supabase.co",
  publishableKey: "sb_publishable_rQmX7MCx_8W3nz-xWXQBpA_CHzdRQSk",
  submitUrl: null,
  turnstileSiteKey: null,
};
export async function fetchStats(exam) {
  const r = await fetch(statsConfig.url + "/rest/v1/rpc/get_mock_exam_stats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: statsConfig.publishableKey,
    },
    body: JSON.stringify({ p_exam_id: exam.id, p_exam_version: exam.version }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error("統計を取得できませんでした");
  return r.json();
}
// No call to the service-role-only RPC from the browser. Remote submissions are
// deliberately disabled until the validated, idempotent server endpoint is deployed.
export function submissionStatus() {
  return statsConfig.submitUrl ? "ready" : "not-configured";
}
