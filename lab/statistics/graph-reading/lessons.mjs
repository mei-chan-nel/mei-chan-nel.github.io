import {histogram} from './model.mjs?v=20261025-rain-series';
export const KINDS=[['bar','棒グラフ'],['line','折れ線グラフ'],['pie','円グラフ'],['histogram','ヒストグラム'],['scatter','散布図']];
export const TASKS=[['compare','区分ごとの日数の差を比べたい'],['trend','気温がどう変化したか知りたい'],['share','全体に占める割合を知りたい'],['distribution','どの気温帯の日が多いか知りたい'],['relation','日照時間と気温の関係を知りたい']];
export const RECOMMENDED={compare:'bar',trend:'line',share:'pie',distribution:'histogram',relation:'scatter'};
export const VIEW_TASKS=[TASKS.map(t=>t[0]),['compare','trend'],['compare','share']];
export function rainGroups(rows,order=0){
 const groups=[{id:'lt1',label:'1mm未満',value:0},{id:'from1to10',label:'1mm以上10mm未満',value:0},{id:'gte10',label:'10mm以上',value:0}];
 for(const r of rows)groups[r[1]<1?0:r[1]<10?1:2].value++;
 return [...groups.slice(order),...groups.slice(0,order)];
}
export const weatherGroups=rainGroups;
function numericQuiz(prompt,value,unit,reason){
 const n=Number(value.toFixed(1)),values=[n,Number((n+2).toFixed(1)),Number((n>=2?n-2:n+4).toFixed(1))].sort((a,b)=>a-b);
 return {prompt,correct:String(n),options:values.map(v=>[String(v),`${v}${unit}`]),reason};
}
export function lesson(rows,task,order=0){
 const groups=rainGroups(rows,order),n=rows.length,first=rows[0][0],last=rows.at(-1)[0],context=`${first}〜${last}・${n}日分`;
 const below1=groups.find(g=>g.id==='lt1'),hi=groups.reduce((a,b)=>a.value>=b.value?a:b),lo=groups.reduce((a,b)=>a.value<=b.value?a:b);
 if(task==='compare')return {id:task,title:'最も多い区分と少ない区分は、何日違う？',context,items:groups,unit:'日数（日）',recommended:'bar',quiz:numericQuiz('最も多い区分と少ない区分の差は？',hi.value-lo.value,'日',`${hi.label}の${hi.value}日 − ${lo.label}の${lo.value}日 = ${hi.value-lo.value}日。棒の先端を共通の目盛りで比べます。`),reason:'項目ごとの量や差を比べるときは、共通の0から伸びる棒が読み取りやすくなります。区分には時間の順序がありません。'};
 if(task==='share')return {id:task,title:'日降水量1mm未満の日は、全体の何%？',context,items:groups,unit:'日数（日）',recommended:'pie',quiz:numericQuiz('日降水量1mm未満の日は、全日数の何%？',below1.value/n*100,'%',`${below1.value} ÷ ${n} × 100 = ${(below1.value/n*100).toFixed(1)}%。全${n}日を1つの円として読みます。`),reason:`全体を構成する互いに重ならない3区分の内訳です。円全体を${n}日・100%として、その中の割合を見るときは円グラフが適しています。`};
 if(task==='trend'){
  const values=rows.map(r=>r[2]),min=Math.min(...values),max=Math.max(...values);
  return {id:task,title:'日平均気温は、日付に沿ってどう変わった？',context,items:rows.map(r=>({label:r[0].slice(5),value:r[2]})),unit:'日平均気温（℃）',recommended:'line',quiz:numericQuiz('最高と最低の日平均気温の差は？',max-min,'℃',`${max.toFixed(1)}℃ − ${min.toFixed(1)}℃ = ${(max-min).toFixed(1)}℃。気温は差で読み取ります。`),reason:'日付には順序があり、隣り合う日の点を結ぶと上昇・下降の流れを追えます。気温は点の位置や差で読み、棒の長さの比や全体に占める割合とは区別します。'};
 }
 if(task==='distribution'){
  const bins=histogram(rows.map(r=>r[2]),2),peak=bins.reduce((a,b)=>a.value>=b.value?a:b);
  return {id:task,title:'日平均気温は、どの気温帯に集まっている？',context,items:bins,unit:'日数（日）',recommended:'histogram',quiz:numericQuiz(`気温${peak.label}℃の区間は何日？`,peak.value,'日',`${peak.label}℃の区間に入る日を数えると${peak.value}日です。各階級は左端以上・右端未満で集計します。`),reason:'連続した数値を同じ幅の区間に分け、日数を隙間のない棒で表します。山の位置や広がりを読むときはヒストグラムが適しています。'};
 }
 const target=rows.reduce((a,b)=>a[3]>=b[3]?a:b);
 return {id:'relation',title:'日照時間と日平均気温には、どんな関係がある？',context,rows,focusDay:target[0],recommended:'scatter',quiz:numericQuiz(`橙の点（${target[0]}）の日平均気温は？`,target[2],'℃',`${target[0]}は日照${target[3]}時間、日平均気温${target[2]}℃。1つの点で同じ日の2つの値を対応させます。`),reason:'2つの数値の対応を調べるときは、横軸と縦軸にそれぞれの量を置く散布図が適しています。日付順に線を結ぶ必要はありません。'};
}
export function suitability(task,kind){
 if(RECOMMENDED[task]===kind)return {level:'recommended',title:'この問いに適したグラフです',text:({bar:'同じ目盛りに沿って、日数の差を比べられます。',line:'点を日付順に結び、気温の変化を追えます。',pie:'円全体を100%として、区分の占める割合を読めます。',histogram:'気温の区間と日数を対応させ、分布の山を読めます。',scatter:'同じ日の2つの数値を、1つの点として読めます。'})[kind]};
 if(task==='trend'&&kind==='bar')return {level:'limited',title:'各日の高低は見えますが、変化の流れは追いにくくなります',text:'棒では日ごとの変化が見えにくく、0℃から棒を伸ばす意味もありません。気温の変化を見るには、折れ線が向いています。'};
 if(task==='trend'&&kind==='histogram')return {level:'limited',title:'多い気温帯は分かりますが、いつ変わったかは分かりません',text:'同じ日々のデータを気温の区間にまとめたため、日付の順序がなくなっています。分布を見るには有効ですが、日付順の変化は折れ線で確かめます。'};
 if(task==='trend')return {level:'unavailable',title:kind==='pie'?'気温を円グラフの内訳にはできません':'このタブでは散布図の2つの数値がそろいません',text:kind==='pie'?'円グラフは、1つの全体を100%として分ける図です。日ごとの気温は全体を分けた量ではないので、扇形の割合にはできません。':'ここでは日付に沿った気温の変化を見ています。「日照と気温」タブでは、同じ日の2つの数値を組にした散布図を試せます。'};
 if(['compare','share'].includes(task)&&kind==='line')return {level:'limited',title:'この線から時間変化は読めません',text:'横軸は日付ではなく3つの区分です。区分の順序を変えると線の形が変わります。線の右上がりを「増えた」とは読めません。'};
 if(task==='compare'&&kind==='pie')return {level:'limited',title:'内訳は分かりますが、差の比較には棒が向きます',text:'扇形の角度から内訳を読めます。何日違うかを比べるなら、共通の目盛りがある棒グラフが読みやすくなります。'};
 if(task==='share'&&kind==='bar')return {level:'limited',title:'日数は比較できます。全体の割合も確かめましょう',text:'棒グラフで各区分の日数を比較できます。全体を100%として内訳を読むなら、円グラフにすると分かりやすくなります。'};
 if(task==='distribution'&&['bar','line'].includes(kind))return {level:'limited',title:'区間ごとの日数は読めます',text:'数値の区間は連続しています。分布の山を捉えるには、棒を接して並べたヒストグラムで確かめましょう。'};
 if(task==='relation'&&['line','bar'].includes(kind))return {level:'limited',title:'時間ごとの変化は追えますが、2つの量の関係には散布図が向いています',text:'日付ごとの増減は見られます。ただし、日照時間と気温は単位も目盛りも違います。同じ日の2つの値の関係を見るには、1日を1点にまとめた散布図が分かりやすくなります。'};
 if(task==='relation')return {level:'unavailable',title:kind==='pie'?'日照時間と気温は円の内訳にできません':'ヒストグラムでは同じ日の2つの値の組を表せません',text:kind==='pie'?'時間と℃は単位が違い、足し合わせて1つの全体にはできません。円グラフには、同じ全体を分けた量を使います。':'それぞれの分布はヒストグラムで表せますが、どの日の2つの値かという対応が失われます。2つの量の関係を見るには散布図を使います。'};
 if(kind==='histogram')return {level:'limited',title:'降水量の分布は読めますが、3区分の内訳とは区切りが違います',text:'ヒストグラムは同じ幅の区間で集計しています。ここで比べたい「1mm未満・1mm以上10mm未満・10mm以上」の日数は、棒や円で確認できます。'};
 if(kind==='scatter')return {level:'unavailable',title:'区分の日数だけでは散布図の点を作れません',text:'散布図の1点には、同じ対象から得た2つの数値が必要です。このタブでは降水量1項目を区分ごとに集計しています。2つの数値の関係は「日照と気温」タブで試せます。'};
 return {level:'unavailable',title:'表したいデータと、グラフの役割が合いません',text:kind==='scatter'?'散布図には、対応する2つの数値が必要です。この問いは1つの値や区分を比べています。':kind==='histogram'?'ヒストグラムは数値の分布を見る図です。区分の内訳や2つの数値の対応を表す図とは異なります。':'この問いで必要な対応を保ったまま表せるグラフを選びましょう。'};
}
export function rainAxisExample(rows){
 const sorted=rows.filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]),a=sorted[0],b=sorted.find(r=>r[1]<a[1]);
 return a&&b?{items:[{label:a[0].slice(5),value:a[1]},{label:b[0].slice(5),value:b[1]}],ratio:a[1]/b[1],limit:Math.max(0,b[1]-.1)}:null;
}

export function supportedKinds(task){
 return task==='trend'?['line','bar','histogram']:task==='relation'?['scatter','line','bar']:['bar','line','pie','histogram'];
}
