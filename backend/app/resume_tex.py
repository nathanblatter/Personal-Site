"""Generate the resume PDF via LaTeX (Tectonic), Jake's Resume style.

Takes the same data shape as resume_pdf.py (the ReportLab renderer, kept as a
fallback in routers/seo.py). Compilation shells out to the `tectonic` binary
(TECTONIC_BIN env var overrides the path).
"""
import os
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path

DOMAIN = "https://nathanblatter.com"

_SPECIALS = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

_UNICODE = {
    "—": "---",   # em dash
    "–": "--",    # en dash
    "’": "'",
    "‘": "`",
    "“": "``",
    "”": "''",
    "…": r"\ldots{}",
    "•": "",      # bullets come from itemize, not text
    " ": "~",
    "→": r"$\rightarrow$",
    "×": r"$\times$",
    "≤": r"$\leq$",
    "≥": r"$\geq$",
    "·": r"$\cdot$",
    "✓": r"\checkmark{}",
}


def _esc(text: str) -> str:
    """Escape text for safe interpolation into the LaTeX template."""
    if not text:
        return ""
    out = []
    for ch in str(text):
        if ch in _SPECIALS:
            out.append(_SPECIALS[ch])
        elif ch in _UNICODE:
            out.append(_UNICODE[ch])
        elif ord(ch) > 0x7F:
            # Strip accents (é→e); drop anything still non-ascii rather than
            # risk a missing-glyph compile failure.
            base = unicodedata.normalize("NFKD", ch).encode("ascii", "ignore").decode()
            out.append(base)
        else:
            out.append(ch)
    return "".join(out)


def _href(url: str, text: str) -> str:
    if url.startswith("/"):
        url = DOMAIN + url
    safe_url = url.replace("%", r"\%").replace("#", r"\#")
    return rf"\href{{{safe_url}}}{{{text}}}"


def _bullets(description: str) -> str:
    lines = []
    for line in (description or "").split("\n"):
        line = line.strip().lstrip("•-").strip()
        if line:
            lines.append(rf"    \resumeItem{{{_esc(line)}}}")
    if not lines:
        return ""
    return "  \\resumeItemListStart\n" + "\n".join(lines) + "\n  \\resumeItemListEnd\n"


_PREAMBLE = r"""\documentclass[letterpaper,10.5pt]{article}

\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage{tabularx}
\usepackage{xcolor}

\definecolor{linkblue}{HTML}{3B6CF5}
\hypersetup{colorlinks=true, urlcolor=linkblue}

\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.55in}
\addtolength{\evensidemargin}{-0.55in}
\addtolength{\textwidth}{1.1in}
\addtolength{\topmargin}{-0.6in}
\addtolength{\textheight}{1.15in}

\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{\vspace{-5pt}\scshape\raggedright\large}{}{0em}{}[\color{black}\titlerule\vspace{-4pt}]

\newcommand{\resumeItem}[1]{\item\small{#1\vspace{-2pt}}}
\newcommand{\resumeSubheading}[4]{
  \vspace{-1pt}\item
    \begin{tabular*}{\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\renewcommand\labelitemi{$\vcenter{\hbox{\tiny$\bullet$}}$}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeItemListStart}{\begin{itemize}[leftmargin=0.15in]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

\begin{document}
"""

_DEFAULT_SUMMARY = (
    r"\textbf{Information Systems student (Full-Stack Software Engineering emphasis)}"
    " with experience in Python, Go, C\\#, PHP, SQL, and cloud platforms, complemented by a"
    " background in SCM, ERP, and AI-driven systems. Proven ability to build full-stack"
    " analytics and intelligent applications, including a voice-enabled AI platform deployed"
    " for clinical research. Known for strong ownership, clean code practices, and delivering"
    " measurable technical impact in collaborative team environments."
)

_DEGREE_RE = re.compile(r"\b(B\.S\.|M\.S\.|B\.A\.|M\.A\.|Bachelor|Master)", re.IGNORECASE)



