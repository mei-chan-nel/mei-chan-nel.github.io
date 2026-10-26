# ブラウザ内Excel処理

ExcelJS **4.4.0** (`exceljs@4.4.0` npm配布の `dist/exceljs.min.js`) を同梱。MITライセンスは `EXCELJS-LICENSE`。SHA256 `7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9`。

通常のページ閲覧では読み込まず、Excel入出力操作時だけ専用Workerで実行。外部CDNへの実行時依存・ファイル送信はない。5MBファイル上限、ZIP宣言展開サイズ32MB/500エントリ上限、Worker20秒タイムアウト、シート10050行/50列上限。数式は評価せず入力エラーとする。Workerは操作完了・中止時に破棄する。

更新時はMIT通知、入出力回帰テスト、数式・日付・空欄・文字列の往復、Worker動作を確認する。npmの配布物を固定して管理するため実行時npm installは不要。
