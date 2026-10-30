"""Merge section PDFs; subset only the new footer font, preserving source fonts."""
import fitz
import sys
import subprocess
import tempfile
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

out, number, *files = sys.argv[1:]
doc = fitz.open()
for file in files:
    with fitz.open(file) as part:
        doc.insert_pdf(part)
font_path = subprocess.check_output(['fc-match', '-f', '%{file}', 'Noto Sans CJK JP']).decode()
footer = f'情報Ⅰ StudyAtlas 実戦演習 No.{number}'
with tempfile.TemporaryDirectory(prefix='atlas-footer-') as folder:
    font = TTFont(font_path, fontNumber=0)
    # CID-keyed CFF fonts keep their original character IDs. Renumbering glyphs
    # produces correct extracted text but wrong visible characters in MuPDF.
    sub = subset.Subsetter(options=subset.Options(retain_gids=True))
    sub.populate(text=footer + '— 0123456789')
    sub.subset(font)
    font_file = Path(folder) / 'footer.otf'
    font.save(font_file)
    for i, p in enumerate(doc):
        p.insert_font(fontname='AtlasJP', fontfile=str(font_file))
        p.insert_textbox(fitz.Rect(20, p.rect.height-23, p.rect.width-20, p.rect.height-6),
                         footer, fontname='AtlasJP', fontsize=7, align=2)
        p.insert_textbox(fitz.Rect(0, p.rect.height-23, p.rect.width, p.rect.height-6),
                         f'— {i+1} —', fontname='AtlasJP', fontsize=8, align=1)
    # Do not subset the original embedded CFF fonts: some source font programs
    # cannot be re-subset by MuPDF. They are already browser-generated subsets.
    doc.save(out, garbage=4, deflate=True)
print(f'{out}: {len(doc)} pages, {Path(out).stat().st_size:,} bytes')
