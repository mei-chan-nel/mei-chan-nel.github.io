"""Meaning-based, visually reviewed authoring map for the 2025 main paper.
Only writes the five source body fragments in this directory.
"""
from pathlib import Path
import sys,copy,json,re,html as H
import fitz
from lxml import etree,html
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
import import_past_exams as I
DOC=fitz.open(ROOT/'mock-exams/exams/2025Honshi/1/source/problem.pdf')
META=json.loads((ROOT/'scripts/past_exam_data/2025_main.json').read_text())
FIELDS={s:{f['label']:f for f in META['fields'] if f['sectionId']==s} for s in ['q1','q2a','q2b','q3','q4']}
CACHE={};CURRENT='q1';CIRC='⓪①②③④⑤⑥⑦⑧⑨'
def E(t):return H.escape(str(t),quote=False)
def blank(c):return f'<span class="blank" data-field="{CURRENT}-{c}" data-original="{c}">{c}</span>'
def rows(p):
 if p in CACHE:return CACHE[p]
 page=DOC[p-1];ls=I.page_data(DOC,page);bs=I.find_boxes(page,ls,FIELDS[CURRENT]);rs=[]
 for l in sorted(ls,key=lambda l:(l['bbox'].y0,l['bbox'].x0)):
  y=l['bbox'].y0
  if rs and abs(rs[-1]['y']-y)<2:
   rs[-1]['chars']+=l['chars'];rs[-1]['ys'].append(y)
  else:rs.append({'y':y,'ys':[y],'chars':list(l['chars'])})
 for r in rs:
  r['chars'].sort(key=lambda c:(c['bbox'][0],c['bbox'][1]));r['bbox']=fitz.Rect(min(c['bbox'][0] for c in r['chars']),min(c['bbox'][1] for c in r['chars']),max(c['bbox'][2] for c in r['chars']),max(c['bbox'][3] for c in r['chars']));r['text']=''.join(c['c'] for c in r['chars'])
  el=I.line_html(r,bs,FIELDS[CURRENT]);el.attrib.clear()
  for b in el.xpath('.//*[@data-field]'):
   b.attrib.pop('data-input-type',None)
  r['html']= (el.text or '')+''.join(etree.tostring(c,encoding='unicode',method='html') for c in el)
 CACHE[p]=rs;return rs
COVER={}
def prose(p,*bands,cls=None):
 out=[]
 for y0,y1 in bands:
  rr=[r for r in rows(p) if y0<=r['y']<=y1];assert rr,(p,y0,y1)
  COVER.setdefault(p,[]).append((y0,y1,'prose'))
  text=''.join(r['html'] for r in rr)
  text=re.sub(r'([A-Za-z])\s+([，。])',r'\1\2',text)
  text=re.sub(r'^(第[１２３４1-4]問|問[１２３４1-4]|[ａｂＡＢ])(?=\S)',r'\1　',text)
  classes=cls or ('exam-section-heading' if I.norm(''.join(r['text'] for r in rr)).startswith('第') else 'exam-question' if I.norm(''.join(r['text'] for r in rr)).startswith('問') else None)
  out.append('<p'+(f' class="{classes}"' if classes else '')+'>'+text+'</p>')
 return '\n'.join(out)
def page(p,*content):return f'<section class="page" data-source-page="{p}">\n'+ '\n'.join(content)+'\n</section>'
def choice(labels,caption=None,code=False):
 fs=FIELDS[CURRENT][labels[0]];items=fs['choices'];bound=' '.join(CURRENT+'-'+c for c in labels)
 leg=caption or '・'.join(blank(c) for c in labels)+'の解答群'
 result=f'<fieldset class="choices"><legend>{leg}</legend><div class="choice-grid">'
 for c in items:
  txt=E(c['text']);txt=f'<code>{txt}</code>' if code else txt
  result+=f'<div class="option" data-choice-fields="{bound}" data-choice-value="{c["value"]}"><span class="option-number">{CIRC[int(c["value"])]}</span><span class="option-text">{txt}</span></div>'
 return result+'</div></fieldset>'
def fig(p,box,caption):
 return f'<figure class="past-diagram" data-pdf-page="{p}" data-pdf-clip="'+ ' '.join(map(str,box))+'"><figcaption>'+caption+'</figcaption></figure>'
def tab(caption,headers,data,classes=''):
 s='<div class="table-wrap"><table class="'+classes+'">'+('<caption>'+caption+'</caption>' if caption else '')+'<thead><tr>'+''.join('<th scope="col">'+str(x)+'</th>' for x in headers)+'</tr></thead><tbody>'
 for row in data:s+='<tr>'+''.join(('<th scope="row">' if i==0 else '<td>')+str(c)+('</th>' if i==0 else '</td>') for i,c in enumerate(row))+'</tr>'
 return s+'</tbody></table></div>'
