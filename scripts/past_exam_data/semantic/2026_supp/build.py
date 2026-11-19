"""Semantic re-authoring of 2026 supplementary Information I; writes only this folder."""
from pathlib import Path
from html import escape as E
from lxml import html, etree
import fitz, json, re, sys, collections
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
import import_past_exams as imp
DOC=fitz.open(ROOT/'mock-exams/exams/2026Tuishi/1/source/problem.pdf')
DEFINITION=json.loads((ROOT/'scripts/past_exam_data/2026_supp.json').read_text())
FIELDS={}
for f in DEFINITION['fields']:FIELDS.setdefault(f['sectionId'],{})[f['label']]={**f,'id':f['sectionId']+'-'+f['label']}
LINES={i+1:imp.page_data(DOC,p) for i,p in enumerate(DOC)}
BOXES={p:imp.find_boxes(DOC[p-1],LINES[p],FIELDS[imp.SID[next(i for i in range(4,-1,-1) if imp.STARTS['2026_supp'][i]<p)]]) for p in LINES}
CLAIMS={p:{} for p in LINES}
SID='q1'; PAGES={}
def claim(page,a,b,reason='native'):
 for i,l in enumerate(LINES[page]):
  if a<=l['bbox'].y0<b:CLAIMS[page][i]=reason

def B(label,sid=None):
 sid=sid or SID
 return f'<span class="blank" data-field="{sid}-{label}" data-original="{label}">{label}</span>'
def source(page,a,b):
 claim(page,a,b)
 ls=[l for l in LINES[page] if a<=l['bbox'].y0<b];groups=[]
 for l in ls:
  if groups and abs(l['bbox'].y0-groups[-1][0]['bbox'].y0)<3:groups[-1].append(l)
  else:groups.append([l])
 out=[]
 for group in groups:
  chars=sorted([c for l in group for c in l['chars']],key=lambda c:c['bbox'][0]);used=set();r=[]
  for c in chars:
   box=next((i for i,b in enumerate(BOXES[page]) if b['label']==c['c'] and b['rect'].contains((fitz.Rect(c['bbox']).tl+fitz.Rect(c['bbox']).br)/2)),None)
   if box is not None:
    if box not in used:r.append(B(c['c']));used.add(box)
   elif not c.get('fallback'):r.append(E(c['c']))
  out.append(''.join(r).strip())
 return ''.join(out)
def p(page,a,b,**kwargs):
 s=source(page,a,b)
 for x,y in kwargs.get('replace',{}).items():s=s.replace(x,y)
 return '<p>'+s+'</p>'
def q(page,a,b,n):return f'<h3 class="question-heading">問{n}</h3><p>'+re.sub(r'^問[０-９0-9]+','',source(page,a,b))+'</p>'
def sub(page,a,b,label):return f'<h4 class="subquestion-heading">{label}</h4><p>'+re.sub(r'^[ａ-ｄa-d]','',source(page,a,b))+'</p>'
def page(n,*parts):PAGES[n]='<section class="page" data-source-page="'+str(n)+'">\n'+'\n'.join(parts)+'\n</section>'
def para(s):return '<p>'+s+'</p>'
def cap(s):return '<p class="figure-caption">'+s+'</p>'
def table(caption,headers,rows,classes='data-table'):
 h='<div class="table-wrap"><table class="'+classes+'"><caption>'+caption+'</caption><thead><tr>'+''.join('<th scope="col">'+v+'</th>' for v in headers)+'</tr></thead><tbody>'
 for row in rows:h+='<tr>'+''.join(('<th scope="row">'+v+'</th>') if i==0 else '<td>'+v+'</td>' for i,v in enumerate(row))+'</tr>'
 return h+'</tbody></table></div>'
def matrix(caption,rows):return table(caption,rows[0],rows[1:])
def choices(labels,origpage,a,b,code=False):
 claim(origpage,a,b,'native choices')
 labels=labels.split();ids=' '.join(SID+'-'+x for x in labels);f=FIELDS[SID][labels[0]]
 assert all(FIELDS[SID][x]['choices']==f['choices'] for x in labels)
 out='<fieldset class="choices"><legend>'+'・'.join(labels)+' の解答群</legend><div class="choice-grid">'
 for c in f['choices']:
  n=imp.CIRCLES[int(c['value'],16)];text=c['text']
  if SID=='q2a' and labels==['イ'] and c['value'] in '012':text=['あ','い','う'][int(c['value'])]
  t=E(text);t='<code>'+t+'</code>' if code else t
  out+=f'<div class="option" data-choice-fields="{ids}" data-choice-value="{c["value"]}"><span class="option-number">{n}</span><span class="option-text">{t}</span></div>'
 return out+'</div></fieldset>'
