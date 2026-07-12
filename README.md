# 情報Ⅰ Study Atlas — ポータル

`https://mei-chan-nel.github.io/` で公開するサイト全体の入口です。

このリポジトリでは次を管理します。

- 学習ポータルトップ
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
assets/
  site.css
  favicon.svg
docs/
  ADSENSE_CONFIGURATION.md
  IMPLEMENTATION_LOG.md
  REVIEW_READINESS.md
scripts/
  update_sitemap.py
  validate_portal.py
ads.txt
robots.txt
sitemap.xml
```

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

検証はポータル3ページ、広告コード範囲、内部リンク、`ads.txt`、`robots.txt`、全体サイトマップを確認します。同じ親フォルダにアプリリポジトリがある場合は、問題一覧ビルド記録との一致も確認します。

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
