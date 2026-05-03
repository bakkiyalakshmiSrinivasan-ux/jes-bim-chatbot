import openpyxl
from openpyxl import Workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side,
                              GradientFill)
from openpyxl.utils import get_column_letter

wb = Workbook()

# ── helpers ────────────────────────────────────────────────────────────────────
def thin():
    s = Side(border_style="thin", color="000000")
    return Border(left=s, right=s, top=s, bottom=s)

def medium():
    s = Side(border_style="medium", color="000000")
    return Border(left=s, right=s, top=s, bottom=s)

def hdr_fill():   return PatternFill("solid", fgColor="1F4E79")   # dark navy
def tbl_hdr():    return PatternFill("solid", fgColor="2E75B6")   # blue
def alt_fill():   return PatternFill("solid", fgColor="D6E4F0")   # light blue
def total_fill(): return PatternFill("solid", fgColor="BDD7EE")   # mid blue
def white_fill(): return PatternFill("solid", fgColor="FFFFFF")

def hdr_font(sz=11, bold=True, color="FFFFFF"):
    return Font(name="Arial", size=sz, bold=bold, color=color)

def body_font(sz=10, bold=False, color="000000"):
    return Font(name="Arial", size=sz, bold=bold, color=color)

def money_fmt():  return '#,##0.00;(#,##0.00);"-"'
def pct_fmt():    return '0.00%'

def apply_border(ws, row, col_start, col_end, border=None):
    b = border or thin()
    for c in range(col_start, col_end + 1):
        ws.cell(row, c).border = b

def set_cell(ws, row, col, value="", font=None, fill=None, align=None,
             border=None, number_format=None, formula=None):
    cell = ws.cell(row, col)
    cell.value = formula if formula else value
    if font:           cell.font = font
    if fill:           cell.fill = fill
    if align:          cell.alignment = align
    if border:         cell.border = border
    if number_format:  cell.number_format = number_format
    return cell

center = Alignment(horizontal="center", vertical="center", wrap_text=True)
left   = Alignment(horizontal="left",   vertical="center", wrap_text=True)
right  = Alignment(horizontal="right",  vertical="center", wrap_text=True)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 1 — AFE / Golf Hills Style (12 columns wide, items A-J)
# ══════════════════════════════════════════════════════════════════════════════
ws1 = wb.active
ws1.title = "IPA Template - AFE Style"

# column widths
col_w = [3, 8, 38, 4, 4, 18, 18, 18, 4, 4, 4, 4]
for i, w in enumerate(col_w, 1):
    ws1.column_dimensions[get_column_letter(i)].width = w

# row heights
for r in range(1, 42):
    ws1.row_dimensions[r].height = 18
ws1.row_dimensions[1].height = 60   # logo row
ws1.row_dimensions[2].height = 32   # title row
ws1.row_dimensions[3].height = 20
ws1.row_dimensions[15].height = 20
ws1.row_dimensions[25].height = 22  # amount in words

# ── Row 1: Logo / Company banner ──
ws1.merge_cells("A1:L1")
set_cell(ws1, 1, 1,
    value="JOSEPH ENGINEERING SERVICES  |  INTERIM PAYMENT APPLICATION",
    font=Font(name="Arial", size=16, bold=True, color="FFFFFF"),
    fill=hdr_fill(), align=center)

# ── Row 2: Title bar ──
ws1.merge_cells("A2:L2")
set_cell(ws1, 2, 1,
    value="INTERIM PAYMENT APPLICATION",
    font=Font(name="Arial", size=14, bold=True, color="FFFFFF"),
    fill=tbl_hdr(), align=center)

# ── Rows 3-13: Two-column header block ──
# Left block label (col A-B merged into labels, C-E = value)
# Right block label (col F-H), value (col I-L)

left_labels = [
    "CUSTOMER", "", "Company Name", "Address",
    "Phone:", "Fax:", "Email:", "Website:", "Contact:", "TRN No:", ""
]
right_labels = [
    "Payment Application No.:", "Date", "Work Done up to",
    "Document No.", "Due Date", "Contract Value",
    "Approved Variation", "Revised Contract Value", "Overall Completion",
    "Project:", "Scope:"
]

# Left column header "CUSTOMER" box
ws1.merge_cells("A3:E3")
set_cell(ws1, 3, 1, "CUSTOMER",
         font=hdr_font(10), fill=tbl_hdr(), align=center, border=medium())

ws1.merge_cells("F3:H3")
set_cell(ws1, 3, 6, "PAYMENT DETAILS",
         font=hdr_font(10), fill=tbl_hdr(), align=center, border=medium())

