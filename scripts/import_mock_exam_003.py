"""No.003 source adapter. Originals stay unchanged; catalog/publication is separate."""
from pathlib import Path
from lxml import html, etree
import base64, copy, hashlib, json, re, subprocess, unicodedata
from mock_exam_editorial import clean_screen_chrome, learner_wording, normalize_problem_typography
from mock_exam_002_tables import align_tables
from normalize_mock_exam_solutions import build as normalize_solutions

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'mock-exams/exams/003/1'
CIRCLES = '⓪①②③④⑤⑥⑦⑧⑨'
SPEC = [
 ('q1', '第1問', 20, 'Q1_003_problem.htm', 'Q1_003_answers.htm', '1.5.1',
  'アイウエオカキクケコサシ', '2031231B8233',
  [('ア',2,1),('イ',2,1),('ウ',2,2),('エ',1,2),('オ',1,2),('カ',2,2),('キ',2,3),('クケ',2,3),('コ',2,4),('サ',2,4),('シ',2,4)], 'クケ'),
 ('q2a', '第2問A', 15, 'Q2A_003_problem_v3.2.2.html', 'Q2A_003_answers_v3.2.2.html', '3.2.2',
  'アイウエオカキク', '12113120',
  [('ア',2,1),('イ',1,1),('ウ',2,2),('エ',2,2),('オ',2,3),('カ',2,3),('キ',2,4),('ク',2,4)], ''),
 ('q2b', '第2問B', 15, 'Q2B_003_problem_v2.1.1.html', 'Q2B_003_answers_v2.1.1.html', '2.1.1',
  'コサシスセソタ', '2532103',
  [('コサ',3,1),('シ',3,2),('ス',2,2),('セソ',3,3),('タ',4,3)], 'コサ'),
 ('q3', '第3問', 25, 'Q3_003_problem_v3.2.1.html', 'Q3_003_solution_v3.2.1.html', '3.2.1',
  'アイウエオカキクケコサシスセソタ', '3622130220122742',
  [('ア',1,1),('イ',2,1),('ウ',2,1),('エ',2,2),('オ',2,2),('カ',2,2),('キ',2,2),('ク',2,2),('ケ',2,3),('コ',1,3),('サ',1,3),('シ',2,3),('ス',1,3),('セソ',2,3),('タ',1,3)], 'アイウスセソ'),
 ('q4', '第4問', 25, 'Q4_003_problem_v1.3.2.html', 'Q4_003_explanation_v1.3.2.html', '1.3.2',
  'アイウエオカキクケコ', '2113020214',
  [('ア',2,1),('イ',2,1),('ウ',3,2),('エ',3,2),('オ',3,3),('カ',3,3),('キ',2,4),('ク',3,4),('ケコ',4,4)], ''),
]

def text(e): return ' '.join(e.text_content().split())
def one(d, path):
    es = d.xpath(path)
    assert len(es) == 1, (path, len(es))
    return es[0]
def cls(d, name): return d.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+name+' ")]')
def uid(sid,n): return f'{sid}-{n:02}'
def ids(sid,ns): return [uid(sid,n) for n in ns]
def anchor(e,sid,ns): e.set('data-reading-units',' '.join(ids(sid,ns)))
def tag(elements,sid,ns):
    for e in elements:
        values=e.get('data-reading-for','').split()+ids(sid,ns)
        e.set('data-reading-for',' '.join(dict.fromkeys(values)))
def group(parent,sid,ns,elements):
    s=etree.SubElement(parent,'section',{'class':'explanation-unit'})
    anchor(s,sid,ns)
    for e in elements: s.append(e)
    return s

def read(name):
    d=html.fromstring((OUT/'source'/name).read_bytes())
    for e in d.xpath('//script|//iframe|//object|//embed|//base|//form|//header|//footer'): e.drop_tree()
    for e in d.iter():
        if not isinstance(e.tag,str): continue
        for k in list(e.attrib):
            if k.lower().startswith('on') or (k in ('href','src') and e.get(k,'').strip().lower().startswith('javascript:')): del e.attrib[k]
        if e.tag=='style': e.text=re.sub(r'@font-face\s*\{[^}]*\}', '', e.text or '', flags=re.I)
        else:
            if e.text:e.text=learner_wording(e.text)
            if e.tail:e.tail=learner_wording(e.tail)
    return d

