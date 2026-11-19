"""Build semantic 2026 main source assets from inspected original PDF geometry."""
from pathlib import Path
import sys,copy,re,json,unicodedata
sys.dont_write_bytecode=True
from lxml import etree,html
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'scripts'))
import import_past_exams as imp
OUT=Path(__file__).resolve().parent
PDF=ROOT/'mock-exams/exams/2026Honshi/1/source/problem.pdf'
DOC=imp.fitz.open(PDF)
DEFINITION=json.loads((ROOT/'scripts/past_exam_data/2026_main.json').read_text())
FIELDS={s:{f['label']:{**f,'id':s+'-'+f['label']} for f in DEFINITION['fields'] if f['sectionId']==s} for s in imp.SID}
CURRENT='q1'
SOURCES={}

def node(tag,text=None,**attrs):
 e=etree.Element(tag,{k.rstrip('_').replace('_','-'):str(v) for k,v in attrs.items()})
 if text is not None:e.text=text
 return e
def markup(tag,text,**attrs):
 e=node(tag,**attrs)
 for part in html.fragments_fromstring(text):
  if isinstance(part,str):imp.append_text(e,part)
  else:e.append(part)
 return e
def blank(label):return f'<span class="blank" data-field="{CURRENT}-{label}" data-original="{label}">{label}</span>'
def B(labels):return ''.join(blank(x) for x in labels)
def page(n,*items):
 e=node('section',class_='page',data_source_page=n)
 for x in items:e.append(x)
 return e
def raw(n,a,b,xmax=999,xmin=0,tag='p',**attrs):
 """One manually selected semantic paragraph, joining only its physical lines."""
 lines=[copy.deepcopy(l) for l in imp.page_data(DOC,DOC[n-1]) if a-.9<=l['bbox'].y0<b-.9 and xmin<=l['bbox'].x0<xmax and max(c['size'] for c in l['chars'])>=7]
 rows=[]
 for line in sorted(lines,key=lambda l:l['bbox'].y0):
  if rows and line['bbox'].y0-rows[-1][0]<4.5:rows[-1][1].append(line)
  else:rows.append((line['bbox'].y0,[line]))
 out=node(tag,**attrs);boxes=imp.find_boxes(DOC[n-1],imp.page_data(DOC,DOC[n-1]),FIELDS[CURRENT])
 for _,row in rows:
  for line in sorted(row,key=lambda l:l['bbox'].x0):
   part=imp.line_html(line,boxes,FIELDS[CURRENT]);imp.append_text(out,part.text or '')
   for child in list(part):
    child.attrib.pop('data-input-type',None);out.append(child)
 SOURCES.setdefault(n,[]).append({'range':[a,b,xmin,xmax],'text':''.join(out.itertext())})
 return out
def fig(n,clip,caption,fields=None):
 e=node('figure',class_='past-diagram',data_pdf_page=n,data_pdf_clip=' '.join(map(str,clip)))
 if fields:e.set('data-pdf-fields',' '.join(CURRENT+'-'+x for x in fields))
 e.append(node('figcaption',caption));return e
def row(*items):
 e=node('div',class_='figure-row');e.extend(items);return e
def choices(labels,title=None,values=None,images=None,captions=None):
 f=FIELDS[CURRENT][labels[0]];values=values or f['choices']
 e=node('fieldset',class_='choices');e.append(node('legend',title or '・'.join(labels)+'の解答群'));grid=node('div',class_='choice-grid')
 for ch in values:
  v=str(ch['value']);opt=node('div',class_='option',data_choice_fields=' '.join(CURRENT+'-'+l for l in labels),data_choice_value=v)
  opt.append(node('span',imp.CIRCLES[int(v,16)],class_='option-number'));text=node('span',class_='option-text')
  if images:
   image=images[int(v)];text.append(fig(*image))
   if captions:text.append(node('span',captions[int(v)],class_='choice-caption'))
  else:text.text=ch['text']
  opt.append(text);grid.append(opt)
 e.append(grid);return e
