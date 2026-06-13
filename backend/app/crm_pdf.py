"""Generate invoice PDFs for the consulting CRM (reportlab).

Designed to mirror the client-facing web invoice: an editorial serif wordmark
(Times stands in for Instrument Serif), a blue accent ribbon, monospaced
numerals (Courier for JetBrains Mono), hairline rules, a large serif total,
and a rotated PAID / OVERDUE stamp.
"""
import io
from functools import partial

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.colors import HexColor

# ── Brand palette (matches frontend index.css) ───────────────────────────────
BLUE = HexColor("#3b6cf5")
BLUE_DIM = HexColor("#2a54d4")
BLUE_GLOW = HexColor("#7ba4fa")
BLUE_WASH = HexColor("#eef3ff")
INK = HexColor("#2d3342")
SLATE = HexColor("#5a6478")
STEEL = HexColor("#8c95a6")
SILVER = HexColor("#c8d0db")
MIST = HexColor("#e4e9f0")
TEAL = HexColor("#38b2ac")
EMBER = HexColor("#e25555")

SERIF = "Times-Roman"
SERIF_I = "Times-Italic"
SANS = "Helvetica"
SANS_B = "Helvetica-Bold"
MONO = "Courier"

CONSULTANT_NAME = "Nathan Blatter"
CONSULTANT_EMAIL = "nzb22@byu.edu"

# Paragraph styles
s_kicker = ParagraphStyle("kicker", fontName=SANS_B, fontSize=8, textColor=BLUE, leading=10, spaceAfter=4)
s_wordmark = ParagraphStyle("wordmark", fontName=SERIF, fontSize=34, textColor=INK, leading=36)
s_email = ParagraphStyle("email", fontName=MONO, fontSize=8, textColor=STEEL, leading=12, spaceBefore=4)
s_label = ParagraphStyle("label", fontName=SANS_B, fontSize=7, textColor=STEEL, leading=10)
s_value = ParagraphStyle("value", fontName=SANS, fontSize=10, textColor=INK, leading=13)
s_value_sm = ParagraphStyle("valuesm", fontName=SANS, fontSize=9.5, textColor=SLATE, leading=13)
s_mono = ParagraphStyle("mono", fontName=MONO, fontSize=9, textColor=INK, leading=13)
s_th = ParagraphStyle("th", fontName=SANS_B, fontSize=7, textColor=STEEL, leading=10)
s_th_r = ParagraphStyle("thr", parent=s_th, alignment=TA_RIGHT)
s_item = ParagraphStyle("item", fontName=SANS, fontSize=10.5, textColor=INK, leading=14)
s_item_mono = ParagraphStyle("itemmono", fontName=MONO, fontSize=9, textColor=INK, leading=14, alignment=TA_RIGHT)
s_item_mono_g = ParagraphStyle("itemmonog", parent=s_item_mono, textColor=STEEL)
s_total_k = ParagraphStyle("totalk", fontName=SANS, fontSize=9.5, textColor=STEEL, leading=13)
s_total_v = ParagraphStyle("totalv", fontName=MONO, fontSize=9.5, textColor=INK, leading=13, alignment=TA_RIGHT)
s_duelabel = ParagraphStyle("duelabel", fontName=SANS_B, fontSize=8, textColor=STEEL, leading=11)
s_thanks = ParagraphStyle("thanks", fontName=SERIF_I, fontSize=14, textColor=STEEL, leading=18)
s_note = ParagraphStyle("note", fontName=SANS, fontSize=9.5, textColor=SLATE, leading=14)
s_pay_label = ParagraphStyle("paylabel", fontName=SANS_B, fontSize=7, textColor=BLUE, leading=11)


def _money(cents, currency="USD"):
    sym = "$" if currency == "USD" else f"{currency} "
    return f"{sym}{(cents or 0) / 100:,.2f}"


def _kv(label, value_para):
    """A small stacked label/value cell."""
    return Table(
        [[Paragraph(label.upper(), s_label)], [value_para]],
        colWidths=[1.7 * inch],
        style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 3),
                          ("BOTTOMPADDING", (0, 1), (0, 1), 0), ("LEFTPADDING", (0, 0), (-1, -1), 0)]),
    )


