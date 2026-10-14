// Browser checks of the learner's workflows, independent of the model tests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const axePath = require.resolve(
  process.env.LAB_AXE_MODULE || "axe-core/axe.min.js",
);
const base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const browser = await chromium.launch({
  executablePath: process.env.LAB_CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
async function stored(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("study-atlas-relational-database-v1")),
  );
}
async function confirm(page) {
  await page.locator("#confirm-ok").click();
  await page.locator("#confirm-dialog").waitFor({ state: "hidden" });
}
async function accessibility(page, label) {
  const violations = await page.evaluate(async () =>
    (
      await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  );
  assert.deepEqual(violations, [], label);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label}: no page overflow`,
  );
}
async function setRow(page, values) {
  const inputs = page.locator("#row-fields input");
  for (let i = 0; i < values.length; i++) await inputs.nth(i).fill(values[i]);
  await page.locator('#row-form button[type="submit"]').click();
}
async function drag(page, locator, touch) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox(),
    start = { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    end = { x: start.x + 22, y: start.y + 16 };
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  }
}
async function dragColumn(page, key, targetKey, surface, touch) {
  const handle = page.locator(`${surface} [data-column-drag="${key}"]`);
  const target = page.locator(`${surface} [data-column-slot="${targetKey}"]`);
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox(),
    dest = await target.boundingBox();
  const horizontal =
    surface === "#result-table" ||
    (await page
      .locator(surface)
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length > 1,
      ));
  const start = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };
  const end = {
    x: dest.x + dest.width * (horizontal ? 0.2 : 0.5),
    y: dest.y + dest.height * (horizontal ? 0.5 : 0.2),
  };
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  }
}
try {
  for (const width of process.env.LAB_DATABASE_STANDALONE_ONLY
    ? []
    : [1280, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 900 : 844 },
      hasTouch: width < 600,
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (route) => route.abort());
    await page.goto(base + "/lab/");
    await page.locator('a[href="./relational-database/"]').click();
    await page.waitForSelector("#table-editor tbody tr");
    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.locator(".db-steps strong").allTextContents(), [
      "定義",
      "結合",
      "射影",
      "選択",
    ]);
    assert.equal(await page.locator("#table-editor tbody tr").count(), 24);
    assert.match(
      await page.locator('[data-table="memberships"]').textContent(),
      /部員/,
    );
    assert.equal(
      await page.locator('[data-cell="s1/name"]').inputValue(),
      "青木 太郎",
    );
    assert.equal(await page.locator("[data-edit-row]").count(), 0);
    assert.doesNotMatch(
      await page.locator("#table-editor").textContent(),
      /行の操作/,
    );
    await accessibility(page, `${width}: definition with editable cells`);
    // Direct editing, switching to another cell, keyboard traversal, and invalid PKs.
    await page.locator('[data-cell="s1/name"]').fill("青木 一郎");
    await page.locator('[data-cell="s1/name"]').press("Enter");
    assert.equal(
      (await stored(page)).tables[0].rows[0].values.name,
      "青木 一郎",
    );
    await page.locator('[data-cell="s1/name"]').fill("青木 太郎");
    await page.locator('[data-cell="s2/name"]').click();
    assert.equal(
      await page
        .locator('[data-cell="s2/name"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(
      (await stored(page)).tables[0].rows[0].values.name,
      "青木 太郎",
    );
    await page.locator('[data-cell="s2/sid"]').fill("S01");
    await page.locator('[data-cell="s2/sid"]').press("Enter");
    assert.match(
      await page.locator("#table-error").textContent(),
      /主キーが重複/,
    );
    assert.equal((await stored(page)).tables[0].rows[1].values.sid, "S02");
    await page.locator('[data-cell="s2/sid"]').press("Escape");
    assert.equal(
      await page.locator('[data-cell="s2/sid"]').inputValue(),
      "S02",
    );
    await page.locator('[data-cell="s2/sid"]').press("Tab");
    assert.equal(
      await page
        .locator('[data-cell="s2/name"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator("#import-db").click();
    assert.equal(
      await page.locator("#load-dialog .db-load-options button").count(),
      2,
    );
    assert.equal(
      await page.locator("#load-sample strong").textContent(),
      "学生・部員・部活",
    );
    assert.doesNotMatch(
      await page.locator("#load-dialog").textContent(),
      /講義ノート/,
    );
    await accessibility(page, `${width}: load dialog`);
    await page.locator('[data-close="load-dialog"]').first().click();
    await page.locator("#add-row").click();
    await accessibility(page, `${width}: row dialog`);
    await setRow(page, ["S01", "別の人"]);
    assert.match(
      await page.locator("#row-error").textContent(),
      /主キーが重複/,
    );
    await setRow(page, ["S25", "小川 誠"]);
    await page.locator("#row-dialog").waitFor({ state: "hidden" });
    await page.locator('[data-step="2"]').click();
    assert.equal(
      await page.locator("#result-count").textContent(),
      "40行 × 7列",
    );
    const nonmember = page
      .locator("#result-table tbody tr")
      .filter({ hasText: "伊藤 花子" });
    assert.equal(await nonmember.count(), 1);
    assert.equal(await nonmember.locator(".db-null").count(), 5);
    assert.doesNotMatch(
      await page.locator("#join-panel").textContent(),
      /出発|テーブルの「窓」/,
    );
    assert.equal(
      await page
        .locator("#query-layout")
        .evaluate((el) =>
          el.previousElementSibling.contains(
            document.getElementById("add-relation-after"),
          ),
        ),
      true,
    );
    if (width >= 1280) {
      const end = await page.locator('[data-card="club"]').boundingBox();
      const region = await page.locator("#graph-scroll").boundingBox();
      assert.ok(
        region.x + region.width - end.x - end.width < 40,
        "cards use the graph width",
      );
    }
    await accessibility(page, `${width}: join and base table`);
    await page.locator("#query-base").selectOption("club");
    assert.equal(
      await page.locator("#result-count").textContent(),
      "37行 × 7列",
    );
    assert.equal(
      await page.locator("#result-table thead th").first().textContent(),
      "部活ID部活",
    );
    const emptyClub = page
      .locator("#result-table tbody tr")
      .filter({ hasText: "文芸部" });
    assert.equal(await emptyClub.count(), 1);
    assert.equal(await emptyClub.locator(".db-null").count(), 4);
    // Unmatched rows survive from whichever table is selected as the base.
    await page.locator('[data-step="1"]').click();
    await page.locator('[data-table="clubs"]').click();
    await page.locator("#add-row").click();
    await setRow(page, ["C08", "書道部", "小川"]);
    await page.locator("#row-dialog").waitFor({ state: "hidden" });
    await page.locator('[data-step="2"]').click();
    assert.equal(
      await page.locator("#result-count").textContent(),
      "38行 × 7列",
    );
    assert.equal(
      await page
        .locator("#result-table tbody tr")
        .last()
        .locator("td")
        .last()
        .textContent(),
      "空欄",
    );
    await page.locator("#query-base").selectOption("membership");
    assert.equal(
      await page.locator("#result-count").textContent(),
      "36行 × 7列",
    );
    await page.locator("#query-base").selectOption("student");
    assert.equal(
      await page.locator("#result-count").textContent(),
      "40行 × 7列",
    );
    // Base controls are only in Join; column controls are only in Projection.
    assert.equal(await page.locator("#join-panel #query-base").count(), 1);
    assert.equal(
      await page.locator("#result-table [data-column-drag]").count(),
      0,
    );
    await page.locator('[data-step="3"]').click();
    assert.equal(await page.locator("#query-base").isVisible(), false);
    assert.equal(await page.locator("#sort-column").count(), 0);
    assert.deepEqual(
      await page.locator("#projection-columns legend").allTextContents(),
      ["学生", "部員", "部活"],
    );
    await dragColumn(
      page,
      "student/name",
      "student/sid",
      "#result-table",
      width < 600,
    );
    assert.equal(
      await page.locator("#result-table thead th").first().textContent(),
      "氏名学生",
    );
    assert.equal(
      await page
        .locator('#result-table [data-column-drag="student/name"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    if (width >= 1280)
      await dragColumn(
        page,
        "club/name",
        "membership/cid",
        "#result-table",
        false,
      );
    else
      await page
        .locator('#result-table [data-column-drag="club/name"]')
        .press("ArrowLeft");
    assert.deepEqual(
      await page
        .locator("[data-projection]:checked")
        .evaluateAll((items) => items.map((el) => el.dataset.projection)),
      [
        "student/sid",
        "student/name",
        "membership/cid",
        "club/name",
        "club/advisor",
      ],
    );
    const order = (await stored(page)).query.order;
    await page.locator('[data-step="2"]').click();
    await page.locator("#query-base").selectOption("club");
    await page.locator('[data-step="3"]').click();
    assert.deepEqual((await stored(page)).query.order, order);
    assert.equal(
      await page.locator("#result-count").textContent(),
      "38行 × 5列",
    );
    await page.locator('[data-step="2"]').click();
    await page.locator("#query-base").selectOption("student");
    await page.locator('[data-step="3"]').click();
    await page.locator('[data-projection="club/name"]').uncheck();
    await accessibility(page, `${width}: projection with layout controls`);
    await page.locator('[data-step="4"]').click();
    assert.equal(
      await page.locator('[data-property="key"]').inputValue(),
      "club/name",
    );
    assert.match(
      await page.locator('[data-property="key"] option:checked').textContent(),
      /非表示/,
    );
    assert.equal(
      await page.locator('[data-property="value"]').inputValue(),
      "将棋部",
    );
    assert.equal(
      await page.locator("#result-count").textContent(),
      "6行 × 4列",
    );
    assert.equal(await page.locator("#query-base").isVisible(), false);
    assert.equal(await page.locator("#projection-columns").isVisible(), false);
    assert.equal(
      await page.locator("#result-table [data-column-drag]").count(),
      0,
    );
    assert.equal(await page.locator("#clear-filters").count(), 0);
    await page.locator('[data-property="op"]').selectOption("empty");
    assert.equal(
      await page.locator('[data-property="value"]').isVisible(),
      false,
    );
    await accessibility(page, `${width}: null condition hides value`);
    await page.locator('[data-property="op"]').selectOption("filled");
    assert.equal(
      await page.locator('[data-property="value"]').isVisible(),
      false,
    );
    await page.locator('[data-property="op"]').selectOption("eq");
    assert.equal(
      await page.locator('[data-property="value"]').isVisible(),
      true,
    );
    assert.equal(
      await page.locator('[data-property="value"]').inputValue(),
      "将棋部",
    );
    await page
      .locator('[data-sort-column="student/sid"][data-direction="desc"]')
      .click();
    const rowIds = async () =>
      page.locator("#result-table tbody tr td:nth-child(2)").allTextContents();
    assert.deepEqual(await rowIds(), [
      "S16",
      "S15",
      "S10",
      "S09",
      "S04",
      "S03",
    ]);
    await page
      .locator('[data-sort-column="club/advisor"][data-direction="asc"]')
      .click();
    assert.deepEqual(await rowIds(), [
      "S16",
      "S15",
      "S10",
      "S09",
      "S04",
      "S03",
    ]);
    assert.deepEqual((await stored(page)).query.sort, [
      { key: "club/advisor", direction: "asc" },
      { key: "student/sid", direction: "desc" },
    ]);
    await page.locator("#reset-sort").click();
    assert.equal(await page.locator("#reset-sort").isVisible(), false);
    assert.deepEqual(await rowIds(), [
      "S03",
      "S04",
      "S09",
      "S10",
      "S15",
      "S16",
    ]);
    await accessibility(page, `${width}: selection with hidden field`);
    await page.locator('[data-step="3"]').click();
    await page.locator("#hide-all").click();
    await page.locator('[data-projection="student/name"]').check();
    assert.equal(
      await page.locator("#result-count").textContent(),
      "40行 × 1列",
    );
    await page.locator("#distinct-rows").check();
    assert.equal(
      await page.locator("#result-count").textContent(),
      "25行 × 1列",
    );
    await page.locator('[data-step="4"]').click();
    assert.equal(
      await page.locator("#result-count").textContent(),
      "6行 × 1列",
    );
    while (await page.locator("[data-delete-filter]").count())
      await page.locator("[data-delete-filter]").first().click();
    // Occurrences reference the same table; movement and self-joins remain usable.
    await page.locator('[data-step="2"]').click();
    await page.locator("#graph-fit").click();
    await page.waitForFunction(() => {
      const el = document.getElementById("graph-scroll");
      return el.scrollWidth <= el.clientWidth + 1;
    });
    await page.locator("#graph-actual").click();
    const handle = page.locator('[data-handle="student"]');
    const originalX = (await stored(page)).occurrences[0].x;
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal((await stored(page)).occurrences[0].x, originalX + 10);
    await drag(page, handle, width < 600);
    assert.equal((await stored(page)).occurrences[0].x, originalX + 32);
    await page.locator("#undo").click();
    assert.equal((await stored(page)).occurrences[0].x, originalX + 10);
    await page.locator("#redo").click();
    await page.locator("#occurrence-table").selectOption("students");
    await page.locator("#add-occurrence").click();
    let data = await stored(page),
      copy = data.occurrences.at(-1).id;
    await page.locator("#add-relation-after").click();
    assert.equal(await page.locator("#relation-right").inputValue(), copy);
    await page.locator("[data-pair-left]").selectOption("sid");
    await page.locator("[data-pair-right]").selectOption("sid");
    await accessibility(page, `${width}: relation dialog`);
    await page.locator('#relation-form button[type="submit"]').click();
    assert.equal(
      await page.locator("#result-count").textContent(),
      "40行 × 9列",
    );
    await page.locator("#add-relation").click();
    await page.locator("#relation-right").selectOption("club");
    await page.locator("[data-pair-right]").selectOption("cid");
    await page.locator('#relation-form button[type="submit"]').click();
    assert.match(await page.locator("#relation-error").textContent(), /輪/);
    await page.locator('[data-close="relation-dialog"]').first().click();
    // A table with a composite primary key and numeric data, entirely via GUI.
    await page.locator('[data-step="1"]').click();
    await page.locator("#add-table").click();
    await page.locator("#schema-name").fill("成績");
    await page.locator('[data-schema="name"]').fill("区分");
    await page.locator('[data-schema="primary"]').check();
    await page.locator("#add-column").click();
    await page.locator('[data-schema="name"]').nth(1).fill("番号");
    await page.locator('[data-schema="type"]').nth(1).selectOption("number");
    await page.locator('[data-schema="primary"]').nth(1).check();
    await page.locator("#add-column").click();
    await page.locator('[data-schema="name"]').nth(2).fill("得点");
    await page.locator('[data-schema="type"]').nth(2).selectOption("number");
    await accessibility(page, `${width}: schema dialog`);
    await page.locator('#schema-form button[type="submit"]').click();
    assert.equal(await page.locator("#schema-dialog").isVisible(), false);
    await page.locator("#add-row").click();
    await setRow(page, ["A", "1", "wrong"]);
    assert.match(await page.locator("#row-error").textContent(), /有限/);
    await setRow(page, ["A", "1", "75"]);
    await page.locator("#row-dialog").waitFor({ state: "hidden" });
    await page.locator("#add-row").click();
    await setRow(page, ["A", "2", "90"]);
    await page.locator("#row-dialog").waitFor({ state: "hidden" });
    await page.locator("#add-row").click();
    await setRow(page, ["A", "1", "80"]);
    assert.match(
      await page.locator("#row-error").textContent(),
      /主キーが重複/,
    );
    await setRow(page, ["", "3", "80"]);
    assert.match(await page.locator("#row-error").textContent(), /空欄/);
    await page.locator('[data-close="row-dialog"]').first().click();
    data = await stored(page);
    const grade = data.tables.at(-1),
      gradeCard = data.occurrences.at(-1);
    const score = page.locator(
      `[data-cell="${grade.rows[0].id}/${grade.columns[2].id}"]`,
    );
    await score.fill("wrong");
    await score.press("Enter");
    assert.match(await page.locator("#table-error").textContent(), /有限/);
    assert.equal(
      (await stored(page)).tables.at(-1).rows[0].values[grade.columns[2].id],
      75,
    );
    await score.press("Escape");
    await score.fill("-12.5");
    await score.press("Enter");
    assert.equal(
      (await stored(page)).tables.at(-1).rows[0].values[grade.columns[2].id],
      -12.5,
    );
    await score.fill("75");
    await score.press("Tab");
    assert.equal(
      (await stored(page)).tables.at(-1).rows[0].values[grade.columns[2].id],
      75,
    );
    // Optional primary key: remove both checks, then permit the duplicate pair.
    await page.locator("#edit-schema").click();
    await page.locator('[data-schema="primary"]').nth(0).uncheck();
    await page.locator('[data-schema="primary"]').nth(1).uncheck();
    await page.locator('#schema-form button[type="submit"]').click();
    await page.locator("#add-row").click();
    await setRow(page, ["A", "1", "80"]);
    await page.locator("#row-dialog").waitFor({ state: "hidden" });
    // Deleting a column is confirmed; other column values survive.
    await page.locator("#edit-schema").click();
    await page.locator("[data-remove-column]").first().click();
    await page.locator('#schema-form button[type="submit"]').click();
    await confirm(page);
    assert.deepEqual(
      (await stored(page)).tables
        .at(-1)
        .rows.map((r) => r.values[grade.columns[2].id]),
      [75, 90, 80],
    );
    await page.locator('[data-step="2"]').click();
    await page.locator('[data-step="2"]').click();
    await page.locator("#query-base").selectOption(gradeCard.id);
    // Mismatched relation types show a useful error.
    await page.locator("#add-relation").click();
    await page.locator("#relation-left").selectOption("student");
    await page.locator("#relation-right").selectOption(gradeCard.id);
    await page.locator("[data-pair-right]").selectOption(grade.columns[1].id);
    await page.locator('#relation-form button[type="submit"]').click();
    assert.match(await page.locator("#relation-error").textContent(), /同じ型/);
    await page.locator('[data-close="relation-dialog"]').first().click();
    await page.locator('[data-step="3"]').click();
    await page.locator("#show-all").click();
    await page
      .locator(`[data-projection="${gradeCard.id}/${grade.columns[2].id}"]`)
      .uncheck();
    await page.locator('[data-step="4"]').click();
    await page.locator("#add-filter").click();
    await page
      .locator('[data-property="key"]')
      .selectOption(`${gradeCard.id}/${grade.columns[2].id}`);
    await page.locator('[data-property="op"]').selectOption("ge");
    await page.locator('[data-property="value"]').fill("80");
    assert.equal(
      await page.locator("#result-count").textContent(),
      "2行 × 1列",
    );
    await page.locator('[data-property="value"]').fill("invalid");
    assert.equal(await page.locator("#query-error").isVisible(), true);
    assert.equal(await page.locator("#result-table tbody tr").count(), 0);
    await page.locator('[data-property="value"]').fill("80");
    assert.equal(await page.locator("#query-error").isVisible(), false);
    // Header actions accumulate stable sorts; a later hidden column keeps its saved criterion.
    await page.locator('[data-step="3"]').click();
    await page
      .locator(`[data-projection="${gradeCard.id}/${grade.columns[2].id}"]`)
      .check();
    await page.locator('[data-step="4"]').click();
    await page
      .locator(
        `[data-sort-column="${gradeCard.id}/${grade.columns[1].id}"][data-direction="asc"]`,
      )
      .click();
    await page
      .locator(
        `[data-sort-column="${gradeCard.id}/${grade.columns[2].id}"][data-direction="desc"]`,
      )
      .click();
    assert.deepEqual(
      await page.locator("#result-table tbody td").allTextContents(),
      ["2", "90", "1", "80"],
    );
    await page.locator('[data-step="3"]').click();
    await page
      .locator(`[data-projection="${gradeCard.id}/${grade.columns[2].id}"]`)
      .uncheck();
    await page.locator('[data-step="4"]').click();
    assert.deepEqual(
      await page.locator("#result-table tbody td").allTextContents(),
      ["2", "1"],
    );
    await page
      .locator(
        `[data-sort-column="${gradeCard.id}/${grade.columns[1].id}"][data-direction="asc"]`,
      )
      .click();
    assert.deepEqual(
      await page.locator("#result-table tbody td").allTextContents(),
      ["1", "2"],
    );
    // Actual JSON download, invalid import preservation, and reload restoration.
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-db").click();
    const download = await downloadPromise;
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    assert.deepEqual(exported, await stored(page));
    await page.locator("#import-file").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":9}'),
    });
    await page.waitForFunction(() =>
      document
        .getElementById("db-status")
        .textContent.includes("読み込めません"),
    );
    assert.deepEqual(await stored(page), exported);
    await page.reload();
    await page.waitForSelector("#table-editor tbody tr");
    assert.deepEqual(await stored(page), exported);
    await page.locator("#import-file").setInputFiles({
      name: "valid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
    await confirm(page);
    assert.deepEqual(await stored(page), exported);
    await page.locator('[data-step="1"]').click();
    await page.locator("#delete-table").click();
    await confirm(page);
    assert.equal((await stored(page)).tables.length, 3);
    await page.locator("#undo").click();
    assert.equal((await stored(page)).tables.length, 4);
    // New workspace, a primary-key-free table, and blank cells.
    await page.locator("#new-db").click();
    await confirm(page);
    assert.equal((await stored(page)).tables.length, 0);
    await page.locator("#add-table").click();
    await page.locator("#schema-name").fill("自由な表");
    await page.locator('[data-schema="name"]').fill("メモ");
    await page.locator('#schema-form button[type="submit"]').click();
    await page.locator("#add-row").click();
    await setRow(page, [""]);
    await page.locator("#row-dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await stored(page)).tables[0].rows[0].values[
        Object.keys((await stored(page)).tables[0].rows[0].values)[0]
      ],
      null,
    );
    await page.locator("#import-db").click();
    await page.locator("#load-sample").click();
    await confirm(page);
    assert.equal((await stored(page)).tables.length, 3);
    console.log(
      `${width}px: join, projection, hidden-field filters, schema/row constraints, drag, save/load, undo and reset passed`,
    );
    await context.close();
  }
  if (process.env.LAB_DATABASE_PREVIEW) {
    const html = await readFile(process.env.LAB_DATABASE_PREVIEW, "utf8");
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 600,
        acceptDownloads: true,
      });
      if (width === 320)
        await context.addInitScript(() =>
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new Error("unavailable");
            },
          }),
        );
      const page = await context.newPage(),
        external = [],
        standalone = `${base}/standalone-database`;
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().startsWith("http") && r.url() !== standalone)
          external.push(r.url());
      });
      await page.route(standalone, (route) =>
        route.fulfill({ contentType: "text/html", body: html }),
      );
      await page.route("https://**/*", (route) => route.abort());
      await page.goto(standalone);
      await page.waitForSelector("#table-editor tbody tr");
      assert.equal(await page.locator("#table-editor tbody tr").count(), 24);
      await page.locator('[data-cell="s1/name"]').fill("青木 一郎");
      await page.locator('[data-cell="s1/name"]').press("Enter");
      await page.locator('[data-step="3"]').click();
      await page.locator("#hide-all").click();
      await page.locator('[data-projection="student/name"]').check();
      await page.locator('[data-projection="student/sid"]').check();
      await dragColumn(
        page,
        "student/name",
        "student/sid",
        "#result-table",
        width < 600,
      );
      assert.equal(
        await page.locator("#result-table thead th").first().textContent(),
        "氏名学生",
      );
      await page.locator('[data-projection="student/sid"]').uncheck();
      await page.locator('[data-step="4"]').click();
      assert.equal(
        await page.locator("#result-count").textContent(),
        "6行 × 1列",
      );
      await page.locator('[data-property="value"]').fill("科学部");
      assert.equal(
        await page.locator("#result-count").textContent(),
        "8行 × 1列",
      );
      assert.equal(
        await page.locator("#result-table tbody td").first().textContent(),
        "青木 一郎",
      );
      await page
        .locator('[data-sort-column="student/name"][data-direction="desc"]')
        .click();
      assert.equal(
        await page
          .locator('[data-sort-column="student/name"][data-direction="desc"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.locator("#reset-sort").click();
      assert.equal(
        await page.locator("#result-table tbody td").first().textContent(),
        "青木 一郎",
      );
      await page.locator("#new-db").click();
      await confirm(page);
      await page.locator("#add-table").click();
      await page.locator("#schema-name").fill("自分の表");
      await page.locator('[data-schema="name"]').fill("メモ");
      await page.locator('#schema-form button[type="submit"]').click();
      await page.locator("#add-row").click();
      const literal = '<img src=x onerror="globalThis.injected=true">';
      await setRow(page, [literal]);
      assert.equal(await page.locator("[data-cell]").inputValue(), literal);
      assert.equal(await page.locator("#table-editor img").count(), 0);
      assert.equal(await page.evaluate(() => globalThis.injected), undefined);
      if (width === 320)
        assert.match(
          await page.locator("#db-status").textContent(),
          /自動保存が使えません/,
        );
      const downloading = page.waitForEvent("download");
      await page.locator("#export-db").click();
      const data = JSON.parse(
        await readFile(await (await downloading).path(), "utf8"),
      );
      assert.equal(Object.values(data.tables[0].rows[0].values)[0], literal);
      assert.deepEqual(external, []);
      console.log(
        `${width}px standalone: query, direct editing, unavailable storage and JSON export passed`,
      );
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
