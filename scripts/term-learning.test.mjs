import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../assets/term-state.js', import.meta.url), 'utf8'), { window });
const model = window.StudyAtlasTerms;
const plain = (value) => JSON.parse(JSON.stringify(value));
const storage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
};
const terms = ['Alpha', 'Beta', 'Gamma', 'Delta'].map(tag => ({tag}));
const select = (options = {}) => model.selectTerms(terms, { view:'all', filter:'all', query:'', scores: new Map(), states: {}, ...options });

test('recommendations count each question once, recover at half weight, and include every term tag', () => {
  const records = { q1:[1,0,0], q2:[5,4,1], q3:[10,10,1], q4:[0,0,-1], q5:[9,0,0] };
  const tags = { q1:['Alpha','Beta','Alpha'], q2:['Alpha'], q3:['Alpha'], q4:['Alpha'], q5:['Gamma'] };
  const scores = model.recommendationScores(records,tags);
  assert.equal(scores.get('Alpha'), 1.5 * (0.5 + 0.5*1.5/2.5));
  assert.equal(scores.get('Beta'), 1);
  assert.equal(scores.get('Gamma'), 1);
  assert.deepEqual(plain(select({view:'recommended',scores}).map(term=>term.tag)),['Alpha','Beta','Gamma']);
  const once = model.recommendationScores({q1:[1,0,0]}, {q1:['Alpha']});
  const repeated = model.recommendationScores({q1:[50,0,0]}, {q1:['Alpha']});
  assert.equal(once.get('Alpha'),repeated.get('Alpha'));
  assert.equal(model.recommendationScores({q1:[2,1,1]}, {q1:['Alpha']}).get('Alpha'),0.5);
  assert.equal(model.recommendationScores({q1:[7,7,1]}, {q1:['Alpha']}).get('Alpha'),0);
  const many = Array.from({length:120},(_,index)=>({tag:`term-${index}`}));
  assert.equal(model.selectTerms(many,{view:'recommended',filter:'all',query:'',scores:new Map(many.map(({tag})=>[tag,1])),states:{}}).length,120);
});

test('missing, malformed, and legacy records use safe history defaults', () => {
  assert.equal(model.questionState(null),null);
  assert.equal(model.questionState([0,0,-1]),null);
  assert.equal(model.hasWrongHistory({q1:[2,2,1]}),false);
  assert.equal(model.hasWrongHistory({q1:[2,1,1]}),true);
  const disk = storage();
  disk.setItem(model.CONFIG.legacyLearningKey, JSON.stringify({old:{attempts:5,correct:3}}));
  assert.equal(model.hasWrongHistory(model.loadLearning(disk)),true);
  assert.equal(model.recommendationScores(model.loadLearning(disk),{old:['Alpha']}).get('Alpha'),1);
  disk.setItem(model.CONFIG.learningKey, JSON.stringify({v:1,q:{new:[2,1,1]}}));
  assert.deepEqual(plain(model.loadLearning(disk)),{new:[2,1,1]});
  assert.deepEqual(plain(model.loadLearning({getItem(){throw Error('disabled')}})),{});
});

test('all eight view/filter combinations preserve score order and exclude score zero', () => {
  const scores = new Map([['Alpha',1],['Beta',2],['Gamma',1],['Delta',0]]);
  const states = {Alpha:{read:true,favorite:true},Beta:{read:false},Gamma:{read:true},Delta:{read:false}};
  const expected = {all:{all:['Alpha','Beta','Gamma','Delta'],unread:['Beta','Delta'],read:['Alpha','Gamma'],favorite:['Alpha']}, recommended:{all:['Beta','Alpha','Gamma'],unread:['Beta'],read:['Alpha','Gamma'],favorite:['Alpha']}};
  for (const [view, filters] of Object.entries(expected)) for (const [filter, tags] of Object.entries(filters)) {
    assert.deepEqual(plain(select({view,filter,scores,states}).map(term=>term.tag)),tags);
  }
});

test('favorites and read status are independent and shared between stores', () => {
  const disk = storage();
  const first = model.createStore(disk);
  assert.equal(first.toggleFavorite('Alpha').read,false);
  const second = model.createStore(disk);
  assert.equal(second.read().Alpha.favorite,true);
  assert.equal(second.toggleFavorite('Alpha').read,false);
  assert.equal(first.read().Alpha.favorite,false);
  first.progress('Alpha',10000,0);
  assert.equal(first.toggleFavorite('Alpha').read,true);
  assert.equal(first.toggleFavorite('Alpha').read,true);
  disk.setItem(model.CONFIG.storageKey,JSON.stringify({v:1,terms:{Beta:{favorite:true,read:false}}}));
  assert.equal(first.read().Beta.read,false);
  const blocked = model.createStore({getItem(){throw Error()},setItem(){throw Error()}});
  assert.equal(blocked.toggleFavorite('Alpha').favorite,true);
  assert.equal(blocked.read().Alpha.read,false);
  assert.equal(blocked.toggleFavorite('Alpha').favorite,false);
});

test('reading requires ten seconds OR body reach, persists across visits', () => {
  const disk = storage();
  let store = model.createStore(disk);
  assert.equal(store.progress('Alpha',0,0.69).read,false);
  assert.equal(store.progress('Alpha',0,0.7).read,true);
  assert.equal(store.progress('Beta',9999,0).read,false);
  store = model.createStore(disk);
  assert.equal(store.progress('Beta',1,0).read,true);
  assert.equal(model.reachRatio({top:100,height:500},800),1); // Short/no-scroll article.
  assert.equal(model.reachRatio({top:1000,height:1000},800),0);
  assert.equal(model.reachRatio({top:-200,height:1000},500),0.7);
  const tick = model.createReadingClock(0,true);
  assert.equal(tick(7000,false),7000);
  assert.equal(tick(99000,true),0);
  assert.equal(tick(112000,true),13000);
});

