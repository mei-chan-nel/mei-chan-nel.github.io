# Supabase 本番接続の設定手順

対象は `info1-quiz-stats`（Project ref `yygezzpowsvpzarqdtls`）。サイトの本番Originは **`https://mei-chan-nel.com`**。既存の学習アプリのテーブル・RPC・キー設定は変更しません。

2026-10-27時点: サイト側・SQL・Edge Function・本番確認ページを実装済み。ローカルHTTP＋PostgreSQLの検証済み。**本番SQL適用・Edgeデプロイ・本番送受信は未実施**です。この環境にはSupabase管理接続がなく、Supabaseへの通信も環境の許可先追加待ちです。

## 採用する方式

```text
ブラウザ ── Publishable key ──> 既存 get_mock_exam_stats（取得）
ブラウザ ── 回答＋受験ID＋revision＋Turnstile ──> mock-exam-submit
  Edge Function: 版固定の問題JSONで採点、完全未回答を除外
    └─ service_role ──> replace_mock_exam_results（新設、非公開RPC）
         受験の前回スナップショットを引き、今回の結果を加える単一トランザクション
```

既存 `record_mock_exam_results` は使用しません。加算だけのRPCでは再採点時に前回分を取り消せないためです。公開権限を追加せず、定義も変更しません。取得用の `get_mock_exam_stats(p_exam_id,p_exam_version)` はそのまま使用します。

| 操作 | DB側の処理 |
|---|---|
| 途中採点 | 受験UUID・秘密の受験トークン・revision 1 で記録 |
| 同じ受験を再開して再採点 | 同じUUID・トークン、revisionを増やして前回分を置換 |
| 応答消失・通信リトライ | 同じrevision・同じ内容。`duplicate`で件数不変 |
| 新旧の送信が逆順に到着 | 古いrevisionは`stale`。最新の集計を保持 |
| 同じrevisionに異なる内容 | HTTP 409。上書きしない |
| 別トークン、問題版、大問範囲で同じUUIDを上書き | HTTP 409 |
| 最初から解き直す | 新UUID・新トークンで別の受験として加算 |
| 復習モード | 元の回答と別に保存。outboxを更新しない。復習送信は400 |
| 採点単位の一部だけ回答 | 例 `1|_` として集計。順不同正解でも入力順を保持 |
| 採点単位が完全未回答 | 集計しない。以前回答済みなら再採点でその分を除く |

クライアントは得点を送信できません。Edgeは許可された問題版と採点エンジンを同梱し、回答から採点します。DBには受験トークンのSHA-256だけを保存します。送信前に回答スナップショットとトークンを永続保存し、成功応答までoutboxを残します。復習の採点結果を通常の採点スナップショットへ混ぜません。

匿名方式なので「人間が自力で解いた」「復習を通常受験と偽っていない」ことまでは証明できません。Turnstileによる人間確認、許可Origin、入力上限32KiB、受験トークンごと120回/時と全体6,000回/時の上限で大量送信を抑制します。全体上限時も採点結果は端末に残り、後で再送できます。偽装可能なIPヘッダーには依存しません。

## 1. 既存のDB構造を確認する

1. Supabase Dashboardで **info1-quiz-stats** を選択します。
2. 左の **SQL Editor → New query** を開きます。
3. `mock-exams/server/000_inspect_existing.sql` の全文を貼り付け、Roleが`postgres`であることを確認して **Run** を押します。
4. `mock_exam_stats` の9列と主キー `(exam_id, exam_version, scoring_id)`、取得RPCの引数 `(text,text)` を確認します。`record_mock_exam_results` のanon/authenticated実行権限はfalse、service_roleはtrueであることを確認します。

SQLの出力は定義・公開の集計だけです。APIのSecret keyやservice_role keyをチャットやサイトへ貼る必要はありません。

## 2. 模試用SQLを適用する

1. 新しいクエリに **`mock-exams/server/001_mock_exam_safe_stats.sql` の全文**を貼って **Run**。
2. Successで完了することを確認します。トランザクション内で適用するため、途中エラーは全体が取り消されます。既存列・キー・RPC権限が想定と違う場合は処理を止めます。エラーを無視して一部だけ実行しないでください。
3. `mock-exams/server/002_verify_permissions.sql` を実行します。protocolが **2**、各チェックが **true** なら正常です。

新設物は`mock_exam_attempt_snapshots`、`mock_exam_rate_limits`と4つの関数だけです。既存`mock_exam_stats`は一般利用者の直接書込み権限だけを取り除き、既存のRLS設定・読取り動作は維持します。取得RPCと既存学習アプリのテーブル・RPCは変更しません。既にある集計行は消さず、その後の模試受験分からスナップショットで管理します。

