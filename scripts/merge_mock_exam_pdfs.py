"""Merge section PDFs; subset only the new footer font, preserving source fonts."""
import fitz
import sys
import tempfile
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

out, number, *files = sys.argv[1:]
doc = fitz.open()
for file in files:
    with fitz.open(file) as part:
        doc.insert_pdf(part)
footer = f'情報Ⅰ StudyAtlas 実戦演習 No.{number}'
with tempfile.TemporaryDirectory(prefix='atlas-footer-') as folder:
    # Use a distinct TrueType family so page-specific source CJK CMaps cannot
    # be reused for the footer by the PDF font cache.
    original_footer = Path(folder) / 'original.ttf'
    original_footer.write_bytes(fitz.Font('japan').buffer)
    font = TTFont(original_footer)
    # Subset only the footer; keep glyph IDs and leave source fonts intact.
    sub = subset.Subsetter(options=subset.Options(retain_gids=True))
    sub.populate(text=footer + '— 0123456789')
    sub.subset(font)
    font_file = Path(folder) / 'footer.otf'
    font.save(font_file)
    for i, p in enumerate(doc):
        footer_name = f'AtlasFooter{i+1}'
        p.insert_font(fontname=footer_name, fontfile=str(font_file))
        p.insert_textbox(fitz.Rect(20, p.rect.height-23, p.rect.width-20, p.rect.height-6),
                         footer, fontname=footer_name, fontsize=7, align=2)
        p.insert_textbox(fitz.Rect(0, p.rect.height-23, p.rect.width, p.rect.height-6),
                         f'— {i+1} —', fontname=footer_name, fontsize=8, align=1)
    # Do not subset the original embedded CFF fonts: some source font programs
    # cannot be re-subset by MuPDF. They are already browser-generated subsets.
    doc.save(out, garbage=4, deflate=True)
print(f'{out}: {len(doc)} pages, {Path(out).stat().st_size:,} bytes')
