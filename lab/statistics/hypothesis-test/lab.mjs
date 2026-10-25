import { esc, number, table } from '../shared/ui.mjs?v=20261025-guided-test';
import { fmt } from '../shared/math.mjs';
import { academicExplanation } from '../shared/reading.mjs?v=20261025-guided-test';
import { participantScores, meanTest, meanTestPower } from './mean-model.mjs?v=20261025-guided-test';
import { aiFaceParticipants } from './data.mjs?v=20261025-guided-test';
import { downloadCSV } from '../data-editor.mjs?v=20261025-guided-test';
import { guideDefaults, normalizeGuide, testStages, errorStages, directionLabel, hypothesisText } from './guide.mjs?v=20261025-guided-test';
import { scoreBins, scoreHistogram, testChart, scaleChart, intervalChart, intervalText, planningChart } from './charts.mjs?v=20261025-guided-test';
const pct=(v,d=1)=>fmt(v*100,d)+'%';
const pText=v=>v<.000001?'0.000001未満':fmt(v,6);
const textField=(id,label,value,max=200)=>`<label class="control hyp-text" for="${id}"><span>${esc(label)}</span><input id="${id}" type="text" maxlength="${max}" value="${esc(value)}" ${id==='hyp-measure-label'?'required':''}></label>`;
const radios=(name,title,choices,value)=>`<fieldset class="hyp-radio"><legend>${esc(title)}</legend>${choices.map(([v,label])=>`<label><input type="radio" name="${name}" value="${esc(v)}" ${String(v)===String(value)?'checked':''}>${esc(label)}</label>`).join('')}</fieldset>`;
const alphaControl=s=>radios('hyp-alpha','有意水準α（棄却の基準）',[[.01,'1%'],[.05,'5%'],[.1,'10%']],s.alpha);
const outcome=(title,body)=>`<div class="hyp-outcome"><h3>${title}</h3>${body}</div>`;
const unavailable=test=>`<div class="hyp-outcome" id="hyp-unavailable"><h3>ここから先の計算に必要なばらつきがありません</h3><p>${esc(test.reason)} 平均は求められますが、標準誤差で割るt検定はできません。データや検定方法を見直します。</p><button type="button" id="hyp-open-data">データを確認する</button></div>`;
function rule(s) {
 const h=hypothesisText(s.reference,s.direction,s.measureLabel);
 return `<dl class="hyp-rule"><div><dt>帰無仮説 H₀</dt><dd>${esc(h.null)}</dd></div><div><dt>対立仮説 H₁</dt><dd>${esc(h.alternative)}</dd></div><div><dt>判断基準</dt><dd>有意水準 ${pct(s.alpha,0)}・${esc(directionLabel(s.direction))}</dd></div></dl>`;
}
function decisionText(s,test) {
 const relation=s.direction==='greater'?`基準${pct(s.reference,2)}を上回る`:s.direction==='less'?`基準${pct(s.reference,2)}を下回る`:`基準${pct(s.reference,2)}と異なる`;
 const claim=`平均${esc(s.measureLabel)}が${relation}`;
 return test.reject?`p値が有意水準${pct(s.alpha,0)}以下なので、帰無仮説を棄却します。${claim}ことを示す結果です。`
 :`p値が有意水準${pct(s.alpha,0)}を上回るので、帰無仮説を棄却しません。${claim}という十分な証拠は得られません。`;
}
function wizard(s,isErrors,body,takeaway) {
 const steps=isErrors?errorStages:testStages,index=isErrors?s.errorStep:s.testStep;
 const next=steps[index+1];
 const check=meanTest(participantScores(s.participants),s.reference,s.alpha,s.direction);
 const blocked=isErrors?!(s.sigmaMode==='custom'?s.planningSD>0:check.sd>0):index>=3&&!check.valid;
 return `<section class="panel chart-panel hyp-guide ${isErrors?'hyp-errors':'hyp-test'}" data-hyp-journey="${isErrors?'errors':'test'}" data-hyp-step="${index}"><p class="hyp-step-count">${isErrors?'判断の誤り':'仮説検定を行う'} · ${index+1} / ${steps.length}</p><ol class="hyp-progress" aria-label="学習の手順">${steps.map((label,i)=>`<li ${i===index?'aria-current="step"':''} class="${i<index?'is-complete':''}" title="${esc(label)}"><span>${i+1}</span><small>${esc(label)}</small></li>`).join('')}</ol><h2 id="hyp-step-title" tabindex="-1">${index+1}. ${esc(steps[index])}</h2><div class="hyp-step-body">${body}</div><aside class="hyp-takeaway" data-screen-nav-section="この段階で分かったこと"><h3>この段階で分かったこと</h3><p>${takeaway}</p></aside><nav class="hyp-wizard-navigation" aria-label="この学習の前後の段階"><button id="hyp-prev" type="button" ${index===0?'disabled':''}>← 前へ</button><button id="hyp-next" class="primary" type="button" ${blocked?'disabled':''}>${next?`次へ：${esc(next)} →`:isErrors?'最初から見直す':'次へ：判断の誤り →'}</button></nav>${index>0?`<button class="hyp-restart" type="button" id="hyp-restart">${isErrors?'計画の設定':'最初の段階'}に戻る</button>`:''}<p id="hyp-setting-message" role="status" aria-live="polite"></p></section>`;
}
function testBody(s,scores,t) {
 const label=esc(s.measureLabel),n=t.n,h=s.participants[0],headers=s.dataInfo?.columns||['参加者番号','判定枚数','正答数'];
 const bin=scoreBins(scores,s.binWidth)[s.selectedBin];
 switch(s.testStep) {
 case 0:return {
  body:`<p class="hyp-action"><strong>確認すること：</strong>表の1行は1人です。各人の「${esc(headers[2])}÷${esc(headers[1])}」を、この人の${label}とします。</p>${table([headers[0],headers[1],headers[2],`${s.measureLabel}（計算した値）`],s.participants.slice(0,3).map(p=>[p.id,p.trials,p.correct,pct(p.correct/p.trials,2)]))}<p><strong>計算例：</strong>${esc(h.id)}さんは ${h.correct} ÷ ${h.trials} × 100 = <strong>${pct(h.correct/h.trials,2)}</strong>。この値が${fmt(n,0)}人分あります。</p><h3>ヒストグラムは、人数のまとまりを表す</h3><p>横軸は1人ごとの${label}、縦軸はその範囲に入る人数です。今は${s.binWidth}ポイントずつの幅にまとめています。棒が高いほど、その範囲の人が多いことが分かります。この集まり方を「分布」と呼びます。</p>${radios('hyp-bin-width','まとめる幅',[[5,'5ポイント'],[10,'10ポイント'],[20,'20ポイント']],s.binWidth)}${scoreHistogram(scores,{width:s.binWidth,selected:s.selectedBin,label:s.measureLabel})}<p id="hyp-bin-reading" role="status">${bin?`${bin.lo}%以上${bin.hi}%${bin.last?'以下':'未満'}の人は<strong>${bin.count}人</strong>です。`:'棒をクリックするか、Tabで選んでEnterを押すと、その範囲の人数を確認できます。'}</p><p>これは<strong>1人ごとの値の分布</strong>です。後で扱う「平均のずれの分布」とは区別します。1人が何枚も答えていても、独立した人が増えたとは数えません。</p><details class="hyp-details"><summary>自分のデータに合わせる</summary>${textField('hyp-measure-label','測っている割合の名前（正答率・成功率など）',s.measureLabel,40)}<p>データの変更は「データ」タブで行います。ここでは1人ごとの割合の名前を変更できます。</p></details>`,
  takeaway:`1人を1つの観測として、${fmt(n,0)}人の${label}の分布を確認しました。次は、何を基準に、どの違いを調べるかを決めます。`};
 case 1:{const hypo=hypothesisText(s.reference,s.direction,s.measureLabel);return {
  body:`<p class="hyp-action"><strong>決めること：</strong>比較する基準と、調べたい違いの方向を決めます。</p><h3>教材の顔判定実験で50%を基準にする理由</h3><p>答えは「本物」「AI生成」の2択です。2つから無作為に1つ選ぶと、正解を選ぶ確率は <strong>1 ÷ 2 = 50%</strong>。これを当てずっぽうの基準にします。</p><div class="hyp-chance-example" aria-label="無作為な2択では正解と不正解がそれぞれ2分の1"><span>正解を選ぶ<br><strong>1/2</strong></span><span>不正解を選ぶ<br><strong>1/2</strong></span></div><p>自分の調査では、3択なら1/3、4択なら1/4、目標値との比較ならその目標など、問いに合う基準を使います。</p><div class="hyp-controls">${number('hyp-reference','この検定で使う基準（%）',Number((s.reference*100).toFixed(8)),.000001,99.999999,'any')}</div><div class="actions hyp-presets"><button type="button" data-hyp-reference="0.5">2択の例：50%</button><button type="button" data-hyp-reference="0.3333333333333333">3択の例：1/3</button><button type="button" data-hyp-reference="0.25">4択の例：25%</button></div>${textField('hyp-reference-reason','基準をこの値にする理由（自分の調査用・任意）',s.referenceReason)}${radios('hyp-direction','何を調べる？',[['two-sided','基準と違うか（両側）'],['greater','基準を上回るか（右片側）'],['less','基準を下回るか（左片側）']],s.direction)}<h3>2つの仮説を言葉にする</h3><p><strong>帰無仮説：</strong>まず「基準どおり」と仮定する考え方です。<br><strong>対立仮説：</strong>今回調べたい違いを表す考え方です。</p><dl class="hyp-rule"><div><dt>帰無仮説 H₀</dt><dd>${esc(hypo.null)}</dd></div><div><dt>対立仮説 H₁</dt><dd>${esc(hypo.alternative)}</dd></div></dl>${s.direction!=='two-sided'?'<p>片側検定では、帰無仮説の境界である「平均が基準と同じ場合」を使って確率を計算します。</p>':''}${s.reference!==.5?'<p class="hint">元の顔判定は2択です。今は基準を変更した別の問いで比較しています。</p>':''}<p class="hint">方向は結果を見る前に選びます。結果を見てから両側・片側や基準を変えると、最初の検定とは別の比較になります。</p>`,
  takeaway:`基準を${pct(s.reference,4)}とし、「${esc(directionLabel(s.direction))}」を調べる問いを決めました。${s.referenceReason?`理由：${esc(s.referenceReason)}`:'基準の根拠と、調べたい違いが対応しているかを確認しましょう。'}`};}
 case 2:return {
  body:`<p class="hyp-action"><strong>決めること：</strong>偶然では起こりにくい結果を、どこから「棄却する」と判断するかを決めます。</p>${rule(s)}<h3>有意水準は、先に決める判断基準</h3><p>「帰無仮説が正しい」としたときに、起こりにくい側の結果を棄却域にします。有意水準5%なら、平均が基準と同じ場合に、この方法で棄却する確率が5%になるように決めます。基準どおりでも、ときには棄却してしまいます。</p><div class="hyp-controls">${alphaControl(s)}</div><h3>使う方法：1標本t検定</h3><p>1人ごとの割合を使い、標本の平均が基準からどれほどずれたかを調べます。人ごとのばらつきと人数を考慮し、平均のずれを<strong>t</strong>という値に直して比べます。実際の計算は次の段階から行います。</p><details class="hyp-details"><summary>この方法を使う前提を確認する</summary><p>参加者間が独立であることを仮定します。1人ごとの値が正規分布なら厳密なt検定で、今回の離散的な割合には、人数が多い場合の近似として使います。${n<30?'今の標本は少人数です。値の分布を十分に確認し、このt近似を使えるか慎重に判断する必要があります。':''}</p><p>同じ人の繰り返し測定や、関連する2群の比較は、この1標本の形式にまとめません。割合0%・100%を基準にする検定も、このt近似の設定には含めていません。</p></details><p class="hint">教材では公開済みの研究を使って手順をたどっています。新しく検証するときは、結果を見る前に問い・方向・有意水準・方法を決めます。</p>`,
  takeaway:`「${esc(directionLabel(s.direction))}・有意水準${pct(s.alpha,0)}・1標本t検定」というルールが決まりました。ここから、このルールを保って観測結果を計算します。`};
 case 3:{return {
  body:`<p class="hyp-action"><strong>計算すること：</strong>1人ごとの割合を平均し、ばらつきも求めます。</p><h3>標本平均：今回調べた人たちの平均</h3><p>各人の${label}を%で表した数値を足し、人数${fmt(n,0)}で割ります。これを<strong>標本平均</strong>と呼び、同じ条件の人たち全体の平均（母平均）を推測する材料にします。</p><p class="hyp-equation">(${fmt(scores[0]*100,4)} ＋ ${fmt(scores[1]*100,4)} ＋ …) ÷ ${fmt(n,0)}<br>= <strong>${pct(t.mean,4)}</strong></p><p>判定枚数が人ごとに違う場合も、ここでは各人の割合を同じ重みで平均します。全回答をまとめた「合計の正答数÷合計の判定数」とは一致しない場合があります。</p>${scoreHistogram(scores,{width:s.binWidth,selected:s.selectedBin,mean:t.mean,reference:s.reference,label:s.measureLabel})}<h3>標準偏差：1人ごとの値の散らばり</h3><p>平均の周りに、人ごとの値がどれくらい散らばっているかを表す値が<strong>標準偏差</strong>です。この標本の標準偏差sは<strong>${fmt(t.sd*100,4)}ポイント</strong>です。</p><details class="hyp-details"><summary>標本標準偏差の計算</summary><p>各人の割合から標本平均を引き、その差を二乗して足します。人数n−1で割り、平方根を取ります。s = √{Σ(xᵢ−x̄)² ÷ (n−1)}。</p><p>元の割合を0〜1として計算し、表示では100倍してポイントに直しています。</p></details>${!t.valid?unavailable(t):''}`,
  takeaway:`標本平均は${pct(t.mean,2)}、基準との差は${fmt(t.difference*100,2)}ポイントでした。まだ、この差が偶然のばらつきとして大きいかどうかは判断していません。`};}
 case 4:return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>計算すること：</strong>平均との差を、「平均が揺れる大きさ」を単位にして表します。</p><h3>標準誤差：標本平均の揺れの大きさ</h3><p>同じ人数を別に調べると、標本平均も少しずつ変わります。その揺れの大きさを推定するのが<strong>標準誤差</strong>です。1人ごとの散らばりを表す標準偏差とは区別します。独立した観測なら、平均のばらつきは人数の平方根に反比例して小さくなります。母標準偏差が未知なので、今回は標本標準偏差sを使って推定します。</p><p class="hyp-equation">標準誤差 SE = s ÷ √n<br>${fmt(t.sd*100,4)} ÷ √${fmt(n,0)} = <strong>${fmt(t.se*100,4)}ポイント</strong></p>${scaleChart(t,s.measureLabel)}<h3>t：今回の差は、標準誤差の何個分？</h3><p class="hyp-equation">t = (標本平均 − 基準) ÷ 標準誤差<br>(${pct(t.mean,4)} − ${pct(s.reference,4)}) ÷ ${fmt(t.se*100,4)}ポイント = <strong>${fmt(t.t,4)}</strong></p><p>${t.t===0?'今回はt=0で、標本平均と基準が一致しています。':`符号が${t.t<0?'負':'正'}なので、今回は基準${pct(s.reference,2)}より${t.t<0?'低い':'高い'}側のずれです。`}0なら差がなく、絶対値が大きいほど、標準誤差に比べて大きく離れています。</p>`,takeaway:t.valid?`平均との差をt=${fmt(t.t,4)}と表せました。次に、帰無仮説が正しい場合にこのようなtがどれくらい起こるかを調べます。`:'ばらつきを推定できないため、tを計算できません。'};
 case 5:return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>仮定して計算すること：</strong>帰無仮説が正しい場合のtの分布を使い、今回以上のずれの確率を求めます。</p><h3>「平均が基準${pct(s.reference,2)}」でも、毎回ぴったり同じ平均にはならない</h3><p>同じ条件で${fmt(n,0)}人ずつ何度も調べると、標本平均や標準誤差は毎回変わり、tも変わります。帰無仮説とt検定の前提のもとで、そのtの起こり方を<strong>t分布</strong>という曲線で表します。これを今回使う<strong>帰無分布</strong>と呼びます。曲線の高さそのものが確率なのではなく、ある範囲の曲線の下の面積が、その範囲のtが出る確率を表します。</p><p>横軸0は「標本平均と基準が同じ」、横軸±1は「標準誤差1つ分のずれ」です。最初のヒストグラムは1人ごとの値の人数、この曲線は<strong>調査を繰り返したときのtの確率</strong>を表します。</p>${testChart(t,{label:s.measureLabel})}<h3>p値：選んだ方向で、今回以上にずれる確率</h3><p>${s.direction==='two-sided'?'両側検定なので、左右両方で今回と同じ大きさか、それ以上に離れた範囲を合計します。':s.direction==='greater'?'右片側検定なので、今回のt以上になる右側の範囲を使います。':'左片側検定なので、今回のt以下になる左側の範囲を使います。'} 橙の斜線の面積がp値です。</p>${s.direction==='greater'&&t.t<0?'<p>今回は基準より低い側の結果です。「上回る」という問いとは逆の向きなので、右側の確率は大きくなります。</p>':s.direction==='less'&&t.t>0?'<p>今回は基準より高い側の結果です。「下回る」という問いとは逆の向きなので、左側の確率は大きくなります。</p>':''}<p class="hyp-p-value">${s.direction==='two-sided'?'両側':'片側'}p値：<strong id="hyp-p-value" data-p-value="${t.pValue}">${pText(t.pValue)}</strong>（${t.pValue<.00001?'0.001%未満':pct(t.pValue,4)}）</p><p>p値は、帰無仮説を仮定して得られる確率です。「帰無仮説が正しい確率」や「この差が偶然である確率」ではありません。</p><details class="hyp-details"><summary>数式と分布の形を確認する</summary><p>自由度はn−1=${t.df}です。${s.direction==='two-sided'?`P(|T| ≥ ${fmt(Math.abs(t.t),4)})`:s.direction==='greater'?`P(T ≥ ${fmt(t.t,4)})`:`P(T ≤ ${fmt(t.t,4)})`}をt分布から求めます。自由度はt分布の形を決める値です。乱数による近似ではなく、図の外側まで含めて確率を計算しています。</p></details>`,takeaway:t.valid?`帰無仮説を仮定したときの、選んだ方向で今回以上にずれる確率はp=${pText(t.pValue)}でした。次は、先に決めた有意水準と比べます。`:'このデータではp値を計算できません。'};
 case 6:return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>判断すること：</strong>計算したp値と、先に決めた有意水準を比べます。</p>${rule(s)}<div class="hyp-decision-rule"><p><strong>ルール：</strong>p値 ≤ 有意水準α なら、帰無仮説を棄却する。</p><p class="hyp-equation">p = ${pText(t.pValue)}（${pct(t.pValue,4)}）<br>${t.reject?'≤':'>'} α = ${s.alpha}（${pct(s.alpha,0)}）</p><p id="hyp-decision">${decisionText(s,t)}</p></div>${testChart(t,{showDecision:true,label:s.measureLabel})}<p>紫の帯は、先に決めたルールで棄却する範囲（棄却域）です。今回のtがこの範囲に入るかを見る方法と、p値をαと比べる方法は同じ判断になります。</p><p>${t.reject?'棄却しても、差が大きい・実用的・原因が判明した、とまではいえません。':'棄却しないことは、帰無仮説が正しいという証明ではありません。'} 統計的な判断と、実際の意味を分けて考えます。</p>`,takeaway:t.valid?(t.reject?'決めたルールに従って帰無仮説を棄却しました。':'決めたルールでは帰無仮説を棄却しませんでした。')+'最後に、もとの問いに戻って差の方向と大きさを読みます。':'このデータでは棄却の判断をしません。'};
 case 7:{const face=s.measureLabel==='正答率'&&s.reference===.5&&!s.dataInfo?.publicDerived&&s.dataInfo?.publicDataset?.links?.some(([,href])=>href.includes('2120481119'));return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>解釈すること：</strong>何が言えて、何までは言えないかを、もとの問いの言葉で表します。</p><p id="hyp-interpretation">今回の標本平均は<strong>${pct(t.mean,2)}</strong>で、基準${pct(s.reference,2)}との差は<strong>${fmt(t.difference*100,2)}ポイント</strong>です。${decisionText(s,t)}</p>${face&&t.difference<0&&t.reject?'<div class="hyp-outcome"><h3>この顔判定実験では</h3><p>観測された差は50%を下回る方向です。帰無仮説を棄却できても、「当てずっぽうよりよく見分けられた」という結果にはなりません。差の有無だけでなく、向きも読む必要があります。</p></div>':'<p>統計的に基準との差を示せても、その差が実際の目的に十分かどうかは別に考えます。必要な精度や、対象・調査方法も確認します。</p>'}<h3>補足：母平均の範囲を示す信頼区間</h3>${intervalChart(t,s.measureLabel)}<p>${s.direction==='two-sided'?'両側':'片側'}${pct(1-s.alpha,0)}信頼区間は<strong>${intervalText(t)}</strong>です。検定の方向と有意水準に対応した区間を示しています。</p><p class="hint">${pct(1-s.alpha,0)}%は、同じ条件で調査と区間の計算を繰り返したとき、その割合の区間が母平均を含むという意味です。この1本の区間に母平均が入っている確率を表すものではありません。</p><h3>解釈できる範囲を確認する</h3><p>教材の元の研究は、特定の顔画像群とオンライン参加者による実験です。日本の高校生や現在のSNSの画像全般の精度を、そのまま表すものではありません。自分の調査でも、誰をどのように調べたかに立ち戻ります。</p><p>次は、同じルールでも誤った判断や見逃しが起こる理由を、真の平均を仮定できるモデルで確かめます。</p>`,takeaway:'仮説・有意水準・方法を決め、計算、判断、解釈までたどりました。結果を見て条件を選び直す場合は、別の比較として扱い、新たなデータでの確認も考えます。'};}
 }
}
function planControls(s,t,withAlpha=false) {
 const sigma=s.sigmaMode==='custom'?s.planningSD:t.sd;
 return `<div class="hyp-controls">${number('plan-n','これから調べる人数（人）',s.planN,30,1000,1)}${withAlpha?alphaControl(s):''}</div><details class="hyp-details" ${s.sigmaMode==='custom'?'open':''}><summary>計画に使うばらつきを設定する</summary>${radios('hyp-sigma-mode','1人ごとの値の標準偏差',[['data',`今回の標本の値を使う（${fmt(t.sd*100,2)}ポイント）`],['custom','別の値を仮定する']],s.sigmaMode)}${s.sigmaMode==='custom'?number('hyp-planning-sd','仮定する標準偏差（ポイント）',Number((s.planningSD*100).toFixed(6)),.000001,100,'any'):''}<p>ここでは母標準偏差を${fmt(sigma*100,2)}ポイントと仮定します。未知の母標準偏差が、この値だと確定したわけではありません。</p></details>`;
}
const alternativeControl=s=>`<div class="hyp-controls">${number('true-rate',`仮定する本当の平均${s.measureLabel}（%）`,Number((s.trueMean*100).toFixed(8)),0,100,'any')}</div><div class="actions"><button id="hyp-alternative-example" type="button">対立仮説側の例を使う</button><button id="hyp-use-observed-mean" type="button">今回の標本平均を仮に使う</button></div>`;
function errorsMatrix(s,plan) {
 const alternativeRow=plan.hasAlternative?
  [`本当は対立仮説の側（平均${pct(plan.trueMean,2)}）`,`違いを捉える：${pct(plan.detected,2)}（検出力）`,`違いを見逃す：${pct(plan.missed,2)}（第2種の誤り）`]:
  [`この平均も帰無仮説の側（${pct(plan.trueMean,2)}）`,`誤って棄却：${pct(plan.detected,2)}`,`棄却しない：${pct(plan.missed,2)}`];
 return table(['実際の状態（ここでは仮定）','帰無仮説を棄却する','帰無仮説を棄却しない'],[
  [`本当は帰無仮説の境界（平均${pct(s.reference,2)}）`,`誤って棄却：${pct(s.alpha,2)}（第1種の誤り）`,`棄却しない：${pct(1-s.alpha,2)}`],
  ...(plan.trueMean!==s.reference?[alternativeRow]:[]),
 ]);
}
function errorBody(s,t) {
 const sigma=s.sigmaMode==='custom'?s.planningSD:t.sd;
 const plan=sigma>0?meanTestPower(s.planN,s.trueMean,sigma,s.alpha,s.reference,s.direction):null;
 const ruleText=`平均の基準${pct(s.reference,2)}、${esc(directionLabel(s.direction))}、有意水準${pct(s.alpha,0)}`;
 if(s.errorStep===0)return {
  body:`<p class="hyp-action"><strong>決めること：</strong>これから調べる人数と、判断に使うルールを確認します。真の平均を仮定できるモデルで、判断を誤る場合を調べます。</p>${rule(s)}<p>これから${fmt(s.planN,0)}人を調べる計画です。「データ」タブの${fmt(t.n,0)}人の観測結果は変更しません。</p>${planControls(s,t)}<h3>ここでは「本当の状態」を仮定できる</h3><p>実際の調査では、真の平均が基準どおりかは分かりません。ここでは学習のため、①本当は基準どおりの世界、②本当は違いがある世界を分けて考えます。両方に<strong>同じ検定のルール</strong>を使います。</p><p class="hint">モデルでは、1人ごとの割合を独立な正規分布で近似し、仮定した母標準偏差を使います。割合が0〜100%に収まる性質まで厳密に再現するモデルではありません。</p>${!plan?'<div class="hyp-outcome"><p>今回の標本からはばらつきを推定できません。計画例を試すには「別の値を仮定する」で、正の標準偏差を設定します。</p></div>':''}`,
  takeaway:`計画人数とばらつきの仮定を確認しました。ルールは${ruleText}です。まず、本当は基準どおりでも棄却される場合を見ます。`};
 if(!plan)return {body:'<p>計画に使う正の標準偏差が必要です。前へ戻り、計画の設定を確認してください。</p>',takeaway:'この条件では計画の分布を計算できません。'};
 switch(s.errorStep) {
 case 1:{const boundary={...plan,trueMean:s.reference,delta:0,hasAlternative:false};return {
  body:`<p class="hyp-action"><strong>仮定する状態：</strong>本当の平均は、基準${pct(s.reference,2)}と同じです。帰無仮説が正しい場合を考えます。</p><h3>基準どおりでも、標本には偶然のずれがある</h3><p>${fmt(s.planN,0)}人ずつの調査を繰り返すと、tは緑の曲線のようにばらつきます。紫の棄却域にたまたま入る結果もあります。</p>${planningChart(boundary,{world:'null',shade:'false-positive',label:s.measureLabel})}<div class="hyp-outcome"><h3>第1種の誤り：帰無仮説が正しいのに棄却する</h3><p>本当は基準どおりなのに「違いがある」と判断してしまう誤りです。橙の斜線の面積が、このモデルでの誤判定率です。</p><p><strong>この境界での誤判定率＝有意水準${pct(s.alpha,0)}</strong>。同じ条件の調査を100回繰り返すなら、平均して約${fmt(s.alpha*100,0)}回はこの誤りが起こる、という意味です。</p></div><p>${s.direction==='two-sided'?'':'片側検定では、帰無仮説の境界で有意水準に等しく、帰無仮説の内側での誤判定率はそれ以下になります。'}${pct(s.alpha,0)}は「今回の結論が間違っている確率」ではありません。</p>`,
  takeaway:'帰無仮説が正しくても、偶然の大きなずれで棄却することがあります。有意水準は、この繰り返しでの誤判定を制御するために先に決めます。'};}
 case 2:return {
  body:`<p class="hyp-action"><strong>仮定する状態：</strong>今度は、本当の平均を変えてみます。棄却域は先ほどと同じままです。</p>${alternativeControl(s)}<p>ここで入力する値は<strong>真の平均の仮定</strong>です。今回の標本平均を使うボタンも、仮定を置くためのもので、本当の平均が判明したことにはなりません。</p>${planningChart(plan,{world:'alternative',shade:'missed',label:s.measureLabel})}${plan.hasAlternative?`<div class="hyp-outcome"><h3>第2種の誤り：本当は違いがあるのに棄却しない</h3><p>本当は平均${pct(plan.trueMean,2)}で、選んだ対立仮説の側にあるのに、標本の結果が棄却域に入らず、違いを見逃す場合です。橙の斜線がその確率です。</p><p id="hyp-plan-interpretation"><strong>見逃す確率β＝${pct(plan.missed,2)}</strong>。反対に、違いを捉える確率1−β＝${pct(plan.detected,2)}を<strong>検出力</strong>と呼びます。</p></div>`:`<div class="hyp-outcome" id="hyp-plan-interpretation"><h3>今の平均は、対立仮説の側にありません</h3><p>${plan.trueMean===s.reference?'仮定した平均が基準と同じなので、帰無仮説の側です。':'仮定した平均が選んだ片側とは反対側なので、帰無仮説の範囲にあります。'}この設定の棄却率${pct(plan.detected,2)}を「検出力」、棄却しない確率を「第2種の誤り」とは呼びません。「対立仮説側の例を使う」で見逃しを確認できます。</p></div>`}<p class="hint">平均が0%・100%付近の場合や、標準偏差を大きく仮定した場合は、正規分布で割合を近似する仮定が特に現実と合わなくなります。計画値を実際の成功率と同一視しません。</p>`,
  takeaway:plan.hasAlternative?'本当は違いがあっても、棄却しない場合があります。その確率が第2種の誤り、違いを捉える確率が検出力です。':'第2種の誤りを調べるには、仮定する平均が対立仮説の側にある必要があります。'};
 case 3:return {
  body:`<p class="hyp-action"><strong>整理すること：</strong>実際の状態と、検定の判断を掛け合わせて考えます。</p>${planningChart(plan,{world:'both',shade:'missed',label:s.measureLabel})}${errorsMatrix(s,plan)}<p>第1種の誤りと第2種の誤りは、<strong>本当の状態が異なる場合の確率</strong>です。この2つを足して「今回の判断が間違っている確率」にすることはできません。</p><p>実際のデータで帰無仮説を棄却しなかったとき、それが「本当に基準どおり」なのか「違いを見逃した」のかは、結果だけでは分かりません。だから、棄却しないことは帰無仮説の証明にはなりません。</p>`,
  takeaway:'同じ判断でも、本当の状態によって意味が変わります。真の状態を仮定できるモデルを使うと、誤判定と見逃しを分けて計算できます。'};
 case 4:{const otherN=s.planN<=500?s.planN*2:Math.max(30,Math.floor(s.planN/2)),other=meanTestPower(otherN,s.trueMean,sigma,s.alpha,s.reference,s.direction);return {
  body:`<p class="hyp-action"><strong>比較すること：</strong>人数と有意水準を変えると、2つの誤りがどう変わるかを確かめます。</p>${planControls(s,t,true)}${alternativeControl(s)}<p class="hint">ここで有意水準を変える操作は、新しい計画同士の比較です。「仮説検定を行う」の観測結果についても、変更後の有意水準を使う場合は、その設定段階から確認し直します。</p>${planningChart(plan,{world:'both',shade:'missed',label:s.measureLabel})}${table(['計画人数','帰無仮説の境界で誤って棄却','仮定した平均で棄却','仮定した平均で棄却しない'],[[`${s.planN}人`,pct(s.alpha,2),`${pct(plan.detected,2)}${plan.hasAlternative?'（検出力）':''}`,`${pct(plan.missed,2)}${plan.hasAlternative?'（見逃し）':''}`],[`${otherN}人（比較）`,pct(s.alpha,2),pct(other.detected,2),pct(other.missed,2)]])}<div class="hyp-outcome"><h3>どちらの誤りを、何で減らす？</h3><p>対立仮説側に一定の差があるとき、人数を増やすと、同じ有意水準でも違いを捉えやすくなります。有意水準を小さくすると第1種の誤りを減らせますが、同じ人数では見逃しが増えます。</p><p>${plan.hasAlternative?`今の計画では、平均${pct(plan.trueMean,2)}を仮定したときの検出力は${pct(plan.detected,2)}です。`:'今は帰無仮説側の平均を仮定しているため、棄却率を検出力とは表示していません。'}</p></div><details class="hyp-details"><summary>計画モデルの数式と限界</summary><p>1人ごとの割合を独立な正規分布で近似し、母標準偏差を${fmt(sigma*100,4)}ポイントに固定します。標本のt検定と同じ方法で棄却域を決め、帰無仮説側ではt分布、平均を変えた場合は非心t分布から確率を計算します。</p><p>モデルの誤り率は、参加者の選び方の偏り、測定の誤り、画像の共有、正規近似のずれまでを含むものではありません。実際の調査では、検定の計算以外の設計も確認します。</p></details>`,
  takeaway:'人数を増やす操作と、有意水準を小さくする操作は、別のことを変えています。誤判定・見逃し・必要な精度を考え、調査の前に計画を立てます。'};}
 }
}
function wire(root,ctx,s,isErrors) {
 root.querySelectorAll('input[type=number]').forEach(el=>{el.required=true;});
 const key=isErrors?'errorStep':'testStep',steps=isErrors?errorStages:testStages;
 const move=index=>{
  ctx.update({[key]:index});
  const title=root.querySelector('#hyp-step-title');title?.focus({preventScroll:true});
  const pane=root.querySelector('.hypothesis-test-display');if(pane)pane.scrollTop=0;
  if(!pane?.closest('.statistics-fullscreen')&&title?.getBoundingClientRect().top<0)title.scrollIntoView({block:'start',behavior:'smooth'});
 };
 root.querySelector('#hyp-prev')?.addEventListener('click',()=>move(Math.max(0,s[key]-1)));
 root.querySelector('#hyp-next')?.addEventListener('click',()=>{
  const invalid=[...root.querySelectorAll('input')].find(el=>!el.checkValidity());
  if(invalid){invalid.reportValidity();return;}
  if(s[key]<steps.length-1)move(s[key]+1);
  else if(isErrors)move(0);
  else {ctx.update({errorStep:0});document.querySelector('#view-1')?.click();root.querySelector('#hyp-step-title')?.focus({preventScroll:true});}
 });
 root.querySelector('#hyp-restart')?.addEventListener('click',()=>move(0));
 root.querySelector('#hyp-open-data')?.addEventListener('click',()=>document.querySelector('#data-tab')?.click());
 const settings=(patch,stage)=>ctx.update({...patch,testStep:Math.min(s.testStep,stage),errorStep:0});
 root.querySelector('#hyp-reference')?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())settings({reference:Number(e.target.value)/100},1);});
 root.querySelectorAll('[data-hyp-reference]').forEach(el=>el.addEventListener('click',()=>settings({reference:Number(el.dataset.hypReference)},1)));
 root.querySelectorAll('[name="hyp-direction"]').forEach(el=>el.addEventListener('change',()=>settings({direction:el.value},1)));
 root.querySelector('#hyp-measure-label')?.addEventListener('change',e=>{if(e.target.value.trim()&&e.target.checkValidity())settings({measureLabel:e.target.value.trim()},0);});
 root.querySelector('#hyp-reference-reason')?.addEventListener('change',e=>{if(e.target.checkValidity())ctx.update({referenceReason:e.target.value});});
 root.querySelectorAll('[name="hyp-alpha"]').forEach(el=>el.addEventListener('change',()=>ctx.update({alpha:Number(el.value),testStep:Math.min(s.testStep,2),...(!isErrors?{errorStep:0}:{})})));
 root.querySelectorAll('[name="hyp-bin-width"]').forEach(el=>el.addEventListener('change',()=>ctx.update({binWidth:Number(el.value),selectedBin:-1})));
 root.querySelectorAll('[data-hyp-bin]').forEach(el=>{
  const choose=()=>ctx.update({selectedBin:Number(el.dataset.hypBin)});
  el.addEventListener('click',choose);el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});
 });
 for(const [id,field,scale] of [['plan-n','planN',1],['true-rate','trueMean',100],['hyp-planning-sd','planningSD',100]])root.querySelector('#'+id)?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())ctx.update({[field]:Number(e.target.value)/scale});});
 root.querySelectorAll('[name="hyp-sigma-mode"]').forEach(el=>el.addEventListener('change',()=>{
  const t=meanTest(participantScores(s.participants),s.reference,s.alpha,s.direction);ctx.update({sigmaMode:el.value,...(el.value==='custom'?{planningSD:t.sd||.1}:{})});
 }));
 root.querySelector('#hyp-use-observed-mean')?.addEventListener('click',()=>ctx.update({trueMean:meanTest(participantScores(s.participants)).mean}));
 root.querySelector('#hyp-alternative-example')?.addEventListener('click',()=>{
  const step=Math.min(.02,s.reference/2,(1-s.reference)/2);ctx.update({trueMean:s.reference+(s.direction==='greater'?step:-step)});
 });
}
export default {
 id:'hypothesis-test',title:'統計的な判断と仮説検定',
 description:'データの読み取りから仮説・計算・判断・解釈まで、1つずつ進める。',
 initial:()=>({...guideDefaults,participants:aiFaceParticipants(),alpha:.05,planN:315,trueMean:.48152281746031744}),
 normalize:normalizeGuide,guidedFlow:true,
 related:['sampling','crosstab'],explanation:academicExplanation('hypothesis-test'),
  renderDataExtras(root) {
    for(const version of ['v1','v2']) {
      let old;try{old=JSON.parse(localStorage.getItem(`study-atlas-statistics-hypothesis-test-${version}`));}catch{}
      if(old?.state?.dataInfo?.origin!=='user')continue;
      const s=old.state,isTwo=version==='v1';
      if(!(isTwo?[s.nA,s.nB,s.successA,s.successB]:[s.n,s.success]).every(Number.isFinite))continue;
      const box=document.createElement('details'),id=isTwo?'hyp-old-csv':'hyp-previous-count-csv';
      box.className='panel';box.innerHTML=`<summary>以前の${isTwo?'2群':'個数集計'}の保存データ</summary><p>以前読み込んだデータはCSVで取り出せます。現在の参加者ごとの正答率には読み替えません。</p><button id="${id}" type="button">以前のデータをCSVで保存</button>`;
      root.append(box);box.querySelector('button').onclick=()=>downloadCSV(`以前の${isTwo?'2群':'個数集計'}データ.csv`,s.dataInfo.columns||['対象','総数','該当数'],isTwo?[[s.groupLabels?.[0]||'A',s.nA,s.successA],[s.groupLabels?.[1]||'B',s.nB,s.successB]]:[[s.label||'対象',s.n,s.success]]);
    }
  },
 render(root,ctx) {
  const s=normalizeGuide(ctx.state),scores=participantScores(s.participants),t=meanTest(scores,s.reference,s.alpha,s.direction),isErrors=(ctx.view||0)===1;
  const content=isErrors?errorBody(s,t):testBody(s,scores,t);
  root.innerHTML=wizard(s,isErrors,content.body,content.takeaway);
  wire(root,ctx,s,isErrors);
 }
};
