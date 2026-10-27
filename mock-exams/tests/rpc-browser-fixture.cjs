const assert = require("node:assert/strict");
module.exports = async (context, { dropAt = 0 } = {}) => {
  const submissions = [],
    tables = new Map();
  await context.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      body = req.postDataJSON();
    assert.equal(typeof body.p_exam_version, "number");
    assert.equal(body.p_exam_version, 1);
    const key = body.p_exam_id + "@" + body.p_exam_version;
    if (!tables.has(key)) tables.set(key, new Map());
    const table = tables.get(key);
    if (req.url().endsWith("/get_mock_exam_stats")) {
      await route.fulfill({
        json: {
          items: [...table.values()].map(({ answer_counts, ...r }) => r),
        },
      });
      return;
    }
    assert.ok(req.url().endsWith("/record_mock_exam_results"));
    submissions.push(body);
    for (const u of body.p_results) {
      assert.deepEqual(Object.keys(u).sort(), [
        "answer",
        "earned_points",
        "max_points",
        "scoring_id",
        "section_id",
      ]);
      const row = table.get(u.scoring_id) || {
        section_id: u.section_id,
        scoring_id: u.scoring_id,
        answered_count: 0,
        correct_count: 0,
        points_sum: 0,
        answer_counts: {},
      };
      row.answered_count++;
      row.correct_count += u.earned_points === u.max_points ? 1 : 0;
      row.points_sum += u.earned_points;
      row.answer_counts[u.answer] = (row.answer_counts[u.answer] || 0) + 1;
      table.set(u.scoring_id, row);
    }
    if (submissions.length === dropAt) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ json: { updated_count: body.p_results.length } });
  });
  return { submissions, tables };
};
