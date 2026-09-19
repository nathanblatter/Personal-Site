"""Unit tests for the SPA-shell preload helpers in app.main.

`_preload_script` must produce a <script type="application/json"> whose body can
never close the element early (``</``) or open an HTML comment (``<!--``), and
`_inject_before_head_end` / `_apply_site_description` must edit the shell in
place without touching anything else.
"""
import json

from app.main import (
    DEFAULT_SITE_DESCRIPTION,
    _apply_site_description,
    _inject_before_head_end,
    _preload_script,
)

SHELL = (
    '<!doctype html><html><head><meta charset="UTF-8" />'
    f'<meta name="description" content="{DEFAULT_SITE_DESCRIPTION}" />'
    f'<meta property="og:description" content="{DEFAULT_SITE_DESCRIPTION}" />'
    '<script type="application/ld+json">{"@type": "Person", "description": '
    + json.dumps(DEFAULT_SITE_DESCRIPTION)
    + "}</script></head><body><div id=\"root\"></div></body></html>"
)


def test_preload_script_escapes_script_breakouts():
    tag = _preload_script({"/blog/x": {"content": "a</script><!-- b --> & c"}})
    assert tag.startswith('<script id="__preload" type="application/json">')
    assert tag.endswith("</script>")
    body = tag[tag.index(">") + 1 : -len("</script>")]
    assert "<" not in body  # no "</script" or "<!--" can ever appear
    # The escapes are JSON no-ops: the browser parses back the original strings.
    assert json.loads(body) == {"/blog/x": {"content": "a</script><!-- b --> & c"}}


def test_preload_script_serializes_non_json_types():
    from datetime import datetime

    tag = _preload_script({"/home": {"when": datetime(2026, 9, 19, 8, 30)}})
    body = tag[tag.index(">") + 1 : -len("</script>")]
    assert json.loads(body) == {"/home": {"when": "2026-09-19T08:30:00"}}


def test_inject_before_head_end():
    out = _inject_before_head_end(SHELL, "<x/>")
    assert out.count("<x/>") == 1
    assert out.index("<x/>") < out.index("</head>")
    assert _inject_before_head_end("<p>no head</p>", "<x/>") == "<p>no head</p>"


def test_apply_site_description_swaps_all_default_occurrences():
    out = _apply_site_description(SHELL, 'Builder of "useful" things & tools')
    assert DEFAULT_SITE_DESCRIPTION not in out
    assert 'content="Builder of &quot;useful&quot; things &amp; tools"' in out
    assert json.loads(out.split('"description": ')[1].split("}</script>")[0]) == 'Builder of "useful" things & tools'  # JSON-LD literal


def test_apply_site_description_noop_when_unset():
    assert _apply_site_description(SHELL, None) == SHELL
    assert _apply_site_description(SHELL, "") == SHELL
    assert _apply_site_description(SHELL, DEFAULT_SITE_DESCRIPTION) == SHELL
