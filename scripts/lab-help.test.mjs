import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { contents } from "../lab/catalog.mjs";
import { labs } from "../lab/statistics/catalog.mjs";
import { pageKey, composePrompt, validateGuide, chatGPTUrl, launchPlan, MAX_URL_LENGTH } from "../lab/help/prompt.mjs";
const base = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, base), "utf8");
const json = async path => JSON.parse(await read(`lab/help/data/${path}`));
const manifest = await json("manifest.json"), common = await json("common.json");

test("catalog coverage includes all 15 labs, 8 children and the project", () => {
  const expected = [...contents.map(c => c.id), ...labs.map(([id]) => `statistics/${id}`), "statistics/projects"];
  assert.equal(contents.length, 15);
  assert.equal(labs.length, 8);
  assert.deepEqual(Object.keys(manifest.pages).sort(), expected.sort());
});
for (const [id, paths] of Object.entries(manifest.pages)) {
  test(`${id}: standalone factual prompt and shared page assets`, async () => {
    const guides = await Promise.all(paths.map(json));
    for (const guide of guides) {
      validateGuide(guide);
      for (const source of guide.review.sources) assert.ok((await read(source)).length);
    }
    assert.equal(guides.at(-1).id, id);
    if (id.startsWith("statistics/")) assert.equal(guides[0].id, "statistics");
    const prompt = composePrompt(common, guides);
    assert.equal(prompt.split(common.instructions).length, 2);
    assert.ok(prompt.includes(guides.at(-1).firstSteps[0]));
    if (guides.length > 1) assert.ok(!prompt.includes(guides[0].firstSteps[0]));
    assert.ok(prompt.includes(`https://mei-chan-nel.com/lab/${id}/`));
    assert.ok(!prompt.includes("sourceCommit"));
    assert.ok(!prompt.includes("[object Object]"));
    assert.equal(new URL(chatGPTUrl(prompt)).searchParams.get("q"), prompt);
    assert.ok(chatGPTUrl(prompt).length <= MAX_URL_LENGTH, `${id}: needs editorial shortening`);
    const html = await read(`lab/${id}/index.html`);
    assert.equal([...html.matchAll(/help\/launcher\.mjs/g)].length, 1);
    assert.equal([...html.matchAll(/help\/help\.css/g)].length, 1);
  });
}
test("route resolution accepts canonical, slashless and index.html URLs only within lab root", () => {
  for (const suffix of ["", "/", "/index.html"]) assert.equal(pageKey(`/lab/statistics/sampling${suffix}`), "statistics/sampling");
  assert.equal(pageKey("/labyrinth/sampling/"), null);
  assert.equal(pageKey("/prefix/lab/cpu-memory/", "/prefix/lab/"), "cpu-memory");
});
test("Japanese, emoji, newlines and reserved URL characters round-trip", () => {
  const prompt = '日本語\nA&B = 1 + 2 ? # / %「質問」😀';
  assert.equal(new URL(chatGPTUrl(prompt)).searchParams.get("q"), prompt);
  assert.equal(new URL(chatGPTUrl(prompt)).hash, "");
});
test("oversized prompts use copy without silently truncating", () => {
  const prompt = "あ".repeat(3000), plan = launchPlan(prompt);
  assert.ok(plan.needsCopy);
  assert.equal(plan.url, "https://chatgpt.com/");
  assert.equal(prompt.length, 3000);
});
test("bad guide data is rejected instead of sending broken instructions", async () => {
  const guide = await json("cpu-memory.json");
  assert.throws(() => validateGuide({ ...guide, controls: [] }));
  assert.throws(() => validateGuide({ ...guide, id: "../secret" }));
  assert.throws(() => validateGuide({ ...guide, id: undefined }));
  assert.throws(() => validateGuide({ ...guide, name: " " }));
  assert.throws(() => composePrompt({}, [guide]));
});
test("initial guide facts agree with the underlying models", async () => {
  const { presets } = await import("../lab/cpu-memory/presets.mjs");
  assert.equal(presets[0].name, "基本の加算");
  assert.equal(presets[0].memory[16].arg + presets[0].memory[17].arg, 12);
  const { METHODS } = await import("../lab/statistics/missing-values/model.mjs");
  assert.ok(METHODS.some(([, name]) => name === "平均値で補完"));
  const { guideDefaults, testStages } = await import("../lab/statistics/hypothesis-test/guide.mjs");
  assert.equal(testStages.length, 8);
  assert.equal(guideDefaults.reference, 0.5);
  assert.equal(guideDefaults.direction, "two-sided");
});