def _decorate(canvas, doc, status):
    """Draw the full-bleed blue ribbon and (optionally) a status stamp."""
    w, h = letter
    seg = w / 3.0
    for i, col in enumerate((BLUE_DIM, BLUE, BLUE_GLOW)):
        canvas.setFillColor(col)
        canvas.rect(i * seg, h - 6, seg, 6, fill=1, stroke=0)

    if status in ("paid", "overdue"):
        color = TEAL if status == "paid" else EMBER
        text = "PAID" if status == "paid" else "OVERDUE"
        canvas.saveState()
        canvas.translate(w - 1.9 * inch, h - 1.7 * inch)
        canvas.rotate(-14)
        canvas.setStrokeColor(color)
        canvas.setFillColor(color)
        canvas.setStrokeAlpha(0.2)
        canvas.setFillAlpha(0.2)
        canvas.setLineWidth(2.5)
        tw = 1.7 * inch
        canvas.roundRect(-tw / 2, -16, tw, 44, 10, stroke=1, fill=0)
        canvas.setFont(SERIF_I, 30)
        canvas.drawCentredString(0, -2, text)
        canvas.restoreState()


def render_invoice_pdf(invoice, contact=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.85 * inch, bottomMargin=0.7 * inch,
        title=f"Invoice {invoice.number}",
    )
    cur = invoice.currency
    story = []

    # ── Letterhead ────────────────────────────────────────────────────────────
    story.append(Paragraph("INVOICE", s_kicker))
    story.append(Paragraph(f'Nathan <i><font color="#3b6cf5">Blatter</font></i>', s_wordmark))
    story.append(Paragraph(CONSULTANT_EMAIL, s_email))
    story.append(Spacer(1, 30))

    # ── Meta grid ─────────────────────────────────────────────────────────────
    bill_lines = contact.name if contact else "—"
    bill_para = Paragraph(bill_lines, s_value)
    company = Paragraph(contact.company_name, s_value_sm) if (contact and contact.company_name) else Spacer(1, 0)
    bill_to = Table(
        [[Paragraph("BILLED TO", s_label)], [bill_para], [company]],
        colWidths=[2.6 * inch],
        style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 3),
                          ("BOTTOMPADDING", (0, 1), (0, 1), 1), ("LEFTPADDING", (0, 0), (-1, -1), 0)]),
    )

    status_color = {"paid": TEAL, "sent": BLUE, "partial": HexColor("#7c5cf5"),
                    "overdue": EMBER, "draft": STEEL, "void": SILVER}.get(invoice.status.value, BLUE)
    status_para = Paragraph(
        f'<font color="#{status_color.hexval()[2:]}">● {invoice.status.value.title()}</font>',
        ParagraphStyle("status", fontName=SANS_B, fontSize=9.5, leading=13),
    )

    right_meta = Table(
        [
            [Paragraph("INVOICE NO.", s_label), Paragraph("ISSUED", s_label)],
            [Paragraph(invoice.number, s_mono), Paragraph(invoice.issue_date.strftime("%b %d, %Y") if invoice.issue_date else "—", s_value_sm)],
            [Spacer(1, 8), Spacer(1, 8)],
            [Paragraph("STATUS", s_label), Paragraph("DUE", s_label)],
            [status_para, Paragraph(invoice.due_date.strftime("%b %d, %Y") if invoice.due_date else "—", s_value_sm)],
        ],
        colWidths=[1.5 * inch, 1.5 * inch],
        style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                          ("LEFTPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]),
    )

    meta = Table([[bill_to, right_meta]], colWidths=[3.0 * inch, 3.3 * inch])
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(meta)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.75, color=MIST, spaceBefore=0, spaceAfter=14))

    # ── Line items ────────────────────────────────────────────────────────────
    rows = [[
        Paragraph("DESCRIPTION", s_th), Paragraph("QTY", s_th_r),
        Paragraph("RATE", s_th_r), Paragraph("AMOUNT", s_th_r),
    ]]
    for li in sorted(invoice.line_items, key=lambda x: x.sort_order):
        qty = f"{float(li.quantity):g}"
        rows.append([
            Paragraph(li.description, s_item),
            Paragraph(qty, s_item_mono_g),
            Paragraph(_money(li.unit_price_cents, cur), s_item_mono_g),
            Paragraph(_money(li.amount_cents, cur), s_item_mono),
        ])
    items = Table(rows, colWidths=[3.5 * inch, 0.7 * inch, 1.2 * inch, 1.2 * inch])
    style = [
        ("TOPPADDING", (0, 0), (-1, 0), 0), ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("TOPPADDING", (0, 1), (-1, -1), 9), ("BOTTOMPADDING", (0, 1), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    for r in range(1, len(rows)):
        style.append(("LINEABOVE", (0, r), (-1, r), 0.5, MIST))
    items.setStyle(TableStyle(style))
    story.append(items)
    story.append(Spacer(1, 18))

    # ── Totals ────────────────────────────────────────────────────────────────
    paid = invoice.amount_paid_cents or 0
    balance = max(invoice.total_cents - paid, 0)
    summary_rows = [[Paragraph("Subtotal", s_total_k), Paragraph(_money(invoice.subtotal_cents, cur), s_total_v)]]
    if invoice.tax_cents:
        summary_rows.append([Paragraph("Tax", s_total_k), Paragraph(_money(invoice.tax_cents, cur), s_total_v)])
    if paid:
        summary_rows.append([Paragraph("Paid", s_total_k), Paragraph("−" + _money(paid, cur), s_total_v)])

    summary = Table(summary_rows, colWidths=[1.6 * inch, 1.4 * inch])
    summary.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                                 ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    due_label = "Balance due" if (paid and balance > 0) else ("Paid in full" if balance == 0 else "Amount due")
    due_color = TEAL if balance == 0 else BLUE
    due = Table(
        [[Paragraph(due_label.upper(), s_duelabel),
          Paragraph(f'<font color="#{due_color.hexval()[2:]}">{_money(balance, cur)}</font>',
                    ParagraphStyle("due", fontName=SERIF_I, fontSize=26, leading=28, alignment=TA_RIGHT))]],
        colWidths=[1.3 * inch, 1.7 * inch],
    )
    due.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 1.5, INK), ("TOPPADDING", (0, 0), (-1, 0), 8),
                             ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                             ("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))

    totals_stack = Table([[summary], [Spacer(1, 6)], [due]], colWidths=[3.0 * inch])
    totals_stack.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    wrap = Table([["", totals_stack]], colWidths=[3.3 * inch, 3.0 * inch])
    wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(wrap)

    # ── Notes + payment ───────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(HRFlowable(width="100%", thickness=0.75, color=MIST, spaceAfter=14))

    left_cell = []
    if invoice.notes:
        left_cell = [Paragraph("NOTES", s_label), Spacer(1, 4), Paragraph(invoice.notes.replace("\n", "<br/>"), s_note)]
    left = Table([[c] for c in left_cell] or [[Spacer(1, 0)]], colWidths=[3.0 * inch])
    left.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))

    if balance > 0 and invoice.status.value != "void":
        pay_inner = Table(
            [[Paragraph("PAYMENT", s_pay_label)],
             [Paragraph(f'Payable via <b>Venmo</b>. Please reference invoice <font face="Courier">{invoice.number}</font> with your payment.', s_note)]],
            colWidths=[2.7 * inch],
            style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                              ("TOPPADDING", (0, 0), (0, 0), 12), ("BOTTOMPADDING", (0, 0), (0, 0), 4),
                              ("TOPPADDING", (0, 1), (0, 1), 0), ("BOTTOMPADDING", (0, 1), (0, 1), 12),
                              ("BACKGROUND", (0, 0), (-1, -1), BLUE_WASH), ("ROUNDEDCORNERS", [8, 8, 8, 8])]),
        )
    else:
        pay_inner = Spacer(1, 0)

    bottom = Table([[left, pay_inner]], colWidths=[3.2 * inch, 3.1 * inch])
    bottom.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(bottom)

    story.append(Spacer(1, 26))
    story.append(Paragraph("Thank you for your business.", ParagraphStyle("thankc", parent=s_thanks, alignment=1)))

    deco = partial(_decorate, status=invoice.status.value)
    doc.build(story, onFirstPage=deco, onLaterPages=deco)
    return buf.getvalue()
