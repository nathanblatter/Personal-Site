"""Group skill rows into the résumé's four labelled lines.

Skill categories on the site are granular (Web / Frontend / Backend / Data / BI /
Cloud) because the home grid shows them as chips; the résumé collapses them into
the four headings on Nathan's Word résumé, in that order.
"""

_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ("Data & BI", ("Data", "BI")),
    ("Systems Development", ("Backend", "Lang", "Back")),
    ("Web Development", ("Web", "Frontend", "Front")),
    ("Cloud & Infrastructure", ("Cloud",)),
]


def group_skills(skills) -> list[tuple[str, list[str]]]:
    """[(label, [names…])] in résumé order; unknown categories trail under their own name."""
    by_cat: dict[str, list[str]] = {}
    for sk in skills:
        by_cat.setdefault(sk["category"], []).append(sk["name"])
    out: list[tuple[str, list[str]]] = []
    seen: set[str] = set()
    for label, cats in _GROUPS:
        names = [n for c in cats for n in by_cat.get(c, [])]
        seen.update(cats)
        if names:
            out.append((label, names))
    for cat, names in by_cat.items():
        if cat not in seen:
            out.append((cat, names))
    return out
