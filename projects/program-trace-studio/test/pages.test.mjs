import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseDocument } from '../../../program-trace/studio/documents.js';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
const portal = new URL('../../../', import.meta.url);
test('library has the three requested collections, original 15 cards, closed videos and a small Studio link', async () => {
  const page = await readFile(new URL('program-trace/index.html', portal), 'utf8');
  const studio = page.indexOf('自分でプログラムを書いて実行する。'), examples = page.indexOf('代表的なプログラムを1行ずつ実行する。'), videos = page.indexOf('id="video-collection"');
  assert.ok(studio > 0 && studio < examples && examples < videos); assert.ok(page.includes('href="./studio/"'));
  assert.equal((page.match(/<a class="example-card"/gu) ?? []).length, 15);
  assert.match(page, /<details id="video-collection"[^>]*>/u); assert.doesNotMatch(page.match(/<details id="video-collection"[^>]*>/u)[0], /\bopen\b/u);
  assert.doesNotMatch(page, /src="\.\/studio\//u);
});
test('Studio shares are noindex before scripts, editor/guide are indexable, with common shell and correct static paths', async () => {
  for (const name of ['index.html', 'share.html', 'guide.html']) {
    const page = await readFile(new URL(`program-trace/studio/${name}`, portal), 'utf8');
    assert.equal((page.match(/class="site-header"/gu) ?? []).length, 1); assert.equal((page.match(/class="site-footer"/gu) ?? []).length, 1);
    assert.match(page, /src="\.\.\/\.\.\/assets\/site-header\.js[^>]+ defer/u);
    assert.match(page, /data-manual-ad="display"/u); assert.equal((page.match(/<h1\b/gu) ?? []).length, 1);
    assert.match(page, new RegExp(`name="robots" content="${name === 'share.html' ? 'noindex' : 'index'}, follow"`, 'u'));
    assert.doesNotMatch(page, /%%[A-Z]+%%/u);
  }
  const sitemap = await readFile(new URL('sitemap.xml', portal), 'utf8'); assert.ok(sitemap.includes('https://mei-chan-nel.com/program-trace/studio/')); assert.ok(!sitemap.includes('/studio/share.html'));
  const header = await readFile(new URL('assets/site-header.js', portal), 'utf8'); assert.match(header, /page_location: window\.location\.href\.split\("#"\)\[0\]/u);
});
test('Studio runtime has no eval, Function construction, network save API or original example-data dependency', async () => {
  const directory = new URL('program-trace/studio/', portal);
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.js'))) {
    const source = await readFile(new URL(name, directory), 'utf8');
    assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(|\bfetch\s*\(|\bXMLHttpRequest\b/u, name);
    assert.doesNotMatch(source, /(?:video-program-data|\.\.\/interpreter|\.\.\/examples)\.js/u, name);
  }
});

test('human-readable file specification examples import and execute with their documented input settings', async () => {
  const fibonacci = parseDocument(await readFile(new URL('program-trace/studio/examples/fibonacci.studio.json', portal), 'utf8'));
  const fibonacciOutput = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34].map((value, index) => `F(${index}) = ${value}`);
  for (const name of ['index.html', 'share.html']) {
    const page = await readFile(new URL(`program-trace/studio/${name}`, portal), 'utf8');
    const examples = [...page.matchAll(/<code class="file-spec-example">([\s\S]*?)<\/code>/gu)]
      .map(match => parseDocument(match[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')));
    assert.equal(examples.length, 3);
    const recursive = examples.find(draft => draft.title === fibonacci.title), inputExample = examples.find(draft => draft.title === '年齢で分岐する');
    assert.deepEqual(recursive, fibonacci, 'the downloadable file matches the displayed JSON');
    for (const [draft, input, expected] of [[examples[0], undefined, ['合計は7です。']], [inputExample, 17, ['未成年です。']], [inputExample, 18, ['成人です。']], [recursive, undefined, fibonacciOutput]]) {
      const program = compile(draft.source); let state = initialState(program);
      while (!state.completed) state = step(program, state, draft.settings, program.instructions[state.pc].kind === 'input' ? input : undefined);
      assert.deepEqual(state.output, expected);
    }
  }
  const schema = JSON.parse(await readFile(new URL('program-trace/studio/ai-guide.json', portal), 'utf8'));
  assert.deepEqual(parseDocument(JSON.stringify(schema.examples.find(draft => draft.title === fibonacci.title))), fibonacci);
  const markdown = await readFile(new URL('program-trace/studio/ai-guide.md', portal), 'utf8');
  const documents = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/gu)].map(match => JSON.parse(match[1])).filter(value => value.format === 'mei-program-studio');
  assert.equal(documents.length, 4);
  for (const value of documents) {
    const draft = parseDocument(JSON.stringify(value));
    assert.deepEqual(draft, parseDocument(JSON.stringify(schema.examples.find(example => example.title === draft.title))));
  }
});
