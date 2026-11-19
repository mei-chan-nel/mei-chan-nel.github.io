"""Reviewed, semantic source pages for licensed past papers.

PDF coordinates are used only for genuine diagrams/photos. Prose, choices,
programs, tables and captions are authored HTML in past_exam_data/semantic/.
"""
from pathlib import Path
import copy, hashlib, re, json
import unicodedata
import fitz
from lxml import html, etree

ROOT = Path(__file__).resolve().parent / 'past_exam_data/semantic'
CHOICE_HEADINGS=json.loads((ROOT.parent/'choice-headings.json').read_text())


def add_class(node, name):
    node.set('class', ' '.join(dict.fromkeys(node.get('class', '').split() + [name])))


def program_scopes(document):
    for code in document.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," code ")]'):
        rows = code.xpath('./*[contains(concat(" ",normalize-space(@class)," ")," code-row ")]')
        for index, row in enumerate(rows):
            source = row.find("span[@class='src']")
            if source is None or source.find("span[@class='scope-prefix']") is not None:
                continue
            depth = int(row.get('data-depth', 0))
            next_depth = int(rows[index+1].get('data-depth', 0)) if index+1 < len(rows) else 0
            prefix = etree.Element('span', {'class':'scope-prefix','aria-hidden':'true'})
            for level in range(1, depth+1):
                mark = etree.SubElement(prefix, 'span', {'class':'scope-mark' + (' is-end' if level > next_depth else '')})
                etree.SubElement(mark, 'i')
            statement = etree.Element('span', {'class':'statement'})
            statement.text = source.text
            source.text = None
            for child in list(source):
                statement.append(child)
            source.append(prefix)
            source.append(statement)


