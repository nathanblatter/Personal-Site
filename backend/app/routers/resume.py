"""Auto-generate a PDF resume from live DB data using reportlab."""

import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

router = APIRouter(prefix="/resume", tags=["resume"])

BLUE = HexColor("#2563eb")
INK = HexColor("#1a1a2e")
STEEL = HexColor("#64748b")


def _styles():
    return {
        "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=18, textColor=INK, alignment=TA_CENTER, spaceAfter=2),
        "tagline": ParagraphStyle("tagline", fontName="Helvetica", fontSize=10, textColor=STEEL, alignment=TA_CENTER, spaceAfter=10),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=11, textColor=BLUE, spaceBefore=14, spaceAfter=4),
        "item_title": ParagraphStyle("item_title", fontName="Helvetica-Bold", fontSize=10, textColor=INK, spaceAfter=1),
        "item_sub": ParagraphStyle("item_sub", fontName="Helvetica-Oblique", fontSize=9, textColor=STEEL, spaceAfter=2),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9, textColor=INK, leading=13, spaceAfter=4),
        "skill": ParagraphStyle("skill", fontName="Helvetica", fontSize=9, textColor=INK, spaceAfter=2),
    }


@router.get("/pdf")
async def resume_pdf(db: AsyncSession = Depends(get_db)):
    about_r = await db.execute(select(models.About).where(models.About.id == 1))
    about = about_r.scalar_one_or_none()

    exp_r = await db.execute(select(models.Experience).order_by(models.Experience.sort_order))
    experiences = exp_r.scalars().all()

    skills_r = await db.execute(select(models.Skill).order_by(models.Skill.sort_order))
    skills = skills_r.scalars().all()

    projects_r = await db.execute(select(models.Project).order_by(models.Project.sort_order))
    projects = projects_r.scalars().all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
    )

    s = _styles()
    story = []

    # Header
    story.append(Paragraph("Nathan Blatter", s["name"]))
    info_parts = []
    if about and about.info_fields:
        for f in about.info_fields:
            info_parts.append(f"{f['label']}: {f['value']}")
    tagline = "nathanblatter.com"
    if info_parts:
        tagline = " | ".join(info_parts[:3]) + f" | {tagline}"
    story.append(Paragraph(tagline, s["tagline"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=STEEL, spaceAfter=8))

    # Experience
    if experiences:
        story.append(Paragraph("Experience", s["section"]))
        for exp in experiences:
            story.append(Paragraph(exp.title, s["item_title"]))
            story.append(Paragraph(f"{exp.subtitle} | {exp.year}", s["item_sub"]))
            story.append(Paragraph(exp.description, s["body"]))

    # Skills
    if skills:
        story.append(Paragraph("Skills", s["section"]))
        cats: dict[str, list[str]] = {}
        for sk in skills:
            cats.setdefault(sk.category, []).append(sk.name)
        for cat, names in cats.items():
            story.append(Paragraph(f"<b>{cat}:</b> {', '.join(names)}", s["skill"]))

    # Projects
    if projects:
        story.append(Paragraph("Projects", s["section"]))
        for proj in projects[:6]:
            tags_str = f" ({', '.join(proj.tags[:4])})" if proj.tags else ""
            story.append(Paragraph(f"{proj.title}{tags_str}", s["item_title"]))
            story.append(Paragraph(proj.description, s["body"]))

    # Education
    if about and about.gpa:
        story.append(Paragraph("Education", s["section"]))
        story.append(Paragraph("Brigham Young University", s["item_title"]))
        story.append(Paragraph(f"B.S. Information Systems | GPA: {about.gpa}", s["item_sub"]))

    doc.build(story)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=nathan-blatter-resume.pdf"},
    )
