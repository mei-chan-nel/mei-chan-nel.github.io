export const SIZE = {width: 1100, height: 930};
export const REGIONS = {
  notice: {label: 'お知らせ', box: [28, 179, 1044, 66]},
  status: {label: '状態表示', box: [28, 246, 336, 85]},
  warning: {label: '注意パネル', box: [740, 88, 310, 58]},
  map: {label: '会場案内図', box: [28, 346, 600, 252]},
  timetable: {label: 'タイムテーブル', box: [646, 614, 426, 271]},
  chart: {label: '混雑予想グラフ', box: [28, 614, 600, 271]},
  panels: {label: '案内パネル', box: [646, 346, 426, 252]},
};
export const COLORS = {red:'#c66f4a', green:'#758b4b', blue:'#0072b2', orange:'#e69f00', purple:'#6b3e75', chartOrange:'#a66b00', mapBlue:'#3798c3', mapGreen:'#45a58e', ink:'#203b40', soft:'#52686d'};
// One source for the final venue colors and names across the map, panels and timetable.
export const VENUES = [
  {name:'体育館', category:'ステージ', activity:'ステージ', color:COLORS.blue, foreground:'#ffffff', mapBefore:COLORS.red, panelBefore:'#728d78'},
  {name:'中庭', category:'模擬店', activity:'飲食エリア', color:COLORS.orange, foreground:COLORS.ink, mapBefore:COLORS.mapGreen, panelBefore:'#567658'},
  {name:'校舎', category:'展示', activity:'展示エリア', color:COLORS.purple, foreground:'#ffffff', mapBefore:COLORS.mapBlue, panelBefore:'#697ba3'},
];
export const IMPROVEMENTS = [
  {name:'状態表示', title:'状態と凡例を文字・記号でそろえる', region:'status',
    question:'点の色が似ても、受付状況が分かる？',
    observation:'受付状況の点と上の凡例を見比べましょう。P・D型で、点の色だけから状況を判断できますか。',
    change:'受付中を青い○、受付終了を濃いオレンジの■にし、上の凡例と受付欄の両方を同じ色・形にそろえます。',
    benefit:'凡例と受付欄が対応し、受付中／受付終了の文字からも状況を確認できます。',
    remaining:'案内パネル、お知らせ、地図、時刻表、グラフには問題が残っています。',
    sideEffect:'文字を追加した分の余白が必要です。この例では受付名と状態を上下に分けています。',
    tip:'凡例の○・■と、各受付欄の○・■が一致することを確認しよう。'},
  {name:'パネルの配色', title:'会場ごとの色を区別する', region:'panels',
    question:'背景色を分ければ、白い文字も読みやすくなる？',
    observation:'元のステージと飲食は緑系の配色です。P・D列での背景の違いと、3枚の白文字を見比べましょう。',
    change:'案内パネルを青・オレンジ・濃い紫に変更。後の地図と時刻表にも同じ会場色を使います。',
    benefit:'この例のP・D列でも背景の違いを確認できます。ステージの白文字は3.62:1から5.19:1、展示は4.23:1から8.17:1になります。',
    remaining:'会場名はまだありません。地図と時刻表は旧配色なので、後の工程で対応をそろえます。',
    sideEffect:'飲食の白文字は5.09:1から2.25:1へ悪化しました。色の区別と文字の明暗差は、別々に確認する必要があります。',
    tip:'配色変更だけでは改善しきれません。次は背景色を保ったまま、文字を読みやすくします。', evidence:'panelsPalette'},
  {name:'パネルの文字', title:'色を保って文字を読みやすくする', region:'panels',
    question:'背景色を薄くせず、飲食の文字を読みやすくできる？',
    observation:'オレンジと白文字の明暗差に注目しましょう。青・オレンジ・紫の区別も、ここで失わないようにします。',
    change:'背景色はそのまま、飲食だけ濃い文字へ変更。会場名を加え、会場・区切り線・内容を固定した列でそろえます。',
    benefit:'飲食は2.25:1から5.29:1へ改善。青と紫の白文字も4.5:1以上を保ち、3つの背景色は薄くなりません。',
    remaining:'地図と時刻表は旧配色です。お知らせと地図の文字、時刻表の会場表示、グラフにも課題が残っています。',
    sideEffect:'会場名の追加で文字数が増えます。列の幅を固定し、区切り線と内容がずれないようにしています。',
    tip:'会場名を読み取り、改善前後で背景色が同じことも確かめよう。', evidence:'panelsText'},
  {name:'お知らせ', title:'大切なお知らせを伝える', region:'notice',
    question:'淡い文字だけで、変更の重要さが伝わる？',
    observation:'黄色いお知らせ帯を拡大します。開演時刻が変わったことを、すぐに見つけられますか。',
    change:'お知らせ帯の文字を濃くし、見出しに「重要」を加えます。',
    benefit:'文字と背景の比率が2.14:1から7.87:1へ上がります。「重要」の文字でも意味を伝えます。',
    remaining:'注意パネルの赤系文字と緑系背景、地図の白文字と配色、時刻表・グラフの色依存は未改善です。',
    sideEffect:'強調語を増やしすぎると、重要な情報を探しにくくなります。この例では変更のお知らせに絞っています。',
    tip:'「重要」という言葉も手掛かりになっているか確かめよう。', evidence:'notice'},
  {name:'文字と背景', title:'赤系の文字と緑系の背景を見直す', region:'warning',
    question:'注意パネルの文字と背景は、十分に分かれている？',
    observation:'右上の注意パネルは赤系の文字と緑系の背景です。この組み合わせは1.04:1。通常とP・D列の両方で、文字の見つけやすさを確認しましょう。',
    change:'注意パネルだけを淡い背景と濃い赤文字へ変更し、先頭に「注意」を加えます。立入禁止と展示場所の情報は残します。',
    benefit:'文字と背景の比率が1.04:1から7.80:1へ上がります。「注意」「立入禁止」の文字でも意味を伝えます。',
    remaining:'地図の白文字と配色、時刻表の会場表示、グラフの色による区別は未改善です。',
    sideEffect:'強調する要素が増えます。注意の範囲を1つのパネルにまとめ、通常の案内と区別しています。',
    tip:'赤と緑が常に不適切なのではありません。実際の色の明暗差と、シミュレーションでの見え方を確かめよう。', evidence:'warning'},
  {name:'会場案内図', title:'地図を会場色・名前・模様でそろえる', region:'map',
    question:'どこへ行こう？と地図の、同じ会場をたどれる？',
    observation:'元の地図は案内パネルと配色が違い、T列では中庭と校舎の色が近づきます。会場名の白文字も確認しましょう。',
    change:'会場色を案内パネルと統一し、模様と白地の会場名を追加。凡例には会場名と催しの分類を両方残します。',
    benefit:'同じ会場を同じ色で示し、会場名と模様でも確認できます。体育館＝ステージなどの対応も文字で分かります。',
    remaining:'時刻表の色帯だけは旧配色です。次の工程で会場名を加え、同じ会場色にそろえます。',
    sideEffect:'模様で情報が増えます。会場名の白地と凡例を設け、文字と模様が重ならないようにしています。',
    tip:'会場名があれば意味の重なるABCは不要です。地図と案内パネルを、会場名でも照合しよう。', evidence:'map'},
  {name:'タイムテーブル', title:'時刻表にも会場名と同じ色を使う', region:'timetable',
    question:'どのイベントが、どこで行われる？',
    observation:'左の色帯だけで会場を判断する負担と、地図・案内パネルとの色の違いを確認しましょう。',
    change:'時刻表の各行に体育館／中庭／校舎の会場名を追加し、色帯も地図・案内パネルと同じ色にそろえます。',
    benefit:'イベントごとの会場を文字で確認でき、3つのカードで色と会場名の対応が一致します。',
    remaining:'混雑予想グラフでは、ステージと模擬店を赤と緑の実線だけで区別しています。',
    sideEffect:'行の文字数が増えます。この例では会場名を独立した列に置き、時刻・催し名と重ならないようにしています。',
    tip:'地図→案内パネル→時刻表を、同じ会場名でたどってみよう。'},
  {name:'グラフ', title:'凡例を残し、線と直接ラベルを読みやすくする', region:'chart',
    question:'P・D列でも、どちらの線か迷わず追える？',
    observation:'2本の線が近づく14時付近を、P・D列でも追ってみましょう。上の凡例だけで、どちらの線か確認できますか。',
    change:'凡例を保ったまま青・濃いオレンジに変更。実線／破線、丸／四角を加え、右端に重ならない直接ラベルと引き出し線を置きます。',
    benefit:'凡例と線の手掛かりが一致し、右端の名前からも系列を確認できます。模擬店の線は白背景に4.44:1を確保します。',
    remaining:'実際の利用者の見え方や、小さい画面での文字サイズ・線の太さは引き続き確認が必要です。',
    sideEffect:'凡例と直接ラベルの両方で情報が増えます。この例では説明を右側の余白に分け、線や文字の重なりを避けています。',
    tip:'凡例をなくす必要はありません。線種・点・直接ラベルを、同じ系列の手掛かりとして確かめよう。', evidence:'chart'},
];
const initial = {title:'まず、ページ全体を見る', short:'初期状態', phase:'initial', state:0, number:0,
  version:'はじめのデザイン', regions:[], question:'色だけで伝えている情報は、どこだろう？',
  change:'まだ変更していません。通常・P・D・T型の4枚は、すべて同じ初期デザインを元にしています。',
  benefit:'まだデザインは改善していません。左側の3つの操作で、1箇所の改善とページ全体への効果を確かめます。',
  remaining:'状態表示、案内パネル、お知らせ、注意パネル、地図、時刻表、グラフを順番に扱います。',
  sideEffect:'変更はありません。各回の3つの操作には、いつでも自由に戻れます。',
  tip:'まずは「1 状態表示」の「拡大して観察」から始めよう。画像をクリックすると、1枚ずつ大きく表示できます。'};
