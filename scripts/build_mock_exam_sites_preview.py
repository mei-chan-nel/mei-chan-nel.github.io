"""Prepare the existing Sites checkout; never changes its hosting identity."""
from pathlib import Path
from lxml import html
import json,shutil
root=Path(__file__).resolve().parents[1]
target=root.parent/'sites/study-atlas-mock-exams-preview'
manifest=json.loads((target/'.openai/hosting.json').read_text())
assert manifest['project_id']=='appgprj_6ae110a637e08191bc9ddecdd9bb6571'
origin='https://study-atlas-mock-exams-preview.hal2718.chatgpt.site'
dist=target/'dist'
for name in ['site.css','site-header.js','home-learning.js','favicon.svg']:
 (dist/'assets').mkdir(exist_ok=True);shutil.copyfile(root/'assets'/name,dist/'assets'/name)
# Replace only the dedicated mock-exams subtree. The source checkout stays separate.
if (dist/'mock-exams').exists():shutil.rmtree(dist/'mock-exams')
shutil.copytree(root/'mock-exams',dist/'mock-exams',ignore=shutil.ignore_patterns('tests','source','__pycache__','connection-check.html','connection-check.mjs'))
for file,is_home in [(root/'index.html',True),(root/'mock-exams/index.html',False)]:
 d=html.fromstring(file.read_bytes())
 for a in d.xpath('//a[@href]'):
  href=a.get('href')
  if is_home:
   if href.startswith('./') and href not in ['./','./mock-exams/'] and not href.startswith('./assets/'):
    a.set('href','https://mei-chan-nel.com/'+href[2:])
  elif href.startswith('../'):
   a.set('href','/' if href=='../' else 'https://mei-chan-nel.com/'+href[3:])
 for e in d.xpath('//link[@rel="canonical"]|//meta[@property="og:url"]'):
  e.set('href' if e.tag=='link' else 'content',origin+('/' if is_home else '/mock-exams/'))
 from lxml import etree
 etree.SubElement(d.find('head'),'meta',name='robots',content='noindex,nofollow')
 if not is_home:
  note=html.fromstring('<p style="margin:0;padding:8px 24px;text-align:center;background:#edf3ff;color:#264578;font-size:13px">確認用プレビュー · 採点すると本番の匿名統計に記録されます。</p>')
  d.find('body').insert(1,note)
 path=dist/('index.html' if is_home else 'mock-exams/index.html')
 path.write_text('<!doctype html>\n'+html.tostring(d,encoding='unicode'),encoding='utf8')
print('Sites preview prepared: Study Atlas top → mock-exams; production statistics No.001')