ws1.merge_cells("I3:L3")
set_cell(ws1, 3, 9, "",
         fill=tbl_hdr(), border=medium())

for i, (lbl, rlbl) in enumerate(zip(left_labels[2:], right_labels), start=4):
    # left label
    ws1.merge_cells(f"A{i}:B{i}")
    set_cell(ws1, i, 1, lbl,
             font=body_font(9, bold=True), fill=alt_fill(),
             align=left, border=thin())
    # left value
    ws1.merge_cells(f"C{i}:E{i}")
    set_cell(ws1, i, 3, "",
             font=body_font(9), fill=white_fill(), align=left, border=thin())
    # right label
    ws1.merge_cells(f"F{i}:H{i}")
    set_cell(ws1, i, 6, rlbl,
             font=body_font(9, bold=True), fill=alt_fill(),
             align=left, border=thin())
    # right value
    ws1.merge_cells(f"I{i}:L{i}")
    cell = set_cell(ws1, i, 9, "",
             font=body_font(9), fill=white_fill(), align=left, border=thin())
    # format specific right-side cells
    if rlbl in ("Contract Value", "Approved Variation", "Revised Contract Value"):
        cell.number_format = money_fmt()
    if rlbl == "Overall Completion":
        cell.number_format = pct_fmt()

# ── Row 14: blank separator ──
ws1.merge_cells("A14:L14")
ws1.row_dimensions[14].height = 6

# ── Row 15: Table header ──
ws1.row_dimensions[15].height = 22
headers = ["Item", "Description", "Previous\nCertificate (AED)",
           "This Application\n(AED)", "Cumulative\n(AED)"]
spans = [(1,1),(2,8),(9,10),(11,11),(12,12)]  # adjusted for 12-col
# Item col
ws1.merge_cells("A15:A15")
set_cell(ws1, 15, 1, "Item", font=hdr_font(9), fill=tbl_hdr(),
         align=center, border=medium())
# Description col
ws1.merge_cells("B15:E15")
set_cell(ws1, 15, 2, "Description", font=hdr_font(9), fill=tbl_hdr(),
         align=center, border=medium())
# Previous
ws1.merge_cells("F15:G15")  # cols 6-7
set_cell(ws1, 15, 6, "Previous\nCertificate (AED)",
         font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())
# This Application
ws1.merge_cells("H15:I15")
set_cell(ws1, 15, 8, "This Application\n(AED)",
         font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())
# Cumulative
ws1.merge_cells("J15:L15")
set_cell(ws1, 15, 10, "Cumulative\n(AED)",
         font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())

# ── Rows 16-24: Line items A to J ──
items = [
    ("A", "MEP"),
    ("B", "ARCH"),
    ("C", "On Site Co-Ordinator"),
    ("D", "Total Value of Work Done",  True),
    ("E", "(-) Certified Value / Advance Payment"),
    ("F", "(-) Retention"),
    ("G", "(+) Release of Retention"),
    ("H", "Other Additions / Deductions"),
    ("I", "Total Amount of Additions / Deductions", True),
    ("J", "Total Payment on this Certificate (D-I)", True),
]

