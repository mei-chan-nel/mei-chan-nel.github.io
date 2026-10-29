# Sitesでの実戦模試プレビュー

URL: https://study-atlas-mock-exams-preview.hal2718.chatgpt.site

## 最新配置

- 確認日時：2026-10-29 13:22（日本時間）。Sitesの配置結果は`succeeded`。
- project_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571`
- deployment_id：`appgdep_6ae2c9fb5e9c8191ba0da2458b029621`
- version_id：`appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_5a63a8f8783881918ed2f0f7f3a9a0ce`
- 配置ソースcommit：`7a47f258f1514b784392ee7c1a0260808742ae8a`
- 元サイトの実装commit：`149e1138c838b8fff46a6c9298aaa4d3d4c5df97`
- 閲覧範囲：既存の本人専用を維持。公開範囲は変更していない。
- Sites用チェックアウト：`/workspace/sites/study-atlas-mock-exams-preview`

ルートは最新のStudy Atlasトップ。説明文「共通テスト形式の模試で実戦的な演習を行います」のカードから`/mock-exams/`へ進む。現在の掲載はNo.001のみ。追加検証用No.002は含めない。

今回の配置はNo.001の問題版2。第2問Aの学校図書館への全面改訂、第1問の秒を含む時刻、第2問Bの図2移動、表の案内の条件表示、丸数字の共通化、新しいPDFを含む。[改訂と検証](REVIEW-2026-10-29.md)。旧版1は履歴用に残し、「改訂前」と表示する。

操作面には、ソフトウェアキーボードの「確定」とスマホの問題番号ナビの下スクロール時非表示・上スクロール時再表示を含む。外側タップによる入力保持と閉じる操作を維持。390pxのタッチ対応Chromium・PC・既存UI操作で確認済み。

前回までの配置には、解説の誤答理由、透かし・柱の除去、枠内スクロール解消、余白案内の短縮、完成プログラムのStudioリンク、読込・保存処理の修正を含む。[見直し結果](REVIEW-2026-10-28.md)を参照。

## 統計・履歴

通常の受験は、ユーザーの許可に基づき本番No.001（exam_id="001", exam_version=2）へ匿名集計する。ブラウザから既存2RPCへ直接接続する。既存学習アプリのコード・保存領域は変更しない。

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

統計通信の自動テストは模擬応答。Codex環境のプロキシ制限により、本番RPCの実送受信・実DB定義の取得は未確認。[Windowsの実接続確認手順](WINDOWS-LOCAL-TEST.md)を使う。Safari/iOS実機は未確認。

GitHub Pagesの公開元mainは変更していない。本番サイトへの反映はユーザーのローカル検証後に行う。