def choice_table(labels,head,rows,origpage,a,b):
 claim(origpage,a,b,'native choice table');ids=' '.join(SID+'-'+x for x in labels.split())
 out='<fieldset class="choices"><legend>'+'・'.join(labels.split())+' の解答群</legend><div class="table-wrap"><table class="choice-table"><thead><tr><th scope="col">選択肢</th>'+''.join('<th scope="col">'+h+'</th>' for h in head)+'</tr></thead><tbody>'
 for i,row in enumerate(rows):
  out+=f'<tr class="option" data-choice-fields="{ids}" data-choice-value="{i:X}"><th scope="row"><span class="option-number">{imp.CIRCLES[i]}</span></th>'+''.join('<td>'+v+'</td>' for v in row)+'</tr>'
 return out+'</tbody></table></div></fieldset>'
def fig(page,bbox,caption):
 x0,y0,x1,y1=bbox
 for i,l in enumerate(LINES[page]):
  if fitz.Rect(bbox).contains((l['bbox'].tl+l['bbox'].br)/2):CLAIMS[page][i]='original diagram'
 return '<figure class="past-diagram" data-pdf-page="'+str(page)+'" data-pdf-clip="'+' '.join(str(x) for x in bbox)+'"><figcaption>'+caption+'</figcaption></figure>'
def program(caption,rows):
 out='<div class="program"><div class="code">'
 for i,(depth,src) in enumerate(rows,1):out+=f'<div class="code-row" data-depth="{depth}"><span class="ln">({i:02})</span><span class="src">{src}</span></div>'
 return out+'</div></div>'+cap(caption)
def prose_list(items):return '<ul>'+''.join('<li>'+x+'</li>' for x in items)+'</ul>'
def equation(t):return '<p class="equation">'+t+'</p>'
TF=[['正','正','正'],['正','正','誤'],['正','誤','正'],['誤','正','正'],['正','誤','誤'],['誤','正','誤'],['誤','誤','正'],['誤','誤','誤']]
# 第1問
page(1,'<p class="exam-subject">情報Ⅰ（全問必答）</p>', '<h2>第1問（配点20）</h2>',para('次の問い（問1～4）に答えよ。'),q(1,200,220,1),sub(1,240,320,'a'),choices('ア',1,340,360))
claim(1,80,180,'native subject and section title')
page(2,sub(2,80,120,'b'),choices('イ',2,140,300))
page(3,q(3,80,120,2),p(3,140,230),p(3,240,260),equation(source(3,280,300)),p(3,320,360),equation(source(3,380,400)),p(3,420,460),equation(source(3,480,500)))
page(4,p(4,80,120),equation(source(4,140,160)),p(4,180,220),equation(source(4,240,260)),p(4,280,320),equation(source(4,340,360)),choices('ウ',4,380,450),choices('エ',4,470,550))
rules='<div class="source-frame">'+prose_list([source(5,216,230).removeprefix('●'),source(5,235,268).removeprefix('●'),source(5,273,286).removeprefix('●'),source(5,292,308).removeprefix('●')])+'</div>'+cap(source(5,320,335))
meeting='<div class="source-document source-frame">'+''.join(para(source(5,a,b)) for a,b in [(365,378),(384,398),(403,417),(422,436),(441,455),(460,474),(479,493),(498,512),(517,531),(536,550),(555,569),(574,588),(593,607),(612,623)])+'</div>'+cap(source(5,640,655))
claim(5,623,635,'decorative wavy excerpt boundary')
page(5,q(5,80,100,3),p(5,116,190),rules,meeting)
page(6,sub(6,80,120,'a'),choices('オ カ',6,140,160),sub(6,180,260,'b'),choices('キ ク',6,280,440),sub(6,460,500,'c'),choices('ケ',6,520,630))
claim(7,232,342,'native table 1');claim(7,360,472,'native table 2')
page(7,q(7,80,100,4),p(7,118,210),table('表1　10年前のアンケート結果の表（一部）',['住所','年齢','良かった企画'],[['X市A町','17','ライブ：バンド'],['X市B町','33','研究発表：地域の歴史'],['Y市C町','15','たこ焼き［模擬店］']]),table('表2　今回のアンケート結果の表（一部）',['住所','年齢層（歳代）','良かった企画'],[['X市','30','ライブ（ダンス）'],['X市','10','模擬店（たこやき）'],['Y市','40','研究発表（郷土料理）']]),sub(7,488,560,'a'),choices('コ',7,583,655))
claim(8,393,570,'native table 3')
page(8,sub(8,80,150,'b'),choices('サ',8,167,240),sub(8,253,375,'c'),table('表3　全企画の一覧表',['識別番号','企画の形態','企画の内容'],[['1001','研究発表','地域の歴史'],['1002','研究発表','郷土料理'],['2001','ライブ','バンド'],['2002','ライブ','ダンス'],['3001','模擬店','クレープ'],['3002','模擬店','たこやき']]),choices('シ',8,587,655))
# 第2問A
SID='q2a'
items=[source(9,320,375),source(9,380,415),source(9,420,480)]
items=[x.removeprefix('●') for x in items]
# Preserve the precise underlined parts referred to by (a)–(c).
for i,target in enumerate(['(a)投稿をすぐに削除すれば投稿内容が拡散することはない','(b)自宅近くで撮影した写真を投稿する場合，建物や風景から自宅の場所を特定されることがある','(c)写真データには撮影した場所の位置情報が含まれることがある。']):
 compact=re.sub(r'\s+','',items[i]);ct=re.sub(r'\s+','',target)
 assert ct in compact,(i,compact)
 items[i]=compact.replace(ct,'<u>'+ct+'</u>')
