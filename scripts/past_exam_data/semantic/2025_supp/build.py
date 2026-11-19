"""Rebuild meaning-based 2025 supplementary problem fragments from the reviewed original."""
from pathlib import Path
import sys, re, json, html as esc
from lxml import html, etree
import fitz

sys.dont_write_bytecode=True

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
import import_past_exams as importer

DOC=fitz.open(ROOT/'mock-exams/exams/2025Tuishi/1/source/problem.pdf')
DATA=json.loads((ROOT/'scripts/past_exam_data/2025_supp.json').read_text())
SECTIONS={s['id']:s for s in DATA['sections']}
CIRCLES='⓪①②③④⑤⑥⑦⑧⑨ⓐⓑⓒⓓ'
FIELDS={sid:{f['label']:dict(f,id=sid+'-'+f['label']) for f in s['fields']} for sid,s in SECTIONS.items()}
SID='q1'

def blank(label):
    return f'<span class="blank" data-field="{SID}-{label}" data-original="{label}">{label}</span>'

def text(page,start,end=None,exclude=()):
    """Join only explicitly selected source lines; page line wraps are not paragraph breaks."""
    pg=DOC[page-1];lines=importer.page_data(DOC,pg)
    boxes=importer.find_boxes(pg,lines,FIELDS[SID])
    out=[]
    for i in range(start,(end if end is not None else start)+1):
        if i in exclude:continue
        node=importer.line_html(lines[i],boxes,FIELDS[SID])
        for s in node.xpath('.//span[@class="blank"]'):
            s.attrib.pop('data-input-type',None)
        out.append((esc.escape(node.text or '')+''.join(etree.tostring(c,encoding='unicode',method='html') for c in node)))
    return ''.join(out).strip()

def para(page,start,end=None,exclude=(),klass=None):
    value=text(page,start,end,exclude)
    value=re.sub(r'^([ａｂ])',lambda m:'<strong class="subquestion-label">'+m.group(1)+'</strong>　',value)
    return f'<p'+(f' class="{klass}"' if klass else '')+'>'+value+'</p>'

def q(page,start,end):
    s=text(page,start,end)
    m=re.match(r'問([１２３４５1-5])',s)
    assert m,(page,s)
    num=int(m.group(1));return f'<h3 class="question-heading">問{num}</h3><p>{s[m.end():]}</p>'

def page(n,*parts):
    return f'<section class="page" data-source-page="{n}">\n'+ '\n'.join(parts)+'\n</section>'

def fig(n,clip,caption):
    return f'<figure class="past-diagram" data-pdf-page="{n}" data-pdf-clip="{clip}"><figcaption>{caption}</figcaption></figure>'

def row(*figures):return '<div class="figure-row">'+''.join(figures)+'</div>'

def choices(labels,legend=None):
    labs=labels.split();options=FIELDS[SID][labs[0]]['choices']
    for lab in labs:assert FIELDS[SID][lab]['choices']==options
    out=['<fieldset class="choices"><legend>'+ (legend or '・'.join(labs)+'の解答群')+'</legend><div class="choice-grid">']
    for o in options:
        value=o['value'].upper();desc=esc.escape(o['text'])
        if SID=='q2a' and labs==['オ']:
            desc=desc.replace('脆弱','<ruby>脆弱<rt>ぜいじゃく</rt></ruby>').replace('漏洩','<ruby>漏洩<rt>ろうえい</rt></ruby>')
        if SID=='q3':desc='<code>'+desc+'</code>'
        out.append(f'<div class="option" data-choice-fields="'+ ' '.join(SID+'-'+lab for lab in labs)+f'" data-choice-value="{value}"><span class="option-number">{CIRCLES[int(value,16)]}</span><span class="option-text">{desc}</span></div>')
    out.append('</div></fieldset>');return ''.join(out)

def choice_table(labels,headers,rows,legend=None):
    labs=labels.split();out=['<fieldset class="choices"><legend>'+(legend or '・'.join(labs)+'の解答群')+'</legend><div class="table-wrap"><table class="choice-table"><thead><tr><th scope="col">選択肢</th>']
    out += ['<th scope="col">'+h+'</th>' for h in headers]
    out.append('</tr></thead><tbody>')
    for i,cells in enumerate(rows):
        value='0123456789ABCD'[i]
        out.append('<tr class="option" data-choice-fields="'+' '.join(SID+'-'+lab for lab in labs)+f'" data-choice-value="{value}"><th scope="row"><span class="option-number">{CIRCLES[i]}</span></th>')
        out.extend('<td class="option-text">'+str(c)+'</td>' for c in cells)
        out.append('</tr>')
    out.append('</tbody></table></div></fieldset>');return ''.join(out)

