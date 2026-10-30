"""Replace only the visible footer of published exam PDF booklets.

This is a one-time migration: source pages, numbering and URLs remain unchanged.
Future rebuilds use scripts/merge_mock_exam_pdfs.py.
"""
from pathlib import Path
from collections import Counter
import tempfile
import subprocess
import os
import fitz
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1] / "mock-exams" / "exams"
OLD = "情報Ⅰ StudyAtlas 実戦模試 No."
NEW = "情報Ⅰ StudyAtlas 実戦演習 No."


def footer_font(destination):
    fontpath = subprocess.check_output(
        ["fc-match", "-f", "%{file}", "Noto Sans CJK JP"], text=True
    ).strip()
    if not fontpath:
        raise RuntimeError("Japanese Noto font unavailable")
    font = TTFont(fontpath, fontNumber=0)
    options = subset.Options(retain_gids=True)
    sub = subset.Subsetter(options=options)
    sub.populate(text=NEW + "0123456789— ")
    sub.subset(font)
    font.save(str(destination))


def content_without_footer(page_text, value):
    return Counter(line for line in page_text.splitlines() if value not in line)


def update_pdf(pdf_file, font_file):
    number = pdf_file.parent.parent.name
    old, new = OLD + number, NEW + number
    with fitz.open(str(pdf_file)) as pdf:
        originals = []
        for i, page in enumerate(pdf):
            source = page.get_text()
            if source.count(old) != 1:
                raise RuntimeError(f"{pdf_file}: page {i + 1}: old footer not unique")
            originals.append(content_without_footer(source, old))
            region = fitz.Rect(page.rect.width * 0.62,
                               page.rect.height - 27,
                               page.rect.width - 6,
                               page.rect.height - 3)
            if not page.search_for(old, clip=region):
                raise RuntimeError(f"{pdf_file}: page {i + 1}: footer position differs")
            page.add_redact_annot(region, fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            page.insert_font(fontname="AtlasNewJP", fontfile=str(font_file))
            fit = page.insert_textbox(
                fitz.Rect(20, page.rect.height - 23,
                          page.rect.width - 20, page.rect.height - 6),
                new, fontname="AtlasNewJP", fontsize=7, align=2)
            if fit < 0:
                raise RuntimeError(f"{pdf_file}: page {i + 1}: footer overflow")
        page_count = len(pdf)
        target = pdf_file.with_suffix(".renamed.pdf")
        pdf.save(str(target), garbage=4, deflate=True)
    try:
        with fitz.open(str(target)) as check:
            if len(check) != page_count:
                raise RuntimeError("PDF page count changed")
            for i, page in enumerate(check):
                text = page.get_text()
                if old in text or text.count(new) != 1:
                    raise RuntimeError(f"{pdf_file}: page {i + 1}: wrong replacement")
                if content_without_footer(text, new) != originals[i]:
                    raise RuntimeError(f"{pdf_file}: page {i + 1}: other text changed")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    os.replace(target, pdf_file)
    print(f"{pdf_file}: {page_count} pages, footer changed, other text intact")


def main():
    pdfs = sorted(ROOT.glob("*/*/problem.pdf")) + sorted(ROOT.glob("*/*/solution.pdf"))
    if len(pdfs) != 4:
        raise RuntimeError(f"Expected 4 versioned PDFs, found {len(pdfs)}")
    with tempfile.TemporaryDirectory(prefix="study-atlas-footer-") as tmp:
        font = Path(tmp) / "footer.otf"
        footer_font(font)
        for pdf in pdfs:
            update_pdf(pdf, font)
    print("All four PDF booklets updated and verified")


if __name__ == "__main__":
    main()
