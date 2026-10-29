// Send only aggregate activity categories. Never pass answers, scores, elapsed
// time, attempt IDs, storage data, or the navigation fragment to Analytics.
export function trackExamAction(action, exam, attempt, detail) {
  if (attempt?.isSample || !["start", "grade", "pause"].includes(action))
    return;
  if (!["timed", "untimed", "section"].includes(attempt?.mode)) return;
  const params = {
    exam_id: exam.id,
    exam_version: exam.version,
    exam_mode: attempt.mode,
    section_id: attempt.mode === "section" ? attempt.sectionIds[0] : "all",
    page_location: globalThis.location.origin + globalThis.location.pathname,
    page_referrer: globalThis.document.referrer.split(/[?#]/)[0],
  };
  if (action === "grade") {
    if (!["final", "interim", "timeout"].includes(detail)) return;
    params.grading_type = detail;
  }
  if (action === "pause") {
    if (!["ungraded", "graded"].includes(detail)) return;
    params.pause_type = detail;
  }
  try {
    globalThis.gtag?.("event", "mock_exam_" + action, params);
  } catch {
    // Analytics availability must not affect local learning or statistics.
  }
}
