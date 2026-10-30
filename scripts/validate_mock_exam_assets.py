"""All-edition HTML, reading links, local resources and PDF coverage checks.

Runs locally with lxml + PyMuPDF. Never fetches external links or modifies files.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit
from lxml import html


def norm(text):
    return re.sub(r'\s', '', unicodedata.normalize('NFKC', text or ''))


def validate(manifest, skip_pdf=False):
    folder = manifest.parent
    root = folder.parents[2]
    exam = json.loads(manifest.read_text())
    fields = {f['id']: f for f in exam['fields']}
    units = {u['id']: u for u in exam['scoring']}
    print_documents = {'problem': [], 'solution': []}

    def need(ok, message):
        if not ok:
            raise ValueError(f'{manifest.relative_to(root)}: {message}')

    def local_file(base, reference):
        url = urlsplit(reference)
        if url.scheme in ('https', 'http', 'data') or not url.path:
            return None
        need(not url.scheme and not url.netloc, f'Unsupported resource: {reference[:100]}')
        file = (base / unquote(url.path)).resolve()
        need(file.is_relative_to(root) and file.is_file(), f'Missing/outside resource: {reference[:120]}')
        return file

    for section in exam['sections']:
        sid = section['id']
        wanted_fields = {f['id'] for f in exam['fields'] if f['sectionId'] == sid}
        wanted_units = [u['id'] for u in exam['scoring'] if u['sectionId'] == sid]
        pairs = {}
        for key, checksum in [('sourceProblem', 'sourceSha256'), ('sourceSolution', 'solutionSha256')]:
            need(key in section and checksum in section, f'Missing source provenance: {sid}/{key}')
            source = local_file(folder, section[key])
            need(source and source.is_relative_to(folder / 'source'), f'Keep originals in source/: {sid}')
            need(hashlib.sha256(source.read_bytes()).hexdigest() == section[checksum], f'Original checksum changed: {sid}/{key}')
        for kind in ('problem', 'solution'):
            for screen in (False, True):
                key = ('screen' + kind.capitalize()) if screen else kind
                need(key in section, f'Missing {sid}/{key}')
                file = local_file(folder, section[key])
                need(file is not None, f'Material must be local: {sid}/{key}')
                d = html.fromstring(file.read_bytes())
                need(d.find('head') is not None and d.find('body') is not None, f'Incomplete HTML: {file.name}')
                need(not d.xpath('//script|//iframe|//object|//embed|//base|//form'), f'Active HTML in {key}/{sid}')
                for node in d.iter():
                    for name, value in node.attrib.items():
                        need(not name.lower().startswith('on'), f'Event handler in {key}/{sid}')
                        if name in ('src', 'href'):
                            need(not value.strip().lower().startswith('javascript:'), f'Active URL in {key}/{sid}')
                for node in d.xpath('//img[@src]|//link[@rel="stylesheet"]'):
                    local_file(file.parent, node.get('src') or node.get('href'))
                for style in d.xpath('//style'):
                    for reference in re.findall(r'url\(\s*[\'"]?([^\)\'"\s]+)', style.text or ''):
                        local_file(file.parent, reference)
                text = d.find('body').text_content()
                need(not re.search(r'ⓐ|ⓑ|ⓒ|ⓓ|当てはまる文字をマークせよ', text), f'Obsolete letter instructions: {sid}/{key}')
                bound = set()
                for node in d.xpath('//*[@data-field]'):
                    fid = node.get('data-field')
                    need(fid in wanted_fields, f'Unknown/cross-section HTML field: {fid}')
                    bound.add(fid)
                    if node.get('data-part') is not None:
                        part = node.get('data-part')
                        need(part.isdigit() and all(int(part) < len(c.get('parts', [])) for c in fields[fid].get('choices', [])), f'Invalid choice part: {fid}')
                if kind == 'problem':
                    need(bound == wanted_fields, f'Missing input bindings: {sid}/{key}: {wanted_fields-bound}')
                    choices = {fid: set() for fid in wanted_fields}
                    for node in d.xpath('//*[@data-choice-fields]'):
                        value = node.get('data-choice-value')
                        for fid in node.get('data-choice-fields').split():
                            need(fid in wanted_fields and fields[fid]['type'] == 'choice', f'Unknown choice field: {fid}')
                            need(value in {c['value'] for c in fields[fid]['choices']}, f'Unknown choice value: {fid}/{value}')
                            choices[fid].add(value)
                    for fid in wanted_fields:
                        if fields[fid]['type'] == 'choice':
                            need(choices[fid] == {c['value'] for c in fields[fid]['choices']}, f'Missing clickable choices: {fid}/{key}')
                if screen:
                    need(not any('@font-face' in (s.text or '') for s in d.xpath('//style')), f'Embedded print fonts: {sid}/{key}')
                    groups = [node.get('data-reading-units').split() for node in d.xpath('//*[@data-reading-units]')]
                    need([u for group in groups for u in group] == wanted_units, f'Missing/duplicate/out-of-order reading anchors: {sid}/{key}')
                    pairs[kind] = groups
                    if kind == 'problem':
                        fragments = {uid: set() for uid in wanted_units}
                        for node in d.xpath('//*[@data-reading-for]'):
                            for uid in node.get('data-reading-for').split():
                                need(uid in fragments, f'Unknown problem fragment: {uid}')
                                fragments[uid].update(n.get('data-field') for n in node.iter() if n.get('data-field'))
                        for uid, selected in fragments.items():
                            need(set(units[uid]['fields']) <= selected, f'Incomplete focused problem: {uid}')
                else:
                    print_documents[kind].append((sid, d))
        need(pairs['problem'] == pairs['solution'], f'Problem/solution groups differ: {sid}')
    if not skip_pdf:
        import fitz
        for kind, documents in print_documents.items():
            with fitz.open(folder / (kind + '.pdf')) as pdf:
                need(len(pdf) > 0 and all(abs(p.rect.width-595.28) < 1 and abs(p.rect.height-841.89) < 1 for p in pdf), f'Not A4: {kind}.pdf')
                text = norm(''.join(p.get_text() for p in pdf))
                footer = norm(f'情報Ⅰ StudyAtlas 実戦演習 No.{exam["id"]}')
                need(footer in text, f'Wrong/missing PDF No.: {kind}')
                text = re.sub(re.escape(footer) + r'[—―-]\d+[—―-]', '', text)
                for sid, d in documents:
                    for node in d.xpath('//style|//script'):
                        node.drop_tree()
                    for node in d.find('body').iter():
                        if not isinstance(node.tag, str) or node.tag in ('metadata', 'title'):
                            continue
                        if any(a.tag == 'metadata' or 'figure-description' in a.get('class', '') or 'mobile-diagram' in a.get('class', '') for a in node.iterancestors()):
                            continue
                        for fragment in (node.text, node.tail):
                            value = norm(fragment)
                            need(len(value) < 24 or value in text, f'PDF text missing: {kind}/{sid}: {value[:80]}')
                print(f'PASS {exam["id"]}/{exam["version"]} {kind}.pdf: {len(pdf)} A4 pages, prose coverage')
    print(f'PASS {exam["id"]}/{exam["version"]}: source checksums, HTML resources/choices, paired anchors, focused problems')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--skip-pdf', action='store_true')
    args = parser.parse_args()
    try:
        validate(args.manifest.resolve(), args.skip_pdf)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f'{error}\n')
