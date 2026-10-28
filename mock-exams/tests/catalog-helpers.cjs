// Start a fresh run, including when a different run is paused.
exports.startFullExam = async (page, mode = "untimed", id = "001") => {
  await page
    .locator("#exam-modes")
    .getByRole("button", { name: /回ごとに受験する/ })
    .click();
  await page
    .locator("#catalog-time")
    .getByRole("button", {
      name: mode === "timed" ? "60分で受験する" : "時間制限なしで解く",
      exact: true,
    })
    .click();
  const card = page.locator(`[data-exam-id="${id}"]`);
  const fresh = card.getByRole("button", { name: "最初から解く", exact: true });
  await (
    (await fresh.count())
      ? fresh
      : card.getByRole("button", { name: "選択", exact: true })
  ).click();
};
exports.gradeInterim = async (page) => {
  await page.getByRole("button", { name: "中断", exact: true }).click();
  await page
    .getByRole("button", { name: "ここまでを採点して中断", exact: true })
    .click();
};

exports.reviewFromResults = async (page) => {
  const id = new URL(page.url()).hash.slice(1);
  await page
    .getByRole("button", { name: "学習履歴に戻る", exact: true })
    .click();
  await page
    .locator(`[data-attempt-id="${id}"]`)
    .getByRole("button", { name: "復習", exact: true })
    .click();
};
exports.exitReviewToCatalog = async (page) => {
  await page.locator("#back-list").click();
  await page
    .getByRole("button", { name: "模試一覧に戻る", exact: true })
    .click();
};
