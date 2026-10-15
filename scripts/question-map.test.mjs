import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareMap, verifySourceText, SpatialIndex, fitCamera, project, unproject, zoomAbout, viewBounds,
  stageAt, labelCandidates, placeLabels, spatialOrder, overlaps, historyRecords, heatField, rateColor, colorRate, regionalColorRange, coastContours, labelPresentation, questionPresentation, cardFocus, surroundingQuestions, placeQuestionCards, practiceCandidates, samplePractice } from "../lab/question-map/map-model.mjs";
import { parseStatsConfig, normalizeStats, loadQuestionStats } from "../lab/question-map/question-stats.mjs";

const question = (id, tags) => ({ id, tags, stem: `Question ${id}`, choices: [], explanation: "" });
function fixture() {
  const questions = [question("a", ["左地域"]), question("b", ["左地域"]), question("c", ["右地域"]), question("d", ["右地域"])];
  const common = { schema_version: 1, source_sha256: "fixture" };
  return prepareMap(questions, { ...common, points: { a: [-20, 0], b: [-19, 1], c: [20, 0], d: [21, 1] } },
    { ...common, terms: { "左の特徴": ["a", "b"], "右の特徴": ["c", "d"] } }, { ...common, count: 4 });
}
test("地域の出題候補は全座標から選び、円の境界・空範囲・最大5問を守る", () => {
  const model = fixture(), camera = { x: 0, y: 0, scale: 1 };
  assert.equal(practiceCandidates(model, camera, 44, 20).length, 4);
  assert.deepEqual(practiceCandidates(model, camera, 44, 20, { x: 0, y: 0, radius: 20 }).map(p => p.id), ["a", "b", "c"]);
  assert.equal(practiceCandidates(model, camera, 44, 20, { x: 0, y: 0, radius: 18 }).length, 0);
  assert.equal(practiceCandidates(model, camera, 44, 20, { x: 0, y: 0, radius: 0 }).length, 0);
  const left = practiceCandidates(model, camera, 44, 20, { x: -19, y: 0, radius: 2 });
  assert.deepEqual(new Set(left.map(p => p.id)), new Set(["a", "b"]));
  assert.deepEqual(samplePractice([]), []);
  assert.deepEqual(new Set(samplePractice(left)), new Set(left));
  const pool = Array.from({ length: 80 }, (_, id) => ({ id })), original = [...pool];
  const selected = samplePractice(pool, () => .9999);
  assert.equal(selected.length, 5); assert.equal(new Set(selected).size, 5);
  assert.ok(selected.every(p => pool.includes(p))); assert.ok(selected.includes(pool.at(-1)));
  assert.deepEqual(pool, original);
});
test("実データの全ID・座標・用語索引・メタデータが対応する", async () => {
  const app = new URL("../../info1-quiz-app/data/questions/", import.meta.url);
  const data = await Promise.all(["completed_questions.json", "map_points.json", "map_terms.json", "map_metadata.json"].map(async name => JSON.parse(await readFile(new URL(name, app), "utf8"))));
  const model = prepareMap(...data);
  const source = await readFile(new URL("completed_questions.json", app), "utf8");
  assert.equal(await verifySourceText(source, data[3].source_sha256), true);
  assert.equal(await verifySourceText(source.replace(/\r?\n/g, "\r\n"), data[3].source_sha256), true);
  assert.equal(await verifySourceText(source.replace(data[0][0].stem, "Changed source"), data[3].source_sha256), false);
  assert.equal(model.points.length, data[3].count);
  assert.ok(model.terms.size > 500);
  assert.strictEqual(model.points[0].question, data[0][0]);
  for (const width of [320, 390, 1280]) {
    const camera = fitCamera(model.bounds, width, 500);
    assert.equal(model.index.query(viewBounds(camera, width, 500)).length, model.points.length);
  }
});
test("破損した座標・古い索引・異なる世代のデータを拒否する", () => {
  const questions = [question("a", ["タグ"])], common = { schema_version: 1, source_sha256: "fixture" };
  const points = { ...common, points: { a: [0, 0] } }, terms = { ...common, terms: {} }, metadata = { ...common, count: 1 };
  assert.throws(() => prepareMap(questions, { ...points, source_sha256: "other" }, terms, metadata));
  assert.throws(() => prepareMap(questions, { ...points, points: { a: [NaN, 0] } }, terms, metadata));
  assert.throws(() => prepareMap(questions, points, { ...terms, terms: { "不明": ["missing"] } }, metadata));
  assert.throws(() => prepareMap(questions, { ...points, points: { a: [0, 0], b: [1, 1] } }, terms, metadata));
});
test("空間索引は境界・負座標・狭い表示範囲で全走査と一致する", () => {
  const points = Array.from({ length: 500 }, (_, i) => ({ x: Math.sin(i * 7) * 80, y: Math.cos(i * 3) * 40, id: i }));
  const index = new SpatialIndex(points);
  for (let i = 0; i < 20; i++) {
    const bounds = { minX: -50 + i * 3, maxX: -45 + i * 3, minY: -20 + i, maxY: -12 + i };
    const expected = points.filter(p => p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY);
    assert.deepEqual(index.query(bounds).map(p => p.id).sort(), expected.map(p => p.id).sort());
  }
});
test("拡大・縮小してもカーソル下の座標が動かず、上限下限も守る", () => {
  const camera = { x: 7, y: -3, scale: 4 }, anchor = { x: 145, y: 270 };
  const original = unproject(anchor, camera, 800, 500);
  for (const factor of [.01, .5, 2, 1000]) {
    const result = zoomAbout(camera, factor, anchor, 800, 500, 2, 96);
    const after = unproject(anchor, result, 800, 500);
    assert.ok(Math.abs(original.x - after.x) < 1e-9 && Math.abs(original.y - after.y) < 1e-9);
    assert.ok(result.scale >= 2 && result.scale <= 96);
    assert.deepEqual(project(original, result, 800, 500), anchor);
  }
});
test("情報量の境界付近で表示が交互に切り替わらない", () => {
  let stage = -1;
  for (const zoom of [1.49, 1.55, 1.59]) { stage = stageAt(zoom, stage); assert.equal(stage, -1); }
  assert.equal(stageAt(2.1, stage), 0);
  for (const zoom of [1.5, 1.42, 1.6]) assert.equal(stageAt(zoom, 0), 0);
  assert.equal(stageAt(1, 4), -1);
  assert.equal(stageAt(36, 0), 2);
});

