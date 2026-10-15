export const SIZE = {width: 1100, height: 930};
export const REGIONS = {
  notice: {label: 'お知らせ', box: [28, 179, 1044, 66]},
  status: {label: '状態表示', box: [28, 246, 336, 85]},
  map: {label: '会場案内図', box: [28, 346, 600, 252]},
  timetable: {label: 'タイムテーブル', box: [646, 346, 426, 252]},
  chart: {label: '混雑予想グラフ', box: [28, 614, 600, 271]},
  panels: {label: '案内パネル', box: [646, 614, 426, 271]},
};
export const IMPROVEMENTS = [
  {name:'状態表示', title:'状態を文字と記号で伝える', region:'status',
    question:'点の色が似ても、受付状況が分かる？',
    observation:'受付状況の点と凡例を見比べましょう。P・D型で、点の色だけから状況を判断できますか。',
    change:'受付状況の1つのエリアだけを変更。青・オレンジに置き換え、○ 受付中／■ 受付終了を併記します。',
    benefit:'凡例の色を覚えなくても、文字と記号から受付状況を確認できます。',
    remaining:'案内パネル、お知らせ、地図、時刻表、グラフには問題が残っています。',
    sideEffect:'この箇所で新しい重なりはありません。文字を追加した分の余白も確認しましょう。',
    tip:'同じ拡大位置で観察と改善を切り替え、点だけの状態と見比べてみよう。'},
  {name:'パネルの配色', title:'案内パネルの色を変える', region:'panels',
    question:'色を変えれば、文字も読みやすくなる？',
    observation:'3枚の案内パネルの白文字を見比べます。元のステージは3.62:1、展示は4.23:1で、通常文字の4.5:1を下回っています。',
    change:'「どこへ行こう？」の案内パネルだけを青・オレンジの配色へ変更します。',
    benefit:'この例のP・D列でも、ステージと飲食の背景が分かれます。ステージの白文字は5.19:1に改善します。',
    remaining:'分類名は元から文字で読めますが、会場名はありません。展示の白文字も4.23:1のままです。',
    sideEffect:'飲食エリアの白文字とオレンジのコントラストが5.09:1から2.25:1へ下がりました。',
    tip:'「飲食エリア」の白文字に注目。配色変更の効果と、新しい読みにくさを確認しよう。', evidence:2},
  {name:'パネルの文字', title:'案内パネルを読みやすくする', region:'panels',
    question:'飲食エリアの白い文字は読みやすい？',
    observation:'直前の配色変更を残したまま、案内パネルを拡大します。オレンジと白文字の明暗差に注目しましょう。',
    change:'案内パネルだけを淡い背景＋濃い文字へ変更し、体育館・中庭・校舎の会場名も添えます。',
    benefit:'3枚とも文字と背景の比率が10:1を超え、会場名も読めます。背景色を地図の色と照合する必要はありません。',
    remaining:'お知らせと地図の文字の明暗差、時刻表の会場表示、グラフの色による区別は未改善です。',
    sideEffect:'この箇所に新しい重なりはありません。分類の色が淡くなっても、会場名が手掛かりになります。',
    tip:'会場名と文字の明暗差を確認したら、全体表示でもバランスを見てみよう。', evidence:3},
  {name:'お知らせ', title:'大切なお知らせを伝える', region:'notice',
    question:'淡い文字だけで、変更の重要さが伝わる？',
    observation:'黄色いお知らせ帯だけを拡大します。開演時刻が変わったことを、すぐに見つけられますか。',
    change:'お知らせ帯だけの文字を濃くし、見出しに「重要」を加えます。',
    benefit:'文字と背景の比率が2.14:1から7.87:1へ上がります。「重要」の文字でも意味を伝えます。',
    remaining:'地図の白文字と背景の明暗差、時刻表の会場分類、グラフの実線は未改善です。',
    sideEffect:'この箇所で新しい問題は見つかっていません。強調語を増やしすぎないことも大切です。',
    tip:'色を変えただけでなく、「重要」という言葉も手掛かりになっているか確かめよう。', evidence:4},
  {name:'会場案内図', title:'地図を模様と記号でも分ける', region:'map',
    question:'T型で青と緑が近づいても、会場をたどれる？',
    observation:'会場案内図だけを拡大します。特にT型の中庭と校舎、各会場の白い文字を見てみましょう。',
    change:'地図だけにA・B・Cと模様、白地の会場名を追加。凡例には会場名と、元からあった催しの分類を両方残します。',
    benefit:'会場名の明暗差を改善し、色が似ても記号と模様で会場をたどれます。体育館＝ステージなどの対応も文字で分かります。',
    remaining:'時刻表は会場を色で示したままです。グラフにも色だけの区別が残っています。',
    sideEffect:'記号と模様で情報が増えました。会場名を囲む白地を用意し、文字と模様が重ならないようにしています。',
    tip:'中庭と校舎を、色の名前を使わず説明できるか試してみよう。', evidence:5},
  {name:'タイムテーブル', title:'時刻表に会場名を加える', region:'timetable',
    question:'どのイベントが、どこで行われる？',
    observation:'タイムテーブルだけを拡大します。左の色帯だけで会場を判断する負担を考えてみましょう。',
    change:'時刻表のカードだけに、A 体育館／B 中庭／C 校舎のラベルを追加します。',
    benefit:'地図の色と照合せずに、イベントごとの会場を文字と記号で確認できます。',
    remaining:'混雑予想グラフでは、ステージと模擬店を赤と緑の実線だけで区別しています。',
    sideEffect:'行の文字数が増えました。この例では列を分けて重なりを避けていますが、小さな画面でも確認が必要です。',
    tip:'地図と同じA・B・Cが、時刻表でも意味を持つことを確認しよう。'},
  {name:'グラフの手掛かり', title:'グラフを線種と点でも分ける', region:'chart',
    question:'P・D型で2本の実線を追い続けられる？',
    observation:'混雑予想グラフだけを拡大します。2本の線が近づく14時付近を、P・D型でも追ってみましょう。',
    change:'グラフのカードだけを変更。青・オレンジにし、実線と破線、丸と四角、線の右端の名前を追加します。',
    benefit:'色が似ても、線種と点の形で系列を追えるようになります。',
    remaining:'右端の系列名が重なり、模擬店のオレンジは白背景に対して2.25:1で、線の明暗差も不足しています。',
    sideEffect:'このラベル配置では名前が重なりました。オレンジの線は、必要な図形と背景の3:1の目安も下回ります。',
    tip:'手掛かりは増えましたが、まだ改善途中です。名前の位置と、線そのものの見つけやすさも確認しよう。', evidence:7},
  {name:'グラフの整理', title:'グラフの名前を整理する', region:'chart',
    question:'重なった系列名を、読みやすくできる？',
    observation:'直前のグラフをそのまま拡大します。右端の重なったラベルと、明るいオレンジの線に注目しましょう。',
    change:'グラフだけの名前を上部の凡例へ移し、線種と点を併記。オレンジの線を濃くします。',
    benefit:'名前の重なりを解消。模擬店の線と白背景の比率は2.25:1から4.44:1へ上がり、線種と点でもたどれます。',
    remaining:'実際の利用者の見え方、端末での文字サイズ、説明の分かりやすさは引き続き確認が必要です。',
    sideEffect:'凡例と線を見比べる必要が生じます。直接ラベルも、重ならない位置に置ければ有効です。',
    tip:'凡例が常に最善とは限りません。この例の改善効果と、照合する手間を確かめよう。', evidence:8},
];
const initial = {title:'まず、ページ全体を見る', short:'初期状態', phase:'initial', state:0, number:0,
  version:'はじめのデザイン', regions:[], question:'色だけで伝えている情報は、どこだろう？',
  change:'まだ変更していません。通常・P・D・T型の4枚は、すべて同じ初期デザインを元にしています。',
  benefit:'まだデザインは改善していません。左側の3つの操作で、1箇所の改善とページ全体への効果を確かめます。',
  remaining:'状態表示、案内パネル、お知らせ、地図、時刻表、グラフを順番に扱います。',
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
  change:'8つの改善をすべて反映した案内ページです。注目枠を外して、ページ全体を表示しています。',
  benefit:'状態・会場・グラフを、文字や記号、模様、線種、ラベルでも読み取れるようになりました。',
  remaining:'「完成」はこの教材の改善例です。実際の利用者による確認や、文字サイズ・読み上げなどの確認は別に必要です。',
  sideEffect:'この例では新しい重なりは見られません。追加した手掛かりが、情報を探す負担になっていないかも確かめましょう。',
  tip:'「0 ページ全体」と切り替えて、最初のデザインとの違いを見つけよう。各工程にはいつでも戻れます。'}];
