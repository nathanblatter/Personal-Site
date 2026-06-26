"""Generate a resume PDF matching the Word doc format exactly."""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.colors import HexColor


FONT_NAME = "Times-Roman"
FONT_BOLD = "Times-Bold"
FONT_ITALIC = "Times-Italic"
BODY_SIZE = 10.5
NAME_SIZE = 18
LEADING = 13
BLUE = "#3b6cf5"

GREY = HexColor("#555555")
RULE_COLOR = HexColor("#888888")

s_name = ParagraphStyle("Name", fontName=FONT_BOLD, fontSize=NAME_SIZE, leading=NAME_SIZE + 4, alignment=TA_CENTER, spaceAfter=2)
s_contact = ParagraphStyle("Contact", fontName=FONT_NAME, fontSize=BODY_SIZE, leading=BODY_SIZE + 2, alignment=TA_CENTER, textColor=GREY, spaceAfter=4)
s_summary = ParagraphStyle("Summary", fontName=FONT_NAME, fontSize=BODY_SIZE, leading=LEADING, alignment=TA_JUSTIFY, spaceAfter=2)
s_section = ParagraphStyle("Section", fontName=FONT_BOLD, fontSize=BODY_SIZE, leading=LEADING, spaceBefore=6, spaceAfter=1)
s_body = ParagraphStyle("Body", fontName=FONT_NAME, fontSize=BODY_SIZE, leading=LEADING)
s_body_grey = ParagraphStyle("BodyGrey", fontName=FONT_NAME, fontSize=BODY_SIZE, leading=LEADING, textColor=GREY)
s_body_italic = ParagraphStyle("BodyItalic", fontName=FONT_ITALIC, fontSize=BODY_SIZE, leading=LEADING, textColor=GREY)
s_bullet = ParagraphStyle("Bullet", fontName=FONT_NAME, fontSize=BODY_SIZE, leading=LEADING, leftIndent=12, bulletIndent=0, spaceBefore=0.5)

DOMAIN = "https://nathanblatter.com"


def _link(url: str, text: str) -> str:
    """Create a clickable link in reportlab markup."""
    if url.startswith("/"):
        url = DOMAIN + url
    return f'<a href="{url}"><font color="{BLUE}">{text}</font></a>'


def _table_row(left_html: str, right_html: str) -> Table:
    t = Table(
        [[Paragraph(left_html, s_body), Paragraph(right_html, s_body_grey)]],
        colWidths=["75%", "25%"],
    )
    t.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def _section_rule():
    return HRFlowable(width="100%", thickness=0.5, color=RULE_COLOR, spaceBefore=2, spaceAfter=4)


