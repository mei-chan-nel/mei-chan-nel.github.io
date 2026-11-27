"""Keep the labels in the original mock's second question in kana order."""
import re

KANA_ORDER = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'


def second_question_fields(exam):
    return [field for section in ('q2a', 'q2b')
            for field in exam['fields'] if field['sectionId'] == section]


def substitute_labels(text, mapping):
    # A standalone kana or run of kana can refer to a blank. Leave words
    # such as コード and システム intact, and replace each old label once.
    return re.sub(r'(?<![ァ-ヿ])[' + ''.join(mapping) + r']+(?![ァ-ヿ])',
                  lambda match: ''.join(mapping[c] for c in match[0]), text)


def replace_blank_references(document, mapping):
    body = document if document.tag == 'body' else document.find('body')
    for node in body.iter():
        if not isinstance(node.tag, str) or node.tag in ('style', 'script'):
            continue
        for attr in ('text', 'tail'):
            value = getattr(node, attr)
            if value:
                setattr(node, attr, substitute_labels(value, mapping))
        for attr in ('data-original', 'aria-label', 'title'):
            value = node.get(attr)
            if value:
                node.set(attr, substitute_labels(value, mapping))


def normalize_second_question(exam):
    if exam.get('kind') == 'past':
        return {}
    fields = second_question_fields(exam)
    assert len(fields) <= len(KANA_ORDER)
    changes = {}
    for field, label in zip(fields, KANA_ORDER):
        old_label = field['label']
        if old_label != label:
            changes.setdefault(field['sectionId'], {})[old_label] = label
            # IDs and answer values also identify stored answers and stats.
            field['label'] = label
    for field in fields:
        mapping = changes.get(field['sectionId'])
        if not mapping:
            continue
        for choice in field.get('choices', []):
            choice['text'] = substitute_labels(choice['text'], mapping)
            if 'parts' in choice:
                choice['parts'] = [substitute_labels(part, mapping) for part in choice['parts']]
    return changes