def rule(p,y0,y1,framed=False):
 classes='rules source-frame' if framed else 'rules'
 return '<div class="'+classes+'">'+prose(p,(y0,y1))+'</div>'
def bullets(p,bands,framed=False):
 classes='conditions source-frame' if framed else 'conditions'
 s='<ul class="'+classes+'">'
 for band in bands:
  q=prose(p,band);q=re.sub(r'^<p[^>]*>●?','',q);q=q.removesuffix('</p>');s+='<li>'+q+'</li>'
 return s+'</ul>'
def production(caption):return tab(caption,['工芸品']+list(range(1,10)),[['製作日数',4,1,3,1,3,4,2,4,3]])
def email(repeat=False):
 lines=['工芸品1 … 部員1：1日目～4日目','工芸品2 … 部員2：1日目～1日目','工芸品3 … 部員3：1日目～3日目',f'工芸品4 … 部員{blank("ア")}：{blank("イ")}日目～{blank("イ")}日目',f'工芸品5 … 部員{blank("ウ")}：{blank("エ")}日目～{blank("オ")}日目','…','工芸品9 … 部員1：7日目～9日目']
 return '<figure class="mail-example"><div class="mail-body source-frame">'+''.join('<p>'+x+'</p>' for x in lines)+'</div><figcaption>図2　各工芸品の担当と期間を一覧にしたメールの文面'+('（再掲）' if repeat else '')+'</figcaption></figure>'
def program(caption,statements):
 s='<figure class="native-program"><div class="program"><div class="code">'
 for n,(depth,src) in enumerate(statements,1):s+=f'<div class="code-row" data-depth="{depth}"><span class="ln">({n:02})</span><span class="src">{src}</span></div>'
 return s+'</div></div><figcaption>'+caption+'</figcaption></figure>'

def q1():
 return [
 page(1,prose(1,(159,162),(200,202),(239,262),(299,342)),choice(['ア'])),
 page(2,prose(2,(79,122)),choice(['イ'])),
 page(3,prose(3,(79,82),(119,162)),'<div class="figure-row">'+fig(3,[70,197,203,345],'図1　7セグメントLED')+fig(3,[218,210,448,345],'図2　7セグメントLEDで表示した0～9の数字')+'</div>',prose(3,(407,431))),
 page(4,prose(4,(79,102)),fig(4,[65,134,451,204],'図3　7セグメントLEDで表示したアルファベット（下線は小文字を示す）'),prose(4,(249,332)),fig(4,[194,365,323,437],'図4　7セグメントLEDの部品で表示したエラーコード')),
 page(5,prose(5,(79,102),(139,222)),rule(5,259,282),rule(5,299,342),prose(5,(379,402),(439,462),(479,542))),
 page(6,choice(['ク'])),
 page(7,prose(7,(79,82),(119,162)),bullets(7,[(209,212),(229,232)],framed=True),prose(7,(279,302),(339,382),(399,442)),fig(7,[145,460,380,634],'図5　ディスプレイ上の対象物'),choice(['ケ'])),
 page(8,prose(8,(79,102),(139,162),(179,262)),fig(8,[160,298,355,432],'図6　右クリックした際のメニュー項目'),choice(['コ']),choice(['サ']))]
def q2a():
 conds=[['あ','ポイント会員IDとネットショッピングのアカウントが対応付けられている。'],['い','ネットショッピングで扱われている商品に実店舗で用いられている商品コードが割り当てられている。'],['う','商品コードと店コードから実店舗における商品の在庫数を調べることができる。']]
 benefits=[['Ⅰ','顧客がネットショッピングサイトにログインしたときに，現在のポイントカードのポイント数と自宅に近い実店舗の広告チラシが自動的に表示される。',blank('キ')],['Ⅱ','顧客がネットショッピングで商品を購入しようとするとき，その顧客がポイントカードをよく利用する実店舗のうちで，その商品の在庫がある実店舗の情報が表示される。',blank('ク')],['Ⅲ','顧客がネットショッピングサイトにログインしたときに，商品の購入傾向が実店舗も含めて類似している他の顧客の購入履歴をもとに，おすすめ商品を画面に表示する。',blank('ケ')]]
 return [
 page(9,prose(9,(78,82),(119,162)), '<div class="dialogue">'+prose(9,(199,242),(259,322),(339,362),(379,462),(479,502),(519,542))+'</div>'),
 page(10,fig(10,[65,76,455,417],'図1　レシートの例'),prose(10,(464,507),(543,607)),choice(['ア','イ','ウ'])),
 page(11,prose(11,(79,102)),choice(['エ'])),
 page(12,prose(12,(79,122)),fig(12,[95,154,455,347],'図2　LikeWingの情報システムにおける主な情報の流れと商品の流れ'),prose(12,(391,434)), '<p>Ⅰ　店コード　'+blank('オ')+'</p><p>Ⅱ　ポイント会員ID　'+blank('カ')+'</p>',choice(['オ','カ'])),
 page(13,prose(13,(79,202)),tab('', ['','連携するメリット','条件'],benefits),'<h3>【条件】</h3><dl class="conditions">'+''.join('<dt>'+a+'</dt><dd>'+b+'</dd>' for a,b in conds)+'</dl>'),
 page(14,choice(['キ','ク','ケ'],caption=blank('キ')+'～'+blank('ケ')+'の解答群'))]