def load_pages(doc, key, sid, fields, folder, page_data, find_boxes):
    path = ROOT / key / (sid + '.html')
    if not path.is_file():
        raise FileNotFoundError(f'Semantic source required: {path}')
    container = html.fragment_fromstring(path.read_text(encoding='utf-8'), create_parent='div')
    pages = container.xpath('./section[contains(concat(" ",normalize-space(@class)," ")," page ")]')
    if not pages or len(pages) != len(container):
        raise ValueError(f'Expected original-page sections: {path}')
    page_numbers = [int(p.get('data-source-page')) for p in pages]
    if page_numbers != sorted(set(page_numbers)):
        raise ValueError(f'Duplicate/out-of-order original pages: {path}')
    by_id = {f['id']: f for f in fields.values()}
    translation = str.maketrans('０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ','0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
    for page in pages:
        for node in page.iter():
            if node.text: node.text = node.text.translate(translation)
            if node.tail: node.tail = node.tail.translate(translation)
        headings=CHOICE_HEADINGS[key].get(page.get('data-source-page'),[])
        used=set()
        for group in page.xpath('.//fieldset[contains(concat(" ",normalize-space(@class)," ")," choices ")]'):
            labels={fid.split('-',1)[1] for e in group.xpath('.//*[@data-choice-fields]') for fid in e.get('data-choice-fields').split()}
            matches=[(i,h) for i,h in enumerate(headings) if labels.intersection(h['labels'])]
            legend=group.find('legend')
            if matches:
                if len(matches)!=1:raise ValueError((key,sid,labels,'Ambiguous original heading'))
                index,heading=matches[0];used.add(index)
                if legend is None:legend=etree.Element('legend');group.insert(0,legend)
                legend.clear()
                for char in heading['title']:
                    if char in fields:
                        f=fields[char];node=etree.SubElement(legend,'span',{'class':'blank','data-field':f['id'],'data-original':char});node.text=char
                    elif len(legend):legend[-1].tail=(legend[-1].tail or '')+char
                    else:legend.text=(legend.text or '')+char
                group.set('data-choice-presentation','named')
            else:
                if legend is not None:group.remove(legend)
                group.tag='div';add_class(group,'inline-choices');group.set('data-choice-presentation','inline')
                group.set('role','group');group.set('aria-label','選択肢')
        if used!=set(range(len(headings))):raise ValueError((key,sid,page.get('data-source-page'),'Unmatched original heading',set(range(len(headings)))-used))
        for old in page.xpath('.//*[@data-reading-units or @data-reading-for]'):
            old.attrib.pop('data-reading-units', None)
            old.attrib.pop('data-reading-for', None)
        for node in page.xpath('.//*[@data-field]'):
            field = by_id[node.get('data-field')]
            node.set('data-input-type', field['type'])
            node.set('data-original', field['label'])
            node.set('aria-label', '空欄' + field['label'])
        for node in page.xpath('./p|./h1|./h2|./h3'):
            text = ''.join(node.itertext()).strip()
            if re.match(r'^問\s*[0-9０-９]+', text):
                add_class(node, 'exam-question')
                if not node.xpath('.//*[@data-question-number]'):
                    match = re.match(r'^(問\s*[0-9０-９]+)([\s　]*)', node.text or '')
                    if match:
                        label = etree.Element('strong', {'data-question-number':'true'})
                        label.text = unicodedata.normalize('NFKC', match[1])
                        label.tail = '　' + (node.text or '')[match.end():]
                        node.text = None
                        node.insert(0, label)
        for node in page.xpath('./p|./h1|./h2|./h3'):
            text = ''.join(node.itertext()).strip()
            if re.match(r'^第[1-4]問', text) and node.text:
                match = re.match(r'^(第[1-4]問)([\s　]*)', node.text)
                if match:
                    label = etree.Element('strong');label.text = match[1]
                    label.tail = '　' + node.text[match.end():]
                    node.text = None;node.insert(0,label);add_class(node,'exam-section-heading')
            if re.match(r'^[a-c](?=[\s　]|次)', text) and node.text:
                match = re.match(r'^([a-c])([\s　]*)', node.text)
                label = etree.Element('span',{'class':'subquestion-label'});label.text=match[1]
                label.tail='　'+node.text[match.end():];node.text=None;node.insert(0,label)
        for cell in page.xpath('.//td'):
            value=''.join(cell.itertext()).strip()
            if len(value)>12 and re.search(r'[ぁ-んァ-ヶ一-龯]',value):add_class(cell,'text-cell')
        for fieldset in page.xpath('.//fieldset[contains(concat(" ",normalize-space(@class)," ")," choices ")]'):
            texts=fieldset.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," option-text ")]')
            if texts and all(sum(2 if ord(c)>255 else 1 for c in ''.join(e.itertext()).strip())<=32 for e in texts) and not fieldset.xpath('.//figure'):
                add_class(fieldset,'compact-choices')
            if texts and all(sum(2 if ord(c)>255 else 1 for c in ''.join(e.itertext()).strip())<=50 for e in texts) and not fieldset.xpath('.//figure'):
                add_class(fieldset,'print-compact-choices')
            if len(fieldset.xpath('.//figure'))>1:
                add_class(fieldset,'graphic-choices')
        for node in page.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," code ")]//*[@data-field]'):
            if by_id[node.get('data-field')]['type']=='choice':node.set('data-display','content')
        for figure in page.xpath('.//figure[@data-pdf-clip]'):
            page_number = int(figure.get('data-pdf-page', page.get('data-source-page')))
            source_page = doc[page_number-1]
            box = fitz.Rect([float(v) for v in re.split(r'[\s,]+', figure.get('data-pdf-clip').strip())])
            if not source_page.rect.contains(box) or box.is_empty:
                raise ValueError(f'Invalid diagram clip: {key}/{sid}/{page_number}/{box}')
            # Captions belong in native text, never inside the diagram bitmap.
            caption = figure.find('figcaption')
            if caption is not None:
                caption_label = re.match(r'^[図表]\s*[0-9０-９]+', ''.join(caption.itertext()).strip())
                if caption_label:
                    label = re.sub(r'\s', '', caption_label[0])
                    for line in page_data(doc, source_page):
                        if re.sub(r'\s', '', line['text']).startswith(label):
                            center = (line['bbox'].tl + line['bbox'].br) / 2
                            if box.contains(center):
                                raise ValueError(f'Caption inside diagram crop: {key}/{sid}/{page_number}: {line["text"]}')
            wanted = set(figure.get('data-pdf-fields', '').split())
            unknown = wanted - set(by_id)
            if unknown:
                raise ValueError(f'Unknown diagram fields: {unknown}')
            fields_here = {f['label']:f for fid,f in by_id.items() if fid in wanted}
            boxes = [b for b in find_boxes(source_page, page_data(doc, source_page), fields_here)
                     if box.contains((b['rect'].tl+b['rect'].br)/2)] if wanted else []
            found = {fields_here[b['label']]['id'] for b in boxes}
            if found != wanted:
                raise ValueError(f'Missing diagram boxes: {key}/{sid}/{page_number}: {wanted-found}')
            identity = f'{page_number}:{list(box)}:{sorted(wanted)}'
            digest = hashlib.sha256(identity.encode()).hexdigest()[:10]
            name = f'diagram-p{page_number:02}-{digest}.png'
            # Only a clipped diagram is retained, so each figure does not load
            # the full PDF page and its unrelated text/font outlines.
            cropped = fitz.open()
            target = cropped.new_page(width=box.width, height=box.height)
            target.show_pdf_page(target.rect, doc, page_number-1, clip=box)
            for item in boxes:
                r = fitz.Rect(item['rect'])
                r.x0 -= box.x0; r.x1 -= box.x0; r.y0 -= box.y0; r.y1 -= box.y0
                target.add_redact_annot(r + (-.4,-.4,.4,.4), fill=(1,1,1))
            if boxes:
                target.apply_redactions(images=0, graphics=0)
            scale = max(3, min(6, 600/box.width))
            target.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).save(folder/'assets'/name)
            cropped.close()
            canvas = etree.Element('div', {'class':'diagram-canvas', 'style':f'aspect-ratio:{box.width}/{box.height}'})
            etree.SubElement(canvas,'img',src='assets/'+name,alt=figure.get('data-alt') or (''.join(caption.itertext()) if caption is not None else '問題の図'),loading='eager',width=str(round(box.width*scale)),height=str(round(box.height*scale)))
            for item in boxes:
                r = item['rect']; field = fields_here[item['label']]
                node = etree.SubElement(canvas,'span',{'class':'blank diagram-blank','data-field':field['id'],'data-original':field['label'],'data-input-type':field['type'], 'aria-label':'空欄'+field['label'],
                    'style':f'left:{(r.x0-box.x0)/box.width*100:.5f}%;top:{(r.y0-box.y0)/box.height*100:.5f}%;font-size:clamp(11px,calc(100cqi * {item["char"]["size"]} / {box.width}),16px)'})
                node.text = field['label']
            figure.insert(0,canvas)
            figure.set('style',f'--diagram-width:{box.width*4/3:.1f}px')
            add_class(figure,'past-diagram')
        # Match the original numbered rows, preserving column counts.
        circles='⓪①②③④⑤⑥⑦⑧⑨ⓐⓑⓒⓓⓔⓕ'
        clusters=[]
        for line in page_data(doc,doc[int(page.get('data-source-page'))-1]):
            value=line['text'].strip()
            if len(value)!=1 or value not in circles:continue
            if value=='⓪':clusters.append([])
            if clusters:clusters[-1].append((circles.index(value),line['bbox'].x0,line['bbox'].y0))
        cursor=0
        for group in page.xpath('.//*[@data-choice-presentation]'):
            options=group.xpath('.//*[@data-choice-value]')
            values={int(e.get('data-choice-value'),16) for e in options}
            matched=None
            for ci in range(cursor,len(clusters)):
                cluster=clusters[ci]
                if len(cluster)==len(values) and {x[0] for x in cluster}==values:
                    matched=cluster;cursor=ci+1;break
            cols=max((sum(abs(y-other[2])<4 for other in matched) for _,_,y in matched),default=1) if matched else 1
            group.set('data-source-columns',str(cols))
            group.set('style',f'--choice-columns:{cols}')
            if options and all(len(''.join(e.itertext()).strip())<8 for e in options):add_class(group,'short-options')
        program_scopes(page)
    pieces = [node for page in pages for node in page]
    for page in pages:
        for node in page:
            node.set('data-source-page',page.get('data-source-page'))
    return pages, pieces


