(function () {
  "use strict";

  const page = window.LECTURE_CONTENT && window.LECTURE_CONTENT.programming;
  if (!page) return;

  const details = (title, body) => `
    <details class="deep-dive">
      <summary><span class="deep-dive-label">さらに詳しく：</span>${title}</summary>
      <div class="deep-dive-body">${body}</div>
    </details>`;

  const append = (id, html) => {
    const section = page.sections.find((item) => item.id === id);
    if (!section) throw new Error(`Unknown programming section: ${id}`);
    section.html += html;
  };

  append("programming-algorithm", `
    <h3>手順は、大きなまとまりから少しずつ細かくする</h3>
    <p>最初から一行ずつコードを書かず、「入力する」「計算する」「表示する」のような大きな仕事へ分けます。次に「何を入力するか」「どの式で計算するか」と具体化すると、抜けや重複を見つけやすくなります。</p>
    ${details("自然言語・フローチャート・擬似コードの使い分け", `<p>自然言語は書き始めやすい一方、「十分大きくなるまで」のような曖昧さが残ることがあります。フローチャートは分岐や反復の流れを図で確かめるのに向き、擬似コードは処理の順序を短く書くのに向きます。</p><pre class="code-block">合計を0にする
得点を先頭から順に取り出しながら繰り返す
    合計に得点を加える
合計を人数で割り、平均を表示する</pre><p>どの表現でも、入力、処理、出力、終了条件が読み取れることが大切です。</p>`)}
  `);

  append("programming-values", `
    <h3>入力は文字列なので、計算前に型をそろえる</h3>
    <p><code>input()</code>で受け取る値は文字列です。整数として計算するなら<code>int()</code>、小数を含む数なら<code>float()</code>で変換します。<code>"2" + "3"</code>は文字列の連結で<code>"23"</code>になりますが、<code>2 + 3</code>は数の加算で5になります。</p>
    ${details("トレース表で、代入後の値を一行ずつ追う", `<p>プログラムを読むときは、実行した行と、変化した変数の値を表へ書きます。<code>x = x + 1</code>では、まず右辺の古いxへ1を加え、その結果を左辺のxへ入れ直します。</p><div class="table-wrap"><table class="lecture-table"><thead><tr><th>実行した文</th><th>x</th><th>y</th></tr></thead><tbody><tr><td><code>x = 2</code></td><td>2</td><td>—</td></tr><tr><td><code>y = x + 3</code></td><td>2</td><td>5</td></tr><tr><td><code>x = y * 2</code></td><td>10</td><td>5</td></tr></tbody></table></div>`)}
  `);

  append("programming-branch", `
    <h3>複数の条件は、日常語へ言い換えて確かめる</h3>
    <p><code>and</code>は「かつ」、<code>or</code>は「または」、<code>not</code>は「〜ではない」と読みます。例えば<code>age &gt;= 18 and has_ticket</code>は「年齢が18歳以上、かつ、チケットを持っている」です。</p>
    ${details("条件の重なりと抜けを数直線で確かめる", `<p>点数の区分なら、59と60、79と80のような境界の両側を数直線へ書きます。<code>score &gt; 60</code>では60が含まれず、<code>score &gt;= 60</code>では60を含みます。</p><p>条件を上から評価する分岐では、前の条件に当てはまった値は後ろへ進みません。具体的な境界値を一つずつ代入して確かめます。</p>`)}
  `);

  append("programming-for", `
    ${details("二重の反復は、外側1回分から追う", `<p>反復の中に反復があるときは、外側の変数を一つに固定し、内側が最初から最後まで動く様子を先に追います。その後、外側が次の値へ進むと考えます。</p><p>例えば3行×4列の表を処理すると、外側の行を3回、各行で内側の列を4回処理するので、セルの処理は3×4＝12回です。</p>`)}
  `);

  append("programming-while", `
    <h3>whileでは、初期値・条件・更新を一組で探す</h3>
    <p>何回繰り返すかを決めるのは条件ですが、条件に使う変数の初期値と更新方法も必要です。三つのうち一つでも欠けると、一度も実行されない、または終わらない反復になります。</p>
    ${details("0が入力されるまで合計する", `<pre class="code-block">total = 0
number = int(input("整数（0で終了）: "))

<span class="keyword">while</span> number != 0:
    total = total + number
    number = int(input("整数（0で終了）: "))

print(total)</pre><p>0は「ここで終了」と知らせる特別な入力です。最初の入力を反復前で受け取り、反復の最後に次の入力へ更新します。0自体は合計へ加えません。</p>`)}
  `);

  append("programming-data-structures", `
    <h3>配列は、同じ種類の値を順番に扱うために使う</h3>
    <p>得点や気温のように同じ意味の値が複数あるとき、配列へまとめると反復で順番に処理できます。Pythonではリストを使い、<code>scores[0]</code>が最初、<code>scores[1]</code>が2番目の要素です。</p>
    ${details("二次元配列は、行と列の意味を先に決める", `<p>表のようなデータは、配列の中へ配列を入れて表せます。<code>Data[2][4]</code>を読む前に、最初の添字が行、次の添字が列なのかを確認します。</p><pre class="code-block">Data = [[72, 80, 91],
        [65, 88, 76]]

print(Data[1][2])  <span class="comment"># 2行3列目の76</span></pre><p>添字は0から始まるため、添字1は2行目、添字2は3列目です。</p>`)}
  `);

  append("programming-functions", `
    ${details("同じ計算を関数へまとめる", `<p>同じ式を何度も書くと、一か所だけ直し忘れることがあります。関数へまとめれば、呼出しごとに違う値を引数で渡し、同じ手順で結果を返せます。</p><pre class="code-block"><span class="keyword">def</span> tax_included(price, rate):
    <span class="keyword">return</span> price * (1 + rate)

print(tax_included(1000, 0.1))  <span class="comment"># 1100.0</span></pre><p>この関数は表示まで行わず、計算結果を返します。表示方法を呼出し側で決められるため、計算だけを確かめやすくなります。</p>`)}
  `);

  append("programming-sort-search", `
    <h3>速さの違いは、候補がどう減るかで考える</h3>
    <p>線形探索は先頭から一つずつ調べるので、目的の値が最後にあるとほぼ全部を見ます。二分探索は、整列済みのデータの中央と比べ、調べる範囲を毎回ほぼ半分にします。データが整列済みかどうかが使い分けの条件です。</p>
    ${details("小さなデータで整列の一巡を追う", `<p>バブルソートでは隣り合う二つを比べ、順序が逆なら交換します。例えば<code>[4, 2, 3]</code>を小さい順にすると、4と2を交換して<code>[2, 4, 3]</code>、次に4と3を交換して<code>[2, 3, 4]</code>です。</p><p>一巡で最大の値が右端へ移ります。残りの範囲について同じ比較を繰り返します。</p>`)}
  `);

  append("programming-test", `
    <h3>期待する答えを先に決めてから実行する</h3>
    <p>「とりあえず動かして画面を見る」だけでは正誤を判断できません。入力と期待する出力を先に書き、実際の出力と比べます。間違ったときは、入力直後、分岐の直前、反復の1回ごとなど、途中の変数を表示して原因の場所を絞ります。</p>
    ${details("乱数を使うシミュレーション", `<p>現実の出来事を、変数と規則で表して何度も試すことをシミュレーションといいます。サイコロなら1〜6の整数を乱数で作り、試行回数を増やして各目の割合を調べます。</p><p>少ない試行では偶然の偏りが大きいため、100回、1,000回、10,000回と増やして結果の安定を比べます。ただし、試行回数を増やしても、作ったモデルの規則が現実と合っていなければ正しい予測にはなりません。</p>`)}
  `);
})();
