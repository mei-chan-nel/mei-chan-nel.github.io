# 情報Ⅰ Study Atlas — ポータル

`https://mei-chan-nel.github.io/` で公開するサイト全体の入口です。

このリポジトリでは次を管理します。

- 学習ポータルトップ
- 共通テスト「情報Ⅰ」の勉強法
- 動画で学ぶ一問一答330問
- Kindle問題集4冊の紹介
- このサイトについて
- 全体プライバシーポリシー
- 共通デザイン
- ホスト直下の `ads.txt` と `robots.txt`
- ポータルとアプリ／問題一覧をまとめたサイトマップ
- フッターから利用できるHTMLサイトマップ
- AdSense再審査の設定・検証記録

学習アプリ、問題データ、問題一覧ページは、別リポジトリ [`info1-quiz-app`](https://github.com/mei-chan-nel/info1-quiz-app) で管理します。

## フォルダ構成

```text
index.html
study-guide.html
about.html
privacy.html
sitemap.html
archive/
  index.html
  <4分野・10問区切りの生成ページ>.html
books/
  index.html
assets/
  site.css
  favicon.svg
  video-embeds.js
  video-filter.js
  books/
    <書影4点>.jpg
data/
  video-questions.json
docs/
  ADSENSE_CONFIGURATION.md
  IMPLEMENTATION_LOG.md
  REVIEW_READINESS.md
scripts/
  import_video_questions.py
  rebuild_video_keywords.py
  generate_video_pages.py
  update_sitemap.py
  validate_portal.py
ads.txt
robots.txt
sitemap.xml
```

## 動画問題の再生成

公開用の `data/video-questions.json` には、問題・答え・監査済みキーワード・動画情報だけを保存し、原本Excelの解説本文は保存しません。原本Excelのキーワード列は品質が一定でないためインポートせず、全330問を問題文・正答・分類・動画題名から個別に割り当てます。原本や動画対応を更新するときだけ、読み取り環境で次を実行します。

```powershell
python scripts/import_video_questions.py <問題集.xlsx> <YouTube公開メタデータ.json>
python scripts/rebuild_video_keywords.py
python scripts/generate_video_pages.py
```

通常のHTML再生成は `python scripts/generate_video_pages.py` だけで行えます。キーワード割り当ての根拠とデータハッシュは `docs/video-keyword-audit.json`、HTMLの生成記録は `docs/video-library-build.json` に保存します。

## サイトマップ更新

ローカルで2リポジトリが同じ親フォルダにある場合は、アプリ側の問題一覧ビルド記録を取り込んで全体サイトマップを更新できます。

```powershell
python scripts/update_sitemap.py
```

別の場所にある場合は明示します。

```powershell
python scripts/update_sitemap.py --app-root <info1-quiz-appのリポジトリルート>
```

## 検証

```powershell
python scripts/validate_portal.py
```

検証はポータル42ページ、広告コード範囲、内部リンク、SEOメタ情報、構造化データ、タグ／キーワードOR検索、動画対応、解説本文の非掲載、`ads.txt`、`robots.txt`、全体サイトマップを確認します。同じ親フォルダにアプリリポジトリがある場合は、問題一覧ビルド記録との一致も確認します。

## 公開

GitHub Pagesの公開元は `main` ブランチのリポジトリルートです。

```text
https://mei-chan-nel.github.io/
```

問題一覧とアプリは次のパスへリンクします。

```text
https://mei-chan-nel.github.io/info1-quiz-app/questions/
https://mei-chan-nel.github.io/info1-quiz-app/app/
```
