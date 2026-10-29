# Supabase RPC直接接続 — 現行仕様（2026-10-27）

対象は `info1-quiz-stats`、Project ref `yygezzpowsvpzarqdtls`。既存学習アプリと同じProject URL・Publishable keyを使用する。秘密鍵は不要。DBへ追加するテーブル・RPC・権限設定はない。

**この文書が現行の接続仕様です。以前の本番設定手順は使用しません。既存2つのRPCの直接呼出しに統一しています。**

## 接続契約

`engine/stats.mjs`が次の2つの既存RPCへ直接POSTする。問題版はJSONの正の整数。No.001の現行版は **2**（`exams/001/2/`）。改訂前の **1** も旧履歴用に保持する。取得・記録とも受験時の問題版を送り、版をまたいで統計を混ぜない。

```json
{
  "p_exam_id": "001",
  "p_exam_version": 2,
  "p_results": [
    {"section_id":"q2a","scoring_id":"q2a-02","answer":"1|_","earned_points":0,"max_points":3}
  ]
}
```

記録用 `record_mock_exam_results(text,integer,jsonb)` は `{ "updated_count": 1 }` を返す。HTTP成功と送信件数の一致を確認して送信済みにする。

取得用 `get_mock_exam_stats(text,integer)` は`p_exam_id`と`p_exam_version`を受け取り、`{ "items": [...] }`を返す。itemsは`section_id`、`scoring_id`、`answered_count`、`correct_count`、`points_sum`。`answer_counts`は返さない。

scoring_idは問題定義のIDを一貫して使う。No.001は`q1-01`など44単位であり、SQL例にある`m001_q1_001`へ別途変換しない。既存関数はIDの形式を検査し、固定のID一覧を要求していない。

## 送信管理

`engine/submission.mjs`が個人の採点済み回答から再計算し、まだ送信を試みていない回答済み単位だけをまとめる。状態は受験履歴の`statsDelivery[scoring_id]`に保存する。

| 状態 | 扱い |
|---|---|
| 項目なし | 未送信。回答済みで採点されたら送信対象 |
| `sending` | 通信開始前に通常保存と復旧用コピーへ保存済み |
| `sent` | 記録RPCが成功し、updated_countが一致。以後再送しない |
| `unknown` | タイムアウト、通信失敗、HTTPエラー、応答不正など。以後再送しない |

送信開始の保存が失敗したらHTTP要求を出さない。正常応答後の保存に失敗しても、先に保存した`sending`が残るため、再読込み時は`unknown`として再送を抑止する。結果不明に対する再送ボタン・自動再試行はない。明確なHTTPエラーも保守的にunknownとする。

途中採点後に回答を変更しても、送信を試みた単位の状態は消さない。`1|_`を送った完答問題を後から`1|5`へ変更しても再送しない。個人成績だけは最新の回答で採点する。新しく回答した別の単位は送信する。トップページから新しく解くと、新しい受験UUIDとして集計する。

復習は採点時の回答・結果の閲覧専用スナップショットを使い、回答変更・再採点・送信は行わない。採点せずに中断した場合も送信しない。完全未回答の単位は送らない。通常の採点に付随する送信が実行中に復習へ移っても、その通常採点の応答処理だけは完了する。

同一ページ内の重なる送信は順番に処理し、新しい単位だけを抽出し直す。Web Locks対応ブラウザでは別タブも排他制御する。非対応ブラウザでは同時に同じ受験を開かない運用とする。

保存・端末内履歴の復元では既存の送信マークを単調にマージする。通常保存とbackupの両方へ同じマークを書き込み、古いbackupから復元しても送信対象に戻さない。通信応答で保存するのは送信状態だけなので、通信中に進めた個人の回答や成績を古い値へ戻さない。

端末の全データ削除、Web Locks非対応環境の同時編集まで含む完全な重複排除は行わない。送信漏れを許容し、通常操作での二重加算を抑える方式である。

記録RPCは新しく採点した時だけ呼ぶ。保存済み結果・復習・解説の閲覧やブラウザでの画面復帰では呼ばない。履歴ファイルの入出力は提供しない。

## 統計計算と表示

採点単位ごとに次を計算し、画面には「正答率」「平均得点」「平均得点率」と表示する。

- 正答率 = correct_count / answered_count（満点正答の割合）
- 平均得点 = points_sum / answered_count
- 平均得点率 = points_sum / (answered_count × 配点)
- 大問別・全体の平均得点 = 対象採点単位の平均得点の合計
- 大問別・全体の平均得点率 = 合計した平均得点 / 対象範囲の満点

単位ごとに母数が異なっても、それぞれの平均を求めてから合計する。answered_countが0、または行がない単位はnullとして扱う。範囲内にそのような単位があれば大問別・全体もデータ不足と表示し、0点で補完しない。統計取得に失敗しても個人の採点・復習・履歴は利用できる。

## 提供SQLとの照合

作成時SQLはユーザー提供の[reference/existing-rpcs.sql](reference/existing-rpcs.sql)に保存した。これは参照用で、追加適用するmigrationではない。現在の本番DBに保存された関数定義との完全一致は未確認。

