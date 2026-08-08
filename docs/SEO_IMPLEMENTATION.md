# SEO・公開URL構成

更新日: 2026-08-08

## 正規入口

|目的|正規URL|
|---|---|
|サイトトップ|`https://mei-chan-nel.com/`|
|タグから問題を探す|`https://mei-chan-nel.com/info1-quiz-app/questions/`|
|学習アプリ|`https://mei-chan-nel.com/info1-quiz-app/app/`|
|解説動画一覧|`https://mei-chan-nel.com/archive/`|
|講義ノート|`https://mei-chan-nel.com/LectureNote/`|

検索条件は正規ページのフラグメントで表します。旧 `questions/tags.html` はnoindexの互換スタブであり、サイトマップ・内部リンク・canonicalには使用しません。動画のキーワード検索ページは廃止しています。

## ページ階層

- 動画一覧 → 5分野 → 21ジャンル → 問題カード。
- プログラミングには通常6ジャンルに加えて、指定順27問の最短学習コースを用意。
- 問題検索はタグ一覧と結果カードを一つのページに集約。
- 各公開HTMLはtitle、description、canonical、og:url、JSON-LD、BreadcrumbListを持つ。静的な教材ページはh1を1つ、学習アプリは表示中の画面ごとにh1を1つ持つ。

## 更新手順

```powershell
python scripts/generate_video_pages.py
python ..\info1-quiz-app\scripts\generate_question_pages.py
python scripts/update_sitemap.py --app-root ..\info1-quiz-app
python scripts/validate_portal.py --app-root ..\info1-quiz-app
```

レポートは動画の330問・5分野・21ジャンル、問題検索の1,438問・229タグ、サイトマップの公開URLを機械的に突合します。
