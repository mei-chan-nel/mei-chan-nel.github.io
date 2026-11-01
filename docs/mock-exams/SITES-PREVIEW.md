# Sitesでの実戦演習プレビュー

URL: https://study-atlas-mock-exams-preview.hal2718.chatgpt.site

## 最新配置（2026-11-01）

おすすめ順・表の配置・ラボ連携の追加反映：2026-11-01 16:25（日本時間）、配置成功。本番未変更。
ソース`10c33563fdc5ea44f2deb4dcaf127fc040384286`、deployment `appgdep_6ae6e96dcb188191b537ff9bd2a210bf`、version `appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_7817f90a32e88191a2af6d04d9501b4f`。

## 直前の配置（同日）

設問番号・No.002の解説・初期読み込みを見直し、本人専用Sitesへ反映。本番GitHub Pagesは未変更。

- 作業元：`feat/mock-exams-002` のローカルcommit `fe96f6451bb2a01709f15af1f6d439884cef72e7`。公開GitHubへpushしていない。
- Sites配置ソース：`66942aec130e66fc0de12c9f5c4a38bf9f82fe8e`。
- deployment_id：`appgdep_6ae6e6876f648191bc25f1a9419225ff`。
- version_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_5d16d2cfa6748191a63c4ef6cb2be06e`。
- 配置結果：`succeeded`。2026-11-01 16:13（日本時間）。本人専用の閲覧範囲を維持。
- No.001現行版2・旧版1とNo.002の「問n」を画面・問題PDFで太字に統一。No.002解説は正答・配点・選択肢番号・正誤理由を整理した。No.002の解説PDFは34ページ。採点定義・問題版・元原稿は変更していない。
- 一覧を初期HTMLに含め、受験・履歴・解説の画面本体は操作時に取得。方式・大問・並び順だけでは問題本文・解説・RPCを取得しない。初回の問題取得失敗後の再試行も確認した。
- 全回・旧版の教材／PDF検査、単体テスト11件、一覧の20回分検査、既存履歴・復習・復帰、PC／スマホ解説、No.002全55欄の採点・46単位の模擬送信・全対応点の左右整列が通過。
- 配布アーカイブ148ファイルがpush済みソースと一致。Sites配信対象から元原稿・QA・テストを除外し、本番の模試統計へ検証データを送っていない。

## No.002初回取り込み（同日）

No.002を本人専用Sitesへ追加した。本番GitHub Pagesは変更していない。[取り込み・検証](REVIEW-002.md)。

- 作業元：`feat/mock-exams-002` のローカルcommit `77578fe`。未公開のNo.002は公開GitHubへpushしていない。
- Sites配置ソース：`67bfec28776a673e575b7399866e084bfd1b5bf1`。
- deployment_id：`appgdep_6ae6de2c89c48191a801f4bddc1b2d06`。
- version_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_6832ec780cbc819189ebdaad7b6c0234`。
- 配置結果：`succeeded`。2026-11-01 15:37（日本時間）。本人専用の閲覧範囲を維持。
- No.002：整数版1、55解答欄・46採点単位・100点。問題PDF32ページ・解説PDF31ページ。
- 配布物の検証：2回分の一覧、PDFダウンロード、全55欄入力→100点、46単位の送信形式、3受験モード、全大問の左右対応、スマホの設問別表示・復帰を確認。No.001の既存解説・履歴復帰も確認した。RPCは模擬応答で、本番の模試統計には検証データを送っていない。
- 配布アーカイブの146ファイルがpush済みcommitと一致。原稿・QA・テストを含めず、既存No.001の教材に変更がないことも確認した。

## 本番との同期（同日、No.002取り込み前）

No.002の取り込み前に、本番main `67f8345234af1efc739c4390e40a25aabbc31212` を同期した。