送信側の検証はSQLの制約に合わせる：IDは英数字・`_`・`-`で100文字以内、版は正のinteger、最大100単位、重複scoring_id禁止、5種類のsection、回答は`0〜9/A〜F/_`の1文字を`|`で連結し127文字以内、得点は0以上かつ配点以下、配点は0超〜100、小数は2桁まで。完全未回答はクライアント・SQLの双方で除外される。

**No.001の49欄はすべてこの形式に適合し、SQL変更は不要。** 将来1欄に`10`や`AB`など複数文字を保存する模試は現行RPCに送れない。その場合は欄を分けて定義するか、その時点で回答形式の制約を見直す。現状は非対応データをHTTP送信前に拒否する。数値の範囲内での意図的な偽装得点は、匿名集計の許容範囲としてサーバー側では問題定義と照合しない。

## 検証

本番と同じRPC定義を一時PostgreSQL17へ読み込み、anonロールでローカルHTTPから送信・読戻しを実行した。No.001を使わず`qa_mock_<UUID>`を使用。複数マークの入力順、1.5点の部分点、途中採点後の新規単位だけの加算、最初の不正解の保持、再受験、復習除外、応答消失、復旧、各平均、SQLの入力検証・全体ロールバックを確認した。既存学習アプリ用の検証データは不変。

本番通信は環境のHTTPSプロキシへのCONNECT段階で403となった。curlの`http_connect=403`、`http_code=0`、`time_appconnect=0`を確認しており、SupabaseへのTLS接続もHTTP要求も成立していない。詳細は`network-diagnosis.json`に保存。**本番の記録・取得・現在の関数定義は未確認。** 公開キー自体が拒否されたという結果ではない。

ブラウザでの実接続確認には `/mock-exams/connection-check.html` を使う。ローカルプレビューからも実行でき、追加設定は不要。

```sh
python scripts/preview_site.py --host 127.0.0.1 --port 8773
# http://127.0.0.1:8773/mock-exams/connection-check.html
```

「実際の送受信を検証する」を押すと、毎回新しいテスト用模試IDで公開RPCを呼び、集計を読み戻す。テスト結果は通常のNo.001には混ざらず、専用IDに残る。結果JSONを保存できる。公開サイトへ反映する場合は、既存の静的サイトと同じ方法で開発ブランチの変更を公開する。現時点ではローカル開発ブランチに保存しており、公開元mainには未反映。

実装検証コマンド：

```sh
node mock-exams/tests/engine.test.mjs
node mock-exams/tests/submission.test.mjs
# 使い捨てPostgreSQL17のコンテナ名を指定。本番DB接続先は受け付けない。
node mock-exams/tests/rpc-integration.mjs atlas-mock-direct-rpc
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser-stats.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/connection-check-browser.cjs
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser.cjs
```

## 本番の実関数定義を照合する場合

Publishable keyで利用できるのは、公開された既存RPCです。現在の作業環境にはSupabaseの管理接続がないため、DB内部の関数定義は取得できていません。参照SQLは提供された作成時の定義であり、現在のDBから取得した定義とは区別しています。

本番のSQL Editorから次の**読取り専用**クエリで、実際の関数本文を取得できます。テーブル・関数・権限を作成／変更するSQLではありません。これが取得できれば、保存済みの参照定義との差分を確認できます。

```sql
select
  p.oid::regprocedure as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('record_mock_exam_results', 'get_mock_exam_stats')
order by p.proname;
```

## 単独ファイルでの接続確認

配布物の`supabase-direct-rpc-check.html`は、上記の確認ページと同じテストを1ファイルにまとめたものです。ブラウザで開き「実際の送受信を検証する」を押すと、既存のPublishable keyを使い、新しい`qa_mock_`模試IDへ送信・読戻しを行います。サイト公開や追加サービスの設定は不要です。ブラウザがローカルファイルからの通信を制限する場合は、前述のローカルプレビューで確認してください。

この確認ファイルの画面動作は通信を模擬して検証しています。本番Supabaseを通した成功結果は、実接続でログが得られるまで未確認です。

## WindowsでのローカルHTTP検証（現在の手順）

[WINDOWS-LOCAL-TEST.md](WINDOWS-LOCAL-TEST.md)に起動・テスト方法・各期待値・エラーの見方をまとめた。`StudyAtlas-RPC-Test-Windows.zip`を展開し、`start.cmd`をダブルクリックする。管理者権限やPython/Node.jsの導入は不要。127.0.0.1だけで待ち受けるPowerShellサーバーからページを配信し、通常のブラウザが既存RPCへ直接通信する。

最終集計はsingle=(2件,1正答,2点)、pair=(2件,1正答,3点)、partial=(3件,1正答,7点)。平均得点4.83/9点、平均得点率53.70%。各HTTPステータスと最終値をJSONへ保存する。応答消失はテスト中に意図的に模擬する。

配布サーバーのコードはPowerShell 7.4.6/Linuxで実行し、ローカルHTTPのGET/HEAD・404/405とブラウザの検証フローを確認した。スクリプトはWindows標準PowerShell 5.1で使える構文・.NET APIを使用しているが、Windows実機での実行と実Supabase通信はユーザーPCでの確認待ち。

**公開方針：Windowsで実接続の検証が済むまで、本番サイトへデプロイしない。**
