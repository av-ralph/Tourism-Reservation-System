"""Refresh the fillable reservation template from its existing official form layout."""

from io import BytesIO
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt


public_dir = Path(__file__).resolve().parents[1] / "public"
template_path = public_dir / "documents/reservation-template.docx"
source = template_path.read_bytes()
document = Document(BytesIO(source))

def add_masthead(document):
    header = document.sections[0].header
    if header.tables:
        return
    masthead = header.add_table(rows=1, cols=3, width=Inches(7.35))
    masthead.autofit = False
    for cell, width in zip(masthead.rows[0].cells, (Inches(1.1), Inches(5.15), Inches(1.1))):
        cell.width = width
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        cell.paragraphs[0].paragraph_format.space_after = Pt(0)
    masthead.cell(0, 0).paragraphs[0].add_run().add_picture(str(public_dir / "cec.png"), width=Inches(0.82))
    center = masthead.cell(0, 1).paragraphs[0]
    for index, (line, size) in enumerate((("Cristal e-College", 12), ("Academic Division", 10), ("Hospitality Management", 10))):
        if index:
            center.add_run().add_break()
        run = center.add_run(line)
        run.bold = True
        run.font.name = "Times New Roman"
        run.font.size = Pt(size)
    masthead.cell(0, 2).paragraphs[0].add_run().add_picture(str(Path(__file__).resolve().parent / "assets/hm-form-logo.png"), width=Inches(0.82))
    # The empty header paragraph came from the official form; use its space for the masthead.
    header._element.remove(header.paragraphs[0]._element)


add_masthead(document)

area = document.paragraphs[11]
area.clear()
area.style = "Body Text"
area.alignment = WD_ALIGN_PARAGRAPH.CENTER
area.paragraph_format.space_before = Pt(7)
area.paragraph_format.space_after = Pt(3)

areas = (
    ("BAR", "Bar Area"),
    ("DINING", "Dining Area"),
    ("FRONT_OFFICE", "Front Office Area"),
    ("KITCHEN", "Kitchen Area"),
    ("LAUNDRY", "Laundry Area"),
    ("ROOMS", "Rooms"),
    ("OTHER", "Other"),
)
for index, (key, label) in enumerate(areas):
    if index == 3:
        area.add_run().add_break()
    elif index:
        area.add_run("    ")
    box = area.add_run("{{CHECK_" + key + "}}")
    box.font.name = "Segoe UI Symbol"
    box.font.size = Pt(11)
    name = area.add_run(" " + label)
    name.font.name = "Times New Roman"
    name.font.size = Pt(10)

selected = document.paragraphs[12]
selected.clear()
selected.alignment = WD_ALIGN_PARAGRAPH.CENTER
selected.paragraph_format.space_after = Pt(6)
label = selected.add_run("Selected space: ")
label.bold = True
value = selected.add_run("{{FACILITY}}")
value.bold = True

for table in document.tables[:2]:
    for row in table.rows:
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for paragraph in cell.paragraphs:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in paragraph.runs:
                    run.bold = True

document.save(template_path)
