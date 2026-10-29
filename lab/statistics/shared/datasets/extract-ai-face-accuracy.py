"""Extract participant counts from the authors' Expt1_acc_raw_data.xlsx.

Usage: python extract-ai-face-accuracy.py /path/to/Expt1_acc_raw_data.xlsx
Requires openpyxl. The original workbook is kept outside the published site.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

import openpyxl

source = Path(sys.argv[1])
destination = Path(__file__).parent
sheet = openpyxl.load_workbook(source, read_only=True, data_only=True).worksheets[0]
rows = list(sheet.values)
assert sheet.title == 'Expt1_acc_raw_data'
assert rows[0][0] == 'acc, 1 = correct, 0 = incorrect'
assert all(list(rows[1][2 + g*50:52 + g*50]) == list(range(1, 51)) for g in range(16))
assert len(rows[2:]) == 315
assert [row[0] for row in rows[2:]] == list(range(1, 316))
counts = []
for row in rows[2:]:
    responses = row[2:802]  # Columns C:ADV, sixteen blocks of fifty image columns.
    present = [v for v in responses if v is not None]
    assert len(present) == 128 and all(type(v) in (int, float) and v in (0, 1) for v in present)
    assert all(sum(v is not None for v in responses[g*50:(g+1)*50]) == 8 for g in range(16))
    counts.append(int(sum(present)))

csv_path = destination / 'ai-face-accuracy.csv'
with csv_path.open('w', encoding='utf-8', newline='') as stream:
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['参加者番号', '判定枚数', '正答数'])
    writer.writerows((f'P{i+1:03}', 128, count) for i, count in enumerate(counts))

data_path = destination.parent.parent / 'hypothesis-test' / 'data.mjs'
data_path.write_text('// Participant totals extracted from Nightingale & Farid (2022), experiment 1.\n'
    '// Reproduce with shared/datasets/extract-ai-face-accuracy.py; no synthetic observations.\n'
    'export const correctCounts = ' + json.dumps(counts, separators=(',', ':')) + ';\n'
    'export const aiFaceParticipants = () => correctCounts.map((correct, i) => ({\n'
    '  id: `P${String(i + 1).padStart(3, "0")}`, trials: 128, correct,\n'
    '}));\n', encoding='utf-8')
provenance = {
    'study': 'Nightingale & Farid (2022), PNAS 119(8), e2120481119, experiment 1',
    'doi': 'https://doi.org/10.1073/pnas.2120481119',
    'repository': 'https://osf.io/ru36d/',
    'input_filename': source.name,
    'input_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'sheet': sheet.title,
    'excel_rows': '3:317',
    'excel_columns': 'C:ADV (800 image columns)',
    'blank_cells': 'Image not rated by this participant; excluded from both denominator and numerator.',
    'response_encoding': {'0': 'incorrect', '1': 'correct'},
    'transformation': 'For each participant, count the 128 nonblank image cells and sum their 0/1 values; replace the original sequential participant number with P001 through P315. Ignore all demographic columns.',
    'participants': len(counts), 'trials_per_participant': 128,
    'total_judgements': 128 * len(counts), 'total_correct': sum(counts),
    'csv_sha256': hashlib.sha256(csv_path.read_bytes()).hexdigest(),
}
(destination / 'ai-face-accuracy-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: provenance[k] for k in ['participants', 'total_judgements', 'total_correct', 'input_sha256', 'csv_sha256']}, ensure_ascii=False))