## 3. Cloudflare Turnstileを作る

1. Cloudflare Dashboard → **Turnstile → Add widget**。
2. 名前を`Study Atlas mock exams`、Hostnameを **`mei-chan-nel.com`**、Widget Modeを **Managed** にして作成します。
3. **Site key（公開用）**と**Secret key（秘密）**を控えます。Secret keyを保存する場所は次のSupabaseのSecretsだけです。
4. `www.mei-chan-nel.com`など別Originも利用する場合は、本番の正規Originへリダイレクトしてください。このFunctionは指定した1つのOriginだけを許可します。

## 4. Edge FunctionのSecretsを登録する

Supabase → **Edge Functions → Secrets** に以下を登録します。画面の名称が変わっている場合はEdge Functions内の「Secrets」を探してください。

| Name | Value |
|---|---|
| `MOCK_EXAM_ALLOWED_ORIGIN` | `https://mei-chan-nel.com`（末尾 `/` なし） |
| `MOCK_EXAM_TURNSTILE_SITE_KEY` | 手順3のSite key |
| `MOCK_EXAM_TURNSTILE_SECRET` | 手順3のSecret key |
| `MOCK_EXAM_ENABLED` | `true` |
| `MOCK_EXAM_VERIFICATION_ENABLED` | 最初は `true`。検証後 `false` |

`SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`はSupabase Edge Functionsの標準環境変数を使用します。サイト側へコピーしません。独自のIPソルトや利用者のIPヘッダー設定は不要です。

## 5. Edge Functionを配置する

1. **Edge Functions → Deploy a new function → Via Editor**（またはエディターで作成）を開きます。
2. Function名を **`mock-exam-submit`** にします。
3. `index.ts` のサンプルをすべて消し、**`mock-exams/server/deploy/index.ts` の全文**を貼り付けます。
4. **Deploy function** を実行します。このファイルは採点エンジンと問題JSONを含む単一ファイルで、追加のimportや外部パッケージは不要です。`server/index.ts`は開発用の入口なので、そちらだけを貼らないでください。
5. Functionの **Details / Settings → Verify JWT（Enforce JWT verification）** を **OFF** にし、保存します。新しいPublishable keyはJWTではありません。このFunction自身がTurnstile・Origin・入力を検証します。OFFにするのは **mock-exam-submitだけ**です。
6. Endpointが次のとおりであることを確認します。

```text
https://yygezzpowsvpzarqdtls.supabase.co/functions/v1/mock-exam-submit
```

CLIを使う場合は、生成済みファイルを`supabase/functions/mock-exam-submit/index.ts`へコピーし、`supabase functions deploy mock-exam-submit --project-ref yygezzpowsvpzarqdtls --no-verify-jwt`で配置できます。ログイン情報や管理トークンをソースに保存しないでください。

## 6. サイト側を配置する

サイト側の接続先は実装済みです。`mock-exams/engine/stats.mjs`は、既存と同じProject URL・Publishable keyを使います。秘密鍵は含みません。Turnstileの公開Site keyはFunctionのGETから取得するため、サイト側へ手で転記する必要はありません。

開発ブランチ`feat/mock-exams-001`の模試実装を、既存のGitHub Pages公開手順で反映します。現在はローカルの開発ブランチにあり、公開元mainには未反映です。既存学習アプリのリポジトリに変更はありません。Functionが未設定・未配置なら送信は失敗として表示し、outboxと端末の成績を保持します。統計取得と受験・採点は独立して利用できます。

公開前に接続だけ確認する場合は、ローカルHTTPでサイトを起動し、Supabaseの許可OriginとTurnstileのHostnameを一時的にその検証環境に合わせる方法もあります。**最終検証は正規本番Originで行ってください。**

## 7. 実送受信を確認する

配置後、正規本番サイトの次のページを開きます。

```text
https://mei-chan-nel.com/mock-exams/connection-check.html
```

1. 「実際の送受信を検証する」を押します。
2. Turnstileの確認が出たら完了します。送信ごとに新しいトークンが必要なので、複数回確認が出る場合があります。
3. 既存RPC読取り → 途中採点 → 同じ内容の再送 → 再採点 → 古いrevision → 同revision異内容 → 別受験 → 復習除外 → 未回答へ変更を実送信し、取得RPCの集計値を照合します。
4. 全項目がPASSになったら **「検証結果を保存する」**でJSONを保存します。失敗時もログを保存できます。秘密鍵・受験トークン・個人回答はログに含みません。
5. Supabase Secretsの **`MOCK_EXAM_VERIFICATION_ENABLED` を `false`** に戻します。
6. 通常の模試で1欄回答して採点し、「統計送信済み」と表示されることを確認します。この操作は実際の通常受験1件として集計されます。
7. 既存学習アプリでも従来の統計取得・回答送信が動くことを確認します。

