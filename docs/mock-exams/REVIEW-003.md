# No.003 — 取り込みと本人専用プレビュー

## 作業範囲

2026-11-08。公開済みmain `c93c857afc641a211d968ec99ce1e77571328a58` を取り込み、ローカル `feat/mock-exams-003` で作業。本番mainへは反映せず、未公開の原稿・問題を公開GitHubへpushしない。プレビューは既存の本人専用Sitesを更新する。

同commitのGitHub Pages配置 `42364554400` は成功。公開ドメインへの実行環境からの接続は、HTTPS CONNECTの段階でプロキシenvoyが403を返すため直接閲覧できなかった。したがって最新の配置済みソースを基準とした。

なお、同commitの統合CI `42364554859` は既存の `study-guide.html` の見出し番号検査で失敗し、公開後検証jobはskip。Pagesの配置成功と統合CIの成功を混同しない。この取り込みでは、別途編集された使い方ページ・全体検証の修正は行っていない。

## データと体裁

- `exam_id="003"`, 整数 `exam_version=1`。配点は20・15・15・25・25点、計100点。53欄・48採点単位。公開日は未設定。
- 受領HTML10件は `exams/003/1/source/` に改変せず保存。各原稿のSHA-256をmanifestへ記録。正答・配点・問番号の照合用データは独立に原稿から `source/qa.json` へ転記。
- 専用アダプター `scripts/import_mock_exam_003.py` はNo.003の版1だけを生成する。No.001・002の教材・採点・問題版とcatalogは書き換えない。登録は既存 `register_mock_exam.mjs` で行う。
- PCでは紙面、スマホでは切れ目のない画面。柱、元のページ番号・管理番号・版番号を除去し、画面書体をシステムフォントへ統一。「問n」は太字。解答枠はNo.002第3問に合わせ、前後に半角空白を入れる。丸数字を二重に囲まない。
- プログラムの分岐・反復の終端線は既存共通CSSを使い、行の文字の下まで伸ばす。選択肢群の枠・見出し間隔も既存形式を継承。
- 正答一覧・作問方針・検証報告・測定する力などを解説から除去。各単位の見出しと正答・配点を共通化し、正誤は（正）・（誤）で示す。第2問Aの詰め込まれた誤答理由を分離。理由の列は左揃え、数値・短いラベルは中央揃え。
- 第1問の16進数2欄はいずれも0～9・A～Fを直接入力する。丸付き英字へ変換する紙用の注記は除去。
- 第2問Aで同じ写真が4回埋め込まれていたものを、画質を変えずWebP1点（約1.5MB）に共通化。画面HTML10件は合計約385KB、印刷専用の埋込フォントは配信しない。
- PCの左右表示は48単位の全対応点を確認。スマホの「問題を見る」は必要な前提図表と当該設問を抽出する。
- 第3問の完成図2・4・6をStudioの既存共有形式へ接続。添字開始は1。図4・6には人数と空の座席を初期設定。図6の日本語論理演算をStudioのor・andへ対応させる。
- 第2問Bの更新処理を既存フローチャートラボへ接続。表2の乱数列8分に方法Cを適用し、待ち人数と最大値を表示する。
- データの出典・CC BY 4.0・集計に必要な加工説明は保持する。第4問の元のExcelはZIPにないため、生データからの再集計は行っていない。
- 問題PDF34ページ・解説PDF28ページ。全ページA4、共通のNo.・ページ表示を使用し、本文の欠落を検査。第2問は共通の「第2問／A／B」の書き出しとする。

## 検証

- `node scripts/check_mock_exams.mjs`：No.001の現行版2と旧版1、No.002、No.003の正答・配点・問番号、全選択肢、原稿SHA、問題／解説の対応、PDF本文・全ページのフッターを照合。
- `python scripts/validate_mock_exam_003.py`：パケットの待機容量と再送量、B8、受付の時系列更新とヒストグラム、座席配置と74回、最適性の反例、割合の逆転を独立計算。
- `node --test mock-exams/tests/*.test.mjs`：共通動作と新規Studio3本・フローチャートの実行結果を確認。
- `browser-added-exam.cjs exams/003/1/exam.json`：全53欄の実操作→100点、48単位の記録RPC本文、通し・時間なし・大問別、採点／中断、GA、PC／スマホ解説と復帰を模擬通信で確認。
- 最終Sites配信物でも全53欄→100点、全左右対応点、スマホ復帰を確認。Sitesは従来どおりGAタグを除くため、GA検査は開発元で行う。
- `browser-catalog.cjs`：3回分の一覧、No.順・状況順、直接開始・再開・PDF導線。`browser-reading.cjs`, `browser-history.cjs`：従来のNo.001履歴・復習・全44対応点・戻る／進む・再読み込み・破棄確認も検査。
- PC1333px／984px／スマホ390pxで全5大問の問題・解説、計30通りを確認。横へのページはみ出しなし。PDFの各大問先頭も目視。
- ブラウザの自動検証はすべてRPCを模擬し、No.001～003の実統計へテスト回答を送らない。通常のプレビュー受験は従来の許可どおり各模試ID・版へ記録する。Safari/iOS実機は未確認。

## 再生成

```sh
python scripts/import_mock_exam_003.py
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/build_mock_exam_pdfs.cjs --manifest exams/003/1/exam.json
node scripts/check_mock_exams.mjs exams/003/1/exam.json
python scripts/validate_mock_exam_003.py
node --test mock-exams/tests/*.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser-added-exam.cjs exams/003/1/exam.json
node scripts/register_mock_exam.mjs exams/003/1/exam.json
python scripts/build_mock_exam_sites_preview.py
```

原稿差し替え時は、アダプターと独立QAを照合し、必要なPDFだけ再生成してからSitesへ配置する。正答や配点を公開後に変える場合は整数版を上げる。公開の指示が来るまではmainへマージしない。