def table(caption,headers,rows,choice_fields=None,classes=''):
 wrap=node('div',class_='table-scroll');t=node('table',class_=('exam-table '+classes).strip());wrap.append(t)
 if caption:t.append(node('caption',caption))
 head=node('thead');tr=node('tr')
 for title in headers:tr.append(markup('th',title,scope='col'))
 head.append(tr);t.append(head);body=node('tbody')
 for i,cells in enumerate(rows):
  tr=node('tr')
  if choice_fields:tr.set('data-choice-fields',' '.join(CURRENT+'-'+x for x in choice_fields));tr.set('data-choice-value',str(i));tr.set('class','option')
  for j,value in enumerate(cells):
   c=markup('th' if j==0 else 'td',str(value),**({'scope':'row'} if j==0 else {}));tr.append(c)
  body.append(tr)
 t.append(body);return wrap
def optiontable(labels,headers,rows):
 e=node('fieldset',class_='choices');e.append(node('legend','・'.join(labels)+'の解答群'))
 e.append(table(None,['選択肢']+headers,[[f'<span class="option-number">{imp.CIRCLES[i]}</span>']+r for i,r in enumerate(rows)],labels));return e
def program(caption,rows):
 e=node('figure',class_='program');code=node('div',class_='code')
 for number,depth,text in rows:
  r=node('div',class_='code-row',data_depth=depth)
  r.append(node('span',f'({number:02})' if isinstance(number,int) else '',class_='ln'))
  src=markup('span',text,class_='src')
  if isinstance(number,str):
   r.set('class','code-row option');r.set('data-choice-fields','q3-ス q3-セ');r.set('data-choice-value',number)
   src=markup('span',f'<span class="option-number">{imp.CIRCLES[int(number)]}</span><span class="option-text"> ←</span>',class_='src')
  r.append(src);code.append(r)
 e.append(code);e.append(node('figcaption',caption));return e
def box(title,*paras,framed=True,title_outside=False):
 e=node('aside',class_='note-box')
 if title:e.append(node('h3',title))
 if not framed:
  e.extend(paras)
 elif title_outside:
  contents=node('div',class_='source-frame');contents.extend(paras);e.append(contents)
 else:
  e.set('class','note-box source-frame');e.extend(paras)
 return e
def write(sid,pages):
 e=node('div');e.extend(pages)
 # Promote source question/part labels to real semantic headings.
 for sec in e:
  for el in list(sec):
   if el.tag not in ['p','h2','h3'] or not el.text:continue
   lead=el.text;position=sec.index(el)
   if el.tag=='h2' and lead.startswith('第'):
    full=''.join(el.itertext());m=re.match(r'第([０-９0-9]+)問(.*)（配点\s*([０-９0-9]+)）',full)
    if m:
     el.text='第'+unicodedata.normalize('NFKC',m[1])+'問（配点'+unicodedata.normalize('NFKC',m[3])+'）'
     sec.insert(position+1,node('p',m[2]));continue
   m=re.match(r'^問([０-９0-9]+)\s*',lead)
   if m:
    sec.insert(position,node('h3','問'+unicodedata.normalize('NFKC',m[1]),class_='question-heading'))
    el.tag='p';el.set('class','question-lead');el.text=lead[m.end():];continue
   m=re.match(r'^([ＡＢ])\s*',lead)
   if m and el.tag=='h3':
    sec.insert(position,node('h3',unicodedata.normalize('NFKC',m[1]),class_='part-heading'))
    el.tag='p';el.text=lead[m.end():];continue
   m=re.match(r'^([ａ-ｄ])\s*',lead)
   if m:
    sec.insert(position,node('h4',unicodedata.normalize('NFKC',m[1]),class_='subquestion-heading'))
    el.tag='p';el.text=lead[m.end():]
 # The PDF radix notation becomes native subscript, never a glyph image.
 text='\n'.join(html.tostring(x,encoding='unicode',pretty_print=True) for x in e)
 text=re.sub(r'(?<=[0-9A-F])\s*\((2|16)\)',r'<sub>\1</sub>',text)
 text=re.sub(r'(</span>)\s*\((2|16)\)',r'\1<sub>\2</sub>',text)
 (OUT/f'{sid}.html').write_text(text)

