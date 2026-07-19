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
            <figure class="html-figure"><div class="step-flow" style="--steps:4"><article class="step-item"><b>1 収集</b><p>目的に合う情報を探す。</p></article><article class="step-item"><b>2 評価</b><p>発信者・時点・根拠を確かめる。</p></article><article class="step-item"><b>3 整理</b><p>比較し、関係を読み取る。</p></article><article class="step-item"><b>4 活用</b><p>判断や問題解決へつなげる。</p></article></div><div class="knowledge-ladder" aria-label="データから知恵までの段階"><span><b>データ</b><small>事実・測定値</small></span><span><b>情報</b><small>目的に沿った整理・解釈</small></span><span><b>知識</b><small>問題解決に使える理解</small></span><span><b>知恵</b><small>長期的な判断</small></span></div><figcaption>情報リテラシーは、情報を見つける力だけでなく、根拠を確かめて活用する力まで含む。</figcaption></figure>
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
            <p>{{個人情報保護法}}は、個人情報の有用性に配慮しつつ、個人の権利利益を保護する法律です。生存する個人に関する情報で、その情報だけで特定の個人を識別できるもの、ほかの情報と容易に照合すると特定の個人を識別できるもの、または個人識別符号を含むものを個人情報といいます。</p>
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
            <figure class="html-figure"><div class="balance-grid"><article><span>本人側の利益</span><strong>私生活・肖像・自己に関する情報を守る</strong><p>撮影、公開、利用、削除の希望を考える。</p></article><b aria-hidden="true">⇄</b><article><span>社会側の利益</span><strong>行政の透明性や公共性を確保する</strong><p>開示の必要性と、不開示情報の範囲を考える。</p></article></div><figcaption>公開の可否は一律ではない。本人の人格的利益と、報道・情報公開などの公共性を具体的に比較する。</figcaption></figure>
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
            <figure class="html-figure"><div class="hierarchy-tree topic-focus focus-industrial"><div class="tree-root">知的財産権</div><div class="tree-branches"><article class="industrial-branch"><h3>産業財産権</h3><p>特許権・実用新案権・意匠権・商標権</p><small>出願・登録によって発生</small></article><article class="copyright-branch"><h3>著作権</h3><p>著作者の権利・著作隣接権</p><small>著作者の権利は創作時に発生</small></article><article><h3>その他の知的財産</h3><p>回路配置利用権・育成者権・営業秘密など</p><small>根拠法と保護方法はそれぞれ異なる</small></article></div></div><figcaption>この節では、知的財産権のうち青緑色で強調した産業財産権を学ぶ。</figcaption></figure>
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
            <figure class="html-figure"><div class="hierarchy-tree topic-focus focus-copyright"><div class="tree-root">知的財産権</div><div class="tree-branches"><article class="industrial-branch"><h3>産業財産権</h3><p>特許権・実用新案権・意匠権・商標権</p><small>出願・登録によって発生</small></article><article class="copyright-branch"><h3>著作権</h3><p>著作者の権利・著作隣接権</p><small>著作者の権利は創作時に発生</small></article><article><h3>その他の知的財産</h3><p>回路配置利用権・育成者権・営業秘密など</p><small>根拠法と保護方法はそれぞれ異なる</small></article></div></div><figcaption>同じ全体図のうち、この節で扱う著作権を青緑色で強調している。</figcaption></figure>
            <figure class="html-figure"><div class="hierarchy-tree copyright-tree"><div class="tree-root">広い意味での著作権</div><div class="tree-branches"><article><h3>著作者の権利</h3><div class="nested-rights"><span><b>著作権（財産権）</b><small>複製、公衆送信、上演、翻案などの利用を管理</small></span><span><b>著作者人格権</b><small>公表、氏名表示、同一性保持</small></span></div></article><article><h3>伝達者の権利</h3><div class="nested-rights"><span><b>著作隣接権</b><small>実演家、レコード製作者、放送事業者、有線放送事業者</small></span><span><b>実演家人格権</b><small>氏名表示・同一性保持に関する権利</small></span></div></article></div></div><figcaption>まず権利をもつ主体を分け、次に財産的な権利と人格的な権利を区別する。</figcaption></figure>
            <h3>著作権（財産権）＝狭い意味での著作権は、利用方法ごとに分かれる</h3>
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
            <h3>権利の存続期間と、譲渡・相続の違い</h3>
            <p>日本では、著作者の権利は著作物を創作した時点で自動的に発生する{{無方式主義}}です。登録しなければ権利が発生しない産業財産権とは異なります。ただし、著作権（財産権）と著作者人格権では、譲渡・相続や存続期間の扱いが異なります。</p>
            <div class="compare-grid"><article class="concept-card"><h4>著作権（財産権）</h4><p>譲渡・相続ができます。保護期間には著作物の種類などによる例外がありますが、自然人が著作者である著作物では、原則として創作時から著作者の生存中と{{死後70年}}です。</p></article><article class="concept-card warm"><h4>著作者人格権</h4><p>著作者だけに属する{{一身専属}}の権利で、譲渡も相続もできず、著作者の死亡によって権利そのものは消滅します。ただし死後も、著作物を公衆へ提供・提示するときに、存命なら著作者人格権の侵害となる行為は、著作権法60条によって原則として禁止されます。行為の性質・程度や社会的事情の変動などにより、著作者の意を害しないと認められる場合は例外です。</p></article></div>
            <div class="warning"><strong>編集著作物とデータベースの著作物</strong><p>素材の選択・配列、または情報の選択・体系的構成に創作性がある場合、その構成自体が保護されます。個々の事実や数値そのものに著作権が発生するわけではありません。</p></div>
            <div class="key-point"><strong>著作権にも、条件付きの例外がある</strong><p>私的使用、引用、授業の過程で必要な利用など、許諾なしで利用できる規定を{{著作権の制限}}といいます。ただし「学校だから自由」「出所を書けば引用」という意味ではありません。目的・方法・必要な範囲など、規定ごとの条件を「著作権の制限」の節で確かめます。</p></div>`
        },
        {
          id: "society-neighbouring-rights",
          short: "著作隣接権",
          kicker: "NEIGHBOURING RIGHTS",
          title: "実演・録音・放送を担う人にも、伝達者としての権利がある",
          lead: "作品を創作した人の権利とは別に、作品や実演を公衆へ伝える人の活動も保護されます。",
          html: `
            <p>著作者が作品を創作するのに対し、実演家は歌唱・演奏・演技によって作品を表現し、レコード製作者は音を最初に録音し、放送事業者・有線放送事業者は番組を公衆へ伝えます。こうした伝達に重要な役割を果たす人へ与えられる権利が{{著作隣接権}}です。</p>
            <p>著作隣接権は、実演、音の最初の固定、放送・有線放送を行った時点で自動的に発生します。実演は実演を行った年の翌年から原則70年、レコードは発行した年の翌年から原則70年保護されます。固定後70年以内に発行されなかったレコードは、固定した年の翌年から70年です。放送・有線放送は、行った年の翌年から原則50年です。著作者の権利とは、権利者・守る対象・権利の内容が異なります。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>主体</th><th>守る対象</th><th>主な権利の内容</th><th>人格的な権利</th></tr></thead><tbody>
              <tr><td>{{実演家}}</td><td>歌唱、演奏、演技などの実演</td><td>録音・録画、放送・有線放送、送信可能化、録音物・録画物の譲渡・貸与などを管理し、一定の場合に二次使用料・報酬を受ける</td><td>氏名表示・同一性保持に関する{{実演家人格権}}がある</td></tr>
              <tr><td>{{レコード製作者}}</td><td>音を最初に固定して作ったレコード</td><td>複製、送信可能化、複製物の譲渡・貸与などを管理し、一定の場合に二次使用料・報酬を受ける</td><td>人格権はなく、財産的な権利をもつ</td></tr>
              <tr><td>{{放送事業者}}</td><td>自ら行った放送</td><td>放送の複製、再放送・有線放送、一定の装置によるテレビ放送の公の伝達などを管理する</td><td>人格権はなく、財産的な権利をもつ</td></tr>
              <tr><td>{{有線放送事業者}}</td><td>自ら行った有線放送</td><td>有線放送の複製、放送・再有線放送、一定の装置による有線テレビ放送の公の伝達などを管理する</td><td>人格権はなく、財産的な権利をもつ</td></tr>
            </tbody></table></div>
            <div class="key-point"><strong>一つの利用に、複数の権利が重なる</strong><p>市販の音源を動画へ入れて公開する場合、歌詞・楽曲の著作権だけでなく、歌手・演奏者の実演家の権利や、音源を制作したレコード製作者の権利も関係します。「曲の作者から許可を得たから、CD音源も自由に使える」とは限りません。</p></div>
            <div class="warning"><strong>許諾権だけでなく、報酬を受ける権利もある</strong><p>商業用レコードが放送などで利用された場合の二次使用料や、貸レコードについての報酬など、利用そのものを禁止する権利とは別に、法律で定められた報酬を受ける権利もあります。</p></div>`
        },
        {
          id: "society-copyright-exceptions",
          short: "著作権の制限",
          kicker: "COPYRIGHT LIMITATIONS",
          title: "許諾なしで使えるのは、法律上の条件を満たす範囲だけ",
          lead: "私的使用・引用・授業などの代表例を取り上げます。ほかにも多くの権利制限規定があります。",
          html: `
            <h3>著作権の制限――次は代表的な例の一部</h3>
            <p>著作権法は、著作者の利益と社会における公正な利用のバランスを取るため、一定の条件で著作権（財産権）を制限しています。以下の四項目は全体の一部です。「学校だから」「非営利だから」自動的に自由になるわけではなく、利用する規定ごとに目的・方法・対象・必要な範囲などを確認します。</p>
            <div class="concept-grid">
              <article class="concept-card"><h4>私的使用のための複製</h4><p>個人的・家庭内など限られた範囲で、使用する本人が行う複製です。違法にアップロードされた著作物と知りながら行うダウンロードなどは、一定の要件の下で私的使用でも違法となります。</p></article>
              <article class="concept-card"><h4>{{引用}}</h4><p>公表済み、必然性、主従関係、明瞭な区別、出所明示などの条件を満たして利用します。</p></article>
              <article class="concept-card"><h4>教育機関での複製等</h4><p>授業の過程で必要な範囲に限られ、著作権者の利益を不当に害してはいけません。</p></article>
              <article class="concept-card"><h4>試験問題・時事報道</h4><p>目的に必要な範囲で認められる規定があります。利用条件は規定ごとに異なります。</p></article>
            </div>
            <div class="warning"><strong>ほかにも権利制限規定がある</strong><p>著作権法30条から47条の7には、図書館等での複製、障害のある人が情報を利用するための複製・公衆送信、写真などへの軽微な写り込み、情報解析のための利用など、多数の規定があります。許諾なしで使えるかは、実際の利用がどの条文の条件を満たすかで判断します。</p></div>
            <div class="key-point"><strong>引用は「出所を書けばよい」ではない</strong><p>自分の説明が主で引用部分が従になっているか、引用する必然性があるか、引用箇所を明確に区別しているか、必要な範囲に収まっているか、公正な慣行に合うかを確認します。出所明示は重要な条件の一つですが、それだけで引用になるわけではありません。</p></div>
            <h3>ライセンスによる利用許諾は、著作権の制限とは別</h3>
            <p>{{CCライセンス}}は、著作者が「表示」「非営利」「改変禁止」「継承」などの条件を組み合わせて利用許諾を示す仕組みです。法律が例外として許す「著作権の制限」ではなく、権利者が条件付きであらかじめ許諾する仕組みであり、権利を放棄する表示でもありません。</p>
            <div class="mini-quiz"><b>確認：</b>条件を満たす制限規定もライセンスも使えない場合は、原則として{{権利者の許諾}}を得てから利用します。</div>`
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
            <figure class="html-figure"><div class="radix-grid"><article><span>10進法</span><strong>0〜9</strong><p>…10³・10²・10¹・10⁰</p></article><article><span>2進法</span><strong>0・1</strong><p>…2³・2²・2¹・2⁰</p></article><article><span>16進法</span><strong>0〜9・A〜F</strong><p>…16³・16²・16¹・16⁰</p></article></div><div class="state-count"><b>nビット</b><span aria-hidden="true">→</span><strong>2ⁿ通り</strong><span>符号なし整数なら 0〜2ⁿ−1</span></div><figcaption>基数は使う記号の個数。右端を0桁目として、各桁へ基数の累乗を割り当てる。</figcaption></figure>
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
            <figure class="html-figure"><div class="conversion-grid"><section><h3>11₁₀ → 1011₂</h3><ol class="division-trace"><li><span>11 ÷ 2 = 5</span><b>余り 1</b></li><li><span>5 ÷ 2 = 2</span><b>余り 1</b></li><li><span>2 ÷ 2 = 1</span><b>余り 0</b></li><li><span>1 ÷ 2 = 0</span><b>余り 1</b></li></ol><p class="read-direction">余りを下から読む ↑</p></section><section><h3>1011₂ → 11₁₀</h3><div class="place-values"><span><b>1</b><small>×2³ = 8</small></span><span><b>0</b><small>×2² = 0</small></span><span><b>1</b><small>×2¹ = 2</small></span><span><b>1</b><small>×2⁰ = 1</small></span></div><p>8＋0＋2＋1＝11</p></section></div><figcaption>10進数からは2で割った余りを下から読み、10進数へ戻すときは各桁の重みを足す。</figcaption></figure>
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
            <h3>2の補数</h3>
            <p>負数は、正の値の全ビットを反転し1を加える{{2の補数}}で表すことが一般的です。4ビットで+5は0101₂、反転して1010₂、1を加えて1011₂となり、これが-5を表します。</p>
            <details class="deep-dive"><summary><span class="deep-dive-label">さらに詳しく：</span>2の補数で引き算を足し算に変える</summary><div class="deep-dive-body"><p>4ビットで5−3を確かめます。引く数3は0011₂です。全ビットを反転して1100₂、1を加えた1101₂が−3を表す2の補数です。</p><div class="formula">0101₂（5）＋1101₂（−3）＝1 0010₂</div><p>4ビットを超えた左端の1を捨てると0010₂、つまり2になります。したがって、5−3を「5＋（−3）」として同じ加算回路で計算できます。4ビットの2の補数で表せる範囲は−8〜+7なので、範囲外の結果は正しく表せません。</p></div></details>
            <h3>浮動小数点数</h3>
            <p>IEEE 754 binary32は、{{符号部1ビット}}・{{指数部8ビット}}・{{仮数部23ビット}}で構成されます。有限のビット数で実数を近似するため、丸め誤差が生じます。</p>
            <details class="deep-dive"><summary><span class="deep-dive-label">さらに詳しく：</span>数値と浮動小数点表現を往復する</summary><div class="deep-dive-body"><h4>数値から浮動小数点表現へ</h4><p>13.25₁₀は、整数部13が1101₂、小数部0.25が0.01₂なので、1101.01₂です。小数点を左へ3桁動かして正規化すると次の形になります。</p><div class="formula">13.25₁₀＝1101.01₂＝1.10101₂ × 2³</div><p>この例では符号は正、指数は3、仮数の有効部分は10101…です。実際のbinary32では、指数に一定の偏りを加え、仮数を決められたビット数へ収めて保存します。</p><h4>浮動小数点表現から数値へ</h4><div class="formula">1.011₂ × 2²＝101.1₂＝4＋1＋0.5＝5.5₁₀</div><p>指数2は2進小数点を右へ2桁動かすという意味です。正規化した形、2進数、小数値の順に戻すと読み違いを防げます。</p></div></details>
            <h3>文字コード</h3>
            <p>文字とビット列の対応表が文字コードです。ASCIIではKが01001011₂です。日本語を含む文字集合や符号化方式にはJIS、Shift_JIS、UTF-8などがあります。現在のWebでは{{UTF-8}}が広く使われます。</p>`
        },
        {
          id: "digital-logic",
          short: "論理演算",
          kicker: "BOOLEAN LOGIC",
          title: "真理値表で、論理回路の出力を確かめる",
          lead: "AND・OR・NOTは、入力の組合せから0または1を出力します。",
          html: `
            <p>論理回路では、0と1を偽・真に対応させ、回路記号が行う演算を真理値表で確かめます。{{AND}}は両方が1のときだけ1、{{OR}}は少なくとも一方が1なら1、{{NOT}}は0と1を反転します。NOT記号の小さな丸は否定を表します。</p>
            <div class="logic-gate-grid">
              <figure class="raster-figure"><img src="../assets/lecture-v2/digital/logic/logic-gate-and.png" alt="AND回路の記号と、入力A・Bの全組合せに対する出力Xの真理値表"><figcaption>AND（論理積）：AとBがともに1の行だけXが1になる。</figcaption></figure>
              <figure class="raster-figure"><img src="../assets/lecture-v2/digital/logic/logic-gate-or.png" alt="OR回路の記号と、入力A・Bの全組合せに対する出力Xの真理値表"><figcaption>OR（論理和）：AまたはBの少なくとも一方が1ならXが1になる。</figcaption></figure>
              <figure class="raster-figure"><img src="../assets/lecture-v2/digital/logic/logic-gate-not.png" alt="NOT回路の記号と、入力Aを反転した出力Xの真理値表"><figcaption>NOT（否定）：入力Aを反転してXへ出力する。</figcaption></figure>
            </div>
            <h3>複数の回路は、入力側から一段ずつ読む</h3>
            <ol><li>AとBの値を決めます。</li><li>最初に通るAND・OR・NOTの出力を求め、回路図の途中へ書き込みます。</li><li>その値を次の回路の入力として、最後の出力まで繰り返します。</li><li>A・Bの4通りを真理値表へ並べ、読み落としがないか確かめます。</li></ol>
            <div class="key-point"><strong>接続点を見落とさない</strong><p>線の交点に黒丸があれば接続しています。単に線が交差しているだけなら、別の信号として扱います。式の記号を暗記するより、各回路がどの入力で1を出すかを図と真理値表で対応させます。</p></div>`
        },
        {
          id: "digital-adders",
          short: "加算回路",
          kicker: "BINARY ADDITION · HALF ADDER",
          title: "半加算器は、1桁の2進数どうしを足し算する",
          lead: "同じ桁に書く数と、上の桁へ繰り上げる数を二つの出力に分けます。",
          html: `
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/logic/half-adder-circuit.png" alt="AND・OR・NOT回路を組み合わせ、入力AとBから繰り上がりCとその桁の和Sを出す半加算器"><figcaption>まず回路記号を入力側から追う。図中のア・イ・ウは各ゲートを通った途中の信号。上側はAとBがともに1のときだけCを1にし、下側はAとBの一方だけが1のときSを1にする。</figcaption></figure>
            <p>{{半加算器}}は、入力Aと入力Bという二つの1桁の2進数を加えます。出力は、計算結果を2桁に分けた{{C（上の桁へ送る繰り上がり）}}と{{S（いま計算している桁に書く数）}}です。つまり、CとSを左から並べたCSが、A＋Bの答えになります。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>入力A</th><th>入力B</th><th>C<br><small>繰り上がり</small></th><th>S<br><small>その桁の和</small></th><th>2進数の足し算</th></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0＋0＝00₂</td></tr><tr><td>0</td><td>1</td><td>0</td><td>1</td><td>0＋1＝01₂</td></tr><tr><td>1</td><td>0</td><td>0</td><td>1</td><td>1＋0＝01₂</td></tr><tr><td>1</td><td>1</td><td>1</td><td>0</td><td>1＋1＝10₂</td></tr></tbody></table></div>
            <div class="key-point"><strong>1＋1＝10₂を回路で作る</strong><p>1＋1の答えは2進数で10₂です。いまの桁には0を書くのでS＝0、左の桁へ1を繰り上げるのでC＝1になります。この一行が、半加算器を理解する中心です。</p></div>
            <p>AとBが0・0ならCSは00、0・1または1・0なら01、1・1なら10です。半加算器は「論理回路の出力」を別に覚える装置ではなく、{{1桁の2進数の足し算をそのまま実現した回路}}です。</p>`
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
            <details class="deep-dive"><summary><span class="deep-dive-label">さらに詳しく：</span>標本化で起こる誤差</summary><div class="deep-dive-body"><p>測定間隔が粗いと、標本点の間で起きた細かな変化を記録できません。特に、標本化周波数の半分より高い周波数成分は、実際とは違う低い周波数に見える{{折り返し雑音（エイリアシング）}}を生むことがあります。</p><p>そこで、記録したい最高周波数の2倍より高い標本化周波数を使い、標本化前にそれより高い成分をフィルタで弱めます。標本化周波数を上げるほど時間方向を細かく記録できますが、データ量も増えます。</p></div></details>
            <details class="deep-dive"><summary><span class="deep-dive-label">さらに詳しく：</span>量子化で起こる誤差</summary><div class="deep-dive-body"><p>量子化では、実際の振幅を最も近い段階値へ丸めます。実際の値と割り当てた段階値の差が{{量子化誤差}}です。例えば実際の振幅が5.3で、段階値が整数だけなら5へ割り当てるため、誤差は−0.3です。</p><p>量子化ビット数がnビットなら段階数は2ⁿです。ビット数を増やすと段階の間隔が細かくなり誤差を小さくできますが、1標本当たりのデータ量は増えます。</p></div></details>
            <div class="formula">データ量 [bit] = 標本化周波数 × 量子化ビット数 × 時間 × チャンネル数</div>
            <div class="practice"><strong>計算問題：10秒のステレオ音声</strong><p>標本化周波数48 kHz、量子化16 bit、2チャンネルで10秒録音したとき、圧縮前のデータ量を求めます。</p><details class="practice-solution"><summary>解答・解説</summary><div><p>48 kHzは1秒間に48,000回標本化するという意味です。</p><div class="formula">48,000 × 16 × 10 × 2 ＝ 15,360,000 bit</div><p>8で割ると1,920,000 byte、10進表記では約1.92 MBです。音声ファイルには管理情報が付き、圧縮形式では実際の容量が変わります。</p></div></details></div>`
        },
        {
          id: "digital-image",
          short: "画像のデジタル化",
          kicker: "PIXEL · COLOR · COMPRESSION",
          title: "画像は、画素または図形の情報として表す",
          lead: "画像データの構造と色の表現を別の観点として整理します。",
          html: `
            <figure class="html-figure"><div class="image-type-grid"><article><div class="pixel-preview" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><h3>ラスタ形式</h3><p>画素ごとの色を保存。写真やスキャン画像に向き、拡大すると画素が見える。</p></article><article><div class="vector-preview" aria-hidden="true"><span></span></div><h3>ベクタ形式</h3><p>点・線・曲線を座標や数式で保存。拡大しても輪郭を滑らかに描き直せる。</p></article></div><figcaption>ラスタ／ベクタはデータ構造の分類。RGB／CMYKは色の表現方法であり、同じ分類階層ではない。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>比較点</th><th>ラスタ形式</th><th>ベクタ形式</th></tr></thead><tbody><tr><td>保存するもの</td><td>格子状に並んだ画素それぞれの色</td><td>点の座標、線・曲線、塗り、文字などの描画命令</td></tr><tr><td>得意なもの</td><td>写真、スキャン画像、細かな濃淡や質感</td><td>ロゴ、アイコン、地図、模式図、文字を含む図</td></tr><tr><td>拡大したとき</td><td>元の画素数を超えると、輪郭がぼけたり階段状に見えたりする</td><td>表示サイズに合わせて描き直すため、輪郭を滑らかに保ちやすい</td></tr><tr><td>編集方法</td><td>画素を選び、色や明るさを直接変更する</td><td>図形の位置・大きさ・輪郭・塗りを部品ごとに変更する</td></tr><tr><td>容量の傾向</td><td>画素数・色深度・圧縮方法の影響が大きい</td><td>単純な図は小さくしやすいが、図形や効果が増えると大きくなる</td></tr><tr><td>代表例</td><td>JPEG、PNG、GIF、WebP、TIFF</td><td>SVG、EPS。PDFはベクタとラスタの両方を含められる</td></tr></tbody></table></div>
            <p>写真のように画面全体で色が細かく変わる画像は、無数の図形に分けるよりラスタ形式が効率的です。一方、学校のロゴや路線図のように輪郭と面の組合せで表せる図は、ベクタ形式なら小さな表示から印刷まで同じデータを使いやすくなります。</p>
            <div class="warning"><strong>ファイルを変換しても、元の情報は増えない</strong><p>SVGをPNGへ書き出すと、その時点の画素数をもつラスタ画像になります。反対に、JPEGをSVGファイルへ埋め込んだだけでは、写真の画素が自動的に線や曲線へ変わるわけではありません。用途に合う形式を、作成・編集の段階から選びます。</p></div>
            <p>ラスタ画像は、画像を画素に区切る{{標本化}}、明るさや色を有限の段階へ割り当てる{{量子化}}、段階値を2進数で表す{{符号化}}の順でデジタル化します。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/digital/color-models.png" alt="RGBの加法混色とCMYKの減法混色を、重なりによって生じる色まで示して比較した図"><figcaption>RGBは光を加えると白へ、CMYは光を吸収するインクを重ねると黒へ近づく。印刷では黒インクKも使う。</figcaption></figure>
            <div class="formula">無圧縮画像のデータ量 [bit] = 横画素数 × 縦画素数 × 1画素のビット数</div>
            <p>ディスプレイは光の三原色{{RGB}}を使う加法混色です。R・G・Bを同じ強さで重ねると白になります。プリンタは色材の三原色{{CMY}}を使う減法混色で、実際には黒の再現とインク量の節約のためKを加えたCMYKを使います。RGB各色8ビットなら1画素は24ビットで、表せる色は2²⁴＝16,777,216色です。</p>
            <div class="practice"><strong>計算問題：無圧縮のカラー画像</strong><p>800×600画素、1画素24ビットの画像のデータ量を求めます。</p><details class="practice-solution"><summary>解答・解説</summary><div><div class="formula">800 × 600 × 24 ＝ 11,520,000 bit</div><p>8で割ると1,440,000 byte、10進表記では約1.44 MBです。PNGやJPEGなどで圧縮した後の容量は、画像の内容と圧縮方式によって変わります。</p></div></details></div>
            <div class="warning"><strong>解像度という語の違い</strong><p>画面では画素数、印刷やスキャンでは1インチ当たりの点や画素数（dpi・ppi）を指すことがあります。何を表す値か確認します。</p></div>`
        },
        {
          id: "digital-computer",
          short: "コンピュータの構成",
          kicker: "CPU · MEMORY · I/O · SOFTWARE",
          title: "五大装置が連携し、命令を順に実行する",
          lead: "入力・記憶・演算・制御・出力の役割を、データと命令の流れで捉えます。",
          html: `
            <figure class="html-figure"><div class="computer-architecture"><div class="architecture-node input-node"><b>入力装置</b><span>データ・指示を取り込む</span></div><div class="architecture-arrow input-memory-arrow" aria-hidden="true">→</div><article class="architecture-node cpu-node"><strong>CPU</strong><span>制御装置</span><span>演算装置</span></article><div class="architecture-vertical-link cpu-main-link"><b aria-hidden="true">↕</b><span>命令・データを読み出す<br>結果を書き戻す</span></div><article class="architecture-node main-memory-node"><strong>主記憶装置</strong><span>実行中の命令</span><span>処理中のデータ</span></article><div class="architecture-vertical-link main-storage-link"><b aria-hidden="true">↕</b><span>必要なプログラム・データを<br>読み出し／保存</span></div><article class="architecture-node storage-node"><strong>補助記憶装置</strong><span>SSD・HDDなど</span><span>長期保存</span></article><div class="architecture-arrow memory-output-arrow" aria-hidden="true">→</div><div class="architecture-node output-node"><b>出力装置</b><span>処理結果を外へ示す</span></div></div><figcaption>入力装置から取り込んだ命令・データは、まず主記憶装置へ置く。CPUは主記憶装置と読み書きし、主記憶装置から出力装置へ結果を渡す。補助記憶装置は主記憶装置とデータを交換する。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>装置</th><th>役割</th><th>例</th></tr></thead><tbody><tr><td>入力装置</td><td>データや指示を取り込む</td><td>キーボード、マウス、センサ</td></tr><tr><td>記憶装置</td><td>命令とデータを保存する</td><td>メモリ、SSD</td></tr><tr><td>演算装置</td><td>算術演算・論理演算を行う</td><td>CPU内の演算回路</td></tr><tr><td>制御装置</td><td>命令を解読し各装置を制御する</td><td>CPU内の制御回路</td></tr><tr><td>出力装置</td><td>処理結果を外へ示す</td><td>ディスプレイ、プリンタ</td></tr></tbody></table></div>
            <h3>CPUの速さは、一つの数値だけでは決まらない</h3>
            <p>{{クロック周波数}}はCPU内部の動作タイミングを1秒当たりの回数で表します。ただし、1回のクロックで行える仕事、コア数、キャッシュ、主記憶とのやり取り、実行するソフトウェアなども処理時間へ影響します。同じクロック周波数でも、設計や処理内容が違えば速さは同じとは限りません。</p>
            <p>{{OS}}はハードウェア資源を管理し、アプリケーションへ共通機能を提供する基本ソフトウェアです。デバイスドライバは機器固有の操作をOSにつなぎ、ファームウェアは機器の基本制御や起動を担います。</p>`
        },
        {
          id: "digital-performance",
          short: "有限桁と誤差",
          kicker: "FINITE PRECISION · ERROR",
          title: "有限桁で表すと、あふれや近似による誤差が起こる",
          lead: "コンピュータが扱える桁数には限りがあるため、整数や小数の計算結果を点検する必要があります。",
          html: `
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
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/processing-models.png?v=2" alt="集中処理では端末が入力と表示だけを行い中央コンピュータが処理する一方、分散処理では複数のコンピュータが処理を分担し、その例としてクライアントサーバとP2Pがあることを示す図"><figcaption>線の形ではなく、処理を担当する場所に注目する。集中処理の端末は入力・表示が中心だが、クライアントサーバのクライアントは画面処理や入力確認など自分の処理も行う。</figcaption></figure>
            <p>処理システムは、計算やデータをどこへ置くかによって{{集中処理}}と{{分散処理}}に分類できます。集中処理では、中央コンピュータが主要な処理とデータ管理を担い、端末は主に入力・出力を行います。管理方針を統一しやすい一方、中央へ負荷が集中し、中央の障害が全体へ影響しやすくなります。</p>
            <p>分散処理では、複数のコンピュータが役割を分担して一つの処理を実現します。機器を増やして負荷を分けたり、障害の影響を局所化したりできますが、データの同期、処理順序、複数箇所の障害対応などが必要です。{{クライアントサーバシステム}}と{{P2P}}は、集中処理と並ぶ独立分類ではなく、分散処理の代表的な構成です。</p>
            <div class="compare-grid"><article class="concept-card"><h3>クライアントサーバ</h3><p>クライアントが「このページを送ってほしい」「この商品を検索したい」と要求し、サーバがWebページ・検索結果・ファイルなどを提供します。同じ端末でも、利用する機能によってクライアントにもサーバにもなり得ます。</p></article><article class="concept-card"><h3>P2P</h3><p>各ピアが対等に接続し、データを受け取る側にも提供する側にもなります。特定の1台へ機能を集めない構成を作れますが、参加端末の状態やデータの所在を管理する工夫が必要です。</p></article></div>
            <div class="key-point"><strong>集中処理とクライアントサーバは、見た目が似ても役割が違う</strong><p>どちらも中央側の大きな機器へ複数端末がつながる図になりやすいですが、集中処理では端末は基本的に入力・表示を担当し、計算は中央へ集めます。クライアントサーバでは、クライアントもプログラムを動かして処理し、必要なサービスやデータをサーバへ要求します。</p></div>
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
            <figure class="html-figure protocol-figure">
              <div class="protocol-endpoints"><section><span>要求する側</span><strong>クライアント</strong><small>Webブラウザ</small></section><i aria-hidden="true">⇄</i><section><span>提供する側</span><strong>サーバ</strong><small>Webサーバ</small></section></div>
              <p class="protocol-question">「Webページを送って」「どうぞ」という通信を、役割の異なる四つの層で分担する。</p>
              <div class="layer-stack protocol-layers">
                <article class="layer-row"><b>4</b><div><strong>アプリケーション層</strong><span>利用するサービスの約束</span></div><div class="protocol-example"><small>Webをやり取りする</small><em>HTTP・HTTPS</em></div></article>
                <article class="layer-row"><b>3</b><div><strong>トランスポート層</strong><span>信頼性や即時性に応じた届け方</span></div><div class="protocol-example"><small>確認・再送を行う／簡潔に送る</small><em>TCP・UDP</em></div></article>
                <article class="layer-row"><b>2</b><div><strong>インターネット層</strong><span>ネットワークを越えて宛先まで運ぶ</span></div><div class="protocol-example"><small>宛先を識別し経路を選ぶ</small><em>IP</em></div></article>
                <article class="layer-row"><b>1</b><div><strong>ネットワークインターフェース層</strong><span>同じリンク上の次の機器へ伝送する</span></div><div class="protocol-example"><small>有線・無線で信号を送る</small><em>Ethernet・Wi-Fi</em></div></article>
              </div>
              <div class="protocol-directions"><span>送信側：上位層から下位層へ</span><span>受信側：下位層から上位層へ</span></div>
              <figcaption>一つの規約ですべてを決めるのではなく、層ごとに担当を分ける。各層は自分の役割を果たし、上下の層へ処理を受け渡す。</figcaption>
            </figure>
            <p>{{TCP}}は到着確認・順序制御・再送などで信頼性を高め、Webやメール、ファイル転送などで広く使われます。{{UDP}}は確認処理を簡略化し、DNSの問い合わせや、遅延を小さくしたい音声・映像・ゲームなどで使われます。ただし、用途と方式が一対一で決まるわけではありません。ここでは「TCPは信頼性を高める機能を備え、UDPは簡潔にデータを運ぶ」という役割の違いを押さえます。</p>`
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
            <p>ヘッダには、IPアドレス、MACアドレス、順序制御など、その層で必要な制御情報が入ります。どの情報を付けるかは、それぞれの層の役割によって異なります。</p>
            <div class="key-point"><strong>なぜ階層化するか</strong><p>ある層の技術を変更しても、他の層との受け渡し方が保たれていれば、全体を作り直さずに改良できます。</p></div>`
        },
        {
          id: "network-addressing",
          short: "IP・MAC・NAT",
          kicker: "IP · MAC · NAT",
          title: "IPアドレスで最終相手を示し、区間ごとに送り直す",
          lead: "IPパケットと、LANで運ぶためのフレームを分けて考えます。",
          html: `
            <p>端末がWebサーバへ送るIPパケットには、最終的な通信相手の{{宛先IPアドレス}}が入ります。ルータはその宛先を見て、経路表から次に送り出す方向を選びます。IPアドレスは「インターネット全体の中で、最終的にどこへ届けたいか」を判断するための情報です。</p>
            <p>ただし、IPパケットが一本の入れ物のまま全区間を通るわけではありません。端末はまず、相手が同じLANにいるか、別のネットワークにいるかを判断します。別のネットワークなら、IPパケットをLAN用の{{フレーム}}に入れ、{{デフォルトゲートウェイ}}であるルータへ渡します。</p>
            <p>ルータへ届くと、その区間で使ったフレームの役目は終わります。ルータは中のIPパケットを確認し、次の区間に合う新しいフレームへ入れて送り出します。Ethernetや無線LANの区間では、このフレームの届け先を示すためにMACアドレスを使います。したがって、MACアドレスはインターネット全体を通じた住所ではなく、{{そのLAN区間でフレームを届けるための情報}}です。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>情報</th><th>入っている場所</th><th>高校情報Ⅰで押さえる役割</th></tr></thead><tbody><tr><td>IPアドレス</td><td>IPパケット</td><td>最終的な通信相手を示し、ルータが経路を選ぶ基準になる</td></tr><tr><td>MACアドレス</td><td>Ethernet・無線LANなどのフレーム</td><td>同じLAN区間で、端末やルータのインターフェースへ届ける</td></tr></tbody></table></div>
            <div class="key-point"><strong>遠くのサーバへ送るとき</strong><p>端末が最初のフレームで指定する相手は、遠くのWebサーバそのものではなく、通常は同じLANにいるルータです。ルータを越えるたびに、その区間の通信方式に合わせてフレームを作り直します。宛先IPアドレスは原則として最終サーバを示したままですが、NATを通る場合などは書き換えられます。</p></div>
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
            <figure class="html-figure"><ol class="process-list"><li><b>利用者・目的</b><span>何を実現するか決める</span></li><li><b>入力</b><span>必要なデータを集める</span></li><li><b>処理・保存</b><span>規則に沿って処理し、データベースへ保存</span></li><li><b>出力</b><span>結果を画面・帳票・通知で示す</span></li><li><b>評価・改善</b><span>出力を確かめ、入力や処理へ戻す</span></li></ol><figcaption>コンピュータだけでなく、利用者・目的・業務手順と、結果を改善へ戻すフィードバックを含む。</figcaption></figure>
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
            <figure class="html-figure relational-workflow"><div class="database-stage"><span class="database-stage-label">保存</span><section><h3>正規化して三つの表へ分ける</h3><div class="database-table-cluster"><div><b>学生表</b><div class="mini-data-table two-col"><span>学生ID <em>主キー</em></span><span>氏名</span><strong>S01</strong><span>青木</span><strong>S02</strong><span>伊藤</span><strong>S03</strong><span>加藤</span></div></div><div><b>所属表</b><div class="mini-data-table two-col"><span>学生ID <em>外部キー</em></span><span>部活ID <em>外部キー</em></span><strong>S01</strong><strong>C02</strong><strong>S02</strong><strong>C01</strong><strong>S02</strong><strong>C02</strong><strong>S03</strong><strong>C01</strong></div></div><div><b>部活表</b><div class="mini-data-table three-col"><span>部活ID <em>主キー</em></span><span>部活名</span><span>顧問</span><strong>C01</strong><span>将棋部</span><span>高橋</span><strong>C02</strong><span>科学部</span><span>後藤</span></div></div></div><p>氏名、部活名、顧問をそれぞれ一度だけ保存し、所属だけをIDの組で記録する。</p></section></div><div class="database-join-arrow" aria-hidden="true"><b>必要なときに結合</b><span>共通するIDを対応づける ↓</span></div><div class="database-stage database-output"><span class="database-stage-label">利用</span><section><h3>結合して、読みたい一つの表に戻す</h3><div class="mini-data-table three-col"><span>氏名</span><span>部活名</span><span>顧問</span><span>青木</span><span>科学部</span><span>後藤</span><span>伊藤</span><span>将棋部</span><span>高橋</span><span>伊藤</span><span>科学部</span><span>後藤</span><span>加藤</span><span>将棋部</span><span>高橋</span></div><p>画面や帳票では、分割した表を結合して人が読みやすい結果を作る。</p></section></div><figcaption>正規化は「分けて終わり」ではない。重複を減らして安全に保存し、利用時には主キーと外部キーを使って必要な形へ結合する。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>操作</th><th>意味</th><th>上の部活動データでの例</th></tr></thead><tbody><tr><td>{{選択}}</td><td>条件に合う行を取り出す</td><td>科学部に所属する行だけを取り出す</td></tr><tr><td>{{射影}}</td><td>必要な列を取り出す</td><td>氏名と部活名の列だけを表示する</td></tr><tr><td>{{結合}}</td><td>共通項目を使って表をつなぐ</td><td>学生ID・部活IDを対応づけ、氏名・部活名・顧問を一つの表にする</td></tr></tbody></table></div>
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
            <h3>共通鍵暗号方式：同じ共通鍵Kを、暗号化と復号に使う</h3>
            <p>共通鍵暗号では、送信者と受信者が同じ{{共通鍵K}}を持ちます。処理は高速ですが、通信を始める前に共通鍵Kを安全に渡す方法が必要です。</p>
            <ol><li><strong>共通鍵Kを共有する：</strong>どちらか一方または鍵を管理する仕組みが共通鍵Kを用意し、送信者と受信者だけが同じ共通鍵Kを持つ状態にします。</li><li><strong>共通鍵Kで暗号化する：</strong>送信者は、平文と共通鍵Kを暗号化アルゴリズムへ入力して暗号文を作ります。</li><li><strong>暗号文を送る：</strong>通信経路を流れるのは暗号文です。共通鍵Kは暗号文と一緒に平文のまま送ってはいけません。</li><li><strong>共通鍵Kで復号する：</strong>受信者は、届いた暗号文と同じ共通鍵Kを復号アルゴリズムへ入力し、元の平文へ戻します。</li></ol>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/shared-key-encryption.gif?v=3" alt="送信者から暗号化、暗号文、復号、受信者へ進み、暗号化と復号に事前共有した同じ共通鍵Kを使う共通鍵暗号方式のアニメーション"><figcaption>文章の四段階を図で追う。青は平文・暗号文の流れ、橙は共通鍵Kと、それを暗号化・復号へ入力する向きを表す。</figcaption></figure>
            <h3>公開鍵暗号方式：受信者が公開鍵Pと秘密鍵Sを作り、秘密鍵Sを配らない</h3>
            <p>受信者へ秘密の情報を送りたい場合、受信者が組になった{{公開鍵P}}と{{秘密鍵S}}を作ります。公開鍵Pは公開してよい一方、秘密鍵Sは受信者だけが保管します。</p>
            <ol><li><strong>受信者が鍵ペアを作る：</strong>公開鍵Pと秘密鍵Sは数学的に対応しますが、公開鍵Pから秘密鍵Sを現実的な時間で求めることが難しいように設計されています。</li><li><strong>公開鍵Pだけを公開する：</strong>受信者は公開鍵Pを公開し、秘密鍵Sを外へ出しません。送信者は、それが受信者本人の公開鍵Pであることを確認して取得します。</li><li><strong>公開鍵Pで暗号化する：</strong>送信者は、平文と受信者の公開鍵Pから暗号文を作ります。公開鍵Pを知る人でも、この暗号文を公開鍵Pで復号することはできません。</li><li><strong>暗号文を送る：</strong>送信者から受信者へ暗号文を送ります。</li><li><strong>秘密鍵Sで復号する：</strong>受信者は、自分だけが持つ秘密鍵Sで暗号文を平文へ戻します。</li></ol>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/public-key-encryption.gif?v=3" alt="受信者の下で公開鍵Pと秘密鍵Sを生成し、公開鍵Pだけを公開して送信者が取得した後、公開鍵Pで暗号化し秘密鍵Sで復号する公開鍵暗号方式のアニメーション"><figcaption>公開鍵Pと秘密鍵Sが受信者の下に現れ、公開鍵Pだけが中央へ公開され、そのコピーを送信者が取得する。鍵から処理へ向かう矢印は、暗号化・復号で使う鍵を示す。</figcaption></figure>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>方式</th><th>鍵の準備</th><th>本文の処理</th><th>主な長所と課題</th></tr></thead><tbody><tr><td>共通鍵暗号</td><td>同じ共通鍵Kを送信者と受信者で共有</td><td>共通鍵Kで暗号化し、同じ共通鍵Kで復号</td><td>高速／共通鍵Kを安全に共有する方法が必要</td></tr><tr><td>公開鍵暗号</td><td>受信者が公開鍵Pと秘密鍵Sを生成</td><td>受信者の公開鍵Pで暗号化し、受信者の秘密鍵Sで復号</td><td>秘密鍵Sを配らない／処理量が大きい</td></tr></tbody></table></div>
            <p>共通鍵暗号は大きな本文を高速に処理できますが、安全な通信路がない段階で共通鍵Kをどう共有するかという{{鍵配送問題}}があります。公開鍵暗号では秘密鍵Sを配りませんが、公開鍵Pを偽物へ差し替えられると安全ではありません。実際のWeb通信では、公開鍵Pが目的のサーバのものかを{{デジタル証明書}}と認証局の署名で確認します。</p>
            <h3>ハイブリッド暗号：鍵の配送と本文を分担する</h3>
            <p>次の図は、送信者が作った{{共通鍵K}}（通信ごとに使うセッション鍵）を受信者の公開鍵Pで暗号化して送り、本文は共通鍵Kで暗号化する{{ハイブリッド暗号の一例}}です。鍵の共有には公開鍵暗号、本文の処理には高速な共通鍵暗号を使い、二つの方式の長所を組み合わせます。</p>
            <ol><li><strong>通信ごとの共通鍵Kを作る：</strong>送信者が、本文を共通鍵暗号で処理するための一時的な共通鍵Kを用意します。</li><li><strong>共通鍵Kを公開鍵暗号で守る：</strong>送信者は受信者の公開鍵Pで共通鍵Kを暗号化し、受信者は自分の秘密鍵Sで共通鍵Kを取り出します。</li><li><strong>本文を共通鍵Kで暗号化する：</strong>送信者は、大きな本文を高速な共通鍵暗号で暗号化して送ります。</li><li><strong>本文を共通鍵Kで復号する：</strong>受信者は、取り出した同じ共通鍵Kで本文を元へ戻します。</li></ol>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/hybrid-encryption.png?v=3" alt="段階1で共通鍵Kを受信者の公開鍵Pで暗号化して送り、段階2で共有できた共通鍵Kを使って本文を暗号化するハイブリッド暗号の一例"><figcaption>文章の四段階を二つのまとまりで示す。段階1では共通鍵Kを公開鍵Pと秘密鍵Sで安全に共有し、段階2では同じ共通鍵Kで本文を効率よく暗号化・復号する。</figcaption></figure>
            <div class="practice"><strong>HTTPSとの対応</strong><p>現在のTLS、とくにTLS 1.3では、上の基本モデルのようにセッション鍵そのものを公開鍵暗号で直接渡すのではなく、一時的な鍵交換によって両者が同じ秘密を導出する方式が一般的です。証明書とデジタル署名で接続先を確認し、合意した一時鍵から共通鍵を作って通信本文を保護する、という役割分担を押さえます。</p></div>`
        },
        {
          id: "network-signature",
          short: "ハッシュとデジタル署名",
          kicker: "HASH · DIGITAL SIGNATURE",
          title: "署名者の秘密鍵で署名し、署名者の公開鍵で検証する",
          lead: "デジタル署名は内容を隠す仕組みではなく、署名者と完全性を確かめる仕組みです。",
          html: `
            <p>{{デジタル署名}}は一つの固定された計算方法の名前ではなく、署名者だけが使える秘密鍵で署名を生成し、対応する公開鍵で検証する仕組みの総称です。RSA署名、ECDSA、EdDSAなど複数の方式があり、内部の計算手順は同じではありません。</p>
            <p>{{ハッシュ関数}}は、長さの異なる入力から一定長の{{ハッシュ値}}を計算します。ハッシュ値から元の本文を復元することが難しく、入力が少し変わると出力が大きく変わる性質を利用します。多くの署名方式では本文のハッシュ値を使って効率よく署名しますが、「ハッシュ値を秘密鍵で暗号化して、公開鍵で元へ戻す」とだけ説明できるのはRSAに寄ったモデルであり、デジタル署名全体の定義ではありません。</p>
            <figure class="raster-figure"><img src="../assets/lecture-v2/network/digital-signature.png?v=3" alt="署名者側を1から4まで左から右へ進み、受信者側では5から6と7へ分かれ、6の要約値Bと7で確認した署名側の要約値Aを8で比較して9の結果を得る流れ"><figcaption>受信側は、5→6と、届いた署名→7を別々に処理する。6で計算した要約値Bと7で確認した署名側の要約値Aを8で比較し、9で結果を示す。</figcaption></figure>
            <ol><li><strong>本文：</strong>署名の対象となる本文を用意します。</li><li><strong>ハッシュ関数：</strong>本文から要約値Aを計算します。</li><li><strong>署名生成：</strong>要約値Aと署名者の秘密鍵を署名生成アルゴリズムへ入力し、デジタル署名を作ります。</li><li><strong>送信：</strong>本文とデジタル署名を受信者へ送ります。</li><li><strong>受信した本文：</strong>受信者が、送られてきた本文を受け取ります。</li><li><strong>要約値Bを計算：</strong>受信した本文から同じハッシュ関数で要約値Bを計算します。</li><li><strong>署名側の要約値Aを確認：</strong>届いたデジタル署名を署名者の公開鍵で検証し、学習用のモデルでは署名側の要約値Aを取り出して確認します。</li><li><strong>AとBを比較：</strong>6で計算した要約値Bと、7で確認した要約値Aが一致するかを比較します。</li><li><strong>結果：</strong>一致すれば、署名後に本文が変わっておらず、対応する秘密鍵で署名されたと判断できます。一致しなければ無効です。公開鍵が本当に署名者のものかは、証明書など別の方法で確かめます。</li></ol>
            <p>検証に成功すれば、対応する秘密鍵によって署名が作られたことと、署名後に本文が変わっていないことを確認できます。ただし、秘密鍵が盗まれていないことや、公開鍵が本当に本人のものかは、署名の計算だけでは分かりません。公開鍵証明書、組織内の信頼できる配布、フィンガープリントの照合などが必要です。</p>
            <div class="table-wrap"><table class="lecture-table"><thead><tr><th>確認できること</th><th>確認できないこと</th></tr></thead><tbody><tr><td>署名後に本文が改ざんされていないこと（完全性）</td><td>本文を第三者に読まれないこと（機密性）</td></tr><tr><td>署名に使った秘密鍵の保有者に由来すること（真正性）</td><td>公開鍵が本当に本人のものか。これは証明書などで別に確認する</td></tr></tbody></table></div>
            <div class="warning"><strong>「秘密鍵で暗号化する」の単純な逆操作ではない</strong><p>学習上は鍵の向きを対比することがありますが、実際のデジタル署名は署名専用の方式・ハッシュ・書式を組み合わせます。暗号化と署名は目的も安全性の条件も別です。</p></div>`
        },
        {
          id: "network-integrity",
          short: "保全技術と安全対策",
          kicker: "WATERMARK · BLOCKCHAIN · ERROR DETECTION",
          title: "隠す・改ざんを見つける・転送誤りを見つけるを区別する",
          lead: "電子透かし、ブロックチェーン、誤り検出符号は、守る対象と目的が異なります。",
          html: `
            <p>この三つは順番に処理する技術でも、互いから派生した技術でもありません。{{電子透かし}}は著作物へ権利者情報などを埋め込む、{{ブロックチェーン}}は履歴のつながりと共有状態を検証しやすくする、{{誤り検出符号}}は通信・保存中の偶発的なビット誤りを見つける、という別々の目的をもちます。</p>
            <div class="concept-grid"><article class="concept-card"><h3>電子透かし</h3><p>画像・音声などへ権利者ID、配布先ID、真正性確認用情報などを、人が知覚しにくい形で埋め込みます。圧縮や加工後にも残る強さと、画質への影響のバランスが必要です。</p></article><article class="concept-card"><h3>ブロックチェーン</h3><p>各ブロックが前ブロックのハッシュを含むため、過去を書き換えると後続のつながりが崩れます。複数ノードで共有し、合意形成の規則に従って履歴を追加します。</p></article><article class="concept-card"><h3>誤り検出・訂正</h3><p>パリティやチェックディジットなどの検査情報を加え、通信・保存・入力中の偶発的な誤りを見つけます。検査情報を増やせば、誤った位置を特定して訂正できる方法もあります。</p></article><article class="concept-card"><h3>バックアップ</h3><p>情報を隠したり改ざんを検出したりする技術ではなく、障害・誤操作・ランサムウェアなどで失ったデータを復旧するための複製です。</p></article></div>
            <h3>例1：1ビットの偶数パリティで、誤りを検出する</h3>
            <p>偶数パリティでは、データとパリティビットを合わせた1の個数を偶数にします。データ0010101には1が3個あるので、パリティビット1を付けて00101011とします。もし通信中に1ビットだけ反転して00100011になれば、1の個数が3個という奇数になるため、受信側は誤りを検出できます。</p>
            <div class="warning"><strong>1ビットのパリティだけでは訂正できない</strong><p>どこかが誤ったことは分かっても、反転した位置は特定できません。また2ビットが反転すると1の個数は再び偶数になり、見逃す場合があります。</p></div>
            <h3>例2：水平・垂直パリティで、1ビットの位置を特定する</h3>
            <p>ビットを行列に並べ、各行と各列へ偶数パリティを付けます。受信後に2行目と3列目だけが不一致なら、その交点のビットが誤ったと推定でき、1ビットの誤りなら反転して訂正できます。</p>
            <div class="table-wrap"><table class="lecture-table parity-table"><thead><tr><th></th><th>1列</th><th>2列</th><th>3列</th><th>行パリティ</th></tr></thead><tbody><tr><th>1行</th><td>1</td><td>0</td><td>1</td><td>0</td></tr><tr class="parity-error-row"><th>2行</th><td>0</td><td>1</td><td class="parity-error-cell">0<br><small>本来は1</small></td><td>0<br><small>不一致</small></td></tr><tr><th>3行</th><td>1</td><td>1</td><td>0</td><td>0</td></tr><tr class="parity-footer"><th>列パリティ</th><td>0</td><td>0</td><td>0<br><small>不一致</small></td><td>0</td></tr></tbody></table></div>
            <details class="deep-dive"><summary><span class="deep-dive-label">さらに詳しく：</span>誤りを検出した後に再送するか、その場で訂正するか</summary><div class="deep-dive-body"><p>検査情報には、何を見つけたいかに応じて複数の方法があります。</p><div class="table-wrap"><table class="lecture-table"><thead><tr><th>方法</th><th>方法の考え方</th><th>できること・例</th></tr></thead><tbody><tr><td>パリティ</td><td>1の個数が偶数または奇数になるよう、1ビットを付け加える</td><td>少ない付加情報で一部のビット誤りを検出する</td></tr><tr><td>チェックディジット</td><td>番号の各桁へ決められた計算を行い、検査用の桁を付ける</td><td>ISBNやJANコードなどで、入力・読取り間違いを見つけやすくする</td></tr><tr><td>CRC</td><td>ビット列を決められた規則で割り、その余りを検査情報として付ける</td><td>ネットワークのフレームなどで、まとまって起こる誤りも検出しやすい</td></tr><tr><td>ハミング符号など</td><td>複数の検査ビットを配置し、不一致の組合せから誤り位置を求める</td><td>一定範囲の誤りなら、再送せず受信側で訂正できる</td></tr></tbody></table></div><p>双方向通信では、誤りだけを検出し、正しいデータをもう一度送ってもらう方法を選べます。一方、放送や遠距離通信のように再送しにくい場面では、あらかじめ多めの検査情報を付けて受信側で訂正する方法が役立ちます。訂正能力を高めるほど、送るデータ量と計算量も増えます。</p></div></details>
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
            <figure class="html-figure"><ol class="process-list public-data-process"><li><b>問いを決める</b><span>対象・地域・時点・比較軸を明確にする</span></li><li><b>統計を探す</b><span>e-Statで調査名や作成機関を確認する</span></li><li><b>表と条件を選ぶ</b><span>項目・地域・年次・単位を絞る</span></li><li><b>定義を読む</b><span>速報／確報、暦年／年度、注記を確認する</span></li><li><b>取得・整形する</b><span>欠測、合計行、地域コード、型を整える</span></li><li><b>分析する</b><span>比較可能な指標を計算し、可視化する</span></li><li><b>解釈を残す</b><span>出典・抽出条件・加工式・限界を記録する</span></li></ol><figcaption>結果だけでなく、同じ分析を再現できるように検索・抽出・加工・解釈の道筋を残す。</figcaption></figure>
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