def table(caption,headers,rows,classes=''):
    out=['<div class="table-wrap"><table class="'+classes+'"><caption>'+caption+'</caption><thead><tr>']
    out.extend('<th scope="col">'+x+'</th>' for x in headers)
    out.append('</tr></thead><tbody>')
    for cells in rows:
        if cells is None:
            out.append(f'<tr class="omitted"><td colspan="{len(headers)}" aria-label="途中の行を省略">⋮</td></tr>');continue
        out.append('<tr>')
        out.extend('<td>'+str(c)+'</td>' for c in cells);out.append('</tr>')
    out.append('</tbody></table></div>');return ''.join(out)

def program(caption,lines,depths,highlight=None):
    assert len(lines)==len(depths)
    out=['<figure class="program"><div class="code">']
    for i,(src,depth) in enumerate(zip(lines,depths),1):
        hi=' data-source-box="reused"' if highlight and i in highlight else ''
        classes='code-row'
        if highlight and i==min(highlight):classes+=' source-box-first'
        if highlight and i==max(highlight):classes+=' source-box-last'
        out.append(f'<div class="{classes}" data-depth="{depth}"{hi}><span class="ln">({i:02})</span><span class="src">{src}</span></div>')
    out.append('</div><figcaption>'+caption+'</figcaption></figure>');return ''.join(out)

def write(sid,pages):
    result='\n'.join(pages)+'\n'
    result=result.replace('km２','km<sup>2</sup>')
    (HERE/f'{sid}.html').write_text(result)

# 第1問: all prose is selected by semantic paragraph, with choices/table text replacing OCR.
SID='q1'
ramen='''<div class="table-wrap"><table><caption>表3　ラーメンのスープ・麺の太さ・トッピングを指定する数値</caption>
<thead><tr><th scope="col"></th><th scope="col">数値</th><th scope="col">注文内容</th><th scope="col">備考</th></tr></thead><tbody>
<tr><th scope="rowgroup" rowspan="4">スープ</th><td>1000</td><td>しょうゆ</td><td rowspan="4">必ず一つ選択される</td></tr>
<tr><td>2000</td><td>みそ</td></tr><tr><td>3000</td><td>しお</td></tr><tr><td>4000</td><td>とんこつ</td></tr>
<tr><th scope="rowgroup" rowspan="3">麺の太さ</th><td>100</td><td>普通麺</td><td rowspan="3">必ず一つ選択される</td></tr>
<tr><td>200</td><td>細麺</td></tr><tr><td>300</td><td>太麺</td></tr>
<tr><th scope="rowgroup" rowspan="4">トッピング</th><td>1</td><td>玉子</td><td rowspan="4">複数種類選択可能<br>（選択なしも可）</td></tr>
<tr><td>2</td><td>コーン</td></tr><tr><td>？</td><td>のり</td></tr><tr><td>？</td><td>メンマ</td></tr>
</tbody></table></div>'''
write(SID,[
 page(1,'<p class="exam-subject">情報Ⅰ（全問必答）</p>','<h2>第1問</h2>','<p>次の問い（問1～4）に答えよ。（配点20）</p>',q(1,10,10),para(1,11,14),choices('ア','問1 aの選択肢')),
 page(2,para(2,0,3),choices('イ','問1 bの選択肢'),row(fig(2,'126 317 231 420','図1'),fig(2,'256 317 391 420','図2'))),
 page(3,q(3,0,5),para(3,6,12).replace('２k ×２k','2<sup>k</sup>×2<sup>k</sup>'),para(3,13,23),fig(3,'130 456 416 579','図3　極地方を除いた地球表面を正方形で表す地図（左，レベル0のタイル）と，これを4分割したうちの一つの範囲の地図（右，レベル1のタイル）')),
 page(4,fig(4,'130 75 395 260','図4　地図データの分割方法'),choices('ウ'),choices('エ')),
 page(5,q(5,0,5),para(5,6,9),para(5,10,19),para(5,20,25),para(5,26,35)),
 page(6,table('表1　ホワイトボードで管理している施設表（一部抜粋）',['＜日付＞','＜野球場＞','＜グラウンド＞','＜体育館＞','＜武道場＞'],[
 ['7月1日','軟式野球部','サッカー部','',''],['7月2日','','','バドミントン部','剣道部'],['7月3日','硬式野球部','陸上部','バレーボール部',''],['7月4日','','サッカー部','ダンス部','柔道部'],None,['7月31日','硬式野球部','硬式野球部','卓球部','柔道部']]),
 table('表2　コンピュータで管理することを想定した施設表（一部抜粋）',['＜日付＞','＜施設＞','＜部活動団体＞'],[['7月15日','体育館','バレーボール部'],['7月2日','武道場','剣道部'],['7月18日','野球場','軟式野球部'],None,['7月15日','グラウンド','サッカー部'],['7月2日','体育館','バドミントン部']]),choices('オ キ'),choices('カ ク')),
 page(7,q(7,0,0),para(7,1,10,exclude=(4,)).replace('厨房','<ruby>厨房<rt>ちゅうぼう</rt></ruby>',1),ramen,para(7,45,45)),
 page(8,para(8,0,3),choice_table('ケ',['玉子','コーン','のり','メンマ'],[['1','2','3','4'],['1','2','3','6'],['1','2','4','8'],['1','2','98','99']],'問4 aの選択肢'),para(8,29,34),choices('コ'))
])

