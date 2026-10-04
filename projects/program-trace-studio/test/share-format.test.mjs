import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { encodeShare, decodeShare } from '../../../program-trace/studio/sharing.js';
import { readSharePacket, sharePackets } from '../../../program-trace/studio/share-packet.js';
import { defaultInput, validateDraft } from '../../../program-trace/studio/documents.js';
import { blankRow, builderSource, modelFromDraft, modelFromSource, newCommand } from '../../../program-trace/studio/builder-model.js';
import { compile, initialState, step } from '../../../program-trace/studio/runtime.js';
import { LIMITS } from '../../../program-trace/studio/errors.js';
const base = 'https://mei-chan-nel.com/program-trace/studio/';
const draft = (source, settings = { indexBase: 0, inputs: {} }) => ({ version: 1, title: '共有テスト', source, settings });
const structured = source => { const model = modelFromSource(source); return draft(builderSource(model)); };
const withoutIds = value => JSON.parse(JSON.stringify(value, (key, item) => key === 'id' ? undefined : item));
const plainHash = value => '#v2.j.' + Buffer.from(JSON.stringify(value)).toString('base64url');
const legacyHash = value => '#v1.' + gzipSync(Buffer.from(JSON.stringify(value))).toString('base64url');
function execute(draft, values = {}) {
  const program = compile(draft.source); let state = initialState(program, 123);
  while (!state.completed) state = step(program, state, draft.settings, program.instructions[state.pc].kind === 'input' ? values[program.instructions[state.pc].name] : undefined);
  return { variables: state.variables, output: state.output, steps: state.steps, line: state.currentLine };
}

test('share v2 compact tuples have a stable command/expression contract and omit default settings', () => {
  const value = structured('x = 3\ny = 4\ngoukei = x + y\n表示する("合計は", goukei, "です。")');
  const packet = sharePackets(value).find(packet => Array.isArray(packet[1]));
  assert.deepEqual(packet, ['共有テスト', [[1, 'x', 3], [1, 'y', 4], [1, 'goukei', [4, 0, [0, 'x'], [0, 'y']]], [2, '合計は', [0, 'goukei'], 'です。']]]);
  assert.deepEqual(readSharePacket(packet), validateDraft(value));
  const age = readSharePacket(['年齢', [[3, 'age']], 0, [['age', 12, 0, 120]]]);
  assert.deepEqual(age.settings.inputs.age, { kind: 'number', integer: true, min: 0, max: 120, minLength: 1, maxLength: 100, elementKind: 'number', rows: 2, columns: 3 });
});

test('compact rows preserve matrix indexing, arithmetic, calls, loops, branches and comments', () => {
  const value = structured('# 最初のメモ\nData = [[1, 2], [3, 4]]\nsum = 0, flag = 真\ni を 0 から 1 まで 1 ずつ増やしながら繰り返す：\n  j を 0 から 要素数(Data[0]) - 1 まで 1 ずつ増やしながら繰り返す：\n    sum = sum + Data[i, j] # 加算\nもし sum == 10 and not 偽 ならば：\n  表示する("合計は", sum, "#｜⎿😀")\nそうでなくもし sum != 10 ならば：\n  表示する("異なる")\nそうでなければ：\n  表示する("else")\nk を 3 から 1 まで 2 ずつ減らしながら繰り返す：\n  表示する(k)\nsum &lt; 12 の間繰り返す：\n  sum = sum + 1\nr = 乱数(1, 6, "整数"), real = 乱数()\n表示する(Data, r, real)'.replaceAll('&lt;', '<'));
  const packet = sharePackets(value).find(packet => Array.isArray(packet[1])), restored = readSharePacket(packet);
  assert.equal(restored.source, value.source); assert.deepEqual(execute(restored), execute(value));
  for (const formula of ['+2', '-2', 'not 偽', '2 + 3', '2 - 3', '2 * 3', '2 / 3', '-7 ÷ 2', '-7 % 2', '2 ** 3', '2 == 3', '2 != 3', '2 < 3', '2 <= 3', '2 > 3', '2 >= 3', '真 and 偽', '偽 or 真']) {
    const sample = structured(`x = ${formula}\n表示する(x)`), packed = sharePackets(sample).find(packet => Array.isArray(packet[1]));
    assert.deepEqual(execute(readSharePacket(packed)), execute(sample), formula);
  }
});

