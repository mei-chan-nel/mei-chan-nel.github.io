# Study Atlas 実戦模試

入口: `/mock-exams/`。静的配信のみで受験・採点・ローカル履歴・復習・PDF閲覧が動作する。既存学習アプリのソース・ストレージキー・Supabase RPCは変更していない。

## ファイル構成

- `mock-exams/index.html`, `app.mjs`, `app.css`: 一覧、受験、結果、履歴、復習の共通画面。
- `mock-exams/booklet.css`: PC・モバイル・印刷の教材表示補正。
- `mock-exams/engine/`: 共通採点、受験状態、ローカル保存、統計取得、採点単位ごとの送信状態管理。
- `mock-exams/catalog.json`: 現行模試一覧（表示時は番号の降順）。
- `mock-exams/exams/<番号>/<版>/exam.json`: 解答欄・採点単位・教材の定義。
- 同階層の `q1.html` など: 原稿を保持し解答バインディングを追加した教材。iframeで元のCSSを隔離する。原稿のscriptとイベント属性は除去する。
- `source/`: 改変しない入力原稿。教材側はnoindex。原稿を公開対象から除外したい場合はホスティング設定側で除外可能。
- `problem.pdf`, `solution.pdf`: 端末によらず同じA4冊子。
- `mock-exams/connection-check.html`: テスト用模試IDによるRPC接続確認。接続契約はSUPABASE-DIRECT-RPC.md。

## データと描画の分離

HTMLを固定のテンプレートへ再入力せず、原稿ごとのアダプターが次の共通属性を付ける。CSSクラス、表組み、SVG、図、プログラムの構造は教材ごとに異なってよい。新しい原稿で変更するのは教材の変換処理とexam.jsonのみ。

| 属性 | 意味 |
|---|---|
| `data-field="q1-ア"` | 共通解答欄ID。複数箇所に同じIDを置くと同期する |
| `data-original="ア"` | 未回答時に表示する記号 |
| `data-display="content"` | 番号の代わりに選択した式や命令を埋める |
| `data-part="0"` | 選択肢の `parts` の該当部分を表示。No.001の第4問A/Bで使用 |
| `data-choice-fields="q2a-イ q2a-ウ"` | 選択肢を共有する解答欄。対象が不明なときは欄を選ぶ |
| `data-choice-value="1"` | クリック時の回答値 |

選択肢の短い内容は番号＋内容、長い内容は番号だけで欄に表示する。選択肢本文は原稿のまま選択でき、ポップアップにも内容を表示する。

### exam.json

`schemaVersion:1`、`id`、正の整数の`version`（初期値1）、`durationSeconds`、`maxPoints`、`sections`、`fields`、`scoring` が必須。

`fields` は `id, sectionId, label, type` を持つ。choiceは `choices:[{value,text,parts?}]`、textは `allowed` と `maxLength` を指定。0〜9/A〜Fの4×4キーパッドは許可文字以外を無効にする。物理キー、削除、クリア、次の欄も利用可能。

`scoring` は `id,sectionId,fields,maxPoints,rule` を持つ。fieldsの順序が統計の回答キーの順序となる。

```json
{
  "id": "q2a-02", "sectionId": "q2a", "fields": ["q2a-イ", "q2a-ウ"], "maxPoints": 3,
  "rule": {"kind": "unordered", "patterns": [["1", "5"]]}
}
```

採点規則:

- `exact`: patternsのどれかと順序を含めて一致すれば満点（単一・順序指定完答・複数正答）。
- `unordered`: 重複を含む多重集合として一致すれば満点。同じ番号の重複を勝手に除かない。
- `unordered-partial`: patternsと一致した要素数に応じ `pointsByMatches:[0,1,3]` の点を与える。
- `cases`: `cases:[{answers:[...],points:1,unordered:false,when?:...}]` を先頭から照合。特定誤答への部分点など。
- `conditional`: `when` に応じ `then` / `else` の採点規則を適用。
- 条件は `field/equals`、先行採点単位の `unit/atLeast`、`all:[...]`、`any:[...]`。依存先の採点単位は先に並べる。任意コードやevalは使わない。

No.001: 49解答欄、44採点単位、100点。q1=20、q2a=15、q2b=15、q3=25、q4=25。

## No.002以降の追加

