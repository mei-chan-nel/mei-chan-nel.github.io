# Study Atlas 実戦演習 — 保守の入口

現行仕様と作業手順はこの文書から参照する。初期要件の転載・過去の実装メモより、現在のユーザー指示と以下の文書を優先する。

| 目的 | 文書 |
|---|---|
| 新しい模試・新版を追加する | [ADDING-EXAMS.md](ADDING-EXAMS.md) |
| 問題・解説の編集方針 | [AUTHORING-RULES.md](AUTHORING-RULES.md) |
| 画面・PDFの表示方針 | [LAYOUT.md](LAYOUT.md) |
| 現行UIの確認項目 | [UI-REVISION.md](UI-REVISION.md) |
| 統計RPC・送信状態・計算式 | [SUPABASE-DIRECT-RPC.md](SUPABASE-DIRECT-RPC.md) |
| GA4の開始・採点・中断イベント | [ANALYTICS.md](ANALYTICS.md) |
| Windowsで本番通信を確認 | [WINDOWS-LOCAL-TEST.md](WINDOWS-LOCAL-TEST.md) |
| Sitesの公開先・最新配置 | [SITES-PREVIEW.md](SITES-PREVIEW.md) |
| GitHub Pagesへの公開と確認 | [RELEASE.md](RELEASE.md) |
| No.001・版2の改訂と検証 | [REVIEW-2026-10-29.md](REVIEW-2026-10-29.md) |
| 全体見直しの結果・確認限界 | [REVIEW-2026-10-28.md](REVIEW-2026-10-28.md) |

## 構成

- `mock-exams/app.mjs`, `app.css`, `index.html`: 一覧・受験・結果・履歴・復習。
- `engine/`: 問題定義検証、採点、端末保存、一覧、履歴集計、RPC・送信状態。
- `ui/`: 履歴の列操作、PCの問題／解説整列、スマホの設問別問題表示。
- `booklet.css`: 原稿固有の構造を保った画面／印刷の表示補正。
- `catalog.json`: 現行の模試一覧と旧版の場所。初期表示はおすすめ順。
- `exams/<No.>/<整数版>/exam.json`: 解答欄・採点単位・教材・原稿の出所。
- 同階層の問題／解説HTML: 印刷用。`screen/`: 印刷用埋込フォントを省いた画面用。
- `problem.pdf`, `solution.pdf`: 版固定の配布冊子。
- `source/`: 元原稿と、正答・設問番号を独立に確認した`qa.json`。Sitesでは配信対象外。

No.001の現行問題版は整数2。第2問Aは学校図書館の題材へ全面改訂し、旧版1の履歴・統計とは分ける。旧版の履歴・結果・復習・解説には「改訂前」を表示し、元の教材で開く。

