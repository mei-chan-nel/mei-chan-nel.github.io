# Interactive Lab「ChatGPTに聞く」実装・検証報告

2026-10-26。全15ラボ、統計の8子コンテンツに共通機能を実装しました。関連する「横断分析課題」にも同じ部品を適用し、合計24ページを対象にしています。実際のChatGPTへの受信と複数ターンの回答品質は未確認のため、実装とローカル検証を完了したレビュー用変更です。本番公開は行っていません。

## 共通の使い方と構成

通常画面には「ChatGPTに聞く」ボタンを1個だけ表示します。PCはタイトル付近の右上に領域を確保し、760px以下ではタイトル下に配置します。最小の高さは44pxです。クリックすると別タブを開き、教材の固定された案内情報だけから質問文を生成します。元のラボの入力・保存内容・実行状態は変更しません。

共通CSS・起動処理と案内JSONを分離しています。統計子ページは「全ラボ共通指示 → 統計共通情報 → 子の固有情報」を合成します。最初の操作とおすすめは子の情報を優先し、ほかの項目の同一文は重複除去します。各JSONの`review.sources`に、実画面と照合したHTML・動的UI・モデルの確認元を記録しました。調査基点はポータルmain `c68fe5034c92b75231fb7eeef9982608ee0eaa0d`です。

既存の問題演習と同じ `https://chatgpt.com/?q=` + `encodeURIComponent` を使います。クリック時にだけ外部URLを生成し、別タブの`opener`と参照元URLを渡しません。現在の設定、入力、履歴、保存内容、URLのquery/hashを収集する処理はありません。

外部サービスでの受信成功は判定できないため、クリック後に「ChatGPTが開かない・質問が渡らない場合」を表示します。通常は折りたたみ、ポップアップ拒否や長文の場合は展開します。全文コピー、コピーが拒否された場合の全文選択、ChatGPTを開き直す操作が使えます。URL長12,000文字はアプリ内の上限であり、外部サービスの許容長ではありません。超過時も文章を切らず、トップページを開いてコピーを案内します。

## 対応一覧

以下の全ページで同一ボタン・質問文生成を実装し、1440px・390px・320pxの画面確認と、390pxで実際の最初の操作を確認しました。「確認」はローカルのChromiumによるもので、実際のChatGPT回答の確認を意味しません。

|対象|案内JSON（`lab/help/data/`から）|実装・ローカル確認|
|---|---|---|
|CPUと記憶装置|`cpu-memory.json`|済|
|思考ツール|`thinking-tools.json`|済|
|暗号通信シミュレーター|`crypto-communication.json`|済|
|OSの仕事|`os-work.json`|済|
|色覚シミュレーター|`color-vision.json`|済|
|問題マップ|`question-map.json`|済|
|リレーショナルデータベース|`relational-database.json`|済|
|進数の変換|`radix-conversion.json`|済|
|パケット通信とルーティング|`packet-routing.json`|済|
|画像圧縮|`image-compression.json`|済|
|画像のデジタル化|`digital-image.json`|済|
|音のデジタル化|`digital-audio.json`|済|
|論理回路をつくる|`logic-circuit.json`|済|
|フローチャートをつくる|`flowchart.json`|済|
|統計・データ分析（親）|`statistics.json`|済|
|グラフの選び方と読み取り|`statistics/graph-reading.json`|済|
|欠損値とデータの扱い|`statistics/missing-values.json`|済|
|データの分布|`statistics/histogram.json`|済|
|クロス集計|`statistics/crosstab.json`|済|
|散布図と相関・回帰|`statistics/correlation.json`|済|
|時系列データの分析|`statistics/time-series.json`|済|
|標本調査と推定|`statistics/sampling.json`|済|
|統計的な判断と仮説検定|`statistics/hypothesis-test.json`|済|
|横断分析課題（追加対応）|`statistics/projects.json`|済|

統計の子ページは独立URLです。子の切替後に新しい子のJSONが選ばれることも確認しています。ラボ一覧、旧統計URLのsummary/probability/lorenz、オフライン単体HTMLにはボタンを追加していません。

## 質問文と回答方針

[全24ページの生成文](LAB_CHATGPT_PROMPTS.md)を保存しました。826〜1,183文字、URLエンコード後は6,297〜9,594文字です。日本語・改行・特殊文字が復元でき、全ページが設定上限内に収まります。

共通指示は初回を「目的1〜2文と最初の操作1〜3手順」に限定し、利用者の反応に合わせて操作、おすすめの体験、結果の見方へ進むよう求めます。現在の操作状況は不明であること、提供していないボタンを作らないこと、作業を消すリセットを初手として勧めないことも明示しています。ラボ固有の違いはJSONだけに記載しています。

例えばCPUでは実在する「次へ」、思考ツールでは初期の例題、統計の分布では「分布と箱ひげ図」と階級幅を案内します。CPUの「ON／OFF」や欠損値の「平均値で補完」など、画面との照合で表記を修正しました。

