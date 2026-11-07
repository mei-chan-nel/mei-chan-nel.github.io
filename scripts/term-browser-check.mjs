// Optional browser regression suite. Start preview_site.py, then run with Playwright installed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { before, after } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const axe = readFileSync(require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js'), 'utf8');
const base = process.env.TERM_TEST_URL || 'http://127.0.0.1:8773';
const searchData = JSON.parse(readFileSync(new URL('../data/term-search.json', import.meta.url),'utf8'));
const termCount = Object.keys(searchData).length;
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']})});
after(async()=>{await browser?.close()});
async function setup(seed={},viewport={width:1280,height:900}) {
  const context=await browser.newContext({viewport});
  context.setDefaultTimeout(10000);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(seed=>{for(const [key,value] of Object.entries(seed)) localStorage.setItem(key,JSON.stringify(value))},seed);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return {context,page,errors};
}
const visibleTags=page=>page.locator('#term-results > li:visible > a').allTextContents();
async function checkAxe(page) {
  await page.evaluate(axe);
  const violations=await page.evaluate(async()=> (await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[]);
}

test('initial/focus/whitespace do not fetch; first input loads once and uses the latest input',async()=>{
  const {context,page,errors}=await setup();
  let requests=0,release;
  const gate=new Promise(resolve=>{release=resolve});
  await page.route('**/data/term-search.json',async route=>{requests++;await gate;await route.fulfill({json:searchData})});
  await page.goto(`${base}/terms/`);
  assert.equal((await visibleTags(page)).length,termCount);
  await page.locator('#term-search').focus();
  await page.locator('#term-search').fill('　 ');
  assert.equal(requests,0);
  await page.locator('#term-search').fill('公開鍵');
  await page.waitForFunction(()=>document.querySelector('#term-search-message').textContent.includes('読み込んで'));
  await page.locator('#term-search').fill('ビット');
  assert.equal(requests,1);
  release();
  await page.waitForFunction(()=>document.querySelector('[data-term-count]').textContent.startsWith('検索結果'));
  assert.equal((await visibleTags(page))[0],'ビット');
  assert.ok(await page.locator('.term-search-excerpt:visible').count()>0);
  await page.locator('#term-search').fill('ＡＩ');
  assert.equal((await visibleTags(page))[0],'AI');
  await page.locator('#term-search').fill('');
  assert.equal((await visibleTags(page)).length,termCount);
  await page.getByRole('radio',{name:'未読',exact:true}).check();
  await page.locator('#term-search').fill('ビット');
  assert.equal(await page.getByRole('radio',{name:'未読',exact:true}).isChecked(),true);
  assert.equal(requests,1);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('failed/invalid search data keeps normal list usable and explicit retry succeeds',async()=>{
  const {context,page,errors}=await setup();
  let requests=0;
  await page.route('**/data/term-search.json',route=>{
    requests++;
    return requests===1?route.fulfill({status:503,body:'offline'}):requests===2?route.fulfill({json:{}}):route.fulfill({json:searchData});
  });
  await page.goto(`${base}/terms/`);
  await page.locator('#term-search').fill('ビット');
  await page.getByRole('button',{name:'検索データを再読み込み'}).waitFor();
  assert.equal((await visibleTags(page)).length,termCount);
  await page.getByRole('radio',{name:'既読',exact:true}).check();
  assert.equal((await visibleTags(page)).length,0);
  await page.getByRole('radio',{name:'すべて',exact:true}).check();
  await page.getByRole('button',{name:'検索データを再読み込み'}).click();
  await page.waitForFunction(()=>document.querySelector('#term-search-message').textContent.includes('読み込めません'));
  await page.getByRole('button',{name:'検索データを再読み込み'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-term-count]').textContent.startsWith('検索結果'));
  assert.equal((await visibleTags(page))[0],'ビット');
  assert.equal(requests,3);
  await page.locator('#term-search').fill('');
  assert.equal((await visibleTags(page)).length,termCount);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('clearing input during load restores normal list after completion',async()=>{
  const {context,page}=await setup();
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  await page.route('**/data/term-search.json',async route=>{await gate;await route.fulfill({json:searchData})});
  await page.goto(`${base}/terms/`);
  await page.locator('#term-search').fill('ビット');
  await page.waitForFunction(()=>document.querySelector('#term-search-message').textContent.includes('読み込んで'));
  await page.locator('#term-search').fill('');
  release();
  await page.waitForFunction(()=>document.querySelector('#term-results').getAttribute('aria-busy')==='false');
  assert.equal((await visibleTags(page)).length,termCount);
  assert.equal(await page.locator('#term-search-message').textContent(),'');
  await context.close();
});

const learning={v:1,q:{center_style_seed_0005:[10,0,0],center_style_seed_0013:[2,1,1],center_style_seed_0017:[3,3,1]}};
test('recommendation defaults, score order, eight combinations, and persisted preferences',async()=>{
  const {context,page,errors}=await setup({'info1LearningRecord:v1':learning,'studyAtlasTerms:v1':{v:1,terms:{'改竄':{read:true,favorite:true},'公開鍵暗号方式':{read:true}}}});
  let searchRequests=0;
  page.on('request',request=>{if(request.url().endsWith('/term-search.json')) searchRequests++});
  await page.goto(`${base}/terms/`);
  await page.waitForFunction(()=>document.querySelector('[data-term-count]').textContent==='1件');
  assert.equal(await page.getByRole('radio',{name:'あなたへのおすすめ'}).isChecked(),true);
  assert.equal(await page.getByRole('radio',{name:'未読',exact:true}).isChecked(),true);
  assert.deepEqual(await visibleTags(page),['共通鍵暗号方式']);
  const expected={recommended:{all:['改竄','共通鍵暗号方式','公開鍵暗号方式'],unread:['共通鍵暗号方式'],read:['改竄','公開鍵暗号方式'],favorite:['改竄']},all:{all:termCount,unread:termCount-2,read:2,favorite:1}};
  for(const [view,filters]of Object.entries(expected)) {
    await page.locator(`input[name="term-view"][value="${view}"]`).check();
    for(const [filter,result]of Object.entries(filters)) {
      await page.locator(`input[name="term-filter"][value="${filter}"]`).check();
      const tags=await visibleTags(page);
      if(Array.isArray(result)) assert.deepEqual(tags,result); else assert.equal(tags.length,result);
    }
  }
  await page.reload();
  assert.equal(await page.getByRole('radio',{name:'お気に入り',exact:true}).isChecked(),true);
  assert.equal(await page.locator('#term-search').inputValue(),'');
  assert.equal(searchRequests,0);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('recommendation fetch failure offers retry and normal list remains available without body data',async()=>{
  const {context,page}=await setup({'info1LearningRecord:v1':learning});
  let attempts=0;
  await page.route('**/data/term-question-tags.json',route=>++attempts===1?route.fulfill({status:500,body:'offline'}):route.continue());
  await page.goto(`${base}/terms/`);
  await page.getByRole('button',{name:'おすすめを再読み込み'}).waitFor();
  assert.equal((await visibleTags(page)).length,termCount);
  await page.getByRole('button',{name:'おすすめを再読み込み'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-term-count]').textContent==='3件');
  await page.getByRole('radio',{name:'用語一覧',exact:true}).check();
  assert.equal((await visibleTags(page)).length,termCount);
  await page.getByRole('radio',{name:'あなたへのおすすめ'}).check();
  await page.waitForFunction(()=>document.querySelector('[data-term-count]').textContent==='3件');
  assert.equal(attempts,2);
  await context.close();
});

test('favorite keyboard toggle, persisted read invariant, cross-tab sync, mobile layout and a11y',async()=>{
  const {context,page,errors}=await setup({}, {width:390,height:844});
  await page.goto(`${base}/terms/`);
  const favorite=page.getByRole('button',{name:'ビットをお気に入りに登録',exact:true});
  await favorite.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button',{name:'ビットをお気に入りから解除',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'ビットをお気に入りから解除',exact:true}).evaluate(node=>document.activeElement===node),true);
  const article=await context.newPage();
  await article.goto(`${base}/terms/bit/`);
  await article.getByRole('button',{name:'ビットをお気に入りから解除',exact:true}).waitFor();
  assert.equal(await article.locator('[data-term-read-status]').textContent(),'既読');
  await article.getByRole('button',{name:'ビットをお気に入りから解除',exact:true}).click();
  await page.getByRole('button',{name:'ビットをお気に入りに登録',exact:true}).waitFor();
  assert.equal(await article.locator('[data-term-read-status]').textContent(),'既読');
  await page.reload();
  assert.equal(await page.locator('li').filter({has:page.locator('a[href="./bit/"]')}).locator('.term-read-status').textContent(),'既読');
  await checkAxe(page);
  await checkAxe(article);
  for(const target of [page,article]) assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('read timer excludes background, requires 70% body reach, and survives revisit',async()=>{
  const {context,page,errors}=await setup();
  await page.clock.install();
  await page.goto(`${base}/terms/bit/`);
  await page.bringToFront();
  await page.clock.runFor(21000);
  assert.equal(await page.locator('[data-term-read-status]').textContent(),'未読');
  await page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(30000);
  await page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
    document.dispatchEvent(new Event('visibilitychange'));
    const body=document.querySelector('#term-explanation');
    const rect=body.getBoundingClientRect();
    window.scrollTo({top:window.scrollY+rect.top+rect.height*0.72-innerHeight,behavior:'instant'});
  });
  await page.clock.runFor(1100);
  assert.equal(await page.locator('[data-term-read-status]').textContent(),'既読',await page.evaluate(()=>JSON.stringify({stored:localStorage.getItem('studyAtlasTerms:v1'),rect:document.querySelector('#term-explanation').getBoundingClientRect().toJSON(),focus:document.hasFocus()})));
  // A second article demonstrates that background time cannot meet the time condition.
  await page.goto(`${base}/terms/bps/`);
  await page.clock.runFor(5000);
  await page.evaluate(()=>{
    const body=document.querySelector('#term-explanation');const rect=body.getBoundingClientRect();
    window.scrollTo({top:window.scrollY+rect.top+rect.height-innerHeight,behavior:'instant'});
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(40000);
  assert.equal(await page.locator('[data-term-read-status]').textContent(),'未読');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.runFor(16000);
  assert.equal(await page.locator('[data-term-read-status]').textContent(),'既読');
  await page.reload();
  assert.equal(await page.locator('[data-term-read-status]').textContent(),'既読');
  assert.deepEqual(errors,[]);
  await context.close();
});

test('short article without scrolling, blocked storage, and no-JavaScript fallback',async()=>{
  const {context,page}=await setup({}, {width:1280,height:10000});
  await page.clock.install();
  await page.goto(`${base}/terms/bps/`);
  await page.bringToFront();
  await page.clock.runFor(21000);
  assert.equal(await page.locator('[data-term-read-status]').textContent(),'既読');
  await context.close();
  const blocked=await setup();
  await blocked.context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('disabled')}}));
  await blocked.page.goto(`${base}/terms/`);
  assert.equal((await visibleTags(blocked.page)).length,termCount);
  await blocked.page.getByRole('button',{name:'ビットをお気に入りに登録',exact:true}).click();
  await blocked.page.getByRole('button',{name:'ビットをお気に入りから解除',exact:true}).waitFor();
  assert.ok((await blocked.page.locator('[data-term-storage-message]').textContent()).includes('保存できません'));
  assert.deepEqual(blocked.errors,[]);
  await blocked.context.close();
  const staticContext=await browser.newContext({javaScriptEnabled:false});
  const staticPage=await staticContext.newPage();
  await staticPage.goto(`${base}/terms/`);
  assert.equal((await visibleTags(staticPage)).length,termCount);
  assert.equal(await staticPage.locator('[data-term-controls]').isVisible(),false);
  await staticContext.close();
});