test("海岸線は閉じた密度輪郭で、成績を切り替えても位置が変わらない", () => {
  const model = fixture();
  const neutral = heatField(model, new Map(), 240);
  const answered = heatField(model, new Map([["a", {attempts:10,correct:2}]]), 240);
  const coast = coastContours(neutral);
  assert.ok(coast.length > 0);
  assert.deepEqual(coast, coastContours(answered));
  for (const contour of coast) assert.deepEqual(contour[0], contour.at(-1));
});
test("文字は拡大につれて大きく薄くなり、引くと戻る", () => {
  const near = labelPresentation(18, 2, 4, 4, "tag"), nearer = labelPresentation(18, 2, 6, 6, "tag");
  assert.ok(nearer.size > near.size && nearer.opacity < near.opacity);
  assert.equal(labelPresentation(18, 2, 2, 1, "tag").opacity, 0);
  assert.equal(labelPresentation(18, 2, 8, 8, "tag").opacity, 0);
});
test("明示したレイヤーは引いても読める大きさで表示され、拡大で適度に育つ", () => {
  for (const kind of ["tag", "term"]) {
    const far = labelPresentation(18, 4.5, 1, 1, kind, "on");
    const near = labelPresentation(18, 4.5, 96, 96, kind, "on");
    assert.equal(far.opacity, 1); assert.equal(near.opacity, 1);
    assert.ok(far.size >= 12 && near.size > far.size && near.size <= 28);
    assert.equal(labelPresentation(18, 4.5, 1, 1, kind, "off").opacity, 0);
  }
  const far = questionPresentation(1, "on"), near = questionPresentation(20, "on");
  assert.equal(far.opacity, 1); assert.ok(far.fontSize >= 12 && far.width < near.width && far.lines < near.lines);
  assert.ok(near.fontSize > far.fontSize);
  assert.equal(questionPresentation(1).opacity, 0);
  assert.equal(questionPresentation(20, "off").opacity, 0);
});
test("周辺問題は距離順で、学習アプリの最大10問に収まる", () => {
  const model = fixture();
  const local = surroundingQuestions(model, model.byId.get("a"), 4, 10);
  assert.deepEqual(local.map(p=>p.id), ["a","b"]);
  assert.equal(surroundingQuestions(model, model.byId.get("a"), 100, 2).length, 2);
});
test("全体成績は取得した集計だけを正規化し、不正な応答を拒否する", async () => {
  const source = await readFile(new URL("../../info1-quiz-app/app/startup.js", import.meta.url), "utf8");
  assert.ok(parseStatsConfig(source).url.endsWith("get_question_stats"));
  const records = normalizeStats({questions:{a:{attempts:20,correct:15},b:{attempts:0,correct:0},unknown:{attempts:99,correct:99}}},["a","b","missing"]);
  assert.equal(records.get("a").rate,.75);assert.equal(records.size,1);
  assert.throws(()=>normalizeStats({questions:[]},["a"]));
  assert.throws(()=>normalizeStats({questions:{a:{attempts:2,correct:3}}},["a"]));
});
test("全体成績は200問ずつ読み取り専用で取得し、バッチ失敗を隠さない", async () => {
  const ids=Array.from({length:451},(_,i)=>"q"+i),calls=[];
  const source='const supabaseProbeUrl = "https://example.invalid/rest/v1/rpc/get_question_stats"; const supabasePublishableKey = "public-test";';
  const fetchImpl=async (url,init)=>{
    if(url==="config")return new Response(source);
    calls.push(init);const batch=JSON.parse(init.body).p_ids;
    return new Response(JSON.stringify({questions:Object.fromEntries(batch.map(id=>[id,{attempts:10,correct:8}]))}));
  };
  const records=await loadQuestionStats(ids,"config",{fetchImpl});assert.equal(records.size,451);
  assert.deepEqual(calls.map(c=>JSON.parse(c.body).p_ids.length),[200,200,51]);
  for(const c of calls){assert.equal(c.method,"POST");assert.deepEqual(Object.keys(JSON.parse(c.body)),["p_ids"]);}
  await assert.rejects(loadQuestionStats(ids,"config",{fetchImpl:async url=>url==="config"?new Response(source):new Response("offline",{status:503})}));
});
test("移動先の問題から言葉を選び、小さな移動では地理的アンカーを維持する", () => {
  const model = fixture(), camera = { x: -20, y: 0, scale: 10 };
  const visible = model.index.query(viewBounds(camera, 200, 200));
  const labels = labelCandidates(visible, model, camera, 200, 200, 1);
  assert.ok(labels.some(l => l.text === "左地域"));
  assert.ok(labels.some(l => l.text === "左の特徴"));
  assert.ok(labels.every(l => !l.text.includes("右")));
  const previous = new Map(labels.map(l => [l.key, l]));
  const moved = labelCandidates(visible, model, { ...camera, x: -19.8 }, 200, 200, 1, previous);
  for (const label of moved) assert.equal(label.anchor.id, previous.get(label.key).anchor.id);
  const rightCamera = { ...camera, x: 20 };
  const right = labelCandidates(model.index.query(viewBounds(rightCamera, 200, 200)), model, rightCamera, 200, 200, 1, previous);
  assert.ok(right.every(l => !l.text.includes("左")));
});
test("文字幅と操作ボタン・カードの予約領域から重なりを避ける", () => {
  const reserved = [{ x: 0, y: 0, w: 100, h: 100 }];
  const candidates = Array.from({ length: 30 }, (_, i) => ({ key: String(i), text: "長い地名", size: 20, x: 40 + i * 13, y: 50 + i * 9 }));
  const placed = placeLabels(candidates, 400, 300, () => 80, reserved);
  assert.ok(placed.length > 0 && placed.length < candidates.length);
  for (let i = 0; i < placed.length; i++) {
    assert.ok(!overlaps(placed[i].box, reserved[0]));
    for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i].box, placed[j].box));
  }
});
test("学習履歴の現在形式・旧形式・消去・破損を読み取り専用で扱う", () => {
  const raw = { v: 1, q: { a: [10, 8, 1, 0, "111", 0], b: [2, 8], c: [-1, 2], d: "bad" } };
  const before = JSON.stringify(raw);
  const records = historyRecords(raw, { old: { attempts: 20, correct: 10 } });
  assert.equal(records.get("a").rate, .8); assert.equal(records.get("b").rate, 1); assert.equal(records.size, 2);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(historyRecords({ v: 1, q: {} }, { old: { attempts: 20, correct: 10 } }).size, 0);
  assert.equal(historyRecords(null, { old: { attempts: 20, correct: 10 } }).get("old").rate, .5);
  assert.equal(historyRecords(null, null).size, 0);
});
test("地形は回答数で重み付けし、未挑戦を中立色に保つ", () => {
  const model = fixture();
  model.points[1].x = model.points[0].x; model.points[1].y = model.points[0].y;
  const neutral = heatField(model, new Map());
  const colored = heatField(model, new Map([["a", { attempts: 1, correct: 0 }], ["b", { attempts: 9, correct: 9 }]]));
  const point = model.points[0];
  const x = Math.round((point.x - colored.bounds.minX) / (colored.bounds.maxX - colored.bounds.minX) * colored.width);
  const y = Math.round((point.y - colored.bounds.minY) / (colored.bounds.maxY - colored.bounds.minY) * colored.height);
  const pixel = (y * colored.width + x) * 4;
  assert.deepEqual([...colored.pixels.slice(pixel, pixel + 3)], rateColor(.9));
  assert.deepEqual([...neutral.pixels.slice(pixel, pixel + 3)], rateColor(null));
  assert.ok(colored.pixels[pixel + 3] > neutral.pixels[pixel + 3]);
});

