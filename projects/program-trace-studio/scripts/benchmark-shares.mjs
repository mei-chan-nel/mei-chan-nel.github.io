import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { EXAMPLES, defaultParameters, sourceLines } from '../../../program-trace/examples.js';
import { encodeShare, decodeShare } from '../../../program-trace/studio/sharing.js';
import { defaultInput, validateDraft } from '../../../program-trace/studio/documents.js';
import { blankRow, builderSource, modelFromSource, newCommand } from '../../../program-trace/studio/builder-model.js';
const base = 'https://mei-chan-nel.com/program-trace/studio/';
const settings = { indexBase: 0, inputs: {} };
const cases = EXAMPLES.filter(example => example.number <= 15 && example.id !== 'factorial').map(example => {
  let source = sourceLines(example, defaultParameters(example)).map(row => row.text).join('\n');
  // Studio initializes a matrix explicitly before assigning cells.
  if (example.id === 'matrix') source = 'Kuku = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]\n' + source;
  const inputs = Object.fromEntries((example.inputs ?? []).map(field => [field.key, { ...defaultInput(), kind: field.type,
    min: field.min ?? -1000000, max: field.max ?? 1000000, minLength: field.minLength ?? 1, maxLength: field.maxLength ?? 100 }]));
  return { id: example.id, draft: { version: 1, title: example.title, source: builderSource(modelFromSource(source)), settings: { indexBase: example.id === 'matrix' ? 1 : 0, inputs } } };
});
const loop = newCommand('for'), condition = newCommand('if'); loop.body = [condition, blankRow()]; condition.body = [blankRow()];
const builder = { version: 1, nodes: [loop, blankRow()] };
// Reproducible UUID-shaped IDs provide a fair old-format draft comparison.
let row = 0;
const ids = nodes => nodes.forEach(node => { const hex = createHash('sha256').update(String(row++)).digest('hex').slice(0, 32);
  node.id = `row-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if ('body' in node) ids(node.body); if (node.kind === 'if' && node.otherwise) ids([node.otherwise]); }); ids(builder.nodes);
cases.push({ id: 'unfinished-nested-block', draft: { version: 1, title: '作成途中の入れ子', source: builderSource(builder), settings, builder } });
const rows = [];
for (const item of cases) {
  const draft = validateDraft(item.draft), legacy = new URL('share.html', base);
  legacy.hash = 'v1.' + gzipSync(Buffer.from(JSON.stringify(draft))).toString('base64url');
  const current = await encodeShare(draft, base), restored = await decodeShare(new URL(current).hash);
  if (restored.source !== draft.source || JSON.stringify(restored.settings) !== JSON.stringify(draft.settings)) {
    // Settings key order is normalized by the codec; compare sorted inputs.
    const sorted = value => JSON.stringify({ ...value, inputs: Object.fromEntries(Object.entries(value.inputs).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) });
    if (restored.source !== draft.source || sorted(restored.settings) !== sorted(draft.settings)) throw new Error(`Round-trip failed: ${item.id}`);
  }
  rows.push({ id: item.id, title: draft.title, lines: draft.source.split('\n').length,
    v1Characters: legacy.href.length, v2Characters: current.length, savedCharacters: legacy.href.length - current.length,
    reductionPercent: Math.round((1 - current.length / legacy.href.length) * 1000) / 10, format: new URL(current).hash.slice(1, 5) });
}
const representatives = rows.filter(row => row.id !== 'unfinished-nested-block'), oldTotal = representatives.reduce((sum, row) => sum + row.v1Characters, 0), newTotal = representatives.reduce((sum, row) => sum + row.v2Characters, 0);
console.log(JSON.stringify({ baseURL: base, comparison: 'Same canonical programs/settings; old v1 gzip JSON vs automatically shortest v2 packet. Recursion excluded, matrix explicitly initialized.',
  representativeCount: representatives.length, totalV1Characters: oldTotal, totalV2Characters: newTotal,
  representativeReductionPercent: Math.round((1 - newTotal / oldTotal) * 1000) / 10, cases: rows }, null, 2));