test('all nine input fields and both indexing bases round trip through the default-difference bitmask', async () => {
  const inputs = {
    age: { ...defaultInput(), integer: false, min: 0.5, max: 120.5 },
    Text: { ...defaultInput(), kind: 'text', min: 3, max: 99, rows: 1, columns: 1 },
    Array: { ...defaultInput(), kind: 'array', elementKind: 'text', minLength: 2, maxLength: 4 },
    Matrix: { ...defaultInput(), kind: 'matrix', integer: false, min: -7.5, max: 20, rows: 3, columns: 4 },
  };
  for (const indexBase of [0, 1]) {
    const value = draft('age = 【外部からの入力】\nText = 【外部からの入力】\nArray = 【外部からの入力】\nMatrix = 【外部からの入力】\n表示する(age, Text, Array, Matrix)', { indexBase, inputs });
    const url = await encodeShare(value, base), restored = await decodeShare(new URL(url).hash);
    assert.deepEqual(restored.settings, validateDraft(value).settings);
    assert.deepEqual(execute(restored, { age: 18.5, Text: 'あ', Array: ['い', 'う'], Matrix: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]] }), execute(value, { age: 18.5, Text: 'あ', Array: ['い', 'う'], Matrix: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]] }));
  }
});

test('unfinished row nesting and blank/comment rows survive sharing without leaking IDs or expression columns', async () => {
  const loop = newCommand('for'), condition = newCommand('if'), memo = newCommand('comment'); memo.text = '空白の内側を保つ';
  loop.body = [condition, blankRow()]; condition.body = [memo, blankRow()];
  condition.otherwise = { kind: 'else', id: 'private-id-else', comment: '', body: [] };
  const builder = { version: 1, nodes: [blankRow(), loop, blankRow()] }, value = { ...draft(builderSource(builder)), builder };
  const packet = sharePackets(value)[0], text = JSON.stringify(packet), url = await encodeShare(value, base), restored = await decodeShare(new URL(url).hash);
  assert.doesNotMatch(text, /row-|private-id-else|column|body|otherwise/u);
  assert.equal(restored.source, value.source); assert.deepEqual(withoutIds(modelFromDraft(restored)), withoutIds(modelFromDraft(value)));
  assert.notEqual(restored.builder.nodes[0].id, builder.nodes[0].id);
  const same = structuredClone(value); same.builder.nodes[0].id = 'different-private-id';
  assert.equal(await encodeShare(same, base), url);
});

