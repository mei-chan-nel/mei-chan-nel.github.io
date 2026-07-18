(function () {
  "use strict";

  window.LECTURE_CONTENT.programming = {
    kicker: "FIELD 05 / PROGRAMMING",
    title: "処理を分解し、順序・分岐・反復で組み立てる",
    lead: "Pythonの値と型、制御構造、データ構造、関数、再帰、探索と整列まで。コードとフローチャートを対応させて学びます。",
    meta: ["変数と配列", "分岐と反復", "関数", "探索と整列", "シミュレーション"],
    sections: [
      {
        id: "programming-algorithm",
        short: "アルゴリズムとPython",
        kicker: "ALGORITHM · PROGRAM",
        title: "問題を、実行可能な手順へ分解する",
        lead: "アルゴリズムは問題を解く有限の手順、プログラムはそれを言語で表したものです。",
        html: `
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/python-flow.png" alt="入力、変数への保存、処理、出力というPythonプログラムの基本的な値の流れ"><figcaption>入力値は文字列として受け取り、必要に応じて型変換してから処理する。</figcaption></figure>
          <p>{{アルゴリズム}}は問題を解くための明確で有限な手順です。アルゴリズムをプログラミング言語で記述し、コンピュータが実行できる形にしたものが{{プログラム}}です。</p>
          <pre class="code-block"><span class="comment"># 長方形の面積</span>\nwidth = float(input("幅: "))\nheight = float(input("高さ: "))\narea = width * height\nprint(area)</pre>
          <div class="step-flow" style="--steps:4"><article class="step-item"><b>入力</b><p>input()で受け取る。</p></article><article class="step-item"><b>変換・保存</b><p>数値へ変換し変数へ代入。</p></article><article class="step-item"><b>処理</b><p>式や制御構造で計算。</p></article><article class="step-item"><b>出力</b><p>print()で結果を示す。</p></article></div>
          <p>同じ入力に対して正しい結果が得られるだけでなく、終了すること、手順が曖昧でないこと、扱う範囲が明確であることも重要です。</p>`
      },
      {
        id: "programming-values",
        short: "値・変数・型・演算子",
        kicker: "VALUE · VARIABLE · TYPE",
        title: "値の型を意識し、式の結果を予測する",
        lead: "Pythonでは値が型をもち、演算子の意味は型によって変わります。",
        html: `
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/values-types.png" alt="int、float、str、boolの値と、算術・比較・論理演算子を整理した図"><figcaption>input()の戻り値はstr。数値計算の前にint()やfloat()で変換する。</figcaption></figure>
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
          <p>構造化プログラミングでは、処理を{{順次}}・{{分岐}}・{{反復}}の三つの基本構造で組み立てます。順次は上から順に一度ずつ実行し、分岐は条件に応じて一方の経路を選び、反復は条件を満たす間または要素が残る間、同じ処理を繰り返します。どの構造も入口と出口を一つにすると、構造の中へ別の構造を組み込みやすくなります。</p>
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/control-flow.png" alt="入口と出口をそろえ、順次は処理を縦に並べ、分岐は二つの枝を合流し、反復は条件へ戻る三つの基本構造"><figcaption>分岐の二経路は合流して出口へ進む。反復は条件が真なら処理後に判定へ戻り、偽なら出口へ進む。</figcaption></figure>
          <pre class="code-block">score = int(input("点数: "))\n\n<span class="keyword">if</span> score &gt;= 80:\n    grade = "A"\n<span class="keyword">elif</span> score &gt;= 60:\n    grade = "B"\n<span class="keyword">else</span>:\n    grade = "C"\n\nprint(grade)</pre>
          <p><code>if</code>、<code>elif</code>の条件は上から順に評価し、{{最初に真になったブロックだけ}}を実行します。上の例で85点は最初の条件<code>score &gt;= 80</code>が真になるためAです。75点は最初が偽、次の<code>score &gt;= 60</code>が真なのでBです。40点はどちらも偽なので<code>else</code>へ進みます。</p>
          <p>条件の順番には意味があります。もし<code>score &gt;= 60</code>を先に置くと、85点もそこで真になってBと判定され、後ろの80点以上の条件へ到達しません。範囲が重なる条件は、一般に狭い範囲・高いしきい値から先に判定します。</p>
          <div class="warning"><strong>境界値を試す</strong><p>59、60、79、80のように条件が切り替わる直前・直後をテストします。条件の重複や抜けを見つけやすくなります。</p></div>
          <div class="practice"><strong>例：料金区分</strong><p>年齢が18歳未満なら子ども料金、65歳未満なら一般料金、それ以外はシニア料金とします。最初に<code>age &lt; 18</code>、次に<code>age &lt; 65</code>と判定すると、0〜17、18〜64、65以上の範囲を重複なく分けられます。</p></div>
          <p>条件式を入れ子にしすぎると、どの<code>else</code>がどの<code>if</code>に対応するか分かりにくくなります。<code>elif</code>で同じ段へそろえる、複雑な条件へ名前を付けて関数にするなど、構造が一目で追える形にします。</p>`
      },
      {
        id: "programming-loop",
        short: "反復",
        kicker: "FOR · WHILE",
        title: "回数が決まる反復と、条件で続く反復を使い分ける",
        lead: "終了条件と、反復ごとに変化する値を明確にします。",
        html: `
          <p>{{反復}}では、各回の処理だけでなく「何を初期値にするか」「いつ続けるか」「1回ごとに何が変わるか」「いつ終了するか」を確認します。値の変化を表にして追跡することをトレースといい、無限ループや1回多い・少ない誤りを見つける基本的な方法です。</p>
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/loops.png" alt="forで1から5を加算するtotalの変化と、whileでnを2倍しながら128で条件が偽になるまでのトレース表"><figcaption>forは取り出す要素がなくなると終了し、whileは判定が偽になった時点で処理せず終了する。</figcaption></figure>
          <div class="compare-grid"><article class="concept-card"><h3>for</h3><pre class="code-block">total = 0\n<span class="keyword">for</span> n <span class="keyword">in</span> range(1, 6):\n    total += n\nprint(total)  <span class="comment"># 15</span></pre><p>範囲や要素列が決まっている反復に向きます。</p></article><article class="concept-card green"><h3>while</h3><pre class="code-block">n = 1\n<span class="keyword">while</span> n &lt; 100:\n    n *= 2\nprint(n)  <span class="comment"># 128</span></pre><p>条件が真の間続ける反復に向きます。</p></article></div>
          <p><code>range(start, stop, step)</code>では{{stopを含みません}}。<code>range(1, 6)</code>は1, 2, 3, 4, 5で、5回反復します。<code>range(5)</code>は0, 1, 2, 3, 4、<code>range(10, 0, -2)</code>は10, 8, 6, 4, 2です。</p>
          <p>図のforではtotalが0→1→3→6→10→15と変わります。whileでは判定時のnが1、2、4、8、16、32、64なら<code>n &lt; 100</code>が真で2倍します。nが128になった次の判定は偽なので、<code>n *= 2</code>を実行せずループを抜けます。</p>
          <div class="warning"><strong>無限ループ</strong><p>whileの条件に関係する変数が更新されないと終了しません。ループ前の初期値、継続条件、更新処理をセットで確認します。</p></div>`
      },
      {
        id: "programming-data-structures",
        short: "データ構造",
        kicker: "LIST · TUPLE · SET · DICT",
        title: "順序・変更・重複・検索方法で構造を選ぶ",
        lead: "データの使い方に合う構造を選ぶと、処理を短く明確に書けます。",
        html: `
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/data-structures.png" alt="リスト、タプル、集合、辞書の特徴と操作例を比較する図"><figcaption>同じ値の集まりでも、順序・変更可能性・重複・キー検索の要件で構造が変わる。</figcaption></figure>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>構造</th><th>順序</th><th>変更</th><th>重複</th><th>主な用途</th></tr></thead><tbody><tr><td>{{list}}</td><td>あり</td><td>可能</td><td>可能</td><td>順番に並ぶ要素を追加・更新</td></tr><tr><td>{{tuple}}</td><td>あり</td><td>不可</td><td>可能</td><td>固定した組、座標、戻り値</td></tr><tr><td>{{set}}</td><td>順序を前提にしない</td><td>要素の追加・削除</td><td>不可</td><td>重複除去、集合演算</td></tr><tr><td>{{dict}}</td><td>挿入順を保持</td><td>可能</td><td>キーは一意</td><td>キーから値を検索</td></tr></tbody></table></div>
          <pre class="code-block">scores = [72, 85, 91, 85]\nscores.append(88)\naverage = sum(scores) / len(scores)\n\nstudent = {"name": "Mai", "score": 91}\nprint(student["score"])</pre>
          <p>リストの最初の要素の添字は{{0}}です。範囲外の添字、存在しない辞書キー、空リストの最大値など、境界条件を考えます。</p>`
      },
      {
        id: "programming-functions",
        short: "関数",
        kicker: "FUNCTION · SCOPE",
        title: "処理へ名前をつけ、入力と出力を明確にする",
        lead: "関数は重複を減らし、テストできる小さな単位をつくります。",
        html: `
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/functions-recursion.png" alt="関数の引数、ローカル変数、戻り値と、再帰呼出しのスタックを示す図"><figcaption>通常の関数と再帰関数の共通点は、呼出しごとに引数とローカル変数をもつこと。</figcaption></figure>
          <pre class="code-block"><span class="keyword">def</span> rectangle_area(width, height):\n    area = width * height\n    <span class="keyword">return</span> area\n\nresult = rectangle_area(4, 3)\nprint(result)</pre>
          <p>関数定義のwidth・heightを{{仮引数}}、呼出し時の4・3を{{実引数}}といいます。returnは呼出し元へ値を返し、その時点で関数の実行を終了します。</p>
          <p>関数内で作った変数は原則として{{ローカル変数}}で、その関数の外から直接使えません。必要な値は引数で受け取り、戻り値で返すと依存関係が明確になります。</p>
          <div class="key-point"><strong>一つの関数に一つの役割</strong><p>入力、計算、表示を分けると、計算部分だけを自動テストしやすくなります。</p></div>`
      },
      {
        id: "programming-recursion",
        short: "再帰",
        kicker: "RECURSION",
        title: "大きな問題を、同じ形の小さな問題へ変える",
        lead: "再帰関数には必ず基底条件と、基底条件へ近づく変化が必要です。",
        html: `
          <pre class="code-block"><span class="keyword">def</span> factorial(n):\n    <span class="keyword">if</span> n == 0:          <span class="comment"># 基底条件</span>\n        <span class="keyword">return</span> 1\n    <span class="keyword">return</span> n * factorial(n - 1)\n\nprint(factorial(4))  <span class="comment"># 24</span></pre>
          <div class="formula">factorial(4) → 4×factorial(3) → 4×3×factorial(2) → 4×3×2×factorial(1) → 4×3×2×1</div>
          <p>{{基底条件}}は再帰を止める条件です。上の例ではn＝0で1を返します。再帰部分ではn−1を渡すため、呼出しごとに基底条件へ近づきます。</p>
          <div class="warning"><strong>呼出しスタック</strong><p>再帰呼出しごとの状態はスタックへ積まれます。深すぎる再帰はメモリを消費し、Pythonでは再帰回数の上限にも達します。単純な繰返しならループの方が適する場合があります。</p></div>`
      },
      {
        id: "programming-flowchart",
        short: "フローチャート",
        kicker: "FLOWCHART",
        title: "記号と矢印で、処理の分岐と反復を可視化する",
        lead: "記号の形を正しく使い、矢印を上から下・左から右へ読みやすく配置します。",
        html: `
          <p>{{フローチャート}}は、アルゴリズムの処理順序を決められた記号と流れ線で表します。コードの一行を一箱に写すのではなく、入力、計算・代入、条件判断、出力という役割で記号を選びます。原則として上から下、左から右へ読み、戻る流れや長い迂回線だけを必要な範囲で使います。</p>
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/flowchart.png" alt="端子、処理、入出力、判断の教科書型記号と、年齢を未成年・成人・高齢者へ分類して全経路が終了へ合流するフローチャート"><figcaption>判断記号から出る線には「はい／いいえ」を付け、三つの出力を合流させてから終了端子へ入る。</figcaption></figure>
          <div class="table-wrap"><table class="lecture-table"><thead><tr><th>記号</th><th>形</th><th>意味</th></tr></thead><tbody><tr><td>端子</td><td>角丸長方形</td><td>開始・終了</td></tr><tr><td>処理</td><td>長方形</td><td>計算、代入、手続き</td></tr><tr><td>入出力</td><td>平行四辺形</td><td>入力、表示、読込み、書出し</td></tr><tr><td>判断</td><td>ひし形</td><td>条件による分岐</td></tr><tr><td>流れ線</td><td>矢印</td><td>実行順序</td></tr></tbody></table></div>
          <h3>図の例をコードへ対応させる</h3>
          <pre class="code-block">age = int(input("年齢: "))\n\n<span class="keyword">if</span> age &lt; 18:\n    print("未成年")\n<span class="keyword">elif</span> age &lt; 65:\n    print("成人")\n<span class="keyword">else</span>:\n    print("高齢者")</pre>
          <p>開始後に年齢を入力し、最初の判断で18未満かを調べます。「はい」なら未成年を表示し、「いいえ」なら次の判断へ進みます。二つ目で65未満なら成人、それ以外なら高齢者を表示します。どの経路も下で合流し、終了へ到達します。</p>
          <div class="key-point"><strong>描き終えたら流れを手でたどる</strong><p>入力17、18、64、65を一つずつ入れ、開始から終了まで矢印を指で追います。判断の出口ラベル、条件の境界、合流、終了への到達を確認します。</p></div>
          <p>矢印が交差して関係が分かりにくい場合は、接続子を使う、処理を別のサブルーチンへ分ける、擬似コードや構造化チャートを併用するなど、目的に合う表現へ切り替えます。</p>`
      },
      {
        id: "programming-sort-search",
        short: "整列と探索",
        kicker: "SORT · SEARCH · COMPLEXITY",
        title: "比較と交換の手順、計算量の増え方を比べる",
        lead: "同じ結果を得るアルゴリズムでも、データ量が増えたときの処理回数は異なります。",
        html: `
          <figure class="raster-figure"><img src="../assets/lecture-v2/programming/sorting-searching.png" alt="バブルソート、クイックソート、線形探索、二分探索の手順と計算量を比較する図"><figcaption>二分探索は整列済みデータが前提。クイックソートは基準値で小問題へ分割する。</figcaption></figure>
          <div class="compare-grid"><article class="concept-card warm"><h3>バブルソート</h3><p>隣り合う要素を比較し、順序が逆なら交換します。平均・最悪計算量はO(n²)です。</p></article><article class="concept-card"><h3>クイックソート</h3><p>基準値より小さい側と大きい側へ分け、各部分を同様に整列します。平均O(n log n)、最悪O(n²)です。</p></article><article class="concept-card green"><h3>線形探索</h3><p>先頭から順に比較します。未整列でも使え、計算量はO(n)です。</p></article><article class="concept-card violet"><h3>二分探索</h3><p>整列済みデータの中央と比較し、探索範囲を半分にします。計算量はO(log n)です。</p></article></div>
          <p>{{計算量}}は、入力サイズnが増えたとき処理回数やメモリ使用量がどのように増えるかを表します。定数倍や低次の項を除き、増え方の程度を比較します。</p>`
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
          <div class="practice"><strong>練習1：偶数判定</strong><p>整数nについて、n % 2 == 0なら偶数。0、正の数、負の数で試します。</p></div>
          <div class="practice"><strong>練習2：うるう年</strong><p>400の倍数、100の倍数、4の倍数の順で条件を整理します。1900年は平年、2000年はうるう年、2024年はうるう年です。</p></div>
          <div class="practice"><strong>練習3：素数判定</strong><p>2以上のnについて、2から√nまでの整数で割り切れるか調べます。1は素数ではありません。</p></div>
          <p>デバッグでは、入力・途中の変数・条件式・出力を小さく確認します。原因を推測して一度に多く直すのではなく、{{再現条件}}を固定し、一つずつ検証します。</p>`
      }
    ]
  };
})();
