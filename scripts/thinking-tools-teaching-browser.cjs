const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.THINKING_TOOLS_URL || "http://127.0.0.1:8773";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.THINKING_TOOLS_BROWSER || "/usr/bin/chromium",
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1228, height: 607 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const step = (i) => page.locator(`#step-nav [data-id="${i}"]`).click();
    const preset = (id) =>
      page.locator(`[data-action="preset"][data-id="${id}"]`).click();
    await page.goto(base + "/lab/thinking-tools/");
    await preset("block:context");
    await preset("block:gap");
    await preset("field:problem.question");
    const question = await page
      .locator('[data-bind="problem.question"]')
      .inputValue();
    // Each field's reversible preset stays in the heading, to its upper right.
    for (const width of [1228, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const frame = page.locator('[data-preset-target="problem.question"]');
      const button = frame.locator('[data-action="preset"]');
      const [f, b, input] = await Promise.all([
        frame.boundingBox(),
        button.boundingBox(),
        frame.locator("textarea").boundingBox(),
      ]);
      assert.ok(Math.abs(f.x + f.width - b.x - b.width) < 4);
      assert.ok(b.y + b.height <= input.y + 2);
    }
    await page.locator('[data-action="next"]').click();
    assert.match(
      await page.locator(".stage-transfer").textContent(),
      /まとめ済み/,
    );
    assert.ok(
      (await page.locator(".stage-transfer").textContent()).includes(question),
    );
    assert.match(
      await page.locator(".stage-transfer").textContent(),
      /30%.*60%/,
    );
    assert.equal(await page.locator(".brainstorm-note").count(), 0);
    assert.equal(await page.locator(".brainstorm-rules li").count(), 4);
    await preset("block:brainstorm");
    assert.equal(await page.locator(".brainstorm-note").count(), 4);
    assert.equal(await page.locator("[data-card]").count(), 0);
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
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
    );
    await page
      .locator('[data-action="transfer-brainstorm"][data-id="all"]')
      .click();
    assert.equal(await page.locator("[data-card]").count(), 4);
    assert.equal(await page.locator('[data-kind="fact"]').count(), 0);
    assert.match(
      await page.locator(".stage-outcome").textContent(),
      /4件をKJ法へ/,
    );
    await page.locator('[data-action="next"]').click();
    assert.match(await page.locator(".stage-transfer").textContent(), /4枚/);
    assert.match(
      await page.locator(".stage-transfer").textContent(),
      /意見 1・仮説 3/,
    );
    // The instructions for testing precede the actual cause editor.
    assert.equal(
      await page.locator(".fish-workbench").evaluate((e) => {
        const instruction = [...document.querySelectorAll(".lesson")].find(
          (n) => n.textContent.includes("② 仮説の確かめ方"),
        );
        return Boolean(
          instruction.compareDocumentPosition(e) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
      true,
    );
    await page.reload();
    await step(1);
    assert.equal(await page.locator(".brainstorm-note").count(), 4);
    await preset("block:brainstorm");
    assert.equal(await page.locator(".brainstorm-note").count(), 0);
    assert.equal(await page.locator("[data-card]").count(), 4);
    // Free mode starts with empty notes and activates transfer immediately on typing.
    await page.locator("#mode-free").click();
    await step(1);
    assert.equal(await page.locator(".brainstorm-note").count(), 0);
    await page.locator('[data-action="add-brainstorm"]').click();
    const first = page.locator('.brainstorm-note [data-bind$=".text"]').first();
    await first.fill("朝の準備を一緒に行ったらどうだろう");
    const firstId = (await first.getAttribute("data-bind")).split(".")[1];
    await page.locator('[data-action="extend-brainstorm"]').first().click();
    await page
      .locator('.brainstorm-note [data-bind$=".text"]')
      .last()
      .fill("前日に持ち物を並べておく");
    assert.ok(
      (await page.locator(".brainstorm-parent").textContent()).includes(
        "朝の準備",
      ),
    );
    assert.equal(
      await page
        .locator('[data-action="transfer-brainstorm"][data-id="all"]')
        .isEnabled(),
      true,
    );
    await page
      .locator('[data-action="transfer-brainstorm"][data-id="all"]')
      .click();
    assert.equal(await page.locator("[data-card]").count(), 2);
    await page
      .locator(`[data-action="delete-brainstorm"][data-id="${firstId}"]`)
      .click();
    assert.equal(await page.locator(".brainstorm-note").count(), 1);
    assert.equal(await page.locator(".brainstorm-parent").count(), 0);
    assert.equal(await page.locator("[data-card]").count(), 2);
    await page.reload();
    await step(1);
    assert.equal(await page.locator(".brainstorm-note").count(), 1);
    assert.equal(await page.locator("[data-card]").count(), 2);
    await page.locator("#mode-preset").click();
    await step(5);
    await preset("block:checks");
    assert.match(
      await page.locator(".tool-guide").textContent(),
      /チェックシート.*実施済み/,
    );
    assert.equal(
      await page
        .locator(".check-complete")
        .first()
        .getByText("実施済み", { exact: true })
        .isVisible(),
      true,
    );
    await page.locator('[data-bind="checks.ck-0.done"]').check();
    assert.match(
      await page.locator(".stage-outcome").textContent(),
      /1\/3件の作業が実施済み/,
    );
    for (let i = 0; i < 7; i++) {
      await step(i);
      assert.equal(await page.locator(".tool-guide").count(), 1);
      assert.match(
        await page.locator(".tool-guide").textContent(),
        /使い方.*整理できるもの/,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: brainstorm in both modes, immediate transfer, opinion/hypothesis provenance, development, deletion, resume and undo; concrete stage handoff, tool guides, upper-right presets and visible execution checks at mobile width",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
