const {chromium,QA_BASE,QA_COMPARE_BASE,QA_OUTPUT,BROWSER_PATH}=require('./support.cjs');
const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:BROWSER_PATH,headless:true,args:['--no-sandbox']});const out=[];
for(const width of [320,375,414,1366])for(const id of ['graph-reading','missing-values','histogram','crosstab','correlation','time-series','sampling','hypothesis-test','projects']){
 const p=await b.newPage({viewport:{width,height:width>600?900:812}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(QA_BASE+'/')?r.continue():r.abort());
 await p.goto(`${QA_BASE}/lab/statistics/${id}/`);await p.waitForSelector('.data-readonly');
 const scan=()=>p.evaluate(()=>{
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],.workbench-stash')&&!e.closest('details:not([open])');
  const svg=[...document.querySelectorAll('#experiment svg,#project-root svg')].filter(visible);
  return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,plot:svg.map(s=>{const rect=s.getBoundingClientRect();return {w:Math.round(rect.width),h:Math.round(rect.height),view:s.getAttribute('viewBox'),outside:[...s.querySelectorAll('text')].filter(visible).flatMap(t=>{const r=t.getBoundingClientRect();return r.left<rect.left-4||r.right>rect.right+4?[t.textContent]:[]}).slice(0,6),minFont:Math.min(...[...s.querySelectorAll('text')].filter(visible).map(t=>parseFloat(getComputedStyle(t).fontSize)*Math.hypot(t.getScreenCTM()?.a||1,t.getScreenCTM()?.b||0)))};}),overflow:[...document.querySelectorAll('#experiment *,#project-root *')].filter(e=>visible(e)&&!e.closest('.table-scroll,.data-table,.screen-navigation-content,svg')).filter(e=>{const r=e.getBoundingClientRect();return r.width>innerWidth+2}).slice(0,5).map(e=>e.className||e.tagName),error:document.querySelector('#experiment > .error')?.textContent};
 });
 await p.locator('#upload-data').click();await p.waitForSelector('.data-import-dialog[open]');const popup=await p.locator('.data-import-dialog').evaluate(e=>({width:e.getBoundingClientRect().width,scroll:e.scrollWidth,client:e.clientWidth}));await p.keyboard.press('Escape');
 const tabs=p.locator('#view-tabs button,#project-tabs button'),count=await tabs.count();for(let j=0;j<count;j++){
  await tabs.nth(j).click();await p.waitForTimeout(60);out.push({id,width,view:j,mode:'normal',...await scan()});
  await p.locator('[data-stat-fullscreen]').click();await p.waitForTimeout(130);out.push({id,width,view:j,mode:'full',...await scan()});
  if(width===320&&j===1||width===1366&&id==='graph-reading'&&j===2)await p.screenshot({path:`${QA_OUTPUT}/${id}-${width}-full.png`});
  await p.locator('[data-stat-fullscreen]').click();await p.waitForTimeout(50);
 }
 if(errors.length)out.push({id,width,errors});out.push({id,width,popup});console.log(id,width);await p.close();
}
fs.writeFileSync(QA_OUTPUT+'/layout.json',JSON.stringify(out,null,2));await b.close();})();
