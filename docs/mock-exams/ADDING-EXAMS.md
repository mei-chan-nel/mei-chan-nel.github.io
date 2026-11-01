# 模試の追加・改訂手順

新しい回は共通アプリを書き換えず、問題データ・教材・原稿アダプターを追加する。原稿HTMLの構造をNo.001へ無理に揃える必要はない。元の図表・プログラムを保ち、下記の共通属性を付ける。

## 1. 作業場所と版

例：No.002の初版は`mock-exams/exams/002/1/`。`id`は固定の3桁番号、`version`は正の整数。原稿の編集版（例`2.5.0`）は`sourceVersion`へ分ける。

```text
exams/002/1/
  exam.json
  q1.html ... q4.html
  q1-solution.html ... q4-solution.html
  screen/                 # 画面用の問題・解説
  problem.pdf
  solution.pdf
  source/                 # 受領原稿は改変しない
    ...
    qa.json               # 原稿・解説から独立に確認した正答・配点・問番号
```

正答・採点規則・配点・解答欄の意味を公開後に変えるときは版を上げる。旧版のファイルは保持し、過去履歴と統計を同じ版で復元する。誤字・配置・設問番号の表示だけの修正は得点の意味を変えない限り同じ版で扱える。

アダプターは対象の版フォルダーだけを更新する。`catalog.json`は書き換えない。No.001専用の例は`import_mock_exam_001.py`と`mock_exam_001_reading.py`。後者のXPathはNo.001に固有なので、別原稿へそのまま適用しない。No.001の現行版2は`import_mock_exam_001_v2.py`で生成する。新版の手書き原稿は`exams/001/2/source/Q2A_001_*v3.0.0.html`、版1を元にする承認済みの時刻・図配置の変更は同スクリプトに集約する。`validate_mock_exam_001_v2.py`で改訂内容も独立に確認する。

## 2. 問題定義

`exam.json`は`schemaVersion:1, id, version, title, durationSeconds:3600, maxPoints:100, sections, fields, scoring`を持つ。掲載する1回分はq1/q2a/q2b/q3/q4の順。各大問の配点は自由だが合計100点とする。

各sectionには`id,title,maxPoints,problem,solution,screenProblem,screenSolution`を設定する。パスはexam.jsonからの相対パス。原稿追跡用に`sourceProblem,sourceSolution`（source/以下のパス）、`sourceSha256,solutionSha256`（元ファイルのSHA-256）、任意の`sourceVersion`も設定する。

解答欄：

```json
{"id":"q1-ア","sectionId":"q1","label":"ア","type":"choice",
 "choices":[{"value":"0","text":"選択肢本文"},{"value":"1","text":"選択肢本文"}]}
```

数字・文字を直接答える欄は`type:"text", allowed:"0123456789", maxLength:1`等。許可文字は0〜9・A〜Fから必要なものだけ。既存RPCは各欄1文字に限る。`10`や`AB`を1欄の回答として登録しない。選択肢も1文字の値で表し、16種類を超える場合は追加前に仕様を再検討する。表示上の①等へはアプリが変換する。

採点単位：

```json
{"id":"q1-01","sectionId":"q1","question":1,"fields":["q1-ア"],
 "maxPoints":2,"rule":{"kind":"exact","patterns":[["1"]]}}
```

- `question`は問題本文の「問1」「問2」等の整数。a/bを別の問に数えない。
- 採点単位は大問順・設問順に並べる。すべての欄をちょうど1単位に所属させる。複数マークは同じ単位の`fields`へ順番どおりに入れる。
- 採点単位IDは英数字・`_`・`-`の100字以内。模試IDと版がRPCの別キーなので、別の回でも`q1-01`を使える。公開後の同じ版では意味を変えない。
- 1回100採点単位まで、1単位64欄まで、配点は正で100以下・小数第2位まで。現行システムは匿名集計であり、サーバーへの問題登録は不要。

| rule.kind | 意味 |
|---|---|
| exact | patternsのどれかに順序も含めて一致すれば満点 |
| unordered | 順不同の完答。重複を勝手に除かない |
| unordered-partial | patternsとの一致個数に応じpointsByMatchesで部分点 |
| cases | casesのanswers・points・任意のunordered/whenを先頭から照合 |
| conditional | whenに応じthen/elseの規則を適用 |

