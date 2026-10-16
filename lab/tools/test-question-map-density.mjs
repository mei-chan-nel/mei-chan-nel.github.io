import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.LAB_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.LAB_BASE_URL||'http://127.0.0.1:8773';
const points=JSON.parse(await readFile(new URL('../../../info1-quiz-app/data/questions/map_points.json',import.meta.url))).points;
const coordinates=Object.values(points),fullSpan=Math.max(...coordinates.map(p=>p[0]))-Math.min(...coordinates.map(p=>p[0]));
const browser=await chromium.launch({executablePath:process.env.LAB_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
async function home(page){await page.locator('#map-home').click();await page.waitForFunction(()=>document.querySelector('#zoom-readout').textContent.startsWith('×1.0'));await page.waitForTimeout(1300);}
async function snapshot(page,kind){return page.evaluate(kind=>{
 const viewport=document.querySelector('#map-viewport').getBoundingClientRect();
 const nodes=[...document.querySelectorAll(kind==='question'?'.map-card:not(.is-leaving)':`.map-label${kind==='term'?'.is-term':':not(.is-term)'}:not(.is-leaving)`)];
 return {width:viewport.width,height:viewport.height,items:nodes.map(n=>{
  const r=n.getBoundingClientRect(),css=getComputedStyle(n);
  return {id:kind==='question'?n.dataset.questionId:n.dataset.anchorId,x:r.x-viewport.x,y:r.y-viewport.y,w:r.width,h:r.height,
   font:parseFloat(css.fontSize),focus:Number(n.dataset.focus),alpha:Number(css.backgroundColor.match(/[\d.]+/g)?.[3]||0)};
 })};
},kind);}
function coverage(s){
 const positions=s.items.map(item=>points[item.id]);
 return {span:Math.max(...positions.map(p=>p[0]))-Math.min(...positions.map(p=>p[0])),
  cells:new Set(s.items.map(p=>`${Math.floor((p.x+p.w/2)/s.width*6)},${Math.floor((p.y+p.h/2)/s.height*4)}`)).size};
}
function readable(s){
 for(const a of s.items){
  assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=s.width+1&&a.y+a.h<=s.height+1);
  assert.ok(a.font>=11&&a.alpha>.7&&a.alpha<1);
 }
 for(let i=0;i<s.items.length;i++)for(const b of s.items.slice(i+1)){
  const a=s.items[i],area=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  assert.ok(area/Math.min(a.w*a.h,b.w*b.h)<.22,'Stable cards should overlap only at their edges');
 }
}
try{
 for(const width of [1280,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600});
  await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.fulfill({body:'',contentType:'application/javascript'}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/lab/question-map/');await page.waitForSelector('#map-status[hidden]',{state:'attached'});await page.waitForTimeout(400);
  const record=await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1'));
  for(const kind of ['tag','term']){
   await page.locator('#layer-'+kind).click();await page.waitForTimeout(900);
   const before=coverage(await snapshot(page,kind));assert.ok(before.cells>=4);
   await page.locator('#map-viewport').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
   const box=await page.locator('#map-viewport').boundingBox();await page.mouse.move(box.x+box.width*.78,box.y+box.height*.42);
   for(let i=0;i<5;i++){await page.mouse.wheel(0,-150);await page.waitForTimeout(170);}
   await page.waitForTimeout(250);await home(page);
   const after=coverage(await snapshot(page,kind));
   assert.ok(after.cells>=before.cells*.75&&after.span>=before.span*.8,`${kind} should return to the whole map after zoom-out: ${JSON.stringify({before,after})}`);
   assert.equal(await page.locator('#layers-mode').textContent(),'手動');await page.locator('#layer-'+kind).click();
  }
  await page.locator('#layer-question').click();await page.waitForTimeout(1100);
  const overview=await snapshot(page,'question');readable(overview);
  assert.ok(overview.items.length>=(width<600?5:16),`More cards should fit: ${overview.items.length}`);
  assert.ok(coverage(overview).span>=fullSpan*(width<600?.55:.7),'Overview cards should include far-apart regions');
  for(let i=0;i<5;i++){await page.locator('#zoom-in').click();await page.waitForTimeout(250);}
  await page.waitForTimeout(1400);
  const near=await snapshot(page,'question');readable(near);
  await page.waitForTimeout(750);
  const settled=await snapshot(page,'question'),ids=new Set(near.items.map(c=>c.id));
  assert.ok(settled.items.filter(c=>ids.has(c.id)).length>=Math.min(settled.items.length,near.items.length)*.8,'Idle cards should keep their places without cycling');
  const central=near.items.filter(c=>c.focus>.8),peripheral=near.items.filter(c=>c.focus<.4);
  assert.ok(central.length&&peripheral.length);
  assert.ok(Math.max(...central.map(c=>c.font))>Math.min(...peripheral.map(c=>c.font))+1);
  assert.ok(Math.max(...central.map(c=>c.w))>Math.min(...peripheral.map(c=>c.w))*1.3);
  await home(page);const restored=await snapshot(page,'question');readable(restored);
  assert.ok(coverage(restored).span>=coverage(overview).span*.8,'Question regions should also recover after zoom-out');
  assert.equal(await page.evaluate(()=>localStorage.getItem('info1LearningRecord:v1')),record);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  console.log(`PASS ${width}px: manual tag/word/question region recovery, ${overview.items.length} overview/${near.items.length} near cards, central/peripheral typography, translucent background, bounded overlap`);
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
