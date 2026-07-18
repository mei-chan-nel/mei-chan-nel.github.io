(function () {
  "use strict";

  const page = window.LECTURE_CONTENT && window.LECTURE_CONTENT.programming;
  if (!page) return;

  const details = (title, body) => `
    <details class="deep-dive">
      <summary><span class="deep-dive-label">さらに詳しく：</span>${title}</summary>
      <div class="deep-dive-body">${body}</div>
    </details>`;

  const officialLink = (title, url, description) => `
    <a class="official-link" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="official-link-kicker">公式・公的資料</span>
      <strong>${title}</strong>
      <small>${description}</small>
      <b aria-hidden="true">↗</b>
    </a>`;

  const append = (id, html) => {
    const section = page.sections.find((item) => item.id === id);
    if (!section) throw new Error(`Unknown programming section: ${id}`);
    section.html += html;
  };

  append("programming-algorithm", `
    <h3>プログラミング言語は、人の記述と機械語を橋渡しする</h3>
    <p>CPUが直接実行するのは0と1で表された{{機械語}}です。人が読み書きしやすい高水準言語で書いた{{ソースコード}}は、処理系によって機械が実行できる形へ変換されます。</p>
    <div class="table-wrap"><table class="lecture-table"><thead><tr><th>方式</th><th>考え方</th><th>特徴</th></tr></thead><tbody><tr><td>コンパイラ</td><td>プログラム全体を実行可能な形へ変換する</td><td>変換後を繰り返し高速に実行しやすい</td></tr><tr><td>インタプリタ</td><td>実行時に解釈しながら処理する</td><td>試行・修正しやすい</td></tr><tr><td>仮想機械・中間表現</td><td>一度中間形式へ変換し、実行環境で動かす</td><td>環境の違いを吸収しやすい</td></tr></tbody></table></div>
    <p>Pythonは一般にインタプリタを通して実行します。実装内部では中間コードへ変換することもありますが、学習では「書く→実行する→結果を確かめる→修正する」の短い反復を生かします。</p>
    ${details("自然言語・フローチャート・疑似コード", `<p>アルゴリズムはプログラミング言語に依存しません。自然言語は始めやすい一方で曖昧さが残り、フローチャートは流れを視覚化し、疑似コードは構造を簡潔に表せます。</p><pre class="code-block">合計を0にする\n各得点について繰り返す\n    合計へ得点を加える\n合計を人数で割って平均を表示する</pre><p>先に入出力、繰返し条件、終了条件を明らかにすると、特定の構文へ引きずられずに手順を点検できます。</p>`)}
  `);

  append("programming-values", `
    <h3>代入は、右辺を評価してから左辺の名前へ関連づける</h3>
    <p><code>x = x + 1</code>は数学の等式ではなく、現在のxへ1を加えた結果を改めてxへ代入する命令です。変数名は内容が分かるものを選び、予約語や数字から始まる名前は使いません。</p>
    <div class="table-wrap"><table class="lecture-table"><thead><tr><th>型</th><th>例</th><th>注意</th></tr></thead><tbody><tr><td><code>int</code></td><td><code>42</code></td><td>整数</td></tr><tr><td><code>float</code></td><td><code>3.14</code></td><td>有限精度の浮動小数点数</td></tr><tr><td><code>str</code></td><td><code>"42"</code></td><td>文字列。数値42とは別の値</td></tr><tr><td><code>bool</code></td><td><code>True</code></td><td>真偽値</td></tr></tbody></table></div>
    <p><code>input()</code>の結果は文字列です。年齢として計算するなら<code>int(input("年齢: "))</code>のように型変換します。変換できない入力もあるため、利用者向けプログラムでは例外処理や再入力を考えます。</p>
    ${details("演算子の優先順位と文字列", `<p>括弧、べき乗、乗除、加減、比較、論理演算の順に評価されます。迷う式は括弧で意図を明示します。<code>/</code>は実数の除算、<code>//</code>は切り下げ除算、<code>%</code>は剰余です。</p><p>文字列は<code>+</code>で連結でき、<code>len()</code>で長さを調べられます。数値を文章へ埋め込む時は、f文字列の<code>f"得点は{score}点"</code>のような書式を使います。</p>`)}
  `);

  append("programming-branch", `
    <h3>複数の条件は、真理値と短絡評価を意識する</h3>
    <p><code>and</code>は両方が真、<code>or</code>はいずれかが真、<code>not</code>は真偽を反転します。<code>0 &lt;= score &lt;= 100</code>のような連鎖比較は、得点が範囲内かを明確に表せます。</p>
    <p><code>and</code>では左側が偽なら右側を調べず、<code>or</code>では左側が真なら右側を調べません。この{{短絡評価}}を使うと、存在確認の後で要素へアクセスできます。</p>
    ${details("条件の重なりと到達不能な分岐", `<p><code>if score &gt;= 60</code>を先に書いた後で<code>elif score &gt;= 80</code>を書いても、80以上は最初の条件で処理され、後の分岐へ到達しません。範囲が狭い条件から広い条件へ並べるか、上限と下限を同時に書きます。</p><p>18、60、80など境界の直前・ちょうど・直後を試すと、<code>&lt;</code>と<code>&lt;=</code>の誤りを見つけやすくなります。</p>`)}
  `);

  append("programming-loop", `
    <h3>rangeの終端は含まれない</h3>
    <div class="table-wrap"><table class="lecture-table"><thead><tr><th>式</th><th>生成される値</th></tr></thead><tbody><tr><td><code>range(5)</code></td><td>0, 1, 2, 3, 4</td></tr><tr><td><code>range(2, 6)</code></td><td>2, 3, 4, 5</td></tr><tr><td><code>range(8, 2, -2)</code></td><td>8, 6, 4</td></tr></tbody></table></div>
    <p><code>break</code>は最も内側のループを終了し、<code>continue</code>は残りを飛ばして次の反復へ進みます。終了条件が複数箇所へ散ると追跡しにくくなるため、使う理由を明確にします。</p>
    ${details("入れ子の反復と計算回数", `<p>外側をn回、内側をm回繰り返すと、内側の処理は基本的にn×m回実行されます。表の全セル、画像の全画素、すべての組合せを調べる処理で現れます。</p><p>データ数nに対して二重ループがn²回増えると、nを10倍にした時に処理回数は約100倍になります。小さな例で動いても、大きなデータで実用的かを考えます。</p>`)}
  `);

  append("programming-data-structures", `
    <h3>配列では、添字と要素数を区別する</h3>
    <p>Pythonのリストは0から始まる添字で要素へアクセスします。要素数がnなら、最後の添字はn−1です。負の添字<code>-1</code>は最後の要素を表します。</p>
    <pre class="code-block">scores = [72, 85, 61]\nscores.append(90)     # 末尾へ追加\nscores[1] = 88        # 2番目を更新\npart = scores[1:3]    # 添字1以上3未満</pre>
    <p>二次元の表は、リストの中へリストを入れて表せます。<code>table[row][column]</code>のように行と列の意味を決め、すべての行の長さが同じかを確認します。</p>
    ${details("テキストファイルとCSVを読み書きする", `<p>ファイルは<code>with open(...)</code>を使うと、処理後に自動的に閉じられます。文字コードを明示し、一行末尾の改行をどう扱うか確認します。</p><pre class="code-block">import csv\n\nwith open("scores.csv", encoding="utf-8", newline="") as file:\n    rows = list(csv.reader(file))</pre><p>CSVの区切りや引用符を手作業で分解せず、標準のcsvモジュールを使います。列名、型、欠測値を確認してから数値へ変換します。</p>`)}
    ${details("オブジェクト指向とクラス", `<p>{{クラス}}は、データである属性と、それを操作するメソッドを一つの型として定義します。クラスから作った個別の実体がオブジェクトです。</p><p>継承は既存のクラスの性質を引き継ぎますが、単にコードを短くするためでなく「〜は〜の一種」と言える関係で使います。UMLのクラス図はクラス名、属性、操作、関連を図で整理します。</p>`)}
  `);

  append("programming-functions", `
    <h3>引数、戻り値、副作用を分けて読む</h3>
    <p>{{引数}}は関数へ渡す入力、<code>return</code>で返す値が戻り値です。画面表示、ファイル書込み、外部の変数変更など、戻り値以外に外部状態を変える処理を{{副作用}}といいます。計算だけを行う関数と入出力を行う関数を分けるとテストしやすくなります。</p>
    <p>関数内で代入した変数は通常{{ローカル変数}}です。多数の関数がグローバル変数を書き換える設計は、値が変わった場所を追いにくくします。</p>
    ${details("モジュールとライブラリ", `<p>関連する関数やクラスをファイルへまとめたものが{{モジュール}}です。<code>import math</code>のように読み込み、<code>math.sqrt()</code>のように名前空間を付けると、どのモジュールの機能か分かります。</p><p>標準ライブラリにはmath、random、statistics、csvなどがあります。外部ライブラリを使う場合は、入手先、ライセンス、更新状況、依存関係、対応バージョンを確認します。</p>`)}
  `);

  append("programming-recursion", `
    <h3>再帰には、必ず停止へ近づく基底条件を置く</h3>
    <p>再帰関数は同じ関数を呼び出します。呼出しごとに引数や戻り先がスタックへ保存されるため、入力が基底条件へ近づかないと無限に呼び続けます。</p>
    <pre class="code-block"><span class="keyword">def</span> factorial(n):\n    <span class="keyword">if</span> n == 0:       # 基底条件\n        <span class="keyword">return</span> 1\n    <span class="keyword">return</span> n * factorial(n - 1)</pre>
    ${details("再帰と反復の選択", `<p>木構造の探索、分割統治、数式の再帰的定義など、問題自体が同じ形の小問題へ分かれる場合は再帰が自然です。一方、単純な回数反復ではループの方が呼出しの負担が小さく、深さ制限も受けにくい場合があります。</p>`)}
  `);

  append("programming-flowchart", `
    ${details("大きなフローチャートを分割する", `<p>詳細を一枚へ詰め込むと線が交差し、開始から終了まで追えなくなります。主処理では「入力」「検査」「集計」「出力」のようなまとまりを処理記号で示し、別図や関数へ詳細を分けます。</p><p>複数ページへまたがる場合は結合子を使い、同じ記号名で接続します。判断から出る全経路がどこへ進み、どこで合流し、最終的に終了へ達するかを確認します。</p>`)}
  `);

  append("programming-sort-search", `
    <h3>探索は、整列済みかどうかで選べる手順が変わる</h3>
    <div class="table-wrap"><table class="lecture-table"><thead><tr><th>方法</th><th>前提</th><th>最悪時の比較回数の増え方</th></tr></thead><tbody><tr><td>線形探索</td><td>整列不要</td><td>nに比例</td></tr><tr><td>二分探索</td><td>探索キーで整列済み</td><td>log₂nに比例</td></tr></tbody></table></div>
    <p>二分探索では中央の値と比べ、候補範囲を半分ずつ捨てます。データが8個なら最大4回程度、1024個でも最大11回程度です。ただし、探索前に並べ替える費用と、データ追加後も順序を維持する費用があります。</p>
    <h3>基本的な整列アルゴリズムを比較する</h3>
    <div class="table-wrap"><table class="lecture-table"><thead><tr><th>方法</th><th>一回の考え方</th><th>特徴</th></tr></thead><tbody><tr><td>選択ソート</td><td>未整列部分から最小値を選び先頭と交換</td><td>交換回数は少なめ、比較は多い</td></tr><tr><td>バブルソート</td><td>隣接要素を比較し逆順なら交換</td><td>手順が分かりやすい</td></tr><tr><td>挿入ソート</td><td>次の値を整列済み部分の適切な位置へ挿入</td><td>ほぼ整列済みのデータで効率がよい</td></tr></tbody></table></div>
    ${details("計算量の見方", `<p>入力サイズnが増えた時の処理回数の増え方を{{時間計算量}}、必要な追加記憶の増え方を空間計算量といいます。定数倍や細かな差より、n、n log n、n²のような増え方を比べます。</p><p>実用のライブラリにはより効率的で安定性も考慮した整列が実装されているため、通常は組込みの<code>sorted()</code>や<code>list.sort()</code>を使い、学習では手順と計算量を理解します。</p>`)}
  `);

  append("programming-test", `
    <h3>誤りを、構文・実行時・論理へ分けて調べる</h3>
    <div class="table-wrap"><table class="lecture-table"><thead><tr><th>種類</th><th>例</th><th>調べ方</th></tr></thead><tbody><tr><td>構文エラー</td><td>括弧やコロン、字下げが不正</td><td>エラーが指す行と直前の行を読む</td></tr><tr><td>実行時エラー</td><td>0除算、範囲外の添字、変換失敗</td><td>入力とスタックトレースを確認</td></tr><tr><td>論理エラー</td><td>実行できるが答えが誤る</td><td>小さな例、境界値、途中値の追跡</td></tr></tbody></table></div>
    <p>関数ごとに期待する入力と出力を定め、同じテストを自動実行できるようにします。修正後は失敗した例だけでなく、以前成功していた例も再実行します。</p>
    ${details("データの可視化とシミュレーション", `<p>matplotlibなどの可視化ライブラリでは、データ、グラフの種類、軸、単位、凡例、タイトルを順に設定します。コードでグラフを作ると、データ更新時に同じ条件で再生成できます。</p><pre class="code-block">import matplotlib.pyplot as plt\n\nplt.plot(months, sales)\nplt.xlabel("月")\nplt.ylabel("売上（万円）")\nplt.show()</pre><p>乱数を使うシミュレーションではシードを記録し、試行回数を変えて結果が安定するか調べます。画面描画やアニメーションは、状態更新と表示処理を分けると検証しやすくなります。</p>`)}
    ${details("センサ、アクチュエータ、組込みコンピュータ", `<p>センサは温度、光、加速度など現実の量を電気信号へ変え、A/D変換で数値にします。アクチュエータはモータ、LED、スピーカなど、コンピュータの出力を物理的な動作へ変えます。</p><p>micro:bitなどでは、入力→判断→出力を繰り返します。誤った値や通信断を想定し、モータを止める上限、非常停止、手動操作などをプログラム外の安全設計と組み合わせます。</p>`)}
  `);

  append("programming-algorithm", `
    ${details("段階的詳細化と構造化プログラミング", `<p>最初から細かな命令を書かず、「入力する」「検査する」「集計する」「表示する」のような大きな処理へ分け、各処理をさらに具体化する方法を{{段階的詳細化}}といいます。</p><p>順次・分岐・反復の三つの基本構造を組み合わせ、処理のまとまりを関数へ分けると、入口と出口を追いやすくなります。途中から任意の位置へ飛ぶ複雑な流れを避け、どの条件でどこを通るか説明できる構造にします。</p>`)}
    ${details("プログラムの前に、入力・出力・制約を仕様にする", `<p>「平均を求める」だけでは、空のデータ、欠測値、小数、負数、最大件数をどう扱うか決まりません。入力の型と範囲、出力の形式、エラー時の動作、必要な速さを先に書きます。</p><p>仕様から正常例、境界例、異常例を作ると、実装前に曖昧さを発見できます。完成後はコードが動くかだけでなく、最初に決めた仕様を満たすかを評価します。</p>${officialLink("文部科学省 高等学校情報科『情報Ⅰ』教員研修用教材", "https://www.mext.go.jp/a_menu/shotou/zyouhou/detail/1416756.htm", "問題解決、プログラミング、ネットワーク、データ活用の公式研修教材を参照できます。")}`)}
  `);

  append("programming-values", `
    ${details("トレース表で、式の評価順と型の変化を追う", `<p>プログラムを読む時は、実行した行、条件の真偽、変数の値、出力を一行ずつ表へ記録します。頭の中だけで追うより、代入前後や反復回数のずれを発見しやすくなります。</p><p><code>input()</code>の結果は文字列、<code>/</code>の結果は実数など、処理によって型が変わる場合があります。値だけでなく型も併記し、どの時点で変換したかを確認します。</p>`)}
  `);

  append("programming-loop", `
    ${details("ループ不変条件で、繰り返しの正しさを説明する", `<p>各反復の開始時や終了時に必ず成り立つ性質を{{ループ不変条件}}といいます。合計を求める反復なら、「i個を処理した時点でtotalは先頭i個の合計」という性質です。</p><p>初期状態で成り立つか、一回処理しても保たれるか、終了時に目的の結論へつながるかを確認します。反復回数の数え間違いや、最後の要素を処理しない誤りを論理的に見つけられます。</p>`)}
  `);

  append("programming-data-structures", `
    ${details("代入・浅いコピー・深いコピー", `<p>リストを別の変数へ代入すると、二つの名前が同じリストを参照する場合があります。一方から要素を変更すると、もう一方から見える内容も変わります。</p><p><code>copy()</code>やスライスは外側のリストを複製しますが、二次元リストの内側まで独立するとは限りません。入れ子構造をすべて複製する必要がある場合は深いコピーを使います。値が変化する型では、内容だけでなく「同じ実体を共有しているか」を確認します。</p>`)}
    ${details("オブジェクトの関係は、継承だけではない", `<p>継承は「自動車は乗り物の一種」のような関係です。一方、「自動車はエンジンをもつ」のように、別のオブジェクトを部品として保持する関係を{{コンポジション}}といいます。</p><p>単に共通コードを再利用したいだけなら、関数や部品オブジェクトを組み合わせる方が自然な場合があります。UMLでは、クラス図で構造、ユースケース図で利用者と機能、状態遷移図で状態変化、シーケンス図で時間順のやり取りを表します。</p>`)}
  `);

  append("programming-functions", `
    ${details("関数の契約と副作用", `<p>関数が受け付ける条件を事前条件、処理後に保証する状態を事後条件として整理できます。例えば平方根を求める関数なら、実数の範囲では入力が0以上であることを事前条件にします。</p><p>同じ引数なら同じ戻り値を返し、外部状態を変えない関数はテストしやすく再利用しやすい性質があります。乱数、時刻、ファイル、画面表示を使う処理は、副作用を担当する関数へ分けると計算部分を独立して検証できます。</p>`)}
  `);

  append("programming-sort-search", `
    ${details("安定な整列と複数キー", `<p>同じキーをもつ要素の元の順序を保つ整列を{{安定ソート}}といいます。先に氏名で並べ、次に得点で安定ソートすると、同点内の氏名順を保てます。</p><p>複数キーを一度に扱う場合は、<code>(-score, name)</code>のような組を比較キーにします。数値の昇順・降順、文字の大小、欠測値の位置を仕様として決めておきます。</p>`)}
  `);

  append("programming-test", `
    ${details("例外処理は、想定できる失敗を扱う", `<p><code>try</code>と<code>except</code>は、数値変換の失敗やファイルが見つからない場合など、実行時に起こり得る問題へ対応する仕組みです。すべての例外を無条件に無視すると、原因を隠して誤った処理を続けます。</p><p>扱える例外だけを捕捉し、利用者へ再入力を求める、記録して安全に終了するなどの動作を決めます。プログラムの誤りまで例外処理で隠さず、開発中はスタックトレースを読んで根本原因を直します。</p><pre class="code-block"><span class="keyword">try</span>:\n    age = int(text)\n<span class="keyword">except</span> ValueError:\n    print("整数で入力してください")</pre>`)}
    ${details("センサ値には雑音・校正・ヒステリシスがある", `<p>同じ温度でもセンサ値は少し揺れます。一回の値だけでON/OFFを切り替えると装置が細かく反転するため、「30 ℃以上でON、28 ℃以下でOFF」のように異なるしきい値を使う{{ヒステリシス}}が有効です。</p><p>既知の基準と比べて補正する校正、複数回の平均、異常範囲の除外も使います。ただし、平均すると急な変化への反応が遅れるため、安全装置では応答時間と雑音低減を両立させます。</p>`)}
  `);
  // 言語機能を暗記で終わらせず、設計上の使い分けまで補う。
  append("programming-functions", `
    ${details("位置引数・キーワード引数・デフォルト値", `<p>呼出し時の順番で対応を決めるものが位置引数、<code>width=4</code>のように仮引数名を示すものがキーワード引数です。キーワードを使うと、同じ型の引数が並ぶ関数でも意味が読み取りやすくなります。</p><p><code>def greet(name, message="こんにちは"):</code>のようなデフォルト値は、省略時の動作を定めます。ただし、リストなど変更可能な値をデフォルトにすると呼出し間で共有されるため、通常は<code>None</code>を使い、関数内で新しい値を作ります。</p><pre class="code-block"><span class="keyword">def</span> rectangle_area(width, height=1):\n    <span class="keyword">return</span> width * height\n\narea = rectangle_area(width=4, height=3)</pre>`)}
  `);

  append("programming-test", `
    ${details("try・except・else・finallyの役割を分ける", `<p><code>try</code>には失敗する可能性がある最小限の処理を置き、<code>except</code>では予想した例外を種類ごとに扱います。例外が起きなかった時だけ進めたい処理は<code>else</code>へ置けます。</p><p><code>finally</code>は成功・失敗にかかわらず実行されるため、確保した資源の解放に使います。ただし、ファイルは<code>with</code>文を使う方が閉じ忘れを防ぎやすい設計です。例外を握りつぶさず、利用者へ伝える内容と開発者が調べる記録を分けます。</p>`)}
    ${details("イベント駆動では、入力が起きるまで待つ", `<p>GUIやゲームでは、上から下へ一度実行して終わるだけでなく、クリック、キー入力、タイマー、通信受信などの{{イベント}}が起きた時に対応する関数が呼ばれます。この仕組みをイベント駆動といいます。</p><p>画面に表示する処理、現在の状態を更新する処理、入力を判断する処理を分けます。イベントごとに変数をばらばらに書き換えると動作を追いにくいため、「待機中」「実行中」「終了」のような状態と、遷移できる条件を整理します。</p>`)}
  `);

  append("programming-data-structures", `
    ${details("NumPy・pandasは、同じ表でも役割が違う", `<p>NumPyの配列は、同じ型の数値を多次元に並べ、要素ごとの計算や行列計算を効率よく行う土台です。pandasの{{DataFrame}}は列ごとに名前と型を持つ表で、CSVの読込み、欠測処理、抽出、集計、結合に向きます。</p><p>どちらもPythonのリストを置き換える魔法ではありません。行と列が何を表すか、数値と文字列が混ざっていないか、欠測値がどう表現されるかを先に確認します。小さなデータで期待する結果を確かめてから全体へ適用します。</p><pre class="code-block">import pandas as pd\n\ndata = pd.read_csv("scores.csv")\nmean_by_class = data.groupby("class")["score"].mean()</pre>`)}
  `);
})();
