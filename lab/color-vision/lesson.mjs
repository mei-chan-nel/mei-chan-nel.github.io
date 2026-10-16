export const SIZE = {width: 1100, height: 1010};
export const REGIONS = {
  notice: {label: 'お知らせの文字', box: [40, 184, 560, 54]},
  status: {label: '状態表示', box: [28, 246, 336, 85]},
  warning: {label: '注意パネル', box: [740, 88, 310, 58]},
  map: {label: '会場案内図', box: [28, 346, 600, 330]},
  venues: {label: '建物の見分け', box: [60, 420, 508, 146]},
  timetable: {label: 'タイムテーブル', box: [646, 692, 426, 271]},
  chart: {label: '混雑予想グラフ', box: [28, 692, 600, 271]},
  panels: {label: '案内パネル', box: [646, 346, 426, 330]},
};
export const COLORS = {red:'#c66f4a', green:'#758b4b', blue:'#0072b2', orange:'#e69f00', purple:'#8053a5', chartOrange:'#a66b00', chartBeforeBlue:'#3798c3', chartBeforeGreen:'#45a58e', ink:'#203b40', soft:'#52686d'};
export const ROUTE_COLORS = {open:'#3a804d', closed:'#c74444'};
// Venue colors link the spatial map and event timetable, not visitor information.
export const VENUES = [
  {name:'体育館', category:'ステージ', color:'#356fb0', pattern:'stripe'},
  {name:'中庭', category:'模擬店', color:COLORS.purple, pattern:'dots'},
  {name:'校舎', category:'展示', color:'#aaa89f', pattern:'grid'},
];
export const PANELS = [
  {name:'入場', detail:'入場は無料です', color:'#ffdf36'},
  {name:'飲食', detail:'食券は正門受付で', color:'#ffdf36'},
  {name:'落とし物', detail:'校舎1階の本部へ', color:'#ffdf36'},
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
  {name:'パネルの文字', title:'明るい背景には、濃い文字を', region:'panels',
    question:'同じ背景のまま、白文字を濃い文字にすると？',
    observation:'右の「ご来場のヒント」は、3行とも同じ明るい黄色に白文字です。文字と背景は1.32:1。通常とP・D・T列で読みにくさを確認しましょう。',
    change:'3行すべての文字と区切り線を、白から同じ濃い色へ変更。背景色・情報・配置は変えません。',
    benefit:'全行の文字と背景の比率が1.32:1から9.01:1へ上がります。同じ種類の案内として、背景色も文字色も統一しています。',
    remaining:'案内の項目は「入場」「飲食」「落とし物」の見出しで区別します。お知らせ・注意パネル・地図などの課題は残っています。',
    sideEffect:'白文字の印象は変わります。この例では全行を濃い文字にそろえ、明るい背景を保ちながら読みやすさを確保します。',
    tip:'背景色を変えないので、色の区別と文字の読みやすさを混同せずに比較できます。', evidence:'panelsText'},
  {name:'お知らせ', title:'大切なお知らせを伝える', region:'notice',
    question:'淡い文字だけで、変更の重要さが伝わる？',
    observation:'横長の帯全体ではなく、文字の入った左側だけを拡大します。開演時刻が変わったことを、すぐに見つけられますか。',
    change:'お知らせ帯の文字を濃くし、見出しに「重要」を加えます。',
    benefit:'文字と背景の比率が2.14:1から7.87:1へ上がります。「重要」の文字でも意味を伝えます。',
    remaining:'注意パネルの赤系文字と緑系背景、地図の通行情報、時刻表・グラフの色依存は未改善です。',
    sideEffect:'強調語を増やしすぎると、重要な情報を探しにくくなります。この例では変更のお知らせに絞っています。',
    tip:'「重要」という言葉も手掛かりになっているか確かめよう。', evidence:'notice'},
  {name:'文字と背景', title:'赤系の文字と緑系の背景を見直す', region:'warning',
    question:'注意パネルの文字と背景は、十分に分かれている？',
    observation:'右上の注意パネルは赤系の文字と緑系の背景です。この組み合わせは1.04:1。通常とP・D列の両方で、文字の見つけやすさを確認しましょう。',
    change:'注意パネルだけを淡い背景と濃い赤文字へ変更し、先頭に「注意」を加えます。立入禁止と展示場所の情報は残します。',
    benefit:'文字と背景の比率が1.04:1から7.80:1へ上がります。「注意」「立入禁止」の文字でも意味を伝えます。',
    remaining:'地図の通行可／通行止め、時刻表の会場表示、グラフの色による区別は未改善です。',
    sideEffect:'強調する要素が増えます。注意の範囲を1つのパネルにまとめ、通常の案内と区別しています。',
    tip:'赤と緑が常に不適切なのではありません。実際の色の明暗差と、シミュレーションでの見え方を確かめよう。', evidence:'warning'},
  {name:'会場案内図', title:'通れる道を、色以外でも示す', region:'map',
    question:'正門から展示へ、通行止めを避けて行ける？',
    observation:'通行可は緑、通行止めは赤という、よくある色分けです。P・D列で2色の道と凡例を比べ、正門から校舎への道をたどってみましょう。',
    change:'通行可の緑と通行止めの赤は維持。通行止めに×・破線・文字・斜線区画を加え、通れる道には矢印を付けます。凡例も同じ記号にそろえます。',
    benefit:'通れない区間と迂回する方向を、色の違いだけに頼らず確認できます。×で通行止めを見つけ、矢印を使って校舎までの道をたどれます。',
    remaining:'体育館と中庭の青・紫は、P・D列で近づきます。時刻表の会場表示と、グラフの青・緑の区別も未改善です。',
    sideEffect:'記号で地図が混み合います。通行止めの文字は道の脇に置き、建物名や通れる道を隠さないようにしています。',
    tip:'赤・緑が似て見えても、正門→右回り→校舎1階の経路をたどれるか確かめよう。'},
  {name:'建物の見分け', title:'青と紫の建物を、模様でも区別する', region:'venues',
    question:'赤と緑以外なら、いつでも区別しやすい？',
    observation:'体育館は青、中庭は紫、校舎は灰色です。この青と紫はP・D列で近づきます。建物名の位置を確かめ、通常の列とも比べましょう。',
    change:'体育館に斜線、中庭に点、校舎に格子の模様を追加。建物の位置・色・名前は変えず、名札の白地も保ちます。',
    benefit:'青と紫が似て見えても、斜線／点／格子と会場名を手掛かりに建物を区別できます。配色を維持する場合にも使える方法です。',
    remaining:'時刻表は会場を小さな色帯だけで示しています。次に会場名を直接表示し、地図と照合しやすくします。',
    sideEffect:'模様が増えると地図が混み合います。模様は建物の内側に収め、白い名札と通行経路を隠さないようにしています。',
    tip:'建物の色は時刻表の色帯と全工程で一致します。色だけでなく、模様と会場名でも確認しよう。'},
  {name:'タイムテーブル', title:'イベントの会場を、文字で示す', region:'timetable',
    question:'どのイベントが、どこで行われる？',
    observation:'色帯だけで会場を判断するには、地図との照合が必要です。特に小さな色帯から、会場を確かめられますか。',
    change:'各行に体育館／中庭／校舎の会場名を追加。もとの色帯と、時刻・催し名は変えません。',
    benefit:'会場を文字で直接確認でき、地図で同じ会場名を探せます。色だけを覚えて照合する負担が減ります。',
    remaining:'混雑予想グラフでは、ステージと模擬店を青と緑の実線だけで区別しています。T列にも注目しましょう。',
    sideEffect:'行の文字数が増えます。この例では会場名を独立した列に置き、時刻・催し名と重ならないようにしています。',
    tip:'時刻表で行きたい催しの会場を調べ、地図で場所と通れる道を確かめよう。'},
  {name:'グラフ', title:'凡例を残し、線と直接ラベルを読みやすくする', region:'chart',
    question:'T列でも、どちらの線か迷わず追える？',
    observation:'元のグラフは青と緑の実線です。この組み合わせはT列で近づきます。14時付近をたどり、凡例だけでどちらの線か確認できるか考えましょう。',
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
  remaining:'状態表示、案内パネル、お知らせ、注意、地図の通行情報、建物、時刻表、グラフを順番に扱います。',
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
  benefit:'状態・通行情報・会場・グラフを、文字や記号、模様、線種、ラベルでも読み取れるようになりました。明るいパネルの文字も濃くしました。',
  remaining:'「完成」はこの教材の改善例です。実際の利用者による確認や、文字サイズ・読み上げなどの確認は別に必要です。',
  sideEffect:'この例では新しい重なりは見られません。追加した手掛かりが、情報を探す負担になっていないかも確かめましょう。',
  tip:'「0 ページ全体」と切り替えて、最初のデザインとの違いを見つけよう。各工程にはいつでも戻れます。'}];