## 検証結果

検証環境はLinuxのChromium 151、Playwright、Node.js 24です。ブラウザーテストでは広告・解析・ChatGPTへの外部通信をテスト用の応答に置き換えています。

|検証|結果・範囲|
|---|---|
|共通処理の単体検証|30テスト成功。対象一覧、スキーマ、確認元の存在、階層合成、URL・文字の往復、長文時の全文保持|
|全ページの画面・起動|24ページ×3幅の72ケースと復旧2ケース、計74記録すべて成功|
|初回操作と追加ケース|全24ページの操作と追加5ケース、計29記録すべて成功。axe、統計切替、長文、遅延起動・参照元確認を含む|
|統計の既存テスト|193テスト成功|
|サイト・問題演習の統合検証|成功。問題演習の照合先はmain `6d6320d`|
|生成ページ・差分検査|`build-pages.mjs --check`、`git diff --check`成功|

最終実行のページ別結果と環境情報は[検証記録JSON](reports/lab-chatgpt-validation.json)に保存しました。

画面検査は、ボタンが1個で44px以上、画面内に収まる、見出しに重ならない、Enterで起動できる、生成文が一致する、元の入力・localStorage・URLが維持されることを確認します。CPUのPC、思考ツールの390px、統計分布の320pxはキャプチャも目視確認しました。ページJavaScriptエラーも検査しています。

復旧検査はポップアップ拒否、コピー拒否からの全文選択、コピー成功、JSON読込503からの再試行、元のラボの操作継続を含みます。追加検査は共通部品のaxe-core WCAG A/AA指摘なし、子の切替、上限超過時の全文保持、読込前クリックでの別タブ確保、Refererなし・openerなしを確認します。アクセシビリティ検査の範囲は新しい共通部品です。

統計切替の実画面テストで、既存のbootとアプリが同じ変更に対して二重に遷移する不具合を発見しました。初期ハンドラーをアプリ側が置き換える形に修正し、遷移が1回になることを確認しました。

## 追加・変更ファイル

|区分|ファイル・内容|
|---|---|
|追加・共通部品|`lab/help/help.css`、`launcher.mjs`、`prompt.mjs`、`README.md`|
|追加・案内データ|`lab/help/data/common.json`、`manifest.json`、上記の24案内JSON|
|追加・検証と例文生成|`scripts/lab-help.test.mjs`、`lab/tools/test-help.mjs`、`test-help-activities.mjs`、`export-help-prompts.mjs`|
|追加・文書|本報告、`docs/LAB_CHATGPT_WORK_LOG.md`、`LAB_CHATGPT_PROMPTS.md`、`docs/reports/lab-chatgpt-validation.json`|
|変更・通常ラボHTML|`lab/{color-vision,cpu-memory,crypto-communication,digital-audio,digital-image,flowchart,image-compression,logic-circuit,os-work,packet-routing,question-map,radix-conversion,relational-database,thinking-tools}/index.html`|
|変更・統計HTML|`lab/statistics/index.html` と `lab/statistics/{correlation,crosstab,graph-reading,histogram,hypothesis-test,missing-values,projects,sampling,time-series}/index.html`|
|変更・生成処理|`lab/tools/shell.mjs`、`lab/tools/build-preview.mjs`、`lab/statistics/build.mjs`|
|変更・統計切替|`lab/statistics/boot.mjs`、`scripts/statistics.test.mjs`|
|変更・CI|`.github/workflows/integrated-validation.yml`。ポータルだけのPRでも実行できるよう、問題演習の既定参照先をmainへ。手動のapp_ref指定は維持|

## 未確認事項と再開手順

実際のChatGPTへの質問文の受信、自動入力・送信の動作、初回と複数ターンの回答品質は未確認です。この環境には接続済みユーザーブラウザーの操作ツールがなく、ローカル検証を実サービスの検証として扱っていません。公式に保証された`q`パラメーター仕様も確認できていません。したがって、依頼の「実際のChatGPTによる回答品質の検証」は残っています。

Safari、Firefox、iOS/Androidの実機でも未確認です。390px・320pxの検証はChromiumの狭いビューポートであり、実機・タッチ操作の確認ではありません。URL受け渡しが失敗した場合はコピーによる経路を使用できます。

続きは[作業記録](LAB_CHATGPT_WORK_LOG.md)から再開できます。実サービスの確認では[生成文](LAB_CHATGPT_PROMPTS.md)を使い、各教材で「最初の説明 → 操作方法の追加質問 → 比較する実験 → 結果の解釈」を試し、実画面と照合してください。数値を渡さない場合に結果を推測しないこと、統計の相関・因果や標本・母集団の注意が保たれることも確認します。

データ更新とテスト再実行の手順は[保守用README](../lab/help/README.md)に記載しました。mainへのマージ、本番公開は行っていません。