検証ページは同じ採点・書込みコードを使用しますが、DB上の `exam_id='__verify_001'` とランダムな `exam_version=検証ID` に隔離します。No.001の通常統計を汚しません。成功時に検証集計を0へ戻します。復習の「送信しない」検査に加え、復習として偽送信したリクエストの拒否も確認します。

途中で検証を止めても通常統計には影響しません。検証データの削除が必要なら、検証スイッチをfalseにした後にSQL Editorで以下を実行します（通常の受験スナップショットは削除しないこと）。

```sql
begin;
delete from public.mock_exam_attempt_snapshots where exam_id='__verify_001';
delete from public.mock_exam_stats where exam_id='__verify_001';
commit;
```

## 運用・停止・再開

- 送信を一時停止する場合は `MOCK_EXAM_ENABLED=false`。復旧はtrueへ戻します。学習アプリのキーをローテーションしたり、既存RPCを削除したりしないでください。
- 古いrate-limit行だけを整理します。Supabase Cronを既に利用している場合は、1時間ごとに`select public.prune_mock_exam_rate_limits();`を実行するジョブを追加できます。Cron未使用ならSQL Editorで適宜実行できます。
- `mock_exam_attempt_snapshots`は二重計上防止の根拠です。通常受験の行を削除しないでください。古い履歴からの再送が新規扱いになってしまいます。
- 複数端末へ同じ履歴を書き出し、別々に同じ受験を進めると衝突します。409やstaleを受けた端末では自動上書きせず、最新履歴の利用を案内します。別の受験として解く場合は「最初から解き直す」を使います。
- Functionのログにリクエスト本文やトークンを出力しないでください。現在のコードは出力しません。
- 問題の採点内容を変更するときは問題版を上げ、旧版の採点定義をFunctionにも残して再ビルドします。同じ版の配点を後から変えないでください。
- 異常な負数など集計の不整合を検出した場合はトランザクションを拒否します。手で集計だけ消して再送する復旧方法は使わず、スナップショットと照合します。

## 検証済みの範囲

`engine.test.mjs`：採点・履歴・outbox・遅延ACK・stale/conflictの保持。

`sql_integration.py`：一時PostgreSQL 17で同時送信、逆順revision、旧結果の除去、別トークン拒否、一般ロール権限、120回/時・全体6,000回/時、migration再実行、既存アプリのsentinel保持。

`server-http.mjs`：実際のローカルHTTP送受信とPostgreSQLで、サーバー採点・応答消失・再送・再採点・復習除外・再受験・未回答除外・入力偽装拒否を確認。DB関数はservice_roleで呼び出す。**Turnstile応答とPostgRESTへの橋渡しはテスト用で、本番Supabaseを通った検証ではありません。**

`browser-stats.cjs`：Chromium画面操作によるoutbox永続化、応答消失後の再送、再採点、統計再取得、復習除外、再受験。`connection-check-browser.cjs`：管理者用確認ページの全ステップと結果保存UI。いずれも通信とTurnstileはテスト用です。

本番のネットワーク・既存DDL・Supabaseゲートウェイ・実Turnstileを含む確認は、手順7の実測記録が得られるまで完了扱いにしません。

## 再ビルドする場合

生成済み`server/deploy/index.ts`はそのまま配置できます。ソース変更後だけ、リポジトリのルートで次を実行します（Node.js 22以上）。

```sh
npm install --prefix /tmp/study-atlas-build esbuild@0.28.2
ESBUILD_MODULE=/tmp/study-atlas-build/node_modules/esbuild node scripts/build_mock_exam_server.cjs
node mock-exams/tests/server-bundle.test.mjs
node mock-exams/tests/engine.test.mjs
```

生成ファイルに秘密鍵を書き込む処理はありません。デプロイ前には差分と同梱した問題版を確認します。

読取り・配置確認だけなら、`python scripts/check_mock_exam_public.py --report /tmp/mock-exam-public-check.json`も使用できます。既存のPublishable keyによる取得RPCと公開設定GETだけを呼び、統計への書込みは行いません。書込みの確認には手順7のTurnstile付き検証ページを使います。
