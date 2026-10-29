import { readFile, writeFile } from 'node:fs/promises';
import { composePrompt, chatGPTUrl } from '../help/prompt.mjs';
const json=async path=>JSON.parse(await readFile(new URL(`../help/data/${path}`,import.meta.url),'utf8'));
const common=await json('common.json'),manifest=await json('manifest.json');
const blocks=['# ChatGPTへ渡す質問文（生成例）','このファイルは `node lab/tools/export-help-prompts.mjs` で案内JSONから再生成します。利用者の値や履歴を含まない実際の生成文です。実際のChatGPTの回答記録ではありません。','実対話の確認では各文を新しい会話に送信し、①初回が目的と1〜3操作に収まる、②画面にある名称だけを使う、③現在の状態を断定しない、を確認してください。続けて「その操作をもう少し詳しく」「次に何を比べればよいですか」「この結果から何が分かりますか」と尋ね、手順・教材の特徴・解釈上の注意が維持されるか記録します。結果の数値を渡していない場面では、数値を推測せず必要な情報を尋ねることも確認します。'];
for(const [id,files] of Object.entries(manifest.pages)){
 const guides=await Promise.all(files.map(json)),prompt=composePrompt(common,guides);
 blocks.push(`## ${guides.at(-1).name} (${id})`, `${prompt.length}文字 / URLエンコード後 ${chatGPTUrl(prompt).length}文字`, '```text\n'+prompt+'\n```');
}
const path=new URL('../../docs/LAB_CHATGPT_PROMPTS.md',import.meta.url);
await writeFile(path,blocks.join('\n\n')+'\n');
console.log(`Exported ${Object.keys(manifest.pages).length} prompts`);