export const COLORS = {red:'#c66f4a', green:'#758b4b', blue:'#0072b2', orange:'#e69f00', chartOrange:'#a66b00', mapBlue:'#3798c3', mapGreen:'#45a58e', ink:'#203b40', soft:'#52686d'};
export const CONTRAST_EXAMPLES = {
  2:{title:'飲食パネル：文字と背景', before:['#ffffff','#567658'], after:['#ffffff',COLORS.orange], kind:'text'},
  3:{title:'飲食パネル：文字と背景', before:['#ffffff',COLORS.orange], after:[COLORS.ink,'#fff3d6'], kind:'text'},
  4:{title:'お知らせ：文字と背景', before:['#c5a55b','#fff3d6'], after:['#654519','#fff3d6'], kind:'text'},
  5:{title:'地図の中庭：文字と背景', before:['#ffffff',COLORS.mapGreen], after:[COLORS.ink,'#ffffff'], kind:'text'},
  7:{title:'模擬店：グラフの線と背景', before:[COLORS.green,'#ffffff'], after:[COLORS.orange,'#ffffff'], kind:'graphic'},
  8:{title:'模擬店：グラフの線と背景', before:[COLORS.orange,'#ffffff'], after:[COLORS.chartOrange,'#ffffff'], kind:'graphic'},
};

