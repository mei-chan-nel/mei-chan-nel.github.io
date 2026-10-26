# Interactive Lab「ChatGPTに聞く」

全15ラボと統計の8子コンテンツ、横断分析課題で使う共通部品です。公開ページにボタンを1個だけ表示します。利用者が押すと、教材の固定された案内情報を組み立て、新しいタブでChatGPTを開きます。利用者の現在の値・入力・履歴・保存内容・URLのクエリやハッシュを読み取りません。

## 構成

|ファイル|役割|
|---|---|
|`help.css`|ボタン・クリック後の復旧UI。PCはタイトル右上の空間を確保し、760px以下はタイトルの下に配置|
|`launcher.mjs`|事前読込、クリック時の別タブ確保、タイムアウト、再試行、コピー|
|`prompt.mjs`|DOM非依存のデータ検証・階層統合・URL生成|
|`data/common.json`|全教材で同一の役割・初回回答・段階的対話の指示|
|`data/manifest.json`|ページの相対パスと案内JSONの対応|
|`data/<lab>.json`|ラボ固有の目的・初期状態・操作・体験・結果・注意|
|`data/statistics.json`|統計ラボ共通情報|
|`data/statistics/<child>.json`|統計子コンテンツ固有情報|

案内JSONは `schemaVersion: 1`、`id`、`name`、文字列配列の `purpose`、`initialState`、`controls`、`firstSteps`、`experiments`、`results`、`cautions` を必須とします。`review` は確認したコミット・ソースを記録する保守用情報で、送信文には入りません。URLは検証済みのIDから公開サイトのURLとして組み立てます。

統計の子ページでは共通指示→統計共通情報→子の情報を合成します。最初の手順とおすすめは子のものを優先するため、別の子ラボを開くような親の案内が混ざりません。ほかの項目は親→子の順にまとめ、同じ文は1回だけ出します。初期状態と現在の状態を区別し、作業を消すリセットを初手として勧めません。

## 連携方式と復旧

既存の問題演習と同じ `https://chatgpt.com/?q=` + `encodeURIComponent(prompt)` を使用します。外部URLはクリック時だけ生成し、解析が拾う常設リンクに質問文を入れません。別タブの `opener` を切断し、参照元のURLも送らない設定にします。

このURL方式の受信・自動送信はChatGPTの保証されたAPIとして扱いません。利用者の認証状態・端末・サービス側の変更によって質問文が渡らないことがあります。別タブが生成できても受信成功は判定できないため、クリック後には必ず「ChatGPTが開かない・質問が渡らない場合」を表示します。通常は閉じた状態、ポップアップ拒否や長文の場合は開いた状態です。

URL長12,000文字はこの実装の上限であり、ブラウザーやChatGPTの許容長を表す数値ではありません。超過時は質問文を切り詰めず、ChatGPTのトップを開いて全文をコピーできる状態にします。コピーAPIが使えない場合は全文を選択して端末のコピー操作を案内します。データ取得は8秒で打ち切り、再クリックで再試行できます。

AI API、独自のチャット画面、対話進行の管理、学習データの外部送信はありません。将来の拡張時もUIと純粋な質問文生成の境界を維持し、現在の状態を自動収集する処理は追加要件なしに入れないでください。

## 更新と追加

1. 対象ページのHTML、動的な操作UI、初期化・復元・計算処理を確認する。
2. 該当JSONだけを編集し、画面の表示名をそのまま使用する。教材の単純化や統計上の注意も更新する。
3. 新しい統計子ラボはJSONを作り、manifestに `"statistics/<id>": ["statistics.json", "statistics/<id>.json"]` を追加する。共通処理の分岐追加は不要。
4. `node scripts/lab-help.test.mjs` で対象一覧・データ・URL長を確認する。
5. ローカル実画面で最初の手順、PCと狭い画面、コピーによる復旧を確認する。

通常のラボ生成は `node lab/tools/build-pages.mjs`、統計ページは `node lab/statistics/build.mjs` です。シェルが共通CSS/JSを出力します。独立HTMLの6ラボは同じ2タグを参照します。統計の旧URL3件とラボ一覧にはボタンを付けません。`build-preview.mjs` のオフライン単体HTMLからも本機能を除外します。

## 検証

```sh
node scripts/lab-help.test.mjs
node lab/tools/build-pages.mjs --check
python scripts/preview_site.py --port 8773 --app-root <問題演習リポジトリ>
# 別のターミナルで。既存LabのPlaywright・Chromium環境を使用。
LAB_PLAYWRIGHT_MODULE=<playwrightの絶対パス> node lab/tools/test-help.mjs
LAB_PLAYWRIGHT_MODULE=<playwrightの絶対パス> LAB_AXE_MODULE=<axe.min.jsの絶対パス> node lab/tools/test-help-activities.mjs
```

`LAB_CHROMIUM_PATH`、`LAB_TEST_ORIGIN`、`LAB_HELP_REPORT_DIR` で実行環境を指定できます。結果の既定出力先は `work/lab-help-browser` です。活動確認だけの再実行には `LAB_HELP_CASES=radix-conversion,statistics/sampling` のように指定できます。

自動ブラウザーテストの外部通信は置き換えています。実際のChatGPTへの受信と複数ターンの回答品質を証明するものではありません。[検証報告](../../docs/LAB_CHATGPT_REPORT.md)と[質問文例](../../docs/LAB_CHATGPT_PROMPTS.md)に確認状況と実対話で見る点を記載しています。
