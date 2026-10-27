# 模試システム 再開用記録

最終更新: 2026-10-27。**Supabase本番接続用の実装・配置ファイル・手動手順を追加。ローカルHTTP＋実DB検証済み。本番適用・公開・本番送受信は未実施。**

## 最初に読むもの

- REQUIREMENTS.md: ユーザーの要件全文。利用制限による中断を想定して記録する。
- README.md: 構成、データ契約、模試追加・版管理、検証コマンド。
- SERVER.md: Supabase用SQL・Edge Function・outboxの実装と本番適用条件。
- LAYOUT.md: 表示・印刷検証範囲と残課題。

## 完了

- 既存Study Atlasに /mock-exams/ を追加。トップページとサイトマップに入口を追加。
- No.001の原稿10ファイルをsource/に保持。49欄・44採点単位・100点を登録。
- 原稿別アダプターとHTMLのdata属性で問題表示と解答状態を接続。共通エンジンはNo.001のクラス構造に依存しない。
- 時間制限あり・なし・大問別、状態一覧、クリック／キーボード、4×4キー、図の拡大、プログラムへ式の反映。
- 自動保存・書き出し／読込み・未採点中断・採点中断・正誤表示あり／なし再開・再受験。
- 復習は採点単位を考慮し正答を固定、誤答を空欄に戻す。元の成績は不変。
- 完答・順不同・部分点・複数正答・誤答への部分点・条件付き採点。
- 結果、履歴比較、参考統計取得。送信先設定済み、本番Functionの配置待ち。
- 版固定の問題PDF32ページ、解説PDF35ページ。全ページA4、右下出典・通し番号。
- SQL/Edge Function/outboxを実装。秘密キーは含めていない。旧学習アプリのソース、保存、統計テーブル/RPCは未変更。

## 前回までの検証

- `node mock-exams/tests/engine.test.mjs`: 10テスト成功。
- `tests/browser.cjs`: 全49欄をUI操作して100/100、削除・見直し・中断再開・別タブ拒否、復習後も97点を維持、390pxの全5区分で本文横はみ出しなし、図拡大、プログラム内の式反映、大問別0/15、時間切れ0/100自動採点、pageerrorなし。
- `scripts/validate_mock_exam_content.py`: 原稿と生成HTMLの本文・図数一致、PDF全67ページA4、長い本文断片欠落なし。
- `scripts/validate_portal.py`: 105ページ・105サイトマップURLで成功。
- `tests/sql_integration.py`: 一時PostgreSQL17で重複・再採点・逆順・並行更新・権限制限・レート制限成功。本番DDL相当のテスト用テーブルであり、本番Supabaseへは未接続。
- 前回はEdge Functionの構文確認まで。今回の追加検証は下記参照。Deno/Supabase本番での検証は未実施。

## 残作業（ここから再開）

1. ユーザーは通信許可先追加を選択済み。管理環境のnetwork policyにはまだ反映されていない（最後のstatusはallowed_hosts=[]）。`yygezzpowsvpzarqdtls.supabase.co`と`challenges.cloudflare.com`の反映を確認する。プロキシ経由の公開RPC試行は403で遮断され、本番まで到達していない。設定を迂回しない。
2. Supabase管理接続は未設定。ユーザーへSERVER.mdの手順1〜5（SQL、Turnstile、Secrets、Edge Function配置）を依頼済み。完了連絡待ち。秘密鍵をチャットに要求しない。
3. 本番のDB構造と権限は`000_inspect_existing.sql`で確認し、`001_mock_exam_safe_stats.sql`を適用、`002_verify_permissions.sql`で確認する。旧版SQLは公開・適用されていない前提。新SQLはprotocol 2。
4. 配置するEdgeコードは **`mock-exams/server/deploy/index.ts`**（生成済み単一ファイル）。Function名 `mock-exam-submit`、Verify JWTはこのFunctionだけOFF。本番Originは **https://mei-chan-nel.com**。SecretsはSERVER.md参照。
5. フロント接続先は設定済み。公開用TurnstileキーはFunctionのGETから取得する。新しい採点はoutboxに保存し、未接続・失敗時も保持する。既に統計送信対象外だった旧採点は勝手に遡及送信しない。
6. `mock-exams/connection-check.html`は本番送受信の確認ページ。`__verify_001`のランダム版へ隔離して書き込み、既存RPCで読み戻して検証する。成功後は検証スイッチfalse。実測JSONが得られるまで本番検証済みと言わない。
7. サイトはまだローカル開発ブランチ。既存workflowの兄弟リポジトリ同名ブランチ参照に注意して公開を進める。既存学習アプリには変更なし。
8. 公式冊子の精密な組版比較・Safari/iOS実機確認は前回から残っているが、今回の対象はSupabase接続。

