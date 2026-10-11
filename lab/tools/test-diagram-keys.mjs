// Actual OS clipboard shortcuts, pointer selection, history and text editing.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.LAB_BASE_URL || "http://127.0.0.1:8773";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [];
const configs = [
  {
    id: "logic-circuit",
    node: ".circuit-node",
    body: ".node-body",
    selected: ".node-selected",
    type: "and",
    draft: "interactive-lab:logic-circuit:v1",
  },
  {
    id: "flowchart",
    node: ".flow-node",
    body: ".flow-node-body",
    selected: ".flow-node.is-selected",
    type: "process",
    draft: "mei-interactive-flowchart:v1:draft",
  },
];
async function select(p, config, id) {
  const node = p.locator(`${config.node}[data-id="${id}"]`);
  await node.locator(config.body).click();
  if (await p.locator("#node-dialog[open]").count())
    await p.keyboard.press("Escape");
  // Pointer selection often leaves focus on the body or a toolbar button.
  await p.evaluate(() => {
    document.activeElement.blur();
  });
  assert.equal(await p.locator(config.selected).count(), 1);
}
async function counts(p, config) {
  return {
    nodes: await p.locator(config.node).count(),
    edges: await p.locator("[data-edge]").count(),
  };
}
async function readGraph(p, config) {
  return p.evaluate(({ id, draft }) => {
    const value = JSON.parse(localStorage.getItem(draft));
    return id === "flowchart" ? value.document.graph : value.circuit;
  }, config);
}
try {
  for (const config of configs) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
      }),
      p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${base}/lab/${config.id}/`);
    await p.locator(config.node).first().waitFor();
    const id = await p
        .locator(`${config.node}[data-type="${config.type}"]`)
        .first()
        .getAttribute("data-id"),
      original = await counts(p, config);
    await select(p, config, id);
    await p.keyboard.press("Delete");
    assert.equal(await p.locator(config.node).count(), original.nodes - 1);
    await p.keyboard.press("Control+z");
    assert.deepEqual(await counts(p, config), original);
    await p.keyboard.press("Control+Shift+z");
    assert.equal(await p.locator(config.node).count(), original.nodes - 1);
    await p.keyboard.press("Control+z");

    await select(p, config, id);
    await p.keyboard.press("Control+c");
    assert.match(await p.locator("#circuit-message").textContent(), /コピー/);
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(config.selected).count(), 0);
    await p.keyboard.press("Delete");
    assert.deepEqual(await counts(p, config), original);
    await p.keyboard.press("Control+v");
    assert.equal(await p.locator(config.node).count(), original.nodes + 1);
    assert.equal((await counts(p, config)).edges, original.edges);
    assert.equal(await p.locator(config.selected).count(), 1);
    const firstGraph = await readGraph(p, config),
      first = firstGraph.nodes.at(-1);
    assert.notEqual(first.id, id);
    await p.keyboard.press("Control+v");
    const second = (await readGraph(p, config)).nodes.at(-1);
    assert.notEqual(second.id, first.id);
    assert.equal(second.x, first.x + 32);
    assert.equal(second.y, first.y + 32);
    await p.keyboard.press("Control+z");
    assert.equal(await p.locator(config.node).count(), original.nodes + 1);

    // Pasting in a text field is text editing, even with a selected diagram.
    await select(p, config, first.id);
    await p.keyboard.press("Control+c");
    await p.locator("#save-circuit").click();
    await p.locator("#save-name").focus();
    await p.keyboard.press("Control+a");
    await p.keyboard.press("Control+v");
    assert.match(
      await p.locator("#save-name").inputValue(),
      /interactive-lab-diagram-clipboard/,
    );
    await p.keyboard.press("Control+a");
    await p.keyboard.press("Delete");
    assert.equal(await p.locator("#save-name").inputValue(), "");
    assert.equal(await p.locator(config.node).count(), original.nodes + 1);
    await p.locator("#save-name").fill("普通のテキスト");
    await p.keyboard.press("Control+a");
    await p.keyboard.press("Control+c");
    await p.keyboard.press("Escape");
    await p.evaluate(() => {
      document.activeElement.blur();
    });
    await p.keyboard.press("Control+v");
    assert.equal(
      await p.locator(config.node).count(),
      original.nodes + 1,
      "do not paste a stale diagram clipboard",
    );

    // Contenteditable and browser-selected page text also keep native copy.
    await p.evaluate(() => {
      const input = document.createElement("div");
      input.id = "editable-test";
      input.contentEditable = "true";
      input.textContent = "文字を編集";
      document.body.append(input);
      input.focus();
    });
    await p.keyboard.press("Control+a");
    await p.keyboard.press("Delete");
    await p.keyboard.type("native text");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(config.node).count(), original.nodes + 1);
    assert.equal(await p.locator(config.selected).count(), 1);
    await p.keyboard.press("Control+a");
    await p.keyboard.press("Control+c");
    await p.evaluate(() => {
      document.getElementById("editable-test").remove();
      getSelection().removeAllRanges();
    });
    await p.keyboard.press("Control+v");
    assert.equal(await p.locator(config.node).count(), original.nodes + 1);

    // Delete applies to a selected wire as well and remains undoable.
    const edge = p.locator("[data-edge]").first();
    await edge.focus();
    await p.keyboard.press("Enter");
    await p.evaluate(() => {
      document.activeElement.blur();
    });
    await p.keyboard.press("Delete");
    assert.equal((await counts(p, config)).edges, original.edges - 1);
    await p.keyboard.press("Control+z");
    assert.equal((await counts(p, config)).edges, original.edges);
    // Ctrl and Mac Command use the same undo guard; native copy/paste events
    // themselves are independent of the platform's modifier key.
    await select(p, config, first.id);
    await p.keyboard.press("Delete");
    await p.keyboard.press("Meta+z");
    assert.equal(await p.locator(config.node).count(), original.nodes + 1);

    if (config.id === "flowchart") {
      await p.locator('[data-part="loopStart"]').click();
      await p.keyboard.press("Escape");
      await p.locator("#fit-circuit").click();
      const loop = (await readGraph(p, config)).nodes.at(-1);
      await select(p, config, loop.id);
      const beforeLoop = await counts(p, config);
      await p.keyboard.press("Control+c");
      await p.keyboard.press("Control+v");
      assert.equal(await p.locator(config.node).count(), beforeLoop.nodes + 2);
      const result = await readGraph(p, config),
        end = result.nodes.at(-1),
        start = result.nodes.at(-2);
      assert.equal(end.pair, start.id);
      assert.equal(start.pair, end.id);
      await p.keyboard.press("Control+z");
      assert.deepEqual(await counts(p, config), beforeLoop);
      // Run mode refuses deletion and diagram pastes.
      await p.reload();
      // Reload has intentionally incomplete edits; use a fresh example.
      await p.locator("#load-circuit").click();
      await p.locator('[data-example="decision"]').click();
      await p.locator('#confirm-form button[type="submit"]').click();
      await select(p, config, "n2");
      await p.keyboard.press("Control+c");
      await p.locator("#prepare-run").click();
      const running = await counts(p, config);
      await p.keyboard.press("Delete");
      await p.keyboard.press("Control+v");
      assert.deepEqual(await counts(p, config), running);
    }
    await context.close();
    console.log(
      `${config.id}: native shortcuts, text protection, history and clipboard passed`,
    );
  }
  // Embedded standalone HTML works without module requests or browser storage.
  for (const config of configs) {
    const p = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
    });
    p.on("pageerror", (e) => errors.push(e.message));
    const requests = [];
    p.on("request", (r) => requests.push(r.url()));
    await p.setContent(
      await readFile(
        `/workspace/interactive-lab-review/Interactive-Lab-${config.id}.html`,
        "utf8",
      ),
    );
    const id = await p
        .locator(`${config.node}[data-type="${config.type}"]`)
        .first()
        .getAttribute("data-id"),
      before = await counts(p, config);
    await select(p, config, id);
    await p.keyboard.press("Control+c");
    await p.keyboard.press("Control+v");
    assert.equal(await p.locator(config.node).count(), before.nodes + 1);
    await p.keyboard.press("Delete");
    assert.deepEqual(await counts(p, config), before);
    await p.keyboard.press("Escape");
    assert.equal(await p.locator(config.selected).count(), 0);
    assert.deepEqual(requests, []);
    await p.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Standalone clipboard/keyboard checks passed with no external requests or browser errors",
  );
} finally {
  await browser.close();
}
