const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const QA_OUTPUT=path.resolve(process.env.STATISTICS_QA_OUTPUT||path.join(os.tmpdir(),'study-atlas-statistics-qa'));
fs.mkdirSync(QA_OUTPUT,{recursive:true});
module.exports={chromium,QA_OUTPUT,QA_BASE:process.env.STATISTICS_QA_BASE||'http://127.0.0.1:8765',QA_COMPARE_BASE:process.env.STATISTICS_QA_COMPARE_BASE||'http://127.0.0.1:8766',BROWSER_PATH:process.env.BROWSER_PATH||'/usr/bin/chromium'};
