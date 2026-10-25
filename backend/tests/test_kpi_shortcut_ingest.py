"""Pure-function tests for /shortcut-ingest key mapping and value coercion."""

import re
from decimal import Decimal

from app.routers import kpi


def _col(key):
    return kpi._KPI_NORM_TO_COL.get(re.sub(r"[^a-z0-9]", "", key.lower()))


def test_every_healthkit_column_reachable_from_shortcut():
    # Anything /health-ingest can store, the forgiving Shortcut endpoint must too,
    # or new Shortcut keys get silently dropped as "ignored".
    healthkit = set(kpi.HealthIngestRequest.model_fields) - {"date"}
    missing = {c for c in healthkit if c in kpi._ALLOWED_FIELDS and _col(c) != c}
    assert missing == set()


def test_keys_normalize_without_underscores():
    assert _col("RespiratoryRate") == "respiratory_rate"
    assert _col("vo2max") == "vo2_max"
    assert _col("morninghrv") == "hrv_morning"


def test_zero_physiological_reading_is_missing():
    assert kpi._kpi_coerce("hrv_morning", "0") is None
    assert kpi._kpi_coerce("resting_hr", "0\n0") is None
    assert kpi._kpi_coerce("hrv_morning", "97.17\n0") == Decimal("97.17")


def test_zero_activity_counts_are_kept():
    assert kpi._kpi_coerce("flights_climbed", "0") == 0
    assert kpi._kpi_coerce("sleep_awake_hrs", "0") == Decimal("0.00")


def test_new_int_columns_round():
    assert kpi._kpi_coerce("resting_energy_cal", "1834.6 kcal") == 1835