page(9,'<h2>第2問（配点30）</h2>',para('次の問い（A・B）に答えよ。'),'<h3>A</h3>',para('次の文を読み，後の問い（問1～6）に答えよ。'),p(9,160,180),q(9,200,300,1),prose_list(items),choice_table('ア',['(a)','(b)','(c)'],TF,9,505,580))
claim(9,79,145,'native section and A instruction')
claim(10,454,475,'native figure caption')
page(10,q(10,80,195,2),fig(10,[137,213,379,445],'図1　Mさんがかつて撮影しSNSに投稿した写真'),'<dl class="term-list"><dt>あ</dt><dd>著作者人格権</dd><dt>い</dt><dd>肖像権</dd><dt>う</dt><dd>実用新案権</dd></dl>',choices('イ',10,570,650))
claim(10,493,550,'native rights list')
page(11,q(11,80,120,3),p(11,140,215),p(11,220,315),p(11,320,415),p(11,420,495),p(11,500,540))
postfields='q2a-ウ q2a-エ q2a-オ q2a-カ'
def postopt(value,text):return f'<span class="option" data-choice-fields="{postfields}" data-choice-value="{value}"><span class="option-number">{imp.CIRCLES[int(value,16)]}</span><span class="option-text"><u>{text}</u></span></span>'
posts=[('A','4月8日 17:52','今日，'+postopt('0','家から千葉駅までの通学定期券')+'を6か月分買ったよ。自販機で買えるなんて知らなかった。'),('B','4月29日 16:25','車で親の買い物につき合わされたよ。'+postopt('1','今日はこのスーパーの特売日')+'らしい。'),('C','5月20日 17:32','今日，'+postopt('2','学校の正門の向かい側')+'に'+postopt('3','EOFコーヒーショップ')+'がオープンですって。さすが'+postopt('4','千葉県初，唯一の店')+'だけあって行列すごい。'),('D','6月2日 18:21',postopt('5','うちの町内の古民家が昨日重要文化財に指定された')+'とかで，ニュースの中継がいっぱい来てた！今度見に行ってみよっと。'),('E','7月29日 7:35',postopt('6','部長')+'として絶対に遅刻できないんで(キリッ)朝5時起きで'+postopt('7','DNCホール')+'に来たよ。'+postopt('8','今日はここでいろんな大会がある')+'みたい。千葉県No.1目指してとにかくがんばる！'),('F','7月29日 18:06','大会おわった。'+postopt('9','うちの部活から私も含め優秀賞に3人選ばれた！')+postopt('A','アナウンス部門での受賞はうちの学校から私だけ。')+'最優秀賞はとれなかったけどがんばった(ほっ)')]
postmarkup='<div class="sns-posts">'+''.join('<article class="sns-post"><h4>投稿'+label+'</h4><div class="source-frame"><div class="post-meta"><span>にゃおん</span><time>'+date+'</time></div><p>'+body+'</p></div></article>' for label,date,body in posts)+'</div>'+cap('図2　MさんがかつてSNSに投稿した内容の一部')
claim(12,70,655,'native SNS posts with contextual choices');page(12,postmarkup)
page(13,q(13,80,200,4),choices('キ',13,220,300))
claim(14,200,330,'native message card')
message='<article class="sns-post source-frame message-card"><div class="post-meta"><strong>T株式会社（PR担当）</strong><time>5月17日 23:46</time></div><p>高校生限定キャンペーン！<br>T株式会社のアンケートに答えて<br>豪華賞品をもらおう！<br>アンケートはこちら↓<br><u>http://example.jp/q5RXQcn6V</u></p></article>'+cap('図3　「T株式会社（PR担当）」から届いたメッセージ')
page(14,q(14,80,160,5),message,choices('ク',14,350,490))
claim(15,285,420,'native combination choices')
q15=source(15,80,120).replace('空欄あ・い','空欄<span class="term-blank">あ</span>・<span class="term-blank">い</span>')
para15=source(15,140,260).replace('これをあという','これを<span class="term-blank">あ</span>という').replace('は，いに違反','は，<span class="term-blank">い</span>に違反')
page(15,'<h3 class="question-heading">問6</h3>'+para(re.sub(r'^問[０-９0-9]+','',q15)),para(para15),choice_table('ケ',['あ','い'],[['テキストマイニング','個人情報保護法'],['フィッシング','個人情報保護法'],['フィルタリング','個人情報保護法'],['テキストマイニング','不正アクセス禁止法'],['フィッシング','不正アクセス禁止法'],['フィルタリング','不正アクセス禁止法']],15,285,420),p(15,430,470))
# 第2問B
SID='q2b'
def underline(s,terms):
 s=re.sub(r'\s+','',s)
 for term in terms:
  assert term in s,(term,s)
  s=s.replace(term,'<u>'+term+'</u>')
 return s
