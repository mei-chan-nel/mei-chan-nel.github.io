import { esc, number, table } from '../shared/ui.mjs?v=20261025-clear-test';
import { fmt } from '../shared/math.mjs';
import { academicExplanation } from '../shared/reading.mjs?v=20261025-clear-test';
import { participantScores, meanTest, meanTestPower } from './mean-model.mjs?v=20261025-clear-test';
import { aiFaceParticipants } from './data.mjs?v=20261025-clear-test';
import { downloadCSV } from '../data-editor.mjs?v=20261025-clear-test';
import { guideDefaults, normalizeGuide, testStages, errorStages, directionLabel, hypothesisText, rateText } from './guide.mjs?v=20261025-clear-test';
import { scoreBins, scoreHistogram, testChart, scaleChart, intervalChart, intervalText } from './charts.mjs?v=20261025-clear-test';
const pct=(v,d=1)=>fmt(v*100,d)+'%';
const pText=v=>v<.000001?'0.000001未満':fmt(v,6);
const notes=(title,body)=>`<section class="hyp-explanation" data-screen-nav-section="${esc(title)}"><h3>${esc(title)}</h3>${body}</section>`;
const plot=body=>`<figure class="hyp-plot">${body}</figure>`;
const radios=(name,title,choices,value)=>`<fieldset class="hyp-radio"><legend>${esc(title)}</legend>${choices.map(([v,label])=>`<label><input type="radio" name="${name}" value="${esc(v)}" ${String(v)===String(value)?'checked':''}>${esc(label)}</label>`).join('')}</fieldset>`;
const alphaControl=s=>radios('hyp-alpha','有意水準α（棄却の基準）',[[.01,'1%'],[.05,'5%'],[.1,'10%']],s.alpha);
const outcome=(title,body)=>`<div class="hyp-outcome"><h3>${title}</h3>${body}</div>`;
const unavailable=test=>`<div class="hyp-outcome" id="hyp-unavailable"><h3>ここから先の計算に必要なばらつきがありません</h3><p>${esc(test.reason)} 平均は求められますが、標準誤差で割るt検定はできません。データや検定方法を見直します。</p><button type="button" id="hyp-open-data">データを確認する</button></div>`;
function rule(s) {
 const h=hypothesisText(s.reference,s.direction,s.measureLabel);
 return `<dl class="hyp-rule"><div><dt>帰無仮説 H₀</dt><dd>${esc(h.null)}</dd></div><div><dt>対立仮説 H₁</dt><dd>${esc(h.alternative)}</dd></div><div><dt>判断基準</dt><dd>有意水準 ${pct(s.alpha,0)}・${esc(directionLabel(s.direction))}</dd></div></dl>`;
}
function decisionText(s,test) {
 const relation=s.direction==='greater'?`基準${rateText(s.reference)}を上回る`:s.direction==='less'?`基準${rateText(s.reference)}を下回る`:`基準${rateText(s.reference)}と異なる`;
 const claim=`平均${esc(s.measureLabel)}が${relation}`;
 return test.reject?`p値が有意水準${pct(s.alpha,0)}以下なので、帰無仮説を棄却します。${claim}ことを示す結果です。`
 :`p値が有意水準${pct(s.alpha,0)}を上回るので、帰無仮説を棄却しません。${claim}という十分な証拠は得られません。`;
}
function wizard(s,isErrors,body,takeaway) {
 const steps=isErrors?errorStages:testStages,index=isErrors?s.errorStep:s.testStep;
 const next=steps[index+1];
 const check=meanTest(participantScores(s.participants),s.reference,s.alpha,s.direction);
 const blocked=!isErrors&&index>=3&&!check.valid;
 return `<section class="panel chart-panel hyp-guide ${isErrors?'hyp-errors':'hyp-test'}" data-hyp-journey="${isErrors?'errors':'test'}" data-hyp-step="${index}"><p class="hyp-step-count">${isErrors?'判断の誤り':'仮説検定を行う'} · ${index+1} / ${steps.length}</p><ol class="hyp-progress" aria-label="学習の手順">${steps.map((label,i)=>`<li class="${i===index?'is-current':i<index?'is-complete':''}"><button type="button" data-hyp-stage="${i}" ${i===index?'aria-current="step"':''} aria-label="${i+1}. ${esc(label)}"><span>${i+1}</span><small>${esc(label)}</small></button></li>`).join('')}</ol><h2 id="hyp-step-title" tabindex="-1">${index+1}. ${esc(steps[index])}</h2><div class="hyp-step-body">${body}</div><aside class="hyp-takeaway" data-screen-nav-section="この段階で分かったこと"><h3>この段階で分かったこと</h3><p>${takeaway}</p></aside><nav class="hyp-wizard-navigation" aria-label="この学習の前後の段階"><button id="hyp-prev" type="button" ${index===0?'disabled':''}>← 前へ</button>${index>0?'<button class="hyp-restart" type="button" id="hyp-restart">最初に戻る</button>':''}<button id="hyp-next" class="primary" type="button" ${blocked?'disabled':''}>${!isErrors&&index===5&&!s.probabilityReady?'次へ：確率を求める →':next?`次へ：${esc(next)} →`:isErrors?'最初から見直す':'次へ：判断の誤り →'}</button></nav><p id="hyp-setting-message" role="status" aria-live="polite"></p></section>`;
}
function testBody(s,scores,t) {
 const label=esc(s.measureLabel),n=t.n,h=s.participants[0],headers=s.dataInfo?.columns||['参加者番号','判定枚数','正答数'];
 const bin=scoreBins(scores,s.binWidth)[s.selectedBin];
 switch(s.testStep) {
 case 0:return {
  body:`<p class="hyp-action">横軸は1人ごとの${label}、棒の高さはその範囲に入る人数です。</p>${radios('hyp-bin-width','まとめる幅',[[5,'5ポイント'],[10,'10ポイント'],[20,'20ポイント']],s.binWidth)}${plot(scoreHistogram(scores,{width:s.binWidth,selected:s.selectedBin,label:s.measureLabel}))}<p id="hyp-bin-reading" role="status">${bin?`${bin.lo}%以上${bin.hi}%${bin.last?'以下':'未満'}の人は<strong>${bin.count}人</strong>です。`:'棒をクリックするか、Tabで選んでEnterを押すと、その範囲の人数を確認できます。'}</p>${notes('図の読み方',`<p>${fmt(n,0)}人の値を${s.binWidth}ポイントの幅でまとめています。棒が高いほど、その範囲の人が多いことが分かります。この集まり方を<strong>分布</strong>と呼びます。</p><p>これは<strong>1人ごとの値の分布</strong>です。後で扱う「平均のずれの分布」とは区別します。</p>`)}${notes('1人ごとの値はどう求める？',`<details class="hyp-details"><summary>表と計算例を見る</summary><p>表の1行は1人です。「${esc(headers[2])}÷${esc(headers[1])}」で、この人の${label}を求めます。</p>${table([headers[0],headers[1],headers[2],s.measureLabel],s.participants.slice(0,3).map(p=>[p.id,p.trials,p.correct,pct(p.correct/p.trials,2)]))}<p>${esc(h.id)}さん：${h.correct} ÷ ${h.trials} × 100 = <strong>${pct(h.correct/h.trials,2)}</strong>。</p><p>1人が何枚も答えていても、独立した人が増えたとは数えません。観測値の変更は「データ」タブで行います。</p></details>`)}`,
  takeaway:`1人を1つの観測として、${fmt(n,0)}人の${label}の分布を確認しました。次は、何を基準に、どの違いを調べるかを決めます。`};
 case 1:{const hypo=hypothesisText(s.reference,s.direction,s.measureLabel);return {
  body:`<p class="hyp-action"><strong>決めること：</strong>比較する基準と、調べたい違いの方向を決めます。</p><div class="hyp-setup-grid"><section><h3>なぜ50%と比べる？</h3><p>教材の顔判定は「本物」「AI生成」の2択です。無作為に1つ選ぶと、正解する確率は <strong>1 ÷ 2 = 50%</strong>です。</p><div class="hyp-chance-example" aria-label="無作為な2択では正解と不正解がそれぞれ2分の1"><span>正解 <strong>1/2</strong></span><span>不正解 <strong>1/2</strong></span></div><div class="hyp-controls">${number('hyp-reference','比較する基準（%）',Number((s.reference*100).toFixed(8)),.000001,99.999999,'any')}</div><p class="hint">自分の調査では、問いに合う基準に変更できます。</p></section><section>${radios('hyp-direction','何を調べる？',[['two-sided','基準と違うか（両側）'],['greater','基準を上回るか（右片側）'],['less','基準を下回るか（左片側）']],s.direction)}<dl class="hyp-rule"><div><dt>帰無仮説 H₀</dt><dd>${esc(hypo.null)}</dd></div><div><dt>対立仮説 H₁</dt><dd>${esc(hypo.alternative)}</dd></div></dl></section></div><p class="hint">基準と方向は、結果を見る前に決めます。結果を見た後の変更は、別の比較として扱います。</p>${notes('2つの仮説の意味',`<p><strong>帰無仮説：</strong>両側検定では、まず「平均は基準どおり」と仮定します。</p><p><strong>対立仮説：</strong>調べたい違いを表します。今回は「${esc(directionLabel(s.direction))}」です。</p>${s.direction!=='two-sided'?'<p>片側検定の帰無仮説には、調べたい向きと反対側も含めます。確率の計算には、境界の「平均が基準と同じ場合」を使います。</p>':''}`)}${notes('自分の調査の基準',`<p>3択なら約33.3333%、4択なら25%、目標との比較ならその目標値など、根拠に合う基準を使います。</p>${s.reference!==.5?'<p>元の顔判定は2択です。今は基準を変更した別の問いで比較しています。</p>':''}`)}`,
  takeaway:`基準を${rateText(s.reference)}とし、「${esc(directionLabel(s.direction))}」を調べる問いを決めました。`};}
 case 2:return {
  body:`<p class="hyp-action"><strong>決めること：</strong>棄却の基準と、計算に使う方法を先に決めます。</p>${alphaControl(s)}<p>有意水準5%なら、平均が基準と同じ場合に<strong>この方法で棄却する確率を5%</strong>にします。基準どおりでも、ときには棄却してしまいます。</p><h3>使う方法：1標本t検定</h3><p>1人ごとの割合の平均を、基準と比べます。人ごとのばらつきと人数も考慮します。</p>${notes('この方法を使う前提',`<p>参加者間が独立であることを仮定します。1人ごとの値が正規分布なら厳密なt検定で、今回の離散的な割合には、人数が多い場合の近似として使います。</p>${n<30?'<p>今の標本は少人数です。値の分布を十分に確認し、このt近似を使えるか慎重に判断する必要があります。</p>':''}<p>同じ人の繰り返し測定や、関連する2群の比較は、この1標本の形式にまとめません。0%・100%を基準にする検定も、この設定には含めていません。</p>`)}${notes('新しい調査では',`<p>教材は公開済みの研究で手順をたどります。新しく検証するときは、結果を見る前に問い・方向・有意水準・方法を決めます。</p>`)}`,
  takeaway:`「${esc(directionLabel(s.direction))}・有意水準${pct(s.alpha,0)}・1標本t検定」というルールが決まりました。ここから観測結果を計算します。`};
 case 3:{const sumSquares=scores.reduce((sum,x)=>sum+((x-t.mean)*100)**2,0),variance=sumSquares/(n-1);return {
  body:`<p class="hyp-action"><strong>平均：</strong>各人の${label}を足し、人数${fmt(n,0)}で割ります。<strong>標本平均は${pct(t.mean,2)}</strong>です。</p>${plot(scoreHistogram(scores,{width:s.binWidth,mean:t.mean,reference:s.reference,label:s.measureLabel,interactive:false}))}<h3>標準偏差を求める</h3><ol class="hyp-sd-steps"><li><strong>平均との差</strong><span>各人の値 − ${pct(t.mean,2)}</span></li><li><strong>差を二乗して足す</strong><span>合計 ≈ ${fmt(sumSquares,2)}</span></li><li><strong>n−1で割る</strong><span>${fmt(sumSquares,2)} ÷ ${n-1} ≈ ${fmt(variance,2)}</span></li><li><strong>平方根を取る</strong><span>√${fmt(variance,2)} ≈ <b>${fmt(t.sd*100,2)}ポイント</b></span></li></ol>${!t.valid?unavailable(t):''}${notes('計算の内訳',`<details class="hyp-details"><summary>各人の値から計算をたどる</summary>${table(['参加者',`${s.measureLabel}（%）`,'平均との差（ポイント）','差の二乗'],s.participants.slice(0,3).map(p=>[p.id,fmt(p.correct/p.trials*100,2),fmt((p.correct/p.trials-t.mean)*100,2),fmt(((p.correct/p.trials-t.mean)*100)**2,2)]))}<p>残りの人も同じように計算し、全${n}人の二乗を足します。表の3人だけの合計ではありません。</p><p>s = √{Σ(xᵢ−x̄)² ÷ (n−1)}。平均を標本から推定した分を考慮し、母分散の推定にはnではなくn−1で割ります。</p></details>`)}${notes('平均と標準偏差',`<p>標準偏差は、1人ごとの値の散らばりを表します。次の段階の「平均の揺れ」と区別します。</p><p>各人の判定枚数が違っても、割合を同じ重みで平均します。全回答の合計比率とは一致しない場合があります。</p><p>二乗した値の単位はポイント²で、平方根を取るとポイントに戻ります。表示は丸めていますが、計算には丸める前の値を使います。</p>`)}`,
  takeaway:`標本平均は${pct(t.mean,2)}、人ごとの散らばりを表す標準偏差は${fmt(t.sd*100,2)}ポイントです。これを使い、次に平均の揺れを求めます。`};}
 case 4:return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>計算すること：</strong>平均との差を、「平均が揺れる大きさ」を単位にして表します。</p><div class="hyp-formula-grid"><p class="hyp-equation">標準誤差 SE = s ÷ √n<br>${fmt(t.sd*100,2)} ÷ √${fmt(n,0)}<br>≈ <strong>${fmt(t.se*100,2)}ポイント</strong></p><p class="hyp-equation">t = (標本平均 − 基準) ÷ SE<br>(${pct(t.mean,2)} − ${rateText(s.reference)}) ÷ ${fmt(t.se*100,2)}ポイント<br>≈ <strong>${fmt(t.t,2)}</strong></p></div>${plot(scaleChart(t,s.measureLabel))}<p>${t.t===0?'t=0なので、標本平均と基準が一致しています。':`今回は基準より${t.t<0?'低い':'高い'}側へ、標準誤差の<strong>${fmt(Math.abs(t.t),2)}個分</strong>ずれています。`}</p>${notes('標準誤差とは',`<p>同じ人数を別に調べると、標本平均も変わります。その揺れの大きさを推定するのが<strong>標準誤差</strong>です。人ごとの散らばりを表す標準偏差とは区別します。</p><p>独立した観測では、平均のばらつきは人数の平方根に反比例して小さくなります。未知の母標準偏差を、標本標準偏差sで推定します。</p>`)}${notes('tの読み方',`<p>t=0なら差がなく、負なら基準より低く、正なら高い側です。絶対値が大きいほど、標準誤差に比べて大きく離れています。</p>`)}`,takeaway:t.valid?`平均との差をt=${fmt(t.t,2)}と表せました。次に、帰無仮説が正しい場合に、このようなtがどれくらい起こるかを調べます。`:'ばらつきを推定できないため、tを計算できません。'};
 case 5:{const extreme=s.direction==='two-sided'?`左右どちらも、標準誤差の${fmt(Math.abs(t.t),2)}個分以上ずれる`:s.direction==='greater'?`tが今回の${fmt(t.t,2)}以上になる`:`tが今回の${fmt(t.t,2)}以下になる`;return {body:!t.valid?unavailable(t):`<ol class="hyp-reasoning"><li><strong>仮定する</strong><span>母平均は${rateText(s.reference)}だとする。</span></li><li><strong>同じ調査を繰り返すと考える</strong><span>${n}人ずつ調べる。平均は毎回少しずつ変わる。</span></li><li><strong>今回以上のずれを調べる</strong><span>${extreme}確率は、どれくらいだろう？</span></li></ol>${plot(testChart(t,{label:s.measureLabel}))}<p>橙の範囲が、仮定のもとで<strong>今回以上のずれ</strong>に当たります。</p>${s.probabilityReady?`<div class="hyp-outcome"><p>その確率は<strong id="hyp-p-value" data-p-value="${t.pValue}">${pText(t.pValue)}</strong>（${t.pValue<.00001?'0.001%未満':pct(t.pValue,3)}）です。<strong>この確率をp値と呼びます。</strong></p></div>`:'<p class="hyp-compute-prompt">下の「次へ」で、この確率を求めます。</p>'}${s.direction==='greater'&&t.t<0?'<p>今回は基準より低い側です。「上回る」という問いと逆の向きなので、右側の確率は大きくなります。</p>':s.direction==='less'&&t.t>0?'<p>今回は基準より高い側です。「下回る」という問いと逆の向きなので、左側の確率は大きくなります。</p>':''}${notes('何を繰り返すと考える？',`<p>帰無仮説のもとで、同じ条件の人から${n}人ずつ調べ直すと考えます。1人の${s.participants[0].trials}回答を、別々の人の回答にはしません。</p><p>毎回、平均と標準誤差を求め、差をその回の標準誤差で割ります。このtが今回以上にずれる確率を調べます。標準誤差も標本ごとに変わるため、平均の差だけでなく、前段階のtでそろえて比べます。</p>`)}${notes('曲線と面積の意味',`<p>この曲線は、帰無仮説のもとでのtの分布です。最初のヒストグラム（1人ごとの値と人数）とは別です。範囲の下の面積が確率で、高さそのものではありません。</p><p>${s.direction==='two-sided'?'両側なので、左右両方で今回と同じか、それ以上に遠い範囲を合計します。':s.direction==='greater'?'右片側なので、今回のt以上になる右側を使います。':'左片側なので、今回のt以下になる左側を使います。'}</p><p>「母平均が基準である確率」や「この差が偶然である確率」を求めているわけではありません。</p><details class="hyp-details"><summary>使っている分布</summary><p>母標準偏差が未知なので、自由度n−1=${t.df}のt分布を使います。高校数学での「仮説を仮定→起こりにくさを確率で調べる→判断」という流れを、今回のデータに適した方法でたどります。図の外側まで含めて計算しています。</p></details>`)}`,takeaway:s.probabilityReady?`帰無仮説を仮定すると、今回以上にずれる確率は${t.pValue<.00001?'0.001%未満':pct(t.pValue,3)}でした。次は先に決めた有意水準と比べます。`:'まだ帰無仮説が正しいかは判断していません。まず、この仮定のもとで今回以上のずれが起こる確率を求めます。'};}
 case 6:return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>判断すること：</strong>p値 ≤ 有意水準α なら、帰無仮説を棄却します。</p><div class="hyp-decision-rule"><p class="hyp-equation">p = ${pText(t.pValue)}（${pct(t.pValue,4)}） ${t.reject?'≤':'>'} α = ${s.alpha}（${pct(s.alpha,0)}）</p><p id="hyp-decision">${decisionText(s,t)}</p></div>${plot(testChart(t,{showDecision:true,label:s.measureLabel}))}${notes('使った仮説と基準',rule(s))}${notes('棄却域と判断',`<p>紫の帯は、先に決めた棄却域です。今回のtがここに入るかを見る方法と、p値をαと比べる方法は同じ判断になります。</p><p>${t.reject?'棄却しても、差が大きい・実用的・原因が判明した、とまではいえません。':'棄却しないことは、帰無仮説が正しいという証明ではありません。'} 統計的な判断と実際の意味を分けます。</p>`)}`,takeaway:t.valid?(t.reject?'決めたルールに従って帰無仮説を棄却しました。':'決めたルールでは帰無仮説を棄却しませんでした。')+'最後に、もとの問いに戻って差の方向と大きさを読みます。':'このデータでは棄却の判断をしません。'};
 case 7:{const face=s.measureLabel==='正答率'&&s.reference===.5&&!s.dataInfo?.publicDerived&&s.dataInfo?.publicDataset?.links?.some(([,href])=>href.includes('2120481119'));return {body:!t.valid?unavailable(t):`<p class="hyp-action"><strong>解釈すること：</strong>差の方向と大きさを、もとの問いの言葉で読みます。</p><p id="hyp-interpretation">標本平均は<strong>${pct(t.mean,2)}</strong>、基準${rateText(s.reference)}との差は<strong>${fmt(t.difference*100,2)}ポイント</strong>です。${decisionText(s,t)}</p>${face&&t.difference<0&&t.reject?'<div class="hyp-outcome"><h3>この顔判定実験では</h3><p>差は50%を下回る方向です。棄却できても、「当てずっぽうよりよく見分けられた」とはいえません。</p></div>':'<p>基準との差を示せても、実際の目的に十分な差かどうかは別に考えます。</p>'}<h3>補足：母平均の範囲を示す信頼区間</h3>${plot(intervalChart(t,s.measureLabel))}<p>${s.direction==='two-sided'?'両側':'片側'}${pct(1-s.alpha,0)}信頼区間：<strong>${intervalText(t)}</strong></p>${notes('信頼区間の意味',`<p>検定の方向と有意水準に対応した区間です。同じ条件で調査と計算を繰り返すと、その約${pct(1-s.alpha,0)}の区間が母平均を含むという意味です。この1本に母平均が入っている確率ではありません。</p>`)}${notes('解釈できる範囲',`<p>教材の元の研究は、特定の顔画像群とオンライン参加者による実験です。日本の高校生や現在のSNSの画像全般の精度を、そのまま表すものではありません。</p><p>自分の調査でも、誰をどのように調べたか、用途に必要な精度は何かを確認します。</p>`)}`,takeaway:'仮説・有意水準・方法を決め、計算、判断、解釈までたどりました。次は、同じルールでも誤りが起こる理由を確かめます。'};}
 }
}
function planControls(s,t,withAlpha=false) {
 const sigma=s.sigmaMode==='custom'?s.planningSD:t.sd;
 return `<div class="hyp-controls">${number('plan-n','これから調べる人数（人）',s.planN,30,1000,1)}${withAlpha?alphaControl(s):''}</div><details class="hyp-details" ${s.sigmaMode==='custom'?'open':''}><summary>計画に使うばらつきを設定する</summary>${radios('hyp-sigma-mode','1人ごとの値の標準偏差',[['data',`今回の標本の値を使う（${fmt(t.sd*100,2)}ポイント）`],['custom','別の値を仮定する']],s.sigmaMode)}${s.sigmaMode==='custom'?number('hyp-planning-sd','仮定する標準偏差（ポイント）',Number((s.planningSD*100).toFixed(6)),.000001,100,'any'):''}<p>ここでは母標準偏差を${fmt(sigma*100,2)}ポイントと仮定します。未知の母標準偏差が、この値だと確定したわけではありません。</p></details>`;
}
const probabilityStrip=(probability,label)=>`<div class="hyp-probability-bar" role="img" aria-label="${esc(label)}：${rateText(probability)}"><span style="width:${Math.max(0,Math.min(100,probability*100))}%"></span></div><p class="hyp-bar-caption">橙：${esc(label)} ${rateText(probability)} ／ 緑：それ以外 ${rateText(1-probability)}</p>`;
function errorBody(s,t) {
 if(s.errorStep===0)return {
  body:`<p class="hyp-action">検定は標本から判断するため、<strong>正しい判断になるとは限りません。</strong></p>${table(['本当の状態','帰無仮説を棄却する','棄却しない'],[['帰無仮説が正しい','第1種の誤り','正しい判断'],['対立仮説が正しい','正しい判断','第2種の誤り']])}<div class="hyp-error-pair"><div><h3>第1種：差がないのに、あると判断</h3><p>本当は基準どおりなのに、偶然の大きなずれで棄却してしまう。</p></div><div><h3>第2種：ある差を、見逃す</h3><p>本当は調べたい向きの差があるのに、棄却できない。</p></div></div>${notes('棄却しない、の意味',`<p>「差があるとはいえない」という判断です。「差がないと証明できた」ではありません。</p><p>片側検定では、第1種の誤りは、調べたい向きの差がない帰無仮説の範囲で棄却することです。次は、その境界である平均${rateText(s.reference)}の例を考えます。</p>`)}`,
  takeaway:'「ない差をあるとする誤り」と「ある差を見逃す誤り」を区別します。まず第1種の誤りを見ます。'};
 if(s.errorStep===1)return {
  body:`<p class="hyp-action"><strong>本当は平均${rateText(s.reference)}</strong>だとします。それでも、標本には偶然のずれが起こります。</p><div class="hyp-error-story"><p>本当は基準どおり</p><span aria-hidden="true">↓</span><p>たまたま大きくずれた標本が得られた</p><span aria-hidden="true">↓</span><p><strong>帰無仮説を棄却してしまう → 第1種の誤り</strong></p></div>${probabilityStrip(s.alpha,'誤って棄却')}<p>有意水準${rateText(s.alpha)}なら、この仮定のもとで調査を100回繰り返したとき、<strong>平均して約${fmt(s.alpha*100,2).replace(/\.00$/,'')}回</strong>が第1種の誤りになる、という基準です。</p>${notes('有意水準が表すこと',`<p>100回のうち必ずこの回数になる、という意味ではありません。長く繰り返したときの割合です。</p><p>${rateText(s.alpha)}は「今回の結論が間違っている確率」ではありません。帰無仮説を仮定したときの、この検定方法の誤り率です。</p>${s.direction!=='two-sided'?'<p>片側では、帰無仮説の境界で有意水準に等しく、内側ではそれ以下になります。</p>':''}`)}`,
  takeaway:`有意水準${rateText(s.alpha)}は、帰無仮説が正しいのに棄却する誤りを制御するための基準です。`};
 const sigma=s.sigmaMode==='custom'?s.planningSD:t.sd,plan=sigma>0?meanTestPower(s.planN,s.trueMean,sigma,s.alpha,s.reference,s.direction):null;
 const otherN=s.planN<=500?s.planN*2:Math.max(30,Math.floor(s.planN/2)),other=plan?meanTestPower(otherN,s.trueMean,sigma,s.alpha,s.reference,s.direction):null;
 return {
  body:`<p class="hyp-action"><strong>本当は調べたい向きに差がある</strong>のに、標本のずれが小さく、棄却できないこともあります。</p><div class="hyp-error-story"><p>本当は差がある</p><span aria-hidden="true">↓</span><p>たまたま基準に近い標本が得られた</p><span aria-hidden="true">↓</span><p><strong>帰無仮説を棄却しない → 第2種の誤り（見逃し）</strong></p></div>${plan?.hasAlternative?`<div id="hyp-plan-interpretation"><p><strong>仮の計画例：</strong>本当の平均を${rateText(s.trueMean)}と仮定し、${s.planN}人を調べるモデルでは、見逃す確率は約<strong>${rateText(plan.missed)}</strong>です。</p>${probabilityStrip(plan.missed,'差を見逃す')}</div>`:`<div id="hyp-plan-interpretation"><p>${plan?'今の仮定は対立仮説の側にありません。見逃しを数値で確かめるには、調べたい向きに差がある例を使います。':'数値の例には、正のばらつきの仮定が必要です。下の「詳しく」で設定できます。'}</p>${plan?'<button type="button" id="hyp-alternative-example">対立仮説側の例を使う</button>':''}</div>`}<details class="hyp-details hyp-planning-details"><summary>詳しく：人数や差の大きさで、見逃しはどう変わる？</summary>${planControls(s,t,true)}<div class="hyp-controls">${number('true-rate',`仮定する本当の平均${s.measureLabel}（%）`,Number((s.trueMean*100).toFixed(4)),0,100,'any')}</div>${plan?table(['計画人数','仮定した平均で棄却する','棄却しない'],[[`${s.planN}人`,rateText(plan.detected),rateText(plan.missed)],[`${otherN}人（比較）`,rateText(other.detected),rateText(other.missed)]]):''}<p>対立仮説側の平均では、差を捉えて棄却する確率を<strong>検出力</strong>と呼びます。見逃す確率と合わせて100%です。人数を増やすと、同じ差を見つけやすくなります。</p><p>有意水準を小さくすると第1種の誤りは減りますが、同じ人数では見逃しが増えます。ここでの変更は新しい計画の比較です。観測データの検定も、変更後の有意水準の設定段階へ戻ります。</p></details>${notes('この数値は仮の計画',`<p>母平均は実際には分かりません。ここでは${rateText(s.trueMean)}だと仮定しています。実測で確定した平均ではありません。</p><p>参加者ごとの値を独立な正規分布で近似し、母標準偏差を${fmt(sigma*100,2)}ポイントと仮定したt検定のモデルです。実際の見逃し率を保証せず、割合の0〜100%の制約や選び方の偏りは完全には再現しません。</p>`)}${notes('2つの誤りは足さない',`<p>第1種は「帰無仮説が正しい場合」、第2種は「対立仮説が正しい場合」の確率です。本当の状態が異なるため、足して今回の結論の誤り率にはできません。</p>`)}`,
  takeaway:'棄却しなかった結果には、差がない場合と、ある差を見逃した場合があります。だから、棄却しないことは帰無仮説の証明にはなりません。'};
}
function wire(root,ctx,s,isErrors) {
 root.querySelectorAll('input[type=number]').forEach(el=>{el.required=true;});
 const key=isErrors?'errorStep':'testStep',steps=isErrors?errorStages:testStages;
 const validInputs=()=>{
  const invalid=[...root.querySelectorAll('input')].find(el=>!el.checkValidity());
  if(invalid){invalid.reportValidity();return false;}return true;
 };
 const move=index=>{
  ctx.update({[key]:index,...(!isErrors&&index===5?{probabilityReady:false}:{})});
  const title=root.querySelector('#hyp-step-title');title?.focus({preventScroll:true});
  const pane=root.querySelector('.hypothesis-test-display');if(pane)pane.scrollTop=0;
  const body=root.querySelector('.hyp-step-body');if(body)body.scrollTop=0;
  if(!pane?.closest('.statistics-fullscreen')&&title?.getBoundingClientRect().top<0)title.scrollIntoView({block:'start',behavior:'smooth'});
 };
 root.querySelectorAll('[data-hyp-stage]').forEach(el=>el.addEventListener('click',()=>{
  const index=Number(el.dataset.hypStage);if(index>s[key]&&!validInputs())return;move(index);
 }));
 root.querySelector('#hyp-prev')?.addEventListener('click',()=>move(Math.max(0,s[key]-1)));
 root.querySelector('#hyp-next')?.addEventListener('click',()=>{
  if(!validInputs())return;
  if(!isErrors&&s.testStep===5&&!s.probabilityReady){ctx.update({probabilityReady:true});return;}
  if(s[key]<steps.length-1)move(s[key]+1);
  else if(isErrors)move(0);
  else {ctx.update({errorStep:0,probabilityReady:false});document.querySelector('#view-1')?.click();root.querySelector('#hyp-step-title')?.focus({preventScroll:true});}
 });
 root.querySelector('#hyp-restart')?.addEventListener('click',()=>move(0));
 root.querySelector('#hyp-open-data')?.addEventListener('click',()=>document.querySelector('#data-tab')?.click());
 const settings=(patch,stage)=>ctx.update({...patch,testStep:Math.min(s.testStep,stage),errorStep:0,probabilityReady:false});
 root.querySelector('#hyp-reference')?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())settings({reference:Number(e.target.value)/100},1);});
 root.querySelectorAll('[name="hyp-direction"]').forEach(el=>el.addEventListener('change',()=>settings({direction:el.value},1)));
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
