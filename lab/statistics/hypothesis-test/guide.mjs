export const testStages = ['データの単位と分布','帰無仮説と対立仮説','有意水準と検定方法','標本平均とばらつき','ずれをtで表す','帰無分布とp値','棄却するかを判断','問いに戻って解釈'];
export const errorStages = ['検定のルールと計画','第1種の誤り','第2種の誤り','2つの世界を見比べる','人数と有意水準を変える'];
export const guideDefaults = {reference:.5,direction:'two-sided',measureLabel:'正答率',referenceReason:'',testStep:0,errorStep:0,binWidth:5,selectedBin:-1,sigmaMode:'data',planningSD:.1};
export const normalizeGuide = state => ({...guideDefaults,...state});
export const directionLabel = direction => direction==='greater'?'上回る（右片側）':direction==='less'?'下回る（左片側）':'異なる（両側）';
export function hypothesisText(reference,direction,label='正答率') {
  const rate=(reference*100).toLocaleString('ja-JP',{maximumFractionDigits:4})+'%';
  return direction==='greater'?
    {null:`同じ条件での平均${label}は${rate}以下である。`,alternative:`同じ条件での平均${label}は${rate}を上回る。`}:
    direction==='less'?{null:`同じ条件での平均${label}は${rate}以上である。`,alternative:`同じ条件での平均${label}は${rate}を下回る。`}:
    {null:`同じ条件での平均${label}は${rate}である。`,alternative:`同じ条件での平均${label}は${rate}と異なる。`};
}