2026年10月29日にmainへマージし、本番公開と専用IDによるSupabaseの記録・読戻しを確認済み。[公開時の検証結果](RELEASE.md#初回公開の検証結果)。

No.001は49解答欄・44採点単位・100点。大問はq1=20、q2a=15、q2b=15、q3=25、q4=25。問題冊子は33ページ、解答解説は34ページ。実在しない回は一覧へ追加しない。

## 現行動作

- 回ごと：一覧で60分／時間制限なしを選び、模試No.から直接開始。
- 大問ごと：大問を先に選び、「No.001の第1問」等から開始。同じNo.は通し受験と同じ問題。
- おすすめ順：未受験→中断中→採点済み。同じ状態では新しい順（公開日、番号降順）。番号順は昇順。
- 再開は保存済みの時間条件とUUIDを維持。最初から解くと新しい受験。各カードに2つのPDFダウンロードリンク。
- 問題末尾には対象の全大問への移動・残り時間（時間制限なしは解答時間）・採点・中断・一覧への操作を再掲する。上下の時間表示は同じ時計で更新し、スマホでも末尾の操作を使える。
- 数値・文字のソフトウェアキーボードには「確定」を表示。外側クリック／タップでも入力を保持して閉じる。スマホの受験中は上部の問題番号ナビを常に非表示にする。大問移動・中断・採点は問題末尾や解答状況メニューから行える。
- 通常の採点と時間切れは終了。途中採点は「ここまでを採点して中断」から行い、その後も再開できる。
- 採点結果は即時表示し、統計取得を待たない。得点・得点率の表、記号別の正解／本人回答／○✕△／平均得点率を表示。過去成績の列は任意展開。
- 学習履歴は専用画面。すべて／回ごとでは1受験1行。大問ごとでは通し受験も切り出す。列ごとの並び替え・値・範囲条件は各表示で保持。
- 復習は採点時の本人回答と正誤を背景色で表示する閲覧専用。回答変更・再採点はしない。
- PC解説は採点単位ごとに左右の上端を合わせる。160px以上の余白は「位置を合わせるための余白です。」と表示。
- 狭い画面は大問名の5ボタンで解説を切り替え、「問題を見る」で該当設問と必要な共通資料だけを表示。元の位置に戻れる。
- 完成プログラムには小さなStudioリンクを設ける。コード・初期値・1始まりの添字・外部入力設定を引き継ぎ、新しいタブで実行する。
- 画面用教材には原稿の版番号・柱・ページ番号を表示しない。枠の高さを内容に合わせ、縦スクロールは親ページに統一する。
- 履歴・結果・復習・解説の往復、戻る／進む、再読込みで表示条件と位置を復元する。
- 履歴削除は端末内の回答・得点を削除し、再送防止の送信状態だけを残す。匿名集計は取り消さない。履歴のファイル入出力は提供しない。

## 保存と通信

履歴は`study-atlas:mock-exams:v1:attempt:<UUID>`へ保存し、同じ内容を`:backup`にも保存・読戻し確認する。主記録が欠けてもバックアップから一覧へ復元する。既存学習アプリの保存領域・コードは変更しない。

時計は明示的な中断で停止する。受験中にページを閉じた場合は再開まで時間が進む。終了時に回答を固定して採点する。Web Locksで同じ受験の同時編集を抑制する。

ブラウザから既存の`record_mock_exam_results`と`get_mock_exam_stats`だけを呼ぶ。整数版・公開キーを使用。送信開始前に採点単位ごとの送信中状態を保存し、応答不明は自動再送しない。一度送った単位は変更しても送らず、新たな回答済み単位だけを送る。完全未回答・未採点中断・復習・サンプルは除外する。

Sitesだけにサンプル6件を初回追加する。通常の本番サイト用ファイルには含めない。既存履歴と削除済みサンプルは保持する。

## 変更時の検証

```sh
# 全掲載回・保持する旧版：定義、正答、設問番号、HTML、対応箇所、PDF
node scripts/check_mock_exams.mjs
node --test mock-exams/tests/*.test.mjs
# No.001の原稿との編集差分も確認
python3 scripts/validate_mock_exam_content.py  # 旧版1の原稿照合
python3 scripts/validate_mock_exam_001_v2.py   # 現行版の原稿・時刻・図・図書館の記録と状態
# 任意の新しい回を一覧へ登録する前にも操作検証できる
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser-added-exam.cjs exams/001/2/exam.json
```

ブラウザはChromium（`CHROMIUM_PATH`指定可）、Node.jsは22以降、Pythonは3.10以降＋lxml・PyMuPDF。PDF生成にはfontToolsと`fc-match`、日本語フォントも必要。閲覧にはこれらの開発依存は不要。

通常操作の回帰テストは`browser.cjs`、`ui-revision.cjs`、`browser-catalog.cjs`、`browser-stats.cjs`、`browser-loading.cjs`。Sites用distのテストは`browser-history.cjs`、`browser-grid.cjs`、`browser-navigation.cjs`、`browser-reading.cjs`、`browser-studio.cjs`。実行前に`python3 scripts/build_mock_exam_sites_preview.py`で配布内容を更新する。統計通信は全て模擬応答。本番接続の成功と混同しない。

GitHub Pagesの公開元はmain。公開時は統合検証に加え、配信ファイル・PDFと既存RPCをGitHub Actionsで確認する。模試一覧の変更時には専用テストIDで実際の記録・読戻しも行う。[公開手順と結果の確認方法](RELEASE.md)。Codex実行環境からの直接通信はプロキシで制限されるため、その403をSupabaseの応答と混同しない。DB内部の関数定義の取得とSafari/iOS実機は別途確認が必要。Sitesは本人専用プレビューとして扱う。
