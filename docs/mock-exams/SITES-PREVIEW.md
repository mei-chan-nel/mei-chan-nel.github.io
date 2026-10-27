# Sitesでの実戦模試プレビュー

URL: https://study-atlas-mock-exams-preview.hal2718.chatgpt.site

- Sites project_id: `appgprj_6ae110a637e08191bc9ddecdd9bb6571`
- deployment_id: `appgdep_6ae12286361c8191bced153db0c4b9b2`
- version_id: `appgprj_6ae110a637e08191bc9ddecdd9bb6571~appgver_8050bfa18ee48191bf2d9c82fd6b2987`
- 状態: succeeded（Sitesの保存・配置結果で確認）。新規作成時の本人専用の閲覧範囲を維持。
- Sites専用チェックアウト: `/workspace/sites/study-atlas-mock-exams-preview`
- 配置ソースcommit: `bceda35c7cf8c1c47962e6169bdb75444dc3e849`
- 統計先: ユーザーの追加指示により本番No.001（exam_id="001", exam_version=1）。テスト用IDへの変更は取り消し。

一覧から受験・採点・中断再開・復習・PDFを確認できる。ルートはStudy Atlasのトップページで、そこから /mock-exams/ へ移動。ヘッダー・フッターのサイト内メニューは既存のStudy Atlasへ接続する。

Sites用ファイルでは、採点すると本番の匿名統計に記録される旨を表示する。その他の受験・採点エンジンは元ソースからコピー。ソース原稿・検証用コードはこのSiteの配信対象外。

ローカルHTTPとChromiumで、ルート転送、一覧、入力、採点2/100点、本番用RPC引数、再開、PDF、390pxの表示を確認。統計通信は模擬応答。実際の本番RPCとの通信成功はここからは未確認。

GitHub Pagesの公開元mainは変更していない。Sites上で画面を確認するという追加の依頼に対応したもの。Sites上の変更を続ける場合は上のproject_idとチェックアウトを再利用する。

2026-10-28更新：入力と採点表の改善、PC左右比較、スマホ問題／解説選択、履歴削除、先読み、プログラムの中央揃え・解答群余白を反映。Sites側の配置成功を確認。最新版は同じURL。