def options(fields,letters,elements,labels=None):
    assert elements,letters
    for i,e in enumerate(elements):
        e.set('data-choice-fields',' '.join(fields[c]['id'] for c in letters))
        e.set('data-choice-value',str(i))
        label=labels[i] if labels else re.sub(r'^[⓪①②③④⑤⑥⑦⑧⑨0-9]\s*','',text(e))
        for c in letters:fields[c]['choices'].append({'value':str(i),'text':label})

def bind(d,sid,fields):
    if sid=='q1':
        for letters,ol in zip(['ア','イ','ウ','コ','サ'],d.xpath('//ol')): options(fields,letters,ol.xpath('./li'))
        for letters,t in zip(['エオ','カ','キ','シ'],d.xpath('//table[contains(@class,"answer-table")]')): options(fields,letters,t.xpath('./tbody/tr'))
    elif sid=='q2a':
        for letters,ol in zip(['ア','イ','エ','オ','カ','キ','ク'],d.xpath('//ol')):options(fields,letters,ol.xpath('./li'))
        table=one(d,'//table');rows=table.xpath('./tr')
        # The source is transposed: one option per column, not per row.
        options(fields,'ウ',rows[0].xpath('./th')[1:],['p：正、q：正','p：正、q：誤','p：誤、q：正','p：誤、q：誤'])
    elif sid=='q2b':
        for letters,f in zip(['シ','ス','セ','ソ','タ'],d.xpath('//fieldset')):options(fields,letters,cls(f,'choice'))
    elif sid=='q3':
        for letters,f in zip(['エ','オ','カ','キ','ク','コサ','シ'],d.xpath('//fieldset')):options(fields,letters,cls(f,'option'))
        options(fields,'タ',cls(one(d,'//div[@class="direct-choices"]'),'option'))
        options(fields,'ケ',cls(d,'insert-row'),['すべての座席を調べる前','各行の座席を調べる前','各座席の候補クラスを調べる前','各候補クラスの残り人数を調べる前'])
    elif sid=='q4':
        for letters,ol in zip(['ア','イ','ウ','エ','オ','カ','キ','ク','ケコ'],d.xpath('//ol[contains(@class,"choices")]')):options(fields,letters,ol.xpath('./li'))
    for e in d.iter():
        if not isinstance(e.tag,str):continue
        if set(e.get('class','').split()) & {'blank','ref-box','mark','reference-blank'} and text(e) in fields:
            c=text(e);e.set('data-field',fields[c]['id']);e.set('data-original',c)
            if any('code' in a.get('class','').split() for a in e.iterancestors()):e.set('data-display','content')
        if set(e.get('class','').split()) & {'num','option-number','position-number'} and text(e) in list('0123456789'):
            e.text=CIRCLES[int(text(e))]
    for c,f in fields.items():
        assert d.xpath('//*[@data-field="'+f['id']+'"]'),(sid,c)
        assert f['type']=='text' or f['choices'],(sid,c,'choices')

