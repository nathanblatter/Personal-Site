"""
Seed the database with the current hardcoded portfolio data.

Run from the backend/ directory:
    python seed.py

Or inside the container after migrations:
    docker compose exec api python seed.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app import models

# ── Data ──────────────────────────────────────────────────────────────────────

PROJECTS = [
    {
        "project_id": "ai-web-app",
        "title": "Full-Stack AI Web Application",
        "description": (
            "Real-time voice-enabled AI system supporting scalable cloud deployment and "
            "structured SQL data storage. Built for clinical research deployment with 200+ "
            "development hours."
        ),
        "tags": ["React", "WebRTC", "AWS EC2", "AWS RDS", "SQL"],
        "year": "2025\u20132026",
        "color": "#3b6cf5",
        "status": "live",
        "link": "https://byu.edu",
        "sort_order": 0,
    },
    {
        "project_id": "ml-analytics",
        "title": "ML Analytics Pipeline",
        "description": (
            "End-to-end analytics workflows to extract insights from large qualitative datasets "
            "using Python, vector embeddings, and similarity scoring for research decision-making."
        ),
        "tags": ["Python", "SQL", "Vector Embeddings", "ML"],
        "year": "2024\u20132026",
        "color": "#7c5cf5",
        "status": "live",
        "link": "https://byu.edu",
        "sort_order": 1,
    },
    {
        "project_id": "ella-rises-crm",
        "title": "Full-Stack CRM \u2014 Ella Rises",
        "description": (
            "Enterprise-grade CRM system with normalized database design, role-based access "
            "control, API integrations, and live operational dashboards for a real client."
        ),
        "tags": ["Node.js", "SQL", "JavaScript", "AWS EC2", "AWS RDS"],
        "year": "2025",
        "color": "#38b2ac",
        "status": "live",
        "link": "https://byu.edu",
        "sort_order": 2,
    },
    {
        "project_id": "byu-production",
        "title": "BYU Production Services Platform",
        "description": (
            "Refactoring legacy PHP systems into Python using FastAPI to enhance performance and "
            "maintainability. Developing e-commerce solutions for university production services."
        ),
        "tags": ["Python", "FastAPI", "PHP", "E-commerce"],
        "year": "2026",
        "color": "#06b6d4",
        "status": "wip",
        "link": "https://byu.edu",
        "sort_order": 3,
    },
    {
        "project_id": "amcis-research",
        "title": "AMCIS 2025 Research Publication",
        "description": (
            'Co-authored "Human + AI Therapy: A Hybrid Mental Health Approach" published at '
            "AMCIS 2025 in Montreal. Analyzed qualitative data and translated findings into "
            "publishable research."
        ),
        "tags": ["Python", "Research", "AI/ML", "Data Analysis"],
        "year": "2025",
        "color": "#e25555",
        "status": "live",
        "link": "https://byu.edu",
        "sort_order": 4,
    },
    {
        "project_id": "portfolio-site",
        "title": "Personal Portfolio Site",
        "description": (
            "This portfolio \u2014 a clean, responsive personal site built with React, TypeScript, "
            "and Tailwind CSS with Framer Motion animations."
        ),
        "tags": ["React", "TypeScript", "Tailwind CSS", "Framer Motion"],
        "year": "2026",
        "color": "#22c55e",
        "status": "live",
        "link": "https://byu.edu",
        "sort_order": 5,
    },
]

SKILLS = [
    {"name": "JavaScript / TypeScript", "level": 90, "category": "Web", "sort_order": 0},
    {"name": "Python", "level": 85, "category": "Lang", "sort_order": 1},
    {"name": "C# / .NET", "level": 80, "category": "Lang", "sort_order": 2},
    {"name": "Java", "level": 78, "category": "Lang", "sort_order": 3},
    {"name": "SQL / PostgreSQL", "level": 88, "category": "Data", "sort_order": 4},
    {"name": "React / Next.js", "level": 88, "category": "Front", "sort_order": 5},
    {"name": "Node.js / Express", "level": 85, "category": "Back", "sort_order": 6},
    {"name": "AWS (S3, EC2, RDS)", "level": 78, "category": "Cloud", "sort_order": 7},
    {"name": "Tableau / Power BI", "level": 82, "category": "BI", "sort_order": 8},
    {"name": "Excel / VBA / Pandas", "level": 85, "category": "Data", "sort_order": 9},
]

EXPERIENCE = [
    {
        "year": "March 2026 \u2014 Present",
        "title": "Full Stack Software Engineer",
        "subtitle": "BYU Production Services (Print, Mail, Laundry)",
        "description": (
            "Refactoring legacy PHP systems into Python using FastAPI to enhance performance and "
            "maintainability. Developing software solutions for e-commerce operations. "
            "Collaborating with cross-functional teams on technology integration."
        ),
        "active": True,
        "sort_order": 0,
    },
    {
        "year": "January 2025 \u2014 Present",
        "title": "AI Research Assistant",
        "subtitle": "BYU Marriott School of Business \u2014 Professor James Gaskin",
        "description": (
            'Published "Human + AI Therapy: A Hybrid Mental Health Approach" at AMCIS 2025 '
            "(Montreal). Product Manager and Lead Developer of voice-enabled AI agent (WebRTC, "
            "SQL) for clinical study. Analyzed large qualitative datasets with vector embeddings "
            "and similarity scoring."
        ),
        "active": True,
        "sort_order": 1,
    },
    {
        "year": "September 2024 \u2014 April 2026",
        "title": "Mentor & Teaching Assistant",
        "subtitle": "BYU IS Department \u2014 IS 201",
        "description": (
            "Taught SQL, VBA, data analysis, visualization (Excel, Tableau), and web development "
            "(HTML, CSS, JavaScript). Developed instructional materials and delivered hands-on "
            "guidance through assignments."
        ),
        "active": False,
        "sort_order": 2,
    },
    {
        "year": "2024 \u2014 Apr 2027",
        "title": "B.S. Information Systems",
        "subtitle": "Brigham Young University \u2014 Marriott School of Business",
        "description": (
            "Full-Stack Software Engineering emphasis. Data Analytics Focus, STEM-Designated "
            "Program. GPA: 3.64. Member of the Association for Information Systems."
        ),
        "active": True,
        "sort_order": 3,
    },
    {
        "year": "June 2021 \u2014 June 2023",
        "title": "Volunteer Representative",
        "subtitle": "The Church of Jesus Christ of Latter-day Saints \u2014 Tempe, AZ",
        "description": (
            "Developed and delivered daily lessons strengthening public speaking and adaptability. "
            "Provided leadership through training, goal setting, and performance feedback. "
            "Crafted custom analytics-based solutions using proprietary software to support efforts."
        ),
        "active": False,
        "sort_order": 4,
    },
    {
        "year": "August 2019 \u2014 August 2020",
        "title": "Inventory Management Intern",
        "subtitle": "Watches.com \u2014 Danville, CA",
        "description": (
            "Analyzed inventory with Excel to track 500+ SKUs across 2 warehouses. Supported "
            "multiple Kickstarter product launches ensuring accurate stock levels and on-time "
            "fulfillment."
        ),
        "active": False,
        "sort_order": 5,
    },
]

ABOUT = {
    "id": 1,
    "bio_paragraphs": [
        (
            "I'm an Information Systems student at BYU's Marriott School of Business with a "
            "Full-Stack Software Engineering emphasis. I build at the intersection of business "
            "strategy and technology \u2014 from AI-driven research platforms to enterprise-grade "
            "CRM systems."
        ),
        (
            "My work spans voice-enabled AI agents deployed for clinical research, full-stack web "
            "applications on AWS, and ML analytics pipelines using vector embeddings. I've "
            "published research at AMCIS 2025 and am passionate about advancing mental health "
            "access through AI-powered therapy."
        ),
        (
            "When I'm not coding, you'll find me playing basketball, out on the golf course, "
            "watching Survivor (strategy and teamwork fan), or spending time with family."
        ),
    ],
    "facts": [
        {"icon": "BookOpen", "text": "IS Major \u2014 BYU"},
        {"icon": "Coffee", "text": "Published Researcher"},
        {"icon": "Code2", "text": "Full-Stack Engineer"},
        {"icon": "Gamepad2", "text": "Basketball & Golf"},
    ],
    "headshot_url": "/headshot.jpg",
    "status_text": "Open to opportunities",
    "info_fields": [
        {"label": "Focus", "value": "Information Systems"},
        {"label": "Emphasis", "value": "Full-Stack Software Engineering"},
        {"label": "Year", "value": "Junior \u2014 Graduating Apr 2027"},
        {"label": "GPA", "value": "3.64"},
        {"label": "Interests", "value": "AI, Analytics, Enterprise Systems"},
    ],
}

INTERESTS = [
    {
        "icon": "Brain",
        "label": "AI & Machine Learning",
        "desc": "Voice-enabled AI, vector embeddings, NLP",
        "sort_order": 0,
    },
    {
        "icon": "Database",
        "label": "Database Design",
        "desc": "Normalized schemas, PostgreSQL, SQL",
        "sort_order": 1,
    },
    {
        "icon": "BarChart3",
        "label": "Data Analytics",
        "desc": "Tableau, Power BI, Pandas, R",
        "sort_order": 2,
    },
    {
        "icon": "Globe",
        "label": "Full-Stack Development",
        "desc": "React, Node.js, Next.js, C# / .NET",
        "sort_order": 3,
    },
    {
        "icon": "Server",
        "label": "Cloud & Infrastructure",
        "desc": "AWS (S3, EC2, RDS), GCP, Azure",
        "sort_order": 4,
    },
    {
        "icon": "Code2",
        "label": "Systems Integration",
        "desc": "Enterprise platforms, API design, FastAPI",
        "sort_order": 5,
    },
]

COURSEWORK = [
    {"name": "Database Systems", "sort_order": 0},
    {"name": "Data Communication", "sort_order": 1},
    {"name": "Exploratory Data Analysis", "sort_order": 2},
    {"name": "JavaScript", "sort_order": 3},
    {"name": "Python", "sort_order": 4},
    {"name": "Enterprise Application Development (C#, .NET)", "sort_order": 5},
    {"name": "Machine Learning", "sort_order": 6},
    {"name": "Product Management", "sort_order": 7},
]

SOCIALS = [
    {
        "icon": "Github",
        "label": "GitHub",
        "handle": "@nathanblatter",
        "href": "https://github.com/nathanblatter",
        "sort_order": 0,
    },
    {
        "icon": "Linkedin",
        "label": "LinkedIn",
        "handle": "Nathan Blatter",
        "href": "https://www.linkedin.com/in/nathanblatter/",
        "sort_order": 1,
    },
    {
        "icon": "Mail",
        "label": "Email",
        "handle": "nzb22@byu.edu",
        "href": "mailto:nzb22@byu.edu",
        "sort_order": 2,
    },
]

CONTACT_META = {
    "id": 1,
    "heading": "Get in Touch",
    "subheading": "Have a project idea, opportunity, or just want to say hi?",
    "body_text": (
        "I'm always interested in hearing about internships, research collaborations, or "
        "opportunities to build something meaningful with technology."
    ),
    "location_text": "Provo UT, San Francisco CA \u2014 Available for remote & local",
}


# ── Editable site content (/now, /uses) ──────────────────────────────────────

NOW_CONTENT = {
    "last_updated": "June 2026",
    "sections": [
        {
            "icon": "Hammer",
            "title": "Building",
            "items": [
                "Growing this site into a consulting CRM — contracts, invoicing, and client scheduling.",
                "A handful of full-stack side projects with FastAPI, React, and Postgres.",
            ],
        },
        {
            "icon": "BookOpen",
            "title": "Learning",
            "items": [
                "Going deeper on agentic AI systems and how to build with them well.",
                "Sharpening distributed systems and database internals.",
            ],
        },
        {
            "icon": "Compass",
            "title": "Focused on",
            "items": [
                "Coursework at BYU and shipping things that real people use.",
                "Taking on a few select consulting engagements.",
            ],
        },
        {
            "icon": "Coffee",
            "title": "Outside of work",
            "items": [
                "Reading, time with family, and staying involved at church.",
            ],
        },
    ],
}

USES_CONTENT = {
    "categories": [
        {
            "icon": "Laptop",
            "title": "Hardware",
            "items": [
                {"name": "Mac Mini (M-series)", "note": "Home server — runs this site, Docker, and the CI runner"},
                {"name": "MacBook", "note": "Daily driver for development"},
                {"name": "External monitor + mechanical keyboard", "note": "Desk setup"},
            ],
        },
        {
            "icon": "Code2",
            "title": "Editor & Dev",
            "items": [
                {"name": "VS Code", "note": "Primary editor"},
                {"name": "Claude Code", "note": "AI pair-programming in the terminal"},
                {"name": "iTerm2 + zsh", "note": "Shell"},
                {"name": "Git + GitHub", "note": "Version control & CI/CD"},
            ],
        },
        {
            "icon": "Server",
            "title": "Stack",
            "items": [
                {"name": "React + TypeScript + Vite", "note": "Frontend"},
                {"name": "Tailwind CSS", "note": "Styling"},
                {"name": "FastAPI (Python)", "note": "Backend APIs"},
                {"name": "PostgreSQL", "note": "Database"},
                {"name": "Docker Compose", "note": "Local + prod orchestration"},
            ],
        },
        {
            "icon": "Wrench",
            "title": "Services & Tools",
            "items": [
                {"name": "Cloudflare", "note": "DNS, CDN, and tunnels"},
                {"name": "Umami", "note": "Privacy-friendly, self-hosted analytics"},
                {"name": "Zoom", "note": "Client calls"},
                {"name": "Figma", "note": "Design & mockups"},
            ],
        },
    ],
}

SITE_CONTENT = {"now": NOW_CONTENT, "uses": USES_CONTENT}

# Logos already live in image storage; image_key is the storage path under
# /api/v1/storage/download/.
CERTIFICATIONS = [
    {
        "name": "Professional Scrum Master I",
        "issuer": "Scrum.org",
        "image_key": "certs/psm1.png",
        "verify_url": "https://www.credly.com/badges/32fb3752-e53f-4f0f-8699-0e4ac8c24897/public_url",
    },
    {
        "name": "Claude 101",
        "issuer": "Anthropic Education",
        "image_key": "uploads/5fcb8471941a4d959ccd449bceed55fe.png",
        "verify_url": "https://verify.skilljar.com/c/73tzbqpcbe5p",
    },
    {
        "name": "Claude Code 101",
        "issuer": "Anthropic Education",
        "image_key": "uploads/5fcb8471941a4d959ccd449bceed55fe.png",
        "verify_url": "https://verify.skilljar.com/c/b7vmfwh6b5od",
    },
    {
        "name": "Claude Platform 101",
        "issuer": "Anthropic Education",
        "image_key": "uploads/5fcb8471941a4d959ccd449bceed55fe.png",
        "verify_url": "https://verify.skilljar.com/c/54yaiiv7tg97",
    },
    {
        "name": "AI Fluency: Framework & Foundations",
        "issuer": "Anthropic Education",
        "image_key": "uploads/5fcb8471941a4d959ccd449bceed55fe.png",
        "verify_url": "https://verify.skilljar.com/c/rh7mnwth9jt5",
    },
    {
        "name": "Introduction to Claude Cowork",
        "issuer": "Anthropic Education",
        "image_key": "uploads/5fcb8471941a4d959ccd449bceed55fe.png",
        "verify_url": "https://verify.skilljar.com/c/sgcvp2oqfhpj",
    },
    {
        "name": "Claude Code in Action",
        "issuer": "Anthropic Education",
        "image_key": "uploads/5fcb8471941a4d959ccd449bceed55fe.png",
        "verify_url": "https://verify.skilljar.com/c/7pi2rei6yo3m",
    },
]


# ── Seed logic ────────────────────────────────────────────────────────────────

async def ensure_site_content(db) -> None:
    """Backfill default /now and /uses content for any key that's missing.

    Idempotent and independent of the main seed guard, so it runs on every
    deploy and never overwrites content edited through the admin panel.
    """
    from datetime import datetime, timezone
    added = False
    for key, data in SITE_CONTENT.items():
        existing = await db.execute(
            select(models.SiteContent).where(models.SiteContent.key == key)
        )
        if existing.scalar_one_or_none() is None:
            db.add(models.SiteContent(
                key=key, data=data, updated_at=datetime.now(timezone.utc).isoformat()
            ))
            added = True
    if added:
        await db.commit()
        print("Seeded missing site content.")


async def ensure_certifications(db) -> None:
    """Backfill certifications + their auto-tracked verify links once.

    Runs independent of the main seed guard (prod already has projects seeded).
    Only seeds when the table is empty, so it never fights admin edits.
    """
    import re
    existing = await db.execute(select(models.Certification))
    if existing.scalars().first():
        return

    download_prefix = "/api/v1/storage/download/"
    for i, data in enumerate(CERTIFICATIONS):
        verify = (data.get("verify_url") or "").strip()
        link_id = None
        if verify:
            base = "cert-" + re.sub(r"[^a-z0-9]+", "-", data["name"].lower()).strip("-")
            base = base.rstrip("-") or "cert"
            slug, n = base, 1
            while (await db.execute(
                select(models.TrackedLink).where(models.TrackedLink.slug == slug)
            )).scalar_one_or_none() is not None:
                n += 1
                slug = f"{base}-{n}"
            link = models.TrackedLink(slug=slug, destination_url=verify, label=data["name"])
            db.add(link)
            await db.flush()
            link_id = link.id
        db.add(models.Certification(
            name=data["name"],
            issuer=data["issuer"],
            image_key=data.get("image_key"),
            image_url=(download_prefix + data["image_key"]) if data.get("image_key") else None,
            verify_url=verify or None,
            tracked_link_id=link_id,
            sort_order=i,
        ))
    await db.commit()
    print("Seeded certifications.")


RESUME_VARIANTS = [
    {
        "key": "swe",
        "label": "Software Engineering",
        "headline": "Full-Stack Software Engineer (Information Systems, BYU)",
        "summary": (
            "with experience across C#, Java, Python, TypeScript, SQL, and cloud platforms. Builds and ships "
            "production full-stack applications end to end — from data model to UI — with strong ownership, clean "
            "code practices, and measurable technical impact in collaborative teams."
        ),
        "emphasis_tags": ["react", "typescript", "python", "fastapi", "full-stack", "web", "api", "backend", "frontend"],
        "sort_order": 0,
        "is_default": True,
    },
    {
        "key": "data",
        "label": "Data & Analytics",
        "headline": "Data Analyst & Engineer (Information Systems, STEM-designated)",
        "summary": (
            "with a Data Analytics focus and hands-on experience in SQL, Python, BI tooling, and building analytics "
            "pipelines and dashboards. Turns messy data into decisions, pairing a systems background (SCM, ERP) with "
            "modern data engineering to deliver measurable business insight."
        ),
        "emphasis_tags": ["sql", "data", "analytics", "bi", "python", "pandas", "etl", "dashboard"],
        "sort_order": 1,
        "is_default": False,
    },
    {
        "key": "ai",
        "label": "AI / ML",
        "headline": "AI Engineer (Information Systems, BYU)",
        "summary": (
            "building intelligent, AI-driven applications — including a voice-enabled AI platform deployed for clinical "
            "research. Experienced with LLM APIs, agentic systems, retrieval, and shipping AI features into real "
            "products, backed by full-stack engineering depth."
        ),
        "emphasis_tags": ["ai", "ml", "llm", "claude", "openai", "nlp", "agents", "rag"],
        "sort_order": 2,
        "is_default": False,
    },
]


async def ensure_resume_variants(db) -> None:
    """Backfill the SWE/Data/AI résumé flavors once. No-op if any already exist,
    so it never fights admin edits. Runs independent of the main seed guard."""
    existing = await db.execute(select(models.ResumeVariant))
    if existing.scalars().first():
        return
    for data in RESUME_VARIANTS:
        db.add(models.ResumeVariant(**data))
    await db.commit()
    print("Seeded résumé variants.")


async def ensure_normalized_blog_tags(db) -> None:
    """One-time idempotent backfill: normalize existing blog_post.tags arrays.

    For each post's tags: trim + collapse internal whitespace on each tag,
    dedupe case-insensitively while keeping the first-seen casing, and only
    write back if the array actually changed. Runs independent of the main
    seed guard so it applies to already-seeded prod data, and never touches
    posts whose tags are already normalized (so it never fights admin edits
    beyond this normalization pass)."""
    import re
    from sqlalchemy.orm.attributes import flag_modified

    result = await db.execute(select(models.BlogPost))
    posts = result.scalars().all()

    changed_count = 0
    for post in posts:
        original = post.tags or []
        seen_lower = set()
        normalized = []
        for tag in original:
            if not isinstance(tag, str):
                normalized.append(tag)
                continue
            cleaned = re.sub(r"\s+", " ", tag.strip())
            key = cleaned.lower()
            if key in seen_lower:
                continue
            seen_lower.add(key)
            normalized.append(cleaned)

        if normalized != original:
            post.tags = normalized
            flag_modified(post, "tags")
            changed_count += 1

    if changed_count:
        await db.commit()
        print(f"Normalized tags on {changed_count} blog post(s).")


async def seed() -> None:
    # Ensure tables exist (safe to call even after alembic migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Backfill editable content blocks regardless of the seed guard below.
        await ensure_site_content(db)
        await ensure_certifications(db)
        await ensure_resume_variants(db)
        await ensure_normalized_blog_tags(db)

        # Skip if already seeded
        result = await db.execute(select(models.Project))
        if result.scalars().first():
            print("Data already seeded. Skipping.")
            return

        print("Seeding projects...")
        for data in PROJECTS:
            db.add(models.Project(**data))

        print("Seeding skills...")
        for data in SKILLS:
            db.add(models.Skill(**data))

        print("Seeding experience...")
        for data in EXPERIENCE:
            db.add(models.Experience(**data))

        print("Seeding about...")
        db.add(models.About(**ABOUT))

        print("Seeding interests...")
        for data in INTERESTS:
            db.add(models.Interest(**data))

        print("Seeding coursework...")
        for data in COURSEWORK:
            db.add(models.Coursework(**data))

        print("Seeding socials...")
        for data in SOCIALS:
            db.add(models.Social(**data))

        print("Seeding contact meta...")
        db.add(models.ContactMeta(**CONTACT_META))

        await db.commit()
        print("Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