# 第2問A: dialogue turns and privacy-policy lists stay semantic and selectable.
SID='q2a'
security_turn=para(9,23,27).replace('(A)パスワードと認証コードの二つ','<span class="source-reference">(A)</span><u>パスワードと認証コードの二つ</u>').replace('(B)会員証も不正利用を抑制する対策','<span class="source-reference">(B)</span><u>会員証も不正利用を抑制する対策</u>')
privacy_turn=para(9,28,30).replace('(C)個人情報保護の方針','<span class="source-reference">(C)</span><u>個人情報保護の方針</u>')
policy='''<aside class="source-document note-box source-frame"><h4>ファンクラブ　個人情報保護の方針（プライバシーポリシー）</h4>
<ul><li>当社が収集した個人情報の利用目的は，以下のとおりです。<ul><li>ファンクラブにおけるイベントの運営，および，サービスに関する告知のため。</li><li>会員の属性を分析し，それに応じたサービスの改善を行うため。</li><li>会員に対して物品や書類などの発送を行うため。</li></ul></li><li>当社は，収集した個人情報を第三者に提供しません。ただし，利用目的の達成のために必要な範囲において業務を委託する場合は，この限りではありません。</li></ul></aside>'''
write(SID,[
 page(9,'<h2>第2問</h2>','<p>次の問い（A・B）に答えよ。（配点30）</p>','<h3>A</h3>',para(9,4,4),para(9,5,8),para(9,9,13),para(9,14,18),para(9,19,19),para(9,20,22),security_turn,privacy_turn),
 page(10,q(10,0,5),choices('ア イ')),
 page(11,q(11,0,2),choices('ウ')),
 page(12,q(12,0,1),para(12,2,8),choice_table('エ',['パスワード','認証コード'],[['知識認証','所有物認証'],['知識認証','生体認証'],['所有物認証','知識認証'],['所有物認証','生体認証'],['生体認証','知識認証'],['生体認証','所有物認証']]),para(12,29,32),choices('オ')),
 page(13,q(13,0,4),choices('カ')),
 page(14,q(14,0,5),policy,para(14,18,18),para(14,19,20),para(14,21,22),para(14,23,24),choice_table('キ',['Ⅰ','Ⅱ','Ⅲ'],[['〇','〇','〇'],['〇','〇','×'],['〇','×','〇'],['×','〇','〇'],['〇','×','×'],['×','〇','×'],['×','×','〇'],['×','×','×']]))
])

# 第2問B: wall grids remain diagrams; dialogue crosses page boundaries without OCR columns.
SID='q2b'
write(SID,[
 page(15,'<h3>B</h3>',para(15,1,1),para(15,2,4),fig(15,'132 193 402 342','図1　迷路を使ったゲーム'),q(15,12,18),para(15,19,21),para(15,22,24),para(15,25,28)),
 page(16,para(16,0,2,klass='dialogue-continuation'),para(16,3,6),para(16,7,9),para(16,10,18),row(fig(16,'73 327 243 402','図2　Sさんの方法による表現'),fig(16,'254 327 450 402','図3　Tさんの方法による表現（一部を“？”で隠してある）')),choices('ケ'),choices('コ サ')),
 page(17,q(17,0,6),para(17,7,10),row(fig(17,'72 247 283 407','図4　財宝とCOMの追加'),fig(17,'296 258 443 407','図5　財宝へ向かう方向の表現（作成途中）')),para(17,42,44),para(17,45,48).replace('財宝への行き方は１通りになるように作ってある','<strong>財宝への行き方は1通りになるように作ってある</strong>'),para(17,49,49),para(17,50,51)),
 page(18,para(18,0,21,exclude=(1,2,3,4,5,7,8,9,10,11,12,14,15,16,17,19,20),klass='dialogue-continuation'),fig(18,'285 75 449 150','図2　Sさんの方法による表現（再掲）'),para(18,23,32),para(18,33,34),para(18,35,40),para(18,41,43),choices('ス'),choices('セ'))
])

