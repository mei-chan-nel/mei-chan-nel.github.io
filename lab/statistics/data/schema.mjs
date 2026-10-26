// Declarative input roles. Display labels may change; statistical meanings do not.
const number = (name, aliases = [], extra = {}) => ({ name, aliases, type: 'number', min: -1e6, max: 1e6, ...extra });
const text = (name, aliases = [], extra = {}) => ({ name, aliases, type: 'text', maxLength: 100, ...extra });
export const schemas = {
  'graph-reading': { min: 2, max: 90, ordered: true, columns: [text('日付', [], {type:'date',unique:true}), number('日降水量（mm）',['降水量','日降水量'],{min:0,max:2000}), number('日平均気温（℃）',['平均気温','気温'],{min:-80,max:65}), number('日照時間（h）',['日照時間'],{min:0,max:24})], examples:[['2025-06-01',0,22,7],['2025-06-02',8,20,1],['2025-06-03',12,19,0]] },
  'missing-values': {min:2,max:90,ordered:true,columns:[text('日付・観測名',['日付','観測名'],{unique:true,maxLength:24}),number('降水量（mm）',['降水量','日降水量（mm）'],{min:0,max:2000,nullable:true})], examples:[['2025-06-01',0],['2025-06-02',null],['2025-06-03',12],['2025-06-04',4]]},
  histogram: {min:2,max:300,patterns:[1],columns:[number('値',['数値','value']),text('集団',['群','group'],{optional:true,default:'全体',categories:2})],examples:[[10,'A'],[12,'A'],[15,'A'],[11,'B'],[15,'B'],[18,'B']]},
  crosstab: {min:2,max:10000,patterns:[0,1,2],columns:[text('分類1',['学科','課題難度'],{categories:2,minimumCategories:2}),text('分類2',['性別','方式'],{categories:2,minimumCategories:2}),text('結果',['合否'],{categories:2,minimumCategories:2})],examples:[['前半','A','成功'],['前半','A','失敗'],['前半','B','成功'],['前半','B','失敗'],['後半','A','成功'],['後半','A','失敗'],['後半','B','成功'],['後半','B','失敗']]},
  correlation: {min:2,max:300,ordered:true,columns:[number('x',['X','横軸']),number('y',['Y','縦軸'])],examples:[[1,3],[2,4],[3,4],[4,7],[5,8]]},
  projects: {min:2,max:300,ordered:true,columns:[number('x',['X','横軸']),number('y',['Y','縦軸']),text('集団',['群','group'],{optional:true,default:'全体',categories:2,maxLength:40})],examples:[[1,3,'A'],[2,4,'A'],[3,4,'A'],[4,7,'B'],[5,8,'B']]},
  'time-series': {min:24,max:300,ordered:true,columns:[text('月',['年月'],{type:'month',unique:true}),number('値',['数値','支出金額'],{min:0})],examples:Array.from({length:24},(_,i)=>[`${2024+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,Math.round(100+i*2+20*Math.sin(i*Math.PI/6))])},
  sampling: {min:2,max:300,ordered:true,columns:[number('値',['数値','value'])],examples:[[10],[12],[14],[18],[20],[22]]},
  'hypothesis-test': {min:2,max:10000,ordered:true,columns:[text('参加者番号',['ID','id'],{unique:true}),number('判定枚数',['試行数'],{min:1,max:10000,integer:true}),number('正答数',['成功数'],{min:0,max:10000,integer:true})],examples:Array.from({length:30},(_,i)=>[`P${String(i+1).padStart(2,'0')}`,20,8+i%7])},
};
export function getSchema(id, labels = []) {
  const base=schemas[id];
  if(!base)throw Error('このラボの入力仕様がありません。');
  return {...base,id,columns:base.columns.map((c,i)=>({...c,aliases:[...(c.aliases||[]),...(labels[i]?[labels[i]]:[])]}))};
}
export function typeDescription(c){
  if(c.type==='date')return '日付 YYYY-MM-DD（重複なし・古い順）';
  if(c.type==='month')return '月 YYYY-MM（欠け・重複なし・古い順）';
  if(c.type==='number')return `${c.integer?'整数':'数値'} ${c.min}〜${c.max}${c.nullable?'／空欄・NAは欠損':''}`;
  return `${c.categories?`${c.minimumCategories===2?'2種類':'2種類まで'}のカテゴリ`:'文字列'}${c.unique?'（重複なし）':''}・${c.maxLength||100}文字以内${c.optional?'／省略可':''}`;
}
const columnName = n => {let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const missing = v => v===null||v===undefined||String(v).trim()===''||String(v).trim().toUpperCase()==='NA';
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
export function validateInput(document, schema) {
  const errors=[],warnings=[],add=(list,message,row=null,column=null)=>list.push({message,row,column});
  const {headers=[],rows=[],lineNumbers=[],labels=[],title=''}=document;
  if(title.length>120)add(errors,'表題は120文字以内にしてください。');
  if(!headers.length)add(errors,'列名の行がありません。ひな形の列名を残してください。');
  const seen=new Set();headers.forEach((h,c)=>{if(!String(h).trim())add(errors,`${columnName(c)}列の列名を入力してください。`);if(seen.has(h))add(errors,`列名「${h}」が重複しています。別の列名にしてください。`);seen.add(h);});
  const indices=schema.columns.map(c=>headers.findIndex(h=>[c.name,...c.aliases].includes(String(h).trim())));
  schema.columns.forEach((c,i)=>{if(indices[i]<0&&!c.optional)add(errors,`必要な「${c.name}」列が見つかりません。ひな形と同じ列名にしてください。`);});
  const extras=headers.filter((_,i)=>!indices.includes(i));
  if(extras.length)add(warnings,`分析に使わない列（${extras.join('、')}）があります。必要な列だけを取り込みます。`);
  if(rows.length<schema.min||rows.length>schema.max)add(errors,`このラボは${schema.min}〜${schema.max.toLocaleString('ja-JP')}件のデータが必要です。現在は${rows.length}件です。`);
  const safeLabels=schema.columns.map((c,i)=>labels[indices[i]]||headers[indices[i]]||c.name);
  safeLabels.forEach((v,i)=>{if(String(v).length>100)add(errors,`${columnName(i)}列の表示名は100文字以内にしてください。`);});
  const used=schema.columns.map(()=>new Set());let missingCount=0;
  const values=rows.slice(0,schema.max+1).map((r,i)=>{
    const row=lineNumbers[i]??i+2;
    if(r.length!==headers.length)add(errors,`${row}行目は${headers.length}列必要ですが、${r.length}列あります。区切りや空欄を確認してください。`,row);
    return schema.columns.map((c,j)=>{
      const at=indices[j];if(at<0)return c.optional?c.default:null;
      const raw=r[at],location=`${columnName(at)}列の${row}行目（${headers[at]}）`;
      const error=message=>add(errors,`${location}${message}`,row,at);
      if(raw&&typeof raw==='object'){error('に数式または対応していないセルが入っています。計算結果を「値として貼り付け」してください。');return null;}
      if(missing(raw)){if(c.nullable){missingCount++;return null;}error('は空欄にできません。値を入力してください。');return null;}
      let value=String(raw).trim();
      if(c.type==='number'){
        if(!numeric.test(value)||!Number.isFinite(Number(value))){error(`には数値が必要ですが、「${value.slice(0,60)}」と入力されています。単位や文字を除き、数値に修正してください。`);return null;}
        value=Number(value);
        if(value<c.min||value>c.max||c.integer&&!Number.isInteger(value))error(`は${c.min}〜${c.max}の${c.integer?'整数':'数値'}にしてください。`);
      }else{
        if(value.length>(c.maxLength||100))error(`は${c.maxLength||100}文字以内にしてください。`);
        if(c.type==='date'&&!day(value))error('は実在する日付をYYYY-MM-DD形式で入力してください。');
        if(c.type==='month'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))error('はYYYY-MM形式（例：2025-06）で入力してください。');
      }
      if(c.unique&&used[j].has(value))error(`の「${value}」は重複しています。一意の値にしてください。`);
      used[j].add(value);return value;
    });
  });
  schema.columns.forEach((c,j)=>{
    if(indices[j]<0)return;
    const count=used[j].size;
    if(c.categories&&(count>c.categories||count<(c.minimumCategories||1)))add(errors,`「${safeLabels[j]}」は${c.minimumCategories===2?'2種類':'1〜2種類'}のカテゴリが必要です。現在は${count}種類です。`);
  });
  // Domain conditions are independent from cell parsing; do not infer missing values.
  if(!errors.length){
    if(schema.id==='graph-reading'&&values.some((r,i)=>i&&r[0]<=values[i-1][0]))add(errors,'日付は古い順に並べてください。行の順序を自動では変更しません。');
    if(schema.id==='time-series'){
      const months=values.map(r=>Number(r[0].slice(0,4))*12+Number(r[0].slice(5)));
      if(months.some((v,i)=>i&&v!==months[i-1]+1))add(errors,'月は古い順に、欠け・重複のない連続した月を入力してください。');
      if(values.some(r=>r[1]===0))add(warnings,'0の月を基準にする伸び率・指数は計算できません。その箇所は計算不可として表示します。');
    }
    if(schema.id==='missing-values'){
      add(warnings,missingCount?`${missingCount}件の欠損値を空欄のまま取り込みます。補完方法は分析画面で比較できます。`:'欠損値がないため、補完方法を変えても値は変わりません。');
      if(values.every(r=>r[1]===null))add(warnings,'有効な観測値がありません。平均・中央値による補完や元の平均の計算はできません。');
      if(values.some((r,i)=>!day(r[0])||i&&r[0]<=values[i-1][0]))add(warnings,'日付が古い順のYYYY-MM-DDではないため線形補間は使えません。直前値補完は入力された行順を使います。');
    }
    if(schema.id==='hypothesis-test'){
      values.forEach((r,i)=>{if(r[2]>r[1])add(errors,`${columnName(indices[2])}列の${lineNumbers[i]??i+2}行目の正答数が判定枚数を超えています。判定枚数以下にしてください。`,lineNumbers[i]??i+2,indices[2]);});
      if(values.length<30)add(warnings,'30人未満では、このラボの大標本による正規近似の判断を進められません。分布や平均は確認できます。');
      if(new Set(values.map(r=>r[2]/r[1])).size===1)add(warnings,'全員の割合が同じで標準偏差が0です。Zによる判断はできません。');
    }
    if(['correlation','projects'].includes(schema.id)&&[0,1].some(c=>new Set(values.map(r=>r[c])).size<2))add(warnings,'値が一定の列があります。相関係数や一部の回帰計算は定義できません。');
    if(schema.id==='histogram'&&new Set(values.map(r=>r[1])).size===1)add(warnings,'集団が1種類なので、集団間の比較や分散分析は行いません。分布と代表値は確認できます。');
    if(schema.id==='crosstab'&&new Set(values.map(r=>JSON.stringify(r.slice(0,2)))).size<4)add(warnings,'観測のない分類の組合せがあります。分母が0になる割合は計算できません。');
  }
  return {errors,warnings,valid:!errors.length,data:{headers:safeLabels,rows:values,name:title.trim()||'自分のデータ'}};
}

// Return original row indices. The input and calculation order never change.
export function previewRows(rows,schema){
  const indices=rows.map((_,i)=>i);
  if(rows.length<=20)return {indices,omitted:0,representative:false};
  if(!schema.patterns)return {indices:[...indices.slice(0,10),...indices.slice(-10)],omitted:rows.length-20,representative:false};
  const buckets=new Map();rows.forEach((r,i)=>{const k=JSON.stringify(schema.patterns.map(c=>r[c]));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);});
  const groups=[...buckets.values()],picked=[];
  for(let level=0;picked.length<20;level++){let added=false;for(const g of groups){if(g[level]!==undefined){picked.push(g[level]);added=true;}if(picked.length===20)break;}if(!added)break;}
  return {indices:picked,omitted:rows.length-picked.length,representative:true,patterns:groups.length,shownPatterns:new Set(picked.map(i=>JSON.stringify(schema.patterns.map(c=>rows[i][c])))).size};
}
