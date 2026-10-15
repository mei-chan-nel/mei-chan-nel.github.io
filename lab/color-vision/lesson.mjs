export const SIZE = {width: 1100, height: 930};
export const REGIONS = {
  notice: {label: 'お知らせ', box: [28, 179, 1044, 66]},
  status: {label: '状態表示', box: [28, 246, 1044, 85]},
  map: {label: '会場案内図', box: [28, 346, 600, 252]},
  timetable: {label: 'タイムテーブル', box: [646, 346, 426, 252]},
  chart: {label: '混雑予想グラフ', box: [28, 614, 600, 271]},
  panels: {label: '案内パネル', box: [646, 614, 426, 271]},
};
export const STEPS = [
  {title: 'まず、見つける', short: '初期状態', version: 'はじめのデザイン', regions: [],
    question: '「受付中」と「受付終了」は、どちら？',
    change: 'まだ変更していません。上下は同じ画像です。通常とP・D・T型を見比べてください。',
    benefit: '色が変わると、伝わっていた情報も変わることに気づけます。',
    remaining: '状態は色の点だけ。グラフは赤と緑の実線。案内図の青と緑も見分けにくくなる場合があります。',
    sideEffect: '変更はありません。淡いお知らせや、色だけで分類した時刻表にも注目しましょう。',
    tip: '状態表示・グラフはP／D列、案内図はT列にも注目。見分けやすさを言葉にしてみよう。'},
  {title: '色を置き換える', short: '配色', version: '配色を変更', regions: ['status', 'chart', 'panels'],
    question: '色を変えるだけで、十分だろうか？',
    change: '状態の点とグラフの2色を赤・緑から青・オレンジへ。案内パネルも同じ配色へそろえました。',
    benefit: 'この例の青とオレンジは、P・D型のシミュレーションでも区別しやすくなります。',
    remaining: '点の意味やグラフの系列は、まだ色が頼り。案内図の青・緑と淡い文字は未改善です。',
    sideEffect: '飲食パネルを明るいオレンジにすると、白い文字とのコントラストが下がりました。',
    tip: '「飲食エリア」を拡大。配色を変えたあと、文字の読みやすさも必ず確認しよう。'},
  {title: '文字を読みやすく', short: 'コントラスト', version: '文字色を調整', regions: ['notice', 'panels'],
    question: '色の識別と、文字の読みやすさは同じ？',
    change: '淡いお知らせの文字を濃い色に。案内パネルを淡い背景＋濃い文字へ変更しました。',
    benefit: '明暗の差が増え、通常表示でも文字を読みやすくなります。元のsRGB値の比率も下で確認できます。',
    remaining: '状態・地図・時刻表・グラフでは、色と凡例を対応させる必要が残っています。地図の白い文字も未改善です。',
    sideEffect: 'この変更範囲で新しい問題は見つかっていません。背景が淡くなった分、分類には別の手掛かりが必要です。',
    tip: 'コントラスト比は元の文字色と背景色で計算。比率が高くても、色だけの意味付けは解決しません。'},
  {title: '色以外でも伝える', short: '手掛かり', version: '文字・記号・模様を追加', regions: ['notice', 'status', 'map', 'timetable', 'chart', 'panels'],
    question: '色が似ても、情報をたどれる？',
    change: '状態に記号と文字、地図にA・B・Cと模様、時刻表に会場名、グラフに線種・点・直接ラベルを追加。',
    benefit: '色の違いに頼らず、状態や会場、グラフの系列を確認できます。重要なお知らせにも「重要」を付けました。',
    remaining: 'グラフ右端の系列名が重なり、ラベルを読むのが難しくなっています。',
    sideEffect: '情報を足すだけでは混雑します。グラフの直接ラベルを同じ高さに置いてしまいました。',
    tip: '混雑予想グラフを拡大。手掛かりを追加した効果と、重なったラベルの問題を両方確認しよう。'},
  {title: '手掛かりを整理する', short: '整理', version: '見分け方を整理', regions: ['chart', 'map', 'panels'],
    question: '必要な手掛かりを残し、すっきり伝えるには？',
    change: '系列名を上部の凡例に分け、オレンジの線を濃く。地図とパネルのA・B・C表記を統一し、地図の会場名も白地に濃い文字へ。',
    benefit: 'ラベルの重なりがなくなり、色・線種・記号・文字を組み合わせて系列や会場をたどれます。',
    remaining: '小さな画面での文字サイズ、説明の分かりやすさ、実際の利用者による確認は引き続き必要です。',
    sideEffect: 'この例では新たな重なりはありません。記号と模様を増やしすぎないよう、全体でも見直しましょう。',
    tip: '「全体に戻す」で見直そう。シミュレーションでの確認に加え、実際の利用者の意見も取り入れよう。'},
];
export const COLORS = {red:'#c66f4a', green:'#758b4b', blue:'#0072b2', orange:'#e69f00', mapBlue:'#3798c3', mapGreen:'#45a58e', ink:'#203b40'};

