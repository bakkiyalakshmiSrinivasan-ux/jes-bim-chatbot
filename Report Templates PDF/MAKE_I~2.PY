from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                 Paragraph, Spacer, HRFlowable)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import KeepTogether

W, H = A4  # 210 x 297 mm

# ── Colours ────────────────────────────────────────────────────────────────────
NAVY    = colors.HexColor("#1F4E79")
BLUE    = colors.HexColor("#2E75B6")
LTBLUE  = colors.HexColor("#D6E4F0")
MIDBLUE = colors.HexColor("#BDD7EE")
WHITE   = colors.white
BLACK   = colors.black
RED     = colors.HexColor("#C00000")

# ── Styles ─────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def style(name, parent='Normal', **kw):
    s = ParagraphStyle(name, parent=styles[parent], **kw)
    return s

S_TITLE  = style('title',  fontSize=14, textColor=WHITE, alignment=TA_CENTER,
                  fontName='Helvetica-Bold', spaceAfter=0, spaceBefore=0)
S_HDRLBL = style('hdrlbl', fontSize=8,  textColor=BLACK, fontName='Helvetica-Bold',
                  alignment=TA_LEFT,   spaceAfter=0, spaceBefore=0)
S_HDRVAL = style('hdrval', fontSize=8,  textColor=BLACK, fontName='Helvetica',
                  alignment=TA_LEFT,   spaceAfter=0, spaceBefore=0)
S_TBLHDR = style('tblhdr', fontSize=8,  textColor=WHITE, fontName='Helvetica-Bold',
                  alignment=TA_CENTER, spaceAfter=0, spaceBefore=0)
S_ITEM   = style('item',   fontSize=8,  textColor=BLACK, fontName='Helvetica-Bold',
                  alignment=TA_CENTER, spaceAfter=0, spaceBefore=0)
S_DESC   = style('desc',   fontSize=8,  textColor=BLACK, fontName='Helvetica',
                  alignment=TA_LEFT,   spaceAfter=0, spaceBefore=0)
S_DESCB  = style('descb',  fontSize=8,  textColor=BLACK, fontName='Helvetica-Bold',
                  alignment=TA_LEFT,   spaceAfter=0, spaceBefore=0)
S_AMT    = style('amt',    fontSize=8,  textColor=BLACK, fontName='Helvetica',
                  alignment=TA_RIGHT,  spaceAfter=0, spaceBefore=0)
S_AMTB   = style('amtb',   fontSize=8,  textColor=BLACK, fontName='Helvetica-Bold',
                  alignment=TA_RIGHT,  spaceAfter=0, spaceBefore=0)
S_WORDS  = style('words',  fontSize=8,  textColor=NAVY, fontName='Helvetica-Bold',
                  alignment=TA_LEFT,   spaceAfter=0, spaceBefore=0)
S_NOTE   = style('note',   fontSize=7.5, textColor=BLACK, fontName='Helvetica',
                  alignment=TA_LEFT,   spaceAfter=0, spaceBefore=0)
S_SIG    = style('sig',    fontSize=8,  textColor=BLACK, fontName='Helvetica-Bold',
                  alignment=TA_CENTER, spaceAfter=0, spaceBefore=0)
S_PROJ   = style('proj',   fontSize=9,  textColor=BLACK, fontName='Helvetica-Bold',
                  alignment=TA_LEFT,   spaceAfter=2, spaceBefore=2)

PAGE_W = W - 2*cm  # usable width

