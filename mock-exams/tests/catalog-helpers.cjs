// Open conditions without implicitly resuming a previous attempt.
exports.selectFullExam = async (page, id = "001") => {
  await page
    .locator("#exam-modes")
    .getByRole("button", { name: /回ごとに受験する/ })
    .click();
  await page
    .locator(`[data-exam-id="${id}"]`)
    .getByRole("button", { name: "詳細・PDF", exact: true })
    .click();
};