export const STEPS = [initial, ...IMPROVEMENTS.flatMap((item,index)=>[
  {...item, title:`${item.name}を観察する`, short:'観察', phase:'observe', state:index, number:index+1,
    version:index===0?'はじめのデザイン':IMPROVEMENTS[index-1].title, regions:[item.region],
    change:`まだ変更しません。${item.observation}`, benefit:'まだデザインは改善していません。4種類で観察し、次の改善で何が変わるかを考えます。',
    remaining:item.observation, sideEffect:'この工程は拡大して見るだけです。画像内のデザインは変えていません。',
    tip:'次に、左側の同じ番号の「改善する」を選びましょう。拡大した場所は同じままです。', evidence:undefined},
  {...item, short:'改善', phase:'improve', state:index+1, number:index+1, version:item.title, regions:[item.region]},
  {...item, title:`${item.name}の改善を全体で見る`, short:'全体', phase:'overview', state:index+1, number:index+1,
    version:item.title, regions:[item.region],
    tip:index===IMPROVEMENTS.length-1
      ? '次は、一番下の「完成品を見る」で、注目枠を外した最終デザインを確かめよう。'
      : 'ページ全体での変化を確かめたら、次の番号の「拡大して観察」を選びましょう。'},
]), {title:'完成品を見る', short:'完成', phase:'complete', state:IMPROVEMENTS.length, number:IMPROVEMENTS.length,
  version:'完成した案内ページ', regions:[], question:'色が変わっても、必要な情報は伝わる？',
  change:`${IMPROVEMENTS.length}つの改善をすべて反映した案内ページです。注目枠を外して、ページ全体を表示しています。`,
  benefit:'状態・会場・グラフを、文字や記号、模様、線種、ラベルでも読み取れるようになりました。',
  remaining:'「完成」はこの教材の改善例です。実際の利用者による確認や、文字サイズ・読み上げなどの確認は別に必要です。',
  sideEffect:'この例では新しい重なりは見られません。追加した手掛かりが、情報を探す負担になっていないかも確かめましょう。',
  tip:'「0 ページ全体」と切り替えて、最初のデザインとの違いを見つけよう。各工程にはいつでも戻れます。'}];