CURRENT='q1'
q=[]
q.append(page(1,node('h1','情報Ⅰ'),node('p','（全問必答）'),raw(1,155,177,tag='h2'),raw(1,195,215,tag='h3'),raw(1,235,275),raw(1,295,355),choices('ア'),choices('イ')))
q.append(page(2,raw(2,75,115),choices('ウ','ウの解答群')))
q.append(page(3,raw(3,75,115),raw(3,140,195),raw(3,195,315),row(fig(3,[120,335,205,424],'図1　クロスステッチの図案の例(1)'),fig(3,[310,335,395,424],'図2　クロスステッチの図案の例(2)'))))
q.append(page(4,raw(4,75,115),box('【変換方法】',raw(4,155,215),raw(4,215,255),raw(4,255,275),framed=False),raw(4,295,415),fig(4,[169,437,346,614],'図3　4×4マスの図案を利用して8×8マスの図案を作る方法')))
q.append(page(5,raw(5,75,115),raw(5,135,195),raw(5,195,375,xmax=315),fig(5,[320,194,455,308],'図4　生年の入力方法'),raw(5,375,495),raw(5,495,575),raw(5,575,595)))
q.append(page(6,fig(6,[132,77,385,250],'図5　直近1年間に登録されたユーザの生年データの分布'),row(table('表1　生年の初期値の候補',['代表値','生年'],[['中央値','1961'],['最頻値','1967'],['範囲（1935～2005）の中央の値','1970'],['最大値','2005']]),fig(6,[320,295,450,405],'図6　誕生月の入力方法')),choices('コ'),choices('サ')))
q.append(page(7,raw(7,75,95,tag='h3'),raw(7,115,215),fig(7,[65,237,455,390],'図7　カオルさんからシノブさんへメールを送るときの概念図'),raw(7,435,595)))
mailrows=[['あ','<u>sinobu</u>＠example.ed.jp',blank('シ')],['い','example.ed.jp＠<u>sinobu</u>',blank('ス')],['う','<u>sinobu</u>＠<u>exmple.ed.jp</u>',blank('セ')]]
serverrows=[['A','送信側のドメイン名が存在しない'],['B','送信側のドメイン名が存在しない'],['A','受信側のドメイン名が存在しない'],['B','受信側のドメイン名が存在しない'],['A','ユーザ名が存在しない'],['B','ユーザ名が存在しない'],['A','受信側のドメイン名とユーザ名の両方が存在しない'],['B','受信側のドメイン名とユーザ名の両方が存在しない']]
q.append(page(8,node('p','誤りの例（下線部の文字列には綴りの間違いがある。）'),table(None,['例','メールアドレス','解答欄'],mailrows,classes='source-unruled-table'),optiontable('シスセ',['サーバ','理由'],serverrows),raw(8,385,425),choices('ソ')))
write(CURRENT,q)

CURRENT='q2a';q=[]
q.append(page(9,raw(9,75,97,tag='h2'),raw(9,115,135,tag='h3'),raw(9,155,315),raw(9,315,415),fig(9,[65,431,455,582],'図1　多機能プリンタで住民証明（紙媒体）を入手できる情報システム')))
q.append(page(10,raw(10,75,115),raw(10,130,190),raw(10,190,265),fig(10,[65,280,455,433],'図2　個人保有のPCで住民証明（電子データ）を入手できる情報システム'),choices('アイ')))
q.append(page(11,raw(11,75,115),raw(11,135,215),raw(11,215,275),fig(11,[65,293,455,446],'図3　アクセスコードを利用する方式の情報システム','ウエオ'),raw(11,490,510)))
q.append(page(12,choices('ウエオ'),choices('カ')))
q.append(page(13,raw(13,75,115),raw(13,135,195),markup('p','図4に示す情報システムでは，確認依頼コードを利用する。なお，図4では，図の一部を<span class="hidden-label">？</span>で隠してある。'),raw(13,235,335),fig(13,[65,352,455,516],'図4　確認依頼コードを利用する方式の情報システム')))
q.append(page(14,choices('キク'),choices('ケ')))
write(CURRENT,q)

