"""Refresh the fillable reservation template from its existing official form layout."""

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt


template_path = Path(__file__).resolve().parents[1] / "public/documents/reservation-template.docx"
source = template_path.read_bytes()
document = Document(BytesIO(source))

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

output = BytesIO()
document.save(output)
with ZipFile(BytesIO(source)) as old, ZipFile(BytesIO(output.getvalue())) as edited:
    new_xml = edited.read("word/document.xml")
    with ZipFile(template_path, "w") as final:
        for part in old.infolist():
            final.writestr(part, new_xml if part.filename == "word/document.xml" else old.read(part.filename))