def generate_resume_tex(about, experience, skills, projects, coursework, variant=None) -> str:
    parts = [_PREAMBLE]

    # ── NAME + CONTACT ──
    parts.append(
        "\\begin{center}\n"
        "    \\textbf{\\Huge \\scshape Nathan Blatter} \\\\ \\vspace{2pt}\n"
        "    \\small nzb22@byu.edu $|$ "
        + _href(DOMAIN, "nathanblatter.com") + " $|$ "
        + _href(DOMAIN + "/go/linkedin", "LinkedIn") + " $|$ "
        + _href(DOMAIN + "/go/github", "GitHub")
        + "\n\\end{center}\n"
    )

    # ── SUMMARY (variant-aware) ──
    if variant and variant.get("headline") and variant.get("summary"):
        summary = rf"\textbf{{{_esc(variant['headline'])}}} {_esc(variant['summary'])}"
    else:
        summary = _DEFAULT_SUMMARY
    parts.append(f"\\small {summary}\n\\vspace{{-6pt}}\n")

    # `kind` is the source of truth (set in admin); fall back to a title regex
    # only for rows that predate the column.
    def _is_edu(e):
        k = e.get("kind")
        return k == "education" if k else bool(_DEGREE_RE.search(e["title"]))

    degrees = [e for e in experience if _is_edu(e)]
    jobs = [e for e in experience if not _is_edu(e)]

    # ── EDUCATION ──
    parts.append("\\section{Education}\n\\resumeSubHeadingListStart\n")
    for i, edu in enumerate(degrees):
        parts.append(
            rf"  \resumeSubheading{{{_esc(edu['title'])}}}{{{_esc(edu['year'])}}}"
            rf"{{{_esc(edu['subtitle'])}}}{{}}" + "\n"
        )
        extras = []  # already-escaped latex fragments
        for line in (edu.get("description") or "").split("\n"):
            line = line.strip().lstrip("•-").strip()
            if line:
                extras.append(_esc(line))
        if i == 0:
            gpa = about.get("gpa", "")
            if gpa:
                extras.append(f"GPA: {_esc(gpa)}")
            if coursework:
                cw = _esc(", ".join(c["name"] for c in coursework))
                extras.append(rf"\textbf{{Relevant Coursework:}} {cw}")
        if extras:
            parts.append("  \\resumeItemListStart\n")
            for x in extras:
                parts.append(rf"    \resumeItem{{{x}}}" + "\n")
            parts.append("  \\resumeItemListEnd\n")
    parts.append("\\resumeSubHeadingListEnd\n")

    # ── TECHNICAL SKILLS ──
    from app.resume_skills import group_skills
    parts.append(
        "\\section{Technical Skills}\n"
        "\\begin{itemize}[leftmargin=0.0in, label={}]\n    \\small{\\item{\n"
    )
    skill_lines = []
    for label, names in group_skills(skills):
        skill_lines.append(rf"     \textbf{{{_esc(label)}}}: {_esc(', '.join(names))}")
    parts.append(" \\\\ \n".join(skill_lines) + "\n    }}\n\\end{itemize}\n\\vspace{-8pt}\n")

    # ── PROJECTS ──
    parts.append("\\section{Projects}\n\\resumeSubHeadingListStart\n")
    for proj in projects:
        tags = ", ".join(proj.get("tags", [])[:5])
        hrs_metric = None
        for m in proj.get("metrics", []):
            if "hr" in m.get("label", "").lower():
                hrs_metric = m["value"]
                break
        header = rf"\textbf{{{_esc(proj['title'])}}} $|$ \emph{{{_esc(tags)}}}"
        right_parts = [_esc(proj.get("year", ""))]
        if hrs_metric:
            right_parts.append(f"{_esc(hrs_metric)} hrs")
        if proj.get("link"):
            right_parts.append(_href(proj["link"], "Link"))
        parts.append(
            rf"  \resumeProjectHeading{{{header}}}{{{' $|$ '.join(p for p in right_parts if p)}}}" + "\n"
        )
        parts.append(_bullets(proj.get("description", "")))
    parts.append("\\resumeSubHeadingListEnd\n")

    # ── EXPERIENCE ──
    parts.append("\\section{Experience}\n\\resumeSubHeadingListStart\n")
    for job in jobs:
        parts.append(
            rf"  \resumeSubheading{{{_esc(job['title'])}}}{{{_esc(job['year'])}}}"
            rf"{{{_esc(job['subtitle'])}}}{{}}" + "\n"
        )
        parts.append(_bullets(job.get("description", "")))
    parts.append("\\resumeSubHeadingListEnd\n")

    # ── OTHER ACHIEVEMENTS ──
    others = [a for a in (about.get("achievements") or []) if a]
    if not others and len(about.get("bio_paragraphs", [])) > 2:
        others.append(about["bio_paragraphs"][2])
    parts.append("\\section{Other Achievements}\n  \\resumeItemListStart\n")
    for line in others:
        if line:
            parts.append(rf"    \resumeItem{{{_esc(line)}}}" + "\n")
    parts.append("  \\resumeItemListEnd\n")

    parts.append("\\end{document}\n")
    return "".join(parts)


def compile_tex(tex: str) -> bytes:
    """Compile LaTeX source to PDF bytes with tectonic. Raises on failure."""
    tectonic = os.environ.get("TECTONIC_BIN", "tectonic")
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "resume.tex"
        src.write_text(tex, encoding="utf-8")
        result = subprocess.run(
            [tectonic, "--chatter", "minimal", "resume.tex"],
            cwd=td, capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(f"tectonic failed: {result.stderr[-2000:]}")
        return (Path(td) / "resume.pdf").read_bytes()


def generate_resume_pdf_latex(about, experience, skills, projects, coursework, variant=None) -> bytes:
    return compile_tex(generate_resume_tex(about, experience, skills, projects, coursework, variant))


def prewarm() -> None:
    """Compile a dummy resume so tectonic's package cache is baked into the Docker image."""
    dummy_about = {"gpa": "4.0", "bio_paragraphs": ["a", "b", "c"]}
    dummy_exp = [
        {"title": "B.S. Example", "subtitle": "School", "year": "2027", "description": ""},
        {"title": "Engineer", "subtitle": "Co", "year": "2026", "description": "• Did things"},
    ]
    dummy_skills = [{"name": "Python", "category": "Lang"}]
    dummy_projects = [{"title": "P", "description": "• x", "tags": ["t"], "year": "2026", "link": DOMAIN, "metrics": []}]
    dummy_cw = [{"name": "Course"}]
    generate_resume_pdf_latex(dummy_about, dummy_exp, dummy_skills, dummy_projects, dummy_cw)