- 作業ブランチ：`feat/mock-exams-002`。GitHubへ保存済み。本番mainのコード変更は行っていない。
- 本番から保持した変更：実戦演習への名称変更、PDFの「問n」の太字化、iOS Safariの入力修正、StudioのSNS画像設定修正。
- Sites配置ソース：`cc9364a6beee3ea0e52bad8cf711a0eb91efa0a2`。
- deployment_id：`appgdep_6ae6abc78ccc81918961b9808bdef2c5`。
- version_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_ff1abc6df500819182f2ee3570d17dfc`。
- 配置結果：`succeeded`。2026-11-01 12:02（日本時間）。本人専用の公開範囲を維持。
- 検証：67個の実行・教材ファイルが本番ソースと一致。原稿・採点・PDF検査、Sites専用の履歴・復習・再開・PC／スマホ解説・設問別表示を検証済み。Sitesのサンプル履歴・noindexは維持、GAタグはプレビューから除外。
- No.002は未登録。次の取り込みではこのブランチと既存Sitesを継続して使用する。

## 前回配置（2026-10-29）

- 確認日時：2026-10-29 14:38（日本時間）。Sitesの配置結果は`succeeded`。
- project_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571`
- deployment_id：`appgdep_6ae2dbdc952481919b85e408ae9fd489`
- version_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_824abf0374e88191ad1146c71d18ee89`
- 配置ソースcommit：`6b20c2036f618e7e706f7641bbd3ee65b9e35594`
- 元サイトの実装commit：`7203d5e6d0caa6efd2cc84f40dae19a259c1fbbd`
- 閲覧範囲：既存の本人専用を維持。公開範囲は変更していない。
- Sites用チェックアウト：`/workspace/sites/study-atlas-mock-exams-preview`

ルートは最新のStudy Atlasトップ。説明文「共通テスト形式の模試で実戦的な演習を行います」のカードから`/mock-exams/`へ進む。現在の掲載はNo.001のみ。追加検証用No.002は含めない。

今回の配置は、スマホトップのカードを約72pxに縮小（アイコン・表題横並び、説明・矢印なし）、スマホ受験ヘッダーの常時非表示、第2問Aの題材名削除を反映。問題PDFも更新し、配点・採点は問題版2を維持。タッチ対応Chromiumで表示・確定・中断、PC表示、原稿とPDFの照合を確認済み。

教材はNo.001の問題版2。第2問Aの学校図書館への全面改訂、第1問の秒を含む時刻、第2問Bの図2移動、表の案内の条件表示、丸数字の共通化、新しいPDFを含む。[改訂と検証](REVIEW-2026-10-29.md)。旧版1は履歴用に残し、「改訂前」と表示する。

操作面には、ソフトウェアキーボードの「確定」とスマホ受験中の上部問題番号ナビの常時非表示を含む。外側タップによる入力保持と閉じる操作を維持。390pxのタッチ対応Chromium・PC・既存UI操作で確認済み。

前回までの配置には、解説の誤答理由、透かし・柱の除去、枠内スクロール解消、余白案内の短縮、完成プログラムのStudioリンク、読込・保存処理の修正を含む。[見直し結果](REVIEW-2026-10-28.md)を参照。

## 統計・履歴

通常の受験は、ユーザーの許可に基づき、選んだ模試のID・版（No.001は`exam_id="001", exam_version=2`、No.002は`exam_id="002", exam_version=1`）へ匿名集計する。ブラウザから既存2RPCへ直接接続する。既存学習アプリのコード・保存領域は変更しない。

Sitesだけに成績確認用のサンプル履歴6件を初回追加する。サンプル・復習・解説閲覧では記録RPCを呼ばない。既存履歴やサンプル削除状態を上書きしない。

## 配布内容と更新

1. 開発元で問題・採点・画面・PDFの必要な検査を通す。[保守の入口](README.md)、[追加手順](ADDING-EXAMS.md)。
2. 既存Sitesのアクセス範囲とソースリポジトリを確認し、同じチェックアウトを更新する。別Siteは作らない。
3. `python3 scripts/build_mock_exam_sites_preview.py`でdistを作る。模試の原稿・テスト・接続診断ページは配信しない。
4. 生成されたdistをローカルHTTPとChromiumで検証する。履歴・復帰・解説・Studioのブラウザテストはこのdistを使う。
5. Sitesの短期Git認証を使い、正確なソースをcommit/pushする。認証トークンはファイル・ログへ残さない。
6. そのcommitと一致する`.openai/hosting.json`およびdistをアーカイブし、本人専用Siteへの保存・配置を行う。成功結果のID・SHAをこの文書へ記録する。

Studioは既存`program-trace/studio/`をそのままコピーして、同じプレビュー内で完成プログラムを実行する。新たな読み込みAPIや実行エンジンは設けていない。解説は元のタブに残る。その他の教材メニューは公開済みStudy Atlasへつながる。

## 確認範囲

Sitesに配置したファイルで、49欄の採点、履歴、PCの左右整列、900px・390pxの解説、設問別表示からの復帰、Studio2本の実行完了をローカルで確認。旧版1の履歴が元の工具レンタル問題・15点で開けること、版1／2で統計取得が分かれることも確認。Sitesの配信完了は配置サービスの`succeeded`で確認した。

Sites画面の統計通信の自動テストは模擬応答。本番公開時には通常のGitHub Actions環境で既存RPCの実送受信を確認済み（専用IDのみ）。[公開時の検証結果](RELEASE.md#初回公開の検証結果)。実DB内部の関数定義とSafari/iOS実機は未確認。[Windowsの実接続確認手順](WINDOWS-LOCAL-TEST.md)も保持する。

Sitesは本人専用プレビュー。本番公開はGitHub Pagesのmainを使用し、公開確認は[RELEASE.md](RELEASE.md)の手順で行う。Sites用のサンプル履歴や設定は本番ファイルへ含めない。