test("全体の地域差を強調しても正答率は変更せず、未挑戦も着色しない", () => {
  const range = regionalColorRange([.65, .66, .68, .7, .72, .74, .75]);
  assert.ok(range[1] - range[0] >= .1599 && range[1] - range[0] < .3);
  assert.ok(colorRate(.75, range) - colorRate(.65, range) > .5);
  assert.equal(colorRate(null, range), null);
  assert.ok(regionalColorRange(Array(50).fill(.7))[1] - regionalColorRange(Array(50).fill(.7))[0] >= .1599);
  const model = fixture(), records = new Map([["a", { attempts: 100, correct: 65 }], ["d", { attempts: 100, correct: 75 }]]);
  const before = JSON.stringify([...records]);
  const field = heatField(model, records, 240, { contrast: true });
  assert.equal(JSON.stringify([...records]), before);
  assert.ok(field.colorRange[1] - field.colorRange[0] < .3);
  assert.deepEqual(heatField(model, new Map(), 240, { contrast: true }).colorRange, [0, 1]);
});

test("密集した問題は位置を譲り、操作領域を避けながら複数表示する", () => {
  const candidates = Array.from({length: 8}, (_, i) => ({id: String(i), x: 400 + i * 4, y: 300 + i * 2, w: 220, h: 110}));
  const reserved = [{x: 0, y: 0, w: 165, h: 65}, {x: 730, y: 0, w: 70, h: 160}];
  const placed = placeQuestionCards(candidates, 800, 600, reserved);
  assert.ok(placed.length >= 3);
  for (const item of placed) {
    assert.ok(item.box.x >= 10 && item.box.x + item.w <= 790 && item.box.y >= 10 && item.box.y + item.h <= 565);
    for (const box of reserved) assert.ok(!overlaps(item.box, box, 0));
  }
  const previous = new Map(placed.map(p => [p.id, p]));
  const moved = placeQuestionCards(candidates.map(c => ({...c, x:c.x+1})), 800, 600, reserved, previous);
  assert.deepEqual(moved.map(p => p.id), placed.map(p => p.id));
  assert.ok(moved.every(p => Math.abs(p.dx - previous.get(p.id).dx) < 2));
  assert.ok(placeQuestionCards([{id:"edge", x:2,y:100,w:224,h:150}], 278, 390, [{x:208,y:0,w:70,h:158}]).length);
});