// An original, fictional festival page, rasterized once before all simulations.
export function drawLesson(stage) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width; canvas.height = SIZE.height;
  const c = canvas.getContext('2d', {colorSpace: 'srgb', willReadFrequently: true});
  const ink = COLORS.ink, soft = '#637579', line = '#dce2df';
  const noncolor = stage >= 3, organized = stage >= 4, contrast = stage >= 2;
  const series = stage >= 1 ? [COLORS.blue, organized ? '#a66b00' : COLORS.orange] : [COLORS.red, COLORS.green];
  const statusColors = stage >= 1 ? [COLORS.blue, COLORS.orange] : [COLORS.green, COLORS.red];
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
  text(noncolor ? '重要｜体育館ステージの開演は10:30に変更しました。' : '体育館ステージの開演は10:30に変更しました。',48,206,18,contrast ? '#654519' : '#c5a55b',600);
  text('雨天時も開催します。ご来場の前に最新情報をご確認ください。',48,230,15,contrast ? '#654519' : '#c5a55b');
  circle(881,251,4,statusColors[0]);text('受付中',891,255,10,soft);
  circle(986,251,4,statusColors[1]);text('受付終了',996,255,10,soft);
  const venues = ['ステージ受付','ワークショップ','模擬店'];
  for(let i=0;i<3;i++){
    card(28+i*354,258,336,73); text(venues[i],45+i*354,284,17,ink,600);
    const color = statusColors[i===1?1:0];
    if(noncolor) text(i===1?'■ 受付終了':'○ 受付中',45+i*354,315,18,ink,700);
    else circle(326+i*354,295,10,color);
  }
  card(28,346,600,252);text('CAMPUS MAP',48,374,12,soft,700);text('会場案内図',48,400,21,ink,700);
  const mapColors=[COLORS.red,COLORS.mapGreen,COLORS.mapBlue];
  const blocks=[[52,420,175,93],[243,420,165,93],[424,420,180,93]];
  blocks.forEach(([x,y,w,h],i)=>{
    rect(x,y,w,h,mapColors[i],8);
    if(noncolor){
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
      if(i===0) for(let k=x-100;k<x+w;k+=15)stroke(k,y,k+100,y+100,'#ffffff88',3);
      if(i===1)for(let u=x+9;u<x+w;u+=17)for(let v=y+9;v<y+h;v+=17)circle(u,v,2,'#ffffffbb');
      rect(x+8,y+8,35,30,'#ffffff',4);text(['A','B','C'][i],x+17,y+30,22,ink,800);c.restore();
    }
    if(organized)rect(x+42,y+43,100,34,'#ffffff',4);
    text(['体育館','中庭','校舎'][i],x+48,y+68,19,organized?ink:'#ffffff',700);
  });
  stroke(80,535,573,535,'#c6cfcb',8);text('↑ 正門',280,571,16,soft);
  const mapLegend=organized?['A 体育館','B 中庭','C 校舎']:noncolor?['A ステージ','B 模擬店','C 展示']:['ステージ','模擬店','展示'];
  mapLegend.forEach((v,i)=>{rect(48+i*185,580,10,8,mapColors[i]);text(v,65+i*185,589,13,ink);});
  card(646,346,426,252);text('PROGRAM',666,374,12,soft,700);text('タイムテーブル',666,400,21,ink,700);
  const events=[['10:30','吹奏楽ライブ',0],['11:00','焼きそば販売',1],['12:00','科学の実験室',2],['13:30','ダンス公演',0]];
  events.forEach(([time,name,cat],i)=>{
    const y=428+i*40;rect(666,y-10,5,28,mapColors[cat],2);text(time,683,y+10,17,ink,600);text(name,750,y+10,17,ink);
    if(noncolor)text(['A 体育館','B 中庭','C 校舎'][cat],951,y+10,13,ink,600);
    if(i<3)stroke(680,y+24,1051,y+24,line);
  });
  card(28,614,600,271);text('CROWD FORECAST',48,642,12,soft,700);text('混雑予想',48,668,21,ink,700);text('人数',48,703,12,soft);
  const xs=[85,183,281,379,477], ys=[[803,755,725,765,748],[821,796,750,727,741]];
  const chartLegend=(x,y,index,label)=>{stroke(x,y-5,x+28,y-5,series[index],3,noncolor&&index===1?[8,5]:[]);if(noncolor)marker(x+14,y-5,series[index],index===1);text(label,x+38,y,14,ink,600);};
  if(!noncolor||organized){chartLegend(264,668,0,'ステージ');chartLegend(436,668,1,'模擬店');}
  [720,765,810].forEach((y,i)=>{stroke(85,y,530,y,line);text(String(100-i*40),49,y+4,11,soft);});
  ['10時','11時','12時','13時','14時'].forEach((t,i)=>text(t,xs[i]-15,851,13,soft));
  for(let j=0;j<2;j++){
    c.strokeStyle=series[j];c.lineWidth=4;c.setLineDash(noncolor&&j===1?[10,7]:[]);c.beginPath();xs.forEach((x,i)=>i?c.lineTo(x,ys[j][i]):c.moveTo(x,ys[j][i]));c.stroke();c.setLineDash([]);
    if(noncolor)xs.forEach((x,i)=>marker(x,ys[j][i],series[j],j===1));
    // A deliberately crowded direct-label attempt. The next step fixes this.
    if(noncolor&&!organized)text(j?'■ 模擬店':'● ステージ',480,750+j*5,15,ink,700);
  }
  text('※ 予想値です。実際の混雑状況とは異なります。',48,875,12,soft);
  card(646,614,426,271);text('PICK YOUR AREA',666,642,12,soft,700);text('どこへ行こう？',666,668,21,ink,700);
  const panelColors = stage>=1 ? [COLORS.blue,COLORS.orange,'#697ba3'] : ['#728d78','#567658','#697ba3'];
  const panelLight=['#e5f0f6','#fff3d6','#eceef5'];
  ['ステージ','飲食エリア','展示エリア'].forEach((v,i)=>{
    const y=687+i*59;rect(666,y,386,49,contrast?panelLight[i]:panelColors[i],8);
    text(noncolor?`${organized?['A 体育館','B 中庭','C 校舎'][i]:['A','B','C'][i]}  ｜ ${v}`:v,683,y+30,18,contrast?ink:'#ffffff',600);
    text('→',1020,y+31,23,contrast?ink:'#ffffff');
  });
  text('AOBA FESTIVAL 2026  ｜  このページは学習用の架空の案内です。',29,916,13,soft);
  return canvas;
}
