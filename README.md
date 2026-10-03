# 情報Ⅰ Study Atlas — ポータル

`https://mei-chan-nel.com/` の入口、用語解説、講義ノート、解説動画、書籍案内、サイト情報を管理するリポジトリです。学習アプリとタグ検索のデータ・ページ生成は、隣接する [`info1-quiz-app`](https://github.com/mei-chan-nel/info1-quiz-app) で管理します。

## 現在の公開構成

- トップページ：ファーストビュー、学習アプリを含む6つの学習導線、使い方・書籍案内。
- 用語解説：`/terms/` の一覧と、公開中の用語解説。記事未作成のタグは一覧に表示しません。
- 解説動画：5分野・21ジャンルの通常ページ（330問）と、プログラミング最短学習コース（27問）。各問題の動画はクリック時に読み込みます。
- 講義ノート：情報社会、デジタル、ネットワーク、統計、プログラミングの5分野。
- プログラムトレース：代表問題15問と動画のプログラミング問題100問を1行ずつ実行。
- 問題検索：`/info1-quiz-app/questions/` のタグAND検索（1,438問・229タグ）。

## 主なファイル

```text
index.html                 ポータルトップ
archive/                   動画一覧・21ジャンル・最短コース
LectureNote/               講義ノート5分野
books/                     書籍案内
assets/site.css            共通デザイン
assets/term-page.css       用語一覧・用語解説のデザイン
assets/term-guides.js      用語タグと解説URLの生成レジストリ
assets/video-embeds.js     クリック時の動画埋め込み
assets/home-learning.js    学習履歴サマリー
assets/manual-ads.js       手動AdSenseユニットの中央設定・初回初期化
program-trace/             プログラムを1行ずつ実行するページ
data/video-questions.json  問題・答え・動画情報
data/video-curriculum.json 5分野・21ジャンル・最短コースの正本
data/term-tag-list.json    ExcelのNo.順を保持する公開用の用語タグ一覧
scripts/generate_video_pages.py
scripts/generate_term_guides.py
scripts/import_note_term_pages.py
scripts/validate_manual_ads.py
scripts/update_sitemap.py
scripts/validate_portal.py
scripts/preview_site.py    ポータルと隣接アプリを同じURL構成で確認するローカルサーバー
```

## プログラムトレース

「プログラムトレース」は、このリポジトリの `program-trace/` で管理します。
本番公開時の入口は `https://mei-chan-nel.com/program-trace/`、個別の代表問題は
`/program-trace/#addition` など、動画解説問題は `/program-trace/#video-q-231` の形式です。
代表問題15問に加え、動画のプログラミング問題Q231〜Q330の100問を収録しています。
通常の動画ページと最短学習コースの計127か所で、「解説動画を表示」の右側に
「1行ずつ実行する」を表示します。`?from=<動画ページの分類ID>` で移動元を保持し、
実行画面の「問題へ戻る」から元のページ・問題へ戻れます。
共通ヘッダー・フッターに「プログラムトレース」のリンクを用意しています。
公開ページには検索向けメタデータと構造化データを設定し、XML・HTMLのサイトマップへ登録しています。

```powershell
python scripts/preview_site.py --host 127.0.0.1 --port 8773
node --test scripts/program-trace.test.mjs scripts/program-trace-video.test.mjs
```

ブラウザで `http://127.0.0.1:8773/program-trace/` を開きます。
このサーバーは `/info1-quiz-app/` を隣接するアプリのリポジトリへ接続するため、
ヘッダーの「学習アプリ」も本番と同じパスで確認できます。別の配置では `--app-root` を指定します。
詳細は [docs/PROGRAM_TRACE.md](docs/PROGRAM_TRACE.md) を参照してください。
既存の統合検証は `scripts/*.test.mjs` を自動的に検出するため、移したテストも対象になります。

## 動画ページの再生成

原本と動画メタデータを更新した場合は、次の順で実行します。キーワード専用データや検索ページは現在の構成にありません。

```powershell
python scripts/import_video_questions.py <問題集.xlsx> <YouTube公開メタデータ.json>
python -X utf8 scripts/build_video_programs.py
python scripts/generate_video_pages.py
```

通常の分類・本文の変更は `data/video-curriculum.json` を編集してから `python scripts/generate_video_pages.py` を実行します。生成時にQ1〜Q330の重複、21ジャンルの網羅性、5分野の件数、最短コースの順序を検証します。
プログラミング問題の原文・答えや最短コースの対象問題を変更した場合は、先に
`scripts/build_video_programs.py` で実行データを再生成します。実行データは原文のハッシュで照合し、
未更新の状態では動画ページの生成を止めます。問題ごとの穴埋め・入力条件・前提表はこの生成スクリプトで管理します。

## 講義ノートとサイトマップ

```powershell
node scripts/build_lecture_data.mjs
node scripts/build_lecture_pages.mjs
python scripts/update_sitemap.py --app-root <info1-quiz-appのリポジトリルート>
```

`--check` を付けると生成物を変更せず整合性を検査できます。サイトマップはポータルとアプリのビルドレポートから、現行の公開URLだけを組み立てます。

## 用語解説

noteの用語解説記事を移行するときは、移行記録と対応表を [`docs/TERM_GUIDE_MIGRATION.md`](docs/TERM_GUIDE_MIGRATION.md) で確認します。用語ページを追加したら、ページの `<meta name="study-atlas-term-tag">` を設定し、次を実行します。

```powershell
python scripts/generate_term_guides.py
python scripts/update_sitemap.py --app-root ..\info1-quiz-app
```

用語一覧はExcelのNo.順を正本にし、用語ページのタグメタデータを走査して、公開ページがある用語だけをリンク付きで生成します。記事未作成のタグは表示されず、ページ追加後にこの生成処理を実行すると自動的に一覧へ加わります。URLのslugを推測して手動登録する必要はありません。
通常の生成・検証では `data/term-tag-list.json` を読み込み、PC固有のファイルや追加ライブラリに依存しません。
元のExcelを更新したときは、`openpyxl` が使える環境で次を実行して公開用スナップショットを更新します。

```powershell
python scripts/generate_term_guides.py --tag-list <タグ一覧.xlsxのパス> --update-tag-list
```

## 検証

```powershell
python scripts/validate_portal.py --app-root <info1-quiz-appのリポジトリルート>
python scripts/validate_manual_ads.py
python scripts/validate_study_atlas.py --portal-root . --app-root <info1-quiz-appのリポジトリルート>
```

ポータル検証では、動画の数値・URL、用語一覧が公開済み記事だけをメタデータ由来リンクで表示していること、SEOメタデータ・JSON-LD・パンくず・内部リンク・トップ構成・動画キーワード機能の不在・サイトマップ同期を確認します。手動広告検証では、対象ページだけに共通コードが1回あり、動画・講義・用語・アプリの枠数と位置が規則どおりであることを確認します。統合検証では、アプリの1,438問・229タグ、タグAND検索、アプリ復帰URL、学習アプリ本体の保護ハッシュも確認します。管理画面とスロット設定は [`docs/ADSENSE_CONFIGURATION.md`](docs/ADSENSE_CONFIGURATION.md) を参照してください。

## 公開URL

```text
https://mei-chan-nel.com/
https://mei-chan-nel.com/terms/
https://mei-chan-nel.com/info1-quiz-app/questions/
https://mei-chan-nel.com/info1-quiz-app/app/
```

公開元は `main` ブランチのリポジトリルートです。
