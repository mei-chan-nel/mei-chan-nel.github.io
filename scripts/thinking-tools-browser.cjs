const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const base = process.env.THINKING_TOOLS_URL || "http://127.0.0.1:8773";
(async () => {
  const artifactRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "thinking-tools-test-"),
  );
  const browser = await chromium.launch({
    ...(process.env.THINKING_TOOLS_BROWSER
      ? { executablePath: process.env.THINKING_TOOLS_BROWSER }
      : {}),
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const click = (action) =>
      page.locator(`[data-action="${action}"]`).first().click();
    const example = (id) =>
      page.locator(`[data-action="example"][data-id="${id}"]`).click();
    const step = (i) => page.locator(`#step-nav [data-id="${i}"]`).click();
    const fill = (path, text) =>
      page.locator(`[data-bind="${path}"]`).fill(String(text));
    const sel = (path, text) =>
      page.locator(`[data-bind="${path}"]`).selectOption(String(text));
    const stored = () =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem(
            `study-atlas.thinking-tools.v1.${document.querySelector("#mode-free").getAttribute("aria-pressed") === "true" ? "free" : "preset"}`,
          ),
        ),
      );
    const settle = () => page.waitForTimeout(350);
    await page.goto(base + "/lab/");
    await page.getByRole("link", { name: /思考ツールで問題解決/ }).click();
    assert.equal(
      await page.locator("#stage-title").textContent(),
      "問題の明確化",
    );
    assert.equal(
      await page.locator('[data-bind="problem.title"]').inputValue(),
      "",
    );
    assert.equal(await page.locator(".process-overview li").count(), 7);
    for (const id of ["context", "gap", "question"]) await example(id);
    await fill(
      "problem.question",
      "気付く機会と受け取り時間のどちらが大きい？",
    );
    await click("next");
    await example("cards");
    await click("add-group");
    await page
      .locator('[data-bind^="groups."][data-bind$=".title"]')
      .fill("認識する機会");
    const gid = await page
      .locator('[data-bind^="groups."][data-bind$=".title"]')
      .getAttribute("data-bind");
    const groupID = gid.split(".")[1];
    await sel("cards.c-own.group", groupID);
    assert.equal(
      await page.locator(`[data-drop-group="${groupID}"] [data-card]`).count(),
      1,
    );
    await page
      .locator('[data-card="c-known"] .drag-handle')
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    const dragSource = await page
      .locator('[data-card="c-known"] .drag-handle')
      .boundingBox();
    await page.mouse.move(
      dragSource.x + dragSource.width / 2,
      dragSource.y + dragSource.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      dragSource.x + dragSource.width / 2 + 20,
      dragSource.y + dragSource.height / 2 + 20,
      { steps: 5 },
    );
    await page
      .locator(`[data-drop-group="${groupID}"]`)
      .scrollIntoViewIfNeeded();
    const dragTarget = await page
      .locator(`[data-drop-group="${groupID}"]`)
      .boundingBox();
    await page.mouse.move(dragTarget.x + 100, dragTarget.y + 100, {
      steps: 20,
    });
    await page.mouse.move(dragTarget.x + 102, dragTarget.y + 102);
    await page.mouse.up();
    assert.equal(
      await page.locator(`[data-drop-group="${groupID}"] [data-card]`).count(),
      2,
    );
    await page.locator('[data-select-card="c-time"]').check();
    await page.locator('[data-select-card="c-shame"]').check();
    await click("gather-picked");
    await page.locator("#stage :focus").fill("受け取り行動には壁がある");
    assert.equal(
      await page.locator('.gathered-groups [data-card="c-time"]').count(),
      1,
    );
    await example("groups");
    await example("relations");
    await example("synthesis");
    await click("next");
    await example("causes");
    await example("tests");
    await page.locator('[data-action="cause"][data-id="h-notice"]').click();
    await page.locator('[data-focus-cause="h-notice"]').check();
    await sel("causes.h-notice.evidence", "c-look");
    await click("next");
    await example("branches");
    await click("add-node");
    await page.locator(".node-editor textarea").fill("削除する枝");
    const temporary = await page
      .locator(".node-editor textarea")
      .getAttribute("data-bind");
    const tempId = temporary.split(".")[1];
    await page.locator(`[data-action="node"][data-id="${tempId}"]`).click();
    await page
      .locator(`[data-action="node"][data-id="${tempId}"]`)
      .press("Delete");
    assert.equal(
      await page.locator(`[data-action="node"][data-id="${tempId}"]`).count(),
      0,
    );
    await page.locator('[data-action="node"][data-id="n-photos"]').click();
    assert.match(
      await page.locator(".node-editor").textContent(),
      /自分の物だと気付かない/,
    );
    await click("next");
    await example("criteria");
    await example("scores");
    await sel("criteria.v-0.weight", "5");
    await sel("criteria.v-1.weight", "1");
    await sel("criteria.v-2.weight", "1");
    assert.match(await page.locator(".rank-message").textContent(), /昼休み/);
    await page.locator('[data-selected-idea="n-display"]').check();
    await example("plan");
    await click("next");
    await example("checks");
    await page.locator('[data-bind="checks.ck-0.done"]').check();
    await example("results");
    assert.match(await page.locator(".result-callout").textContent(), /25/); // 55% - 30% = 25 points
    assert.match(await page.locator(".result-callout").textContent(), /未達成/);
    await click("next");
    await page.locator('[data-action="add-kpt"][data-id="try"]').click();
    await page
      .locator('[data-bind^="kpt."][data-bind$=".text"]')
      .fill("昼休みに来られない人にも聞き取る");
    await example("kpt");
    await example("next");
    await click("summary");
    assert.match(
      await page.locator("#summary-content").textContent(),
      /架空シミュレーション/,
    );
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("main").isVisible(), false);
    assert.equal(await page.locator("#summary-dialog").isVisible(), true);
    await page.emulateMedia({ media: "screen" });
    await click("close-summary");
    await click("result-card");
    assert.equal(await page.locator('[data-kind="result"]').count(), 1);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      click("export-json"),
    ]);
    await download.saveAs(path.join(artifactRoot, "preset.json"));
    const preset = JSON.parse(
      await fs.readFile(path.join(artifactRoot, "preset.json"), "utf8"),
    );
    assert.equal(preset.simulation, "display");
    await page.locator("#mode-free").click();
    assert.equal(
      await page.locator('[data-bind="problem.title"]').inputValue(),
      "",
    );
    await fill("problem.title", "朝の準備に時間がかかる");
    await fill("problem.question", "どの探し物に時間がかかる？");
    await fill("measure.label", "朝の準備時間");
    await sel("measure.kind", "value");
    await fill("measure.unit", "分");
    await fill("measure.beforeValue", 8);
    await fill("measure.target", 4);
    await sel("measure.direction", "lower");
    await click("next");
    assert.equal(await page.locator("[data-card]").count(), 0);
    await click("add-card");
    await page
      .locator('[data-bind^="cards."][data-bind$=".text"]')
      .fill("朝の観察で、鍵を探す時間が3分あった");
    await click("add-group");
    await page
      .locator('[data-bind^="groups."][data-bind$=".title"]')
      .fill("探す時間");
    const freeGroup = (
      await page
        .locator('[data-bind^="groups."][data-bind$=".title"]')
        .getAttribute("data-bind")
    ).split(".")[1];
    await page
      .locator('[data-bind^="cards."][data-bind$=".group"]')
      .selectOption(freeGroup);

    await page
      .locator('[data-bind^="cards."][data-bind$=".source"]')
      .fill("自分で計測・3日間");
    await click("next");
    await click("groups-factors");
    await click("add-cause");
    const freeCard = await page
      .locator('[data-bind^="causes."][data-bind$=".evidence"] option')
      .last()
      .getAttribute("value");
    await page
      .locator('[data-bind^="causes."][data-bind$=".evidence"]')
      .selectOption(freeCard);
    await page.locator("[data-focus-cause]").check();
    await page
      .locator('[data-bind^="causes."][data-bind$=".text"]')
      .fill("鍵を置く場所が決まっていない");
    await page
      .locator('[data-bind^="causes."][data-bind$=".test"]')
      .fill("3日間、置き場所と探す時間を記録する");
    await click("next");
    await click("cause-node");
    await page.locator('.node-editor [data-action="add-child"]').click();
    await page.locator(".node-editor textarea").fill("玄関に鍵のトレーを置く");
    await page.locator('.node-editor input[type="checkbox"]').check();
    await click("next");
    await click("add-criterion");
    await page
      .locator('[data-bind^="criteria."][data-bind$=".title"]')
      .fill("続けやすさ");
    await page.locator('[data-bind*=".ratings."]').selectOption("4");
    await page.locator("[data-selected-idea]").check();
    await fill("plan.who", "自分");
    await fill("plan.when", "来週の3日間");
    await fill("plan.test", "朝の準備時間を計測する");
    await click("next");
    assert.equal(await page.locator('[data-action="simulate"]').count(), 0);
    await click("add-check");
    await page
      .locator('[data-bind^="checks."][data-bind$=".text"]')
      .fill("トレーを置く");
    await page.locator('[data-bind^="checks."][data-bind$=".done"]').check();
    await click("add-record");
    await page
      .locator('[data-bind^="records."][data-bind$=".label"]')
      .fill("月曜日");
    await page
      .locator('[data-bind^="records."][data-bind$=".value"]')
      .fill("3");
    await page
      .locator('[data-bind^="records."][data-bind$=".value"]')
      .press("Tab");
    assert.match(
      await page.locator(".result-callout").textContent(),
      /目標は達成/,
    );
    await fill(
      "observation",
      "鍵は見つけやすくなった。1日だけなので継続して確かめたい。",
    );
    await click("next");
    await page.locator('[data-action="add-kpt"][data-id="try"]').click();
    await page
      .locator('[data-bind^="kpt."][data-bind$=".text"]')
      .fill("同じ曜日で3週間試す");
    await page
      .locator('[data-bind^="kpt."][data-bind$=".source"]')
      .fill("実施後は3分、記録は1日分");
    await click("try-idea");
    assert.equal(await page.locator(".map-node").count(), 4);
    await settle();
    const freeState = await stored();
    assert.equal(freeState.records[0].value, 3);
    assert.equal(freeState.cards[0].kind, "fact");
    assert.equal(freeState.nodes.filter((n) => n.candidate).length, 1);
    await page.reload();
    assert.equal(
      await page.locator("#stage-title").textContent(),
      "解決策の発想",
    );
    await page.locator("#mode-preset").click();
    await step(5);
    assert.match(await page.locator(".result-callout").textContent(), /25/);
    await page
      .locator("#import-file")
      .setInputFiles(path.join(artifactRoot, "preset.json"));
    await page.waitForFunction(() =>
      document.querySelector("#notice").textContent.includes("読み込みました"),
    );
    assert.match(await page.locator("#notice").textContent(), /読み込みました/);
    const invalid = structuredClone(preset);
    invalid.nodes[0].parent = invalid.nodes[0].id;
    await page.locator("#import-file").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    await page.waitForFunction(() =>
      document
        .querySelector("#notice")
        .textContent.includes("現在の作業内容は保持"),
    );
    assert.match(
      await page.locator("#notice").textContent(),
      /現在の作業内容は保持/,
    );
    await page.locator("#mode-free").click();
    await step(0);
    await fill("problem.title", '<img src=x onerror="window.__xss=1">');
    await click("summary");
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    await click("close-summary");
    await fill("problem.title", "朝の準備に時間がかかる");
    // Audit all populated stages at mobile width, with diagrams/tables scrolling internally.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const accessibility = [];
    for (let i = 0; i < 7; i++) {
      await step(i);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `mobile overflow step ${i + 1}`,
      );
      const result = await page.evaluate(() =>
        axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      accessibility.push({
        step: i + 1,
        violations: result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
    }
    assert.ok(
      accessibility.every((stage) => stage.violations.length === 0),
      JSON.stringify(accessibility),
    );
    console.log("PASS: accessibility checks for all seven stages");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#mode-preset").click();
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 7; i++) {
      await step(i);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `preset overflow ${i}`,
      );
      const audit = await page.evaluate(() =>
        axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      assert.deepEqual(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        `preset accessibility ${i}`,
      );
      if (i === 3) {
        const initialScale = await page
          .locator('[data-zoom-kind="map"]')
          .getAttribute("data-scale");
        await page
          .getByRole("button", { name: "図を100%で表示", exact: true })
          .click();
        assert.equal(
          await page
            .locator('[data-zoom-kind="map"]')
            .getAttribute("data-scale"),
          "1",
        );
        await page
          .getByRole("button", { name: "図の全体を表示", exact: true })
          .click();
        assert.equal(
          await page
            .locator('[data-zoom-kind="map"]')
            .getAttribute("data-scale"),
          initialScale,
        );
      }
    }
    console.log("PASS: preset accessibility and mobile diagram zoom");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 7 stages in both modes, drag/drop, cause links, map branches, weighted scores, distinct results, backtracking, auto-resume, JSON import/export, print, XSS escaping, mobile widths",
    );
    const restricted = await browser.newPage();
    await restricted.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Blocked", "QuotaExceededError");
      };
    });
    await restricted.goto(base + "/lab/thinking-tools/");
    await restricted
      .locator('[data-bind="problem.title"]')
      .fill("保存できない場合");
    await restricted.waitForTimeout(350);
    assert.match(
      await restricted.locator("#save-status").textContent(),
      /自動保存できません/,
    );
    console.log("PASS: storage failure offers file export");
    const broken = await browser.newPage();
    await broken.addInitScript(() =>
      localStorage.setItem(
        "study-atlas.thinking-tools.v1.preset",
        "broken-json",
      ),
    );
    await broken.goto(base + "/lab/thinking-tools/");
    await broken
      .locator('[data-bind="problem.title"]')
      .fill("作業はファイルで保存");
    await broken.waitForTimeout(350);
    assert.equal(
      await broken.evaluate(() =>
        localStorage.getItem("study-atlas.thinking-tools.v1.preset"),
      ),
      "broken-json",
    );
    assert.match(
      await broken.locator("#save-status").textContent(),
      /自動保存できません/,
    );
    console.log("PASS: corrupt browser drafts are preserved");
  } finally {
    await browser.close();
    await fs.rm(artifactRoot, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
