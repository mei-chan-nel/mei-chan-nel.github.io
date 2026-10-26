// Confirms that the authored first steps are usable in the real local labs.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAB_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.LAB_TEST_ORIGIN || 'http://127.0.0.1:8773';
const output = resolve(process.env.LAB_HELP_REPORT_DIR || 'work/lab-help-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.LAB_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox','--mute-audio'] });
const records=[];
const selected = process.env.LAB_HELP_CASES?.split(',');
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const actions={
 'cpu-memory': async p=>{await p.locator('#step').click();await p.waitForFunction(()=>document.querySelector('#state').textContent!=='実行前');},
 'thinking-tools': async p=>{await p.locator('[data-preset-control="block:context"] button').click();assert.ok((await p.locator('#stage').innerText()).includes('学校'));},
 'crypto-communication': async p=>{const before=await p.locator('main').innerText();await p.locator('#dialogue-next').click();assert.notEqual(await p.locator('main').innerText(),before);},
 'os-work': async p=>{await p.locator('[data-action="lifecycle"][data-app="web"]').click();await p.locator('#web-load').click();assert.ok(await p.locator('#web-load').isDisabled());},
 'color-vision': async p=>{await p.locator('[data-step="1"]').click();assert.equal(await p.locator('[data-step="1"]').getAttribute('aria-current'),'step');await p.locator('[data-step="2"]').click();},
 'question-map': async p=>{await p.locator('#map-status').waitFor({state:'hidden'});await p.locator('#zoom-in').click();},
 'relational-database': async p=>{await p.locator('[data-step="2"]').click();assert.equal(await p.locator('[data-step="2"]').getAttribute('aria-pressed'),'true');},
 'radix-conversion': async p=>{await p.locator('#conversion-form button[type=submit]').click();assert.ok((await p.locator('main').innerText()).includes('101101'));},
 'packet-routing': async p=>{await p.locator('#send').click();await p.waitForFunction(()=>document.querySelector('#messages').textContent.trim().length>0);},
 'image-compression': async p=>{await p.waitForFunction(()=>document.querySelector('#compare-b').options.length===6);await p.locator('#compare-b').selectOption('jpeg');await p.locator('#jpeg-quality').focus();await p.locator('#jpeg-quality').press('ArrowRight');},
 'digital-image': async p=>{const range=p.locator('#resolution');await range.focus();await range.press('ArrowLeft');assert.notEqual(await range.inputValue(),'407');await p.locator('#bits-r-down').click();},
 'digital-audio': async p=>{await p.locator('#play-original').click();await p.locator('#bits-down').click();await p.locator('#play-processed').click();await p.locator('#stop-audio').click();},
 'logic-circuit': async p=>{const node=p.locator('[data-type="input"] .node-body').first();const before=await node.getAttribute('aria-description');await node.click();assert.notEqual(await node.getAttribute('aria-description'),before);},
 'flowchart': async p=>{await p.locator('#prepare-run').click();await p.locator('#next-button').click();assert.ok(await p.locator('#edit-button').isVisible());},
 'statistics': async p=>{await p.getByRole('link',{name:/グラフの選び方と読み取り/}).first().click();await p.waitForURL('**/statistics/graph-reading/');},
 'statistics/graph-reading': async p=>{await p.locator('#view-0').click();await p.locator('[data-chart-kind="line"]').click();await p.locator('[data-chart-kind="histogram"]').click();assert.equal(await p.locator('[data-chart-kind="histogram"]').getAttribute('aria-pressed'),'true');},
 'statistics/missing-values': async p=>{await p.locator('#view-0').click();await button(p,'0で補完').click();await button(p,'平均値で補完').click();assert.equal(await button(p,'平均値で補完').getAttribute('aria-pressed'),'true');},
 'statistics/histogram': async p=>{await button(p,'分布と箱ひげ図').click();await p.locator('#bin-width').fill('4');await p.locator('#bin-width').press('Tab');assert.equal(await p.locator('#bin-width').inputValue(),'4');},
 'statistics/crosstab': async p=>{await button(p,'クロス集計表').click();await p.getByLabel('行比率',{exact:true}).check();assert.ok(await p.getByLabel('行比率',{exact:true}).isChecked());},
 'statistics/correlation': async p=>{await button(p,'散布図・直線').click();const point=p.locator('[data-corr-drag="observation"]').first();const before=await point.getAttribute('aria-label');await point.focus();await point.press('ArrowRight');assert.notEqual(await point.getAttribute('aria-label'),before);},
 'statistics/time-series': async p=>{await button(p,'移動平均').click();await p.getByLabel('平均する月数',{exact:true}).fill('6');await p.getByLabel('平均する月数',{exact:true}).press('Tab');},
 'statistics/sampling': async p=>{await button(p,'今回の抽出').click();await button(p,'1回抽出').click();await button(p,'1回抽出').click();assert.ok((await p.locator('#experiment').innerText()).includes('標本平均'));},
 'statistics/hypothesis-test': async p=>{await button(p,'仮説検定を行う').click();await p.locator('[data-hyp-bin]:not([data-hyp-bin-count="0"])').first().click();await p.locator('#hyp-next').click();assert.ok((await p.locator('#hyp-step-title').innerText()).includes('帰無仮説'));},
 'statistics/projects': async p=>{await button(p,'分析方法を選ぶ').click();assert.ok((await p.locator('#project-root').innerText()).includes('分布'));},
};
try {
 for(const [id,action] of Object.entries(actions)){
  if(selected && !selected.includes(id)) continue;
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();
  await c.route(/^https?:\/\//,r=>r.request().url().startsWith(origin+'/')?r.continue():r.fulfill({status:200,contentType:r.request().resourceType()==='script'?'application/javascript':'text/html',body:''}));
  await p.goto(origin+'/lab/'+id+'/',{waitUntil:'networkidle'});
  p.setDefaultTimeout(8000);
  let error;
  try{await action(p);}catch(e){error=e.message;}
  records.push({id,firstSteps:!error,error});console.log(error?'FAIL':'PASS',id,error||'');
  await c.close();
 }
 // Accessibility checks cover the common control and its failure/recovery UI.
 const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();
 await c.route(/^https?:\/\//,r=>r.request().url().startsWith(origin+'/')?r.continue():r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await p.addInitScript(()=>{window.open=()=>null;});
 await p.goto(origin+'/lab/cpu-memory/',{waitUntil:'networkidle'});
 await p.addScriptTag({path:process.env.LAB_AXE_MODULE||require.resolve('axe-core/axe.min.js')});
 const scan=()=>p.evaluate(()=>axe.run({include:[['.lab-help'],['.lab-help-feedback']]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
 let result=await scan();assert.deepEqual(result.violations.map(v=>v.id),[]);
 await button(p,'ChatGPTに聞く').click();await p.locator('.lab-help__recovery[open]').waitFor();
 result=await scan();assert.deepEqual(result.violations.map(v=>v.id),[]);
 records.push({scenario:'axe WCAG A/AA common button and recovery',pass:true});
 // Navigation is document-based: changing the child must load its own guide.
 await p.goto(origin+'/lab/statistics/histogram/',{waitUntil:'networkidle'});
 await p.locator('#lab-picker').waitFor({state:'visible'});await p.locator('#data-tab').waitFor({state:'visible'});await Promise.all([p.waitForURL('**/statistics/sampling/',{waitUntil:'domcontentloaded'}),p.locator('#lab-picker').selectOption('sampling')]);
 await button(p,'ChatGPTに聞く').click();await p.locator('.lab-help__recovery[open]').waitFor();
 const prompt=await p.locator('#lab-help-prompt').inputValue();assert.ok(prompt.includes('標本調査と推定'));assert.ok(!prompt.includes('階級幅2℃'));
 records.push({scenario:'statistics child switching',pass:true});
 // Keep full text available when the application's URL budget is exceeded.
 const common=JSON.parse(await readFile(new URL('../help/data/common.json',import.meta.url),'utf8'));
 await c.route('**/help/data/common.json',r=>r.fulfill({json:{...common,instructions:common.instructions+'追記。'.repeat(1000)}}));
 await p.goto(origin+'/lab/cpu-memory/',{waitUntil:'networkidle'});
 await button(p,'ChatGPTに聞く').click();await p.locator('.lab-help__recovery[open]').waitFor();
 assert.ok((await p.locator('#lab-help-prompt').inputValue()).endsWith('追記。'.repeat(1000)));
 records.push({scenario:'oversized prompt stays complete in recovery',pass:true});
 await c.close();
 // The synchronous blank tab also works before the guide finishes preloading.
 const delayed=await browser.newContext({viewport:{width:390,height:844}}),page=await delayed.newPage();
 let outgoing;
 await delayed.route(/^https?:\/\//,async r=>{
  if(r.request().url().startsWith(origin+'/'))return r.continue();
  if(r.request().url().startsWith('https://chatgpt.com/'))outgoing={url:r.request().url(),headers:await r.request().allHeaders()};
  return r.fulfill({status:200,contentType:r.request().resourceType()==='script'?'application/javascript':'text/html',body:''});
 });
 await delayed.route('**/help/data/cpu-memory.json',async r=>{
  await new Promise(resolve=>setTimeout(resolve,350));return r.continue();
 });
 await page.goto(origin+'/lab/cpu-memory/?private=NEVER_SEND#NEVER_SEND',{waitUntil:'domcontentloaded'});
 const popupPromise=page.waitForEvent('popup');await button(page,'ChatGPTに聞く').click();
 const popup=await popupPromise;await popup.waitForURL('https://chatgpt.com/**');
 assert.ok(new URL(popup.url()).searchParams.get('q').includes('基本の加算'));
 assert.ok(!JSON.stringify(outgoing).includes('NEVER_SEND'));
 assert.ok(!outgoing.headers.referer);
 assert.equal(await popup.evaluate(()=>window.opener),null);
 records.push({scenario:'delayed guide with real popup; no source URL referrer',pass:true});
 await popup.close();
 await delayed.route('**/help/data/common.json',r=>r.fulfill({json:{...common,instructions:common.instructions+'追記。'.repeat(1000)}}));
 await page.reload({waitUntil:'networkidle'});
 const longPopupPromise=page.waitForEvent('popup');await button(page,'ChatGPTに聞く').click();
 const longPopup=await longPopupPromise;await longPopup.waitForURL('https://chatgpt.com/');
 assert.ok((await page.locator('.lab-help__status').innerText()).includes('長いため'));
 await page.locator('.lab-help__recovery[open]').waitFor();
 assert.ok((await page.locator('#lab-help-prompt').inputValue()).endsWith('追記。'.repeat(1000)));
 records.push({scenario:'oversized prompt opens plain ChatGPT and exposes full copy',pass:true});
 await delayed.close();
 assert.equal(records.filter(r=>r.error).length,0,'First-step failures');
}finally{await writeFile(resolve(output,'activities.json'),JSON.stringify(records,null,2)+'\n');await browser.close();}