def build_pdf(filename, sheet_title, items, is_altayer=False):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        title="Interim Payment Application Template",
        author="Joseph Engineering Services"
    )
    story = []

    # ── Logo banner ──────────────────────────────────────────────────────────
    logo_data = [[Paragraph(
        '<font color="white"><b>JOSEPH ENGINEERING SERVICES</b></font>'
        '&nbsp;&nbsp;|&nbsp;&nbsp;<font color="#BDD7EE">INTERIM PAYMENT APPLICATION</font>',
        style('lgb', fontSize=13, fontName='Helvetica-Bold',
              alignment=TA_LEFT, textColor=WHITE,
              spaceAfter=0, spaceBefore=0))]]
    logo_tbl = Table(logo_data, colWidths=[PAGE_W], rowHeights=[18*mm])
    logo_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(logo_tbl)
    story.append(Spacer(1, 2*mm))

    # ── Title bar ────────────────────────────────────────────────────────────
    title_data = [[Paragraph("INTERIM PAYMENT APPLICATION", S_TITLE)]]
    title_tbl = Table(title_data, colWidths=[PAGE_W], rowHeights=[10*mm])
    title_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BLUE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(title_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Header two-column block ───────────────────────────────────────────────
    # Left col labels + values  |  Right col labels + values
    half = PAGE_W / 2 - 1*mm
    LBL_W = 38*mm
    VAL_W = half - LBL_W

    left_rows = [
        ("CUSTOMER", "", True),   # section header
        ("Company Name:", ""),
        ("Address:", ""),
        ("Phone:", ""),
        ("Fax:", ""),
        ("Email:", ""),
        ("Website:", ""),
        ("Contact:", ""),
        ("TRN No:", ""),
    ]
    right_rows = [
        ("PAYMENT DETAILS", "", True),
        ("Payment Application No.:", ""),
        ("Date:", ""),
        ("Work Done up to:", ""),
        ("Document No.:", ""),
        ("Due Date:", ""),
        ("Contract Value (AED):", ""),
        ("Approved Variation (AED):", ""),
        ("Revised Contract Value (AED):", ""),
    ]
    if is_altayer:
        right_rows.append(("Advance Payment %:", ""))
    right_rows.append(("Overall Completion:", ""))

    # Pad to same length
    while len(left_rows) < len(right_rows):
        left_rows.append(("", ""))
    while len(right_rows) < len(left_rows):
        right_rows.append(("", ""))

    hdr_combined = []
    for (ll, lv, *lf), (rl, rv, *rf) in zip(left_rows, right_rows):
        is_lhdr = bool(lf)
        is_rhdr = bool(rf)
        hdr_combined.append([
            Paragraph(ll, S_HDRLBL),
            Paragraph(lv if lv else ("" if not is_lhdr else ""), S_HDRVAL),
            Paragraph(rl, S_HDRLBL),
            Paragraph(rv if rv else "", S_HDRVAL),
        ])

    hdr_tbl = Table(
        hdr_combined,
        colWidths=[LBL_W, VAL_W, LBL_W, VAL_W],
        rowHeights=[7*mm] * len(hdr_combined)
    )

    # Build style commands
    hdr_style_cmds = [
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]
    for i, ((ll, lv, *lf), (rl, rv, *rf)) in enumerate(zip(left_rows, right_rows)):
        if lf:
            hdr_style_cmds += [
                ('BACKGROUND', (0,i), (1,i), BLUE),
                ('TEXTCOLOR', (0,i), (1,i), WHITE),
                ('FONTNAME', (0,i), (1,i), 'Helvetica-Bold'),
            ]
        else:
            hdr_style_cmds.append(('BACKGROUND', (0,i), (0,i), LTBLUE))
        if rf:
            hdr_style_cmds += [
                ('BACKGROUND', (2,i), (3,i), BLUE),
                ('TEXTCOLOR', (2,i), (3,i), WHITE),
                ('FONTNAME', (2,i), (3,i), 'Helvetica-Bold'),
            ]
        else:
            hdr_style_cmds.append(('BACKGROUND', (2,i), (2,i), LTBLUE))

    hdr_tbl.setStyle(TableStyle(hdr_style_cmds))
    story.append(hdr_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Project / Scope ───────────────────────────────────────────────────────
    proj_data = [
        [Paragraph("<b>Project:</b>", S_PROJ), Paragraph("___________________________________", S_PROJ)],
        [Paragraph("<b>Scope:</b>",   S_PROJ), Paragraph("___________________________________", S_PROJ)],
    ]
    proj_tbl = Table(proj_data, colWidths=[25*mm, PAGE_W-25*mm])
    proj_tbl.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
    story.append(proj_tbl)
    story.append(Spacer(1, 2*mm))

    # ── Line items table ──────────────────────────────────────────────────────
    ITEM_W = 10*mm
    DESC_W = PAGE_W - ITEM_W - 3*45*mm
    COL_W  = 45*mm

    tbl_header = [
        Paragraph("Item", S_TBLHDR),
        Paragraph("Description", S_TBLHDR),
        Paragraph("Previous\nCertificate (AED)", S_TBLHDR),
        Paragraph("This Application\n(AED)", S_TBLHDR),
        Paragraph("Cumulative\n(AED)", S_TBLHDR),
    ]

    def blank():  return Paragraph("", S_AMT)
    def line(letter, desc, bold=False):
        ds = S_DESCB if bold else S_DESC
        as_ = S_AMTB if bold else S_AMT
        return [
            Paragraph(letter, S_ITEM),
            Paragraph(desc, ds),
            blank(), blank(), blank()
        ]

    tbl_data = [tbl_header] + items

    col_widths = [ITEM_W, DESC_W, COL_W, COL_W, COL_W]
    line_tbl = Table(tbl_data, colWidths=col_widths,
                     rowHeights=[10*mm] + [8*mm]*(len(tbl_data)-1))

    ts = TableStyle([
        # Header row
        ('BACKGROUND', (0,0), (-1,0), BLUE),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (4,-1), 'RIGHT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ])

    # Colour total rows and item-letter col
    for i, row in enumerate(tbl_data[1:], start=1):
        letter = row[0].text if hasattr(row[0], 'text') else ""
        # Item letter column always LTBLUE
        ts.add('BACKGROUND', (0,i), (0,i), LTBLUE)
        ts.add('FONTNAME', (0,i), (0,i), 'Helvetica-Bold')

    line_tbl.setStyle(ts)
    story.append(line_tbl)
    story.append(Spacer(1, 2*mm))

    # ── Amount in words ───────────────────────────────────────────────────────
    words_data = [[
        Paragraph("<b>AED</b>", S_TBLHDR),
        Paragraph("Amount in Words (AED): _____________________________________________ Only", S_WORDS),
    ]]
    words_tbl = Table(words_data, colWidths=[ITEM_W, PAGE_W-ITEM_W], rowHeights=[9*mm])
    words_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), BLUE),
        ('BACKGROUND', (1,0), (1,0), LTBLUE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(words_tbl)
    story.append(Spacer(1, 3*mm))

    # ── Note ──────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "Please do not hesitate to contact undersigned for any further clarifications.",
        S_NOTE))
    story.append(Spacer(1, 4*mm))

    # ── Signature block ───────────────────────────────────────────────────────
    sig_blank = [["", ""]]
    sig_tbl_b = Table(sig_blank, colWidths=[PAGE_W/2 - 2*mm, PAGE_W/2 - 2*mm], rowHeights=[20*mm])
    sig_tbl_b.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
    ]))
    story.append(sig_tbl_b)

    sig_labels = [[
        Paragraph("Joseph Engineering Services", S_SIG),
        Paragraph("Received by", S_SIG),
    ]]
    sig_tbl_l = Table(sig_labels, colWidths=[PAGE_W/2 - 2*mm, PAGE_W/2 - 2*mm], rowHeights=[8*mm])
    sig_tbl_l.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LTBLUE),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(sig_tbl_l)

    doc.build(story)
    print(f"PDF saved: {filename}")