test('legacy v1 URLs keep exact source, settings and unfinished rows, and can be reshared as v2', async () => {
  const value = draft('（01）名前 = "めい#ちゃん"\n（02）もし 真 ならば：\n（03）⎿ 表示する(名前)', { indexBase: 1, inputs: {} });
  const restored = await decodeShare(legacyHash(value)); assert.deepEqual(restored, validateDraft(value));
  const url = await encodeShare(restored, base); assert.match(new URL(url).hash, /^#v2\.[dj]\./u);
  assert.deepEqual(await decodeShare(new URL(url).hash), validateDraft(value));
  const builder = { version: 1, nodes: [newCommand('while')] }, incomplete = { ...draft(builderSource(builder)), builder };
  assert.deepEqual(await decodeShare(legacyHash(incomplete)), validateDraft(incomplete));
});

test('v2 chooses the shortest source/row and compressed/plain candidates and normalizes the entry URL', async () => {
  const value = draft('x = 1'), url = new URL(await encodeShare(value, base + 'share.html?from=private#old'));
  assert.equal(url.pathname, '/program-trace/studio/share.html'); assert.equal(url.search, ''); assert.match(url.hash, /^#v2\.j\./u);
  const bytes = sharePackets(value).map(packet => Buffer.from(JSON.stringify(packet)));
  const lengths = bytes.flatMap(raw => [raw.toString('base64url').length, deflateSync(raw).toString('base64url').length]);
  assert.equal(url.hash.length, '#v2.j.'.length + Math.min(...lengths));
  const repeated = draft('表示する("' + '繰り返す文章'.repeat(100) + '")');
  assert.match(new URL(await encodeShare(repeated, base)).hash, /^#v2\.d\./u);
});

test('sharing stays smaller than legacy v1 for complete programs and unfinished drafts', async () => {
  const loop = newCommand('for'); loop.body = [blankRow()];
  const builder = { version: 1, nodes: [loop] };
  const cases = [structured('x = 3\ny = 4\ngoukei = x + y\n表示する("合計は", goukei, "です。")'),
    structured('Data = [[1, 2], [3, 4]]\nsum = 0\ni を 0 から 1 まで 1 ずつ増やしながら繰り返す：\n  j を 0 から 1 まで 1 ずつ増やしながら繰り返す：\n    sum = sum + Data[i, j]\n表示する(sum)'),
    { ...draft(builderSource(builder)), builder }];
  for (const sample of cases) {
    const old = new URL('share.html', base); old.hash = legacyHash(validateDraft(sample));
    const current = await encodeShare(sample, base); assert.ok(current.length < old.href.length * 0.8, `${current.length} / ${old.href.length}`);
    const restored = await decodeShare(new URL(current).hash); assert.equal(restored.source, sample.source);
  }
});

test('uncompressed v2 works without browser compression APIs, compressed legacy/new links show a file fallback', async () => {
  const compression = globalThis.CompressionStream, decompression = globalThis.DecompressionStream;
  globalThis.CompressionStream = undefined; globalThis.DecompressionStream = undefined;
  try {
    const value = draft('x = 1'), url = await encodeShare(value, base);
    assert.match(new URL(url).hash, /^#v2\.j\./u); assert.deepEqual(await decodeShare(new URL(url).hash), validateDraft(value));
    await assert.rejects(decodeShare(legacyHash(value)), /ファイル/u);
    await assert.rejects(decodeShare('#v2.d.' + deflateSync(Buffer.from(JSON.stringify(sharePackets(value)[0]))).toString('base64url')), /ファイル/u);
  } finally { globalThis.CompressionStream = compression; globalThis.DecompressionStream = decompression; }
});

test('v2 rejects unknown commands/functions, invalid masks, extra fields, unsafe names, oversized and too-deep data', async () => {
  const bad = [null, {}, [], ['題', [], 2], ['題', [[99]]], ['題', [[1, '__proto__', 1]]], ['題', [[2, [5, 'eval', '1']]]], ['題', [[4, true, [], [2, 'orphan']]]], ['題', [[5, []]]], ['題', [[1, 'x', [4, 99, 1, 2]]]], ['題', [], 0, [['age', 512]]], ['題', [], 0, [['age', 4]]], ['題', [], 0, [['age', 0, 1]]], ['題', [], 0, [['age', 0], ['age', 0]]], ['題', [], 0, [['constructor', 0]]], ['題', [[2, 'x', { c: 'memo', unknown: true }]]], ['題', 'eval(1)'], ['題', [[6, 'i', 1, 5, [], [1, 0]]]]];
  let nested = [2, 'done']; for (let i = 0; i < LIMITS.depth + 2; i++) nested = [7, true, [nested]];
  bad.push(['題', [nested]], ['題', Array.from({ length: LIMITS.lines + 1 }, () => [0])]);
  for (const value of bad) await assert.rejects(decodeShare(plainHash(value)), undefined, JSON.stringify(value).slice(0, 80));
  for (const value of ['', '#v2.x.abc', '#v2.j.a', '#v2.j.%%%', '#v3.j.abc', '#v2.d.eA', '#v2.j.' + 'a'.repeat(LIMITS.urlCharacters + 1)]) await assert.rejects(decodeShare(value));
  const bomb = deflateSync(Buffer.from('x'.repeat(LIMITS.shareBytes + 1))).toString('base64url');
  await assert.rejects(decodeShare('#v2.d.' + bomb), /大きすぎ/u);
  await assert.rejects(decodeShare('#v2.j.' + Buffer.from('x'.repeat(LIMITS.shareBytes + 1)).toString('base64url')));
});

test('v2 rejects truncated, modified and noncanonical base64, invalid UTF-8 and an unshareable payload', async () => {
  const good = new URL(await encodeShare(draft('表示する("' + '文章'.repeat(100) + '")'), base)).hash;
  await assert.rejects(decodeShare(good.slice(0, -4)));
  const token = good.split('.').at(-1), bytes = Buffer.from(token, 'base64url'); bytes[Math.floor(bytes.length / 2)] ^= 1;
  await assert.rejects(decodeShare('#v2.d.' + bytes.toString('base64url')));
  await assert.rejects(decodeShare('#v2.j.eB'), /正しく/u);
  await assert.rejects(decodeShare('#v2.j.' + Buffer.from([0xff, 0xfe]).toString('base64url')));
  const inputs = { ['a'.repeat(LIMITS.shareBytes)]: defaultInput() };
  await assert.rejects(encodeShare(draft('x = 1', { indexBase: 0, inputs }), base), /大きすぎ/u);
});

test('new and legacy share URLs always target the single statically noindex page excluded from sitemaps', async () => {
  const portal = new URL('../../../', import.meta.url), page = await readFile(new URL('program-trace/studio/share.html', portal), 'utf8');
  assert.equal((page.match(/<meta name="robots"/gu) ?? []).length, 1); assert.match(page, /name="robots" content="noindex, follow"/u);
  const sitemap = await readFile(new URL('sitemap.xml', portal), 'utf8'); assert.doesNotMatch(sitemap, /studio\/share\.html|#v[12]/u);
  assert.match(page, /id="to-editor"/u);
  const robots = await readFile(new URL('robots.txt', portal), 'utf8'); assert.doesNotMatch(robots, /Disallow:\s*(?:\/program-trace|\/\s*$)/mu);
});