# 第3問: native arrays and editable native programs, never a PDF excerpt.
SID='q3'
arrays1=table('図1　ごみ拾いの結果を格納する配列（入力途中の例）',['添字','1','2','3','4','5','…','40'],[
 ['<code>Iremono</code>','2','','1','1','','…','2'],['<code>Shurui</code>','1','','2','1','','…','2'],['<code>Keiryou</code>','112','','717','1206','','…','401']]).replace('<table>','<table class="array-table">')
arrays3=table('図3　ごみ拾いの結果がすべて格納された配列',['添字','1','2','3','4','5','…','40'],[
 ['<code>Iremono</code>','2','1','1','1','2','…','2'],['<code>Shurui</code>','1','2','2','1','1','…','2'],['<code>Keiryou</code>','112','1224','717','1206','303','…','401']]).replace('<table>','<table class="array-table">')
p2=program('図2　一人分のごみ拾いの結果を各配列に格納するプログラム',[
 '表示する("生徒の出席番号は？")','n =【整数を入力】','表示する("ごみの入れ物は？　バケツ:1　ごみ袋:2")','Iremono[n] =【整数を入力】','表示する("ごみの種類は？　可燃ごみ:1　不燃ごみ:2")',blank('ア')+' =【整数を入力】','表示する("計量結果（g）は？")',blank('イ')+' =【整数を入力】'],[0]*8)
p4=program('図4　ごみの種類ごとの総重量を集計し表示するプログラム',[
 'ninzu = 40','kanen = 0, funen = 0','i を1から '+blank('ウ')+' まで1ずつ増やしながら繰り返す:','もし '+blank('エ')+' ならば:','gomi = Keiryou[i] − 350','そうでなければ:','gomi = Keiryou[i]','もし '+blank('オ')+' ならば:','kanen = '+blank('カ')+' + gomi','そうでなければ:','funen = '+blank('キ')+' + gomi','表示する("可燃ごみの総重量は", kanen, "g")','表示する("不燃ごみの総重量は", funen, "g")'],[0,0,0,1,2,1,2,1,2,1,2,0,0])
names='Namae = ["可燃ごみ", "不燃ごみ", "ペットボトル",<br>         "かん", "びん", "金属", "落ち葉"]'
p5=program('図5　図2の(05)・(06)行目の代わりとなるプログラム',[
 names,'shuruisu = 7','表示する("ごみの種類の名称は？")','meishou =【文字列を入力】','j を1から '+blank('ク')+' まで1ずつ増やしながら繰り返す:','もし Namae[j] == meishou ならば:',blank('ア')+' = '+blank('ケ')],[0,0,0,0,0,1,2])
p6=program('図6　図4を変更したプログラム',[
 'ninzu = 40',names,'shuruisu = 7','Goukei = [0, 0, 0, 0, 0, 0, 0]','i を1から '+blank('ウ')+' まで1ずつ増やしながら繰り返す:','もし '+blank('エ')+' ならば:','gomi = Keiryou[i] − 350','そうでなければ:','gomi = Keiryou[i]','s = '+blank('コ'),'Goukei[s] = '+blank('サ')+' + gomi','j を1から '+blank('ク')+' まで1ずつ増やしながら繰り返す:','表示する('+blank('シ')+', "の総重量は", '+blank('ス')+', "g")'],[0,0,0,0,0,1,2,1,2,1,1,0,1],highlight=range(5,10))
write(SID,[
 page(19,'<h2>第3問</h2>','<p>次の文章を読み，後の問い（問1～3）に答えよ。（配点25）</p>',para(19,3,8),para(19,9,12),q(19,13,18),para(19,19,23),arrays1),
 page(20,para(20,0,3),para(20,4,7),p2,choices('ア イ')),
 page(21,q(21,0,5),para(21,6,10),para(21,11,14),arrays3,para(21,59,66)),
 page(22,p4,choices('ウ カ キ'),choices('エ オ')),
 page(23,q(23,0,5),para(23,6,10),para(23,11,17),p5,para(23,39,44)),
 page(24,p6,choices('ク ケ'),choices('コ サ シ ス'))
])