for idx, item_data in enumerate(items):
    r = 16 + idx
    is_total = len(item_data) == 3 and item_data[2]
    item_lbl, item_desc = item_data[0], item_data[1]

    row_fill = total_fill() if is_total else white_fill()
    row_font = body_font(9, bold=is_total)

    # Item letter
    set_cell(ws1, r, 1, item_lbl,
             font=body_font(9, bold=True), fill=alt_fill() if not is_total else total_fill(),
             align=center, border=thin())
    # Description
    ws1.merge_cells(f"B{r}:E{r}")
    set_cell(ws1, r, 2, item_desc,
             font=row_font, fill=row_fill, align=left, border=thin())

    # Previous (formula or input)
    ws1.merge_cells(f"F{r}:G{r}")
    if item_lbl == "D":
        set_cell(ws1, r, 6, formula=f"=F16+F17+F18",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    elif item_lbl == "I":
        set_cell(ws1, r, 6, formula=f"=F20+F21+F22+F23",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    elif item_lbl == "J":
        set_cell(ws1, r, 6, formula=f"=F19-F24",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    else:
        set_cell(ws1, r, 6, 0,
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())

    # This Application
    ws1.merge_cells(f"H{r}:I{r}")
    if item_lbl == "D":
        set_cell(ws1, r, 8, formula=f"=H16+H17+H18",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    elif item_lbl == "I":
        set_cell(ws1, r, 8, formula=f"=H20+H21+H22+H23",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    elif item_lbl == "J":
        set_cell(ws1, r, 8, formula=f"=H19-H24",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    else:
        set_cell(ws1, r, 8, 0,
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())

    # Cumulative
    ws1.merge_cells(f"J{r}:L{r}")
    if item_lbl == "D":
        set_cell(ws1, r, 10, formula=f"=J16+J17+J18",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    elif item_lbl == "I":
        set_cell(ws1, r, 10, formula=f"=J20+J21+J22+J23",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    elif item_lbl == "J":
        set_cell(ws1, r, 10, formula=f"=J19-J24",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())
    else:
        set_cell(ws1, r, 10, formula=f"=F{r}+H{r}",
                 font=row_font, fill=row_fill, align=right, border=thin(),
                 number_format=money_fmt())

# ── Row 26: Amount in words ──
ws1.row_dimensions[26].height = 24
set_cell(ws1, 26, 1, "AED",
         font=body_font(9, bold=True), fill=tbl_hdr(), align=center, border=thin())
ws1.merge_cells("B26:L26")
set_cell(ws1, 26, 2, "Amount in Words (AED)  _______________________________ Only",
         font=body_font(9, bold=True, color="1F4E79"), fill=alt_fill(),
         align=left, border=thin())

# ── Row 27: Note ──
ws1.merge_cells("A27:L27")
set_cell(ws1, 27, 1,
         "Please do not hesitate to contact undersigned for any further clarifications.",
         font=body_font(9), align=left)

# ── Rows 28-30: Signature block ──
ws1.row_dimensions[28].height = 50
ws1.merge_cells("A28:E28")
set_cell(ws1, 28, 1, "",
         fill=white_fill(), border=thin())
ws1.merge_cells("F28:L28")
set_cell(ws1, 28, 6, "",
         fill=white_fill(), border=thin())

ws1.merge_cells("A29:E29")
set_cell(ws1, 29, 1, "Joseph Engineering Services",
         font=body_font(9, bold=True), fill=alt_fill(), align=center, border=thin())
ws1.merge_cells("F29:L29")
set_cell(ws1, 29, 6, "Received by",
         font=body_font(9, bold=True), fill=alt_fill(), align=center, border=thin())

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 2 — AlTayer / Orla Towers Style (items A-J, advance payment %)
# ══════════════════════════════════════════════════════════════════════════════
ws2 = wb.create_sheet("IPA Template - AlTayer Style")

col_w2 = [3, 8, 38, 4, 4, 18, 18, 18, 4, 4, 4, 4]
for i, w in enumerate(col_w2, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

for r in range(1, 42):
    ws2.row_dimensions[r].height = 18
ws2.row_dimensions[1].height = 60
ws2.row_dimensions[2].height = 32

# Row 1 banner
ws2.merge_cells("A1:L1")
set_cell(ws2, 1, 1,
    "JOSEPH ENGINEERING SERVICES  |  INTERIM PAYMENT APPLICATION",
    font=Font(name="Arial", size=16, bold=True, color="FFFFFF"),
    fill=hdr_fill(), align=center)

# Row 2 title
ws2.merge_cells("A2:L2")
set_cell(ws2, 2, 1, "INTERIM PAYMENT APPLICATION",
    font=Font(name="Arial", size=14, bold=True, color="FFFFFF"),
    fill=tbl_hdr(), align=center)

# Header block
ws2.merge_cells("A3:E3")
set_cell(ws2, 3, 1, "CUSTOMER",
         font=hdr_font(10), fill=tbl_hdr(), align=center, border=medium())
ws2.merge_cells("F3:H3")
set_cell(ws2, 3, 6, "PAYMENT DETAILS",
         font=hdr_font(10), fill=tbl_hdr(), align=center, border=medium())
ws2.merge_cells("I3:L3")
set_cell(ws2, 3, 9, "", fill=tbl_hdr(), border=medium())

left_labels2 = [
    "Company Name", "Address", "Phone:", "Fax:",
    "Email:", "Website:", "Contact:", "TRN No:", "", ""
]
right_labels2 = [
    "Payment Application No.:", "Date", "Work Done up to",
    "Document No.", "Due Date", "Contract Value",
    "Approved Variation", "Revised Contract Value",
    "Overall Completion", "Advance Payment %"
]

for i, (lbl, rlbl) in enumerate(zip(left_labels2, right_labels2), start=4):
    ws2.merge_cells(f"A{i}:B{i}")
    set_cell(ws2, i, 1, lbl,
             font=body_font(9, bold=True), fill=alt_fill(), align=left, border=thin())
    ws2.merge_cells(f"C{i}:E{i}")
    set_cell(ws2, i, 3, "", font=body_font(9), fill=white_fill(), align=left, border=thin())
    ws2.merge_cells(f"F{i}:H{i}")
    set_cell(ws2, i, 6, rlbl,
             font=body_font(9, bold=True), fill=alt_fill(), align=left, border=thin())
    ws2.merge_cells(f"I{i}:L{i}")
    cell = set_cell(ws2, i, 9, "",
             font=body_font(9), fill=white_fill(), align=left, border=thin())
    if rlbl in ("Contract Value", "Approved Variation", "Revised Contract Value"):
        cell.number_format = money_fmt()
    if rlbl == "Overall Completion":
        cell.number_format = pct_fmt()
    if rlbl == "Advance Payment %":
        cell.number_format = pct_fmt()

# Row 14 separator
ws2.merge_cells("A14:L14")
ws2.row_dimensions[14].height = 6

# Table header row 15
ws2.row_dimensions[15].height = 22
set_cell(ws2, 15, 1, "Item", font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())
ws2.merge_cells("B15:E15")
set_cell(ws2, 15, 2, "Description", font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())
ws2.merge_cells("F15:G15")
set_cell(ws2, 15, 6, "Previous\nCertificate (AED)", font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())
ws2.merge_cells("H15:I15")
set_cell(ws2, 15, 8, "This Application\n(AED)", font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())
ws2.merge_cells("J15:L15")
set_cell(ws2, 15, 10, "Cumulative\n(AED)", font=hdr_font(9), fill=tbl_hdr(), align=center, border=medium())

# Line items (AlTayer format)
items2 = [
    ("A", "Project Completion [Month - Year]"),
    ("B", "On Site Co-Ordinator"),
    ("C", "Additional Items / Scope"),
    ("D", "Total Value of Work Done", True),
    ("E", "(-) Advance Payment (Adv% × D)"),
    ("F", "(-) Retention"),
    ("G", "(+) Release of Retention"),
    ("H", "Other Additions / Deductions"),
    ("I", "Total Amount of Additions / Deductions", True),
    ("J", "Total Payment on this Certificate (D-I)", True),
]

for idx, item_data in enumerate(items2):
    r = 16 + idx
    is_total = len(item_data) == 3 and item_data[2]
    item_lbl, item_desc = item_data[0], item_data[1]
    row_fill = total_fill() if is_total else white_fill()
    row_font = body_font(9, bold=is_total)

    set_cell(ws2, r, 1, item_lbl,
             font=body_font(9, bold=True),
             fill=alt_fill() if not is_total else total_fill(),
             align=center, border=thin())
    ws2.merge_cells(f"B{r}:E{r}")
    set_cell(ws2, r, 2, item_desc,
             font=row_font, fill=row_fill, align=left, border=thin())

    # Previous
    ws2.merge_cells(f"F{r}:G{r}")
    if item_lbl == "D":
        set_cell(ws2, r, 6, formula="=F16+F17+F18",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "E":
        # Advance Payment = -Adv% * D previous
        set_cell(ws2, r, 6, formula="=-I13*F19",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "I":
        set_cell(ws2, r, 6, formula="=F20+F21+F22+F23",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "J":
        set_cell(ws2, r, 6, formula="=F19-F24",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    else:
        set_cell(ws2, r, 6, 0,
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())

    # This Application
    ws2.merge_cells(f"H{r}:I{r}")
    if item_lbl == "D":
        set_cell(ws2, r, 8, formula="=H16+H17+H18",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "E":
        set_cell(ws2, r, 8, formula="=-I13*H19",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "I":
        set_cell(ws2, r, 8, formula="=H20+H21+H22+H23",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "J":
        set_cell(ws2, r, 8, formula="=H19-H24",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    else:
        set_cell(ws2, r, 8, 0,
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())

    # Cumulative
    ws2.merge_cells(f"J{r}:L{r}")
    if item_lbl == "D":
        set_cell(ws2, r, 10, formula="=J16+J17+J18",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "E":
        set_cell(ws2, r, 10, formula="=F20+H20",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "I":
        set_cell(ws2, r, 10, formula="=J20+J21+J22+J23",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    elif item_lbl == "J":
        set_cell(ws2, r, 10, formula="=J19-J24",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())
    else:
        set_cell(ws2, r, 10, formula=f"=F{r}+H{r}",
                 font=row_font, fill=row_fill, align=right, border=thin(), number_format=money_fmt())

# Amount in words row 26
ws2.row_dimensions[26].height = 24
set_cell(ws2, 26, 1, "AED",
         font=body_font(9, bold=True), fill=tbl_hdr(), align=center, border=thin())
ws2.merge_cells("B26:L26")
set_cell(ws2, 26, 2,
         "Amount in Words (AED)  _______________________________ Only",
         font=body_font(9, bold=True, color="1F4E79"), fill=alt_fill(),
         align=left, border=thin())

# Note
ws2.merge_cells("A27:L27")
set_cell(ws2, 27, 1,
         "Please do not hesitate to contact undersigned for any further clarifications.",
         font=body_font(9), align=left)

# Signature
ws2.row_dimensions[28].height = 50
ws2.merge_cells("A28:E28")
set_cell(ws2, 28, 1, "", fill=white_fill(), border=thin())
ws2.merge_cells("F28:L28")
set_cell(ws2, 28, 6, "", fill=white_fill(), border=thin())
ws2.merge_cells("A29:E29")
set_cell(ws2, 29, 1, "Joseph Engineering Services",
         font=body_font(9, bold=True), fill=alt_fill(), align=center, border=thin())
ws2.merge_cells("F29:L29")
set_cell(ws2, 29, 6, "Received by",
         font=body_font(9, bold=True), fill=alt_fill(), align=center, border=thin())

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 3 — Instructions
# ══════════════════════════════════════════════════════════════════════════════
ws3 = wb.create_sheet("Instructions")
ws3.column_dimensions["A"].width = 90
ws3.row_dimensions[1].height = 30

ws3.merge_cells("A1:A1")
set_cell(ws3, 1, 1, "IPA TEMPLATE — INSTRUCTIONS",
         font=Font(name="Arial", size=14, bold=True, color="FFFFFF"),
         fill=hdr_fill(), align=center)

instructions = [
    ("Sheet 1 — AFE Style", True),
    ("Use for: AFE Contracting (Al Badia, Golf Hillside, Al Badia Zone 6)", False),
    ("Items: A=MEP, B=ARCH, C=On-Site Co-Ordinator, D=Total, E=Certified/Advance, F=Retention, G=Release, H=Other, I=Total Deductions, J=Net Payment", False),
    ("Formulas: D=A+B+C, I=E+F+G+H, J=D−I (auto-calculated)", False),
    ("Cumulative = Previous + This Application (auto-calculated)", False),
    ("", False),
    ("Sheet 2 — AlTayer Style", True),
    ("Use for: Al Tayer Stocks (Orla Towers, Sky Palace, LOD 300/400/500)", False),
    ("Items: A=Project Completion, B=On-Site Co-Ordinator, C=Additional Scope, D=Total, E=Advance Payment (uses % from header), F=Retention, G=Release, H=Other, I=Total Deductions, J=Net Payment", False),
    ("Enter Advance Payment % in the header (cell I13) — formulas auto-calculate deduction", False),
    ("", False),
    ("Common Fields to Fill In", True),
    ("• Customer / Company Name, Address, Phone, Fax, Email, Website, Contact, TRN No.", False),
    ("• Payment Application No. (format: 001/26)", False),
    ("• Date (application date)", False),
    ("• Work Done up to (period end date)", False),
    ("• Document No. (client PO/SAP reference)", False),
    ("• Due Date", False),
    ("• Contract Value, Approved Variation, Revised Contract Value", False),
    ("• Overall Completion %", False),
    ("• Enter AED amounts in the Previous and This Application columns (blue cells)", False),
    ("• Amount in Words — type the amount in words at the bottom", False),
    ("", False),
    ("Color Legend", True),
    ("• Dark Navy header = Company banner (do not edit)", False),
    ("• Blue header rows = Section labels (do not edit)", False),
    ("• Light blue = Labels / read-only reference", False),
    ("• White cells = Input fields (enter your data here)", False),
    ("• Medium blue = Calculated totals (auto-formula, do not overwrite)", False),
]

for i, (txt, bold) in enumerate(instructions, start=2):
    ws3.row_dimensions[i].height = 16
    set_cell(ws3, i, 1, txt,
             font=body_font(10, bold=bold, color="1F4E79" if bold else "000000"),
             fill=alt_fill() if bold else white_fill(),
             align=left)

wb.save("/sessions/determined-affectionate-wozniak/mnt/outputs/IPA_Template.xlsx")
print("Excel saved OK")