部分点の例：2欄で1つ合えば1点、両方なら3点は`pointsByMatches:[0,1,3]`。0個一致は必ず0点、最後は満点。`cases`には満点になるケースも含める。

条件は`field/equals`、先行単位の`unit/atLeast`、`all:[...]`、`any:[...]`。大問別でも単独で採点できるよう依存先は同じ大問に限定し、単位依存は先に定義する。新しい採点ルールを独自JavaScriptで埋め込まない。複数の条件付き正答や部分点は採点表・復習の表示も確認する。

## 3. 問題と解説のHTML

原稿のscript・イベント属性・iframe・form等を除く。元のCSSをiframeで隔離し、画面用には大きな埋込印刷フォントを含めない。画像・CSS・フォントはローカルへ含め、各HTMLから正しい相対パスを付ける。画面・PDFの表現方針は[AUTHORING-RULES.md](AUTHORING-RULES.md)。

| 共通属性 | 用途 |
|---|---|
| data-field="q1-ア" | 解答欄。本文中の同じ欄は繰り返し指定できる |
| data-original="ア" | 未回答時のラベル |
| data-display="content" | プログラム等に選んだ式・命令を表示 |
| data-part="0" | 選択肢のparts配列の該当部分を表示 |
| data-choice-fields="q1-ア q1-イ" | 選択肢を共有する解答欄（空白区切り） |
| data-choice-value="1" | 選択肢の値。原稿の表示順だけから推測しない |
| data-reading-units="q1-01" | 問題・解説の対応開始点 |
| data-reading-for="q1-01 q1-02" | スマホの設問別表示に含める問題・共通資料 |

対応開始点は問題と解説に同じ順・同じグループで付ける。各単位がちょうど1回含まれること。共通の文を分割できない場合は`data-reading-units="q1-01 q1-02"`のようにまとめる。PCはこの対応点を基準に左右を整列する。

`data-reading-for`は、その設問の文章・選択肢・必要な共通図表やプログラムに付ける。解答欄だけを切り出して前提を欠落させない。ひとつの図表を複数単位で共有してよい。アプリがキャッシュ済みHTMLから対象を抽出し、長い先行資料は「共通の文章・図表を見る」で展開する。

画面用HTMLでは、対応属性の設定後に`clean_screen_chrome`（`mock_exam_editorial.py`）等で版番号・柱・原稿内ページ番号を取り除く。先に除くと原稿固有のXPathがずれることがある。画面用の解説冒頭には早見表を置かない。解説は各設問の導出・誤答理由に集中し、作問意図・検証報告を混ぜない。引用データの出典は保持する。

### 完成プログラムをStudioにつなぐ

解説の完成コードから本文を抽出し、既存の`program-trace/studio/sharing.js`の共有形式を使う。`scripts/mock_exam_studio_links.mjs`へDraftの配列を標準入力すると、構文検査後に共有URLの配列を返す。新たな読み込みAPIや実行エンジンは作らない。

Draftは`version:1,title,source,settings:{indexBase:0または1,inputs:{...}}`。配列の添字開始、先行プログラム終了時の初期値、外部入力の型・範囲を問題に合わせる。外部入力はプログラムに残し、必要な値と順番をリンクのそばに短く示す。リンクは`target="_blank" rel="noopener"`、`class="studio-program-link"`を使う。

No.001の例は`mock_exam_001_studio.py`。図2・図4のHTMLからコードを抽出し、図4だけ図2終了時の初期値を補う。`studio-links.test.mjs`は共有URLを復元して実際の実行結果を照合し、`browser-studio.cjs`はリンクから入力・出力一覧まで確認する。原稿を更新したら両方を確認する。

## 4. 独立した採点確認データ

`source/qa.json`を問題・解説から確認して作る。`exam.json`の正答をそのままコピー生成すると両方が同じ誤りを持つので、照合の意味がなくなる。

