"""Unit tests for `experience_sort_key` / `sort_experience` in app.utils.

These are pure functions over duck-typed `Experience` rows (only `.year`,
`.active`, and `.sort_order` are read), so SimpleNamespace stand-ins suffice —
same policy as test_money_paths.

Intended ordering (from the implementation):
- Ongoing entries (`active=True`) form group 0 and sort before all ended
  entries (group 1), regardless of year text. Ongoing-ness comes from the
  `active` flag, NOT from "Present"/"Now" appearing in the free-text `year`.
- Within ongoing: most recent *start* year first (first 4-digit run in `year`).
- Within ended: most recent *end* year first (last 4-digit run in `year`).
- Year strings with no 4-digit run (empty, None, "Present", "TBD", ...) parse
  to year 0, so they sort last within their group (since -0 > -2023) rather
  than crashing.
- `sort_order` (ascending) breaks ties among entries equal on group + year.
"""
from types import SimpleNamespace

from app.utils import experience_sort_key, sort_experience


def make_exp(year, active=False, sort_order=0, name=""):
    return SimpleNamespace(year=year, active=active, sort_order=sort_order, name=name)


def names(rows):
    return [r.name for r in rows]


# ── Ongoing vs ended ──────────────────────────────────────────────────────────

def test_ongoing_sorts_before_ended():
    ended = make_exp("2021 – 2024", active=False, name="ended")
    ongoing = make_exp("2023 — Present", active=True, name="ongoing")
    assert names(sort_experience([ended, ongoing])) == ["ongoing", "ended"]


def test_ongoing_with_yearless_text_still_sorts_before_all_ended():
    # "Present"/"Now" carry no 4-digit year; the `active` flag alone puts them
    # in the leading group — even ahead of an entry that ended this year.
    present = make_exp("Present", active=True, name="present")
    now = make_exp("Now", active=True, name="now", sort_order=1)
    recent_ended = make_exp("2026", active=False, name="recent-ended")
    assert names(sort_experience([recent_ended, present, now])) == [
        "present",
        "now",
        "recent-ended",
    ]


def test_active_flag_not_year_text_determines_ongoing():
    # An inactive entry whose text says "Present" is still grouped as ended.
    stale = make_exp("2020 — Present", active=False, name="stale")
    ongoing = make_exp("2019 — Present", active=True, name="ongoing")
    ended = make_exp("2018 – 2023", active=False, name="ended")
    assert names(sort_experience([stale, ended, ongoing])) == [
        "ongoing",  # group 0
        "ended",    # ended 2023
        "stale",    # ended 2020 (its only/last year)
    ]


# ── Recency within each group ────────────────────────────────────────────────

def test_more_recent_end_year_sorts_first_among_ended():
    rows = [
        make_exp("2019", name="a"),
        make_exp("2024", name="b"),
        make_exp("2021", name="c"),
    ]
    assert names(sort_experience(rows)) == ["b", "c", "a"]


def test_ongoing_sorted_by_start_year_most_recent_first():
    rows = [
        make_exp("2019 — Present", active=True, name="old-start"),
        make_exp("2024 — Present", active=True, name="new-start"),
    ]
    assert names(sort_experience(rows)) == ["new-start", "old-start"]


def test_ongoing_multi_year_uses_start_year_not_end():
    # For ongoing rows the key uses the FIRST year in the string.
    a = make_exp("2019 – 2026", active=True, name="a")  # start 2019
    b = make_exp("2022 — Present", active=True, name="b")  # start 2022
    assert names(sort_experience([a, b])) == ["b", "a"]


# ── Multi-year strings use the later year (ended entries) ────────────────────

def test_multi_year_string_uses_later_year_en_dash():
    long_ago_start = make_exp("2021–2023", name="ends-2023")
    single = make_exp("2022", name="ends-2022")
    assert names(sort_experience([single, long_ago_start])) == [
        "ends-2023",
        "ends-2022",
    ]


def test_multi_year_string_uses_later_year_hyphen_spaces():
    a = make_exp("2019 - 2022", name="ends-2022")
    b = make_exp("2020 – 2021", name="ends-2021")
    assert names(sort_experience([b, a])) == ["ends-2022", "ends-2021"]


def test_single_year_string_end_equals_start():
    key = experience_sort_key(make_exp("2020"))
    assert key == (1, -2020, 0)


# ── Empty / None / malformed year strings ────────────────────────────────────

def test_none_year_does_not_crash_and_sorts_last():
    rows = [
        make_exp(None, name="none-year"),
        make_exp("2001", name="ancient"),
    ]
    assert names(sort_experience(rows)) == ["ancient", "none-year"]


def test_empty_and_malformed_years_sort_last_within_group():
    rows = [
        make_exp("", name="empty"),
        make_exp("TBD", name="malformed"),
        make_exp("199", name="too-short"),  # not a 4-digit run
        make_exp("2003", name="dated"),
    ]
    out = names(sort_experience(rows))
    assert out[0] == "dated"
    assert set(out[1:]) == {"empty", "malformed", "too-short"}


def test_yearless_key_uses_year_zero():
    assert experience_sort_key(make_exp(None)) == (1, 0, 0)
    assert experience_sort_key(make_exp("", active=True)) == (0, 0, 0)


def test_yearless_ongoing_sorts_after_dated_ongoing_but_before_ended():
    rows = [
        make_exp("2010", name="ended"),
        make_exp(None, active=True, name="yearless-ongoing"),
        make_exp("2015 — Present", active=True, name="dated-ongoing"),
    ]
    assert names(sort_experience(rows)) == [
        "dated-ongoing",
        "yearless-ongoing",
        "ended",
    ]


# ── sort_order tiebreak ──────────────────────────────────────────────────────

def test_sort_order_breaks_ties_among_equal_ended_years():
    rows = [
        make_exp("2022", sort_order=2, name="second"),
        make_exp("2022", sort_order=1, name="first"),
        make_exp("2022", sort_order=3, name="third"),
    ]
    assert names(sort_experience(rows)) == ["first", "second", "third"]


def test_sort_order_breaks_ties_among_equal_ongoing_starts():
    rows = [
        make_exp("2023 — Present", active=True, sort_order=5, name="b"),
        make_exp("2023 — Present", active=True, sort_order=1, name="a"),
    ]
    assert names(sort_experience(rows)) == ["a", "b"]


def test_sort_order_does_not_override_year_recency():
    rows = [
        make_exp("2020", sort_order=0, name="older"),
        make_exp("2024", sort_order=99, name="newer"),
    ]
    assert names(sort_experience(rows)) == ["newer", "older"]


# ── sort_experience contract ─────────────────────────────────────────────────

def test_sort_experience_returns_new_list_and_accepts_any_iterable():
    rows = (make_exp("2020", name="a"), make_exp("2021", name="b"))
    out = sort_experience(rows)
    assert isinstance(out, list)
    assert names(out) == ["b", "a"]
