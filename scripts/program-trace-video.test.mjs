import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { VIDEO_PROGRAMS, findProgram, defaultParameters, sourceLines, validateParameters, lineLabel } from '../program-trace/examples.js';
import { compileProgram, createState, step, inputRequest, evaluate } from '../program-trace/interpreter.js';
import { inputCandidate, navigationForProgram } from '../program-trace/video-programs.js';
import { parseExpression, parseProgram } from '../program-trace/source-parser.js';
import { validateField, formatValue } from '../program-trace/values.js';
import { visibleArrayIndices } from '../program-trace/value-view.js';
import { planWorkspace } from '../program-trace/workspace.js';
import { outputWindow } from '../program-trace/output-view.js';

const entryFor = (number) => VIDEO_PROGRAMS.find((entry) => entry.number === number);
const printed = (state) => state.output.map((output) => output.text);
function execute(number, overrides = {}, { seed = 1, inputs = {}, trace = false, entry = entryFor(number) } = {}) {
  const validation = validateParameters(entry, { ...defaultParameters(entry), ...overrides });
  assert.equal(validation.valid, true, JSON.stringify(validation.errors) + (validation.formError ?? ''));
  const parameters = validation.values;
  const compiled = compileProgram(entry.program, { initialVariables: entry.initialize(parameters), maxSteps: entry.maxSteps });
  let state = createState(compiled, { seed });
  const snapshots = [];
  while (!state.completed) {
    const request = inputRequest(compiled, state);
    const supplied = request && (typeof inputs[request.name] === 'function' ? inputs[request.name](state) : inputs[request.name]);
    state = step(compiled, state, parameters, request ? { input: supplied ?? inputCandidate(entry, request.field, state, parameters) } : {});
    assert.equal(state.event.line, state.currentLine);
    assert.ok(Object.hasOwn(compiled.lineKinds, state.currentLine));
    if (trace) snapshots.push(state);
  }
  return { state, compiled, parameters, snapshots };
}

