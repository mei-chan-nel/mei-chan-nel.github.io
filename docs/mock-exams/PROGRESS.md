# 模試システム 再開用記録

最終更新: 2026-10-27（日本時間）。現在の方針は、**既存RPCをブラウザから直接呼ぶ方式**。以前の配置用コード・設定手順は撤去済み。新しいDBオブジェクトは作成しない。

## 現在の接続契約

- Project: info1-quiz-stats / yygezzpowsvpzarqdtls。URL・Publishable keyは既存学習アプリと同じ。
- `record_mock_exam_results(text,integer,jsonb)`：`section_id,scoring_id,answer,earned_points,max_points`を送り、`updated_count`を確認。
- `get_mock_exam_stats(text,integer)`：`items`配列を読む。
- 問題版は整数1。catalog、問題データ、受験履歴、RPCのすべてを統一。教材は`exams/001/1/`。原稿そのもののsourceVersionは編集版なので変更しない。
- No.001の旧開発版の履歴は、読込み時に文字列版から整数1へ変換する。UUIDと個人成績は保持。
- 作成時SQLの全文をユーザーから受領。`reference/existing-rpcs.sql`へ参照用に保存。本番DBから現在の定義を取得したものではない。

## 実装済み

- No.001の49欄・44採点単位・100点、時間制限あり／なし・大問別、入力UI・状態一覧・図拡大・プログラム穴埋め。
- 中断・再開・採点・復習・新規受験・履歴保存／書出し／読込み。版固定PDF32ページ＋35ページ。
- `engine/submission.mjs`：採点済みの未送信単位のみを直接RPCへ送信。送信を試みた単位は回答変更後も送らない。復習と完全未回答を除外。
- `statsDelivery`に単位ごとのsending/sent/unknownと時刻を保存。通信前に通常・backupの両方へ保存する。応答不明は再送しない。再読込み時のsendingはunknownへ変換する。
- 保存と履歴読込みで送信状態をマージし、古いバックアップ・古い履歴による再送を防ぐ。通信応答は個人の回答や最新成績を上書きしない。
- 同一ページの重なる採点は統計送信を順番に処理。Web Locks対応環境は別タブも排他。
- 統計は「正答率」「平均得点」「平均得点率」で表示。単位ごとの母数で平均を求めて合算。データなしはnullで扱う。
- 管理者用`connection-check.html`は、専用の`qa_mock_<UUID>`で実RPCの送信・読戻しを確認する。追加設定不要。結果JSONの保存に対応。
- 旧方式のコード・配置SQL・テスト・手順を削除。既存学習アプリのリポジトリは無変更。

## 検証

- `engine.test.mjs`：9テスト成功。採点規則、100点、完答、順不同、部分点、復習、履歴保存を確認。
- `submission.test.mjs`：9テスト成功。RPCの項目・整数版・items応答、初回単位のみ、結果不明、保存失敗、backup復旧、古い履歴のマージ、重なる採点、平均計算、版移行。
- `rpc-integration.mjs`：ユーザー提供SQLを使い捨てPostgreSQL17へ作成。anonロール・ローカルHTTPで送受信し、1.5点の部分点、入力順、初回の不正解保持、新規単位のみ、再受験、復習除外、応答消失、平均5.25/9点を検証。SQLの不正入力・途中エラーの全体ロールバック、直接書込み拒否、既存アプリsentinel不変も確認。
- `browser-stats.cjs`：Chromiumの通常操作で初回送信、送信済み変更の除外、不明状態を保持、新規単位を送信、復習除外、再受験、通常の平均表示を確認。通信は検証用応答。
- `connection-check-browser.cjs`：実接続確認ページの全工程を検証用応答で確認。
- `browser.cjs`：全項目成功。49欄、採点・中断再開・復習・図拡大・モバイル・時間切れ。期限のテストは現在の二重保存に合わせて両方のコピーを更新して再開を模擬する。
- 本番RPCの試行はHTTPSプロキシで `Tunnel connection failed: 403 Forbidden`。本番まで到達していない。公開キー自体の拒否ではない。本番の統計記録は一度も行っていない。

- 原稿／生成HTML／PDF内容検査：本文と図数一致、全67ページA4、長文の欠落0。
- ポータル検証：106ページ、105サイトマップURLで成功。
- 本番読取り試行の実測は `production-read-check.json` に保存。

## 再開時に必要なこと

1. SERVER.mdが現在の仕様。以前のSupabase設定依頼は取り消し済みで、追加SQL・秘密鍵・外部サービスの設定を求めない。
2. 本番通信を許可できる環境なら、`scripts/check_mock_exam_public.py`で読取り、`/mock-exams/connection-check.html`でテスト用模試IDへの送信と読戻しを確認する。通常No.001の統計をテストに使わない。
3. ホストの通信制限は現在も未解除。管理環境statusのallowed_hostsは空。変更を迂回しない。
4. 開発ブランチは`feat/mock-exams-001`。ローカルのみ。公開元mainへは未反映。公開時は既存workflowの兄弟アプリ同名ブランチ参照に注意する。
5. Safari/iOS実機と公式冊子の精密な組版比較は従来からの残項目。今回の接続変更とは独立。

## 保存・配布

実装と記録はこのブランチにコミットする。配布ZIPは`/workspace/output/study-atlas-mock-exams-direct-rpc.zip`。旧方式のZIPは誤適用防止のため作業出力から除く。
