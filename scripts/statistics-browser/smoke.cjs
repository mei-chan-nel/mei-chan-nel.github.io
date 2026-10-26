const {chromium,QA_BASE,QA_COMPARE_BASE,QA_OUTPUT,BROWSER_PATH}=require('./support.cjs');
const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:BROWSER_PATH,headless:true,args:['--no-sandbox']});const out=[];
for(const id of ['graph-reading','missing-values','histogram','crosstab','correlation','time-series','sampling','hypothesis-test','projects']){
 const p=await b.newPage({viewport:{width:375,height:812}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(QA_BASE+'/')?r.continue():r.abort());
 await p.goto(`${QA_BASE}/lab/statistics/${id}/`);await p.waitForSelector('.data-readonly');
 const data=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,rows:document.querySelectorAll('[data-source-row]').length,n:document.querySelector('#data-row-count').textContent,marks:performance.getEntriesByType('mark').map(m=>[m.name,m.startTime])}));
 await p.locator('#upload-data').click();await p.waitForSelector('.data-import-dialog[open]');const download=p.waitForEvent('download');await p.locator('[data-template="xlsx"]').click();let file;try{file=await download;await file.saveAs(`${QA_OUTPUT}/${id}.xlsx`);await p.locator('#data-file').setInputFiles(`${QA_OUTPUT}/${id}.xlsx`);await p.locator('#data-import-apply').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#data-import-apply').disabled,{timeout:12000});await p.locator('#data-import-apply').click();}catch(e){errors.push('xlsx:'+await p.locator('#import-status').textContent());}
 if(await p.locator('.data-import-dialog[open]').count())await p.locator('#data-import-close').click();
 const count=await p.locator('#view-tabs button,#project-tabs button').count();for(let j=1;j<count;j++){await p.locator('#view-tabs button,#project-tabs button').nth(j).click();await p.waitForTimeout(75);const s=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,svg:document.querySelectorAll('#experiment svg,#project-root svg').length,error:document.querySelector('#experiment > .error')?.textContent}));out.push({id,view:j,...s});}
 await p.screenshot({path:`${QA_OUTPUT}/${id}-375.png`,fullPage:true});out.push({id,data,errors});console.log(JSON.stringify({id,data,errors}));await p.close();}
fs.writeFileSync(QA_OUTPUT+'/smoke.json',JSON.stringify(out,null,2));await b.close();})();
