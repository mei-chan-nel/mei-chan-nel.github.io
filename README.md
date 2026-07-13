# 情報Ⅰ Study Atlas — ポータル

`https://mei-chan-nel.github.io/` で公開するサイト全体の入口です。

このリポジトリでは次を管理します。

- 学習ポータルトップ
- 動画で学ぶ一問一答330問
- Kindle問題集4冊の紹介
- このサイトについて
- 全体プライバシーポリシー
- 共通デザイン
- ホスト直下の `ads.txt` と `robots.txt`
- ポータルとアプリ／問題一覧をまとめたサイトマップ
- AdSense再審査の設定・検証記録

学習アプリ、問題データ、問題一覧ページは、別リポジトリ [`info1-quiz-app`](https://github.com/mei-chan-nel/info1-quiz-app) で管理します。

## フォルダ構成

```text
index.html
about.html
privacy.html
archive/
  index.html
  <5分野・10問区切りの生成ページ>.html
books/
  index.html
assets/
  site.css
  favicon.svg
  video-embeds.js
data/
  video-questions.json
docs/
  ADSENSE_CONFIGURATION.md
  IMPLEMENTATION_LOG.md
  REVIEW_READINESS.md
scripts/
  import_video_questions.py
  generate_video_pages.py
  update_sitemap.py
  validate_portal.py
ads.txt
robots.txt
sitemap.xml
```

## 動画問題の再生成

公開用の `data/video-questions.json` には、問題・答え・キーワード・動画情報だけを保存し、原本Excelの解説本文は保存しません。原本や動画対応を更新するときだけ、読み取り環境で次を実行します。

```powershell
python scripts/import_video_questions.py <問題集.xlsx> <YouTube公開メタデータ.json>
python scripts/generate_video_pages.py
```

通常のHTML再生成は `python scripts/generate_video_pages.py` だけで行えます。生成記録は `docs/video-library-build.json` に保存します。

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

検証はポータル40ページ、広告コード範囲、内部リンク、動画対応、解説本文の非掲載、`ads.txt`、`robots.txt`、全体サイトマップを確認します。同じ親フォルダにアプリリポジトリがある場合は、問題一覧ビルド記録との一致も確認します。

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
