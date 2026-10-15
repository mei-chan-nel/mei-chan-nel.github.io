// Reuse the learning app's public read-only RPC configuration. No answers or
// individual learning records are sent; only the published question IDs.
export function parseStatsConfig(source) {
  const url = /const supabaseProbeUrl = "([^"]+)"/.exec(source)?.[1];
  const key = /const supabasePublishableKey = "([^"]+)"/.exec(source)?.[1];
  if (!url || !key || !url.endsWith('/rest/v1/rpc/get_question_stats') || !url.startsWith('https://')) throw new Error('集計APIの設定を読み込めませんでした。');
  return { url, key };
}
export function normalizeStats(payload, ids) {
  if (!payload?.questions || typeof payload.questions !== 'object' || Array.isArray(payload.questions)) throw new Error('全体成績の形式が正しくありません。');
  const records = new Map();
  for (const id of ids) {
    const item = payload.questions[id];
    if (!item) continue;
    const attempts = Number(item.attempts), correct = Number(item.correct);
    if (!Number.isSafeInteger(attempts) || attempts < 0 || !Number.isSafeInteger(correct) || correct < 0 || correct > attempts) throw new Error('全体成績の数値が正しくありません。');
    if (attempts) records.set(id, { attempts, correct, rate: correct / attempts });
  }
  return records;
}
export async function loadQuestionStats(ids, configSource, { fetchImpl = fetch, signal, onProgress = () => {} } = {}) {
  const source = await fetchImpl(configSource, { cache: 'no-cache', signal });
  if (!source.ok) throw new Error('集計APIの設定を読み込めませんでした。');
  const config = parseStatsConfig(await source.text()), records = new Map();
  const batches = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
  let next = 0, completed = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      const response = await fetchImpl(config.url, { method: 'POST', signal,
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ids: batch }) });
      if (!response.ok) throw new Error(`全体成績の取得に失敗しました（HTTP ${response.status}）。`);
      for (const [id, record] of normalizeStats(await response.json(), batch)) records.set(id, record);
      onProgress(++completed, batches.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, batches.length) }, worker));
  return records;
}