export const CONTRAST_EXAMPLES = {
  panelsText:{title:'来場案内の全行：文字と背景', before:['#ffffff',PANELS[1].color], after:[COLORS.ink,PANELS[1].color], kind:'text'},
  notice:{title:'お知らせ：文字と背景', before:['#c5a55b','#fff3d6'], after:['#654519','#fff3d6'], kind:'text'},
  warning:{title:'注意パネル：文字と背景', before:[COLORS.red,COLORS.green], after:['#8a2931','#fff1ed'], kind:'text'},
  chart:{title:'模擬店：グラフの線と背景', before:[COLORS.chartBeforeGreen,'#ffffff'], after:[COLORS.chartOrange,'#ffffff'], kind:'graphic'},
};

// An original, fictional festival page, rasterized once before all simulations.
export function drawLesson(state) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width; canvas.height = SIZE.height;
  const c = canvas.getContext('2d', {colorSpace: 'srgb', willReadFrequently: true});
  const ink = COLORS.ink, soft = COLORS.soft, line = '#dce2df';
  const done=region=>state>=IMPROVEMENTS.findIndex(item=>item.region===region)+1;
  const statusDone=done('status'), panelsReadable=done('panels');
  const noticeDone=done('notice'), warningDone=done('warning'), mapDone=done('map'), timetableDone=done('timetable');
  const venuesDone=done('venues'), chartCues=done('chart');
  const series=chartCues?[COLORS.blue,COLORS.chartOrange]:[COLORS.chartBeforeBlue,COLORS.chartBeforeGreen];
  const statusColors=statusDone?[COLORS.blue,COLORS.chartOrange]:[COLORS.green,COLORS.red];
  const text = (s,x,y,size=18,color=ink,weight=400) => {c.fillStyle=color;c.font=`${weight} ${size}px "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;c.fillText(s,x,y);};
  const rect = (x,y,w,h,color,r=0) => {c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
  const stroke = (x1,y1,x2,y2,color=line,width=1,dash=[]) => {c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.setLineDash([]);};
  const circle = (x,y,r,color) => {c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
  const card = (x,y,w,h) => {rect(x,y,w,h,'#ffffff',14);c.strokeStyle=line;c.lineWidth=1;c.stroke();};
  const marker = (x,y,color,square=false) => square ? rect(x-5,y-5,10,10,color) : circle(x,y,5,color);
  rect(0,0,SIZE.width,SIZE.height,'#f4f5f0');
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
  card(28,346,600,330);text('CAMPUS MAP',48,374,12,soft,700);text('会場案内図',48,400,21,ink,700);
  rect(48,412,560,235,'#f4f5f0',6);
  // All venue colors stay in sync with the timetable throughout the lesson.
  const pattern=(venue,box)=>{
    if(!venuesDone)return;
    c.save();c.clip();
    const [x,y,w,h]=box;
    if(venue.pattern==='stripe')for(let k=x-h;k<x+w;k+=13)stroke(k,y,k+h,y+h,'#ffffff',2.5);
    if(venue.pattern==='dots')for(let xx=x+6;xx<x+w;xx+=11)for(let yy=y+6;yy<y+h;yy+=11)circle(xx,yy,2,'#ffffff');
    if(venue.pattern==='grid'){
      for(let xx=x;xx<x+w;xx+=13)stroke(xx,y,xx,y+h,ink,1.5);
      for(let yy=y;yy<y+h;yy+=13)stroke(x,yy,x+w,yy,ink,1.5);
    }
    c.restore();
  };
  rect(66,428,155,82,VENUES[0].color,3);pattern(VENUES[0],[66,428,155,82]);
  rect(99,438,88,60,'#ffffff',4);
  text('体育館',111,462,20,ink,700);text('ステージ',111,486,13,ink);
  c.fillStyle=VENUES[2].color;c.beginPath();
  [[326,426],[559,426],[559,556],[509,556],[509,482],[326,482]].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();pattern(VENUES[2],[326,426,233,130]);
  rect(360,431,120,46,'#ffffff',4);
  text('校舎 1階',374,450,20,ink,700);text('展示・本部',374,472,13,ink);
  rect(326,503,112,57,VENUES[1].color,3);pattern(VENUES[1],[326,503,112,57]);
  rect(350,508,76,46,'#ffffff',4);
  text('中庭',360,528,19,ink,700);text('模擬店',362,549,13,ink);
  for(const [x,y] of [[80,614],[108,629],[569,615]]){circle(x,y,10,'#bfcbbd');stroke(x,y+4,x,y+13,soft,2);}
  text('N',578,440,12,ink,700);stroke(583,465,583,449,ink,2);stroke(583,449,579,455,ink,2);stroke(583,449,587,455,ink,2);
  rect(558,570,34,28,'#ffffff',3);text('WC',562,589,13,ink,700);
  const route=(points,color,width=7,dash=[])=>{c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.setLineDash(dash);c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.setLineDash([]);};
  const openRoutes=[[[270,625],[270,582],[145,582],[145,510]],[[270,582],[477,582],[477,482]],[[420,582],[420,560]]];
  const closedRoute=[[270,582],[270,491],[382,491],[382,482]];
  for(const points of [...openRoutes,closedRoute])route(points,'#ffffff',15);
  if(mapDone){
    c.save();c.beginPath();c.rect(239,513,62,43);c.clip();
    for(let k=200;k<310;k+=10)stroke(k,513,k+44,557,'#93a7a0',2);
    c.restore();
  }
  for(const points of openRoutes)route(points,ROUTE_COLORS.open);
  route(closedRoute,ROUTE_COLORS.closed,7,mapDone?[5,5]:[]);
  const cross=(x,y)=>{circle(x,y,7,'#ffffff');stroke(x-5,y-5,x+5,y+5,ink,3);stroke(x-5,y+5,x+5,y-5,ink,3);};
  const arrow=(x,y,up=false)=>{circle(x-2,y+2,7,'#ffffff');stroke(x+(up?-5:-7),y+(up?7:-5),x,y,ink,2);stroke(x+(up?5:-7),y+(up?7:5),x,y,ink,2);};
  if(mapDone){
    cross(270,527);cross(270,551);
    rect(193,535,66,23,'#ffffff',3);text('通行止め',198,551,13,ink,700);
    arrow(352,582);arrow(477,530,true);arrow(145,546,true);
    text('迂回 →',361,609,13,ink,700);
  }
  stroke(250,625,260,625,ink,4);stroke(280,625,290,625,ink,4);text('正門・受付',232,644,14,ink,600);
  const mapLegend=(x,color,closed,label)=>{
    route([[x,660],[x+30,660]],color,5,mapDone&&closed?[4,4]:[]);
    if(mapDone){if(closed)cross(x+15,660);else arrow(x+22,660);}
    text(label,x+40,665,13,ink,600);
  };
  mapLegend(66,ROUTE_COLORS.open,false,'通行可');mapLegend(274,ROUTE_COLORS.closed,true,'通行止め');
  card(646,692,426,271);text('PROGRAM',666,720,12,soft,700);text('タイムテーブル',666,746,21,ink,700);
  const events=[['10:30','吹奏楽ライブ',0],['11:00','焼きそば販売',1],['12:00','科学の実験室',2],['13:30','ダンス公演',0]];
  events.forEach(([time,name,cat],i)=>{
    const y=774+i*44,venue=VENUES[cat];rect(666,y-10,5,28,venue.color,2);text(time,683,y+10,17,ink,600);text(name,750,y+10,17,ink);
    if(timetableDone)text(venue.name,969,y+10,15,ink,600);
    if(i<3)stroke(680,y+24,1051,y+24,line);
  });
  card(28,692,600,271);text('CROWD FORECAST',48,720,12,soft,700);text('混雑予想',48,746,21,ink,700);text('人数',48,781,12,soft);
  const xs=[85,183,281,379,477], ys=[[881,833,803,843,826],[899,874,828,805,819]];
  const chartLegend=(x,y,index,label)=>{stroke(x,y-5,x+28,y-5,series[index],3,chartCues&&index===1?[8,5]:[]);if(chartCues)marker(x+14,y-5,series[index],index===1);text(label,x+38,y,14,ink,600);};
  chartLegend(264,746,0,'ステージ');chartLegend(436,746,1,'模擬店');
  [798,843,888].forEach((y,i)=>{stroke(85,y,530,y,line);text(String(100-i*40),49,y+4,11,soft);});
  ['10時','11時','12時','13時','14時'].forEach((t,i)=>text(t,xs[i]-15,929,13,soft));
  for(let j=0;j<2;j++){
    c.strokeStyle=series[j];c.lineWidth=4;c.setLineDash(chartCues&&j===1?[10,7]:[]);c.beginPath();xs.forEach((x,i)=>i?c.lineTo(x,ys[j][i]):c.moveTo(x,ys[j][i]));c.stroke();c.setLineDash([]);
    if(chartCues)xs.forEach((x,i)=>marker(x,ys[j][i],series[j],j===1));
    if(chartCues){
      const labelY=j?800:860,dash=j?[6,4]:[];
      stroke(477,ys[j].at(-1),506,labelY-5,series[j],2,dash);stroke(506,labelY-5,528,labelY-5,series[j],2,dash);
      text(j?'模擬店':'ステージ',535,labelY,13,ink,700);
    }
  }
  text('※ 予想値です。実際の混雑状況とは異なります。',48,953,12,soft);
  card(646,346,426,330);text('VISITOR INFO',666,374,12,soft,700);text('ご来場のヒント',666,400,21,ink,700);
  text('ご来場前にご確認ください。',666,430,15,soft);
  PANELS.forEach((panel,i)=>{
    const y=450+i*69,foreground=panelsReadable?ink:'#ffffff';
    rect(666,y,386,57,panel.color,8);
    text(panel.name,680,y+35,17,foreground,600);
    stroke(769,y+12,769,y+44,foreground,1);
    text(panel.detail,785,y+35,17,foreground,600);
  });
  text('AOBA FESTIVAL 2026  ｜  このページは学習用の架空の案内です。',29,994,13,soft);
  return canvas;
}
