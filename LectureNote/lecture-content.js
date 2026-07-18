(function () {
  "use strict";

  window.LECTURE_CONTENT = {
    society: {
      kicker: "FIELD 01 / INFORMATION SOCIETY",
      title: "情報を読み、守り、責任をもって使う",
      lead: "データが知識へ変わる過程から、個人情報・プライバシー・知的財産権まで。情報社会で判断するための基準を、具体例とともに学びます。",
      meta: ["情報モラル", "問題解決", "個人情報", "知的財産権", "情報セキュリティ"],
      sections: [
        {
          id: "society-data",
          short: "データから知恵へ",
          kicker: "DATA · INFORMATION · KNOWLEDGE",
          title: "データは、目的を与えると情報になる",
          lead: "同じ数値でも、並べ方・比較対象・目的によって意味は変わります。",
          html: `
            <p>{{データ}}は、事実や事柄を数値・文字・記号などで表現したものです。データを目的に沿って整理・解釈すると{{情報}}になり、情報を分析して問題解決に使える形にすると{{知識}}になります。さらに、知識を深く洞察し長期的な判断へ結びつけたものが{{知恵}}です。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/society/literacy-cycle.png" alt="収集、評価、整理、活用の4段階と、データから知恵へ進む関係を示した図"><figcaption>情報リテラシーは、情報を見つける力だけでなく、根拠を確かめて活用する力まで含む。</figcaption></figure>
            <div class="concept-grid">
              <article class="concept-card"><h3>例：気温</h3><p>「28.4」という測定値だけならデータです。日時・場所・過去平均との差を添えると、暑さを判断できる情報になります。</p></article>
              <article class="concept-card green"><h3>例：降水量</h3><p>過去の推移、作物の状態、今後の予報を関連づけると、農作業の判断に使える知識になります。</p></article>
            </div>
            <div class="key-point"><strong>情報を評価する5つの問い</strong><p>だれが発信したか／いつ更新されたか／根拠は何か／事実と意見が分かれているか／別の資料でも確かめられるか。</p></div>
            <div class="mini-quiz"><b>確認：</b>「全国平均と比べて3.2℃高い」という表現は、測定値だけより意味を読み取りやすい。これはデータを{{比較・解釈}}して情報にした例です。</div>`
        },
        {
          id: "society-media",
          short: "情報の性質とメディア",
          kicker: "PROPERTIES · MEDIA",
          title: "情報の性質に合わせて、伝える手段を選ぶ",
          lead: "情報は物とは異なり、残り、複製され、瞬時に広がります。",
          html: `
            <p>情報には、手元に残る{{残存性}}、同じ内容を容易にコピーできる{{複製性}}、遠くへすばやく運べる{{伝播性}}があります。便利さの源である一方、誤情報・個人情報・著作物も同じ性質で広がる点に注意が必要です。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/society/information-properties.png" alt="情報の残存性、複製性、伝播性と、表現・伝達・記録のメディアを対応させた図"><figcaption>情報の性質と利用目的の両方からメディアを選ぶ。</figcaption></figure>
            <div class="three-grid">
              <article class="concept-card"><h3>表現</h3><p>文字、画像、音声、動画。正確さ、分かりやすさ、臨場感を考えて選びます。</p></article>
              <article class="concept-card green"><h3>伝達</h3><p>新聞、テレビ、電話、手紙、SNS。範囲、速さ、双方向性が異なります。</p></article>
              <article class="concept-card warm"><h3>記録</h3><p>紙、手帳、USBメモリ、クラウド。保存期間、容量、検索性、耐久性が異なります。</p></article>
            </div>
            <p>空気・光・電波など、情報を物理的に運ぶものも{{伝送メディア}}です。目的と受け手を先に決め、その条件に合う表現・伝達・記録の方法を選びます。</p>`
        },
        {
          id: "society-personal-data",
          short: "個人情報",
          kicker: "PERSONAL DATA",
          title: "個人情報は、識別できるかどうかで見分ける",
          lead: "氏名だけでなく、組み合わせによって個人を識別できる情報も対象です。",
          html: `
            <p>{{個人情報保護法}}は、個人情報の有用性に配慮しつつ、個人の権利利益を保護する法律です。生存する個人に関する情報で、単独または他の情報との組合せによって特定の個人を識別できるものを個人情報といいます。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/society/personal-data-map.png" alt="個人情報、要配慮個人情報、匿名加工情報、仮名加工情報の違いを示す図"><figcaption>加工後に個人を識別できるか、第三者提供できるかが区別の要点。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>区分</th><th>意味</th><th>例・注意</th></tr></thead><tbody>
              <tr><td>{{要配慮個人情報}}</td><td>差別や偏見などの不利益につながり得る、特に慎重な取扱いが必要な情報</td><td>人種、信条、病歴、犯罪歴、犯罪被害の事実など</td></tr>
              <tr><td>{{匿名加工情報}}</td><td>特定の個人を識別できず、元の個人情報へ復元できないよう加工した情報</td><td>一定の要件の下で第三者提供が可能</td></tr>
              <tr><td>{{仮名加工情報}}</td><td>他の情報と照合しない限り、特定の個人を識別できないよう加工した情報</td><td>利用範囲と第三者提供に制限がある</td></tr>
            </tbody></table></div>
            <div class="warning"><strong>画像・音声も個人情報になり得る</strong><p>顔写真、声、行動履歴、位置情報、所属や活動の記録も、本人を識別できれば個人情報です。</p></div>
            <p>サービスや広告配信などの同意設計で、事前に本人の同意を得てから利用を始める方式を一般に{{オプトイン}}、本人が拒否の意思を示すことで利用を止められる方式を一般に{{オプトアウト}}といいます。個人データの第三者提供に関する法的な「オプトアウト」は、届出・公表など別途の要件を伴うため、単に拒否ボタンがあればよいわけではありません。</p>`
        },
        {
          id: "society-privacy",
          short: "プライバシーと公開",
          kicker: "PRIVACY · DISCLOSURE",
          title: "公開する権利と、公開しない情報を区別する",
          lead: "情報の公開は透明性を高めますが、保護すべき情報まで公開してよいわけではありません。",
          html: `
            <p>伝統的なプライバシーは「ひとりにしておいてもらう権利」と表現されました。情報社会では、自己に関する情報がだれに、何の目的で、どのように利用されるかを{{コントロールする権利}}として捉える考え方が有力です。ただし、プライバシー権や自己情報コントロール権を一括して定めた単独の法律があるわけではなく、憲法13条を基礎とする判例・学説や個別法によって保護されています。ネット上の情報については{{忘れられる権利}}も議論されています。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/society/privacy-rights.png" alt="プライバシー権、パブリシティ権、肖像権、情報公開の関係を示す図"><figcaption>公開・利用・削除の判断では、本人の権利と公共性を同時に考える。</figcaption></figure>
            <div class="compare-grid">
              <article class="concept-card"><h3>パブリシティ権</h3><p>著名人などの氏名や肖像がもつ顧客吸引力を、排他的に利用できる権利として判例上認められています。</p></article>
              <article class="concept-card violet"><h3>肖像権</h3><p>承諾なくみだりに容貌などを撮影・公表されない人格的利益として、判例上保護されています。商業的な顧客吸引力の保護はパブリシティ権と区別します。</p></article>
            </div>
            <p>{{情報公開法}}は、国の行政機関が保有する行政文書の開示を請求できる仕組みです。独立行政法人等には別の情報公開法があり、地方公共団体にも条例などに基づく制度があります。ただし、個人情報、法人情報、国家安全、公共の安全などは不開示となる場合があります。</p>
            <div class="key-point"><strong>OECDプライバシー8原則</strong><p>収集制限、データ内容、目的明確化、利用制限、安全保護、公開、個人参加、責任。個人情報を扱う一連の流れを、収集から説明責任まで通して管理します。</p></div>
            <p>マイナンバーは個人に割り当てられる{{12桁}}の番号です。税・社会保障・災害対策など、法律で定められた範囲で利用されます。</p>`
        },
        {
          id: "society-industrial-property",
          short: "産業財産権",
          kicker: "INDUSTRIAL PROPERTY",
          title: "技術・形・デザイン・ブランドを、登録によって守る",
          lead: "産業財産権は特許庁への出願と登録によって権利が発生します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/society/intellectual-property.png" alt="知的財産権から産業財産権、著作権、その他の知的財産へ分かれる階層図"><figcaption>知的財産権の直下にある3分類と、著作者・伝達者の権利を含む広義の著作権の内部構造を、接続線と段の深さで読む。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>権利</th><th>守るもの</th><th>主な条件</th><th>存続期間</th></tr></thead><tbody>
              <tr><td>{{特許権}}</td><td>高度な技術的思想である発明</td><td>新規性・進歩性・産業上の利用可能性</td><td>出願日から原則20年</td></tr>
              <tr><td>{{実用新案権}}</td><td>物品の形状・構造・組合せに関する考案</td><td>物品に関する技術的工夫</td><td>出願日から10年</td></tr>
              <tr><td>{{意匠権}}</td><td>物品・建築物・画像などのデザイン</td><td>新規性・創作非容易性など</td><td>出願日から25年</td></tr>
              <tr><td>{{商標権}}</td><td>商品・サービスを区別する標識</td><td>文字、図形、記号、立体、音、色彩など</td><td>設定登録から10年、更新可能</td></tr>
            </tbody></table></div>
            <p>この4つをまとめて{{産業財産権}}といいます。回路配置利用権、育成者権、営業秘密なども知的財産に関係しますが、根拠となる法律や保護方法は異なります。</p>`
        },
        {
          id: "society-copyright",
          short: "著作権",
          kicker: "COPYRIGHT",
          title: "著作権は、表現された創作物と創作者を守る",
          lead: "アイデアそのものではなく、創作的に表現された著作物が保護されます。",
          html: `
            <p>著作物とは、思想または感情を{{創作的に表現}}したもので、文芸・学術・美術・音楽の範囲に属するものです。保護されるのは表現であり、単なるアイデア、事実、ありふれた題名、短すぎて創作性を認めにくい表現などは、原則としてそれだけでは著作物になりません。小説・楽曲・絵画だけでなく、写真、映画、地図、設計図、プログラムも著作物になり得ます。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/society/copyright-map.png" alt="著作権の財産権10分類、著作者人格権3分類、著作隣接権をもつ伝達者を整理した図"><figcaption>「だれの権利か」「財産を守る権利か、人格を守る権利か」「どの利用行為を対象とするか」の順に読む。</figcaption></figure>
            <h3>著作権（財産権）は、利用方法ごとに分かれる</h3>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>権利</th><th>対象となる利用</th><th>高校生活での例</th></tr></thead><tbody>
              <tr><td>{{複製権}}</td><td>印刷、録音、録画、ダウンロード、サーバへの保存など、著作物を再製する</td><td>市販問題集をクラス全員分コピーする</td></tr>
              <tr><td>{{上演権・演奏権}}</td><td>脚本を上演する、楽曲を演奏する</td><td>文化祭で演劇や楽曲を公衆に披露する</td></tr>
              <tr><td>{{上映権}}</td><td>映画・写真・資料などをスクリーンに映す</td><td>購入した映画を不特定多数へ上映する</td></tr>
              <tr><td>{{公衆送信権・公の伝達権}}</td><td>Web掲載、動画配信、放送などで公衆へ送信し、受信装置で公に伝達する</td><td>他人のイラストを学校サイトへ掲載する</td></tr>
              <tr><td>{{口述権・展示権}}</td><td>言語の著作物を読み上げる、美術・未発行写真を原作品で展示する</td><td>朗読会や校内展示で利用する</td></tr>
              <tr><td>{{頒布権}}</td><td>映画の著作物の複製物を譲渡・貸与する</td><td>映画データを収録した媒体を配る</td></tr>
              <tr><td>{{譲渡権・貸与権}}</td><td>著作物の複製物を公衆へ譲渡・貸与する</td><td>複製した教材を多数へ配る・貸す</td></tr>
              <tr><td>{{翻訳権・翻案権等}}</td><td>翻訳、編曲、変形、脚色、映画化など二次的著作物を創作する</td><td>小説を台本化する、楽曲を編曲する</td></tr>
              <tr><td>{{二次的著作物の利用に関する原著作者の権利}}</td><td>翻訳・編曲などで作られた二次的著作物の利用に、原著作者も関与する</td><td>翻案した台本を上演・配信する</td></tr>
            </tbody></table></div>
            <h3>著作者人格権は、著作者その人を守る</h3>
            <div class="three-grid"><article class="concept-card"><h4>{{公表権}}</h4><p>未公表の著作物を公表するか、いつ・どのような方法で公表するかを決めます。</p></article><article class="concept-card"><h4>{{氏名表示権}}</h4><p>実名・変名を表示するか、氏名を表示しないかを決めます。</p></article><article class="concept-card"><h4>{{同一性保持権}}</h4><p>著作者の意に反して内容や題号を変更・切除されない利益を守ります。</p></article></div>
            <p>日本では、著作権は著作物を創作した時点で自動的に発生する{{無方式主義}}です。登録しなければ権利が発生しない産業財産権とは異なります。著作権（財産権）は譲渡・相続できますが、著作者人格権は著作者だけに属する{{一身専属}}の権利で、譲渡できません。保護期間は著作物の種類などによる例外がありますが、自然人の著作物では原則として著作者の{{死後70年}}までです。</p>
            <div class="warning"><strong>編集著作物とデータベースの著作物</strong><p>素材の選択・配列、または情報の選択・体系的構成に創作性がある場合、その構成自体が保護されます。個々の事実や数値そのものに著作権が発生するわけではありません。</p></div>`
        },
        {
          id: "society-neighbouring-rights",
          short: "伝達者の権利と例外",
          kicker: "NEIGHBOURING RIGHTS · EXCEPTIONS",
          title: "伝える人の権利と、許諾なしで使える範囲を区別する",
          lead: "著作物を公衆へ伝える実演家・レコード製作者・放送事業者などにも権利があります。",
          html: `
            <p>著作者が作品を創作するのに対し、実演家は歌唱・演奏・演技によって作品を表現し、レコード製作者や放送事業者はそれを記録・公衆へ伝えます。こうした伝達者の財産的な権利が{{著作隣接権}}です。主体は{{実演家}}、{{レコード製作者}}、{{放送事業者}}、{{有線放送事業者}}で、認められる権利の内容と期間は主体ごとに異なります。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>主体</th><th>役割の例</th><th>人格的な権利</th></tr></thead><tbody><tr><td>実演家</td><td>歌手、演奏者、俳優、指揮者など</td><td>氏名表示・同一性保持に関する{{実演家人格権}}がある</td></tr><tr><td>レコード製作者</td><td>音を最初に固定し、音源を制作する</td><td>人格権はなく、財産的な権利をもつ</td></tr><tr><td>放送事業者</td><td>無線放送で番組を公衆へ送信する</td><td>人格権はなく、財産的な権利をもつ</td></tr><tr><td>有線放送事業者</td><td>有線放送で番組を公衆へ送信する</td><td>人格権はなく、財産的な権利をもつ</td></tr></tbody></table></div>
            <h3>著作権の制限</h3>
            <p>著作権には、社会的な利用とのバランスを取るための例外があります。ただし「学校だから」「非営利だから」自動的に自由になるわけではなく、目的・方法・範囲などの条件確認が必要です。</p>
            <div class="concept-grid">
              <article class="concept-card"><h4>私的使用のための複製</h4><p>個人的・家庭内など限られた範囲で、使用する本人が行う複製です。違法にアップロードされた著作物と知りながら行うダウンロードなどは、一定の要件の下で私的使用でも違法となります。</p></article>
              <article class="concept-card"><h4>{{引用}}</h4><p>公表済み、必然性、主従関係、明瞭な区別、出所明示などの条件を満たして利用します。</p></article>
              <article class="concept-card"><h4>教育機関での複製等</h4><p>授業の過程で必要な範囲に限られ、著作権者の利益を不当に害してはいけません。</p></article>
              <article class="concept-card"><h4>試験問題・時事報道</h4><p>目的に必要な範囲で認められる規定があります。利用条件は規定ごとに異なります。</p></article>
            </div>
            <p>{{CCライセンス}}は、著作者が「表示」「非営利」「改変禁止」「継承」などの条件を組み合わせて利用許諾を示す仕組みです。権利を放棄する表示ではありません。</p>`
        },
        {
          id: "society-judgement",
          short: "情報社会の判断",
          kicker: "DECISION MAKING",
          title: "合法かだけでなく、相手と社会への影響まで考える",
          lead: "情報社会の問題は、技術・法律・倫理・安全を重ねて判断します。",
          html: `
            <div class="step-flow" style="--steps:4">
              <article class="step-item"><b>1 事実を確認</b><p>出典、日時、当事者、利用条件を確認する。</p></article>
              <article class="step-item"><b>2 権利を確認</b><p>個人情報、プライバシー、著作権を確認する。</p></article>
              <article class="step-item"><b>3 影響を予測</b><p>公開範囲、残存性、複製性、伝播性を考える。</p></article>
              <article class="step-item"><b>4 行動を選ぶ</b><p>必要なら同意・許諾を得て、範囲を最小化する。</p></article>
            </div>
            <div class="practice"><strong>事例</strong><p>文化祭で撮影した動画を学校公式SNSへ掲載したい。被写体の同意、背景に映った個人情報、使用した音楽の権利、公開範囲と削除方法を確認してから公開します。</p></div>
            <p>情報モラルは、単に禁止事項を覚えることではありません。情報技術の特徴を理解し、他者の{{権利}}と自分の{{責任}}を踏まえて、よりよい行動を選ぶ力です。</p>`
        }
      ]
    },
    digital: {
      kicker: "FIELD 02 / DIGITAL REPRESENTATION",
      title: "0と1で、数・文字・音・画像を表す",
      lead: "連続量をデジタル化する仕組みから、2進数、論理回路、コンピュータの構成と誤差まで。表現の規則を順にたどります。",
      meta: ["2進数", "論理演算", "デジタル化", "情報量", "コンピュータの構成"],
      sections: [
        {
          id: "digital-analog",
          short: "アナログとデジタル",
          kicker: "ANALOG · DIGITAL",
          title: "連続する量を、区切られた値で表す",
          lead: "アナログは連続量、デジタルは離散的な記号や数値で表現します。",
          html: `
            <p>角度・速度・電圧のように途中の値が連続して存在する量を{{アナログ}}、0と1など区切られた記号や数値で表す方法を{{デジタル}}といいます。現実の音や光は連続量ですが、コンピュータでは一定の規則で数値へ変換して扱います。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/analog-digital.png" alt="滑らかなアナログ波形と、標本化して得たデジタル値を対比したグラフ"><figcaption>アナログ波形は滑らかな連続曲線。デジタル化では時刻と値を区切って数値化する。</figcaption></figure>
            <div class="compare-grid">
              <article class="concept-card warm"><h3>アナログ</h3><p>連続的な変化を連続した信号として表しますが、複製や伝送を重ねると雑音やひずみの影響が蓄積しやすい性質があります。</p></article>
              <article class="concept-card"><h3>デジタル</h3><p>離散値なので複製・処理・保存に向き、一定範囲の雑音なら元の記号を判定して復元できます。</p></article>
            </div>
            <p>デジタル化した情報の品質は、どれだけ細かく時間を区切るか、値を何段階で表すかによって変わります。</p>`
        },
        {
          id: "digital-bases-bits",
          short: "基数・ビット・バイト",
          kicker: "BASE · BIT · BYTE",
          title: "基数が変わると、使う記号と桁の重みが変わる",
          lead: "10進数・2進数・16進数は、同じ数量を異なる記号体系で表します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/bases-bits.png" alt="10進法、2進法、16進法の桁の重みと、ビット数に対する状態数を示す図"><figcaption>nビットで表せる状態は2ⁿ通り。8ビットを1バイトと呼ぶ。</figcaption></figure>
            <p>{{基数}}は、一つの桁で使う記号の個数です。10進法では0〜9の10個、2進法では0と1の2個、16進法では0〜9とA〜Fの16個を使います。右端の桁を0桁目として、各桁の重みは「基数の0乗、1乗、2乗……」になります。どの表記法でも、記号と桁の重みが違うだけで、表している数量は同じです。</p>
            <div class="formula">2025₁₀ = 2×10³ + 0×10² + 2×10¹ + 5×10⁰</div>
            <div class="formula">1011₂ = 1×2³ + 0×2² + 1×2¹ + 1×2⁰ = 11₁₀</div>
            <p>例えば1011₂では、左から2³、2²、2¹、2⁰の重みをもちます。1が立っている桁だけを足すので、8＋2＋1＝11です。16進法のBは10進数の11を表すため、1011₂＝B₁₆＝11₁₀です。2進数を16進数へ直すときは、右から{{4ビット}}ずつ区切ると変換しやすくなります。</p>
            <p>0または1を表す最小単位を{{ビット（bit）}}、8ビットを{{1バイト（byte）}}といいます。各ビットが2通りの状態を独立に取るため、nビットの組合せは2×2×…×2＝{{2ⁿ通り}}です。符号なし整数なら、nビットで0から2ⁿ−1までを表せます。例えば8ビットなら0〜255です。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>接頭辞</th><th>10進の倍率</th><th>主な読み</th></tr></thead><tbody><tr><td>k</td><td>10³</td><td>キロ</td></tr><tr><td>M</td><td>10⁶</td><td>メガ</td></tr><tr><td>G</td><td>10⁹</td><td>ギガ</td></tr><tr><td>T</td><td>10¹²</td><td>テラ</td></tr></tbody></table></div>`
        },
        {
          id: "digital-conversion",
          short: "基数変換",
          kicker: "BASE CONVERSION",
          title: "10進数と2進数を、桁の重みで往復する",
          lead: "2進数への変換は2で割った余り、10進数への変換は2の累乗を使います。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/binary-conversion.png" alt="10進数11を2で繰り返し割って1011₂へ変換する手順と逆変換"><figcaption>余りは下から上へ読む。逆変換では1の立っている桁の重みを足す。</figcaption></figure>
            <h3>10進数11を2進数へ</h3>
            <ol><li>11÷2＝5 余り1</li><li>5÷2＝2 余り1</li><li>2÷2＝1 余り0</li><li>1÷2＝0 余り1</li></ol>
            <p>余りを下から読むので、11₁₀＝{{1011₂}}です。</p>
            <h3>2進数から16進数へ</h3>
            <p>右から4ビットずつ区切ります。例えば 11010110₂ は 1101 0110₂ なので、D6₁₆です。16進数1桁は{{4ビット}}に対応します。</p>
            <div class="mini-quiz"><b>確認：</b>101101₂＝32＋8＋4＋1＝{{45₁₀}}。</div>`
        },
        {
          id: "digital-signed-float-text",
          short: "負数・小数・文字",
          kicker: "SIGNED · FLOAT · TEXT",
          title: "ビット列の解釈規則が、負数・小数・文字を決める",
          lead: "同じ0と1でも、符号化方式によって意味は異なります。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/signed-float-text.png" alt="2の補数、IEEE 754単精度浮動小数点、ASCII文字コードの構造を示す図"><figcaption>ビット列だけでは意味は決まらない。形式と桁数を合わせて読む。</figcaption></figure>
            <h3>2の補数</h3>
            <p>負数は、正の値の全ビットを反転し1を加える{{2の補数}}で表すことが一般的です。4ビットで+5は0101₂、反転して1010₂、1を加えて1011₂となり、これが-5を表します。</p>
            <h3>浮動小数点数</h3>
            <p>IEEE 754 binary32は、{{符号部1ビット}}・{{指数部8ビット}}・{{仮数部23ビット}}で構成されます。有限のビット数で実数を近似するため、丸め誤差が生じます。</p>
            <h3>文字コード</h3>
            <p>文字とビット列の対応表が文字コードです。ASCIIではKが01001011₂です。日本語を含む文字集合や符号化方式にはJIS、Shift_JIS、UTF-8などがあります。現在のWebでは{{UTF-8}}が広く使われます。</p>`
        },
        {
          id: "digital-logic",
          short: "論理演算",
          kicker: "BOOLEAN LOGIC",
          title: "真理値表で、論理回路の出力を確かめる",
          lead: "AND・OR・NOT・XORは、入力の組合せから出力を決めます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/logic-adder.png" alt="AND、OR、NOT、XORの真理値表と、半加算器・全加算器の関係を示す図"><figcaption>論理ゲートの規則を組み合わせると、2進数の加算回路を構成できる。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>A</th><th>B</th><th>AND A·B</th><th>OR A+B</th><th>XOR A⊕B</th></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr><tr><td>0</td><td>1</td><td>0</td><td>1</td><td>1</td></tr><tr><td>1</td><td>0</td><td>0</td><td>1</td><td>1</td></tr><tr><td>1</td><td>1</td><td>1</td><td>1</td><td>0</td></tr></tbody></table></div>
            <p>{{AND}}は両方が1のときだけ1、{{OR}}はどちらかが1なら1、{{NOT}}は入力を反転、{{XOR}}は入力が異なるとき1です。真理値表は入力の全組合せを漏れなく確認する表です。</p>`
        },
        {
          id: "digital-adders",
          short: "加算回路",
          kicker: "HALF ADDER · FULL ADDER",
          title: "XORで和、ANDで桁上がりをつくる",
          lead: "半加算器を組み合わせると、下位桁からの桁上がりを含む全加算器になります。",
          html: `
            <p>半加算器は2つの1ビット入力A・Bを加え、和Sと桁上がりCを出力します。</p>
            <div class="formula">S = A ⊕ B　　C = A · B</div>
            <p>全加算器はA・Bに加えて下位桁からの桁上がりC<sub>in</sub>を入力し、和Sと次の桁へのC<sub>out</sub>を出力します。</p>
            <div class="formula">S = A ⊕ B ⊕ C<sub>in</sub></div>
            <div class="formula">C<sub>out</sub> = A·B + C<sub>in</sub>·(A ⊕ B)</div>
            <div class="key-point"><strong>回路を読む順番</strong><p>入力→各ゲートの出力→最終出力の順に、途中の値を書きながら確認します。線が交差しても接続点がなければ接続していません。</p></div>`
        },
        {
          id: "digital-sound",
          short: "音のデジタル化",
          kicker: "SAMPLING · QUANTIZATION · ENCODING",
          title: "音は、標本化・量子化・符号化の順で数値になる",
          lead: "時間方向と振幅方向をどれだけ細かく区切るかが、音質とデータ量を決めます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/sound-digitization.png" alt="滑らかな音波を標本化し、量子化して2進数へ符号化する流れ"><figcaption>標本点は等間隔。量子化では各標本値を最も近い段階値へ丸める。</figcaption></figure>
            <div class="step-flow" style="--steps:3"><article class="step-item"><b>1 標本化</b><p>一定時間ごとに振幅を測る。</p></article><article class="step-item"><b>2 量子化</b><p>振幅を有限個の段階へ割り当てる。</p></article><article class="step-item"><b>3 符号化</b><p>段階値を2進数で表す。</p></article></div>
            <p>1秒間の標本数を{{標本化周波数}}（Hz）、1標本を表すビット数を{{量子化ビット数}}といいます。一般に値を大きくすると再現性は高まりますが、データ量も増えます。</p>
            <div class="formula">データ量 [bit] = 標本化周波数 × 量子化ビット数 × 時間 × チャンネル数</div>
            <p>44.1 kHz・16 bit・2 chで60秒なら、44,100×16×60×2＝84,672,000 bitです。</p>`
        },
        {
          id: "digital-image",
          short: "画像のデジタル化",
          kicker: "PIXEL · COLOR · COMPRESSION",
          title: "画像は、画素または図形の情報として表す",
          lead: "画像データの構造と色の表現を別の観点として整理します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/image-digitization.png" alt="画像データの表し方をラスタ形式とベクタ形式に分類し、保存内容や拡大時の違いを比較した図"><figcaption>ラスタ／ベクタは画像データの構造の分類であり、RGBはこの分類と同じ階層ではない。</figcaption></figure>
            <p>{{ラスタ形式}}は画素ごとの色を保存し、写真やスキャン画像に向きます。拡大すると画素の四角が見えます。{{ベクタ形式}}は点・線・曲線・塗りを数式や座標で保存し、拡大しても輪郭が滑らかです。</p>
            <p>ラスタ画像は、画像を画素に区切る{{標本化}}、明るさや色を有限の段階へ割り当てる{{量子化}}、段階値を2進数で表す{{符号化}}の順でデジタル化します。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/color-models.png" alt="RGBの加法混色とCMYKの減法混色を、重なりによって生じる色まで示して比較した図"><figcaption>RGBは光を加えると白へ、CMYは光を吸収するインクを重ねると黒へ近づく。印刷では黒インクKも使う。</figcaption></figure>
            <div class="formula">無圧縮画像のデータ量 [bit] = 横画素数 × 縦画素数 × 1画素のビット数</div>
            <p>ディスプレイは光の三原色{{RGB}}を使う加法混色です。R・G・Bを同じ強さで重ねると白になります。プリンタは色材の三原色{{CMY}}を使う減法混色で、実際には黒の再現とインク量の節約のためKを加えたCMYKを使います。RGB各色8ビットなら1画素は24ビットで、表せる色は2²⁴＝16,777,216色です。</p>
            <p>JPEGは主に写真の{{非可逆圧縮}}、PNGは図や透過画像の{{可逆圧縮}}に使われます。</p>
            <div class="warning"><strong>解像度という語の違い</strong><p>画面では画素数、印刷やスキャンでは1インチ当たりの点や画素数（dpi・ppi）を指すことがあります。何を表す値か確認します。</p></div>`
        },
        {
          id: "digital-computer",
          short: "コンピュータの構成",
          kicker: "CPU · MEMORY · I/O · SOFTWARE",
          title: "五大装置が連携し、命令を順に実行する",
          lead: "入力・記憶・演算・制御・出力の役割を、データと命令の流れで捉えます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/computer-system.png" alt="入力装置、CPU、主記憶装置、補助記憶装置、出力装置とソフトウェア層の関係"><figcaption>CPUは制御装置と演算装置をもち、主記憶との間で命令とデータをやり取りする。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>装置</th><th>役割</th><th>例</th></tr></thead><tbody><tr><td>入力装置</td><td>データや指示を取り込む</td><td>キーボード、マウス、センサ</td></tr><tr><td>記憶装置</td><td>命令とデータを保存する</td><td>メモリ、SSD</td></tr><tr><td>演算装置</td><td>算術演算・論理演算を行う</td><td>CPU内の演算回路</td></tr><tr><td>制御装置</td><td>命令を解読し各装置を制御する</td><td>CPU内の制御回路</td></tr><tr><td>出力装置</td><td>処理結果を外へ示す</td><td>ディスプレイ、プリンタ</td></tr></tbody></table></div>
            <p>{{OS}}はハードウェア資源を管理し、アプリケーションへ共通機能を提供する基本ソフトウェアです。デバイスドライバは機器固有の操作をOSにつなぎ、ファームウェアは機器の基本制御や起動を担います。</p>`
        },
        {
          id: "digital-performance",
          short: "性能と誤差",
          kicker: "PERFORMANCE · ERROR",
          title: "速さの指標と、有限桁で起こる誤差を区別する",
          lead: "クロック周波数だけで性能は決まらず、ビット数の限界は誤差やあふれを生みます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/performance-errors.png" alt="桁あふれ、丸め、打切り、桁落ち、情報落ちの各誤差を発生条件と数値例で比較した表"><figcaption>誤差名だけでなく、どの計算で何が失われるかを具体例と対応させる。</figcaption></figure>
            <p>{{クロック周波数}}はCPU内部の動作タイミングを1秒当たりの回数で表します。ただし、命令当たりの処理量、コア数、キャッシュ、メモリ、ソフトウェアなども性能に影響するため、周波数だけで単純比較できません。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>誤差</th><th>発生する状況</th><th>具体例</th></tr></thead><tbody><tr><td>{{桁あふれ}}</td><td>固定ビット数で表せる範囲を超える</td><td>16ビット符号なし整数で60,000＋10,000を計算すると上限65,535を超える</td></tr><tr><td>{{丸め誤差}}</td><td>有限桁へ丸める</td><td>π＝3.141592…を3.1416として計算する</td></tr><tr><td>{{打切り誤差}}</td><td>無限に続く計算を途中で止める</td><td>1＋1/2＋1/4＋…を有限項までで打ち切る</td></tr><tr><td>{{桁落ち}}</td><td>ほぼ等しい値の差で有効桁が減る</td><td>1.0001−1.0000のような近い数の差で上位桁が消える</td></tr><tr><td>{{情報落ち}}</td><td>絶対値が大きく異なる値の計算で小さい値が反映されない</td><td>非常に大きな値へ小さな値を足しても、有限桁では変化が残らない</td></tr></tbody></table></div>
            <p>2進浮動小数点では0.1を有限桁で正確に表せないため、Pythonの <code>0.1 + 0.2</code> が <code>0.30000000000000004</code> となる例があります。金額のように10進での正確さが必要な場合は整数の最小単位で保持する、10進型を使う、比較時に小さな許容誤差を設けるなど、目的に合う方法を選びます。</p>`
        }
      ]
    },
    network: {
      kicker: "FIELD 03 / NETWORK & SECURITY",
      title: "通信の層をたどり、安全に情報を届ける",
      lead: "LANからインターネット、TCP/IP、IPアドレス、DNS、データベース、暗号とセキュリティまで。データが届く順序を追って学びます。",
      meta: ["TCP/IP", "IPアドレス", "DNS", "データベース", "暗号と認証"],
      sections: [
        {
          id: "network-scope",
          short: "LAN・WAN・インターネット",
          kicker: "LAN · WAN · ISP",
          title: "小さなネットワークを接続し、世界へ広げる",
          lead: "LAN、WAN、ISP、インターネットは、範囲と管理主体が異なります。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/network-types.png" alt="LAN内部の機器接続、LAN同士を結ぶWAN、LANからISPを経てインターネットへ接続する関係を分けて示した図"><figcaption>LAN内部、拠点間WAN、ISP経由のインターネット接続を別の関係として読む。</figcaption></figure>
            <p>家庭・学校・建物内など、限られた範囲で一つの組織や利用者が管理するネットワークを{{LAN}}といいます。学校LANなら、PC、プリンタ、校内サーバ、無線アクセスポイントなどをスイッチへ接続し、外部へ出る通信は境界のルータへ渡します。無線LANもLANの一部であり、アクセスポイントが無線端末と有線側のLANを橋渡しします。</p>
            <p>離れた場所にあるLAN同士を通信回線で結ぶ広域ネットワークが{{WAN}}です。例えば本社LANと支社LANを閉じた回線で結ぶ構成が該当します。家庭や学校をインターネットへ接続するサービスを提供する事業者が{{ISP}}です。LAN、WAN、インターネットは単なる大きさの違いではなく、だれが管理し、どの範囲を結ぶかが異なります。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>機器</th><th>役割</th></tr></thead><tbody><tr><td>スイッチ</td><td>LAN内で宛先MACアドレスに応じてフレームを転送する</td></tr><tr><td>ルータ</td><td>異なるネットワーク間で宛先IPアドレスに応じてパケットを転送する</td></tr><tr><td>アクセスポイント</td><td>無線LAN端末を有線側のネットワークへ接続する</td></tr><tr><td>モデム・ONU</td><td>回線に合わせて信号を変換する</td></tr></tbody></table></div>
            <p>多数の組織が管理するネットワークを、共通のTCP/IPで相互接続した「ネットワークのネットワーク」が{{インターネット}}です。全体を一つの組織が所有・運用しているのではなく、各ネットワークが相互接続し、宛先への経路情報を交換することで成り立っています。</p>
            <div class="practice"><strong>学校からWebサイトを見るとき</strong><p>端末→アクセスポイントまたはスイッチ→学校のルータ→契約先ISP→複数の中継ネットワーク→Webサーバ、という範囲を順に通ります。</p></div>`
        },
        {
          id: "network-processing",
          short: "処理モデル",
          kicker: "CENTRALIZED · DISTRIBUTED · P2P",
          title: "処理をどこで行うかで、システムの形が変わる",
          lead: "集中処理・分散処理・クライアントサーバ・P2Pを、役割と弱点で比較します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/processing-models.png" alt="処理システムが集中処理と分散処理に分かれ、分散処理の例としてクライアントサーバとP2Pが位置づく階層図"><figcaption>クライアントサーバとP2Pは、どちらも複数のコンピュータが協力する分散処理の一種。</figcaption></figure>
            <p>処理システムは、計算やデータをどこへ置くかによって{{集中処理}}と{{分散処理}}に分類できます。集中処理では、中央コンピュータが主要な処理とデータ管理を担い、端末は主に入力・出力を行います。管理方針を統一しやすい一方、中央へ負荷が集中し、中央の障害が全体へ影響しやすくなります。</p>
            <p>分散処理では、複数のコンピュータが役割を分担して一つの処理を実現します。機器を増やして負荷を分けたり、障害の影響を局所化したりできますが、データの同期、処理順序、複数箇所の障害対応などが必要です。{{クライアントサーバシステム}}と{{P2P}}は、集中処理と並ぶ独立分類ではなく、分散処理の代表的な構成です。</p>
            <div class="compare-grid"><article class="concept-card"><h3>クライアントサーバ</h3><p>クライアントが「このページを送ってほしい」「この商品を検索したい」と要求し、サーバがWebページ・検索結果・ファイルなどを提供します。同じ端末でも、利用する機能によってクライアントにもサーバにもなり得ます。</p></article><article class="concept-card"><h3>P2P</h3><p>各ピアが対等に接続し、データを受け取る側にも提供する側にもなります。特定の1台へ機能を集めない構成を作れますが、参加端末の状態やデータの所在を管理する工夫が必要です。</p></article></div>
            <div class="mini-quiz"><b>確認：</b>WebブラウザとWebサーバの関係は分散処理のうち{{クライアントサーバシステム}}、対等な端末が互いにファイル断片を提供する構成は{{P2P}}です。</div>`
        },
        {
          id: "network-protocols",
          short: "プロトコルと階層",
          kicker: "PROTOCOL · LAYERS",
          title: "通信規約を階層に分け、役割を明確にする",
          lead: "送受信の形式・順序・エラー処理を定めた約束がプロトコルです。",
          html: `
            <p>異なる機器やソフトウェアが通信するには、データ形式、送信の順序、確認応答、エラー時の処理などを共通化する必要があります。この規約を{{プロトコル}}といいます。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/tcpip-layers.png" alt="TCP/IPの4階層と代表的なプロトコル・役割を示す図"><figcaption>上位層は下位層の機能を利用し、各層は担当範囲だけを処理する。</figcaption></figure>
            <div class="layer-stack"><div class="layer-row"><b>4</b><strong>アプリケーション層</strong><span>HTTP、HTTPS、SMTP、POP3、IMAP、DNSなど</span></div><div class="layer-row"><b>3</b><strong>トランスポート層</strong><span>TCP・UDP。アプリケーション間の通信を識別する</span></div><div class="layer-row"><b>2</b><strong>インターネット層</strong><span>IP。宛先ネットワークまでパケットを運ぶ</span></div><div class="layer-row"><b>1</b><strong>ネットワークインターフェース層</strong><span>Ethernet・Wi-Fi。隣接機器との伝送を担う</span></div></div>
            <p>{{TCP}}は到着確認・順序制御・再送などで信頼性を高めます。{{UDP}}は確認処理を簡略化し、遅延を小さくしたい音声・映像・ゲームなどで使われます。</p>`
        },
        {
          id: "network-encapsulation",
          short: "カプセル化",
          kicker: "ENCAPSULATION",
          title: "各層が制御情報を付け、受信側で逆順に外す",
          lead: "通信データは、送信側でヘッダを重ね、受信側で同じ階層ごとに解釈します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/tcpip-encapsulation.gif" alt="HTTPデータにTCP、IP、Ethernetの制御情報が順に付加され、受信側で外されるアニメーション"><figcaption>送信側は上位から下位へカプセル化、受信側は下位から上位へ非カプセル化する。</figcaption></figure>
            <div class="step-flow" style="--steps:4"><article class="step-item"><b>データ</b><p>HTTPなどアプリケーションの内容。</p></article><article class="step-item"><b>セグメント</b><p>TCPヘッダとデータ。</p></article><article class="step-item"><b>パケット</b><p>IPヘッダ、TCPヘッダ、データ。</p></article><article class="step-item"><b>フレーム</b><p>リンク用ヘッダ・末尾情報を付加。</p></article></div>
            <p>ヘッダには、IPアドレス、MACアドレス、順序制御など、その層で必要な制御情報が入ります。各層のデータ単位を{{PDU}}と呼ぶこともあります。</p>
            <div class="key-point"><strong>なぜ階層化するか</strong><p>ある層の技術を変更しても、他の層との受け渡し方が保たれていれば、全体を作り直さずに改良できます。</p></div>`
        },
        {
          id: "network-addressing",
          short: "IP・MAC・NAT",
          kicker: "IP · MAC · NAT",
          title: "IPで終点を示し、MACで次の機器へ渡す",
          lead: "IPアドレスとMACアドレスは、使われる範囲と役割が異なります。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/addressing.png" alt="宛先IPアドレスが終点まで維持され、宛先MACアドレスは区間ごとに付け替えられることとNATを示す図"><figcaption>IPアドレスは通信相手を端から端まで識別し、MACアドレスは同一リンク内で次に渡す相手を示す。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>識別子</th><th>使われる範囲</th><th>役割</th></tr></thead><tbody><tr><td>IPアドレス</td><td>送信元から宛先まで</td><td>終点となるネットワーク上のインターフェースを示す</td></tr><tr><td>MACアドレス</td><td>同一リンク内</td><td>次にフレームを渡す機器のインターフェースを示す</td></tr></tbody></table></div>
            <p>送信端末は、最終的な受信サーバのIPアドレスをIPパケットへ入れます。同じLAN内の相手ならその相手へ、別ネットワークの相手なら{{デフォルトゲートウェイ}}であるルータへフレームを渡します。このとき、IPパケットはフレームの中に入って運ばれます。ルータを越えるたびにリンク用のフレームは作り直されるため宛先MACアドレスは変わりますが、宛先IPアドレスは原則として最終サーバを示したままです。</p>
            <p>IPv4は{{32ビット}}、IPv6は{{128ビット}}です。IPv4アドレス不足を緩和するため、LAN内では外部で直接使わないプライベートIPアドレスを利用し、境界のルータが{{NAT}}でグローバルIPアドレスへ対応づけます。NATはアドレス変換であり、それだけで完全なセキュリティ対策になるわけではありません。</p>
            <p>{{DHCP}}はIPアドレス、サブネットマスク、デフォルトゲートウェイ、DNSサーバなどの設定を端末へ自動配布します。端末が接続直後から通信できるのは、これらを手入力せず受け取れるためです。</p>`
        },
        {
          id: "network-routing",
          short: "経路制御とパケット交換",
          kicker: "ROUTER · ROUTING · PACKET SWITCHING",
          title: "ルータが次の中継先を選び、パケットをバケツリレーする",
          lead: "インターネットには複数の経路があり、各ルータは宛先までの全行程ではなく次の一歩を選びます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/packet-routing.gif" alt="網状に接続された複数のルータが、経路表を参照しながらパケットを一台ずつ中継するアニメーション"><figcaption>灰色のリンクは代替経路。青くなったリンクが今回通った経路で、橙のパケットがルータごとに受け渡される。</figcaption></figure>
            <p>インターネットの中継網では、ルータ同士が一本の直線ではなく{{網状}}に接続されています。あるリンクやルータが使えない場合でも別経路を選べるようにし、通信量や管理方針に応じて経路を変えられるためです。すべてのルータがすべての端末を直接知っているのではなく、宛先IPアドレスの範囲と「次に渡すルータ」を対応づけた{{経路表}}を使います。</p>
            <div class="step-flow" style="--steps:4"><article class="step-item"><b>1 分割</b><p>送るデータを扱いやすい大きさのパケットに分ける。</p></article><article class="step-item"><b>2 判定</b><p>ルータが宛先IPと経路表を照合する。</p></article><article class="step-item"><b>3 中継</b><p>選んだ次のルータへパケットを渡す。</p></article><article class="step-item"><b>4 再構成</b><p>受信側が届いたデータを正しい順序へ戻す。</p></article></div>
            <p>通信前に送信者と受信者の間の一本の回線を占有するのではなく、複数の通信が回線を共有し、パケット単位で転送する方式を{{パケット交換}}といいます。各パケットは同じ経路を通るとは限らず、混雑や障害で別経路になる場合があります。TCPを使う通信では、欠落や順序の入替えを検出し、必要に応じて再送・並べ替えを行います。</p>
            <div class="mini-quiz"><b>確認：</b>ルータが決めるのは「最終サーバへ至る全ルータ列」ではなく、経路表に基づく{{次の中継先}}です。</div>`
        },
        {
          id: "network-dns",
          short: "DNSとURL",
          kicker: "DNS · DOMAIN · URL",
          title: "人が読む名前を、通信に使うIPアドレスへ変換する",
          lead: "DNSは階層的・分散的に管理され、必要な情報を順に問い合わせます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/dns-resolution.gif" alt="端末、キャッシュDNS、ルート、TLD、権威DNSを経てIPアドレスを得る手順のアニメーション"><figcaption>実際にはキャッシュが利用され、毎回すべてのDNSサーバへ問い合わせるとは限らない。</figcaption></figure>
            <p>{{DNS}}はドメイン名とIPアドレスなどを対応づける仕組みです。端末は通常、設定されたキャッシュDNSサーバへ問い合わせます。情報がなければ、ルートDNS、TLD DNS、権威DNSをたどって結果を得ます。</p>
            <div class="formula">https://www.example.jp/course/index.html</div>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>部分</th><th>意味</th></tr></thead><tbody><tr><td>https</td><td>スキーム。通信方法を示す</td></tr><tr><td>www.example.jp</td><td>ホスト名・ドメイン名</td></tr><tr><td>/course/index.html</td><td>サーバ内の資源へのパス</td></tr></tbody></table></div>
            <p>DNSの応答には有効期間を示す{{TTL}}があり、キャッシュはその期間だけ再利用されます。</p>`
        },
        {
          id: "network-information-systems",
          short: "情報システム",
          kicker: "INFORMATION SYSTEM",
          title: "入力・処理・保存・出力を、人と手続きまで含めて設計する",
          lead: "情報システムはコンピュータだけでなく、人・組織・規則・データを含みます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/information-system.png" alt="利用者、入力、処理、データベース、出力、フィードバックからなる情報システム"><figcaption>出力を評価して入力や処理を改善するフィードバックまでが一つの仕組み。</figcaption></figure>
            <p>情報システムは、目的を達成するために情報を収集・処理・蓄積・提供する仕組みです。ハードウェア、ソフトウェア、ネットワーク、データベースだけでなく、{{利用者}}と{{業務手順}}も含みます。</p>
            <div class="concept-grid"><article class="concept-card"><h3>社会基盤</h3><p>交通、電力、金融、医療、行政など。停止時の影響が大きく、高い可用性が必要です。</p></article><article class="concept-card green"><h3>業務システム</h3><p>販売、在庫、予約、成績管理など。正確なデータと権限管理が重要です。</p></article></div>
            <p>障害に備えて予備の機器・回線・データなどを用意することを{{冗長化}}といいます。一部に障害が起きても必要な機能を継続できるよう設計する考え方が{{フォールトトレランス}}です。障害時に機能や性能を段階的に縮小しながら全停止を避ける設計は、特に{{フェールソフト}}といいます。</p>`
        },
        {
          id: "network-database",
          short: "データベース",
          kicker: "RELATIONAL DATABASE",
          title: "表を関連づけ、重複と矛盾を減らす",
          lead: "リレーショナルデータベースでは、行・列・キーを使ってデータを構造化します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/database.png" alt="正規化前の学生部活表を学生表と部活表に分け、外部キーから主キーを参照する関係を示した図"><figcaption>同じ事実を一度だけ保存し、外部キーで別表の主キーを参照する。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>操作</th><th>意味</th><th>SQLの例</th></tr></thead><tbody><tr><td>{{選択}}</td><td>条件に合う行を取り出す</td><td><code>WHERE score &gt;= 80</code></td></tr><tr><td>{{射影}}</td><td>必要な列を取り出す</td><td><code>SELECT name, score</code></td></tr><tr><td>{{結合}}</td><td>共通項目を使って表をつなぐ</td><td><code>JOIN ... ON ...</code></td></tr></tbody></table></div>
            <p>行を一意に識別する列を{{主キー}}、別の表の主キーを参照する列を{{外部キー}}といいます。正規化は、データの重複を減らし、追加・更新・削除時の矛盾を防ぐために表を分割する考え方です。</p>
            <div class="warning"><strong>整合性</strong><p>型・範囲・一意性・参照関係などの制約を設け、矛盾したデータが入らないようにします。バックアップとは役割が異なります。</p></div>`
        },
        {
          id: "network-security",
          short: "情報セキュリティ",
          kicker: "CIA · THREATS · DEFENCE",
          title: "機密性・完全性・可用性を、複数の対策で守る",
          lead: "攻撃を一つの製品で防ぐのではなく、人・技術・運用の層を重ねます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/security-cia.png" alt="機密性、完全性、可用性と、代表的な脅威・対策の対応図"><figcaption>CIAのどれが損なわれるかを考えると、必要な対策を選びやすい。</figcaption></figure>
            <div class="three-grid"><article class="concept-card"><h3>機密性</h3><p>許可された人だけが情報へアクセスできること。認証・アクセス制御・暗号化で守ります。</p></article><article class="concept-card green"><h3>完全性</h3><p>情報が正しく、意図しない改ざんや破壊がないこと。ハッシュ・署名・変更履歴で確かめます。</p></article><article class="concept-card warm"><h3>可用性</h3><p>必要なときに情報やサービスを利用できること。冗長化・バックアップ・監視で守ります。</p></article></div>
            <p>ウイルス、ワーム、トロイの木馬、ランサムウェア、スパイウェアなど悪意あるソフトウェアの総称が{{マルウェア}}です。ボットネットは感染端末を外部から制御して大量通信などに悪用します。</p>
            <div class="key-point"><strong>基本対策</strong><p>OS・アプリを更新する／長く使い回さないパスワードと多要素認証／不審なURL・添付ファイルを開かない／必要最小限の権限／複数世代のバックアップ。</p></div>`
        },
        {
          id: "network-cryptography",
          short: "暗号と鍵交換",
          kicker: "SYMMETRIC · PUBLIC KEY · HYBRID",
          title: "鍵を用意する人と、暗号化・復号に使う鍵を追う",
          lead: "共通鍵・公開鍵・ハイブリッド暗号は、鍵の本数だけでなく準備と受け渡しの手順が異なります。",
          html: `
            <p>{{暗号化}}は、平文を鍵とアルゴリズムで変換し、鍵をもたない人には内容を読みにくくする処理です。{{復号}}は暗号文から平文を取り戻す処理です。暗号方式を読むときは、①鍵をだれが作るか、②どの鍵をだれへ渡すか、③暗号化にどの鍵を使うか、④復号にどの鍵を使うか、の四点を順に確かめます。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/cryptography.png" alt="共通鍵暗号では同じ秘密鍵を共有し、公開鍵暗号では受信者が鍵ペアを作って公開鍵で暗号化し秘密鍵で復号する流れ"><figcaption>公開鍵暗号で暗号文を送りたい場合は、受信者が鍵ペアを準備し、送信者は受信者の公開鍵を使う。</figcaption></figure>
            <h3>共通鍵暗号：同じ秘密鍵を事前に共有する</h3>
            <p>送信者と受信者のどちらか、または通信システムが共通鍵Kを生成し、通信を始める前に両者で安全に共有します。送信者はKで平文を暗号化し、受信者も同じKで復号します。処理が速く、大容量の本文を暗号化するのに向きます。ところが、まだ安全な通信路がない段階でKをどう渡すかという{{鍵配送問題}}があります。相手が増えるほど、漏えいさせずに多数の鍵を管理する負担も増えます。</p>
            <h3>公開鍵暗号：受信者が鍵ペアを準備する</h3>
            <ol><li>受信者が、数学的に対応する{{公開鍵}}と{{秘密鍵}}のペアを生成します。</li><li>受信者は公開鍵を送信者へ渡し、秘密鍵は自分だけで保管します。</li><li>送信者は受信者の公開鍵で平文を暗号化します。</li><li>暗号文を受け取った受信者は、対応する自分の秘密鍵で復号します。</li></ol>
            <p>公開鍵を第三者が偽物へ差し替えると、その第三者に読まれる可能性があります。そのため実際のWeb通信では、公開鍵が本当に目的のサーバのものかを{{デジタル証明書}}と認証局の署名で確認します。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>方式</th><th>鍵の準備</th><th>本文の処理</th><th>主な長所と課題</th></tr></thead><tbody><tr><td>共通鍵暗号</td><td>同じ秘密鍵を送受信者で共有</td><td>同じ鍵で暗号化・復号</td><td>高速／安全な鍵配送が必要</td></tr><tr><td>公開鍵暗号</td><td>受信者が公開鍵と秘密鍵を生成</td><td>受信者の公開鍵で暗号化し、受信者の秘密鍵で復号</td><td>秘密鍵を配らない／処理量が大きい</td></tr></tbody></table></div>
            <h3>ハイブリッド暗号：鍵の配送と本文を分担する</h3>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/hybrid-encryption.png" alt="送信者が生成したセッション鍵を受信者の公開鍵で暗号化し、受信者が秘密鍵で復号した後、本文をセッション鍵で暗号化する流れ"><figcaption>公開鍵暗号で保護するのは主にセッション鍵。大きな本文は高速な共通鍵暗号で保護する。</figcaption></figure>
            <p>送信者は通信ごとに一時的な{{セッション鍵}}Kを生成します。受信者は公開鍵と秘密鍵のペアを用意し、公開鍵を送信者へ渡します。送信者はKを受信者の公開鍵で暗号化して送り、受信者は自分の秘密鍵でKを復号します。ここまでで両者だけが同じKを共有できるため、その後の本文は高速な共通鍵暗号で暗号化します。これが{{ハイブリッド暗号}}です。</p>
            <div class="practice"><strong>HTTPSとの対応</strong><p>現在のTLS、とくにTLS 1.3では、上の図のようにセッション鍵そのものをRSAで暗号化して渡すのではなく、一時的な鍵交換によって両者が同じ秘密を導出する方式が一般的です。証明書とデジタル署名で接続先を確認し、合意した一時鍵から共通鍵を作って通信本文を保護する、という役割分担を押さえます。</p></div>`
        },
        {
          id: "network-signature",
          short: "ハッシュとデジタル署名",
          kicker: "HASH · DIGITAL SIGNATURE",
          title: "署名者の秘密鍵で署名し、署名者の公開鍵で検証する",
          lead: "デジタル署名は内容を隠す仕組みではなく、署名者と完全性を確かめる仕組みです。",
          html: `
            <p>{{ハッシュ関数}}は、長さの異なる入力から一定長の{{ハッシュ値}}を計算します。ハッシュ値から元の本文を復元することが難しく、異なる二つの入力が同じ値になる組を見つけることも難しく、入力が少し変わると出力が大きく変わる性質を利用します。ただし、本文とハッシュ値だけを一緒に送ると、攻撃者が両方を差し替えられるため、送信者を証明できません。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/digital-signature.png" alt="署名者が本文のハッシュ値と秘密鍵から署名を作り、検証者が本文のハッシュ値、署名、公開鍵を検証アルゴリズムへ渡す手順"><figcaption>使う鍵は署名者の鍵ペア。秘密鍵は署名者だけが使い、検証者は署名者の公開鍵を使う。</figcaption></figure>
            <ol><li><strong>鍵の準備：</strong>署名者が公開鍵と秘密鍵のペアを生成し、秘密鍵を厳重に保管します。公開鍵は証明書などを通して検証者へ届けます。</li><li><strong>要約：</strong>署名者が送る本文へハッシュ関数を適用し、ハッシュ値を計算します。</li><li><strong>署名：</strong>署名者の秘密鍵と署名アルゴリズムで、そのハッシュ値からデジタル署名を作ります。</li><li><strong>送信：</strong>本文と署名を検証者へ送ります。署名は本文を隠さないため、秘密にしたい場合は別に暗号化します。</li><li><strong>検証：</strong>検証者は受信本文からハッシュ値を再計算し、署名者の公開鍵、受信した署名、再計算したハッシュ値を署名検証アルゴリズムへ渡します。検証に成功すれば、署名後に本文が変わっていないことと、対応する秘密鍵によって署名が作られたことを確認できます。</li></ol>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>確認できること</th><th>確認できないこと</th></tr></thead><tbody><tr><td>署名後に本文が改ざんされていないこと（完全性）</td><td>本文を第三者に読まれないこと（機密性）</td></tr><tr><td>署名に使った秘密鍵の保有者に由来すること（真正性）</td><td>公開鍵が本当に本人のものか。これは証明書などで別に確認する</td></tr></tbody></table></div>
            <div class="warning"><strong>「秘密鍵で暗号化する」の単純な逆操作ではない</strong><p>学習上は鍵の向きを対比することがありますが、実際のデジタル署名は署名専用の方式・ハッシュ・書式を組み合わせます。暗号化と署名は目的も安全性の条件も別です。</p></div>`
        },
        {
          id: "network-rsa",
          short: "RSA暗号のしくみ",
          kicker: "RSA · PUBLIC KEY ALGORITHM",
          title: "RSAを、公開鍵方式の具体例として数式で確かめる",
          lead: "RSAは公開鍵暗号やデジタル署名に利用できるアルゴリズムの一つで、署名そのものとは分けて学びます。",
          html: `
            <p>RSAでは、二つの大きな素数から公開鍵と秘密鍵を作ります。大きな合成数を素因数分解することが現実的な時間では難しいという性質を安全性の基礎に使います。以下は計算手順を理解するための小さな数の例であり、この大きさには安全性がありません。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/rsa-example.png" alt="p=5、q=11からN、L、公開指数E、秘密指数Dを求め、12を23へ暗号化して12へ復号するRSAの学習例"><figcaption>RSAは公開鍵方式の一例。実用では巨大な素数、安全な乱数、標準化されたパディングを使う。</figcaption></figure>
            <ol><li>異なる素数p＝5、q＝11を選び、N＝pq＝55を求めます。</li><li>L＝lcm(p−1, q−1)＝lcm(4, 10)＝20を求めます。</li><li>Lと互いに素なE＝3を選び、ED≡1 (mod L)となるD＝7を求めます。</li><li>公開鍵を(N, E)＝(55, 3)、秘密鍵を(N, D)＝(55, 7)とします。</li></ol>
            <div class="formula">暗号化 c = mᴱ mod N　　復号 m = cᴰ mod N</div>
            <p>平文を数m＝12とすると、c＝12³ mod 55＝23です。秘密鍵側では23⁷ mod 55＝12となり、元の値へ戻ります。実際には長い本文をRSAで直接暗号化するのではなく、ハイブリッド暗号の鍵保護や、標準化されたRSA署名方式などで使います。</p>
            <div class="key-point"><strong>節を分ける理由</strong><p>公開鍵暗号は「公開鍵と秘密鍵を使う方式の分類」、RSAはその分類に属する具体的なアルゴリズム、デジタル署名は完全性と真正性を確認する目的・手続きです。階層の違う概念を同じものとして扱いません。</p></div>`
        },
        {
          id: "network-integrity",
          short: "保全技術と安全対策",
          kicker: "WATERMARK · BLOCKCHAIN · ERROR DETECTION",
          title: "隠す・改ざんを見つける・転送誤りを見つけるを区別する",
          lead: "電子透かし、ブロックチェーン、誤り検出符号は、守る対象と目的が異なります。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/integrity-tools.png" alt="電子透かし、ブロックチェーン、偶数パリティの役割を比較する図"><figcaption>暗号化・署名・誤り検出は目的が異なる。必要に応じて組み合わせる。</figcaption></figure>
            <p>この三つは順番に処理する技術でも、互いから派生した技術でもありません。{{電子透かし}}は著作物へ権利者情報などを埋め込む、{{ブロックチェーン}}は履歴のつながりと共有状態を検証しやすくする、{{誤り検出符号}}は通信・保存中の偶発的なビット誤りを見つける、という別々の目的をもちます。</p>
            <div class="concept-grid"><article class="concept-card"><h3>電子透かし</h3><p>画像・音声などへ権利者ID、配布先ID、真正性確認用情報などを、人が知覚しにくい形で埋め込みます。圧縮や加工後にも残る強さと、画質への影響のバランスが必要です。</p></article><article class="concept-card"><h3>ブロックチェーン</h3><p>各ブロックが前ブロックのハッシュを含むため、過去を書き換えると後続のつながりが崩れます。複数ノードで共有し、合意形成の規則に従って履歴を追加します。</p></article><article class="concept-card"><h3>誤り検出符号</h3><p>パリティ、チェックサム、CRCなどで偶発的な誤りを検出します。悪意ある改ざん者は検査値も作り直せるため、暗号学的ハッシュや署名とは役割が異なります。</p></article><article class="concept-card"><h3>バックアップ</h3><p>情報を隠したり改ざんを検出したりする技術ではなく、障害・誤操作・ランサムウェアなどで失ったデータを復旧するための複製です。</p></article></div>
            <p>偶数パリティでは、データとパリティビットを合わせた1の個数を偶数にします。0010101には1が3個あるので、付加するパリティビットは{{1}}、結果は{{00101011}}です。</p>
            <div class="practice"><strong>安全対策の考え方</strong><p>脅威を洗い出し、発生可能性と影響を評価し、回避・低減・移転・受容から対応を選びます。技術対策だけでなく、教育・手順・連絡体制まで含めます。</p></div>`
        }
      ]
    },
    statistics: {
      kicker: "FIELD 04 / DATA & STATISTICS",
      title: "データを要約し、関係を読み、結論の限界を示す",
      lead: "尺度、代表値、分布、相関、回帰、時系列、公的統計まで。グラフを描くだけで終わらず、問いに答える調査の流れを学びます。",
      meta: ["データの尺度", "代表値と散布度", "相関と回帰", "時系列", "モデル化"],
      sections: [
        {
          id: "statistics-scales",
          short: "データと尺度",
          kicker: "VARIABLE · SCALE",
          title: "尺度を見分けると、使える計算が決まる",
          lead: "数値で書かれていても、平均との差や比に意味があるとは限りません。",
          html: `
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>尺度</th><th>意味のあるもの</th><th>例</th><th>代表的な要約</th></tr></thead><tbody><tr><td>{{名義尺度}}</td><td>同じ・異なる</td><td>血液型、都道府県、商品分類</td><td>度数、最頻値</td></tr><tr><td>{{順序尺度}}</td><td>順序</td><td>満足度、順位、段階評価</td><td>中央値、四分位数</td></tr><tr><td>{{間隔尺度}}</td><td>差</td><td>摂氏温度、西暦</td><td>平均、標準偏差</td></tr><tr><td>{{比例尺度}}</td><td>差と比</td><td>身長、時間、金額、人数</td><td>平均、標準偏差、比率</td></tr></tbody></table></div>
            <p>{{尺度}}は、値の間にどのような関係を認めてよいかを表します。名義尺度は分類だけ、順序尺度は分類と順序、間隔尺度はさらに差、比例尺度は差と比まで意味をもちます。同じ「数字」で入力されていても、学籍番号は人を区別する名義尺度、順位は順序尺度、摂氏温度は間隔尺度、身長は比例尺度です。</p>
            <p>摂氏20℃は10℃より10℃高いといえますが、2倍の温かさとはいえません。0℃が温度の不在を表す絶対的な0ではないからです。一方、20 kgは10 kgの2倍であり、0 kgは質量がない状態を表すので比例尺度です。分析前に尺度を確かめると、意味のない平均や比を計算する誤りを防げます。</p>
            <div class="key-point"><strong>分類は文脈でも変わる</strong><p>アンケートの「満足・普通・不満」は順序尺度ですが、便宜上1・2・3と符号化しても、1と2の差が2と3の差と同じとは限りません。数値化しただけで間隔尺度になるわけではありません。</p></div>
            <div class="mini-quiz"><b>確認：</b>学年（1年・2年・3年）は順序がありますが差や比を計算する変数ではないため、{{順序尺度}}として扱います。</div>`
        },
        {
          id: "statistics-investigation",
          short: "統計的探究",
          kicker: "QUESTION · PLAN · DATA · CONCLUSION",
          title: "問いから始め、結論の限界まで説明する",
          lead: "分析方法を先に選ぶのではなく、何を明らかにしたいかを明確にします。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/investigation-cycle.png" alt="課題設定、計画、収集、整理、分析、結論、改善の統計的探究サイクル"><figcaption>結論から新しい問いが生まれ、調査計画を改善する循環になる。</figcaption></figure>
            <div class="step-flow" style="--steps:4"><article class="step-item"><b>1 問い</b><p>対象・比較・期間を具体化する。</p></article><article class="step-item"><b>2 計画</b><p>必要な変数、母集団、標本、方法を決める。</p></article><article class="step-item"><b>3 分析</b><p>分布・関係・時間変化を可視化する。</p></article><article class="step-item"><b>4 結論</b><p>根拠と限界を添えて伝える。</p></article></div>
            <p>調べたい対象全体を{{母集団}}、実際に観測する一部を{{標本}}といいます。母集団を偏りなく推測するには、標本の抽出方法が重要です。</p>
            <div class="warning"><strong>バイアスを減らす</strong><p>回答しやすい人だけを集める、質問文が結論を誘導する、欠測した回答を都合よく除くなどは結果を歪めます。収集方法と除外基準を記録します。</p></div>`
        },
        {
          id: "statistics-summary",
          short: "代表値と散らばり",
          kicker: "CENTER · SPREAD",
          title: "中心と散らばりを、組にして要約する",
          lead: "平均値だけでは、分布の形やばらつきは分かりません。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/descriptive-distribution.png" alt="同じ平均で散らばりが異なる分布、中央値、四分位範囲、標準偏差を示す図"><figcaption>中心が同じでも散らばりは異なる。代表値と散布度をセットで読む。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>指標</th><th>定義・特徴</th></tr></thead><tbody><tr><td>{{平均値}}</td><td>合計÷個数。すべての値を使うが外れ値の影響を受けやすい</td></tr><tr><td>{{中央値}}</td><td>小さい順の中央。外れ値の影響を受けにくい</td></tr><tr><td>{{最頻値}}</td><td>最も多く現れる値・階級。名義尺度にも使える</td></tr><tr><td>{{範囲}}</td><td>最大値−最小値。両端だけで決まる</td></tr><tr><td>{{四分位範囲}}</td><td>Q₃−Q₁。中央50%の広がり</td></tr><tr><td>{{標準偏差}}</td><td>平均との差を二乗して平均し、平方根を取った散らばり</td></tr></tbody></table></div>
            <div class="formula">分散 = Σ(xᵢ − x̄)² / n　　標準偏差 = √分散</div>
            <p>図の箱ひげ図は、最小値10、Q₁＝20、中央値30、Q₃＝45、最大値60を同じ数直線上へ置いた五数要約です。箱はQ₁からQ₃までの中央50%を表し、箱の中の線が中央値、左右のひげが最小値・最大値までを表します。四分位範囲はQ₃−Q₁＝25です。</p>
            <div class="warning"><strong>外れ値を別の点で描く流儀</strong><p>統計ソフトでは、Q₁−1.5IQR未満またはQ₃＋1.5IQR超を外れ値として点で描き、ひげをその範囲内の端の値までとすることがあります。図が「最小・最大までのひげ」か「1.5IQR方式」かを確認します。</p></div>
            <p>標本から母集団の分散を推定するときは、分母をn−1とする不偏分散が使われます。データそのものの分散なのか、母分散を推定する分散なのかを確認します。</p>`
        },
        {
          id: "statistics-graphs",
          short: "分布のグラフ",
          kicker: "HISTOGRAM · BOX PLOT",
          title: "階級幅や軸を確認し、分布の形を読む",
          lead: "グラフは形を見せますが、作り方によって印象が変わります。",
          html: `
            <h3>ヒストグラム</h3><p>連続量を階級に分け、各階級の度数や相対度数を長方形で表します。階級幅を変えると山の数や形が変わるため、幅の根拠を示します。</p>
            <h3>箱ひげ図</h3><p>最小値、Q₁、中央値、Q₃、最大値を使って分布を要約します。複数集団の中央値・散らばり・外れ値を同じ尺度で比較するのに向きます。</p>
            <div class="concept-grid"><article class="concept-card"><h3>右に裾が長い分布</h3><p>大きい側の少数値に平均が引かれ、平均値が中央値より大きくなりやすい。</p></article><article class="concept-card green"><h3>外れ値</h3><p>入力ミスとは限りません。原因を確認し、除外するなら基準と影響を説明します。</p></article></div>
            <div class="warning"><strong>グラフの確認点</strong><p>軸の開始位置、目盛間隔、単位、縦横比、母数、欠測値、階級幅。切断された縦軸は差を大きく見せることがあります。</p></div>`
        },
        {
          id: "statistics-correlation",
          short: "散布図と相関",
          kicker: "SCATTER · CORRELATION",
          title: "二つの量の関係を、向き・強さ・形で読む",
          lead: "相関係数は直線的な関係を要約し、因果関係を証明する値ではありません。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/scatter-correlation.png" alt="正の相関、負の相関、無相関、非線形関係、外れ値を比較する散布図"><figcaption>相関係数が0に近くても、曲線的な関係が存在する場合がある。</figcaption></figure>
            <p>{{散布図}}は一つの対象について二つの量をx座標・y座標で表します。右上がりなら正の相関、右下がりなら負の相関、方向が見えなければ相関が弱いと読みます。</p>
            <p>{{相関係数r}}は−1から1の範囲で、直線的な関係の向きと強さを表します。単位を変えても値は変わりませんが、外れ値の影響を強く受ける場合があります。</p>
            <div class="key-point"><strong>相関関係≠因果関係</strong><p>第三の変数が両方に影響している、偶然一致した、原因と結果の向きが逆である可能性があります。時系列・比較群・実験計画など追加の根拠が必要です。</p></div>`
        },
        {
          id: "statistics-regression",
          short: "回帰と残差",
          kicker: "REGRESSION · RESIDUAL",
          title: "回帰直線で予測し、残差でモデルのずれを調べる",
          lead: "予測値だけでなく、どの程度外れたかと適用範囲を確認します。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/regression-residual.png" alt="散布図の回帰直線と、観測値から予測値を引いた残差のプロット"><figcaption>良い直線モデルでは、残差が0付近に偏りなく散らばる。</figcaption></figure>
            <p>説明変数xから目的変数yを予測する一次式を回帰直線 y＝ax＋b とします。最小二乗法では、各点の縦方向のずれの二乗和が最小になるa・bを求めます。</p>
            <div class="formula">残差 eᵢ = 実測値 yᵢ − 予測値 ŷᵢ</div>
            <p>残差に曲線的な並び、扇形の広がり、時系列の連続性があれば、直線モデルや等分散・独立性の仮定が合っていない可能性があります。</p>
            <div class="warning"><strong>外挿に注意</strong><p>観測したxの範囲外へ回帰式を延長した予測は、関係が同じまま続く保証がないため不確かです。</p></div>`
        },
        {
          id: "statistics-normal",
          short: "正規分布と標準化",
          kicker: "NORMAL DISTRIBUTION · Z-SCORE",
          title: "平均から標準偏差何個分離れているかで位置を比べる",
          lead: "正規分布では、平均と標準偏差から一定範囲に入る割合を概算できます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/normal-distribution.png" alt="正規分布の平均±1σ、±2σ、±3σの範囲と割合を示す図"><figcaption>約68%・95%・99.7%は、正規分布に従う場合の経験則。</figcaption></figure>
            <p>正規分布は平均を中心に左右対称の釣鐘形をした連続分布です。平均μ、標準偏差σのとき、内側から順にμ±1σへ約{{68.3%}}、μ±2σへ約{{95.4%}}、μ±3σへ約{{99.7%}}が含まれます。外側の範囲ほど内側の範囲を含むため、68.3%→95.4%→99.7%の順で範囲が広がります。</p>
            <div class="formula">標準得点 z = (x − μ) / σ</div>
            <p>z得点は、値xが平均から標準偏差何個分離れているかを表します。単位や尺度が異なる分布で相対的位置を比較できます。</p>
            <div class="warning"><strong>すべての分布が正規分布ではない</strong><p>人数の少ないデータ、強く歪んだデータ、上限・下限があるデータに68-95-99.7則を機械的に当てはめません。</p></div>`
        },
        {
          id: "statistics-public-data",
          short: "公的データの分析手順",
          kicker: "E-STAT · OPEN DATA · REPRODUCIBILITY",
          title: "公的データは、検索・抽出・加工・解釈の道筋を残す",
          lead: "結果の数値だけでなく、どの表をどの条件で取得し、どう計算したかを再現できるようにします。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/public-data-workflow.png" alt="問いを決め、e-Statで統計を探し、表と条件を選び、定義確認、取得、整形、分析、解釈まで進む手順"><figcaption>公的統計の価値は数値だけでなく、出典・抽出条件・加工式をたどって同じ分析を再現できる点にもある。</figcaption></figure>
            <p>{{e-Stat}}は政府統計を分野・組織・キーワードなどから探せる総合窓口です。最初に「何を、どの地域間で、いつの時点について比べるか」を問いとして定めます。次に調査名と統計表を選び、項目・地域・年次を絞ります。似た表題でも速報・確報、暦年・年度、現在人口・常住人口など定義が違うことがあるため、表の注記とメタデータを読みます。</p>
            <h3>例：人口10万人当たり図書館数を都道府県で比べる</h3>
            <ol><li>社会教育調査などから都道府県別の図書館数を取得します。</li><li>同じ基準年に対応する都道府県別人口を取得します。図書館数が年度、人口が年次なら、どの時点を対応させるかを記録します。</li><li>都道府県名や地域コードで二つの表を結合します。合計行、全国行、欠測記号を通常の都道府県データへ混ぜないようにします。</li><li>各地域について次の式で指標を計算します。</li></ol>
            <div class="formula">人口10万人当たり図書館数 = 図書館数 ÷ 人口 × 100,000</div>
            <p>単純な図書館数では人口の多い地域が大きくなりやすいため、人口を分母にして比較可能な指標へ直します。ただし、面積、交通、開館時間、蔵書数、学校図書館の扱いなどは含まれません。「利用環境」を一つの指標だけで断定せず、指標の限界を結論へ添えます。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>残す情報</th><th>記録例</th></tr></thead><tbody><tr><td>出典</td><td>作成機関、調査名、統計表名・表番号、URL</td></tr><tr><td>抽出条件</td><td>項目、地域、年次、単位、速報・確報</td></tr><tr><td>加工</td><td>除外した行、欠測の扱い、結合キー、計算式</td></tr><tr><td>時点</td><td>データの対象時点とファイル取得日</td></tr><tr><td>解釈</td><td>結果が答える範囲、答えられない範囲、別の説明可能性</td></tr></tbody></table></div>
            <div class="warning"><strong>割合の分母をそろえる</strong><p>高齢化率なら「65歳以上人口÷総人口」、人口当たり施設数なら「施設数÷人口」です。分子と分母の地域・年次・定義が一致していなければ、計算できても意味のある比較になりません。</p></div>`
        },
        {
          id: "statistics-time-series",
          short: "時系列と季節調整",
          kicker: "TIME SERIES · MOVING AVERAGE · SEASONAL ADJUSTMENT",
          title: "時間変化を成分に分け、季節調整済み系列まで作る",
          lead: "原系列の上下をそのまま比較せず、毎年繰り返す季節性と長期的な動きを分けます。",
          html: `
            <p>{{時系列データ}}は、同じ対象を時間の順に観測したデータです。日ごとの気温、月ごとの売上、四半期ごとのGDPなどが該当します。時間順序を無視して通常の散布図だけで扱うと、長期変化や周期性を見落とすため、横軸を時間として連続した変化を読みます。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/time-series.png" alt="時系列を傾向変動、季節変動、循環変動、不規則変動に分け、各成分の形を示す図"><figcaption>季節変動は暦に沿ってほぼ一定周期で繰り返し、循環変動は季節より長く周期も一定とは限らない。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>成分</th><th>意味</th><th>例</th></tr></thead><tbody><tr><td>{{傾向変動 T}}</td><td>長期的に増加・減少する動き</td><td>人口減少、長期的な価格上昇</td></tr><tr><td>{{季節変動 S}}</td><td>1年・1週・1日など暦に沿って繰り返す動き</td><td>夏の電力需要、週末の来客数</td></tr><tr><td>{{循環変動 C}}</td><td>季節より長い波で、周期が一定とは限らない動き</td><td>景気循環</td></tr><tr><td>{{不規則変動 I}}</td><td>事故・災害・一時的イベントなど予測しにくい動き</td><td>台風による交通量減少</td></tr></tbody></table></div>
            <p>変動幅が水準によらずほぼ一定ならY＝T＋S＋C＋Iの{{加法モデル}}、売上が大きい時期ほど季節変動幅も大きくなるような場合はY＝T×S×C×Iの{{乗法モデル}}で考えます。</p>
            <h3>移動平均から季節調整済み系列へ</h3>
            <figure class="raster-figure"><img src="../assets/lecture-v2/statistics/seasonal-adjustment.png" alt="36か月の原系列、12か月中心化移動平均、季節指数で割った季節調整済み系列を縦に比較した図"><figcaption>原系列の毎年繰り返す山谷を季節指数で除くと、基調となる増減を比較しやすくなる。</figcaption></figure>
            <ol><li><strong>原系列を描く：</strong>欠測、外れ値、周期、長期傾向を確認します。</li><li><strong>移動平均を求める：</strong>月次データなら12か月移動平均で季節変動をならし、傾向×循環を近似します。12のような偶数期間では平均の位置が月と月の間になるため、隣り合う移動平均をさらに平均する{{中心化移動平均}}を使います。</li><li><strong>季節比率を求める：</strong>乗法モデルでは原系列÷中心化移動平均により、おおよそ季節×不規則を取り出します。</li><li><strong>季節指数を作る：</strong>1月どうし、2月どうしのように同じ月の季節比率を平均し、12か月の平均が1になるよう調整します。</li><li><strong>季節調整する：</strong>原系列を対応する月の季節指数で割ります。</li></ol>
            <div class="formula">季節調整済み系列 = 原系列 ÷ 季節指数 ≈ 傾向 × 循環 × 不規則</div>
            <p>季節調整済み系列は、季節要因を除いて前月との変化や基調を読みやすくした系列です。ただし不規則変動は残り、季節指数は新しいデータや手法によって改訂されることがあります。元の実数値を示す原系列と、変化を読む季節調整済み系列を目的に応じて使い分けます。</p>
            <div class="mini-quiz"><b>確認：</b>12か月移動平均を月の位置へ合わせるため、隣り合う二つの移動平均をさらに平均する操作を{{中心化}}といいます。</div>`
        }
      ]
    }
  };
})();
