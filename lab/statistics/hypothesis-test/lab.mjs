import { esc, number, table } from '../shared/ui.mjs?v=20261025-final-polish';
import { fmt } from '../shared/math.mjs';
import { publicDatasetInfo } from '../shared/sources.mjs?v=20261025-final-polish';
import { academicExplanation } from '../shared/reading.mjs?v=20261025-final-polish';
import { participantScores } from './mean-model.mjs?v=20261025-final-polish';
import { normalMeanTest, normalTableReading } from './normal-model.mjs?v=20261025-final-polish';
import { aiFaceParticipants } from './data.mjs?v=20261025-final-polish';
import { downloadCSV } from '../data-editor.mjs?v=20261025-final-polish';
import { guideDefaults, normalizeGuide, testStages, errorStages, directionLabel, hypothesisText, rateText, ratioText } from './guide.mjs?v=20261025-final-polish';
import { scoreBins, scoreHistogram, scaleChart, normalChart } from './charts.mjs?v=20261025-final-polish';
const notes=(title,summary,detail='')=>`<section class="hyp-explanation" data-screen-nav-section="${esc(title)}"><h3>${esc(title)}</h3><p>${summary}</p>${detail?`<details class="hyp-details"><summary>詳しく</summary>${detail}</details>`:''}</section>`;
const plot=body=>`<figure class="hyp-plot">${body}</figure>`;
const radios=(name,title,choices,value)=>`<fieldset class="hyp-radio"><legend>${esc(title)}</legend>${choices.map(([v,label])=>`<label><input type="radio" name="${name}" value="${esc(v)}" ${String(v)===String(value)?'checked':''}>${esc(label)}</label>`).join('')}</fieldset>`;
const alphaControl=s=>radios('hyp-alpha','有意水準（棄却域に入る確率）',[[.01,'0.01（1%）'],[.05,'0.05（5%）'],[.1,'0.1（10%）']],s.alpha);
const unavailable=t=>`<div class="hyp-outcome" id="hyp-unavailable"><h3>この条件では正規近似による判断を進められません</h3><p>${esc(t.reason)}</p><button type="button" id="hyp-open-data">データを確認する</button></div>`;
const zText=(z,c)=>Math.abs(Math.abs(z)-Math.abs(c))<.005?String(Number(z.toFixed(8))):fmt(z,2);
const cutoffText=(x,z=Infinity)=>String(Number(x.toFixed(Math.abs(Math.abs(z)-Math.abs(x))<.005?8:3)));
function decisionText(s,t) {
 const relation=s.direction==='greater'?'を上回る':s.direction==='less'?'を下回る':'と異なる';
 return t.reject?`今回のZは棄却域に入るので、帰無仮説を棄却します。平均${esc(s.measureLabel)}が${ratioText(s.reference)}${relation}ことを示す結果です。`
 :`今回のZは棄却域に入らないので、帰無仮説を棄却しません。平均${esc(s.measureLabel)}が${ratioText(s.reference)}${relation}と判断する十分な証拠は得られません。`;
}
function wizard(s,isErrors,content,t) {
 const steps=isErrors?errorStages:testStages,index=isErrors?s.errorStep:s.testStep,next=steps[index+1];
 const blocked=!isErrors&&index>=3&&!t.valid;
 const nextButton=next||!isErrors?`<button id="hyp-next" class="primary" type="button" ${blocked?'disabled':''}>${next?`次へ：${esc(next)} →`:'判断の誤りへ →'}</button>`:'<span class="hyp-finished">ここまでで完了</span>';
 return `<section class="panel chart-panel hyp-guide ${isErrors?'hyp-errors':'hyp-test'}" data-hyp-journey="${isErrors?'errors':'test'}" data-hyp-step="${index}"><p class="hyp-step-count">${isErrors?'判断の誤り':'仮説検定を行う'} · ${index+1} / ${steps.length}</p><ol class="hyp-progress" aria-label="学習の手順">${steps.map((label,i)=>`<li class="${i===index?'is-current':i<index?'is-complete':''}"><button type="button" data-hyp-stage="${i}" ${i===index?'aria-current="step"':''} aria-label="${i+1}. ${esc(label)}"><span>${i+1}</span><small>${esc(label)}</small></button></li>`).join('')}</ol><h2 id="hyp-step-title" tabindex="-1">${index+1}. ${esc(steps[index])}</h2><div class="hyp-step-body">${content.body}</div><aside class="hyp-takeaway" data-screen-nav-section="この段階の要点"><h3>この段階の要点</h3><p>${content.takeaway}</p></aside><nav class="hyp-wizard-navigation" aria-label="この学習の前後の段階"><button id="hyp-prev" type="button" ${index===0?'disabled':''}>← 前へ</button>${nextButton}</nav></section>`;
}
function readingTable(reading) {
 const columns=Array.from({length:10},(_,i)=>i/100);
 return `<div class="table-scroll hyp-normal-table"><table class="stat-table"><caption>標準正規分布表の一部：0からzまでの面積 P(0 ≤ Z ≤ z)</caption><thead><tr><th scope="col">z</th>${columns.map(x=>`<th scope="col">${x.toFixed(2)}</th>`).join('')}</tr></thead><tbody>${reading.rows.map(row=>`<tr><th scope="row">${row.base.toFixed(1)}</th>${row.cells.map(cell=>`<td ${cell.selected?'class="hyp-table-match"':''} data-table-z="${cell.z}" aria-label="z=${cell.z.toFixed(2)}、面積${cell.area.toFixed(4)}">${cell.area.toFixed(4)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function testBody(s,scores,t) {
 const label=esc(s.measureLabel),n=t.n,bin=scoreBins(scores,s.binWidth)[s.selectedBin];
 switch(s.testStep) {
 case 0:return {
  body:`<p class="hyp-action">横軸は1人ごとの${label}、棒の高さはその範囲に入る人数です。</p><div class="hyp-controls">${number('hyp-bin-width','階級幅',s.binWidth,1,10,1)}</div>${plot(scoreHistogram(scores,{width:s.binWidth,selected:s.selectedBin,label:s.measureLabel}))}<p id="hyp-bin-reading" role="status">${bin?`${bin.lo}%以上${bin.hi}%${bin.last?'以下':'未満'}は<strong>${bin.count}人</strong>です。`:'棒をクリックすると、その範囲の人数を確認できます。'}</p>${notes('図の読み方',`${n}人の値をまとめた図です。棒が高い範囲ほど、その値に近い人が多くいます。`)}${notes('1人を1つの観測にする','1人の正答数÷判定枚数で、その人の正答率を求めます。',`${table(['参加者','判定枚数','正答数',s.measureLabel],s.participants.slice(0,3).map(p=>[p.id,p.trials,p.correct,rateText(p.correct/p.trials)]))}<p>表の1行が1人分です。元の値は「データ」で変更できます。</p>`)}`,
  takeaway:'まず、1人ごとの値がどの範囲に集まっているかを確認しました。'};
 case 1:{const h=hypothesisText(s.reference,s.direction,s.measureLabel);return {
  body:`<p class="hyp-action">母平均をどの値と比べ、どの向きの違いを調べるかを決めます。</p><div class="hyp-setup-grid"><section><h3>帰無仮説を組み立てる</h3><div class="hyp-controls"><label class="control" for="hyp-reference"><span>帰無仮説の平均 μ₀（0〜1）</span><input id="hyp-reference" type="number" step="0.01" max="${1-Number.EPSILON}" value="${esc(s.reference)}"></label></div></section><section>${radios('hyp-direction','調べたい違い',[['two-sided','異なるか（両側）'],['greater','上回るか（右片側）'],['less','下回るか（左片側）']],s.direction)}</section></div><dl class="hyp-rule"><div><dt>帰無仮説 H₀</dt><dd>${esc(h.null)}</dd></div><div><dt>対立仮説 H₁</dt><dd>${esc(h.alternative)}</dd></div></dl>${notes('2つの仮説','帰無仮説は比べる出発点、対立仮説は調べたい違いです。','<p>μは同じ条件での母平均です。片側検定では、帰無仮説の境界μ=μ₀で棄却域を計算します。</p>')}${notes('先に決めること','基準と向きは、調査の前に決めます。')}`,
  takeaway:`帰無仮説の基準を${ratioText(s.reference)}とし、「${esc(directionLabel(s.direction))}」を調べます。`};}
 case 2:return {
  body:`<p class="hyp-action">偶然のずれとして、どの程度まで起こりにくい結果を棄却するかを決めます。</p>${alphaControl(s)}<p>${s.direction==='two-sided'?`有意水準${ratioText(s.alpha)}を左右に半分ずつ、${ratioText(s.alpha/2)}ずつ割り当てます。`:`選んだ片側の端に、有意水準${ratioText(s.alpha)}を割り当てます。`}</p><h3>使う方法：大標本での正規近似</h3><p>今回の人数は<strong>${n}人</strong>です。1人ごとの割合の平均を使い、正規分布表で棄却域を求めます。</p>${notes('有意水準','帰無仮説のもとで起こる、まれな結果を棄却域にします。')}${notes('計算に使うばらつき','参加者ごとの標準偏差から、平均のばらつきを求めます。','<p>参加者を独立した観測として扱い、母標準偏差を今回の標本標準偏差で推定します。</p>')}${n<30?unavailable(t):''}`,
  takeaway:`有意水準${ratioText(s.alpha)}で、正規分布表から棄却域の境目を求めます。`};
 case 3:{const sum=t.sumSquares*10000,variance=t.variance*10000;return {
  body:`<p class="hyp-action">各人の${label}を平均すると、<strong>${ratioText(t.mean)}（${rateText(t.mean)}）</strong>です。</p>${plot(scoreHistogram(scores,{width:s.binWidth,mean:t.mean,reference:s.reference,label:s.measureLabel,interactive:false}))}<h3>標準偏差を求める</h3><ol class="hyp-sd-steps"><li><strong>平均との差</strong><span>各人の値 − ${rateText(t.mean)}</span></li><li><strong>二乗して足す</strong><span>全員の合計 ≈ ${fmt(sum,2)}</span></li><li><strong>n−1で割る（不偏分散）</strong><span>${fmt(sum,2)} ÷ ${n-1} ≈ ${fmt(variance,2)}</span></li><li><strong>平方根を取る（標準偏差）</strong><span>√${fmt(variance,2)} ≈ <b>${fmt(t.sd*100,2)}ポイント</b></span></li></ol>${!t.valid?unavailable(t):''}${notes('ばらつきの大きさ','標準偏差は、1人ごとの値が平均の周りに散らばる大きさです。',`${table(['参加者','値（%）','平均との差','差の二乗'],s.participants.slice(0,3).map(p=>[p.id,fmt(p.correct/p.trials*100,2),fmt((p.correct/p.trials-t.mean)*100,2),fmt(((p.correct/p.trials-t.mean)*100)**2,2)]))}<p>全${n}人の差の二乗を合計し、n−1で割って不偏分散を求めます。</p><p>二乗した値の単位はポイント²です。平方根を取るとポイントに戻ります。</p>`)}`,
  takeaway:`人ごとの標準偏差は${fmt(t.sd*100,2)}ポイント、小数では約${ratioText(t.sd)}です。`};}
 case 4:return {body:!t.valid?unavailable(t):`<p class="hyp-action">割合を小数で計算し、平均との差を標準誤差の何個分かで表します。</p><div class="hyp-formula-grid"><div class="hyp-calculation"><h3>標準誤差</h3><p>同じ人数を調べ直したときの、<strong>平均のばらつきの目安</strong>です。</p><p class="hyp-equation">標準偏差 ÷ √人数<br>${ratioText(t.sd)} ÷ √${n}<br>≈ <strong>${ratioText(t.se)}</strong></p></div><div class="hyp-calculation"><h3>ずれを表す値 Z</h3><p>帰無仮説の平均から、<strong>標準誤差何個分</strong>離れたかを表します。</p><p class="hyp-equation">Z = (標本平均 − 帰無仮説の平均) ÷ 標準誤差<br>(${ratioText(t.mean)} − ${ratioText(s.reference)}) ÷ ${ratioText(t.se)}<br>≈ <strong>${fmt(t.z,2)}</strong></p></div></div>${plot(scaleChart(t,s.measureLabel))}<p id="hyp-z-meaning">${t.z===0?'Z=0なので、標本平均と帰無仮説の平均が一致しています。':`Z=${fmt(t.z,2)}は、標本平均が帰無仮説の平均より<strong>標準誤差の${fmt(Math.abs(t.z),2)}個分${t.z<0?'低い':'高い'}</strong>ことを表します。`}</p>${notes('標準偏差と標準誤差','標準偏差は人ごとのばらつき、標準誤差は平均のばらつきです。','<p>独立した観測では、標本平均の標準偏差は母標準偏差÷√nです。今回は未知の母標準偏差を標本の標準偏差で推定しています。</p>')}${notes('Zの読み方','0なら差がなく、負なら低く、正なら高い側です。','<p>Zは同じ単位どうしを割った数で、標準誤差の個数を表します。</p>')}`,
  takeaway:t.valid?`今回のZは${fmt(t.z,2)}です。次は正規分布表で、棄却域の境目を求めます。`:'このデータでは正規近似による判断を進めません。'};
 case 5:{const r=normalTableReading(s.alpha,s.direction),c=cutoffText(r.critical),each=s.direction==='two-sided';const positions=r.selected.map(v=>{const text=v.toFixed(2);return `行${text.slice(0,-1)}・列0.0${text.at(-1)} → z=${text}`;}).join('、');return {
  body:`<ol class="hyp-reasoning"><li><strong>端の面積</strong><span>${each?`左右に分け、${ratioText(s.alpha)} ÷ 2 = ${ratioText(r.tail)}`:`選んだ片側に ${ratioText(s.alpha)}`}</span></li><li><strong>表で探す面積</strong><span>0から境目まで：${r.negative?'|':''}0.5 − ${ratioText(r.tail)}${r.negative?'|':''} = <b>${r.target.toFixed(4)}</b></span></li></ol>${plot(normalChart(t,{reading:true}))}${readingTable(r)}<p class="hyp-table-reading" id="hyp-table-reading">${r.limited?'この面積は4桁の表では読み取れないため、より細かく計算します。':r.selected.length===1?`${positions}。面積${r.target.toFixed(4)}に対応します。`:`${positions}。目標の面積は2つの値の間です。境目もその間にあります。`}</p><p><strong>棄却域の境目は${each?`およそ ±${c}`:s.direction==='greater'?`およそ ${c}`:`およそ ${cutoffText(-r.critical)}`}</strong>です。</p>${notes('表の行と列','行が小数第1位まで、列が小数第2位です。',`<p>この表は正のzに対するP(0≤Z≤z)を小数第4位まで示します。負の側は分布の対称性を使います。${r.negative?'今の設定では境目が負になるため、表で読んだ位置を対称に移します。':''}</p>`)}`,
  takeaway:`正規分布表から、${each?`±${c}`:s.direction==='greater'?c:cutoffText(-r.critical)}を棄却域の境目として読み取りました。`};}
 case 6:{const c=cutoffText(t.critical,t.z),comparison=s.direction==='two-sided'?`|Z| = ${zText(Math.abs(t.z),t.critical)} ${t.reject?'≥':'<'} ${c}`:s.direction==='greater'?`Z = ${zText(t.z,t.critical)} ${t.reject?'≥':'<'} ${c}`:`Z = ${zText(t.z,t.critical)} ${t.reject?'≤':'>'} ${cutoffText(-t.critical,t.z)}`;return {body:!t.valid?unavailable(t):`<p class="hyp-action">正規分布表で決めた境目と、今回のZを比べます。</p><div class="hyp-decision-rule"><p class="hyp-equation" id="hyp-z-comparison">${comparison}</p><p id="hyp-decision">${decisionText(s,t)}</p></div>${plot(normalChart(t,{observed:true}))}${notes('紫の範囲が棄却域','今回のZが紫の範囲に入るかを見ます。',`<p>両側では|Z|が境目以上、右片側ではZが右の境目以上、左片側ではZが左の境目以下なら棄却します。</p>`)}`,
  takeaway:t.valid?(t.reject?'今回のZは棄却域に入るので、帰無仮説を棄却します。':'今回のZは棄却域に入らないので、帰無仮説を棄却しません。'):'この条件では判断しません。'};}
 case 7:{
  const h=hypothesisText(s.reference,s.direction,s.measureLabel),face=s.measureLabel==='正答率'&&s.reference===.5&&!s.dataInfo?.publicDerived&&s.dataInfo?.publicDataset?.links?.some(([,href])=>href.includes('2120481119'));
  const c=cutoffText(t.critical,t.z),region=s.direction==='two-sided'?`|Z| ≥ ${c}`:s.direction==='greater'?`Z ≥ ${c}`:`Z ≤ ${cutoffText(-t.critical,t.z)}`;
  return {body:!t.valid?unavailable(t):`<p class="hyp-action">仮説、検定の設定、計算結果、判断を振り返ります。</p><dl class="hyp-overview"><div data-summary="null"><dt>帰無仮説 H₀</dt><dd>${esc(h.null)}</dd></div><div data-summary="alternative"><dt>対立仮説 H₁</dt><dd>${esc(h.alternative)}</dd></div><div data-summary="settings"><dt>検定の設定</dt><dd>有意水準 <strong>${ratioText(s.alpha)}</strong>・${esc(directionLabel(s.direction))}<br>${n}人・大標本の正規近似</dd></div><div data-summary="observations"><dt>観測結果</dt><dd id="hyp-interpretation">標本平均 <strong>${ratioText(t.mean)}（${rateText(t.mean)}）</strong><br>基準との差 <strong>${fmt(t.difference*100,2)}ポイント</strong><br>標準誤差 ${ratioText(t.se)}・Z = <strong>${fmt(t.z,2)}</strong></dd></div></dl><div class="hyp-outcome hyp-summary-verdict"><h3>棄却域と判断</h3><p>棄却域：<strong id="hyp-summary-region">${region}</strong></p><p id="hyp-decision">${decisionText(s,t)}</p>${face&&t.difference<0&&t.reject?'<p>参加者の平均正答率は当てずっぽうの0.5を下回りました。<strong>無作為に選ぶ基準より、正答率が低かった</strong>という結果です。</p>':''}</div>`,
  takeaway:'仮説を決め、Zを計算し、正規分布表の境目と比較して、結果を解釈しました。'};
 }
 }
}
function errorBody(s) {
 if(s.errorStep===0)return {body:`<p class="hyp-action">標本からの判断には、2種類の誤りがあります。</p><div class="table-scroll hyp-error-table"><table class="stat-table"><caption>本当の状態と、帰無仮説の判断</caption><colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup><thead><tr><th scope="col">本当の状態</th><th scope="col">棄却する</th><th scope="col">棄却しない</th></tr></thead><tbody><tr><th scope="row">帰無仮説が正しい</th><td class="hyp-wrong">第1種の誤り</td><td class="hyp-correct">正しい判断</td></tr><tr><th scope="row">対立仮説が正しい</th><td class="hyp-correct">正しい判断</td><td class="hyp-wrong">第2種の誤り</td></tr></tbody></table></div><div class="hyp-error-pair"><div><h3>第1種：ない差を、あると判断</h3><p>帰無仮説が正しいのに棄却する。</p></div><div><h3>第2種：ある差を、見逃す</h3><p>対立仮説が正しいのに棄却しない。</p></div></div>${notes('この表の読み方','本当の状態と、検定の判断を分けて見ます。')}`,
 takeaway:'「ない差をあるとする誤り」と「ある差を見逃す誤り」を区別します。'};
 if(s.errorStep===1)return {body:`<p class="hyp-action">本当は帰無仮説が正しくても、偶然の大きなずれが起こることがあります。</p><div class="hyp-error-story"><p>本当は基準どおり</p><span aria-hidden="true">↓</span><p>たまたま、Zが棄却域に入る</p><span aria-hidden="true">↓</span><p><strong>棄却してしまう → 第1種の誤り</strong></p></div><p>有意水準${rateText(s.alpha)}は、このような誤りを小さく抑えるための基準です。</p>${notes('有意水準との関係','正規分布のモデルでは、帰無仮説のもとで棄却域に入る確率が有意水準です。',`<p>有意水準${rateText(s.alpha)}は、100回の調査で平均して約${ratioText(s.alpha*100)}回に相当します。</p>`)}`,
 takeaway:'帰無仮説が正しくても、偶然によって棄却する場合があります。'};
 return {body:`<p class="hyp-action">本当は調べたい向きに差があっても、標本のずれが小さい場合があります。</p><div class="hyp-error-story"><p>本当は差がある</p><span aria-hidden="true">↓</span><p>たまたま、Zが棄却域に入らない</p><span aria-hidden="true">↓</span><p><strong>棄却しない → 第2種の誤り（見逃し）</strong></p></div><p>棄却しない結果には、<strong>調べたい違いがない場合と、ある違いを見逃した場合</strong>があります。</p>${notes('見逃しが起こる理由','標本のばらつきによって、本当の差が小さく見えることがあります。')}`,
 takeaway:'第2種の誤りは、本当の差を見逃すことです。'};
}
function wire(root,ctx,s,isErrors) {
 root.querySelectorAll('input[type=number]').forEach(el=>{el.required=true;});
 const key=isErrors?'errorStep':'testStep',steps=isErrors?errorStages:testStages;
 const validInputs=()=>{const bad=[...root.querySelectorAll('input')].find(el=>!el.checkValidity());if(bad){bad.reportValidity();return false;}return true;};
 const move=index=>{ctx.update({[key]:index});const title=root.querySelector('#hyp-step-title');title?.focus({preventScroll:true});const pane=root.querySelector('.hypothesis-test-display');if(pane)pane.scrollTop=0;const body=root.querySelector('.hyp-step-body');if(body)body.scrollTop=0;if(!pane?.closest('.statistics-fullscreen')&&title?.getBoundingClientRect().top<0)title.scrollIntoView({block:'start',behavior:'smooth'});};
 root.querySelectorAll('[data-hyp-stage]').forEach(el=>el.addEventListener('click',()=>{const index=Number(el.dataset.hypStage);if(index>s[key]&&!validInputs())return;move(index);}));
 root.querySelector('#hyp-prev')?.addEventListener('click',()=>move(Math.max(0,s[key]-1)));
 root.querySelector('#hyp-next')?.addEventListener('click',()=>{if(!validInputs())return;if(s[key]<steps.length-1)move(s[key]+1);else if(!isErrors){ctx.update({errorStep:0});document.querySelector('#view-1')?.click();root.querySelector('#hyp-step-title')?.focus({preventScroll:true});}});
 root.querySelector('#hyp-open-data')?.addEventListener('click',()=>document.querySelector('#data-tab')?.click());
 const settings=(patch,stage)=>ctx.update({...patch,testStep:Math.min(s.testStep,stage),errorStep:0,probabilityReady:false});
 const reference=root.querySelector('#hyp-reference');
 const validateReference=()=>{
  const value=Number(reference.value),valid=reference.value!==''&&Number.isFinite(value)&&value>0&&value<1;
  // With no min, the value attribute is the native spinbutton's step base.
  // Re-anchor after direct input so arbitrary decimals still step by 0.01.
  reference.setAttribute('value',reference.value);
  reference.setCustomValidity(valid?'':'0より大きく1より小さい値を入力してください。');
  return valid;
 };
 reference?.addEventListener('input',validateReference);
 reference?.addEventListener('change',()=>{if(validateReference())settings({reference:Number(reference.value)},1);});
 root.querySelectorAll('[name=hyp-direction]').forEach(el=>el.addEventListener('change',()=>settings({direction:el.value},1)));
 root.querySelectorAll('[name=hyp-alpha]').forEach(el=>el.addEventListener('change',()=>settings({alpha:Number(el.value)},2)));
 root.querySelector('#hyp-bin-width')?.addEventListener('change',e=>{if(e.target.value!==''&&e.target.checkValidity())ctx.update({binWidth:Number(e.target.value),selectedBin:-1});});
 root.querySelectorAll('[data-hyp-bin]').forEach(el=>{const choose=()=>ctx.update({selectedBin:Number(el.dataset.hypBin)});el.addEventListener('click',choose);el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});});
}
export default {
 id:'hypothesis-test',title:'統計的な判断と仮説検定',description:'ヒストグラムから仮説を作り、Zと正規分布表で判断する。',
 initial:()=>({...guideDefaults,participants:aiFaceParticipants(),alpha:.05,planN:315,trueMean:.48152281746031744}),
 normalize(state) {
  const next=normalizeGuide(state);
  if(next.dataInfo?.publicDataset?.links?.some(([,href])=>href.includes('2120481119')))
    next.dataInfo={...next.dataInfo,publicDataset:{...next.dataInfo.publicDataset,interpretation:publicDatasetInfo('hypothesis-test').interpretation}};
  return next;
 },guidedFlow:true,related:['sampling','crosstab'],explanation:academicExplanation('hypothesis-test'),
  renderDataExtras(root) {
    for(const version of ['v1','v2']) {
      let old;try{old=JSON.parse(localStorage.getItem(`study-atlas-statistics-hypothesis-test-${version}`));}catch{}
      if(old?.state?.dataInfo?.origin!=='user')continue;
      const s=old.state,isTwo=version==='v1';
      if(!(isTwo?[s.nA,s.nB,s.successA,s.successB]:[s.n,s.success]).every(Number.isFinite))continue;
      const box=document.createElement('details'),id=isTwo?'hyp-old-csv':'hyp-previous-count-csv';
      box.className='panel';box.innerHTML=`<summary>以前の${isTwo?'2群':'個数集計'}の保存データ</summary><p>保存したデータをCSVで取り出せます。</p><button id="${id}" type="button">以前のデータをCSVで保存</button>`;
      root.append(box);box.querySelector('button').onclick=()=>downloadCSV(`以前の${isTwo?'2群':'個数集計'}データ.csv`,s.dataInfo.columns||['対象','総数','該当数'],isTwo?[[s.groupLabels?.[0]||'A',s.nA,s.successA],[s.groupLabels?.[1]||'B',s.nB,s.successB]]:[[s.label||'対象',s.n,s.success]]);
    }
  },
 render(root,ctx) {
  const s=normalizeGuide(ctx.state),scores=participantScores(s.participants),t=normalMeanTest(scores,s.reference,s.alpha,s.direction),isErrors=(ctx.view||0)===1;
  const content=isErrors?errorBody(s):testBody(s,scores,t);root.innerHTML=wizard(s,isErrors,content,t);wire(root,ctx,s,isErrors);
 }
};