def problem_reading(d,sid):
    if sid=='q1':
        pages=d.xpath('//body/section')
        specs=[([1],'//section[1]/p[2]'),([2],'//section[2]/p[1]'),([3],'//section[2]/p[last()]'),([4,5],'//section[4]/p[2]'),([6],'//section[4]/p[4]'),([7],'//section[5]/p[4]'),([8],'//section[6]/p[2]'),([9],'//section[6]/p[last()]'),([10],'//section[7]/p[2]'),([11],'//section[8]/p[2]')]
        for ns,path in specs:anchor(one(d,path),sid,ns)
        # Keep the model and rules available wherever a later subquestion uses them.
        tag([pages[0]],sid,[1]);tag(list(pages[1])[:2],sid,[2])
        tag(list(pages[1])[2:],sid,[3]);tag([pages[2]],sid,[4,5,6])
        tag(list(pages[3])[:3],sid,[4,5]);tag(list(pages[3])[3:],sid,[6])
        tag(list(pages[4])[:5],sid,[7,8]);tag(list(pages[4])[5:7],sid,[7]);tag(list(pages[4])[7:],sid,[8])
        tag(list(pages[5])[:3],sid,[8]);tag(list(pages[5])[3:],sid,[9])
        tag(list(pages[6])[:4],sid,[10,11]);tag(list(pages[6])[4:],sid,[10]);tag([pages[7]],sid,[11])
        # Figure 1 and the intended button behavior also define the later rules.
        tag(list(pages[5])[4:7],sid,[10,11])
    elif sid=='q2a':
        paths=['//section[2]/p[2]','//section[2]/p[3]','//section[3]/p[3]','//section[4]/p[3]','//section[5]/p[3]','//section[6]/p[1]','//section[7]/p[1]','//section[7]/p[2]']
        for n,p in enumerate(paths,1):anchor(one(d,p),sid,[n])
        pages=d.xpath('//body/section');tag([pages[0]],sid,range(1,9))
        tag(list(pages[1])[:2],sid,[1,2]);tag(list(pages[1])[2:4],sid,[1]);tag(list(pages[1])[4:],sid,[2])
        tag(list(pages[2])[:3],sid,[3,4]);tag(list(pages[2])[3:],sid,[3]);tag(list(pages[3])[:4],sid,[4])
        tag(list(pages[3])[4:],sid,[5,6]);tag(list(pages[4])[:3],sid,[5,6]);tag(list(pages[4])[3:],sid,[5])
        tag(list(pages[5])[:3],sid,[6]);tag(list(pages[5])[3:],sid,[7,8])
        tag(list(pages[6])[:2],sid,[7]);tag(list(pages[6])[2:],sid,[8])
    elif sid=='q2b':
        boxes=d.xpath('//section/div[@class="page-body"]')
        for ns,e in [([1],one(d,'//section[1]//p[@class="question"]')),([2],one(d,'//section[2]/div/p[3]')),([3],one(d,'//section[2]/div/p[4]')),([4],one(d,'//section[3]//table[contains(@class,"procedure")]')),([5],one(d,'//section[4]/div/p[last()]'))]:anchor(e,sid,ns)
        tag(list(boxes[0])[:-2],sid,range(1,6));tag(list(boxes[0])[-2:],sid,[1])
        tag(list(boxes[1])[:3],sid,[2,3]);tag(list(boxes[1])[3:5],sid,[2]);tag(list(boxes[1])[5:],sid,[3])
        tag(list(boxes[2])[:4],sid,[4,5]);tag(list(boxes[2])[4:],sid,[4]);tag(list(boxes[3]),sid,[5])
    elif sid=='q3':
        boxes=d.xpath('//section/div[@class="page-body"]')
        anchor(one(d,'//section[1]/div/p[5]'),sid,[1,2]);anchor(one(d,'//section[1]/div/p[6]'),sid,[3])
        for n,fs in zip(range(4,9),d.xpath('//fieldset')[:5]):anchor(fs,sid,[n])
        anchor(one(d,'//section[5]//figure[contains(@class,"program")]'),sid,[9])
        anchor(d.xpath('//fieldset')[5],sid,[10,11]);anchor(d.xpath('//fieldset')[6],sid,[12])
        for n,p in zip([13,14,15],d.xpath('//section[6]/div/p[position()>2]')):anchor(p,sid,[n])
        tag(list(boxes[0]),sid,range(1,16))
        tag(list(boxes[1])[:3],sid,[4]);tag(list(boxes[1])[3:],sid,range(5,16))
        tag(list(boxes[2])[:4],sid,range(5,16))
        for n,f in zip(range(5,9),d.xpath('//fieldset')[1:5]):tag([f],sid,[n])
        tag(list(boxes[3]),sid,range(9,16));tag(list(boxes[4]),sid,range(9,16));tag(list(boxes[5]),sid,range(13,16))
    elif sid=='q4':
        keys=['q1a','q1b','q2a','q2b2','q3a','q3b','q4a','q4c','q4b']
        articles=d.xpath('//article')
        for n,key in enumerate(keys,1):
            e=d.get_element_by_id(key);anchor(e,sid,[n]);tag([e],sid,[n])
        tag(articles[0].xpath('./p|./h1'),sid,range(1,10))
        tag([d.get_element_by_id('fig1')],sid,[1])
        tag(articles[1].xpath('./p|./h2')+[d.get_element_by_id('fig2')],sid,range(3,10))
        tag(articles[3].xpath('./p|./div'),sid,[4])
        tag(articles[4].xpath('./p'),sid,range(6,10))
        tag([d.get_element_by_id('fig3')],sid,range(6,10))
        tag(articles[6].xpath('./p|./h2|./figure'),sid,range(7,10))