export const CONTRAST_EXAMPLES = {
  panelsPalette:{title:'飲食パネル：文字と背景', before:['#ffffff',VENUES[1].panelBefore], after:['#ffffff',VENUES[1].color], kind:'text'},
  panelsText:{title:'飲食パネル：文字と背景', before:['#ffffff',VENUES[1].color], after:[VENUES[1].foreground,VENUES[1].color], kind:'text'},
  notice:{title:'お知らせ：文字と背景', before:['#c5a55b','#fff3d6'], after:['#654519','#fff3d6'], kind:'text'},
  warning:{title:'注意パネル：文字と背景', before:[COLORS.red,COLORS.green], after:['#8a2931','#fff1ed'], kind:'text'},
  map:{title:'地図の中庭：文字と背景', before:['#ffffff',VENUES[1].mapBefore], after:[COLORS.ink,'#ffffff'], kind:'text'},
  chart:{title:'模擬店：グラフの線と背景', before:[COLORS.green,'#ffffff'], after:[COLORS.chartOrange,'#ffffff'], kind:'graphic'},
};

// An original, fictional festival page, rasterized once before all simulations.
export function drawLesson(state) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width; canvas.height = SIZE.height;
  const c = canvas.getContext('2d', {colorSpace: 'srgb', willReadFrequently: true});
  const ink = COLORS.ink, soft = COLORS.soft, line = '#dce2df';
  const statusDone=state>=1, panelsColored=state>=2, panelsReadable=state>=3;
  const noticeDone=state>=4, warningDone=state>=5, mapDone=state>=6, timetableDone=state>=7;
  const chartCues=state>=8;
  const series=chartCues?[COLORS.blue,COLORS.chartOrange]:[COLORS.red,COLORS.green];
  const statusColors=statusDone?[COLORS.blue,COLORS.chartOrange]:[COLORS.green,COLORS.red];
  const text = (s,x,y,size=18,color=ink,weight=400) => {c.fillStyle=color;c.font=`${weight} ${size}px "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;c.fillText(s,x,y);};
  const rect = (x,y,w,h,color,r=0) => {c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
  const stroke = (x1,y1,x2,y2,color=line,width=1,dash=[]) => {c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.setLineDash([]);};
  const circle = (x,y,r,color) => {c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
  const card = (x,y,w,h) => {rect(x,y,w,h,'#ffffff',14);c.strokeStyle=line;c.lineWidth=1;c.stroke();};
  const marker = (x,y,color,square=false) => square ? rect(x-5,y-5,10,10,color) : circle(x,y,5,color);
  rect(0,0,1100,930,'#f4f5f0');
  rect(0,0,1100,54,'#fffef9');
  circle(39,28,13,'#e7a43a'); text('a',33,34,21,'#ffffff',700);
  text('AOBA FESTIVAL',62,34,19,ink,800); text('当日ガイド',259,34,15,soft);
  text('会場案内　　イベント　　アクセス',760,33,15,soft);
  rect(28,71,1044,94,'#e9ede4',16);
  circle(985,116,65,'#e2d4a4');circle(1042,153,48,'#b6ccbe');
  text('青葉祭',51,123,40,ink,800);text('今日の、楽しいを見つけよう。',210,120,25,ink,600);
  text('10.24 SAT  9:00–16:00  ｜  青葉高校',52,150,15,soft);
  rect(740,88,310,58,warningDone?'#fff1ed':COLORS.green,8);
  if(warningDone)rect(740,88,5,58,'#8a2931',2);
  text(warningDone?'注意｜校舎2階は立入禁止':'校舎2階は立入禁止',753,111,16,warningDone?'#8a2931':COLORS.red,700);
  text('展示は1階で開催しています',753,135,13,warningDone?'#8a2931':COLORS.red);
  rect(28,179,1044,66,'#fff3d6',12);
  text(noticeDone ? '重要｜体育館ステージの開演は10:30に変更しました。' : '体育館ステージの開演は10:30に変更しました。',48,206,18,noticeDone ? '#654519' : '#c5a55b',600);
  text('雨天時も開催します。ご来場の前に最新情報をご確認ください。',48,230,15,noticeDone ? '#654519' : '#c5a55b');
  const statusMark=(x,y,index,r)=>{
    if(statusDone&&index===0){c.strokeStyle=statusColors[index];c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}
    else if(statusDone)rect(x-r,y-r,r*2,r*2,statusColors[index]);
    else circle(x,y,r,statusColors[index]);
  };
  statusMark(48,251,0,4);text('受付中',58,255,10,soft);
  statusMark(151,251,1,4);text('受付終了',161,255,10,soft);
  card(28,258,336,73);text('ステージ受付',45,284,17,ink,600);text('体験受付',216,284,17,ink,600);
  if(statusDone){statusMark(53,308,0,7);text('受付中',70,315,18,ink,700);statusMark(224,308,1,7);text('受付終了',241,315,18,ink,700);}
  else{statusMark(130,310,0,9);statusMark(300,310,1,9);}
  card(382,258,336,73);text('本日の開催',399,284,17,ink,600);text('9:00–16:00',399,315,18,ink,600);
  card(736,258,336,73);text('ご来場の方へ',753,284,17,ink,600);text('入場無料・受付は正門',753,315,17,ink);
  card(28,346,600,252);text('CAMPUS MAP',48,374,12,soft,700);text('会場案内図',48,400,21,ink,700);
  const mapColors=VENUES.map(v=>mapDone?v.color:v.mapBefore);
  const blocks=[[52,420,175,93],[243,420,165,93],[424,420,180,93]];
  blocks.forEach(([x,y,w,h],i)=>{
    rect(x,y,w,h,mapColors[i],8);
    if(mapDone){
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      if(i===0) for(let k=x-100;k<x+w;k+=15)stroke(k,y,k+100,y+100,'#ffffff88',3);
      if(i===1)for(let u=x+9;u<x+w;u+=17)for(let v=y+9;v<y+h;v+=17)circle(u,v,2,'#ffffffbb');
      c.restore();
    }
    if(mapDone)rect(x+42,y+43,100,34,'#ffffff',4);
    text(VENUES[i].name,x+48,y+68,19,mapDone?ink:'#ffffff',700);
  });
  stroke(80,535,573,535,'#c6cfcb',8);text('↑ 正門',280,571,16,soft);
  const mapLegend=VENUES.map(v=>mapDone?`${v.name}：${v.category}`:v.category);
  mapLegend.forEach((v,i)=>{rect(48+i*185,580,10,8,mapColors[i]);text(v,65+i*185,589,13,ink);});
  card(646,614,426,271);text('PROGRAM',666,642,12,soft,700);text('タイムテーブル',666,668,21,ink,700);
  const events=[['10:30','吹奏楽ライブ',0],['11:00','焼きそば販売',1],['12:00','科学の実験室',2],['13:30','ダンス公演',0]];
  events.forEach(([time,name,cat],i)=>{
    const y=696+i*44,venue=VENUES[cat];rect(666,y-10,5,28,timetableDone?venue.color:venue.mapBefore,2);text(time,683,y+10,17,ink,600);text(name,750,y+10,17,ink);
    if(timetableDone)text(venue.name,969,y+10,15,ink,600);
    if(i<3)stroke(680,y+24,1051,y+24,line);
  });
  card(28,614,600,271);text('CROWD FORECAST',48,642,12,soft,700);text('混雑予想',48,668,21,ink,700);text('人数',48,703,12,soft);
  const xs=[85,183,281,379,477], ys=[[803,755,725,765,748],[821,796,750,727,741]];
  const chartLegend=(x,y,index,label)=>{stroke(x,y-5,x+28,y-5,series[index],3,chartCues&&index===1?[8,5]:[]);if(chartCues)marker(x+14,y-5,series[index],index===1);text(label,x+38,y,14,ink,600);};
  chartLegend(264,668,0,'ステージ');chartLegend(436,668,1,'模擬店');
  [720,765,810].forEach((y,i)=>{stroke(85,y,530,y,line);text(String(100-i*40),49,y+4,11,soft);});
  ['10時','11時','12時','13時','14時'].forEach((t,i)=>text(t,xs[i]-15,851,13,soft));
  for(let j=0;j<2;j++){
    c.strokeStyle=series[j];c.lineWidth=4;c.setLineDash(chartCues&&j===1?[10,7]:[]);c.beginPath();xs.forEach((x,i)=>i?c.lineTo(x,ys[j][i]):c.moveTo(x,ys[j][i]));c.stroke();c.setLineDash([]);
    if(chartCues)xs.forEach((x,i)=>marker(x,ys[j][i],series[j],j===1));
    if(chartCues){
      const labelY=j?722:782,dash=j?[6,4]:[];
      stroke(477,ys[j].at(-1),506,labelY-5,series[j],2,dash);stroke(506,labelY-5,528,labelY-5,series[j],2,dash);
      text(j?'模擬店':'ステージ',535,labelY,13,ink,700);
    }
  }
  text('※ 予想値です。実際の混雑状況とは異なります。',48,875,12,soft);
  card(646,346,426,252);text('PICK YOUR AREA',666,374,12,soft,700);text('どこへ行こう？',666,400,21,ink,700);
  VENUES.forEach((venue,i)=>{
    const y=419+i*59,background=panelsColored?venue.color:venue.panelBefore;
    const foreground=panelsReadable?venue.foreground:'#ffffff';
    rect(666,y,386,49,background,8);
    if(panelsReadable){
      text(venue.name,683,y+30,18,foreground,600);
      stroke(778,y+10,778,y+39,foreground,1);
      text(venue.activity,797,y+30,18,foreground,600);
    }else text(venue.activity,683,y+30,18,foreground,600);
    text('→',1020,y+31,23,foreground);
  });
  text('AOBA FESTIVAL 2026  ｜  このページは学習用の架空の案内です。',29,916,13,soft);
  return canvas;
}
