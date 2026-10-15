import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.LAB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.LAB_BASE_URL||'http://127.0.0.1:8773';
const questions=JSON.parse(await readFile(new URL('../../../info1-quiz-app/data/questions/completed_questions.json',import.meta.url)));
const byId=new Map(questions.map(q=>[q.id,q]));
const coordinates=JSON.parse(await readFile(new URL('../../../info1-quiz-app/data/questions/map_points.json',import.meta.url))).points;
const browser=await chromium.launch({executablePath:process.env.LAB_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],requests=[];
async function ready(page){await page.waitForSelector('#map-status[hidden]',{state:'attached'});await page.waitForSelector('.preview-controls button:not([disabled])',{timeout:10000}).catch(()=>{});await page.waitForTimeout(350);}
async function zoomLevel(page){return Number((await page.locator('#zoom-readout').textContent()).match(/×([\d.]+)/)[1]);}
async function stage(page,index){
 if(index===-1){await page.locator('#map-home').click();await page.waitForFunction(()=>document.querySelector('#zoom-readout').textContent.startsWith('×1.0'));await page.waitForTimeout(750);return;}
 const target=[2.1,4.5,9][index];
 await page.locator('#map-viewport').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
 const box=await page.locator('#map-viewport').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<8;i++){
  const current=await zoomLevel(page);if(Math.abs(current-target)<.06)break;
  await page.mouse.wheel(0,Math.max(-150,Math.min(150,-Math.log(target/current)/.0035)));await page.waitForTimeout(350);
 }
 await page.waitForTimeout(650);assert.ok(Math.abs(await zoomLevel(page)-target)<=.200001);
}
async function selectedLayers(page){return page.locator('[data-layer]').evaluateAll(nodes=>nodes.filter(n=>n.getAttribute('aria-pressed')==='true').map(n=>n.dataset.layer));}
async function exhibitGeometry(page){return page.locator('.map-exhibit').evaluate(n=>{const r=n.getBoundingClientRect(),s=n.querySelector('.score-source').getBoundingClientRect();return{height:r.height,scoreTop:s.top-r.top};});}

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
    const data={questions:Object.fromEntries(body.p_ids.map(id=>[id,{attempts:100,correct:Math.round(70+coordinates[id][0]*.12)}]))};
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
  assert.equal(await page.locator('.map-hero h1').textContent(),'情報の可視化、問題マップ');
  assert.equal(await page.locator('#map-search,#heat-toggle,.map-toolbar,#map-settings,#heat-note,[data-stage]').count(),0);
  assert.deepEqual(await page.locator('.map-layer-controls button').allTextContents(),['タグ','単語','問題','自動']);
  assert.deepEqual(await selectedLayers(page),['tag']);assert.equal(await page.locator('#layers-mode').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await page.locator('.heat-range button').allTextContents(),['0～100％','地域差強調']);
  const positions=await page.evaluate(()=>{const a=document.querySelector('.heat-legend').getBoundingClientRect(),b=document.querySelector('.heat-range').getBoundingClientRect();return{right:a.right,x:b.x,dy:Math.abs((a.top+a.height/2)-(b.top+b.height/2)),font:parseFloat(getComputedStyle(document.querySelector('.heat-range')).fontSize)};});
  assert.ok(positions.x>=positions.right+3&&positions.dy<1&&positions.font<=12,'Small range toggle should sit directly to the right of legend');
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
  await stage(page,1);assert.deepEqual(await selectedLayers(page),['term']);
  await page.locator('#layer-term').click();assert.equal(await page.locator('#layers-mode').textContent(),'手動');assert.deepEqual(await selectedLayers(page),['term']);
  await page.locator('#layer-term').click();assert.deepEqual(await selectedLayers(page),[]);
  await page.locator('#layers-mode').click();await page.waitForTimeout(750);assert.deepEqual(await selectedLayers(page),['term']);
  await page.locator('#map-viewport').scrollIntoViewIfNeeded();
  const word=await page.locator('.map-label.is-term:not(.is-leaving)').evaluateAll(nodes=>{
   const v=document.querySelector('#map-viewport').getBoundingClientRect();
   return nodes.map(n=>{const r=n.getBoundingClientRect();return{key:n.dataset.labelKey,x:r.x+r.width/2,y:r.y+r.height/2,d:Math.hypot(r.x+r.width/2-v.x-v.width/2,r.y+r.height/2-v.y-v.height/2)};}).sort((a,b)=>a.d-b.d)[0];
  });
  assert.ok(word);
  await page.evaluate(key=>{
   const node=[...document.querySelectorAll('.map-label')].find(n=>n.dataset.labelKey===key),end=performance.now()+2400;
   window.wordFrames=[];
   function sample(){if(node.isConnected){const css=getComputedStyle(node);window.wordFrames.push({scale:new DOMMatrix(css.transform).a,opacity:Number(css.opacity),leaving:node.classList.contains('is-leaving')});}if(performance.now()<end)requestAnimationFrame(sample);}
   requestAnimationFrame(sample);
  },word.key);
  await page.mouse.move(word.x,word.y);
  for(let i=0;i<8;i++){await page.mouse.wheel(0,-60);await page.waitForTimeout(160);}
  await page.waitForTimeout(1000);
  const frames=await page.evaluate(()=>wordFrames);
  assert.ok(frames.filter(f=>f.opacity>.05&&f.opacity<.9).length>=8,'Words should have several intermediate fade frames');
  assert.ok(frames.some(f=>f.scale>2&&f.opacity<.7),'A fading word should continue to grow');
  assert.ok(frames.every(f=>!f.leaving||f.opacity<.1),'Growing labels should survive placement changes until faded');
  await stage(page,2);assert.deepEqual(await selectedLayers(page),['question']);
  const activeCards=()=>page.locator('.map-card:not(.is-leaving)');
  assert.ok(await activeCards().count()>=2,'Dense areas should show more than one stem');
  assert.equal(await page.locator('#map-cards .card-choices,#map-cards .card-scroll,#map-cards a').count(),0);
  const card=activeCards().first(),id=await card.getAttribute('data-question-id');
  assert.equal(await card.textContent(),byId.get(id).stem);
  const background=await card.evaluate(n=>getComputedStyle(n).backgroundColor.match(/[\d.]+/g).map(Number));
  assert.deepEqual(background.slice(0,3),[255,255,255]);assert.ok(background[3]>.7&&background[3]<1);
  await page.locator('#map-viewport').scrollIntoViewIfNeeded();
  let rect=await card.boundingBox();
  const yBefore=await page.evaluate(()=>scrollY),zoomBefore=await page.locator('#zoom-readout').textContent();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.wheel(0,-110);await page.waitForTimeout(450);
  assert.notEqual(await page.locator('#zoom-readout').textContent(),zoomBefore);
  assert.equal(await page.evaluate(()=>scrollY),yBefore);
  assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  assert.equal(await page.locator('#question-dialog[open]').count(),0);
  // Crossing a question during an ongoing zoom must still control the map.
  rect=await activeCards().first().boundingBox();await page.mouse.move(rect.x+20,rect.y+20);
  await page.keyboard.down('Control');await page.mouse.wheel(0,-45);await page.keyboard.up('Control');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>scrollY),yBefore);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  rect=await activeCards().first().boundingBox();
  await page.mouse.move(rect.x+25,rect.y+25);await page.mouse.down();await page.mouse.move(rect.x+70,rect.y+65,{steps:10});await page.mouse.up();
  await page.waitForTimeout(350);assert.equal(await page.locator('#question-dialog[open]').count(),0);
  assert.equal(await page.evaluate(()=>scrollY),yBefore);
  if(width<600){
   rect=await activeCards().first().boundingBox();
   const cdp=await context.newCDPSession(page),cx=rect.x+rect.width/2,cy=rect.y+Math.min(40,rect.height/2);
   const beforePinch=await page.locator('#zoom-readout').textContent();
   for(const [type,spread]of [['touchStart',20],['touchMove',30],['touchMove',45],['touchMove',65],['touchEnd',null]]){
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:spread===null?[]:[{x:cx-spread,y:cy,id:1},{x:cx+spread,y:cy,id:2}]});await page.waitForTimeout(40);
   }
   await page.waitForTimeout(400);assert.notEqual(await page.locator('#zoom-readout').textContent(),beforePinch);
   assert.equal(await page.evaluate(()=>scrollY),yBefore);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
   assert.equal(await page.locator('#question-dialog[open]').count(),0);
  }
  // Open the exact source question, not a map-specific copy.
  const detailCard=activeCards().first(),detailId=await detailCard.getAttribute('data-question-id');
  const clickBox=await detailCard.boundingBox(),cx=clickBox.x+clickBox.width/2,cy=clickBox.y+clickBox.height/2;
  if(width<600)await page.touchscreen.tap(cx,cy);else await page.mouse.click(cx,cy);
  await page.waitForSelector('#question-dialog[open]');
  const dialog=page.locator('#question-dialog'),question=byId.get(detailId);
  assert.equal(await dialog.locator('.card-stem').textContent(),question.stem);
  assert.deepEqual(await dialog.locator('.card-choices > li').allTextContents(),question.choices.map(c=>c.text));
  await dialog.locator('.card-explanation summary').click();
  if(question.explanation)assert.ok((await dialog.locator('.card-explanation').textContent()).includes(question.explanation));
  const href=await dialog.locator('.card-practice').getAttribute('href'),ids=new URL(href).searchParams.get('challenge').split(',');
  assert.equal(ids[0],detailId);assert.ok(ids.length<=5&&ids.every(id=>byId.has(id)));
  const scroll=dialog.locator('.question-detail');
  await scroll.evaluate(n=>{n.scrollTop=n.scrollHeight;});
  assert.ok(await scroll.evaluate(n=>n.scrollHeight<=n.clientHeight||n.scrollTop>0));
  await page.locator('#question-close').click();
  assert.equal(await page.evaluate(()=>scrollY),yBefore);
  await activeCards().first().focus();await page.keyboard.press('Enter');await page.waitForSelector('#question-dialog[open]');
  await page.keyboard.press('Escape');
  // Sweep a populated neighborhood, including narrow widths and deep zoom.
  await page.locator('#map-viewport').focus();
  for(const key of ['ArrowRight','ArrowRight','ArrowDown','ArrowLeft','ArrowUp','+','-']){
   await page.keyboard.press(key);await page.waitForTimeout(500);
   const visible=Number((await page.locator('#visible-summary').textContent()).match(/範囲 ([\d,]+)/)[1].replaceAll(',',''));
   if(visible>0)assert.ok(await activeCards().count(),`A visible question should have a card after ${key}`);
   const boxes=await activeCards().evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),v=n.closest('#map-viewport').getBoundingClientRect();return{x:r.x-v.x,y:r.y-v.y,w:r.width,h:r.height,vw:v.width,vh:v.height};}));
   assert.ok(boxes.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=b.vw+1&&b.y+b.h<=b.vh+1),'Cards should fit inside map');
  }
  await stage(page,-1);assert.equal(await page.locator('.map-label').count(),0);
  const overviewZoom=await zoomLevel(page),overviewGeometry=await exhibitGeometry(page);
  // The selected automatic layer stays on when entering manual.
  await page.locator('#layer-tag').click();await page.waitForTimeout(750);
  assert.equal(await page.locator('#layers-mode').textContent(),'手動');assert.deepEqual(await selectedLayers(page),['tag']);
  assert.equal(await zoomLevel(page),overviewZoom);assert.deepEqual(await exhibitGeometry(page),overviewGeometry);
  await page.locator('#layer-tag').click();await page.waitForTimeout(350);
  assert.deepEqual(await selectedLayers(page),[]);
  await page.locator('#layer-tag').click();await page.waitForTimeout(350);
  assert.deepEqual(await selectedLayers(page),['tag']);assert.ok(await page.locator('.map-label:not(.is-term):not(.is-leaving)').count());
  await page.locator('#layer-term').click();assert.deepEqual(await selectedLayers(page),['tag','term']);
  await page.locator('#layer-tag').click();await page.waitForTimeout(750);
  assert.deepEqual(await selectedLayers(page),['term']);
  const forcedTerms=page.locator('.map-label.is-term:not(.is-leaving)');assert.ok(await forcedTerms.count());
  const smallTerms=await forcedTerms.evaluateAll(nodes=>nodes.map(n=>parseFloat(getComputedStyle(n).fontSize)*new DOMMatrix(getComputedStyle(n).transform).a));
  assert.ok(smallTerms.every(size=>size>=11.99&&size<=22.01));
  await stage(page,2);assert.deepEqual(await selectedLayers(page),['term']);assert.equal(await page.locator('#layers-mode').textContent(),'手動');
  await stage(page,-1);assert.deepEqual(await selectedLayers(page),['term']);assert.ok(await forcedTerms.count());
  await page.locator('#layer-term').click();await page.locator('#layer-question').click();await page.waitForTimeout(750);
  assert.deepEqual(await selectedLayers(page),['question']);assert.ok(await activeCards().count(),'Manual question cards should appear at overview');
  const farFont=await activeCards().evaluateAll(nodes=>Math.max(...nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))));
  assert.ok(farFont>=12&&farFont<=14);
  await stage(page,2);assert.ok(await activeCards().evaluateAll(nodes=>Math.max(...nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))))>farFont);
  await page.locator('#layer-question').click();await page.waitForTimeout(750);assert.equal(await activeCards().count(),0);
  assert.deepEqual(await selectedLayers(page),[]);assert.equal(await page.locator('.map-label:not(.is-leaving)').count(),0);
  const manualZoom=await zoomLevel(page);
  await page.locator('#layers-mode').click();await page.waitForTimeout(750);assert.ok(await activeCards().count());
  assert.equal(await zoomLevel(page),manualZoom);assert.equal(await page.locator('#layers-mode').textContent(),'自動');
  assert.deepEqual(await selectedLayers(page),['question']);
  await page.locator('#layer-question').click();assert.equal(await page.locator('#layers-mode').textContent(),'手動');assert.deepEqual(await selectedLayers(page),['question']);
  await page.locator('#layers-mode').click();assert.deepEqual(await selectedLayers(page),['question']);
  // An inactive automatic layer becomes the sole manual selection.
  await page.locator('#layer-tag').click();assert.deepEqual(await selectedLayers(page),['tag']);
  await page.locator('#layers-mode').click();assert.deepEqual(await selectedLayers(page),['question']);
  await stage(page,-1);assert.deepEqual(await selectedLayers(page),['tag']);
  const localRecord=await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1'));
  const personal=await canvasColors(page);
  const rangeGeometry=await exhibitGeometry(page);
  await page.locator('#heat-distribution').click();await page.waitForTimeout(300);
  assert.deepEqual(await exhibitGeometry(page),rangeGeometry,'Range changes should preserve vertical layout');
  const personalRange=await page.locator('.heat-legend').textContent();
  assert.equal(await page.locator('#heat-distribution').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1')),localRecord);
  await page.locator('#score-global').click();await page.waitForFunction(()=>document.querySelector('#score-global').getAttribute('aria-pressed')==='true'&&/延べ/.test(document.querySelector('#history-summary').textContent));
  assert.equal(await page.locator('#heat-note').count(),0);
  const range=await page.locator('.heat-legend').textContent();assert.ok(!range.includes('0%100%'));
  assert.ok((await page.locator('#history-summary').textContent()).startsWith('全体成績'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1')),localRecord);
  assert.notDeepEqual(await canvasColors(page),personal);
  const globalDistribution=await canvasColors(page);
  await page.locator('#heat-absolute').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.heat-min').textContent(),'0%');assert.equal(await page.locator('.heat-max').textContent(),'100%');
  assert.equal(await page.locator('#heat-note').count(),0);
  assert.notDeepEqual(await canvasColors(page),globalDistribution);
  await page.locator('#score-personal').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#heat-distribution').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.heat-legend').textContent(),personalRange);
  await page.locator('#heat-absolute').click();await page.waitForTimeout(300);
  const restored=await canvasColors(page);assert.ok(restored.every((v,i)=>Math.abs(v-personal[i])<.02));
  await page.locator('#score-global').click();assert.equal(await page.locator('#heat-absolute').getAttribute('aria-pressed'),'true');
  await page.locator('#heat-distribution').click();await page.locator('#score-personal').click();await page.waitForTimeout(300);
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
  console.log(`PASS ${width}px: compact automatic/manual multi-select header, stable inline legend/range toggle, independent personal/global ranges, growing labels, card gestures/detail/placement, zoom, WCAG`);
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
