"""Generate invoice PDFs for the consulting CRM (reportlab)."""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.colors import HexColor

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
BLUE = HexColor("#3b6cf5")
INK = HexColor("#1a1a1a")
GREY = HexColor("#666666")
LIGHT = HexColor("#eeeeee")

CONSULTANT_NAME = "Nathan Blatter"
CONSULTANT_EMAIL = "nzb22@byu.edu"

s_name = ParagraphStyle("name", fontName=FONT_BOLD, fontSize=20, textColor=INK, leading=24)
s_label = ParagraphStyle("label", fontName=FONT_BOLD, fontSize=8, textColor=GREY, leading=11)
s_body = ParagraphStyle("body", fontName=FONT, fontSize=9.5, textColor=INK, leading=13)
s_body_grey = ParagraphStyle("bodygrey", fontName=FONT, fontSize=9.5, textColor=GREY, leading=13)
s_num = ParagraphStyle("num", fontName=FONT, fontSize=9.5, textColor=INK, leading=13, alignment=TA_RIGHT)
s_th = ParagraphStyle("th", fontName=FONT_BOLD, fontSize=8.5, textColor=GREY, leading=11)
s_th_r = ParagraphStyle("thr", fontName=FONT_BOLD, fontSize=8.5, textColor=GREY, leading=11, alignment=TA_RIGHT)
s_invtitle = ParagraphStyle("inv", fontName=FONT_BOLD, fontSize=14, textColor=BLUE, leading=18, alignment=TA_RIGHT)


def _money(cents: int, currency: str = "USD") -> str:
    sym = "$" if currency == "USD" else f"{currency} "
    return f"{sym}{(cents or 0) / 100:,.2f}"


def render_invoice_pdf(invoice, contact=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )
    story = []

    # Header: consultant name (left) + INVOICE block (right)
    header = Table([[
        Paragraph(CONSULTANT_NAME, s_name),
        Paragraph("INVOICE", s_invtitle),
    ]], colWidths=[3.5 * inch, 3.5 * inch])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(header)
    story.append(Paragraph(CONSULTANT_EMAIL, s_body_grey))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT))
    story.append(Spacer(1, 12))

    # Meta: Bill To (left) + invoice details (right)
    bill_to = contact.name if contact else "—"
    if contact and contact.company_name:
        bill_to += f"<br/>{contact.company_name}"
    if contact and contact.email:
        bill_to += f"<br/>{contact.email}"

    details = [
        ["Invoice #", invoice.number],
        ["Issued", invoice.issue_date.strftime("%b %d, %Y") if invoice.issue_date else "—"],
        ["Due", invoice.due_date.strftime("%b %d, %Y") if invoice.due_date else "—"],
        ["Status", invoice.status.value.title()],
    ]
    detail_rows = [[Paragraph(k, s_label), Paragraph(str(v), s_num)] for k, v in details]
    detail_tbl = Table(detail_rows, colWidths=[1.2 * inch, 2.0 * inch])
    detail_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))

    meta = Table([[
        Paragraph("BILL TO", s_label),
        "",
    ], [
        Paragraph(bill_to, s_body),
        detail_tbl,
    ]], colWidths=[3.7 * inch, 3.3 * inch])
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(meta)
    story.append(Spacer(1, 18))

    # Line items table
    rows = [[
        Paragraph("DESCRIPTION", s_th),
        Paragraph("QTY", s_th_r),
        Paragraph("RATE", s_th_r),
        Paragraph("AMOUNT", s_th_r),
    ]]
    for li in sorted(invoice.line_items, key=lambda x: x.sort_order):
        rows.append([
            Paragraph(li.description, s_body),
            Paragraph(f"{float(li.quantity):g}", s_num),
            Paragraph(_money(li.unit_price_cents, invoice.currency), s_num),
            Paragraph(_money(li.amount_cents, invoice.currency), s_num),
        ])
    items = Table(rows, colWidths=[3.7 * inch, 0.8 * inch, 1.25 * inch, 1.25 * inch])
    items.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, GREY),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(items)
    story.append(Spacer(1, 10))

    # Totals
    totals = [["Subtotal", _money(invoice.subtotal_cents, invoice.currency)]]
    if invoice.tax_cents:
        totals.append(["Tax", _money(invoice.tax_cents, invoice.currency)])
    totals.append(["Total", _money(invoice.total_cents, invoice.currency)])
    if invoice.amount_paid_cents:
        totals.append(["Paid", "-" + _money(invoice.amount_paid_cents, invoice.currency)])
        totals.append(["Balance Due", _money(invoice.total_cents - invoice.amount_paid_cents, invoice.currency)])

    trows = []
    for i, (k, v) in enumerate(totals):
        bold = k in ("Total", "Balance Due")
        kstyle = ParagraphStyle("tk", parent=s_num, fontName=FONT_BOLD if bold else FONT, textColor=INK if bold else GREY)
        vstyle = ParagraphStyle("tv", parent=s_num, fontName=FONT_BOLD if bold else FONT, textColor=BLUE if bold else INK)
        trows.append([Paragraph(k, kstyle), Paragraph(v, vstyle)])
    ttable = Table(trows, colWidths=[1.5 * inch, 1.5 * inch])
    ttable.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, LIGHT),
    ]))
    wrap = Table([["", ttable]], colWidths=[4.0 * inch, 3.0 * inch])
    wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(wrap)

    if invoice.notes:
        story.append(Spacer(1, 18))
        story.append(Paragraph("NOTES", s_label))
        story.append(Paragraph(invoice.notes.replace("\n", "<br/>"), s_body_grey))

    doc.build(story)
    return buf.getvalue()
