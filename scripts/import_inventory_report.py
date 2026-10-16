"""Rebuild the draft catalog from the college's HM inventory Word report.

Usage: python scripts/import_inventory_report.py path/to/report.docx
The report's previous, actual, and required cells are preserved verbatim.
Zero actual quantities remain unpublished drafts with zero booking stock.
"""

import json
import re
import sys
from pathlib import Path

from docx import Document


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def main(path):
    report = Document(path)
    rows = []
    category = ""
    for table_index, table in enumerate(report.tables):
        for row_index, row in enumerate(table.rows[2:], 2):
            cells = [clean(cell.text) for cell in row.cells]
            name = cells[0]
            if not name:
                continue
            if name == name.upper() and not any(cells[1:]):
                category = name.title()
                continue
            if not category:
                raise ValueError(f"No category before table {table_index}, row {row_index}")
            actual = cells[5]
            rows.append({
                "id": f"report-{table_index}-{row_index}",
                "name": name,
                "category": category,
                "quantity": actual if re.fullmatch(r"\d+", actual) else "0",
                "unit": cells[6] or "not recorded",
                "model": cells[1],
                "serial": cells[2],
                "notes": cells[9],
                "reportModel": cells[1],
                "reportSerial": cells[2],
                "reportRemarks": cells[9],
                "reportPreviousQuantity": cells[3],
                "reportPreviousUnit": cells[4],
                "reportActualQuantity": cells[5],
                "reportActualUnit": cells[6],
                "reportRequiredQuantity": cells[7],
                "reportRequiredUnit": cells[8],
                "status": "Draft",
            })
    output = Path(__file__).resolve().parents[1] / "backend/src/inventory-catalog.ts"
    output.write_text(
        "// Extracted from the supplied 2nd Sem A.Y. 2025–2026 HM Laboratory Inventory Report.\n"
        "// Report fields preserve the Word table. Positive reported stock is published at the owner's request.\n"
        "import type { Row } from './record-store.js';\n"
        "const reportInventoryCatalog: Row[] = "
        + json.dumps(rows, ensure_ascii=False, indent=2)
        + ";\n"
        + "export const inventoryCatalog: Row[] = reportInventoryCatalog.map(item => ({\n"
        + "  ...item,\n"
        + "  status: Number(item.quantity) > 0 ? 'Available' : 'Draft',\n"
        + "}));\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} report items to {output}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/import_inventory_report.py report.docx")
    main(sys.argv[1])
