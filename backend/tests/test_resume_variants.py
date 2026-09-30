"""Résumé variants are admin-only: visitors get the default flavor everywhere."""
from types import SimpleNamespace

from app.auth import create_token, is_admin_token, require_auth
from app.routers.resume import public_variants, router as resume_router
from app.routers.seo import pdf_variant_key


def v(key, is_default=False):
    return SimpleNamespace(key=key, is_default=is_default)


def test_public_variants_returns_only_the_default():
    rows = [v("swe"), v("data", is_default=True), v("ai")]
    assert [r.key for r in public_variants(rows)] == ["data"]


def test_public_variants_falls_back_to_first_when_no_default():
    assert [r.key for r in public_variants([v("swe"), v("ai")])] == ["swe"]


def test_public_variants_empty():
    assert public_variants([]) == []


def test_pdf_variant_ignored_for_visitors():
    assert pdf_variant_key("ai", is_admin=False) == ""


def test_pdf_variant_honoured_for_admin():
    assert pdf_variant_key("ai", is_admin=True) == "ai"


def test_is_admin_token():
    assert is_admin_token(create_token())
    assert not is_admin_token(None)
    assert not is_admin_token("")
    assert not is_admin_token("not-a-jwt")


def test_variant_list_endpoint_requires_auth():
    route = next(
        r for r in resume_router.routes
        if r.path == "/resume/variants" and "GET" in r.methods
    )
    deps = [d.call for d in route.dependant.dependencies]
    assert require_auth in deps