intro1=underline(source(16,120,250),['(a)映画なら約２４fps'])
intro2=underline(source(16,260,395),['(b)2時間の映画（２４fps）が解像度１９２０×１０８０，２４ビットフルカラーであれば，圧縮なしで約1Tバイトにもなる。','(c)動画の各フレーム間で異なるところの情報のみを記録してデータ量を減らす方法がある。'])
intro3=underline(source(16,400,440),['(d)フレームレートや解像度などを変更したりすることもできる。'])
claim(16,530,550,'native figure caption')
page(16,'<h2>第2問B</h2>'+para(re.sub(r'^Ｂ','',source(16,80,100))),para(intro1),para(intro2),para(intro3),fig(16,[65,455,455,523],'図4　動画を構成するフレームの一部'))
claim(17,360,430,'native annotated equation')
formula='<div class="formula-components"><div><p>1フレームのデータ量</p>'+equation('1920 × 1080 × '+B('サ'))+'</div><span>×</span><div><p>総フレーム数</p>'+equation('2 × 60 × '+B('シ')+' × 24')+'</div><div><p>単位</p>'+equation('バイト')+'</div></div>'+cap('図5　2時間の映画のデータ量（計算式）')
page(17,q(17,80,160,1),choices('コ',17,180,260),q(17,280,340,2),formula,choices('サ シ',17,448,490))
claim(18,180,209,'native video I introduction and frame captions');claim(18,300,330,'native video II introduction and frame captions');claim(18,401,420,'native figure caption')
framesI='<div class="figure-row video-frame-row">'+''.join(fig(18,[x,209,x+87,272],t) for x,t in zip([66,165,264,363],['1フレーム目','120フレーム目','240フレーム目','360フレーム目（最後）']))+'</div>'
framesII='<div class="figure-row video-frame-row">'+''.join(fig(18,[x,330,x+87,393],t) for x,t in zip([66,165,264,363],['1フレーム目','120フレーム目','240フレーム目','360フレーム目（最後）']))+'</div>'
page(18,q(18,80,160,3),para('Ⅰ　山全体が映るようにカメラを三脚に固定して，通り行く列車を60fpsで撮影'),framesI,para('Ⅱ　カメラを固定せず，通り行く列車をできるだけ追うようにして60fpsで撮影'),framesII,cap('図6　動画Ⅰと動画Ⅱのフレーム画像'),p(18,441,525),choices('セ ソ タ',18,542,620))
claim(19,213,280,'native conversion methods')
methods='<dl class="term-list"><dt>あ</dt><dd>動画の横の画素数と縦の画素数をそれぞれ<span class="fraction"><sup>1</sup>⁄<sub>2</sub></span>にする。</dd><dt>い</dt><dd>再生時間は変えずフレームレートを30fpsにする。</dd><dt>う</dt><dd>256階調のグレースケールにする。</dd></dl>'
page(19,q(19,80,200,4),methods,choices('チ',19,300,340),q(19,360,420,5),p(19,440,540),choices('ツ',19,560,580))
page(20,q(20,80,120,6),'<dl class="term-list"><dt>あ</dt><dd>'+source(20,140,175).removeprefix('あ')+'</dd><dt>い</dt><dd>'+source(20,180,215).removeprefix('い')+'</dd><dt>う</dt><dd>'+source(20,220,260).removeprefix('う')+'</dd></dl>',choice_table('テ',['あ','い','う'],TF,20,285,365))
# 第3問
SID='q3'
field_table=[['番号','0','1','2','3','4','5','6','…','192'],['分野','歴史','情報','歴史','歴史','国語','歴史','情報','…','日常']]
claim(21,405,470,'native figure 1 table');claim(21,570,635,'native procedure')
page(21,'<h2>第3問（配点25）</h2>'+para('次の文章を読み，後の問い（問1～3）に答えよ。'),p(21,120,220),q(21,240,280,1),p(21,300,380),matrix('図1　データベースにある各問題の分野',field_table),p(21,490,550),'<aside class="procedure"><h4>【手順】</h4><div class="source-frame">'+para('番号0の問題から順番に「問題の分野を確認し，その分野の採用問題数が最大数未満であれば，その問題を採用する」を繰り返す。')+'</div></aside>')
claim(21,79,100,'native section title')
claim(22,305,370,'native figure 2 table');claim(22,396,460,'native figure 3 table')
page(22,p(22,80,280),matrix('図2　手作業で手順を試したときのメモ1（採用表）',[['番号','0','1','2','3','4','…'],['採用','✓','✓','✓','','✓','…']]),matrix('図3　手作業で手順を試したときのメモ2（採用問題数表）',[['分野','情報','国語','歴史','音楽','地理','日常'],['採用問題数',B('ア'),'1','2','0','0','0']]),p(22,480,540),choices('イ',22,561,620))
claim(23,259,325,'native repeated figure 1 table');claim(23,344,410,'native figure 4 array table');claim(23,511,580,'native function definition')
page(23,q(23,80,135,2),p(23,150,240),matrix('図1　データベースにある各問題の分野（再掲）',field_table),matrix('図4　分野の番号を用いて図1を表した配列Bunya',[['添字','0','1','2','3','4','5','6','…','192'],['Bunya','2','0','2','2',B('エ'),'2',B('オ'),'…','5']]),p(23,422,495),'<aside class="function-definition"><h4>【関数の説明】</h4><div class="source-frame">'+para('要素数(配列)…引数として配列が与えられ，その要素数を返す。')+para('例えば，配列Xが[3, 9, 8, 3]であるとき，要素数(X)は4となる。')+'</div></aside>',p(23,603,650))
claim(24,80,300,'native program 5')
program5=[(0,'Bunya = [2, 0, 2, 2, '+B('エ')+', 2, '+B('オ')+', ……, 5]'),(0,'saidai = 5'),(0,'Saiyou = [0, 0, ……, 0]'),(0,'Mondaisu = [0, 0, 0, 0, 0, 0]'),(0,'i を0 から '+B('カ')+' まで1 ずつ増やしながら繰り返す:'),(1,'b = Bunya[i]'),(1,'もし '+B('キ')+' ならば:'),(2,'Saiyou[i] = 1'),(2,'Mondaisu[b] = '+B('ク'))]
page(24,program('図5　一つのクイズ集を作るプログラム',program5),p(24,311,375),p(24,378,430),choices('カ ク',24,447,550,code=True),choices('キ',24,570,650,code=True))
claim(25,328,640,'native program 6')
program6=[(0,'Bunya = [2, 0, 2, 2, '+B('エ')+', 2, '+B('オ')+', ……, 5]'),(0,'saidai = 5'),(0,'Saiyou = [0, 0, ……, 0]'),(0,'c を1 から4 まで1 ずつ増やしながら繰り返す:'),(1,'Mondaisu = [0, 0, 0, 0, 0, 0]'),(1,'i を0 から '+B('カ')+' まで1 ずつ増やしながら繰り返す:'),(2,'b = Bunya[i]'),(2,'もし('+B('キ')+') '+B('コ')+' ('+B('サ')+')ならば:'),(3,'Saiyou[i] = '+B('シ')),(3,'Mondaisu[b] = '+B('ク')),(0,'i を0 から '+B('カ')+' まで1 ずつ増やしながら繰り返す:'),(1,'もし '+B('ス')+' ならば:'),(2,'表示する("番号", i, "の問題を", Saiyou[i], "番のクイズ集に入れる")')]
page(25,q(25,80,120,3),p(25,140,175),p(25,178,300),program('図6　問題が重複しない四つのクイズ集を作るプログラム',program6))
claim(26,210,340,'native output excerpt')
output='<div class="program-output source-frame">'+para('番号0の問題を1番のクイズ集に入れる')+para('番号1の問題を1番のクイズ集に入れる')+'<p class="omission" aria-label="中略">⋮</p>'+para('番号143の問題を4番のクイズ集に入れる')+para('番号153の問題を4番のクイズ集に入れる')+'</div>'+cap('図7　図6のプログラムを実行した結果')
page(26,p(26,78,180),output,choices('コ',26,360,400,code=True),choices('サ ス',26,430,515,code=True),choices('シ',26,540,620,code=True))
# 第4問
SID='q4'
claim(27,209,320,'native table 1');claim(27,640,655,'native figure 1 caption')
page(27,'<h2>第4問（配点25）</h2>'+para('次の文章を読み，後の問い（問1～5）に答えよ。'),p(27,116,195),table('表1　各地点の飛散花粉数（一部抜粋，各年1～5月の累積値）',['年','A地点','B地点','C地点','D地点','…','L地点'],[['2020','1906','1624','2603','1777','…','1013'],['2021','3279','2834','3804','2558','…','892'],['2022','2836','2837','3068','2980','…','1732']]),p(27,324,345),q(27,361,400,1),p(27,415,475,replace={'平均値をで':'平均値を<span class="mean-marker">＋</span>で'}),fig(27,[95,484,423,634],'図1　各地点の飛散花粉数'))
claim(27,79,100,'native section title')
claim(28,180,368,'native statistics table')
page(28,p(28,80,95),p(28,100,135),p(28,140,160),table('表2　3地点の飛散花粉数に関する基本的な統計量',['','A地点',B('イ')+'地点',B('ウ')+'地点'],[['最小値','940','551','1000'],['第1四分位数','1795','1583','1851'],['第2四分位数（中央値）','3382','2997','3476'],['第3四分位数','4886','4317','6497'],['最大値','8302','6399','17994'],['平均値','3545','3177','5052']]),choices('ア',28,390,515),choices('イ ウ',28,540,585))
claim(29,220,330,'native weather table');claim(29,494,605,'native correlation table')
page(29,q(29,80,200,2),table('表3　入手した天候データ（一部抜粋）',['年月','気温','降水量','日射量'],[['2020年1月','7.1','135','8.0'],['2020年2月','8.3','15','12.9'],['2020年3月','10.7','131','13.9']]),p(29,335,355),p(29,374,475),table('表4　天候データと飛散花粉数の相関係数',['','4月','5月','6月','7月','8月','9月'],[['気温','0.15','0.07','0.18','0.56','0.08','0.17'],['降水量','−0.02','0.02','−0.18','−0.36','−0.32','0.29'],['日射量','−0.12','−0.04','0.65','0.57','0.14','0.06']]))
page(30,'<dl class="term-list"><dt>あ</dt><dd>'+source(30,80,95).removeprefix('あ')+'</dd><dt>い</dt><dd>'+source(30,100,115).removeprefix('い')+'</dd><dt>う</dt><dd>'+source(30,120,140).removeprefix('う')+'</dd></dl>',choice_table('エ',['あ','い','う'],[[v.replace('正','〇').replace('誤','×') for v in row] for row in TF],30,165,245))
claim(31,340,475,'native moving-average table')
# The narrow source brace diagram is geometric information, while every date/value is native text.
ma_braces=fig(31,[255,381,295,469],'移動平均の対象範囲')
ma='<div class="table-wrap"><table class="data-table moving-average-table"><caption>表5　日射量の移動平均（幅±1日）を求めた場合（一部抜粋）</caption><thead><tr><th scope="col">日付</th><th scope="col">日射量</th><th scope="col" colspan="2">日射量の移動平均（幅±1日）</th></tr></thead><tbody>'
for i,(date,radiation,mean) in enumerate([('2020年6月29日','25.14','12.88'),('2020年6月30日','7.32','13.04'),('2020年7月1日','6.66','13.84'),('2020年7月2日','27.55','15.32')]):
 ma+='<tr><th scope="row">'+date+'</th><td>'+radiation+'</td>'+(('<td rowspan="4" class="moving-average-braces">'+ma_braces+'</td>') if i==0 else '')+'<td>'+mean+'</td></tr>'