CURRENT='q2b';q=[]
q.append(page(15,raw(15,75,95,tag='h3'),raw(15,115,195),fig(15,[65,214,455,333],'図5　背景の画像にキャラクターの画像を重ねる様子'),raw(15,375,475,xmax=325),raw(15,475,535,xmax=325),fig(15,[325,417,452,493],'図6'),markup('p','次に，図5(A)の画像に図6の画像を図5(C)と同様に重ねて，<u>(a) 重なる各点の4ビットについてビットごとにOR演算をすると図7の画像になる</u>。さらに，<u>(b) 図7の画像に図5(B)の画像を重ねて，重なる各点の4ビットについて，ビットごとに「ある演算」を行うと図8の画像になる</u>。')))
truth=row(table('OR演算（論理和）',['x','y','x OR y'],[['0','0','0'],['0','1','1'],['1','0','1'],['1','1','1']]),table('AND演算（論理積）',['x','y','x AND y'],[['0','0','0'],['0','1','0'],['1','0','0'],['1','1','1']]),table('NOT演算（否定）',['x','NOT x'],[['0','1'],['1','0']]))
q.append(page(16,row(fig(16,[140,74,247,168],'図7'),fig(16,[267,74,378,168],'図8')),raw(16,205,245),node('h4','表1　論理演算子の真理値表'),truth,raw(16,435,510),raw(16,530,548),raw(16,549,568),choices('コサ')))
q.append(page(17,raw(17,75,135),row(fig(17,[95,153,174,247],'図5(B)（再掲）'),fig(17,[186,153,294,247],'図7（再掲）'),fig(17,[313,153,423,247],'図8（再掲）')),choices('シ')))
q.append(page(18,raw(18,75,255),row(fig(18,[96,273,213,394],'図9　一色でない背景と熊'),fig(18,[96,418,182,510],'図10'),fig(18,[219,273,423,510],'図11　図9の各階調のヒストグラム')),choices('ス')))
images=[(19,[136,445,197,513],''),(19,[247,445,309,513],''),(19,[359,445,420,513],''),(19,[136,546,197,614],''),(19,[247,546,309,614],''),(19,[359,546,420,614],'')]
q.append(page(19,raw(19,75,115),raw(19,130,185),fig(19,[65,201,455,291],'図12　熊の部分のみ風景画像に合成する様子'),raw(19,330,405),choices('セソチ',images=images,captions=['背景：黒','背景：白','熊：黒','背景：白／熊：黒','熊：白','背景：黒／熊：白'])))
q.append(page(20,fig(20,[65,74,455,432],'図13　風景画像に別の画像の一部を合成する手順','セソタチ'),choices('タ')))
write(CURRENT,q)