// An original, fictional festival page, rasterized once before all simulations.
export function drawLesson(state) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width; canvas.height = SIZE.height;
  const c = canvas.getContext('2d', {colorSpace: 'srgb', willReadFrequently: true});
  const ink = COLORS.ink, soft = COLORS.soft, line = '#dce2df';
  const statusDone=state>=1, panelsColored=state>=2, panelsReadable=state>=3;
  const noticeDone=state>=4, mapDone=state>=5, timetableDone=state>=6;
  const chartCues=state>=7, chartOrganized=state>=8;
  const series=chartCues?[COLORS.blue,chartOrganized?COLORS.chartOrange:COLORS.orange]:[COLORS.red,COLORS.green];
  const statusColors=statusDone?[COLORS.blue,COLORS.orange]:[COLORS.green,COLORS.red];
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
  rect(28,179,1044,66,'#fff3d6',12);
  text(noticeDone ? '重要｜体育館ステージの開演は10:30に変更しました。' : '体育館ステージの開演は10:30に変更しました。',48,206,18,noticeDone ? '#654519' : '#c5a55b',600);
  text('雨天時も開催します。ご来場の前に最新情報をご確認ください。',48,230,15,noticeDone ? '#654519' : '#c5a55b');
  circle(48,251,4,statusColors[0]);text('受付中',58,255,10,soft);
  circle(151,251,4,statusColors[1]);text('受付終了',161,255,10,soft);
  card(28,258,336,73);text('ステージ受付',45,284,17,ink,600);text('体験受付',216,284,17,ink,600);
  if(statusDone){text('○ 受付中',45,315,18,ink,700);text('■ 受付終了',216,315,18,ink,700);}
  else{circle(130,310,9,statusColors[0]);circle(300,310,9,statusColors[1]);}
  card(382,258,336,73);text('本日の開催',399,284,17,ink,600);text('9:00–16:00',399,315,18,ink,600);
  card(736,258,336,73);text('ご来場の方へ',753,284,17,ink,600);text('入場無料・受付は正門',753,315,17,ink);
  card(28,346,600,252);text('CAMPUS MAP',48,374,12,soft,700);text('会場案内図',48,400,21,ink,700);
  const mapColors=[COLORS.red,COLORS.mapGreen,COLORS.mapBlue];
  const blocks=[[52,420,175,93],[243,420,165,93],[424,420,180,93]];
  blocks.forEach(([x,y,w,h],i)=>{
    rect(x,y,w,h,mapColors[i],8);
    if(mapDone){
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      if(i===0) for(let k=x-100;k<x+w;k+=15)stroke(k,y,k+100,y+100,'#ffffff88',3);
      if(i===1)for(let u=x+9;u<x+w;u+=17)for(let v=y+9;v<y+h;v+=17)circle(u,v,2,'#ffffffbb');
      rect(x+8,y+8,35,30,'#ffffff',4);text(['A','B','C'][i],x+17,y+30,22,ink,800);c.restore();
    }
    if(mapDone)rect(x+42,y+43,100,34,'#ffffff',4);
    text(['体育館','中庭','校舎'][i],x+48,y+68,19,mapDone?ink:'#ffffff',700);
  });
  stroke(80,535,573,535,'#c6cfcb',8);text('↑ 正門',280,571,16,soft);
  const mapLegend=mapDone?['A 体育館：ステージ','B 中庭：模擬店','C 校舎：展示']:['ステージ','模擬店','展示'];
  mapLegend.forEach((v,i)=>{rect(48+i*185,580,10,8,mapColors[i]);text(v,65+i*185,589,13,ink);});
  card(646,346,426,252);text('PROGRAM',666,374,12,soft,700);text('タイムテーブル',666,400,21,ink,700);
  const events=[['10:30','吹奏楽ライブ',0],['11:00','焼きそば販売',1],['12:00','科学の実験室',2],['13:30','ダンス公演',0]];
  events.forEach(([time,name,cat],i)=>{
    const y=428+i*40;rect(666,y-10,5,28,mapColors[cat],2);text(time,683,y+10,17,ink,600);text(name,750,y+10,17,ink);
    if(timetableDone)text(['A 体育館','B 中庭','C 校舎'][cat],951,y+10,13,ink,600);
    if(i<3)stroke(680,y+24,1051,y+24,line);
  });
  card(28,614,600,271);text('CROWD FORECAST',48,642,12,soft,700);text('混雑予想',48,668,21,ink,700);text('人数',48,703,12,soft);
  const xs=[85,183,281,379,477], ys=[[803,755,725,765,748],[821,796,750,727,741]];
  const chartLegend=(x,y,index,label)=>{stroke(x,y-5,x+28,y-5,series[index],3,chartCues&&index===1?[8,5]:[]);if(chartCues)marker(x+14,y-5,series[index],index===1);text(label,x+38,y,14,ink,600);};
  if(!chartCues||chartOrganized){chartLegend(264,668,0,'ステージ');chartLegend(436,668,1,'模擬店');}
  [720,765,810].forEach((y,i)=>{stroke(85,y,530,y,line);text(String(100-i*40),49,y+4,11,soft);});
  ['10時','11時','12時','13時','14時'].forEach((t,i)=>text(t,xs[i]-15,851,13,soft));
  for(let j=0;j<2;j++){
    c.strokeStyle=series[j];c.lineWidth=4;c.setLineDash(chartCues&&j===1?[10,7]:[]);c.beginPath();xs.forEach((x,i)=>i?c.lineTo(x,ys[j][i]):c.moveTo(x,ys[j][i]));c.stroke();c.setLineDash([]);
    if(chartCues)xs.forEach((x,i)=>marker(x,ys[j][i],series[j],j===1));
    // A deliberately crowded direct-label attempt. The next step fixes this.
    if(chartCues&&!chartOrganized)text(j?'■ 模擬店':'● ステージ',480,750+j*5,15,ink,700);
  }
  text('※ 予想値です。実際の混雑状況とは異なります。',48,875,12,soft);
  card(646,614,426,271);text('PICK YOUR AREA',666,642,12,soft,700);text('どこへ行こう？',666,668,21,ink,700);
  const panelColors = panelsColored ? [COLORS.blue,COLORS.orange,'#697ba3'] : ['#728d78','#567658','#697ba3'];
  const panelLight=['#e5f0f6','#fff3d6','#eceef5'];
  ['ステージ','飲食エリア','展示エリア'].forEach((v,i)=>{
    const y=687+i*59;rect(666,y,386,49,panelsReadable?panelLight[i]:panelColors[i],8);
    text(panelsReadable?`${['体育館','中庭','校舎'][i]} ｜ ${v}`:v,683,y+30,18,panelsReadable?ink:'#ffffff',600);
    text('→',1020,y+31,23,panelsReadable?ink:'#ffffff');
  });
  text('AOBA FESTIVAL 2026  ｜  このページは学習用の架空の案内です。',29,916,13,soft);
  return canvas;
}
