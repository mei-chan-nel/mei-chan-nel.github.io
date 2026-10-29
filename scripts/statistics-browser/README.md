# 実ブラウザの回帰確認

既存のChromiumとPlaywrightを使う任意の開発用QAです。公開成果物へ含めません。ブラウザを自動インストールせず、既設バイナリを指定します。ネットワークはローカルの検証先だけを許可し、ユーザーの実データは使用しません。

リポジトリ直下でプレビューを起動します。

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

別ターミナルで実行します。`PLAYWRIGHT_MODULE`はPlaywrightが通常のNode解決で見つからない場合だけ指定します。

```sh
export PLAYWRIGHT_MODULE=/path/to/node_modules/playwright
export BROWSER_PATH=/path/to/chromium
export STATISTICS_QA_OUTPUT=/tmp/statistics-qa
node scripts/statistics-browser/files.cjs
node scripts/statistics-browser/smoke.cjs
node scripts/statistics-browser/layout.cjs
node scripts/statistics-browser/choices.cjs
node scripts/statistics-browser/edge.cjs
```

- files: 全9画面の全件CSV、ひな形、表題反映、不正入力、標準復帰、データ非送信
- smoke: 全9画面のExcelひな形→読込→全タブ
- layout: 全9画面、320/375/414/1366px、全タブ通常／全画面、ダイアログ
- choices: グラフ読み取り3題材×5種類×4幅×通常／全画面
- edge: 段階描画、読み込み失敗からの復帰、幅変更、複数数式セル、日付セル、統計上の制約

結果JSON・スクリーンショットは出力先へ保存します。`layout`のJSONではscrollとviewport、各plot.outside、errorsを確認し、画像も目視してください。小さい箱ひげ図は意図した高さのため、単純な最小高チェックの対象にしません。

性能比較は、変更前コミットを別ディレクトリへ展開して同じサーバーで比較します。計測中は他のブラウザテストを実行しません。

```sh
mkdir -p /tmp/statistics-before
git archive 03c30d38173b1a039476003a467a17b0d27d7c14 lab/statistics | tar -x -C /tmp/statistics-before
STATISTICS_QA_BASELINE=/tmp/statistics-before python3 scripts/statistics-browser/compare-server.py
# 別ターミナル
node scripts/statistics-browser/performance.cjs
```

前後×9画面×3回、各回新しいブラウザコンテキストです。初回paint、データDOM、準備完了mark、最初のグラフを記録します。グラフはデータタブの後に選択するため、クリックからの時間も分けて記録します。横断課題には固有グラフがないためグラフ時間は対象外です。ローカルChromiumの値であり、公開環境や実機スマートフォンの速度保証ではありません。
