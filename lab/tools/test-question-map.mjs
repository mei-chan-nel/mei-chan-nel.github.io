import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.LAB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.LAB_BASE_URL||'http://127.0.0.1:8773';
const questions=JSON.parse(await readFile(new URL('../../../info1-quiz-app/data/questions/completed_questions.json',import.meta.url)));
const byId=new Map(questions.map(q=>[q.id,q]));
const browser=await chromium.launch({executablePath:process.env.LAB_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],requests=[];
async function ready(page){await page.waitForSelector('#map-status[hidden]',{state:'attached'});await page.waitForSelector('.preview-controls button:not([disabled])',{timeout:10000}).catch(()=>{});await page.waitForTimeout(350);}
async function stage(page,index){await page.locator(`[data-stage="${index}"]`).click();await page.waitForFunction(i=>document.querySelector(`[data-stage="${i}"]`).hasAttribute('aria-current'),index);await page.waitForTimeout(650);}
async function labels(page){return page.locator('.map-label').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.labelKey,text:n.textContent,scale:new DOMMatrix(getComputedStyle(n).transform).a,opacity:Number(getComputedStyle(n).opacity)})));}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
async function canvasColors(page){return page.locator('#map-canvas').evaluate(n=>{
 const d=n.getContext('2d').getImageData(0,0,n.width,n.height).data,s=[0,0,0];let count=0;
 for(let i=0;i<d.length;i+=4){if(d[i+3]!==255)continue;count++;for(let k=0;k<3;k++)s[k]+=d[i+k];}
 return s.map(v=>v/Math.max(1,count));
});}
try{
 for(const width of [1280,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===new URL(base).origin)return route.continue();
   if(url.pathname.endsWith('/get_question_stats')){
    const body=route.request().postDataJSON();requests.push(body);
    assert.deepEqual(Object.keys(body),['p_ids']);assert.ok(body.p_ids.length<=200);
    const data={questions:Object.fromEntries(body.p_ids.map(id=>[id,{attempts:20,correct:14}]))};
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
   }
   return route.fulfill({body:'',contentType:'application/javascript'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.coastStrokes=0;const stroke=CanvasRenderingContext2D.prototype.stroke;
   CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.canvas.id==='map-canvas'&&args[0] instanceof Path2D)window.coastStrokes++;return stroke.apply(this,args);};
  });
  await page.goto(base+'/lab/question-map/');await ready(page);
  assert.equal(await page.locator('#map-search,#heat-toggle,.map-toolbar').count(),0);
  assert.equal(await page.locator('.map-label').count(),0);
  assert.ok(await page.locator('#map-viewport').evaluate(n=>n.classList.contains('is-overview')));
  assert.ok(await page.evaluate(()=>window.coastStrokes>0));
  const legend=await page.evaluate(()=>['.heat-min','.heat-gradient','.heat-max'].map(s=>document.querySelector(s).getBoundingClientRect().x));
  assert.ok(legend[0]<legend[1]&&legend[1]<legend[2]);
  await stage(page,0);assert.ok(await page.locator('.map-label:not(.is-leaving)').count());
  const style=await page.locator('.map-label:not(.is-leaving)').first().evaluate(n=>({background:getComputedStyle(n).backgroundColor,stroke:getComputedStyle(n).webkitTextStrokeWidth}));
  assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.ok(parseFloat(style.stroke)>0);
  const before=await labels(page);await page.locator('#zoom-in').click();await page.waitForTimeout(150);const after=await labels(page);
  assert.ok(after.some(a=>before.some(b=>a.key===b.key&&a.scale>b.scale*1.15&&a.opacity<b.opacity)), 'Letters should grow and fade while approaching');
  await stage(page,1);
  for(const index of [2,3,4]){
   await stage(page,index);const card=page.locator('.map-card:not(.is-leaving)').first();assert.ok(await card.count());
   const href=await card.locator('.card-practice').getAttribute('href');const ids=new URL(href).searchParams.get('challenge').split(',');
   assert.ok(ids.length<=10&&ids.every(id=>byId.has(id)));assert.equal(await card.locator('.card-practice').textContent(),'この周りの問題を解く ↗');
   assert.equal(await card.locator('.card-stem').textContent(),byId.get(ids[0]).stem);
   assert.equal(await card.locator('.card-choices > li').count(),byId.get(ids[0]).choices.length);
   assert.equal(await card.locator('.card-explanation').count(),index===4?1:0);
   assert.equal(await card.getByRole('button',{name:/もっと近くへ/}).count(),0);
   const scroll=card.locator('.card-scroll');
   if(index===2&&await scroll.evaluate(n=>n.scrollHeight>n.clientHeight+20)){
    await scroll.scrollIntoViewIfNeeded();const rect=await scroll.boundingBox();const readout=await page.locator('#zoom-readout').textContent();
    if(width>=600){await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.wheel(0,240);}
    else{
     const cdp=await context.newCDPSession(page),x=rect.x+rect.width/2,y=rect.y+rect.height*.8;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
     for(const dy of [15,35,60,95]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-dy,id:1}]});await page.waitForTimeout(30);}
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await page.waitForTimeout(250);assert.ok(await scroll.evaluate(n=>n.scrollTop>0));assert.equal(await page.locator('#zoom-readout').textContent(),readout);
   }
  }
  await stage(page,-1);assert.equal(await page.locator('.map-label').count(),0);
  const localRecord=await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1'));
  const personal=await canvasColors(page);
  await page.locator('#score-global').click();await page.waitForFunction(()=>document.querySelector('#history-summary').textContent.includes('正答率70%'));
  assert.ok((await page.locator('#history-summary').textContent()).startsWith('全体成績'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1')),localRecord);
  assert.notDeepEqual(await canvasColors(page),personal);
  await page.locator('#score-personal').click();await page.waitForTimeout(300);
  const restored=await canvasColors(page);assert.ok(restored.every((v,i)=>Math.abs(v-personal[i])<.02));
  await noOverflow(page);
  if(width<600){
   await page.locator('#map-viewport').scrollIntoViewIfNeeded();const box=await page.locator('#map-viewport').boundingBox();
   const cdp=await context.newCDPSession(page),cx=box.x+box.width/2,cy=box.y+box.height/2;
   for(const [type,spread]of [['touchStart',25],['touchMove',40],['touchMove',60],['touchMove',80],['touchEnd',null]])await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:spread===null?[]:[{x:cx-spread,y:cy,id:1},{x:cx+spread,y:cy,id:2}]});
   await page.waitForTimeout(500);assert.ok(Number((await page.locator('#zoom-readout').textContent()).match(/×([\d.]+)/)[1])>2);
  }
  await stage(page,-1);
  const axePath=require.resolve(process.env.LAB_AXE_MODULE||'axe-core/axe.min.js');await page.addScriptTag({path:axePath});
  const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  console.log(`PASS ${width}px: map-only overview/coast, growing halo labels, card scroll/nearby challenge, personal/global read-only switch, zoom, WCAG`);
  await context.close();
 }
 const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.fulfill({status:503,body:'offline',headers:{'Access-Control-Allow-Origin':'*'}}));
 const page=await context.newPage();await page.goto(base+'/lab/question-map/');await ready(page);await page.locator('#score-global').click();
 await page.waitForSelector('#score-retry:not([hidden])');assert.ok((await page.locator('#history-summary').textContent()).includes('まだ取得できていません'));
 assert.ok(!(await page.locator('#history-summary').textContent()).includes('個人成績'));
 await page.locator('#score-personal').click();assert.ok((await page.locator('#history-summary').textContent()).startsWith('個人成績'));
 console.log('PASS failed aggregate request stays explicitly unavailable and never uses personal data as global data');
 await context.close();assert.deepEqual(errors,[]);assert.ok(requests.length>=24);
}finally{await browser.close();}
