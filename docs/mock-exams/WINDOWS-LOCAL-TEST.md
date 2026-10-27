# Windows PCでSupabaseの実接続を検証する

## 今回の403の発生元

Codex実行環境のHTTPSプロキシが、トンネル確立のCONNECT要求へ403を返した。

- proxy CONNECT status: **403**
- origin HTTP status: **0（SupabaseからのHTTP応答なし）**
- TLS handshake time: **0（接続未確立）**
- curl: `CONNECT tunnel failed, response 403`、終了コード56

そのため、この403はCodex実行環境による通信制限と確認できる。SupabaseのRPC実行権限やPublishable keyが拒否された証拠ではない。制限の回避は行わない。生の診断結果は同梱の`network-diagnosis.json`と、リポジトリの`docs/mock-exams/network-diagnosis.json`に保存している。

以下の検証はWindows PCの通常のブラウザからSupabaseへ直接HTTPS通信する。ローカルサーバーは確認ページの配信だけを担当する。

## 起動

1. `StudyAtlas-RPC-Test-Windows.zip`をダウンロードし、右クリック→「すべて展開」を実行する。
2. 展開した`StudyAtlas-RPC-Test-Windows`フォルダーの **start.cmd** をダブルクリックする。ZIPを開いたまま実行せず、展開後のファイルを使う。
3. コンソールが開き、通常のブラウザで **http://127.0.0.1:8765/** が開く。自動で開かなければ、このURLをEdgeまたはChromeに入力する。
4. コンソールは開いたままにする。検証後はCtrl+Cで停止し、ウィンドウを閉じる。

Windows 10/11標準のWindows PowerShell 5.1を使用する。管理者権限、Python、Node.jsのインストールは不要。start.cmdのExecutionPolicy指定は起動するPowerShellプロセスだけに適用され、システムの実行ポリシーは変更しない。サーバーは127.0.0.1だけで待ち受ける。

8765番ポートが使用中なら、フォルダー内のアドレスバーへ`powershell`と入力してEnterを押し、次を実行する。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-LocalTest.ps1 -Port 8766
```

スクリプトの実行がPCの管理ポリシーで禁止されている場合、Pythonが利用可能なら、同じフォルダーで次を実行する方法もある。

```powershell
py -3 -m http.server 8765 --bind 127.0.0.1
```

この場合もブラウザでhttp://127.0.0.1:8765/を開く。PCの管理ポリシー自体を変更する必要はない。

## 統計取得・記録のテスト

ページの「実際の送受信を検証する」を1回押す。Supabase URL・公開キー・整数版1は組込み済み。追加SQL、秘密鍵、外部サービスの設定は不要。

最初に`qa_mock_`で始まるランダムなテスト用模試IDが表示される。すべての取得・記録要求はこのIDに固定され、**No.001には書き込まない**。もう一度ボタンを押すと、別のテスト用IDになる。テストの集計は専用IDに残る。

検証は次を自動実行する。

1. `get_mock_exam_stats(text,integer)`へPOSTし、新規IDの戻り値が`{"items":[]}`であることを確認する。
2. 未採点の中断と完全未回答の採点では記録しないことを確認する。
3. `record_mock_exam_results(text,integer,jsonb)`へ2単位を送り、`updated_count:2`と取得RPCの件数を確認する。初回のsingleは不正解、pairは`1|_`の一部空欄。
4. 同じ受験を再開し、既送信のsingleとpairを正解へ変更しても再送しない。初めて回答したpartialだけを1.5点で送り、`updated_count:1`を確認する。
5. 履歴の復元・中断・復習をしても、集計が増えないことを確認する。
6. 新しい受験として3単位を送り、`updated_count:3`と集計を確認する。pairの回答は`2|1`で入力順を保持する。
7. 新たな受験でpartialの1.5点を記録後、アプリ側で応答を意図的に捨てる。結果不明状態が保存され、復元後も再送されず、読戻したpartialが3件のままであることを確認する。

通常の記録要求は合計4回で、updated_countは順に **2・1・3・1**。最後の要求だけは、記録成功後の応答消失を意図的に模擬する。失敗した実通信を成功扱いにするものではなく、実際の読戻しが期待値と一致して初めてPASSになる。

## 成功時に確認する値

画面に **「送受信検証に成功しました。」** と全項目のPASSが表示され、最終集計が次と一致する。

| scoring_id | section_id | answered_count | correct_count | points_sum |
|---|---|---:|---:|---:|
| single | q1 | 2 | 1 | 2 |
| pair | q1 | 2 | 1 | 3 |
| partial | q2a | 3 | 1 | 7 |

満点はsingleが2点、pairが3点、partialが4点。

| 範囲 | 平均得点 | 平均得点率 |
|---|---:|---:|
| q1 | 2.50 / 5点 | 50.00% |
| q2a | 2.33… / 4点 | 58.33…% |
| 全体（最終値） | 4.83… / 9点 | 53.70…% |

正答率はsingleが50%、pairが50%、partialが33.33…%。単位ごとの平均得点は1、1.5、7/3点で、合計29/6点になる。

応答消失試験を行う前の段階では、partialは2件・1正答・5.5点で、全体平均が **5.25 / 9点・58.33%**。その後にpartialの1.5点を1件追加するため、最終値は上表へ変わる。

「検証結果を保存する」を押し、`mock-exam-rpc-check.json`を保存する。テスト用ID、各RPCのHTTPステータス、updated_count、期待値と実測値、平均値を記録する。公開キーやリクエストヘッダーは保存しない。

## 通信エラー時の確認

- ページを開けない：コンソールが起動中か、URLのポートが合っているかを確認する。これはローカルサーバーの確認。
- RPCのHTTP 200とPASS：そのWindowsブラウザからSupabaseへの記録・取得に成功した結果。
- RPCのHTTP 401/403：保存したJSONの`requests`にHTTPステータスと、読み取れたSupabaseのエラーcode/messageを記録する。その内容を確認する。Codex側のCONNECT 403と同一原因だとは判断しない。
- `Failed to fetch`など、HTTP応答を読めない：ブラウザのF12→Network/Consoleで、CORS・DNS・PCのプロキシ等のエラーを確認する。Networkで`supabase.co`を絞り込むと、OPTIONSと2種類のRPC要求を確認できる。
- ポリシーでローカルストレージを使えない場合：ログに保存エラーが出る。通常ウィンドウで保存を許可した状態で検証する。

検証が失敗しても、権限変更や新しいSQLの適用はせず、まず保存した結果JSONのエラーを確認する。

## この一式で確認済みの範囲と公開方針

Codex側では、提供されたRPCのSQLを使った一時PostgreSQL、ブラウザの模擬通信を検証済み。配布サーバーはPowerShell 7.4.6/Linuxで実際に起動し、HTTP配信・ブラウザ操作・結果JSON保存を検証した。Windows標準PowerShell 5.1に対応する構文と.NET APIで記述しているが、Windows実機の動作はこの手順で確認する。Windows PC上での実Supabase通信は、この手順で得られる結果JSONによって確認する。現時点で実通信の成功結果はまだ得ていない。

**本番サイトへのデプロイは行わない。Windowsで実接続の検証が成功し、結果を確認してから進める。**
