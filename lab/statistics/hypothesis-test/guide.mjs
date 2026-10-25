export const testStages = ['ヒストグラム','帰無仮説と対立仮説','有意水準と検定方法','標本平均とばらつき','ずれをZで表す','正規分布表を読む','棄却するかを判断','問いに戻って解釈'];
export const errorStages = ['2つの誤り','第1種の誤り','第2種の誤り'];
export const guideDefaults = {reference:.5,direction:'two-sided',measureLabel:'正答率',referenceReason:'',testStep:0,errorStep:0,binWidth:5,selectedBin:-1,sigmaMode:'data',planningSD:.1,probabilityReady:false};
export const normalizeGuide = state => ({...guideDefaults,...state,...([3,4].includes(state.errorStep)?{errorStep:2}:{}),...(state.binWidth===20?{binWidth:10,selectedBin:-1}:{})});
export const rateText = (value,digits=2) => (value*100).toLocaleString('ja-JP',{maximumFractionDigits:digits})+'%';
export const directionLabel = direction => direction==='greater'?'上回る（右片側）':direction==='less'?'下回る（左片側）':'異なる（両側）';
export const ratioText = (value,digits=4) => String(Number(value.toPrecision(digits)));
export function hypothesisText(reference,direction,label='正答率') {
  const value=ratioText(reference,6),relation=direction==='greater'?'≤':direction==='less'?'≥':'=';
  const alternative=direction==='greater'?'>':direction==='less'?'<':'≠';
  return {null:`μ ${relation} ${value}（μは母平均${label}）`,alternative:`μ ${alternative} ${value}`};
}