# ── Build Sheet 1: AFE / Golf Hills ──────────────────────────────────────────
afe_items = [
    [Paragraph("A", S_ITEM), Paragraph("MEP", S_DESC),                          Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("B", S_ITEM), Paragraph("ARCH", S_DESC),                         Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("C", S_ITEM), Paragraph("On Site Co-Ordinator", S_DESC),          Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("D", S_ITEM), Paragraph("Total Value of Work Done", S_DESCB),     Paragraph("", S_AMTB), Paragraph("", S_AMTB), Paragraph("", S_AMTB)],
    [Paragraph("E", S_ITEM), Paragraph("(-) Certified Value / Advance Payment", S_DESC), Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("F", S_ITEM), Paragraph("(-) Retention", S_DESC),                Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("G", S_ITEM), Paragraph("(+) Release of Retention", S_DESC),     Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("H", S_ITEM), Paragraph("Other Additions / Deductions", S_DESC), Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("I", S_ITEM), Paragraph("Total Amount of Additions / Deductions", S_DESCB), Paragraph("", S_AMTB), Paragraph("", S_AMTB), Paragraph("", S_AMTB)],
    [Paragraph("J", S_ITEM), Paragraph("Total Payment on this Certificate (D-I)", S_DESCB), Paragraph("", S_AMTB), Paragraph("", S_AMTB), Paragraph("", S_AMTB)],
]

build_pdf(
    "/sessions/determined-affectionate-wozniak/mnt/outputs/IPA_Template_AFE_Style.pdf",
    "AFE / Golf Hills Style",
    afe_items,
    is_altayer=False
)

# ── Build Sheet 2: AlTayer / Orla Towers ─────────────────────────────────────
altayer_items = [
    [Paragraph("A", S_ITEM), Paragraph("Project Completion [Month - Year]", S_DESC),     Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("B", S_ITEM), Paragraph("On Site Co-Ordinator", S_DESC),                  Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("C", S_ITEM), Paragraph("Additional Items / Scope", S_DESC),              Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("D", S_ITEM), Paragraph("Total Value of Work Done", S_DESCB),             Paragraph("", S_AMTB), Paragraph("", S_AMTB), Paragraph("", S_AMTB)],
    [Paragraph("E", S_ITEM), Paragraph("(-) Advance Payment (% × D)  see header", S_DESC), Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("F", S_ITEM), Paragraph("(-) Retention", S_DESC),                        Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("G", S_ITEM), Paragraph("(+) Release of Retention", S_DESC),             Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("H", S_ITEM), Paragraph("Other Additions / Deductions", S_DESC),         Paragraph("", S_AMT), Paragraph("", S_AMT), Paragraph("", S_AMT)],
    [Paragraph("I", S_ITEM), Paragraph("Total Amount of Additions / Deductions", S_DESCB), Paragraph("", S_AMTB), Paragraph("", S_AMTB), Paragraph("", S_AMTB)],
    [Paragraph("J", S_ITEM), Paragraph("Total Payment on this Certificate (D-I)", S_DESCB), Paragraph("", S_AMTB), Paragraph("", S_AMTB), Paragraph("", S_AMTB)],
]

build_pdf(
    "/sessions/determined-affectionate-wozniak/mnt/outputs/IPA_Template_AlTayer_Style.pdf",
    "AlTayer / Orla Towers Style",
    altayer_items,
    is_altayer=True
)
