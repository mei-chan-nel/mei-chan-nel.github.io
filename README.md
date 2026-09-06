# 情報Ⅰ Study Atlas — ポータル

`https://mei-chan-nel.com/` の入口、用語解説、講義ノート、解説動画、書籍案内、サイト情報を管理するリポジトリです。学習アプリとタグ検索のデータ・ページ生成は、隣接する [`info1-quiz-app`](https://github.com/mei-chan-nel/info1-quiz-app) で管理します。

## 現在の公開構成

- トップページ：ファーストビュー、学習アプリ、3つの学習導線、使い方・書籍案内。
- 用語解説：`/terms/` の一覧（タグ一覧.xlsxの242タグ）と、note公開記事を移行した34ページ。
- 解説動画：5分野・21ジャンルの通常ページ（330問）と、プログラミング最短学習コース（27問）。各問題の動画はクリック時に読み込みます。
- 講義ノート：情報社会、デジタル、ネットワーク、統計、プログラミングの5分野。
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
data/video-questions.json  問題・答え・動画情報
data/video-curriculum.json 5分野・21ジャンル・最短コースの正本
scripts/generate_video_pages.py
scripts/generate_term_guides.py
scripts/import_note_term_pages.py
scripts/validate_manual_ads.py
scripts/update_sitemap.py
scripts/validate_portal.py
```

## 動画ページの再生成

原本と動画メタデータを更新した場合は、次の順で実行します。キーワード専用データや検索ページは現在の構成にありません。

```powershell
python scripts/import_video_questions.py <問題集.xlsx> <YouTube公開メタデータ.json>
python scripts/generate_video_pages.py
```

通常の分類・本文の変更は `data/video-curriculum.json` を編集してから `python scripts/generate_video_pages.py` を実行します。生成時にQ1〜Q330の重複、21ジャンルの網羅性、5分野の件数、最短コースの順序を検証します。

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

用語一覧はExcelのNo.順を正本にし、公開ページへのリンクは用語ページのタグメタデータを走査して生成します。URLのslugを推測して手動登録する必要はありません。

## 検証

```powershell
python scripts/validate_portal.py --app-root <info1-quiz-appのリポジトリルート>
python scripts/validate_manual_ads.py
python scripts/validate_study_atlas.py --portal-root . --app-root <info1-quiz-appのリポジトリルート>
```

ポータル検証では、動画の数値・URL、用語一覧の242タグとメタデータ由来リンク、SEOメタデータ・JSON-LD・パンくず・内部リンク・トップ構成・動画キーワード機能の不在・サイトマップ同期を確認します。手動広告検証では、対象ページだけに共通コードが1回あり、動画・講義・用語・アプリの枠数と位置が規則どおりであることを確認します。統合検証では、アプリの1,438問・229タグ、タグAND検索、アプリ復帰URL、学習アプリ本体の保護ハッシュも確認します。管理画面とスロット設定は [`docs/ADSENSE_CONFIGURATION.md`](docs/ADSENSE_CONFIGURATION.md) を参照してください。

## 公開URL

```text
https://mei-chan-nel.com/
https://mei-chan-nel.com/terms/
https://mei-chan-nel.com/info1-quiz-app/questions/
https://mei-chan-nel.com/info1-quiz-app/app/
```

公開元は `main` ブランチのリポジトリルートです。