def solution(d,sid):
    body=d.find('body')
    if sid=='q1':
        pages=d.xpath('//body/section');pages[0].drop_tree()
        sources=pages[-1];sources.getparent().remove(sources)
        # Keep source credit, not the author's design/review notes or exam links.
        refs=etree.Element('section',{'class':'sources'});etree.SubElement(refs,'h2').text='出典'
        for e in sources.xpath('.//a'):
            if not any(s in text(e) for s in ['大学入試センター','教員研修','学習指導要領']):
                p=etree.SubElement(refs,'p');p.append(e)
        for e in d.xpath('//body/section/h1'):e.drop_tree()
        for e in d.xpath('//p[starts-with(normalize-space(),"方法Xは不要な再送") or starts-with(normalize-space(),"本問のルールは") or starts-with(normalize-space(),"「画像は全て説明")]'):e.drop_tree()
        # Snapshot semantic subquestion boundaries before moving children.
        groups=[]
        for page in d.xpath('//body/section'):
            current=[]
            for e in list(page):
                if e.tag=='h2' and current:groups.append(current);current=[]
                current.append(e)
            if current:groups.append(current)
        for page in list(body):body.remove(page)
        for ns,els in zip([[1],[2],[3],[4,5],[6],[7],[8],[9],[10],[11]],groups):
            if els[0].tag=='h2':els=els[1:]
            group(body,sid,ns,els)
        body.append(refs)
    elif sid=='q2a':
        paragraphs=d.xpath('//body/section/p[starts-with(normalize-space(),"ア：") or starts-with(normalize-space(),"イ：") or starts-with(normalize-space(),"ウ：") or starts-with(normalize-space(),"エ：") or starts-with(normalize-space(),"オ：") or starts-with(normalize-space(),"カ：") or starts-with(normalize-space(),"キ：") or starts-with(normalize-space(),"ク：")]')
        assert len(paragraphs)==8
        for e in list(body):body.remove(e)
        for n,p in enumerate(paragraphs,1):
            p.text=re.sub(r'^[ア-ン]：','',p.text or '')
            # The source puts all rejected choices into one paragraph. Separate
            # them without changing the explanation or inventing new reasoning.
            correct=SPEC[1][7][n-1]
            matches=[m for m in re.finditer(r'[⓪①②③](?:・[⓪①②③])*[：は]',p.text or '')
                     if CIRCLES[int(correct)] not in m[0]]
            s=group(body,sid,[n],[p])
            if matches:
                value=p.text;p.text=value[:matches[0].start()]
                ol=etree.SubElement(s,'ol',{'class':'explanation-choices'})
                for i,m in enumerate(matches):
                    end=matches[i+1].start() if i+1<len(matches) else len(value)
                    li=etree.SubElement(ol,'li');etree.SubElement(li,'span',{'class':'num'}).text=m[0][:-1]
                    etree.SubElement(li,'div').text='（誤）'+value[m.end():end]
    elif sid=='q2b':
        main=one(d,'//main');old=list(main)
        for e in list(main):main.remove(e)
        group(main,sid,[1],old[7:12])
        group(main,sid,[2],old[13:21])
        group(main,sid,[3],old[22:26])
        group(main,sid,[4],old[28:36])
        group(main,sid,[5],old[37:42])
    elif sid=='q3':
        main=one(d,'//main');old=list(main)
        for e in list(main):main.remove(e)
        # Each audit table belongs with its relevant explanation, not a long appendix.
        group(main,sid,[1,2],old[6:8])
        p=etree.Element('p');p.text='1行目の左右の組は，1・2列目のクラス番号1と，3・4列目のクラス番号2の2組である。斜めや前後の席は，この設問で数える1行目の左右の組に含めない。'
        group(main,sid,[3],[p])
        group(main,sid,[4],old[9:11]+[old[38]])
        group(main,sid,[5],old[11:17]+[old[39]])
        for n,index in [(6,40),(7,41),(8,42)]:group(main,sid,[n],[old[index]])
        group(main,sid,[9],[old[18],old[48]])
        group(main,sid,[10,11],[old[19],old[43],old[44]])
        group(main,sid,[12],[old[20],old[21],old[22],old[45]])
        group(main,sid,[13],old[23:27])
        group(main,sid,[14],old[28:31])
        group(main,sid,[15],old[32:37]+[old[46]])
    elif sid=='q4':
        main=one(d,'//main');units=main.xpath('./section');assert len(units)==9
        for e in list(main):
            if e not in units:main.remove(e)
        for n,e in enumerate(units,1):
            for h in e.xpath('./h2'):h.drop_tree()
            anchor(e,sid,[n]);e.set('class','explanation-unit')
        sources=etree.SubElement(main,'section',{'class':'sources'})
        etree.SubElement(sources,'h2').text='出典・加工方法'
        p=etree.SubElement(sources,'p')
        p.text='Kuusisto, A., Latva, J., & Wilén, E. (2026), Food waste dataset: secondary school in Finland 2024–2025, v1, DOI:10.5281/zenodo.20825233, CC BY 4.0。日ごとの重量と利用人数から1人当たりの値を再計算した。重量の記録に不整合のある1日を除き，食べ残しは実施前135日・実施後19日，厨房・配膳も含む比較は両方の記録がある実施前134日・実施後19日を使用した。外れ値は除外していない。'
    main=d.xpath('//main')
    if main:
        main[0].set('class','solution')
    else:
        main=etree.Element('main',{'class':'solution'})
        for e in list(body):main.append(e)
        body.append(main)
    # Choice explanation tables: explicit correct/incorrect labels and column roles.
    for table in d.xpath('//table'):
        rows=table.xpath('.//tr');heading=' '.join(text(c) for c in rows[0]) if rows else ''
        if any(w in heading for w in ['選択肢','判断の根拠','正誤','誤りを判断','正しい理由']):
            for row in rows[1:]:
                cells=row.xpath('./td');
                if cells and text(cells[0]) in list('0123456789'):cells[0].text=CIRCLES[int(text(cells[0]))]
                if len(cells)>=2:
                    reason=cells[-1];reason.set('data-column-align','left')
                    value=text(reason)
                    if value.startswith('誤り。'):reason.text='（誤）'+value[3:]
                    elif value.startswith('正しい。'):reason.text='（正）'+value[4:]
    return d