def generate_resume_pdf(about, experience, skills, projects, coursework, variant=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.4 * inch,
    )

    story = []

    # ── NAME ──
    story.append(Paragraph("Nathan Blatter", s_name))
    story.append(Paragraph(
        f'nzb22@byu.edu | '
        f'{_link(DOMAIN, "nathanblatter.com")} | '
        f'{_link(DOMAIN + "/go/linkedin", "LinkedIn")} | '
        f'{_link(DOMAIN + "/go/github", "GitHub")}',
        s_contact,
    ))

    # ── SUMMARY (variant-aware) ──
    if variant and variant.get("headline") and variant.get("summary"):
        summary_html = f'<b>{variant["headline"]}</b> {variant["summary"]}'
    else:
        summary_html = (
            '<b>Information Systems student (Full-Stack Software Engineering emphasis)</b>'
            ' with experience in C#, Java, Python, SQL, and cloud platforms, complemented by a background in SCM, ERP, and '
            'AI-driven systems. Proven ability to build full-stack analytics and intelligent applications, including a '
            'voice-enabled AI platform deployed for clinical research. Known for strong ownership, clean code practices, '
            'and delivering measurable technical impact in collaborative team environments.'
        )
    story.append(Paragraph(summary_html, s_summary))

    # ── EDUCATION ──
    story.append(Paragraph("<b>EDUCATION</b>", s_section))
    story.append(_section_rule())

    edu = None
    jobs = []
    for e in experience:
        if "B.S." in e["title"] or "Bachelor" in e["title"]:
            edu = e
        else:
            jobs.append(e)

    if edu:
        story.append(_table_row(f'<b>{edu["title"]}</b>', edu["year"]))
        story.append(Paragraph("Data Analytics Focus, STEM-Designated Program", s_body_grey))
        story.append(Paragraph(edu["subtitle"], s_body_grey))
        gpa = about.get("gpa", "")
        if gpa:
            story.append(Paragraph(f"GPA: {gpa}", s_body))
        story.append(Paragraph("Member of the Association for Information Systems", s_body))
        if coursework:
            cw_names = ", ".join(c["name"] for c in coursework)
            story.append(Paragraph(f'<b>Relevant Coursework:</b> {cw_names}', s_body))

    # ── TECHNICAL SKILLS ──
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>TECHNICAL SKILLS</b>", s_section))
    story.append(_section_rule())

    cats: dict[str, list[str]] = {}
    for sk in skills:
        cats.setdefault(sk["category"], []).append(sk["name"])
    if "BI" in cats and "Data" in cats:
        cats["Data"] = cats["Data"] + cats["BI"]
        del cats["BI"]
    elif "BI" in cats:
        cats["Data"] = cats.pop("BI")

    cat_labels = {
        "Data": "Data &amp; BI", "Lang": "Systems Development", "Web": "Web Development",
        "Front": "Frontend", "Back": "Backend", "Cloud": "Cloud &amp; Infrastructure",
    }
    for cat, names in cats.items():
        label = cat_labels.get(cat, cat)
        story.append(Paragraph(f'<b>{label}:</b> {", ".join(names)}', s_body))

    # ── PROJECTS ──
    story.append(Spacer(1, 2))
    story.append(Paragraph("<b>PROJECTS</b>", s_section))
    story.append(_section_rule())

    for proj in projects:
        tags = ", ".join(proj.get("tags", [])[:5])
        year = proj.get("year", "")
        hrs_metric = None
        for m in proj.get("metrics", []):
            if "hr" in m.get("label", "").lower():
                hrs_metric = m["value"]
                break

        header = f'<b>{proj["title"]}</b> ({tags})'
        right_parts = [year]
        if hrs_metric:
            right_parts.append(f"{hrs_metric} hrs")
        link = proj.get("link")
        if link:
            right_parts.append(_link(link, "Link"))
        right = " | ".join(right_parts)

        story.append(_table_row(header, right))

        desc = proj.get("description", "")
        for line in desc.split("\n"):
            line = line.strip().lstrip("•-").strip()
            if line:
                story.append(Paragraph(f"• {line}", s_bullet))

        story.append(Spacer(1, 3))

    # ── EXPERIENCE ──
    story.append(Paragraph("<b>EXPERIENCE</b>", s_section))
    story.append(_section_rule())

    for job in jobs:
        story.append(_table_row(f'<b>{job["title"]}</b>', job["year"]))
        story.append(Paragraph(job["subtitle"], s_body_italic))

        desc = job.get("description", "")
        for line in desc.split("\n"):
            line = line.strip().lstrip("•-").strip()
            if line:
                story.append(Paragraph(f"• {line}", s_bullet))

        story.append(Spacer(1, 5))

    # ── OTHER ACHIEVEMENTS ──
    story.append(Paragraph("<b>OTHER ACHIEVEMENTS</b>", s_section))
    story.append(_section_rule())
    others = [
        "Passionate about advancing mental health access through AI-powered therapy and research",
    ]
    if len(about.get("bio_paragraphs", [])) > 2:
        others.append(about["bio_paragraphs"][2])
    for line in others:
        if line:
            story.append(Paragraph(f"• {line}", s_bullet))

    doc.build(story)
    return buf.getvalue()