// Fixed results were reviewed against the question text and its answers.
const EXPECTED = {
 231:['合計は7です。'],232:['平均点は57です。'],233:['現在のxの値は2です。'],234:['現在のxの値は2です。','現在のyの値は2です。'],235:['現在のxの値は2です。','現在のyの値は1です。'],
 236:['現在のxの値は11です。'],237:['現在のxの値は100です。'],238:['現在のxの値は7です。','現在のyの値は3です。'],239:['あいうえお'],240:['3'],
 241:['Data[0]は3','Data[1]は5','Data[2]は9','Dataは[3, 5, 9]'],242:['現在のDataは[4, 5, 9]'],243:['現在のDataは[5, 5, 9]'],244:['平均は65'],245:['英語の得点は80','数学の得点は75','国語の得点は90'],246:['和は12'],247:['現在のDataは[9, 5, 3]'],
 248:['1','2','6'],249:['[[1, 2], [5, 4]]'],250:['田中さんは25歳の男性です。','山田さんは30歳の女性です。','鈴木さんは23歳の女性です。'],251:['3行2列目の座席の状態は1です。'],
 252:['xに10を加える。','xの値は17'],253:['xの値は11'],254:[],255:['xは10以下です。'],256:['未成年です。'],257:['xは偶数です。'],258:['xの値は370'],259:['xの値は15'],260:['xは5より大きく10以下です。'],261:['未成年です。'],262:['3の倍数だが2の倍数でない'],263:['20%の割引'],264:['散歩に出かけよう！'],265:['1500円です。'],266:['10%割引'],267:['計算結果：0.5'],268:['割引があります'],269:['チケット代は1800円です。'],
 270:[...Array.from({length:5},(_,i)=>`今のiは${i+1}`),'繰り返し終了'],271:[...Array.from({length:5},(_,i)=>`現在の合計は${3*(i+1)}`),'最終的な合計は15'],272:[1,3,6,10,15].map(n=>`現在の合計は${n}`).concat('最終的な合計は15'),273:[2,4,8,16,32].map(n=>`現在の積は${n}`).concat('最終的な積は32'),
 274:['3の4乗は81'],275:['5の階乗は120'],276:['4人の平均点は6点です'],277:['3は3の倍数','6は3の倍数','9は3の倍数','繰り返し終了'],278:['3の倍数の個数は3'],279:['2または3の倍数の個数は7'],280:['現在の合計は2','現在の合計は6','最終的な合計は6'],281:['最大値は9'],
 282:Array.from({length:81},(_,k)=>`${Math.floor(k/9)+1}×${k%9+1}=${(Math.floor(k/9)+1)*(k%9+1)}`),283:['[[1, 2, 3], [2, 4, 6], [3, 6, 9], [4, 8, 12], [5, 10, 15]]'],
 284:['i=1, j=5','i=2, j=4','i=2, j=5','i=3, j=3','i=3, j=4','i=3, j=5','i=4, j=4','i=4, j=5','i=5, j=5','条件を満たす組の数は9'],
 285:[1,3,6,10,15].map((sum,k)=>`現在のsumは${sum}, iは${k+1}`).concat('最終的なsumは15'),286:['最終的なsumは6'],287:[1,3,6,10,15,21].map((sum,k)=>`現在のsumは${sum}, iは${k+1}`).concat('sumが20を超えるのはiが6のときです'),288:['100未満のaiの和は109'],289:['変数bの値が100以上になるのは12項目'],
 290:[1,2,3,4].map(n=>`targetは${n}ではありません`).concat('正解です。targetは5でした'),291:[3,10,5,16,8,4,2,1].map(n=>`現在のnは${n}`).concat('処理終了。nの値が1になりました。'),292:[],293:['配列Data内の最大の数は67'],294:[],295:[],296:['条件を満たす数は46個あります'],297:['入力された2数の最大公約数は6'],298:['入力された2数の最大公約数は6'],299:['配列ISBNcodeは[9, 7, 8, 4, 0, 0, 0, 0, 0, 0, 0, 1]'],300:['チェックデジットは7'],301:['度数分布は[1, 0, 0, 1, 0, 1, 1, 1, 1, 2]'],
 302:['10000円は1枚','5000円は1枚','1000円は3枚','500円は1枚','100円は1枚','50円は1枚','10円は2枚','5円は0枚','1円は3枚'],303:['2進数[1, 1, 0, 1]を10進数にすると13'],304:['2進数[1, 1, 0, 1]を10進数にすると13'],305:['2進数[1, 1, 0, 1]を10進数にすると13'],306:['2進数にすると[1, 1, 0, 1]'],307:['16進数Aを10進数に変換すると10'],308:['16進数[3, A, B]を10進数に変換すると939'],309:['16進数にすると[3, A, B]'],
 310:['バブルソート後：[1, 3, 4, 5, 8]'],311:['選択ソート後：[1, 3, 4, 5, 8]'],312:['挿入ソート後の配列: [1, 3, 4, 5, 8]'],313:['マージ後の配列：[1, 2, 3, 3, 4, 6, 9]'],314:['ピボットによる分割後：[3, 1, 5, 5, 5, 8, 9]'],315:['18は配列の5番目の要素です'],316:['18は配列の3番目の要素です'],317:['18は配列の3番目の要素です'],319:['5'],320:['面積は6'],321:['120'],322:['5'],
};

const original = JSON.parse(readFileSync(new URL('../data/video-questions.json',import.meta.url),'utf8'));
const questions = new Map(original.sections.flatMap(section=>section.questions).map(q=>[q.number,q]));
const curriculum = JSON.parse(readFileSync(new URL('../data/video-curriculum.json',import.meta.url),'utf8'));

test('動画Q231〜Q330を重複なく登録し、全問題の原文・空欄補充・表示行・命令が対応する',()=>{
 assert.deepEqual(VIDEO_PROGRAMS.map(e=>e.number),Array.from({length:100},(_,i)=>i+231));
 assert.equal(VIDEO_PROGRAMS.filter(e=>Object.keys(e.filledAnswers).length).length,38);
 for(const entry of VIDEO_PROGRAMS){
  assert.equal(entry.originalHash,createHash('sha256').update(questions.get(entry.number).question).digest('hex'),`Q${entry.number} source changed`);
  assert.equal(entry.answer,questions.get(entry.number).answer);
  const lines=sourceLines(entry,defaultParameters(entry));
  assert.ok(lines.every(line=>!/[{][\p{L}\p{N}_]+[}]|（\s*[アイ]?\s*）/u.test(line.text)),`Q${entry.number} blanks`);
  const compiled=compileProgram(entry.program);
  assert.deepEqual(Object.keys(compiled.lineKinds).map(Number),lines.map(line=>line.line),`Q${entry.number} lines`);
  assert.equal(entry.lineLabels.length,lines.length);
  assert.ok(lines.length>0);
 }
});

