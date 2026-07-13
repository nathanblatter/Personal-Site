"""Unit tests for the self-learning vocab pipeline (pure functions only — the
DB layer and Ollama call are exercised in prod, same policy as test_journal)."""

import pytest

from app import journal_vocab, vocab_service
from app.routers import journal


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(journal, "JOURNAL_LINK_SECRET", "test-secret")


# --- heuristic extractor ----------------------------------------------------

def test_mid_sentence_caps_extracted():
    cands = vocab_service.heuristic_candidates("we drove to Danville and got In-N-Out.")
    surfaces = [c["surface"] for c in cands]
    assert "Danville" in surfaces


def test_title_case_runs_group_into_phrases():
    cands = vocab_service.heuristic_candidates("we visited the Provo City Center Temple at night")
    assert any(c["surface"] == "Provo City Center Temple" for c in cands)


def test_sentence_start_cap_alone_is_ignored():
    cands = vocab_service.heuristic_candidates("Then we left. Then we came back.")
    assert cands == []


def test_sentence_start_name_kept_when_seen_mid_sentence():
    text = "Skyler was there. I talked to Skyler for a while."
    surfaces = [c["surface"] for c in vocab_service.heuristic_candidates(text)]
    assert "Skyler" in surfaces


def test_runs_do_not_cross_commas():
    cands = vocab_service.heuristic_candidates("and then ate the Chipotle, Megan had her tutor over")
    surfaces = [c["surface"] for c in cands]
    assert "Chipotle" in surfaces and "Megan" in surfaces
    assert "Chipotle Megan" not in surfaces


def test_name_lists_split_on_and():
    cands = vocab_service.heuristic_candidates("i hung out with Jackson and Kami and Macy today")
    surfaces = [c["surface"] for c in cands]
    assert {"Jackson", "Kami", "Macy"} <= set(surfaces)
    assert all(" and " not in s for s in surfaces)


def test_single_letters_never_candidates():
    assert vocab_service.heuristic_candidates("la la D da E da") == []


def test_stopwords_and_kin_terms_filtered():
    cands = vocab_service.heuristic_candidates("i caught up with Mom and Dad on Monday about TV")
    assert cands == []


def test_initialisms_extracted():
    surfaces = [c["surface"] for c in vocab_service.heuristic_candidates("my flight out of SFO was late")]
    assert "SFO" in surfaces


def test_candidates_come_with_context():
    cands = vocab_service.heuristic_candidates("we ate lunch at Costa Vida before work")
    hit = next(c for c in cands if c["surface"] == "Costa Vida")
    assert "lunch at Costa Vida" in hit["context"]


# --- fuzzy suggestion ---------------------------------------------------------

def test_fuzzy_suggests_canonical_for_near_miss():
    assert vocab_service.suggest_canonical("Jaxson", journal_vocab.CANONICAL) == "Jaxon"


def test_fuzzy_matches_known_variant_to_its_canonical():
    assert vocab_service.suggest_canonical("Tolic", journal_vocab.CANONICAL) == "Lake Tulloch"


def test_fuzzy_returns_none_for_novel_name():
    assert vocab_service.suggest_canonical("Zebulon", journal_vocab.CANONICAL) is None


# --- LLM output parsing (lenient + anti-hallucination) ------------------------

RAW = "i used my clod code subscription and went to the library"


def test_llm_parse_keeps_verbatim_candidates():
    out = '{"candidates": [{"surface": "clod code", "suggestion": "Claude Code", "note": ""}]}'
    cands = vocab_service._parse_llm_output(out, RAW)
    assert cands[0]["surface"] == "clod code"
    assert cands[0]["suggestion"] == "Claude Code"


def test_llm_parse_drops_hallucinated_surfaces():
    out = '{"candidates": [{"surface": "wine rolls", "suggestion": "Hawaiian rolls", "note": ""}]}'
    assert vocab_service._parse_llm_output(out, RAW) == []


def test_llm_parse_survives_duplicate_candidates_keys():
    # Observed 3B failure mode: two "candidates" arrays in one object — plain
    # json.loads keeps only the last, losing the real hit.
    out = ('{"candidates": [{"surface": "clod code", "suggestion": "Claude Code", "note": ""}],'
           ' "candidates": [{"surface": "bogus thing", "suggestion": "Bogus", "note": ""}]}')
    cands = vocab_service._parse_llm_output(out, RAW)
    assert [c["surface"] for c in cands] == ["clod code"]


def test_llm_parse_dedupes_case_insensitively():
    out = ('{"candidates": [{"surface": "Library", "suggestion": "", "note": ""},'
           ' {"surface": "library", "suggestion": "", "note": ""}]}')
    assert len(vocab_service._parse_llm_output(out, RAW)) == 1


# --- vocab builders -----------------------------------------------------------

def test_prompt_and_glossary_built_from_arbitrary_vocab():
    vocab = {"Zeb": ["Zebb"], "Nowhere Lake": []}
    assert journal_vocab.whisper_prompt_from(vocab) == "Zeb, Nowhere Lake."
    glossary = journal_vocab.weave_glossary_from(vocab)
    assert "- Zeb (may be transcribed as: Zebb)" in glossary
    assert "- Nowhere Lake" in glossary


# --- vocab token --------------------------------------------------------------

def test_vocab_token_round_trips():
    assert journal.verify_vocab_token(journal.sign_vocab_token())


def test_vocab_token_rejects_tamper_and_empty():
    assert not journal.verify_vocab_token("nope")
    assert not journal.verify_vocab_token("")
