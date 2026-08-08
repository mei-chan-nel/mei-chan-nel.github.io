# Webサイト全体整理・再構成 実装ログ

更新日: 2026-08-08

## 2026-08-08 — 現行構成への移行

1. `data/video-curriculum.json` を正本にし、動画を5分野・21ジャンルへ再分類した。
2. `generate_video_pages.py` を分類データ駆動へ変更し、通常21ページ・最短コース1ページ・一覧1ページを生成。通常330問と指定順27問を検証する。
3. 動画キーワード検索、キーワード一覧、動画キーワードデータ・監査・専用JS・生成処理・CSSを削除した。動画本体のクリック時読み込みは維持。
4. 問題生成をタグ検索1ページへ集約し、分野別147ページを削除。`questions/tags.html` はnoindex互換スタブとして残し、正規URLを `questions/index.html` に統一した。
5. アプリのタグ出題・復帰URLを `/info1-quiz-app/questions/` へ変更し、タグAND検索、段階表示、保存・履歴・類題など既存機能は維持した。
6. トップを学習アプリ中心の6セクション構成へ整理し、円形図を装飾化。履歴が壊れていても安全なサマリー表示にした。
7. 講義ノート入口の説明・数値欄を簡潔化し、使い方を現行アプリ機能に合わせて書き直した。
8. sitemap、SEOメタデータ、JSON-LD、パンくず、README、関連docs、生成・検証レポートを現行URLへ更新した。

## 再生成順

```powershell
python ..\info1-quiz-app\scripts\generate_question_pages.py
python scripts/generate_video_pages.py
python scripts/update_sitemap.py --app-root ..\info1-quiz-app
```

## 検証コマンド

```powershell
python ..\info1-quiz-app\scripts\validate_question_pages.py --portal-root .
python scripts/validate_portal.py --app-root ..\info1-quiz-app
python scripts/validate_study_atlas.py --portal-root . --app-root ..\info1-quiz-app
```

検証レポート:

- `docs/video-library-build.json`
- `docs/reports/portal-validation.json`
- `info1-quiz-app/docs/reports/question-library-build.json`
- `info1-quiz-app/docs/reports/question-pages-validation.json`
