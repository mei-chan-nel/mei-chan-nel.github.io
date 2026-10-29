const {chromium,QA_BASE,QA_COMPARE_BASE,QA_OUTPUT,BROWSER_PATH}=require('./support.cjs');const fs=require('fs'),assert=require('assert/strict');
const BASE=QA_BASE;const dir=QA_OUTPUT;
(async()=>{const b=await chromium.launch({executablePath:BROWSER_PATH,headless:true,args:['--no-sandbox']});const result=[];
for(const id of ['graph-reading','missing-values','histogram','crosstab','correlation','time-series','sampling','hypothesis-test','projects']){
 const p=await b.newPage({viewport:{width:375,height:812}}),requests=[],logs=[],errors=[];
 p.on('request',r=>requests.push({url:r.url(),body:r.postData()}));p.on('console',m=>logs.push(m.text()));p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith(BASE+'/')?r.continue():r.abort());await p.goto(`${BASE}/lab/statistics/${id}/`);await p.waitForSelector('.data-readonly');
 const n=Number((await p.locator('#data-row-count').textContent()).replaceAll(',',''));
 let download=p.waitForEvent('download');await p.locator('#download-csv').click();let file=await download;const full=`${dir}/${id}-full.csv`;await file.saveAs(full);const source=fs.readFileSync(full,'utf8');assert.ok(source.startsWith('\ufeff'));assert.equal(source.trim().split(/\r?\n/).length-6,n);
 await p.locator('#upload-data').click();download=p.waitForEvent('download');await p.locator('[data-template="csv"]').click();file=await download;const path=`${dir}/${id}-template.csv`;await file.saveAs(path);
 let csv=fs.readFileSync(path,'utf8').replace('ここに表題を入力',`端末限定_${id}_秘密_canary`);fs.writeFileSync(path,csv);
 await p.locator('#data-file').setInputFiles(path);await p.waitForFunction(()=>!document.querySelector('#data-import-apply').disabled);await p.locator('#data-import-apply').click();assert.match(await p.locator('.data-view h2').textContent(),/秘密_canary/);
 const userCount=await p.locator('#data-row-count').textContent();await p.locator('#view-tabs button,#project-tabs button').nth(1).click();
 assert.equal(await p.locator('#experiment > .error').count(),0);if(id!=='projects')assert.match(await p.locator('.analysis-data-title').first().textContent(),/秘密_canary/);
 await p.locator('#view-tabs button,#project-tabs button').first().click();download=p.waitForEvent('download');await p.locator('#download-csv').click();file=await download;const userPath=`${dir}/${id}-user.csv`;await file.saveAs(userPath);assert.match(fs.readFileSync(userPath,'utf8'),/秘密_canary/);
 // A malformed upload reports all errors and never replaces the active data.
 await p.locator('#upload-data').click();await p.locator('#data-file').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('誤った列\n不明\n欠損')});await p.waitForSelector('.import-errors');assert.equal(await p.locator('#data-import-apply').isDisabled(),true);assert.match(await p.locator('.import-errors').textContent(),/必要な/);await p.keyboard.press('Escape');assert.match(await p.locator('.data-view h2').textContent(),/秘密_canary/);assert.equal(await p.locator('#data-row-count').textContent(),userCount);
 await p.locator('[data-stat-fullscreen]').click();await p.locator('#upload-data').click();await p.waitForSelector('.data-import-dialog[open]');assert.equal(await p.locator('.data-import-dialog').evaluate(e=>e.getBoundingClientRect().right<=innerWidth),true);await p.keyboard.press('Escape');assert.equal(await p.locator('#statistics-fullscreen').evaluate(e=>e.open),true);await p.locator('[data-stat-fullscreen]').click();
 await p.locator('#use-sample').click();assert.equal(Number((await p.locator('#data-row-count').textContent()).replaceAll(',','')),n);assert.equal(await p.locator('#use-sample').count(),0);
 assert.equal(errors.length,0,errors.join(';'));assert.ok(requests.every(r=>!JSON.stringify(r).includes('秘密_canary')));assert.ok(requests.every(r=>!r.body));assert.ok(logs.every(r=>!r.includes('秘密_canary')));
 result.push({id,standardRows:n,customRows:userCount,requests:requests.length,pass:true});console.log(id,'PASS');await p.close();
}
fs.writeFileSync(`${dir}/files.json`,JSON.stringify(result,null,2));await b.close();})();