def verdicts(d,sid,exam):
    units={u['id']:u for u in exam['scoring']}
    for group in d.xpath('//*[@data-reading-units]'):
        us=[units[u] for u in group.get('data-reading-units').split()]
        correct={CIRCLES[int(v)] for u in us for v in u['rule']['patterns'][0] if v.isdigit()}
        for li in group.xpath('.//ol[contains(concat(" ",normalize-space(@class)," ")," choices ")]/li'):
            if len(li)>=2:
                mark=text(li[0]);reason=li[1]
                reason.text=('（正）' if mark in correct else '（誤）')+(reason.text or '')
        for table in group.xpath('.//table'):
            rows=table.xpath('.//tr')
            if rows and any(w in text(rows[0]) for w in ['判断の根拠','正しい理由','の選択肢']):
                table_correct=correct
                if sid=='q2b' and text(rows[0]).startswith('セ'):table_correct={'①'}
                if sid=='q2b' and text(rows[0]).startswith('ソ'):table_correct={'⓪'}
                for row in rows[1:]:
                    cells=row.xpath('./td')
                    if len(cells)>=2 and text(cells[0]) in CIRCLES and not text(cells[-1]).startswith(('（正）','（誤）')):
                        cells[-1].text=('（正）' if text(cells[0]) in table_correct else '（誤）')+(cells[-1].text or '')