```json
{
  "schemaVersion":1,
  "answers":{"q1-ア":"1"},
  "expectedTotal":100,
  "expectedSections":{"q1":20,"q2a":15,"q2b":15,"q3":25,"q4":25},
  "expectedQuestions":{"q1-ア":1},
  "cases":[{
    "name":"複数マークの片方未回答",
    "answers":{"q1-イ":"2"},
    "expectedTotal":0,
    "expectedUnits":{"q1-02":0}
  }]
}
```

上は形の例。`answers`と`expectedQuestions`には全欄を記入する。`expectedSections`はその模試の実際の配点。ケースには順不同の逆順・重複・一部未回答・部分点の境界・条件分岐を必要に応じて追加する。表の数値、計算結果、プログラムの動作も独立に確認する。

## 5. 生成→検査→登録

リポジトリ直下で実行する。新しい回はまだcatalog.jsonにない状態で検査できる。

```sh
# 対象原稿のアダプターで教材とexam.jsonを生成（例）
python3 scripts/import_mock_exam_002.py
# PDF生成前の構造・正答・原稿・全対応点の検査
node scripts/check_mock_exams.mjs exams/002/1/exam.json --skip-pdf
# 対象回だけの問題／解説PDFを生成
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/build_mock_exam_pdfs.cjs --manifest exams/002/1/exam.json
# PDFのA4寸法・No.・長文欠落まで検査
node scripts/check_mock_exams.mjs exams/002/1/exam.json
# 全入力→満点→記録用RPCの内容、PC/スマホ解説の操作を模擬通信で確認
PLAYWRIGHT_MODULE=/path/to/playwright node mock-exams/tests/browser-added-exam.cjs exams/002/1/exam.json
# 検査済みの回を一覧に登録。他の回・公開日・旧版を保持
node scripts/register_mock_exam.mjs exams/002/1/exam.json
# 一覧全体と旧版も再確認
node scripts/check_mock_exams.mjs
node --test mock-exams/tests/*.test.mjs
```

登録処理は初期表示用の`index.html`と埋め込みカタログも共通の一覧描画から生成する。一覧の表示内容を変えた場合も`node scripts/build_mock_exam_entry.mjs`を実行する。初期HTML・埋め込みカタログ・`catalog.json`の一致は`entry.test.mjs`で検査する。

`import_mock_exam_002.py`はNo.002原稿専用のアダプターであり、別の原稿には専用の変換処理を用意する。正答・必要な図表・設問の意味を自動推測して登録する機能は設けない。

PDFの片方だけを更新する場合は`build_mock_exam_pdfs.cjs solution --manifest ...`または`problem --manifest ...`。対象指定なしではcatalogの現行版だけを生成し、旧版PDFは書き換えない。

登録処理は全検査に成功してから一覧を原子的に置き換える。同じ版の再登録は冪等で、既存の`publishedAt`等を保持する。新版は前の現行版を`versions`へ退避し、版の巻戻しは拒否する。公開年月は確定した日付がある場合のみ`publishedAt:"YYYY-MM-DD"`を設定する。

## 6. 画面の最終確認と反映

- 全大問の選択肢・図・プログラム・記号枠をPCとスマホで目視する。
- 途中採点→再開→新規単位のみ送信、最終採点、履歴、復習、戻る／進む、PDFダウンロードを確認する。
- 新版の場合は旧版の保存済み履歴を旧版で開けることを確認する。共通動作は`browser-loading.cjs`でも検証する。
- `python3 scripts/build_mock_exam_sites_preview.py`で既存Sitesへ配信するファイルを生成し、同じ本人専用Siteを更新する。公開手順は[SITES-PREVIEW.md](SITES-PREVIEW.md)。
- 実通信の試験は`connection-check.html`または公開確認スクリプトの`qa_mock_...` IDを使用する。通常のNo.001等の統計へテスト回答を混ぜない。
- ユーザーが公開を指示した変更は、PRの統合検証を通してmainへマージする。公開後のファイル・PDF・RPCの確認は[RELEASE.md](RELEASE.md)を参照。模試の追加に既存学習アプリのコードや追加SQLは不要。