1. `exams/002/1/source/` に問題・解説の原本を保存する。
2. 原稿に合わせたアダプターを用意する。No.001の `scripts/import_mock_exam_001.py` は具体例であり、共通エンジンはそのHTML構造に依存しない。図表・選択肢を保持し上記属性を付ける。
3. `exam.json` を作り、正答・配点・完答条件を原稿と照合する。IDは版内で固定する。新しい採点ルールが必要なら既存ルールとの互換性を保ってengineに追加しテストする。
4. catalog.jsonに `id, version, title, manifest` を追加する。
5. 採点・内容比較・PC/スマホ操作テストを行う。PDFを生成する。
6. 採点単位ID・配点・回答形式が既存RPCの制約に適合することを確認する。サーバー側への問題登録は不要。

改訂時は旧版フォルダーを上書きしない。catalogの現行版を更新し、同じエントリーの `versions:[{"version":1,"manifest":"exams/001/1/exam.json"}]` に旧版を保持する。旧履歴は旧版で再開され、統計もexam_version別になる。

## 保存と時間

既存アプリとは別の `study-atlas:mock-exams:v1:attempt:<UUID>` を使用。同じ保存内容を通常キーとbackupキーに書き込み、読み戻して確認する。送信状態は両方からマージして過去へ戻さない。保存失敗を表示し、受験画面の書き出しには未保存のメモリー内回答も含める。Web Locks対応ブラウザでは同じ受験の別タブ同時編集を拒否する。非対応ブラウザでは同時編集をしないよう明示する。

経過時間は開始タイムスタンプと累計で管理。明示的な中断で時計を停止。受験中に閉じた場合は次の再開まで時間が進む（60分モードの抜け道を作らない）。制限時間後は自動採点。同じ受験を時間制限なしへ切り替えて続けることもできる。

採点ごとにローカルのrevisionを増やす（RPCには送信しない）。復習は別answers/lockedに保存し、受験成績・統計送信には触れない。完答問題は採点単位全体を復習対象にする。履歴の読み込みでは型・値を検証し、得点を再計算する。

## 検証・プレビュー

```sh
python scripts/preview_site.py --host 127.0.0.1 --port 8773
# http://127.0.0.1:8773/mock-exams/
node mock-exams/tests/engine.test.mjs
python scripts/import_mock_exam_001.py
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/build_mock_exam_pdfs.cjs
python scripts/validate_mock_exam_content.py
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser.cjs
python scripts/validate_portal.py --app-root ../info1-quiz-app
```

Python変換にはlxml、PDFの結合・検査にはPyMuPDF、出典用フォントの軽量化にはfontToolsが必要。PDFビルド・ブラウザ検証にはPlaywrightとChromium。サイト閲覧自体は依存パッケージ不要。画像・スクリーンショット等の検証中間成果はwork/へ保存する。

PDFは版固定の静的ファイル。スマートフォンでも同一PDFを開き、PDFビューアから印刷・保存する。再生成時はページからはみ出す教材を検出し、80%未満の縮小が必要なら失敗させる。No.001は32ページの問題冊子、35ページの解説冊子。ヘッダーに原稿版、右下に指定出典、中央に通しページ番号を記す。

## Supabase接続と検証の範囲

[SUPABASE-DIRECT-RPC.md](SUPABASE-DIRECT-RPC.md)に既存2つのRPCの契約と送信状態の仕様を記載。DBへの追加適用や中間サービスの設定は不要。現在の環境は本番ホストへの通信が403で遮断されるため、本番送受信は未確認。ユーザー提供SQLと一時PostgreSQLでの送受信、およびブラウザの通常操作を検証する。

Safari/iOS実機と公式冊子との精密な組版比較は前回からの残項目。LAYOUT.mdを参照。

## Windowsローカル検証

[WINDOWS-LOCAL-TEST.md](WINDOWS-LOCAL-TEST.md)を参照。配布ZIPにはWindows標準PowerShellで動くHTTPサーバーと、依存ファイルをまとめた検証ページを含む。開発者が再生成する場合は`ESBUILD_MODULE=/path/to/esbuild node scripts/build_mock_exam_windows_qa.cjs`。ビルドにだけesbuildを使用し、配布物の実行には不要。

本番サイトへのデプロイは、Windowsでの実接続検証後に行う。

## 入力・結果画面（2026-10-28）

最新の変更と検証はUI-REVISION.md、教材編集ルールはAUTHORING-RULES.md。画面用のscreen/HTMLは印刷用フォントを含めず、先読みして切替時に再利用する。印刷用HTMLとPDFは従来の組版を保持する。プレビュー更新はscripts/build_mock_exam_sites_preview.pyでStudy Atlasトップから準備する。

採点表は解答記号ごとの行と、複数欄の採点単位に応じた行結合を使う。過去回答は同じ受験条件の過去履歴から任意表示する。削除操作では端末の回答・得点を除き、送信マークだけを残して古い履歴の再送を防ぐ。匿名集計の取消しは行わない。