test('single-word relevance ranks exact, prefix, substring, body regardless of recommendation scores', () => {
  const searchTerms = ['body','part','prefix','exact'].map(tag=>({tag}));
  const searchData = {body:{title:'Body',body:'about alpha'},part:{title:'An Alpha term',body:''},prefix:{title:'Alpha test',body:''},exact:{title:'ＡＬＰＨＡ',body:''}};
  const scores = new Map([['body',4],['part',3],['prefix',2],['exact',1]]);
  for(const view of ['all','recommended']) {
    assert.deepEqual(plain(model.selectTerms(searchTerms,{view,filter:'all',query:'Alpha',scores,states:{},searchData}).map(term=>term.tag)),['exact','prefix','part','body']);
  }
  assert.equal(scores.get('body'),4);
});

test('multi-keyword AND, title match count, width/case normalization, and excerpts', () => {
  const searchTerms = ['body','one','both','none'].map(tag=>({tag}));
  const searchData = {body:{title:'Example',body:'alpha with beta'},one:{title:'alpha',body:'beta'},both:{title:'Beta plus Alpha',body:''},none:{title:'alpha',body:''}};
  const selected = model.selectTerms(searchTerms,{view:'all',filter:'all',query:'Ａｌｐｈａ　ＢＥＴＡ',scores:new Map(),states:{},searchData});
  assert.deepEqual(plain(selected.map(term=>term.tag)),['both','one','body']);
  assert.ok(selected[2].excerpt.includes('alpha'));
  assert.equal(model.normalize('ﾈｯﾄﾜｰｸ　ＡＢＣ'),'ネットワーク abc');
  assert.deepEqual(plain(model.keywords('  Alpha  alpha　Beta  ')),['alpha','beta']);
  const longBody = '前'.repeat(200) + 'ＡＬＰＨＡ' + '後'.repeat(200);
  assert.ok(model.excerpt(longBody,['alpha']).includes('ＡＬＰＨＡ'));
  assert.ok(model.excerpt(longBody,['alpha']).startsWith('前'));
  assert.ok(model.excerpt(longBody,['alpha']).length < 310);
  assert.ok(model.excerpt('前'.repeat(200)+'ｶﾞｲﾄﾞの解説',['ガイド'.toLowerCase()]).includes('ｶﾞｲﾄﾞ'));
});

test('same relevance falls back to original order or recommendation score, while filters stay applied', () => {
  const searchData = Object.fromEntries(terms.map(({tag})=>[tag,{title:tag,body:'common'}]));
  const scores = new Map([['Alpha',1],['Beta',3],['Gamma',2],['Delta',0]]);
  assert.deepEqual(plain(select({query:'common',searchData,scores}).map(term=>term.tag)),['Alpha','Beta','Gamma','Delta']);
  assert.deepEqual(plain(select({query:'common',searchData,scores,view:'recommended',filter:'unread',states:{Beta:{read:true}}}).map(term=>term.tag)),['Gamma','Alpha']);
});

test('lazy data fetch deduplicates in-flight and successful requests, and permits retry after failure', async () => {
  let calls = 0;
  let resolve;
  const load = model.lazyData(()=>{calls++;return new Promise(done=>{resolve=done})});
  assert.equal(calls,0);
  const first=load(), second=load();
  await Promise.resolve();
  assert.equal(calls,1);
  resolve({value:1});
  assert.equal(await first,await second);
  await load();
  assert.equal(calls,1);
  let failedCalls=0;
  const retry = model.lazyData(()=>{if(++failedCalls===1) throw Error('offline');return {ok:true}});
  await assert.rejects(retry());
  assert.equal((await retry()).ok,true);
  assert.equal(failedCalls,2);
});


test('normalized highlight ranges preserve source width, voiced marks and overlapping keywords', () => {
  assert.deepEqual(plain(model.matchRanges('ｶﾞｲﾄﾞ ＡＢＣ abc',['ガイド','abc','ab'])),[[0,5],[6,9],[10,13]]);
  const body = '前'.repeat(100)+'needle'+'後'.repeat(200);
  const snippet = model.excerpt(body,['needle']);
  assert.equal(snippet.indexOf('needle'),100);
  assert.equal(model.excerpt('最初の文。対象のneedleです。続き',['needle']).startsWith('…対象のneedle'),true);
  assert.equal(model.excerpt('見出し\n新しい行のneedleです',['needle']).startsWith('…新しい行のneedle'),true);
  assert.ok(snippet.slice(snippet.indexOf('needle')+6).length>90);
});


test('manual unread survives automatic progress and keeps favorites until the next visit', () => {
  const disk=storage();
  const store=model.createStore(disk);
  store.toggleFavorite('Alpha');
  assert.equal(store.toggleRead('Alpha').read,true);
  assert.equal(store.toggleRead('Alpha').read,false);
  assert.equal(store.read().Alpha.favorite,true);
  assert.equal(store.progress('Alpha',20000,1).read,false);
  assert.equal(model.createStore(disk).read().Alpha.manualUnread,true);
  store.beginReading('Alpha');
  assert.equal(store.progress('Alpha',9999,0).read,false);
  assert.equal(store.progress('Alpha',1,0).read,true);
});
