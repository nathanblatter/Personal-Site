"""Recurring proper nouns for the voice journal — canonical spelling + known
mis-hearings. Edit this list as new people/places show up.

Used two ways:
  1. Whisper `initial_prompt` (worker) — biases transcription toward these spellings.
  2. Weave glossary (weave_service) — tells the LLM to normalize a known mis-hearing
     to its canonical spelling, and NOT to flag that correction as drift.

Map each canonical spelling to the ways Whisper tends to mis-transcribe it.
"""

CANONICAL: dict[str, list[str]] = {
    # People
    "Jaxon": ["Jackson", "Jaxson", "Jaxen"],
    "Kammi": ["Cammie", "Cami", "Kammy"],
    "Macy": ["Maci", "Macey"],
    "Megan": ["Meghan", "Meagan"],
    "Colton Brown": ["Colton", "Coulton"],
    "Brad Brown": [],
    "Uncle John": [],
    "Rojas": ["Rojes", "Roja"],
    # Places
    "Lake Tulloch": ["Tolic", "Tulloch", "Tulic", "Tullick", "Toledo"],
    "Danville": ["Danfield"],
    "Tahoe": ["Taho"],
    "In-N-Out": ["in and out", "In and Out"],
    # Projects / recurring topics
    "FinForge": ["Fin Forge"],
    "flightdeck": ["flight deck"],
    "Marriott": ["Mariott"],
    "Gaskin": [],
    "BYU": [],
    "Project Hail Mary": ["Project Hailmary"],
}


def whisper_prompt() -> str:
    """Comma-joined canonical names to bias Whisper's recognition."""
    return ", ".join(CANONICAL.keys()) + "."


def weave_glossary() -> str:
    """Glossary lines for the weave prompt: canonical name + its common mis-hearings."""
    lines = []
    for canonical, variants in CANONICAL.items():
        if variants:
            lines.append(f"- {canonical} (may be transcribed as: {', '.join(variants)})")
        else:
            lines.append(f"- {canonical}")
    return "\n".join(lines)