CURRENT='q3';q=[]
q.append(page(21,raw(21,75,97,tag='h2'),raw(21,110,205),raw(21,225,280),raw(21,295,370),raw(21,370,425),fig(21,[90,445,425,631],'図1　昨年のゲームの体験時間と待ち時間（3人目の来訪者まで）')))
waitrows=[['1人目','0','0','3','0'],['2人目','3','3','6','0'],['3人目','4','6',blank('ア'),'2'],['4人目','10','10','13','0'],['5人目','11','？','？',blank('イ')],['6人目','12','？','？',blank('ウ')]]
q.append(page(22,raw(22,75,155),raw(22,155,235),table('表1　昨年の来訪者の待ち時間を整理した結果',['来訪者','到着時刻','開始時刻','終了時刻','待ち時間'],waitrows),node('p','（表の一部を“？”で隠してある）',class_='table-note'),raw(22,460,540),choices('エオ')))
q.append(page(23,raw(23,75,150),raw(23,165,220),raw(23,220,370),box('【関数の説明】',raw(23,415,455),title_outside=True),raw(23,480,558),box('【関数の説明】',raw(23,600,645),title_outside=True)))
base=[(1,0,'taiken = 3'),(2,0,'Touchaku = [0, 3, 4, 10, 11, 12]'),(3,0,'kyakusu = 要素数(Touchaku)'),(4,0,'Kaishi = [0, 0, 0, 0, 0, 0]'),(5,0,'Shuryou = [0, 0, 0, 0, 0, 0]'),(6,0,'Shuryou[1] = taiken'),(7,0,'i を2からkyakusuまで1ずつ増やしながら繰り返す:'),(8,1,'Kaishi[i] = 最大値('+blank('カ')+', '+blank('キ')+')'),(9,1,'Shuryou[i] = '+blank('ク')),(10,1,'表示する(i, "人目の待ち時間：", '+blank('ケ')+' − '+blank('コ')+', "分間")')]
q.append(page(24,program('図2　2人目以降の来訪者の待ち時間を求めるプログラム',base),choices('カキコ'),choices('クケ')))
prog=[(1,0,'Touchaku = [0, 3, 4, 10, 11, 12]'),(2,0,'kyakusu = 要素数(Touchaku)'),('0',0,''),(3,0,'taiken を1から15まで1ずつ増やしながら繰り返す:'),('1',1,''),(4,1,'Kaishi = [0, 0, 0, 0, 0, 0]'),(5,1,'Shuryou = [0, 0, 0, 0, 0, 0]'),(6,1,'Shuryou[1] = taiken'),(7,1,'i を2からkyakusuまで1ずつ増やしながら繰り返す:'),(8,2,'Kaishi[i] = 最大値('+blank('カ')+', '+blank('キ')+')'),(9,2,'Shuryou[i] = '+blank('ク')),(10,1,'saichou = 0'),(11,1,'i を1からkyakusuまで1ずつ増やしながら繰り返す:'),(12,2,'saichou = 最大値('+blank('サ')+', '+blank('ケ')+' − '+blank('コ')+')'),(13,1,'もし '+blank('シ')+' ならば:'),(14,2,'表示する("体験時間", taiken, "分間：", "最長待ち時間", saichou, "分間")'),('2',1,''),('3',0,'')]
q.append(page(25,raw(25,75,150),raw(25,165,220),program('図3　最長待ち時間が10分間未満となる体験時間を調べるプログラム',prog)))
result=node('figure',class_='program-output source-frame');result.append(node('pre','体験時間1分間：最長待ち時間0分間\n体験時間2分間：最長待ち時間2分間\n体験時間3分間：最長待ち時間4分間\n体験時間4分間：最長待ち時間8分間'));result.append(node('figcaption','図4　図3のプログラムの実行結果'))
q.append(page(26,raw(26,75,170),result,raw(26,315,445),raw(26,445,485),choices('サ'),choices('シ')))
write(CURRENT,q)

CURRENT='q4';q=[]
dates=[['稚内','5月11日','5月3日','…','5月8日','5月6日','5月3日'],['旭川','5月2日','4月27日','…','4月29日','4月26日','4月25日'],['網走','5月7日','4月30日','…','5月6日','4月27日','4月28日'],['…','…','…','…','…','…','…'],['那覇','1月15日','1月15日','…','1月4日','1月11日','1月7日'],['南大東島','1月7日','1月15日','…','0','1月28日','2月7日']]
q.append(page(27,raw(27,75,97,tag='h2'),raw(27,110,150),raw(27,165,185,tag='h3'),raw(27,200,275),table('表1　桜の開花日',['観測点','2014年','2015年','…','2021年','2022年','2023年'],dates,classes='open-table'),raw(27,460,515),raw(27,532,552),raw(27,552,570),optiontable('ア',['A','B'],[['正','正'],['正','誤'],['誤','正'],['誤','誤']])))
q.append(page(28,raw(28,75,115),raw(28,135,215),raw(28,215,275),choices('イ'),choices('ウ')))
q.append(page(29,raw(29,75,115),raw(29,135,175),box(None,raw(29,205,225,tag='h4'),raw(29,225,245),raw(29,245,265,tag='h4'),raw(29,265,285)),raw(29,315,435),raw(29,435,535),raw(29,535,615)))
est=[['稚内','5月31日','5月21日','5月8日'],['旭川','5月26日','5月7日','4月29日'],['…','…','…','…'],['新潟','？','？','？'],['…','…','…','…'],['名古屋','3月19日','3月16日','3月17日'],['甲府','3月20日','3月14日','3月18日'],['…','…','…','…'],['奈良','？','？','？']]
dif=[['稚内','23','13'],['旭川','27','8'],['…','…','…'],['新潟','4','−1'],['…','…','…'],['名古屋',blank('エ'),blank('オ')],['甲府','2','−4'],['…','…','…'],['奈良','−1','−5']]
q.append(page(30,row(table('表2　開花推定日',['観測点','400度開花推定日','600度開花推定日','実際の開花日'],est,classes='open-table'),table('表3　開花差',['観測点','400度開花差','600度開花差'],dif,classes='open-table')),node('p','（表の一部を“？”で隠してある）',class_='table-note'),choices('エオ'),choices('カ')))
q.append(page(31,raw(31,75,95,tag='h3'),raw(31,110,165),fig(31,[65,181,455,382],'図1　緯度と開花差の散布図'),raw(31,385,402),raw(31,440,478),choices('キク')))
q.append(page(32,raw(32,75,112),raw(32,125,177),raw(32,175,245),fig(32,[145,255,369,348],'図2　400度開花差に関する箱ひげ図'),raw(32,385,470),choices('ケ'),choices('コサ')))
q.append(page(33,raw(33,75,115),raw(33,135,155),raw(33,155,255),raw(33,255,275,**{'class_':'formula'}),fig(33,[65,295,455,532],'図3　氷点下日数と400度開花差の散布図と回帰直線'),raw(33,575,655)))
q.append(page(34,box('補正方法',raw(34,105,145)),raw(34,175,215),raw(34,215,295),choices('シ'),choices('ス')))
write(CURRENT,q)
(OUT/'paragraph-source-ranges.json').write_text(json.dumps(SOURCES,ensure_ascii=False,indent=2)+'\n')

