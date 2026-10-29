# 実戦模試の公開と確認

本番URLは https://mei-chan-nel.com/mock-exams/ 。GitHub Pagesの公開元は`mei-chan-nel/mei-chan-nel.github.io`のmain。No.001の初回公開日は2026年10月29日、現行問題版は整数2。本人専用Sitesのサンプル履歴は本番に含めない。

## 公開の流れ

1. [追加・改訂手順](ADDING-EXAMS.md)で問題・解説・採点・PDFを検証する。
2. ユーザーが公開を指示した変更をPRにまとめる。トップの導線、必要に応じてこのサイトについて・更新履歴・使い方を更新する。
3. `Integrated Study Atlas validation`の`validate`成功後にmainへマージする。既存のGitHub Pagesが配信する。
4. mainの同ワークフローで`verify-production`の成功を確認する。配信の反映を最大10分待ち、ページ・コード・カタログ・現行版教材・両PDFのSHA-256がコミット済みファイルと一致することを検証する。
5. ワークフローのArtifactsから`mock-exam-release-verification`を取得する。JSONに対象commit、検証ファイル、HTTP結果、実測統計を保存する。

通常の公開確認は既存Publishable keyで統計を読み取る。模試カタログ変更時（初回公開・新しい回・新版）には、ブラウザの接続確認ページと同じ`runRpcVerification`も実行する。変更のない再実行では二重にテストデータを作らない。手動のActions実行で`verify_mock_rpc`を指定すると、別の専用IDで再検証できる。

記録先は必ず新しい`qa_mock_<UUID>`、版1。実際のNo.001等には書き込まない。最終値はsingle=(2件、1正答、2点)、pair=(2件、1正答、3点)、partial=(3件、1正答、7点)、平均得点29/6点、平均得点率53.70%。部分点、複数マーク、未回答除外、途中採点・再開、既送信の変更、再受験、復習、保存復元、応答消失後の再送防止も同じシナリオで検証する。専用IDの匿名集計3行は検証記録としてDBに残る。

## 手動で再確認

公開サイトの`/mock-exams/connection-check.html`、または[Windowsローカル検証](WINDOWS-LOCAL-TEST.md)から実行する。追加SQL・Edge Function・Turnstile・管理キーは使用しない。CLIでは次のとおり。

```sh
# 公開ファイルの一致と統計の読取りのみ
node scripts/verify_mock_exam_release.mjs --wait-seconds 600 --report /tmp/mock-release.json
# 専用IDの記録・読戻しも行う場合
node scripts/verify_mock_exam_release.mjs --wait-seconds 600 --rpc-write --report /tmp/mock-release.json
```

Codex実行環境では通信先制限によるCONNECT 403が発生する場合がある。その場合はSupabaseのHTTP 403と区別する。公開確認ジョブは通常のGitHub Actions実行環境で動作する。ブラウザのCORSやWindows・Safari/iOS実機、DB内部の現在の関数定義の取得は、この公開確認だけでは検証しない。
