import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Request
import httpx

from app.cache import cache

router = APIRouter(tags=["solar"])

_CACHE_TTL = 1800  # 30 minutes


def _solar_times(lat: float, lon: float, tz_name: str) -> tuple[str, str]:
    """Return (sunrise, sunset) as 'HH:MM' strings in local time."""
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = timezone.utc

    d = datetime.now(tz).date()
    n = d.timetuple().tm_yday

    L = (280.460 + 0.9856474 * n) % 360
    g = math.radians((357.528 + 0.9856003 * n) % 360)
    lam = math.radians(L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g))
    eps = math.radians(23.439 - 0.0000004 * n)

    sin_dec = math.sin(eps) * math.sin(lam)
    dec = math.asin(sin_dec)

    lat_r = math.radians(lat)
    cos_h = (math.cos(math.radians(90.833)) - math.sin(lat_r) * sin_dec) / (
        math.cos(lat_r) * math.cos(dec)
    )
    cos_h = max(-1.0, min(1.0, cos_h))
    h = math.degrees(math.acos(cos_h))

    ra = math.degrees(math.atan2(math.cos(eps) * math.sin(lam), math.cos(lam))) / 15
    noon_ut = 12 - lon / 15 - (L / 15 - ra)

    def _ut_to_hhmm(ut_hours: float) -> str:
        total_min = round(ut_hours * 60)
        dt_utc = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(minutes=total_min)
        local = dt_utc.astimezone(tz)
        return local.strftime("%H:%M")

    return _ut_to_hhmm(noon_ut - h / 15), _ut_to_hhmm(noon_ut + h / 15)


def _is_daytime(lat: float, lon: float, tz_name: str) -> tuple[bool, str, str]:
    """Return (is_day, sunrise_str, sunset_str)."""
    sunrise_str, sunset_str = _solar_times(lat, lon, tz_name)
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = timezone.utc

    now = datetime.now(tz).strftime("%H:%M")
    return sunrise_str <= now <= sunset_str, sunrise_str, sunset_str


@router.get("")
async def get_solar(request: Request):
    ip = (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "")
    )

    # Localhost / private IPs → default to Provo, UT
    is_local = not ip or ip in ("127.0.0.1", "::1") or ip.startswith("192.168.") or ip.startswith("10.")
    if is_local:
        ip = "_local"

    cached = await cache.get(f"solar:{ip}")
    if cached is not None:
        return cached

    if is_local:
        lat, lon, tz_name = 40.2338, -111.6585, "America/Denver"
    else:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"http://ip-api.com/json/{ip}?fields=lat,lon,timezone,status")
                geo = r.json()
            if geo.get("status") != "success":
                raise ValueError("geo failed")
            lat = geo["lat"]
            lon = geo["lon"]
            tz_name = geo["timezone"]
        except Exception:
            # Fallback: Provo, UT
            lat, lon, tz_name = 40.2338, -111.6585, "America/Denver"

    is_day, sunrise, sunset = _is_daytime(lat, lon, tz_name)
    data = {
        "mode": "light" if is_day else "dark",
        "sunrise": sunrise,
        "sunset": sunset,
    }
    await cache.set(f"solar:{ip}", data, ttl=_CACHE_TTL)
    return data