def audit():
 def normalized(text):
  return re.sub(r'[\s、，,]','',unicodedata.normalize('NFKC',text)).replace('−','-').replace('－','-').replace('(2)','2').replace('(16)','16').replace('₂','2')
 report=[];allpages=[]
 for sid in imp.SID:
  doc=html.fromstring('<div>'+(OUT/f'{sid}.html').read_text()+'</div>')
  pages=[];relocations=[];unmatched=[]
  for sec in doc:
   number=int(sec.get('data-source-page'));pages.append(number);allpages.append(number)
   content=normalized(''.join(sec.itertext()));clips=[imp.fitz.Rect([float(x) for x in f.get('data-pdf-clip').split()]) for f in sec.xpath('.//figure[@data-pdf-clip]')]
   for line in imp.page_data(DOC,DOC[number-1]):
    if max(c['size'] for c in line['chars'])<7 or any(c.contains((line['bbox'].tl+line['bbox'].br)/2) for c in clips):continue
    text=normalized(line['text'])
    if len(text)<=2 or text in content:continue
    if '配点' in line['text']:relocations.append({'page':number,'kind':'points moved into native section heading','source':line['text']})
    elif line['text']=='は，図の一部を⃞':relocations.append({'page':number,'kind':'source masking square represented by native hidden-label span','source':line['text']})
    else:unmatched.append({'page':number,'source':line['text']})
  assert not unmatched,unmatched
  assert not doc.xpath('.//*[@data-reading-units or @data-reading-for]')
  assert not doc.xpath('.//img|.//svg|.//object|.//embed|.//iframe')
  assert '解答群を文字で確認する' not in ''.join(doc.itertext())
  seen={x.get('data-field') for x in doc.xpath('.//*[@data-field]')}
  for f in doc.xpath('.//figure[@data-pdf-fields]'):seen.update(f.get('data-pdf-fields').split())
  assert seen=={f['id'] for f in FIELDS[sid].values()},(sid,seen)
  for f in FIELDS[sid].values():
   if f['type']=='choice':
    values={x.get('data-choice-value') for x in doc.xpath('.//*[@data-choice-fields]') if f['id'] in x.get('data-choice-fields').split()}
    assert values=={x['value'] for x in f['choices']},(f['id'],values)
  report.append({'section':sid,'sourcePages':pages,'fields':len(seen),'nativeTables':len(doc.xpath('.//table')),'nativePrograms':len(doc.xpath('.//figure[@class="program"]')),'diagramPlaceholders':len(doc.xpath('.//figure[@class="past-diagram"]')),'intentionalLayoutMoves':relocations,'unmatchedSourceLines':unmatched})
 assert sorted(allpages)==list(range(1,35)) and len(allpages)==34
 (OUT/'semantic-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
audit()
print('Wrote five semantic body fragments')