## 今回の追加実装と確認

- 新Edge handler：JSON・Origin・版・欄・回答値・kind検証、得点偽装拒否、Turnstileのhostname/action照合、scope固定。例外に内部情報を出さない。
- IPヘッダー依存を廃止。Turnstile検証後、トークンごと120/時・全体6,000/時の上限をSQLで実施。
- SQL：同一受験の置換、重複・逆順・衝突、scope違いの拒否、集計不整合のロールバック。公開RPCは取得だけ。既存statsのRLS/読取り動作を変更せず、直接書込み権限だけ制限。
- フロント：永続化後に送信、失敗後の再送、stale/conflictを未送信のまま明示、成功後に統計を再取得。レビュー回答は送信しない。
- `engine.test.mjs`：11テスト成功。遅延ACKで新しいoutboxを消さないケースを追加。
- `sql_integration.py`：PostgreSQL17、並行32送信/16受験、逆順10revision、権限、レート上限、migration再実行、既存アプリsentinel保持が成功。
- `server-http.mjs`：ローカルHTTP＋実PostgreSQLをservice_roleで使用。途中採点、応答消失、再送、再採点、復習、別受験、空欄、入力偽装、検証データ隔離成功。TurnstileとPostgREST transportのみテスト実装。
- `browser-stats.cjs`：Chromium上で失敗→再送・fresh token・置換・統計再取得・復習除外・別受験成功。通信はテスト用。
- `browser.cjs`：49欄/100点、復習、スマホ、期限切れ成功。fragment-only navigationは再読み込みしないため、検証コードでreloadを明示して以前の偶然のタイミング依存を除いた。
- `server-bundle.test.mjs`：生成済み単一Edgeファイルを実行し、全44採点単位100点を確認。Deno/Supabaseのゲートウェイを通した検証はまだ。
- `connection-check-browser.cjs`：管理者確認ページの全ステップと結果保存UIを検証用通信で確認。
- ポータル検証：106ページ、105サイトマップURLで成功。管理者確認ページはnoindex・サイトマップ非掲載。

## 作業上の注意

- 初回は利用制限でライブラリ導入の自動承認が実行されなかった。以後は既存のlxmlを使用し、追加pip依存の導入はしていない。
- ブラウザではfile://が管理ポリシーで無効。検証スクリプトはlocalhost HTTPを使用する。
- 原稿の@media(max-width)が印刷にも適用されていた問題を補正済み。第3問は2列解答群を印刷時に維持して全ページ等倍。第2問B/第4問の一部はフィット処理あり。
- 生成元HTMLとPDFが古くならないよう変更後に必要な生成・内容検査を実行する。
- SQL検証用Dockerコンテナは削除済み。検証サーバーとブラウザも終了済み。
- source/の原稿と生成物はユーザー提供教材。検証中間ファイルは作業用work/にあり、コミット対象に入れない。

## 保存状態

開発ブランチ: `feat/mock-exams-001`。このブランチの最新コミットがローカル実装のチェックポイント。未push。PDFは問題2,040,475 bytes、解説2,993,149 bytes。PC受験画面のaxe WCAG2A/AA自動検査で違反0件。

## 最終統合検証

`python scripts/validate_study_atlas.py --portal-root <portal> --app-root <app> --portal-ref HEAD --app-ref HEAD` が成功。ポータルJS9ファイル、既存学習アプリ1,438問の検証、Python10テスト、アプリJS10ファイルを含む。既存学習アプリ側の作業ツリーに変更なし。

開発チェックポイントのソースはコミット済み。指定された会話成果物フォルダーは、この管理環境では作成権限がないためダウンロード用ZIPを出力できなかった。再開はリポジトリ内の本書から行う。PDFは模試版フォルダー内に保存済み。

## 今回の配布物

`/workspace/output/study-atlas-mock-exams-setup.zip`に、原稿からの模試実装と今回の接続コードを含む差分ファイル一式を保存。ZIP内`START-HERE.md`からSQL・生成済みEdgeコード・画面操作手順へ進める。通常のmainやSupabase本番には未適用。
