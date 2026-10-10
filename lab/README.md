# Interactive Lab

情報Ⅰの概念を操作・実験・可視化で理解する教材の入口です。共通のガワに続き、「パケット通信とルーティング」を実装しています。以前の18教材は撤回しており、新しい教材を一つずつ設計・実装します。

学習アプリと同じ6分野で整理します。

1. 社会・セキュリティ
2. デジタル表現
3. ネットワーク
4. データ活用・DB
5. アルゴリズム
6. 情報デザイン

動画解説ページと同じく、カテゴリの見出しの下に個別教材のカード一覧を置く構成です。個別教材のURLは `/lab/<slug>/` に統一します。

## 構成

- `catalog.mjs`: 6分野の名称と説明、実装した教材の一覧。
- `tools/build-pages.mjs`: 入口 `index.html` の生成。個別ページは生成しません。
- `lab.css`: 入口のレイアウト。既存 `assets/site.css` の配色・ヘッダー・フッターを使用します。
- `navigation.mjs`: ナビゲーションの表示補助。解析・広告スクリプトは読み込みません。
- `packet-routing/`: ブラウザ内で動く通信・経路更新シミュレーター。詳細は [packet-routing/README.md](packet-routing/README.md)。

```sh
node lab/tools/build-pages.mjs
node lab/tools/build-pages.mjs --check
node --test scripts/packet-routing.test.mjs
python3 scripts/preview_site.py --host 127.0.0.1 --port 8773 --app-root /workspace/info1-quiz-app
```

配信した `/lab/` を開いて確認します。Labの表示にnpmインストールは不要です。

## 未公開

既存サイトの全体トップ・サイトマップ・公開設定は変更しません。入口と教材には `noindex, nofollow` を設定しています。これはアクセス制限ではないため、作業ブランチ上で確認します。