def images(d,screen):
    """Deduplicate the source's four 2.4MB copies of the same photograph."""
    from PIL import Image
    from io import BytesIO
    assets=OUT/'assets';assets.mkdir(exist_ok=True)
    for e in d.xpath('//*[local-name()="image"]'):
        for key,val in list(e.attrib.items()):
            if key.endswith('href') and val.startswith('data:image/'):
                data=base64.b64decode(val.split(',',1)[1]);name='photo-'+hashlib.sha256(data).hexdigest()[:12]+'.webp'
                target=assets/name
                if not target.exists():
                    im=Image.open(BytesIO(data));im.save(target,format='WEBP',lossless=True,method=6)
                e.set(key,('../' if screen else '')+'assets/'+name)

def studio(d):
    programs=cls(d,'program');assert len(programs)==3
    setup='gyosu = 4\nretsusu = 5\nclasssu = 4\n'
    initial='Zaseki = [[1, 1, 2, 2, 3], [1, 2, 1, 3, 2], [4, 1, 2, 1, 3], [1, 4, 3, 1, 2]]\n'
    reset='Ninzu = [8, 6, 4, 2]\nNokori = [8, 6, 4, 2]\nZaseki = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]\n'
    drafts=[]
    for n,program in zip([2,4,6],programs):
        lines=[]
        for row in cls(program,'code-row'):
            statement=one(row,'.//span[@class="statement"]')
            depth=len(cls(row,'scope-mark'))
            lines.append('  '*depth+text(statement).replace(' または ',' or ').replace(' かつ ',' and '))
        source=setup+(initial if n==2 else reset)+'\n'.join(lines)
        if n==2:source+='\n表示する(Ninzu)'
        drafts.append({'version':1,'title':f'No.003 第3問 完成した図{n}','source':source,'settings':{'indexBase':1,'inputs':{}}})
    result=subprocess.run(['node',str(ROOT/'scripts/mock_exam_studio_links.mjs')],input=json.dumps(drafts),text=True,capture_output=True)
    assert result.returncode==0,result.stderr
    for n,p,url in zip([2,4,6],programs,json.loads(result.stdout)):
        action=etree.Element('p',{'class':'studio-program-link'})
        a=etree.SubElement(action,'a',href=url,target='_blank',rel='noopener',**{'data-studio-program':f'q3-fig{n}'})
        a.text='トレースStudioで動かす ↗';p.addnext(action)
        if n==6:etree.SubElement(action,'small').text='条件式の「または」「かつ」は，Studioでは or・and と表示します。'
    return drafts