for(const entry of VIDEO_PROGRAMS) test(`Q${entry.number} ${entry.title}：適切な初期値で実行が完了する`,()=>{
 const {state,parameters}=execute(entry.number);
 if(Object.hasOwn(EXPECTED,entry.number)) assert.deepEqual(printed(state),EXPECTED[entry.number]);
 assert.ok(state.steps>0);
 assert.ok(state.steps <= (entry.maxSteps??10000));
 assert.ok(!printed(state).some(text=>/[{][\p{L}\p{N}_]+[}]/u.test(text)));
 if(entry.number===292) assert.deepEqual(state.variables.Gouhi,['合格','不合格','合格','合格','不合格']);
 if(entry.number===294) assert.deepEqual(state.variables.Data,[5,9,2,3]);
 if(entry.number===295) assert.deepEqual(state.variables.Data,[2,9,5,3]);
 if(entry.number===318) assert.ok(Number(state.output[0].text)>=1&&Number(state.output[0].text)<=5);
 if(entry.number===323) assert.ok(state.variables.sougaku>=parameters.tumitate*parameters.kikan);
 if(entry.number===324) assert.equal(state.variables.dosu.reduce((a,b)=>a+b,0),parameters.set);
 if(entry.number===325){assert.equal(state.variables.Birthdays.length,state.variables.count-1);assert.ok(state.variables.Birthdays.includes(state.variables.day));assert.equal(new Set(state.variables.Birthdays).size,state.variables.Birthdays.length);}
 if(entry.number===326){assert.ok(state.variables.count1>=state.variables.count2);assert.equal(state.output[0].text,`検査で陽性のうち実際に罹患している割合は${formatValue(100*state.variables.count2/state.variables.count1)}%`);}
 if(entry.number===327){assert.ok(state.variables.kosu>=0&&state.variables.kosu<=parameters.kaisu);assert.equal(state.output[0].text,`円周率の推定値は${4*state.variables.kosu/parameters.kaisu}`);}
 if(entry.number===328){assert.equal(state.output[0].kind,'plot');assert.equal(state.output[0].x.length,1001);assert.equal(state.output[0].y.length,1001);}
 if(entry.number===329){assert.ok(state.variables.zaiko>=0);assert.ok(state.variables.sinagire>=0&&state.variables.sinagire<=parameters.kikan);assert.ok(state.variables.hanbai>=15&&state.variables.hanbai<=25);assert.ok(state.output[0].text.startsWith('7日目'));}
 if(entry.number===330){assert.equal(state.variables.現在時刻,parameters.営業終了時刻);assert.ok(state.variables.顧客数>0);assert.ok(state.variables.総待ち時間>=0);assert.ok(Number.isFinite(state.variables.総待ち時間/state.variables.顧客数));}
});