def bind_reading(pages, pieces, groups):
    """Keep original paper pages; anchors remain at semantic question boundaries."""
    for index, group in enumerate(groups):
        ids = ' '.join(u['sourceUnitId'] for u in group['units'])
        start = group['start']
        end = groups[index+1]['start'] if index+1 < len(groups) else len(pieces)
        anchor = start
        while anchor+1 < end and set(pieces[anchor].get('class','').split()).intersection({'exam-subject','print-only','hidden-label'}):
            anchor += 1
        pieces[anchor].set('data-reading-units',ids)
        for node in pieces[start:end]:
            node.set('data-reading-for',ids)
    # Focused extraction includes the original shared setup for the question,
    # without changing the boundaries used by problem→explanation rendering.
    by_question = {}
    for index, group in enumerate(groups):
        question = group['units'][0]['question']
        by_question.setdefault(question, []).append((index,group))
    for entries in by_question.values():
        all_ids = ' '.join(u['sourceUnitId'] for _,g in entries for u in g['units'])
        first_index, first_group = entries[0]
        first_end = groups[first_index+1]['start'] if first_index+1<len(groups) else len(pieces)
        # Native figures/tables and introductory prose are reusable context.
        for node in pieces[first_group['start']:first_end]:
            if node.get('data-reading-units') is None:
                node.set('data-reading-for',all_ids)
    return pages
