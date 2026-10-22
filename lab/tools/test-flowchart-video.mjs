import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DRAFT_KEY } from "../flowchart/documents.mjs";
import { exampleDocument } from "../flowchart/examples.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright"),
  base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773",
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
const errors = [],
  own = exampleDocument("sum"),
  stored = JSON.stringify({
    document: own,
    id: null,
    baseline: JSON.stringify(own),
  });
async function context(width) {
  const c = await browser.newContext({
    viewport: { width, height: 1000 },
    hasTouch: width < 400,
    isMobile: width < 400,
  });
  await c.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort(),
  );
  const p = await c.newPage();
  p.on("pageerror", (error) => errors.push(error.message));
  await p.goto(base + "/archive/programming-variables-arrays.html#q-231");
  await p.locator("#q-231").waitFor();
  await p.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: DRAFT_KEY,
    value: stored,
  });
  return { c, p };
}
async function origin(p, page, width) {
  await p.goto(`${base}/archive/${page}.html#q-231`);
  const card = p.locator("#q-231"),
    links = card.locator(".video-action-row a");
  assert.equal(await links.nth(0).textContent(), "1行ずつ実行する");
  assert.equal(await links.nth(1).textContent(), "フローチャートで表示する");
  if (width < 400) await links.nth(1).tap();
  else await links.nth(1).click();
  await p.locator("#run-actions").waitFor({ state: "visible" });
  assert.ok(new URL(p.url()).pathname.endsWith("/lab/flowchart/"));
  assert.ok((await p.locator("#flow-nodes").textContent()).includes("goukei"));
  assert.equal(
    await p.locator("#return-to-question").getAttribute("href"),
    `../../archive/${page}.html#q-231`,
  );
  assert.equal(
    await p.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
    stored,
  );
  assert.ok(await p.locator("#restore-own-circuit").isVisible());
  for (let i = 0; i < 5; i++) await p.locator("#next-button").click();
  assert.equal(await p.locator("#output-lines").textContent(), "合計は7です。");
  assert.ok(await p.locator("#return-to-question").isVisible());
  if (width < 400) await p.locator("#return-to-question").tap();
  else await p.locator("#return-to-question").click();
  await p.waitForURL(`${base}/archive/${page}.html#q-231`);
  assert.equal(
    await p.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
    stored,
  );
  await p.waitForFunction(() => {
    const rect = document.getElementById("q-231").getBoundingClientRect();
    return rect.top < innerHeight && rect.bottom > 0;
  });
}
try {
  for (const width of [1280, 390, 320]) {
    const { c, p } = await context(width);
    await origin(p, "programming-variables-arrays", width);
    await origin(p, "programming-shortest-course", width);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await c.close();
    console.log(
      `PASS ${width}px: direct execution from genre/course, exact question return and original draft protection`,
    );
  }
  const { c, p } = await context(1280);
  await p.goto(
    `${base}/lab/flowchart/?from=programming-shortest-course&question=video-q-231#run`,
  );
  await p.locator("#run-actions").waitFor({ state: "visible" });
  await p.locator("#edit-button").click();
  await p.locator("#fit-circuit").click();
  const body = p.locator('[data-id="n2"] .flow-node-body');
  await body.click();
  await body.click();
  await p.locator("#node-code").fill("x = 9");
  await p.locator('#node-form button[type="submit"]').click();
  assert.equal(new URL(p.url()).hash, "");
  const edited = await p.evaluate(
    (key) => localStorage.getItem(key),
    DRAFT_KEY,
  );
  await p.reload();
  await p.locator("#return-to-question").waitFor({ state: "visible" });
  assert.equal(
    await p.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
    edited,
  );
  assert.match(await p.locator("#flow-nodes").textContent(), /x ← 9/);
  assert.equal(
    await p.locator("#return-to-question").getAttribute("href"),
    "../../archive/programming-shortest-course.html#q-231",
  );
  for (const number of [307, 308, 328]) {
    await p.goto(
      `${base}/lab/flowchart/?from=programming-shortest-course&question=video-q-${number}#run`,
    );
    await p.locator("#trace-fallback").waitFor({ state: "visible" });
    assert.equal(await p.locator(".flowchart-lab").isVisible(), false);
    assert.match(
      await p.locator("#flow-video-message").textContent(),
      /変換できません|実行できません/,
    );
    assert.ok(
      (await p.locator("#return-to-question").getAttribute("href")).endsWith(
        `#q-${number}`,
      ),
    );
    assert.ok(
      (await p.locator("#trace-fallback").getAttribute("href")).endsWith(
        `#video-q-${number}`,
      ),
    );
    assert.equal(
      await p.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
      edited,
    );
  }
  await p.goto(
    `${base}/program-trace/run.html?from=programming-shortest-course#video-q-231`,
  );
  await p.locator("#runner-view").waitFor({ state: "visible" });
  await p.locator("#flowchart-button").click();
  await p.locator("#flowchart-conversion-heading").waitFor();
  const link = p.getByRole("link", { name: "フローチャートで開く →" });
  await link.waitFor({ state: "visible" });
  const target = new URL(await link.getAttribute("href"));
  assert.equal(target.searchParams.get("question"), "video-q-231");
  assert.equal(target.searchParams.get("from"), "programming-shortest-course");
  await link.click();
  await p.locator("#return-to-question").waitFor({ state: "visible" });
  assert.equal(
    await p.locator("#return-to-question").getAttribute("href"),
    "../../archive/programming-shortest-course.html#q-231",
  );
  await p.locator("#prepare-run").click();
  assert.ok(await p.locator("#return-to-question").isVisible());
  await c.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS edited reload, unsupported commands, no draft overwrite and trace-to-flowchart origin propagation",
  );
} finally {
  await browser.close();
}
