(function () {
  "use strict";

  window.LECTURE_CONTENT.programming = {
    kicker: "FIELD 05 / PROGRAMMING",
    title: "処理を分解し、順序・分岐・反復で組み立てる",
    lead: "Pythonの値と型、制御構造、データ構造、関数、探索と整列まで。まずプログラムを読み、その後で表や図を使って値の変化と処理の流れを確かめます。",
    meta: ["共通テスト用プログラム表記", "アルゴリズムとフローチャート", "変数と配列", "分岐・for・while", "関数"],
    sections: [
      {
        id: "programming-algorithm",
        short: "アルゴリズムと基本構造",
        kicker: "ALGORITHM · FLOWCHART",
        title: "手順を、順次・分岐・反復で組み立てる",
        lead: "アルゴリズムをプログラムとフローチャートの両方で読めるようにします。",
        html: `
          <p>{{アルゴリズム}}は問題を解くための明確で有限な手順です。アルゴリズムをプログラミング言語で記述し、コンピュータが実行できる形にしたものが{{プログラム}}です。</p>
          <pre class="code-block"><span class="comment"># 長方形の面積</span>\nwidth = float(input("幅: "))\nheight = float(input("高さ: "))\narea = width * height\nprint(area)</pre>
          <div class="step-flow" style="--steps:4"><article class="step-item"><b>入力</b><p>input()で受け取る。</p></article><article class="step-item"><b>変換・保存</b><p>数値へ変換し変数へ代入。</p></article><article class="step-item"><b>処理</b><p>式や制御構造で計算。</p></article><article class="step-item"><b>出力</b><p>print()で結果を示す。</p></article></div>
          <p>複雑なプログラムも、文を上から実行する{{順次}}、条件によって進む処理を選ぶ{{分岐}}、同じ範囲を繰り返す{{反復}}を組み合わせて作ります。</p>
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/basic-structures.png" alt="開始と終了を含む順次・分岐・反復のフローチャートを、処理・入出力・判断・繰返し始端と終端の正しい記号で表した図"><figcaption>反復は判断記号と戻り矢印で代用せず、繰返し始端と繰返し終端を対にして範囲を示す。分岐の判断記号から出る線には条件の結果を書く。</figcaption></figure>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>記号</th><th>形</th><th>役割</th></tr></thead><tbody><tr><td>端子</td><td>角丸の長方形</td><td>開始・終了</td></tr><tr><td>処理</td><td>長方形</td><td>計算、代入、手続き</td></tr><tr><td>入出力</td><td>平行四辺形</td><td>入力、表示、読込み、書出し</td></tr><tr><td>判断</td><td>ひし形</td><td>条件に応じて経路を選ぶ</td></tr><tr><td>繰返し</td><td>始端は上の角、終端は下の角を切った記号</td><td>二つの記号の間を指定条件で繰り返す</td></tr></tbody></table></div>
          <p>フローチャートはコードの一行を機械的に一箱へ写すものではありません。入力、計算・代入、条件判断、出力、繰返しという役割で記号を選び、開始から終了まで矢印を手でたどれる形にします。</p>
          <p>アルゴリズムは、同じ入力に対して正しい結果が得られるだけでなく、終了すること、手順が曖昧でないこと、扱う入力の範囲が明確であることも重要です。</p>`
      },
      {
        id: "programming-common-test",
        short: "共通テスト用プログラム表記",
        kicker: "COMMON TEST NOTATION",
        title: "共通テスト用プログラム表記を、処理のまとまりごとに読む",
        lead: "特定のプログラミング言語に依存せず、変数・配列・分岐・反復の考え方を共通の表記で示します。",
        html: `
          <p>大学入学共通テスト「情報Ⅰ」では、学校ごとに学ぶプログラミング言語が異なることを踏まえ、問題中で{{共通テスト用プログラム表記}}を使います。特定の実装言語に依存せず処理の考え方を示す{{擬似言語（擬似コード）}}であり、新しいプログラミング言語を一つ覚えるというより、問題文の説明と照らしながら処理を読むための共通表記です。</p>
          <div class="table-wrap"><table class="lecture-table common-notation-table"><thead><tr><th>項目</th><th>表記と例</th><th>読むときの要点</th></tr></thead><tbody>
            <tr><td>変数</td><td><code>kosu</code>、<code>kingaku_goukei</code></td><td>英字で始まる英数字と「_」の並び</td></tr>
            <tr><td>配列変数</td><td><code>Tokuten[3]</code>、<code>Data[2,4]</code></td><td>配列名の先頭は大文字。特に説明がなければ添字は0から始まる</td></tr>
            <tr><td>代入</td><td><code>kosu = 3</code><br><code>nyuryoku = 【外部からの入力】</code></td><td>右辺を先に求め、結果を左辺へ入れる</td></tr>
            <tr><td>算術演算</td><td><code>+　-　*　/　÷　％　**</code></td><td><code>÷</code>は整数の商、<code>％</code>は余り、<code>**</code>はべき乗</td></tr>
            <tr><td>比較演算</td><td><code>==　!=　&gt;　&lt;　&gt;=　&lt;=</code></td><td><code>=</code>は代入、<code>==</code>は等しいかの比較</td></tr>
            <tr><td>論理演算</td><td><code>and　or　not</code></td><td>条件を組み合わせる／否定する</td></tr>
            <tr><td>関数</td><td><code>kazu = 要素数(Data)</code><br><code>表示する("データの要素数は", kazu, "です")</code></td><td>「表示する」以外は、基本的に問題文中で働きが説明される</td></tr>
          </tbody></table></div>
          <div class="key-point"><strong>縦線の記号は、処理の範囲を示す</strong><p><code>｜</code>は次の行も同じ分岐・反復の中であることを示し、<code>⎿</code>はそのまとまりの最後の行を示します。行頭の（1）（2）などは参照用の行番号で、実行する命令ではありません。</p></div>
          <div class="notation-example-grid">
            <article><h3>例0：条件が真なら表示</h3><pre class="code-block common-test-code">（1）もし x &gt;= 3 ならば：
（2）⎿ 表示する("xの値は", x)</pre><p>xが3以上のときだけ2行目を実行します。条件が偽なら、2行目を飛ばしてこの分岐の後へ進みます。</p></article>
            <article><h3>例1：三つの道に分ける</h3><pre class="code-block common-test-code">（1）もし x &gt;= 3 ならば：
（2）｜ x = x - 1
（3）そうでなくもし x &lt; 0 ならば：
（4）｜ x = x * 2
（5）そうでなければ：
（6）⎿ x = x + 3</pre><p>条件は上から順に調べ、最初に当てはまった一つだけを実行します。例えばx＝4なら3、x＝−2なら−4、x＝1なら4になります。</p></article>
            <article><h3>例2：回数を決めた反復</h3><pre class="code-block common-test-code">（1）x を 0 から 9 まで 1 ずつ増やしながら繰り返す：
（2）⎿ goukei = goukei + Data[x]</pre><p>xは0、1、…、9と変わり、配列Dataの10個の要素を順に加えます。「0から9まで」は両端を含みます。</p></article>
            <article><h3>例3：条件で続ける反復</h3><pre class="code-block common-test-code">（1）n &lt; 10 の間繰り返す：
（2）｜ goukei = goukei + n
（3）⎿ n = n + 1</pre><p>毎回、条件<code>n &lt; 10</code>を先に確かめます。3行目でnを1増やすため、やがて条件が偽になって終了します。</p></article>
          </div>
          <div class="warning"><strong>問題文の説明を優先する</strong><p>共通テストでは、問題を簡潔にするため表記がこの例と異なる場合があります。配列の添字、関数の働き、繰返しの端を問題文で確認し、その指定に沿って読みます。</p></div>
          <a class="official-link" href="https://www.dnc.ac.jp/albums/abm.php?d=744&amp;f=abm00003141.pdf&amp;n=6-1_%E6%A6%82%E8%A6%81%E3%80%8C%E6%83%85%E5%A0%B1%E3%80%8D.pdf" target="_blank" rel="noopener noreferrer"><span class="official-link-kicker">公式資料</span><strong>大学入試センター「共通テスト用プログラム表記の例示」</strong><small>変数・配列・演算・分岐・反復の公式例を確認できます。</small><b aria-hidden="true">↗</b></a>`
      },
      {
        id: "programming-values",
        short: "値・変数・型・演算子",
        kicker: "VALUE · VARIABLE · TYPE",
        title: "値の型を意識し、式の結果を予測する",
        lead: "Pythonでは値が型をもち、演算子の意味は型によって変わります。",
        html: `
          <pre class="code-block">name = "Mai"
score = 72
bonus = 8
total = score + bonus
passed = total &gt;= 60

print(name, total, passed)</pre>
          <p><code>name</code>、<code>score</code>などが{{変数}}です。変数は値を入れる箱というより、プログラム内の値へ名前を付けたものと考えます。<code>=</code>は右辺を先に計算し、その結果を左辺の変数へ{{代入}}します。</p>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>型</th><th>意味</th><th>例</th></tr></thead><tbody><tr><td>{{int}}</td><td>整数</td><td>42, -7</td></tr><tr><td>{{float}}</td><td>浮動小数点数</td><td>3.14, 1.0</td></tr><tr><td>{{str}}</td><td>文字列</td><td>"情報Ⅰ"</td></tr><tr><td>{{bool}}</td><td>真偽値</td><td>True, False</td></tr></tbody></table></div>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>演算子</th><th>意味</th><th>例</th></tr></thead><tbody><tr><td>+ − * /</td><td>加減乗除</td><td>7 / 2 → 3.5</td></tr><tr><td>//</td><td>切り下げ除算</td><td>7 // 2 → 3</td></tr><tr><td>%</td><td>余り</td><td>7 % 2 → 1</td></tr><tr><td>**</td><td>べき乗</td><td>2 ** 5 → 32</td></tr><tr><td>== != &lt; &lt;= &gt; &gt;=</td><td>比較</td><td>7 &gt; 5 → True</td></tr><tr><td>and / or / not</td><td>論理演算</td><td>age &gt;= 18 and has_id</td></tr></tbody></table></div>
          <p>代入の{{=}}と、等しいか比較する{{==}}を区別します。複数の演算子がある式では、括弧を使って意図を明確にします。</p>`
      },
      {
        id: "programming-branch",
        short: "条件分岐",
        kicker: "IF · ELIF · ELSE",
        title: "条件を上から評価し、実行する処理を一つ選ぶ",
        lead: "分岐の条件は真偽値になり、インデントが処理のまとまりを示します。",
        html: `
          <pre class="code-block">score = int(input("点数: "))\n\n<span class="keyword">if</span> score &gt;= 80:\n    grade = "A"\n<span class="keyword">elif</span> score &gt;= 60:\n    grade = "B"\n<span class="keyword">else</span>:\n    grade = "C"\n\nprint(grade)</pre>
          <p><code>if</code>の後ろへ条件を書き、行末にコロンを付けます。条件が真のときに実行する文は同じ深さにインデントします。<code>elif</code>は前の条件が偽だったときに別の条件を調べ、<code>else</code>はどの条件も真でなかった場合を受け持ちます。</p>
          <p><code>if</code>、<code>elif</code>の条件は上から順に評価し、{{最初に真になったブロックだけ}}を実行します。上の例で85点は最初の条件<code>score &gt;= 80</code>が真になるためAです。75点は最初が偽、次の<code>score &gt;= 60</code>が真なのでBです。40点はどちらも偽なので<code>else</code>へ進みます。</p>
          <p>条件の順番には意味があります。もし<code>score &gt;= 60</code>を先に置くと、85点もそこで真になってBと判定され、後ろの80点以上の条件へ到達しません。範囲が重なる条件は、一般に狭い範囲・高いしきい値から先に判定します。</p>
          <div class="warning"><strong>境界値を試す</strong><p>59、60、79、80のように条件が切り替わる直前・直後をテストします。条件の重複や抜けを見つけやすくなります。</p></div>
          <div class="practice"><strong>例：料金区分</strong><p>年齢が18歳未満なら子ども料金、65歳未満なら一般料金、それ以外はシニア料金とします。最初に<code>age &lt; 18</code>、次に<code>age &lt; 65</code>と判定すると、0〜17、18〜64、65以上の範囲を重複なく分けられます。</p></div>
          <p>条件式を入れ子にしすぎると、どの<code>else</code>がどの<code>if</code>に対応するか分かりにくくなります。<code>elif</code>で同じ段へそろえる、複雑な条件へ名前を付けて関数にするなど、構造が一目で追える形にします。</p>`
      },
      {
        id: "programming-for",
        short: "forによる反復",
        kicker: "FOR · RANGE",
        title: "forは、決めた範囲の値を順番に取り出す",
        lead: "回数や処理する要素が分かっている反復に向きます。",
        html: `
          <pre class="code-block">total = 0

<span class="keyword">for</span> n <span class="keyword">in</span> range(1, 6):
    total = total + n

print(total)  <span class="comment"># 15</span></pre>
          <p><code>range(1, 6)</code>が作る1、2、3、4、5を、変数<code>n</code>へ一つずつ代入します。各回で現在の<code>total</code>に<code>n</code>を加え、最後に1から5までの合計15を表示します。反復する文は、<code>for</code>より一段深くインデントします。</p>
          <p><code>range(start, stop, step)</code>では{{stopを含みません}}。<code>range(5)</code>は0、1、2、3、4、<code>range(10, 0, -2)</code>は10、8、6、4、2です。開始値・終了直前の値・増減値を、小さな例で先に書き出すと回数のずれを防げます。</p>
          <h3>プログラムを読んでから、値の変化を表で確かめる</h3>
          <figure class="html-figure"><div class="trace-grid single-trace"><section><div class="trace-row trace-head"><span>n</span><span>開始前</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><div class="trace-row"><b>total</b><span>0</span><span>1</span><span>3</span><span>6</span><span>10</span><span>15</span></div><p>表の各列は、反復を1回終えた直後の値を示す。5を処理した後、次の要素がないのでforを終了する。</p></section></div><figcaption>コードの代入文と同じ順序で値を更新する。表を先に見るのではなく、どの文が値を変えるかをコードで確認してから追跡する。</figcaption></figure>
          <div class="practice"><strong>リストを直接処理する</strong><p><code>for score in scores:</code>のように書けば、添字を作らずリストの要素を先頭から取り出せます。要素そのものが必要なのか、位置の番号も必要なのかで書き方を選びます。</p></div>`
      },
      {
        id: "programming-while",
        short: "whileによる反復",
        kicker: "WHILE · CONDITION",
        title: "whileは、条件が真である間だけ繰り返す",
        lead: "何回になるかを事前に決めにくい反復に向きます。",
        html: `
          <pre class="code-block">n = 1

<span class="keyword">while</span> n &lt; 100:
    n = n * 2

print(n)  <span class="comment"># 128</span></pre>
          <p><code>while</code>は反復の前に条件を調べます。<code>n</code>が100未満なら本体を実行して2倍し、もう一度条件へ戻ります。64を処理すると128になり、次の判定で<code>128 &lt; 100</code>が偽になるため反復を終了して128を表示します。</p>
          <p>whileでは、{{初期値}}、{{継続条件}}、{{更新処理}}を一組で読みます。この例は初期値<code>n = 1</code>、継続条件<code>n &lt; 100</code>、更新処理<code>n = n * 2</code>です。</p>
          <h3>判定する時点をそろえてトレースする</h3>
          <figure class="html-figure"><div class="trace-grid single-trace"><section><div class="trace-row trace-head"><span>判定時のn</span><span>1</span><span>2</span><span>4</span><span>8</span><span>16</span><span>32</span><span>64</span><span>128</span></div><div class="trace-row"><b>n&lt;100</b><span>真</span><span>真</span><span>真</span><span>真</span><span>真</span><span>真</span><span>真</span><span>偽</span></div><p>128のときは本体を実行しない。条件が偽になった後のnが、そのままprintへ渡る。</p></section></div><figcaption>whileは「処理してから判定」ではなく、毎回「判定してから処理」する。最後に条件を調べた値も表へ残す。</figcaption></figure>
          <div class="warning"><strong>無限ループを防ぐ</strong><p>条件に関係する変数が、条件を偽へ近づけるよう更新されなければ終了しません。更新文がインデントの外へ出ていないか、値が本当に変わるか、境界値で条件が偽になるかを確認します。</p></div>`
      },
      {
        id: "programming-data-structures",
        short: "配列",
        kicker: "ARRAY · INDEX",
        title: "複数の値を配列へまとめ、添字で一つを指定する",
        lead: "得点や気温のように同じ意味の値を並べ、反復と組み合わせて処理します。",
        html: `
          <pre class="code-block">scores = [72, 85, 91, 68]

print(scores[0])  <span class="comment"># 最初の72</span>
scores[3] = 70    <span class="comment"># 4番目を70へ更新</span>

total = 0
<span class="keyword">for</span> score <span class="keyword">in</span> scores:
    total = total + score

print(total)</pre>
          <p>{{配列}}は複数の値を順番にまとめたものです。Pythonではリストを使います。最初の要素の添字は{{0}}なので、4個の要素の添字は0、1、2、3です。要素数が4のとき<code>scores[4]</code>を指定すると範囲外になります。</p>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>表し方</th><th>例</th><th>読み方</th></tr></thead><tbody><tr><td>一次元配列</td><td><code>Scores[2]</code></td><td>Scoresの添字2、つまり3番目の要素</td></tr><tr><td>二次元配列</td><td><code>Data[1,3]</code></td><td>行と列など、二つの添字で位置を指定。どちらが行かは問題文で確認</td></tr></tbody></table></div>
          <div class="key-point"><strong>要素と添字を混同しない</strong><p><code>scores[2]</code>の2は得点そのものではなく位置を表す添字です。この例では添字2の要素は91です。</p></div>`
      },
      {
        id: "programming-functions",
        short: "関数",
        kicker: "FUNCTION · SCOPE",
        title: "処理へ名前をつけ、入力と出力を明確にする",
        lead: "関数は重複を減らし、テストできる小さな単位をつくります。",
        html: `
          <pre class="code-block"><span class="keyword">def</span> rectangle_area(width, height):\n    area = width * height\n    <span class="keyword">return</span> area\n\nresult = rectangle_area(4, 3)\nprint(result)</pre>
          <figure class="html-figure"><div class="function-flow"><section><span>呼出し元</span><strong>rectangle_area(4, 3)</strong><small>実引数を渡す</small></section><i aria-hidden="true">→</i><section><span>関数の作業領域</span><strong>width＝4　height＝3</strong><small>ローカル変数 area＝12</small></section><i aria-hidden="true">→</i><section><span>戻り値</span><strong>return 12</strong><small>呼出し元のresultへ代入</small></section></div><figcaption>先に読んだプログラムを図で確認する。引数で必要な値を受け取り、関数内のローカル変数で処理し、戻り値だけを呼出し元へ返す。</figcaption></figure>
          <p>関数定義のwidth・heightを{{仮引数}}、呼出し時の4・3を{{実引数}}といいます。returnは呼出し元へ値を返し、その時点で関数の実行を終了します。</p>
          <p>関数内で作った変数は原則として{{ローカル変数}}で、その関数の外から直接使えません。必要な値は引数で受け取り、戻り値で返すと依存関係が明確になります。</p>
          <div class="key-point"><strong>一つの関数に一つの役割</strong><p>入力、計算、表示を分けると、どの部分が誤っているかを確かめやすくなります。まずは「引数を受け取る→計算する→戻り値を返す」という基本を読めるようにします。</p></div>`
      },
      {
        id: "programming-sort-search",
        short: "整列と探索",
        kicker: "SORT · SEARCH",
        title: "値を並べ替え、目的の値を見つける手順を追う",
        lead: "整列では比較と交換、探索では調べる順序と前提条件に注目します。",
        html: `
          <h3>バブルソート：隣り合う値を比べて交換する</h3>
          <figure class="html-figure"><div class="step-flow sort-flow" style="--steps:4"><article class="step-item"><b>開始</b><p>3　8　2　6　5</p></article><article class="step-item"><b>1巡目</b><p>3　2　6　5　8</p></article><article class="step-item"><b>2巡目</b><p>2　3　5　6　8</p></article><article class="step-item"><b>完了</b><p>2　3　5　6　8</p></article></div><figcaption>左から隣り合う二つを比べ、左が大きければ交換する。一巡すると、その範囲で最大の値が右端へ移る。</figcaption></figure>
          <p>{{バブルソート}}は、隣り合う二つを順に比べ、順序が逆なら交換します。一巡ごとに、まだ整列していない範囲を一つ狭くして同じ処理を繰り返します。</p>
          <h3>線形探索と二分探索</h3>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>方法</th><th>調べ方</th><th>前提</th></tr></thead><tbody><tr><td>{{線形探索}}</td><td>先頭から一つずつ、目的の値と等しいか調べる</td><td>並び順を問わない</td></tr><tr><td>{{二分探索}}</td><td>中央の値と比べ、目的の値があり得る半分だけを残す</td><td>値が昇順または降順に整列済み</td></tr></tbody></table></div>
          <p>例えば整列済みの<code>[3, 18, 29, 33, 48, 52, 62, 77, 89, 97]</code>から52を二分探索すると、まず中央付近の48と比べます。52は48より大きいので左半分を除き、残った右側の中央を調べます。このように候補をほぼ半分ずつ減らします。</p>`
      },
      {
        id: "programming-test",
        short: "テストと練習",
        kicker: "TEST · DEBUG · PRACTICE",
        title: "正常値・境界値・異常値を試し、原因を切り分ける",
        lead: "プログラムは、動いたかではなく、想定した範囲で正しく動くかを確かめます。",
        html: `
          <div class="three-grid"><article class="concept-card"><h3>正常値</h3><p>典型的な入力で期待する結果になるか。</p></article><article class="concept-card warm"><h3>境界値</h3><p>条件が切り替わる直前・直後、空、最小、最大。</p></article><article class="concept-card violet"><h3>異常値</h3><p>文字列、範囲外、欠損などをどう扱うか。</p></article></div>
          <p>構文が言語の規則に合わない{{構文エラー}}、実行中に不正な処理が起こる{{実行時エラー}}、実行できても答えが誤る{{論理エラー}}を区別します。</p>
          <div class="practice"><strong>練習1：偶数判定</strong><p>整数nを入力し、偶数なら「偶数」、奇数なら「奇数」と表示するプログラムを作りましょう。0、正の数、負の数で試します。</p><details class="practice-solution"><summary>解答例・解説</summary><div><pre class="code-block">n = int(input("整数: "))

<span class="keyword">if</span> n % 2 == 0:
    print("偶数")
<span class="keyword">else</span>:
    print("奇数")</pre><p>2で割った余りが0なら偶数です。Pythonでは負の偶数でも余りは0になるため、−4も正しく偶数と判定できます。0も2で割り切れるので偶数です。</p></div></details></div>
          <div class="practice"><strong>練習2：うるう年</strong><p>西暦yearを入力し、うるう年か平年かを表示しましょう。400の倍数はうるう年、400の倍数でない100の倍数は平年、それ以外の4の倍数はうるう年です。</p><details class="practice-solution"><summary>解答例・解説</summary><div><pre class="code-block">year = int(input("西暦: "))

<span class="keyword">if</span> year % 400 == 0:
    print("うるう年")
<span class="keyword">elif</span> year % 100 == 0:
    print("平年")
<span class="keyword">elif</span> year % 4 == 0:
    print("うるう年")
<span class="keyword">else</span>:
    print("平年")</pre><p>例外が強い条件から先に調べます。1900は100の倍数だが400の倍数ではないので平年、2000は400の倍数なのでうるう年、2024は4の倍数なのでうるう年です。</p></div></details></div>
          <div class="practice"><strong>練習3：素数判定</strong><p>2以上の整数nが素数か調べましょう。2からn−1までのどれかで割り切れれば素数ではありません。</p><details class="practice-solution"><summary>解答例・解説</summary><div><pre class="code-block">n = int(input("2以上の整数: "))
is_prime = True

<span class="keyword">for</span> i <span class="keyword">in</span> range(2, n):
    <span class="keyword">if</span> n % i == 0:
        is_prime = False

<span class="keyword">if</span> is_prime:
    print("素数")
<span class="keyword">else</span>:
    print("素数ではない")</pre><p>例えばn＝7なら2〜6のどれでも割り切れないので素数です。n＝9ならi＝3で余り0となり、素数ではないと分かります。この解答は分かりやすさを優先しています。より少ない回数で調べる方法もあります。</p></div></details></div>
          <p>デバッグでは、入力・途中の変数・条件式・出力を小さく確認します。原因を推測して一度に多く直すのではなく、{{再現条件}}を固定し、一つずつ検証します。</p>`
      }
    ]
  };
})();