def q2b():
 nums=[['初期値','―','0','0'],['1人目',8,1,'−4'],['2人目',1,1,2],['3人目',6,2,'−2'],['4人目',10,3,'−6'],['5人目',9,'？','？'],['6人目',4,blank('コ'),'？'],['7人目',5,'？','？'],['8人目',3,'？','−'+blank('サ')+blank('シ')],['9人目',7,'？','？'],['10人目',2,'？','？']]
 return [
 page(15,prose(15,(79,82),(119,182)),bullets(15,[(219,222),(239,262),(279,282),(299,322)]),prose(15,(359,382)), '<div class="rules">'+prose(15,(399,402),(419,422))+'</div>'),
 page(16,prose(16,(79,82),(119,142)),tab('表1　乱数rの値と手元の一万円札，千円札の枚数変化',['','乱数rの値','手元の一万円札の枚数','手元の千円札の枚数'],nums),'<p class="table-note">（表の一部を「？」で隠してある）</p><div class="table-callouts"><p>1人目が一万円札で支払ったので，おつりとして渡す千円札4枚が不足する。</p><p>2人目が千円札6枚で支払ったので，不足していた1人目のおつりを渡し，千円札2枚が残る。</p></div>',prose(16,(499,622))),
 page(17,prose(17,(79,162)),choice(['ソ']),fig(17,[90,314,455,522],'図3　「手元の千円札の枚数」の最小値の回数')),
 page(18,prose(18,(79,122)),choice(['タ']))]
def q3():
 p4=program('図4　次に割り当てる工芸品の担当部員を表示するプログラム',[(0,'Akibi = [5, 3, '+blank('カ')+']'),(0,'buinsu = 3'),(0,'tantou = 1'),(0,'buin を 2 から buinsu まで 1 ずつ増やしながら繰り返す:'),(1,'もし '+blank('キ')+' ならば:'),(2,'tantou = buin'),(0,'表示する("次の工芸品の担当は部員", tantou, "です。")')])
 p5=program('図5　各工芸品の担当と期間の一覧を表示するプログラム',[(0,'Nissu = [4, 1, 3, 1, 3, 4, 2, 4, 3]'),(0,'kougeihinsu = 9'),(0,'Akibi = [1, 1, 1]'),(0,'buinsu = 3'),(0,blank('ケ')+' を 1 から '+blank('コ')+' まで 1 ずつ増やしながら繰り返す:'),(1,'tantou = 1'),(1,'buin を 2 から buinsu まで 1 ずつ増やしながら繰り返す:'),(2,'もし '+blank('キ')+' ならば:'),(3,'tantou = buin'),(1,'表示する("工芸品", kougeihin, " … ", "部員", tantou, "：", Akibi[tantou], "日目～", Akibi[tantou] + '+blank('サ')+', "日目")'),(1,'Akibi[tantou] = Akibi[tantou] + '+blank('シ'))])
 return [
 page(19,prose(19,(78,82),(117,158),(193,196),(230,291)),production('表1　各工芸品の製作日数'),prose(19,(413,436)),fig(19,[110,465,405,540],'図1　割当図（工芸品4まで）'),prose(19,(582,642))),
 page(20,prose(20,(79,102),(119,122)),rule(20,169,192,framed=True),prose(20,(239,262)),email(),prose(20,(499,523))),
 page(21,prose(21,(79,102),(136,178)),rule(21,223,246,framed=True),prose(21,(291,332),(348,389)),fig(21,[110,419,405,494],'図1　割当図（工芸品4まで）（再掲）'),tab('図3　図1の状況に対応する配列Akibi',['添字',1,2,3],[['Akibi',5,3,blank('カ')]]),prose(21,(620,643))),
 page(22,prose(22,(79,142)),p4,prose(22,(379,462)),choice(['キ'],code=True)),
 page(23,prose(23,(79,101),(131,152)),production('表1　各工芸品の製作日数（再掲）'),email(True),prose(23,(464,555),(569,642))),
 page(24,p5,choice(['ケ','コ'],code=True),choice(['サ','シ'],code=True))]