ma+='</tbody></table></div>'
page(31,q(31,80,120,3),p(31,140,235),p(31,240,315),ma,p(31,476,495),p(31,515,615))
# Each of the four candidate graphs has a native caption, no rasterized labels outside the chart.
graphs=[]
for top,label in [(78,'あ'),(203,'い'),(328,'う'),(453,'え')]:graphs.append(fig(32,[155,top,377,top+107],label))
claim(32,80,575,'native graph labels and original graphs')
page(32,'<div class="figure-row graph-choice-row">'+''.join(graphs)+'</div>',choices('オ',32,583,625))
claim(33,454,475,'native figure 2 caption')
page(33,q(33,80,120,4),p(33,140,240),fig(33,[65,258,453,447],'図2　各幅の日射量の移動平均と飛散花粉数の相関係数'))
page(34,p(34,80,200),choices('ク',34,220,280),choices('ケ',34,310,350),choices('コ',34,380,480))
claim(35,544,565,'native figure 3 caption')
page(35,q(35,80,120,5),p(35,140,200),equation(source(35,220,240)),fig(35,[113,258,408,536],'図3　各年の日射量の移動平均とその翌年の飛散花粉数の関係'))
page(36,p(36,80,195),p(36,200,240),choices('サ',36,260,320),choices('シ',36,350,450))
# Output BODY fragments only. Reading-unit anchors and final figure assets are assigned by the importer.
for sid,start,stop in [('q1',1,9),('q2a',9,16),('q2b',16,21),('q3',21,27),('q4',27,37)]:
 body='\n'.join(PAGES[n] for n in range(start,stop))+'\n'
 # Restore semantic superscripts instead of printed full-width baseline digits in units.
 body=body.replace('cm２','cm<sup>2</sup>').replace('m２','m<sup>2</sup>')
 tree=html.fromstring('<div>'+body+'</div>')
 serialized='\n'.join(etree.tostring(x,encoding='unicode',method='html') for x in tree)+'\n'
 HERE.joinpath(sid+'.html').write_text(serialized)
# Audit the disposition of every visible extracted line.
uncovered=[]
for pn,lines in LINES.items():
 for i,line in enumerate(lines):
  if i not in CLAIMS[pn]:uncovered.append({'page':pn,'y':round(line['bbox'].y0,2),'text':line['text']})
HERE.joinpath('coverage.json').write_text(json.dumps({'pages':len(PAGES),'uncoveredLines':uncovered,'lineCount':sum(map(len,LINES.values())),'coveredLineCount':sum(map(len,CLAIMS.values()))},ensure_ascii=False,indent=2)+'\n')
print('pages',len(PAGES),'uncovered',uncovered)
