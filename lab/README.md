# Interactive Lab

情報Ⅰの概念を操作・実験・可視化で理解する教材です。アプリの操作と、CPU・メモリの変化を観察する「OSの仕事」を追加しています。

学習アプリと同じ6分野で整理します。

1. 社会・セキュリティ
2. デジタル表現
3. ネットワーク
4. データ活用・DB
5. アルゴリズム
6. 情報デザイン

動画解説ページと同じく、カテゴリの見出しの下に個別教材のカード一覧を置く構成です。個別教材のURLは `/lab/<slug>/` に統一します。

## 教材

- [OSの仕事](./os-work/)（アルゴリズム）：1コアCPUの時間分割、プロセスの状態、メモリの確保・解放を共通の仮想時間で再現します。Webの通信待ち、音声バッファ、写真加工の進捗と作業用メモリを操作して確かめられます。一定速度で再生・一時停止でき、アプリの画面内でCPUの割り当て中・順番待ち・イベント待ちを確認できます。音楽はパブリックドメインの3曲から選択でき、再生・一時停止・音量調整・消音に対応します。

基本操作は [使い方ページ](../study-guide.html#lab) にまとめています。

## 構成

- `catalog.mjs`: 6分野の名称と説明、完成した教材の一覧。
- `tools/build-pages.mjs`: 入口 `index.html` の生成。個別ページは生成しません。
- `lab.css`: 入口のレイアウト。既存 `assets/site.css` の配色・ヘッダー・フッターを使用します。
- `navigation.mjs`: ナビゲーションの表示補助。解析・広告スクリプトは読み込みません。
- `os-work/`: OSの仕事の画面と、ブラウザ内で完結するシミュレーション。

```sh
node lab/tools/build-pages.mjs
node lab/tools/build-pages.mjs --check
node lab/os-work/simulation.test.mjs
node lab/os-work/audio-controller.test.mjs
python3 scripts/preview_site.py --host 127.0.0.1 --port 8773 --app-root /workspace/info1-quiz-app
```

配信した `/lab/` を開いて確認します。Labの表示にnpmインストールは不要です。

## 未公開

既存サイトの全体トップ・サイトマップ・公開設定は変更しません。入口には `noindex, nofollow` を設定しています。これはアクセス制限ではありません。動作確認には非公開のSitesプレビューを使用し、公開元へのデプロイは行いません。