def q4():
 return [
 page(25,prose(25,(78,82),(116,156),(170,211)),tab('表1　地方ごとの旅行者数と旅行目的別の内訳（抜粋）<br>旅行者数（千人）',['番号','地方','出張等','帰省等','観光等','合計'],[[1,'北海道',3652,5052,9768,18472],[2,'東北',6161,9410,12365,27936],[3,'関東',14401,19138,45943,79482],['…','…','…','…','…','…'],[10,'沖縄',662,1127,5446,7235]],classes='open-table'),prose(25,(401,441),(474,477)), '<div class="dialogue">'+prose(25,(511,533),(548,570),(584,588),(603,625),(639,643))+'</div>'),
 page(26,'<div class="dialogue">'+prose(26,(79,102))+'</div>',prose(26,(135,159)),fig(26,[64,188,455,398],'図1　表1のデータに基づいて作成した棒グラフと帯グラフ'),choice(['ア','イ']),choice(['ウ','エ'])),
 page(27,prose(27,(79,103),(139,162),(179,222),(239,263)),choice(['オ','カ'])),
 page(28,tab('表2　都道府県ごとの旅行者数と旅行目的別の内訳（抜粋）<br>旅行者数（千人）',['番号','都道府県','出張等','帰省等','観光等','合計'],[[1,'北海道',3652,5052,9768,18472],[2,'青森県',1015,1566,1097,3678],[3,'岩手県',1158,1537,1606,4301],['…','…','…','…','…','…'],[47,'沖縄県',662,1127,5446,7235]],classes='open-table'),fig(28,[65,235,455,615],'図2　目的の組合せによる散布図と相関係数')),
 page(29,prose(29,(79,102),(136,216),(231,387),(401,425),(439,500)),tab('表3　都道府県ごとの人口（抜粋）',['番号','都道府県','人口（千人）'],[[1,'北海道',5259],[2,'青森県',1253],[3,'岩手県',1226],['…','…','…'],[47,'沖縄県',1462]],classes='open-table')),
 page(30,'<div class="figure-row">'+fig(30,[70,71,260,307],'図3　出張等と観光等の旅行者数の組合せによる散布図')+fig(30,[270,71,455,307],'図4　「出張/人口」と「観光/人口」の組合せによる散布図')+'</div>',choice(['キ']),choice(['ク'])),
 page(31,prose(31,(79,123),(159,203),(219,263),(279,343),(359,463))),
 page(32,fig(32,[110,77,425,335],'図5　「出張/人口」と「観光/人口」の組合せによる散布図（各軸に沿って，各指標の分布を表す箱ひげ図を併記）'),choice(['コ']),choice(['サ','シ']))]

for CURRENT,fn in [('q1',q1),('q2a',q2a),('q2b',q2b),('q3',q3),('q4',q4)]:
 CACHE.clear();fragment='\n'.join(fn())+'\n'
 if CURRENT=='q1':
  for n in range(1,6):fragment=fragment.replace('N'+str(n).translate(str.maketrans('12345','１２３４５')),f'N<sub>{n}</sub>')
 if CURRENT=='q2a':
  for target in ['ポイント会員情報とレシートに印字されている情報を組み合わせて分析する','本部，各店舗，商品を製造するメーカー，商品を店舗に配送する配送センターの間で情報をやり取り','連携するメリット']:
   fragment=fragment.replace(target,'<u>'+target+'</u>',1)
 tree=html.fragment_fromstring(fragment,create_parent='div')
 if CURRENT=='q3':
  code=tree.xpath('.//section[@data-source-page="24"]//div[@class="code"]')[0]
  for index in range(5,9):
   row=code[index];row.set('data-source-box','selection');row.set('class','code-row source-box'+(' source-box-first' if index==5 else '')+(' source-box-last' if index==8 else ''))
 # Preserve Unicode labels and avoid unsafe/invalid literal < in native source rows.
 for src in tree.xpath('.//span[@class="src"]'):
  assert not src.xpath('.//script')
 (HERE/(CURRENT+'.html')).write_text('\n'.join(etree.tostring(e,encoding='unicode',method='html',pretty_print=True) for e in tree)+'\n')
 print(CURRENT,len(tree),'pages',len(tree.xpath('.//table')),'tables',len(tree.xpath('.//fieldset')),'choice sets',len(tree.xpath('.//figure[@class="past-diagram"]')),'diagram crops')
