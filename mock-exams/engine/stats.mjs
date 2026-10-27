export const statsConfig = {
  url: "https://yygezzpowsvpzarqdtls.supabase.co",
  publishableKey: "sb_publishable_rQmX7MCx_8W3nz-xWXQBpA_CHzdRQSk",
};
export function validateExamIdentity(exam) {
  if (
    typeof exam.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(exam.id) ||
    !Number.isInteger(exam.version) ||
    exam.version < 1 ||
    exam.version > 2147483647
  )
    throw Error("模試IDまたは整数の問題版が不正です");
}
export function recordBody(exam, units) {
  validateExamIdentity(exam);
  const ids = new Set();
  if (units.length > 100)
    throw Error("統計に送信する採点単位が100件を超えています");
  const p_results = units.map((u) => {
    const def = exam.scoring.find((x) => x.id === u.id);
    if (
      !def ||
      ids.has(u.id) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(u.id) ||
      !["q1", "q2a", "q2b", "q3", "q4"].includes(u.sectionId) ||
      def.sectionId !== u.sectionId ||
      !u.answered ||
      typeof u.answerKey !== "string" ||
      !u.answerKey.replace(/[|_]/g, "") ||
      !/^[0-9A-F_]([|][0-9A-F_])*$/.test(u.answerKey) ||
      u.answerKey.length > 127 ||
      !Number.isFinite(u.points) ||
      u.points < 0 ||
      u.points > def.maxPoints ||
      u.maxPoints !== def.maxPoints ||
      def.maxPoints <= 0 ||
      def.maxPoints > 100 ||
      Math.round(u.points * 100) / 100 !== u.points ||
      Math.round(def.maxPoints * 100) / 100 !== def.maxPoints
    )
      throw Error("統計に送信する採点単位が不正です");
    ids.add(u.id);
    return {
      section_id: u.sectionId,
      scoring_id: u.id,
      answer: u.answerKey,
      earned_points: u.points,
      max_points: def.maxPoints,
    };
  });
  return { p_exam_id: exam.id, p_exam_version: exam.version, p_results };
}
export function rpcOptions(body) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: statsConfig.publishableKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  };
}
export async function fetchStats(exam, request = fetch) {
  validateExamIdentity(exam);
  const r = await request(
    statsConfig.url + "/rest/v1/rpc/get_mock_exam_stats",
    rpcOptions({ p_exam_id: exam.id, p_exam_version: exam.version }),
  );
  if (!r.ok) throw Error("統計を取得できませんでした");
  const body = await r.json(),
    rows = body?.items;
  if (!Array.isArray(rows)) throw Error("統計の応答形式が不正です");
  const seen = new Set();
  for (const row of rows) {
    const n = Number(row?.answered_count),
      correct = Number(row?.correct_count),
      points = Number(row?.points_sum);
    if (
      !row ||
      typeof row.scoring_id !== "string" ||
      seen.has(row.scoring_id) ||
      !["q1", "q2a", "q2b", "q3", "q4"].includes(row.section_id) ||
      row.answered_count == null ||
      row.correct_count == null ||
      row.points_sum == null ||
      !Number.isSafeInteger(n) ||
      n < 0 ||
      !Number.isSafeInteger(correct) ||
      correct < 0 ||
      correct > n ||
      !Number.isFinite(points) ||
      points < 0 ||
      (n === 0 && points !== 0)
    )
      throw Error("統計の値が不正です");
    seen.add(row.scoring_id);
    const unit = exam.scoring?.find((u) => u.id === row.scoring_id);
    if (unit && row.section_id !== unit.sectionId)
      throw Error("統計の大問が一致しません");
    if (unit && points > n * unit.maxPoints + 1e-9)
      throw Error("統計の得点が配点を超えています");
  }
  return rows;
}
