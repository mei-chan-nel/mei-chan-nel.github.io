# 2026本試験 semantic source review

Owned scope: this folder only. Source: `mock-exams/exams/2026Honshi/1/source/problem.pdf`, all 34 PDF pages, decoded with `import_past_exams.page_data()`. The source PDF pages, native tables, code, diagrams, and answer options were visually checked. No keys, scoring rules, or shared application files were changed.

`q1.html`, `q2a.html`, `q2b.html`, `q3.html`, and `q4.html` are body fragments. Every original PDF page has exactly one `section.page[data-source-page]`, numbered 1–34. No reading anchors are authored here. Question/part labels are native headings; physical PDF line wraps are joined into complete semantic paragraphs. Radices are native subscripts. Original underlined references and misspelled email substrings retain underlines.

| Fragment | Original PDF pages | Answer fields | Native tables | Native programs | Diagram crops |
|---|---|---:|---:|---:|---:|
| q1 | 1–8 | 15 | 3 | 0 | 7 |
| q2a | 9–14 | 9 | 0 | 0 | 4 |
| q2b | 15–20 | 8 | 3 | 0 | 18 |
| q3 | 21–26 | 15 | 1 | 2 | 1 |
| q4 | 27–34 | 13 | 4 | 0 | 3 |

The tables include the year-list candidates, erroneous email examples, selectable server/reason rows, three truth tables, waiting-time table, flowering dates, selectable A/B truth combinations, and the two estimated-date/difference tables. Omitted rows/years in the original statistical tables remain explicitly omitted. Choice tables bind their rows. Ordinary choices use `fieldset.choices > .choice-grid > .option` with original values and captions, without duplicate OCR lists or secondary disclosure widgets. Six image options each retain their actual original image crop and original black/white caption. Histogram options refer to the numbered ranges in the original diagram.

The two programs use native `.program > .code > .code-row`, line-number/source spans, and verified depth levels. Their logical statements and blank references match original PDF pages24/25. Figure3’s insertion positions ⓪–③ are active native option rows at the correct depths; no duplicate insertion-position list is added. Figure4’s program output is native text. Source pages11 and20 use `data-pdf-fields` allowlists so root integration can replace the original diagram labels with active native answer overlays.

All 33 crops were separately rendered and visually inspected. Crops exclude original figure captions; captions are native HTML. The p17 reprinted background images and p19 image-option edges were checked against the source image bounds to avoid cutting their edges. The label for the bear in Figure9 is represented in its native caption because the original caption and that small annotation share a baseline.

Run `python scripts/past_exam_data/semantic/2026_main/build.py` to reproduce the five fragments and audits. `semantic-audit.json` verifies all34 pages, all60 fields, complete choice-value sets, absence of image/page embeds and reading anchors, and coverage of decoded source lines outside retained diagram crops. The only textual comparison exceptions are moving section points into native headings and representing the original masking square as a native boxed question mark. `paragraph-source-ranges.json` records manually selected source paragraph ranges. No unresolved transcription discrepancy was found.

Initial integrated proof PDFs at `/workspace/work/past-exam-semantic-proof/2026Honshi-{q1,q2a,q2b,q3,q4}.pdf` were visually reviewed. Native q2a/q3 content, program scopes, field boxes, tables, and captions are correct. Shared-layout defects were reported to root for CSS fixes: q1 selectable-table rows collapsed under generic option styling; q4 direct children flowed into narrow columns; q2b choice groups overlapped subsequent source pages in print. Those are integration/stylesheet issues, outside this folder’s ownership. Local direct Chromium launch is blocked by sandbox socket policy; root provides browser and PDF proof regression.


## 2026-11-18 統合後の最終確認（親担当）

共通CSSと原稿の統合後、HTMLから作成した校正PDFの最終版、PC・スマホ表示を確認した。初回proofで報告された旧第4問flex指定・選択肢table行・印刷用の列組み・改ページ時の重なり・長いコード行・SNS内選択肢・動画4フレームの不具合は共通生成処理とCSSで解消した。原本のページ区切りをサイトのpage要素として維持し、字幅で縦に伸びることを許容する。隠した科目見出しを読解対応点にしないことも確認した。

全214欄の入力・各100点、全40大問の問題→解説順序、元PDF保持とローカル資産・HTMLの検査が通る。採点定義・版は変更していない。校正成果物は `/workspace/work/past-exam-semantic-proof/`。本番には反映せず、確認用Sitesへ反映する。