test("中央は読める大きさを保ち、周辺の問題は小さな窓になる", () => {
  const centerFocus=cardFocus(500,300,1000,600),edgeFocus=cardFocus(30,40,1000,600);
  assert.equal(centerFocus,1);assert.ok(edgeFocus<.1);
  for(const mobile of [false,true]){
    const center=questionPresentation(9,"on",mobile,centerFocus),edge=questionPresentation(9,"on",mobile,edgeFocus);
    assert.ok(center.fontSize>=15&&edge.fontSize>=11&&edge.fontSize<center.fontSize);
    assert.ok(edge.width<center.width*.7&&edge.lines<center.lines&&edge.padding<center.padding);
    assert.ok(edge.backgroundAlpha>.7&&center.backgroundAlpha<1);
  }
});

test("一地域の高得点候補より先に、別の表示地域へ枠を配る", () => {
  const dense=Array.from({length:80},(_,i)=>({id:"dense"+i,x:60+i%5,y:60+i%4,score:100-i*.1}));
  const sparse=[{id:"right",x:600,y:80,score:1},{id:"bottom",x:600,y:450,score:1}];
  const order=spatialOrder([...dense,...sparse],800,600);
  assert.deepEqual(new Set(order.slice(0,3).map(p=>p.id)),new Set(["dense0","right","bottom"]));
  const candidates=Array.from({length:48},(_,i)=>{
    const x=60+(i%8)*125,y=90+Math.floor(i/8)*100,focus=cardFocus(x,y,1060,690),view=questionPresentation(9,"on",false,focus);
    return {id:String(i),x,y,w:view.width,h:view.fontSize*view.leading*view.lines+view.padding*2+2,score:focus*3};
  });
  const placed=placeQuestionCards(spatialOrder(candidates,1060,690),1060,690,[],new Map(),44);
  assert.ok(placed.length>=20,`Expected many readable windows, got ${placed.length}`);
  assert.ok(new Set(placed.map(p=>Math.floor(p.x/265))).size>=4);
});