def build():
    (OUT/'screen').mkdir(exist_ok=True)
    exam={'schemaVersion':1,'id':'003','version':1,'title':'情報Ⅰ 実戦演習 No.003','durationSeconds':3600,'maxPoints':100,'sections':[],'fields':[],'scoring':[]}
    for sid,title,points,problem,answer,ver,letters,answers,units,numeric in SPEC:
        assert len(letters)==len(answers),(sid,letters,answers)
        fields={c:{'id':sid+'-'+c,'sectionId':sid,'label':c,'type':'text' if c in numeric else 'choice',**({'allowed':'0123456789ABCDEF' if sid=='q1' else '0123456789','maxLength':1} if c in numeric else {'choices':[]})} for c in letters}
        p=read(problem);bind(p,sid,fields);problem_reading(p,sid)
        s=solution(read(answer),sid)
        for n,(cs,score,question) in enumerate(units,1):
            exam['scoring'].append({'id':uid(sid,n),'sectionId':sid,'question':question,'fields':[fields[c]['id'] for c in cs],'maxPoints':score,'rule':{'kind':'unordered' if sid=='q4' and cs=='ケコ' else 'exact','patterns':[[answers[letters.index(c)] for c in cs]]}})
        exam['fields']+=list(fields.values())
        verdicts(s,sid,exam)
        if sid=='q2b':
            url=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/mock_exam_003_lab_links.mjs')],text=True))
            unit=one(s,'//*[@data-reading-units="q2b-04"]')
            action=etree.SubElement(unit,'p',{'class':'studio-program-link'})
            a=etree.SubElement(action,'a',href=url,target='_blank',rel='noopener',**{'data-flowchart-program':'q2b-method-c'})
            a.text='フローチャートラボで動かす ↗'
            etree.SubElement(action,'small').text='表2の最初の8分に方法Cを適用します。'
        for d in [p,s]:
            d.find('body').set('data-section',sid)
            for name in ['toolbar','site-bar','subject','all-required','foot','meta']:
                for e in cls(d,name):e.drop_tree()
            clean_screen_chrome(d)
        # Remove the paper-only A-F to circled-letter instruction, including nested spans.
        for e in p.xpath('//p[contains(.,"当てはまる文字がA")]'):e.drop_tree()
        if sid=='q2a':
            h=one(p,'//h1');h.text='第2問A';h.tag='h1'
            following=h.getnext();following.text='次の問い（問1～4）に答えよ。（配点15）'
            for child in list(following):following.remove(child)
            h.text+='　'+text(following);following.drop_tree()
        if sid=='q2b':
            h=one(p,'//section[1]/div/p[1]');h.tag='h1';h.text=re.sub(r'^B\s*','第2問B　',text(h))
        if sid=='q3':
            h=one(p,'//h1');h.text=unicodedata.normalize('NFKC',text(h))
            for child in list(h):h.remove(child)
            drafts=studio(s)
            (OUT/'source/studio-drafts.json').write_text(json.dumps(drafts,ensure_ascii=False,indent=2)+'\n')
        for e in p.iter():
            if isinstance(e.tag,str) and e.tag not in ('script','style') and e.text:
                e.text=re.sub(r'問[０-９]+',lambda m:unicodedata.normalize('NFKC',m[0]),e.text)
                e.text=e.text.replace('数字または文字をマークせよ。','数字または文字を答えよ。')
            if isinstance(e.tag,str) and e.tail:
                e.tail=e.tail.replace('数字または文字をマークせよ。','数字または文字を答えよ。')
        normalize_problem_typography(p,sid)
        for kind,document in [('problem',p),('solution',s)]:
            for screen in [False,True]:
                d=copy.deepcopy(document)
                if not screen:
                    for action in cls(d,'studio-program-link'):action.drop_tree()
                    if kind=='problem' and sid=='q2b':
                        one(d,'//*[@class="exam-section-number"]').text='B'
                images(d,screen)
                for b in d.xpath('//*[@data-field]'):
                    previous=b.getprevious()
                    if previous is None:b.getparent().text=(b.getparent().text or '').rstrip(' ')+' '
                    else:previous.tail=(previous.tail or '').rstrip(' ')+' '
                    b.tail=' '+(b.tail or '').lstrip(' ')
                align_tables(d)
                # Prose reasons remain left aligned even in terse rows.
                for table in d.xpath('//table'):
                    if any(w in text(table.xpath('.//tr')[0]) for w in ['判断の根拠','正誤','正しい理由','誤りを判断']):
                        for row in table.xpath('.//tr[position()>1]'):
                            if row.xpath('./td'):row.xpath('./td')[-1].set('data-column-align','left')
                head=d.find('head');etree.SubElement(head,'meta',name='robots',content='noindex, follow')
                etree.SubElement(head,'link',rel='stylesheet',href=('../../../../' if screen else '../../../')+'booklet.css')
                etree.SubElement(head,'link',rel='stylesheet',href='../no003.css' if screen else 'no003.css')
                target=(OUT/'screen' if screen else OUT)/(sid+('-solution' if kind=='solution' else '')+'.html')
                target.write_text('<!doctype html>\n'+html.tostring(d,encoding='unicode'))
        exam['sections'].append({'id':sid,'title':title,'maxPoints':points,'sourceVersion':ver,'problem':sid+'.html','solution':sid+'-solution.html','screenProblem':'screen/'+sid+'.html','screenSolution':'screen/'+sid+'-solution.html','sourceProblem':'source/'+problem,'sourceSolution':'source/'+answer,'sourceSha256':hashlib.sha256((OUT/'source'/problem).read_bytes()).hexdigest(),'solutionSha256':hashlib.sha256((OUT/'source'/answer).read_bytes()).hexdigest()})
    (OUT/'exam.json').write_text(json.dumps(exam,ensure_ascii=False,indent=2)+'\n')
    normalize_solutions([OUT/'exam.json'])
    assert sum(u['maxPoints'] for u in exam['scoring'])==100
    print(f'Imported No.003: {len(exam["fields"])} fields, {len(exam["scoring"])} units, 100 points. Catalog unchanged.')

if __name__=='__main__':build()