test('すべての動画ページで各問題の最初の動画ボタンの右側に対応する実行リンクを置く',()=>{
 let links=0;
 for(const page of [...curriculum.fields.flatMap(f=>f.genres),...curriculum.courses]){
  const text=readFileSync(new URL(`../archive/${page.id}.html`,import.meta.url),'utf8');
  const cards=[...text.matchAll(/<article class="video-question-card" id="q-(\d+)">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,page.numbers.length);
  for(const [,rawNumber,card] of cards){
   const number=Number(rawNumber),href=`../program-trace/?from=${page.id}#video-q-${number}`;
   const matches=[...card.matchAll(/<a class="program-trace-link" href="([^"]+)">1行ずつ実行する<\/a>/g)];
   assert.equal(matches.length,number>=231?1:0,`Q${number} links`);
   if(number>=231){assert.equal(matches[0][1],href);assert.match(card,/<div class="video-action-row">\s*<button class="video-trigger"[^>]*>解説動画を表示(?: 1)?<\/button>\s*<a class="program-trace-link"/);links++;}
  }
 }
 assert.equal(links,127);
});

test('入口が代表例・動画ジャンル・最短学習で異なる場合の戻り先を保持し、任意の外部URLは受け付けない',()=>{
 assert.equal(navigationForProgram(findProgram('addition'),'programming-shortest-course').primary.href,'./#examples');
 assert.equal(navigationForProgram(entryFor(231),'examples').primary.href,'./#examples');
 assert.equal(navigationForProgram(entryFor(231),'examples').secondary.href,'../archive/programming-variables-arrays.html#q-231');
 assert.equal(navigationForProgram(entryFor(231),'programming-shortest-course').primary.href,'../archive/programming-shortest-course.html#q-231');
 for(const source of ['https://example.com','../../privacy','programming-simulation','programming-shortest-course']) assert.equal(navigationForProgram(entryFor(232),source).primary.href,'../archive/programming-variables-arrays.html#q-232');
});

test('誤りの修正と数値/文字列の2つのプログラムを、それぞれ独立した設定と行番号で比較する',()=>{
 const corrected=execute(232).state;
 const original=execute(232,{}, {entry:findProgram('video-q-232-original')}).state;
 assert.equal(corrected.variables.heikin,57);
 assert.equal(original.variables.heikin,50+65+56/3);
 const b=findProgram('video-q-240-b');
 assert.deepEqual(printed(execute(240,{}, {entry:b}).state),['12']);
 assert.equal(lineLabel(b,3),'（3）');
});

test('問題文で与えられた表を実行前に準備し、0始まり/1始まりと更新前の状態を保つ',()=>{
 for(const number of [248,249,250,251]){
  const entry=entryFor(number),parameters=defaultParameters(entry);
  const compiled=compileProgram(entry.program,{initialVariables:entry.initialize(parameters)}),initial=createState(compiled);
  assert.equal(initial.steps,0);assert.equal(initial.currentLine,null);
  assert.equal(initial.variables[entry.initialKeys[0]].kind,'matrix');
 }
 const entry=entryFor(249),parameters=defaultParameters(entry),compiled=compileProgram(entry.program,{initialVariables:entry.initialize(parameters)});
 const initial=createState(compiled),changed=step(compiled,initial,parameters);
 assert.equal(initial.variables.Matrix.cells['1,0'],3);assert.equal(changed.variables.Matrix.cells['1,0'],5);
 assert.deepEqual(changed.changes[0].indices,[1,0]);
 assert.equal(execute(251).state.variables.Seats.cells['3,2'],1);
 assert.equal(execute(251).state.variables.Seats.cells['0,0'],undefined);
});

test('配列の増減後は、平均の分母・合否の配列長・コインの分布も連動する',()=>{
 assert.deepEqual(printed(execute(276,{Tokuten:[10,20,30]}).state),['3人の平均点は20点です']);
 const scores=[59,60,100,0,80,20],state=execute(292,{Tokuten:scores}).state;
 assert.deepEqual(state.variables.Gouhi,scores.map(n=>n>=60?'合格':'不合格'));
 const toss=execute(324,{toss:3,set:7}).state.variables.dosu;
 assert.equal(toss.length,4);assert.equal(toss.reduce((a,b)=>a+b,0),7);
 assert.ok(printed(execute(323,{kikan:2}).state)[0].startsWith('2年後'));
 assert.ok(printed(execute(329,{kikan:2}).state)[0].startsWith('2日目'));
});

test('外部入力は繰り返しごとに確定を求め、問題に指定された順の入力候補を使う',()=>{
 const result=execute(281,{}, {trace:true});
 assert.deepEqual(result.snapshots.filter(s=>s.event.kind==='input').map(s=>s.variables.number),[5,8,3,9,2]);
 assert.equal(result.state.inputCounts.number,5);
 assert.deepEqual(printed(execute(281,{number:7}).state),['最大値は7']);
 assert.deepEqual(printed(execute(290,{target:999}).state),['正解です。targetは999でした']);
});

test('配列の添字・席の行列・日付・12桁/12個のISBN・16進文字・最大再帰数を入力時に検証する',()=>{
 const defaults246=defaultParameters(entryFor(246));
 assert.equal(validateParameters(entryFor(246),{...defaults246,a:3}).valid,false);
 const defaults251=defaultParameters(entryFor(251));
 assert.equal(validateParameters(entryFor(251),{...defaults251,gyou:6}).valid,false);
 for(const [number,key,invalid] of [[266,'date',32],[275,'factorial',11],[297,'x',0],[299,'number',97840000000],[300,'ISBNcode',[1,2,3]],[303,'Binary',[1,2]],[307,'hex','G'],[308,'Hex',['a']],[321,'n',-1],[322,'n',0]]){
  const field=entryFor(number).parameters.find(f=>f.key===key);assert.ok(validateField(field,invalid).error,`Q${number} ${key}`);
 }
 const hex=entryFor(308).inputs[0];assert.deepEqual(validateField(hex,['1','A','F']).value,[1,'A','F']);
 assert.equal(validateField(entryFor(317).inputs[0],[3,2,1]).value,undefined);
 assert.equal(validateField(entryFor(313).parameters.find(f=>f.key==='A'),[]).error,undefined);
});

for(const number of [310,311,312]) test(`Q${number} ソートの境界：1要素、逆順、同値、負数を正しく並べる`,()=>{
 for(const data of [[7],[5,4,3,2,1],[2,2,2],[3,-2,3,-1,0],Array.from({length:12},(_,k)=>11-k)]){
  const {state}=execute(number,{Array:data});
  assert.deepEqual(state.variables.Array,[...data].sort((a,b)=>a-b));
 }
});

test('配列の移動/反転、マージの空配列、ピボットの同値を扱う',()=>{
 for(const Data of [[1],[1,2],[1,2,3],[1,2,3,4,5]]){
  assert.deepEqual(execute(294,{Data}).state.variables.Data,[...Data.slice(1),Data[0]]);
  assert.deepEqual(execute(295,{Data}).state.variables.Data,[...Data].reverse());
 }
 for(const [A,B] of [[[],[]],[[1,2],[]],[[],[3,4]],[[-3,1,1],[-2,1,5]]]) assert.deepEqual(execute(313,{A,B}).state.variables.Merged,[...A,...B].sort((a,b)=>a-b));
 for(const Array of [[7],[2,2,2],[0,-1,2,0,-3,5]]){
  const expected=[...Array.filter(n=>n<Array[0]),...Array.filter(n=>n===Array[0]),...Array.filter(n=>n>Array[0])];
  assert.deepEqual(execute(314,{Array}).state.variables.Array,expected);
 }
});

test('線形探索の最後/最初の一致と二分探索の両端・不在を区別し、範囲外を参照しない',()=>{
 const Array=[3,7,7,10];
 assert.equal(execute(315,{Array,target:7}).state.variables.found,2);
 assert.equal(execute(316,{Array,target:7}).state.variables.i,1);
 for(const number of [315,316,317]) for(const target of [3,10,2,11]){
  const state=execute(number,{Array,target}).state;
  if([2,11].includes(target)) assert.ok(state.output[0].text.includes('存在しません'));
  else assert.ok(state.output[0].text.includes(`${Array.indexOf(target)}番目`));
 }
 const {snapshots}=execute(312,{Array:[3,2,1]},{trace:true});
 assert.ok(snapshots.some(s=>s.event.condition?.resolved.includes('右側は評価しない')));
});

test('条件の正解は境界値でも動作し、or/and/notを数式より先に誤解釈しない',()=>{
 assert.equal(evaluate(parseExpression('not((i % 5 == 0) or (i % 7 == 0))'),{i:15},{}),false);
 assert.equal(evaluate(parseExpression('i >= 0 and Array[i] > current'),{i:-1,Array:[1],current:0},{}),false);
 assert.equal(evaluate(parseExpression('1 == 1 or Array[999] == 0'),{Array:[1]},{}),true);
 for(const age of [17,18,65,120]) assert.deepEqual(printed(execute(256,{age}).state),[age>=18?'成人です。':'未成年です。']);
 assert.deepEqual(printed(execute(267,{x:0}).state),['計算結果：0']);
 const oracle=Array.from({length:100},(_,k)=>k+1).filter(i=>(i%2===0||i%3===0)&&i%5!==0&&i%7!==0).length;
 assert.equal(execute(296).state.variables.count,oracle);
});

test('日本語の関数名と引数の局所値、階乗0/10、フィボナッチ1/10を処理する',()=>{
 const {snapshots,state}=execute(320,{a:6,b:8},{trace:true});
 assert.ok(snapshots.some(s=>s.callStack.at(-1)?.name==='面積'));
 assert.deepEqual(printed(state),['面積は24']);
 assert.deepEqual(printed(execute(321,{n:0}).state),['1']);
 assert.deepEqual(printed(execute(321,{n:10}).state),['3628800']);
 assert.deepEqual(printed(execute(322,{n:1}).state),['1']);
 assert.deepEqual(printed(execute(322,{n:10}).state),['55']);
 assert.deepEqual(entryFor(320).lineLabels,['（1）','（2）','（3）','（1）','（2）','（3）','（4）']);
});

test('整数の商、減少ループ、剰余、文字列の結合、配列参照の表記を正しく解釈する',()=>{
 assert.equal(evaluate(parseExpression('(3 + 4) ÷ 2'),{},{}),3);
 assert.equal(evaluate(parseExpression('2 ** 3 ** 2'),{},{}),512);
 assert.equal(evaluate(parseExpression('(-1) ** 3'),{},{}),-1);
 assert.deepEqual(printed(execute(239,{x:'<script>',y:'# "日本語"'}).state),['<script># "日本語"']);
 for(const Binary of [[0],[1],[1,0,0,1,1]]) for(const number of [303,304,305]) assert.equal(execute(number,{Binary}).state.variables.decimal,parseInt(Binary.join(''),2));
 assert.equal(execute(308,{Hex:['F','F','F']}).state.variables.decimal,4095);
 assert.deepEqual(execute(309,{decimal:65535}).state.variables.Hex,['F','F','F','F']);
 assert.throws(()=>parseExpression('alert(1);'),/式/);
 assert.throws(()=>parseProgram(['x = window.location']),/式/);
});

test('乱数の範囲、分布の合計、座標の移動量と乱数の再現性を確認する',()=>{
 const values=new Set();
 for(let sample=1;sample<=60;sample++) values.add(Number(execute(318,{}, {seed:(0x9e3779b9*sample)>>>0}).state.output[0].text));
 assert.deepEqual([...values].sort((a,b)=>a-b),[1,2,3,4,5]);
 const entry=entryFor(328),parameters=defaultParameters(entry),compiled=compileProgram(entry.program);
 const before=execute(328,{kaisu:8,x0:-5,y0:3}).state;
 planWorkspace(entry,compiled,parameters);
 const after=execute(328,{kaisu:8,x0:-5,y0:3}).state;
 assert.deepEqual(before,after);
 const plot=before.output[0];
 assert.equal(plot.x.length,9);assert.equal(plot.x[0],-5);assert.equal(plot.y[0],3);
 for(let k=1;k<plot.x.length;k++){assert.ok(Math.abs(plot.x[k]-plot.x[k-1]-.1)<1e-10);assert.equal(Math.abs(plot.y[k]-plot.y[k-1]),1);}
 assert.deepEqual(plot.x,before.variables.X_zahyo);assert.deepEqual(plot.y,before.variables.Y_zahyo);
 const {snapshots,state}=execute(327,{kaisu:20},{trace:true});
 const inside=snapshots.filter(s=>s.currentLine===6&&s.variables.x**2+s.variables.y**2<=1).length;
 assert.equal(state.variables.kosu,inside);
});

test('大きな配列でも変更/参照要素を含む最大40要素を表示し、全要素を取得できる',()=>{
 const visible=visibleArrayIndices(1001,[{indices:[501]}],[{indices:[502]}]);
 assert.ok(visible.includes(501));assert.ok(visible.includes(502));assert.ok(visible.includes(0));assert.ok(visible.includes(1000));assert.ok(visible.length<=40);
 assert.equal(visibleArrayIndices(1001,[],[],true).length,1001);
 const birthday=entryFor(325),plan=planWorkspace(birthday,compileProgram(birthday.program),defaultParameters(birthday));
 assert.equal(plan.variables.get('Birthdays').value.length,366);
 const graph=entryFor(328),graphPlan=planWorkspace(graph,compileProgram(graph.program),defaultParameters(graph));
 assert.equal(graphPlan.outputs[0].kind,'plot');assert.equal(graphPlan.outputs[0].x.length,1001);
});

test('全問の数値設定の最小/最大値を実行し、添字と配列長が合わない変更は適用前に拒否する',()=>{
 let completed=0;
 const rejected=[];
 for(const entry of VIDEO_PROGRAMS) for(const boundary of ['min','max']){
  const raw=defaultParameters(entry);
  for(const field of entry.parameters) if(field.type==='number') raw[field.key]=field[boundary];
  const result=validateParameters(entry,raw);
  if(!result.valid){rejected.push(entry.number);assert.ok(result.formError?.includes('添字'));continue;}
  assert.equal(execute(entry.number,raw).state.completed,true);
  completed++;
 }
 assert.equal(completed,198);assert.deepEqual(rejected,[246,251]);
});

test('長い出力の表示量を一定にしても履歴を失わず、元の行番号・順序で全件を確認できる',()=>{
 const {state,compiled,parameters}=execute(282);
 const snapshot=JSON.stringify(state.output);
 const view=outputWindow(state.output),plan=planWorkspace(entryFor(282),compiled,parameters);
 assert.equal(view.start,51);assert.equal(view.items.length,30);
 assert.equal(view.items[0].text,'6×7=42');assert.equal(view.items.at(-1).text,'9×9=81');
 assert.equal(state.output.length,81);assert.equal(JSON.stringify(state.output),snapshot);
 assert.equal(plan.outputLimit,30);assert.equal(plan.outputHistory,true);
 assert.equal(plan.outputColumns,3);
});
