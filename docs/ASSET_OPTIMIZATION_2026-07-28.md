# 静的アセット管理

更新日: 2026-08-08

共通CSS・favicon・講義ノート画像・動画ポスターはポータルが所有し、問題検索は相対URLで共有します。動画埋め込みは `assets/video-embeds.js` がボタン操作時だけiframeを生成します。

今回の整理で、動画キーワード専用の `video-filter.js`、キーワード監査データ、キーワード生成処理は未使用になったため削除しました。講義ノートの用語表示・タグ検索など別機能の資産は維持しています。

確認:

```powershell
rg -n "video-filter|video-keyword|keyword-link|video-keywords" assets scripts data archive
```

上記検索は空であることを期待します（講義ノートの一般的なキーワード機能は対象外）。