# 第4問: data tables are HTML, plots are cropped diagrams with separate native captions.
SID='q4'
pop_table=table('表1　都道府県の各年齢層の人口，面積，病院数',['番号','都道府県','総人口（万人）','15歳未満人口（万人）','15～64歳人口（万人）','65歳以上人口（万人）','面積（km²）','病院数（施設）'],[
 ['1','北海道','518.3','54.4','295.3','168.6','22699.20','3830'],['2','青森県','122.2','12.7','67.6','41.9','3253.17','939'],['3','岩手県','119.7','12.9','65.9','40.9','3751.37','954'],['4','宮城県','229.0','26.4','137.1','65.5','3185.91','1795'],['5','秋田県','94.5','9.0','49.5','36.0','3233.29','855'],None,['47','沖縄県','146.8','24.2','88.7','33.9','1126.13','967']],classes='open-table')
correlation=table('表2　各年齢層の人口と病院数との相関係数',['','15歳未満人口','15～64歳人口','65歳以上人口','病院数'],[
 ['15歳未満人口','1','','',''],['15～64歳人口','0.99','1','',''],['65歳以上人口','0.99','0.98','1',''],['病院数','0.97','0.98','0.95','1']],classes='open-table')
def symbols(s):
    # These letters name alternatives inside the prose; only the katakana field is scored.
    return re.sub(r'([ＡＢＣＤ])',r'<span class="symbol-placeholder">\1</span>',s)
write(SID,[
 page(25,'<h2>第4問</h2>','<p>次の文章を読み，後の問い（問1～5）に答えよ。（配点25）</p>',para(25,3,7),pop_table,para(25,70,70),para(25,71,72)),
 page(26,q(26,0,5),para(26,6,8),correlation,para(26,29,35),choices('ア'),choices('イ')),
 page(27,q(27,0,0),para(27,1,5).replace('高齢化','<strong>高齢化</strong>').replace('散布図行列と呼ぶ','<strong>散布図行列</strong>と呼ぶ'),para(27,6,10),fig(27,'140 334 377 581','図1　Sさんが作成した散布図行列')),
 page(28,para(28,0,4),para(28,5,8),choices('ウ'),symbols(para(28,19,26)),symbols(para(28,27,35)),choice_table('エ',['A','B'],[['少なく','少なく'],['少なく','多く'],['多く','少なく'],['多く','多く']])) ,
 page(29,symbols(q(29,0,6)),para(29,7,10),para(29,11,14).replace('人口密度','<strong>人口密度</strong>').replace('過疎・過密','<strong>過疎・過密</strong>'),fig(29,'113 295 401 584','図2　「人口密度」を含めた散布図行列')),
 page(30,para(30,0,0),'<aside class="hypothesis note-box source-frame"><h4>仮説</h4>'+symbols(para(30,2,8))+'</aside>',choice_table('オ',['C','D'],[['過密化','多く'],['過密化','少なく'],['過疎化','多く'],['過疎化','少なく']])) ,
 page(31,q(31,0,5),para(31,6,14),para(31,15,19),fig(31,'127 335 393 610','図3　「人口密度」でグループ分けした散布図')),
 page(32,choices('カ'),choices('キ'),choices('ク')),
 page(33,q(33,0,3),para(33,4,9),para(33,10,10,klass='equation'),para(33,11,15),fig(33,'117 308 401 565','図4　「人口密度」と「病院/面積」の散布図と回帰直線'),choices('ケ'))
])

# Semantic source validation (does not alter answers, scoring, or other source assets).
for sid,section in SECTIONS.items():
    fragment=html.fromstring('<main>'+(HERE/f'{sid}.html').read_text()+'</main>')
    actual={n.get('data-field') for n in fragment.xpath('.//*[@data-field]')}
    expected={sid+'-'+f['label'] for f in section['fields']}
    assert actual==expected,(sid,expected-actual,actual-expected)
    for f in section['fields']:
        opts=fragment.xpath('.//*[@data-choice-fields]')
        bound=[n for n in opts if sid+'-'+f['label'] in n.get('data-choice-fields').split()]
        if f['type']=='choice':assert sorted(n.get('data-choice-value') for n in bound)==sorted(c['value'].upper() for c in f['choices']),(sid,f['label'])
        else:assert not bound
    assert not fragment.xpath('.//*[@data-reading-units or @data-reading-for]')
    assert not fragment.xpath('.//img|.//svg|.//details')
    assert not fragment.xpath('.//p[contains(@class,"past-line")]')
print('Wrote 5 fragments; all 47 fields, including 44 choice fields, bind to the unchanged reviewed definition.')
