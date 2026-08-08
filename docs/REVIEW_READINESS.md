# レビュー・公開前チェック

更新日: 2026-08-08

## 構成

- 動画: 通常21ジャンル330問＋プログラミング最短コース27問。通常ジャンルとコースは別ページ・別ナビゲーション。
- 問題検索: `/info1-quiz-app/questions/` に1,438問・229タグを集約。分野別147ページと動画キーワード検索は存在しない。
- トップ: ヘッダー、ファーストビュー、学習アプリ、3つの学習導線、使い方・書籍案内、フッターの順。
- 講義ノート: 5分野を維持し、インデックスの不要な数値欄は削除。

## 機械検証

```powershell
# ポータル
python scripts/generate_video_pages.py
python scripts/update_sitemap.py --app-root ..\info1-quiz-app
python scripts/validate_portal.py --app-root ..\info1-quiz-app

# アプリ
python ..\info1-quiz-app\scripts\generate_question_pages.py
python ..\info1-quiz-app\scripts\validate_question_pages.py --portal-root .
```

確認する数値:

- 動画330問の通常ページ掲載は不足・重複なし、分野数32・33・60・105・100。
- 「デジタルの計算」はQ66〜89、Q123〜125の27問。
- 最短コースは指定順27問、重複・範囲外0。
- 問題検索は1,438問・229タグ、分野別HTML0枚。
- 動画公開ページは一覧1＋ジャンル21＋最短コース1。

## 手動確認

- タグAND検索、タグ条件からのアプリ出題と検索条件を保った復帰。
- 学習アプリの履歴、保存、間違い、類題、結果画面、動画クリック時読み込み。
- 分野内のジャンル移動、一覧への復帰、最短コースの順序。
- トップの履歴表示（正常・空・壊れたlocalStorage）、キーボード操作、モバイル幅。
- title、description、canonical、og:url、JSON-LD、パンくず、h1〜h3、sitemap.xml。
