from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Optional


def utc_now() -> datetime:
    """Return a timezone-aware UTC datetime."""
    return datetime.now(UTC)


def utc_today() -> date:
    """Return today's date in UTC."""
    return utc_now().date()


def utc_now_iso() -> str:
    """Return the current UTC timestamp as ISO-8601."""
    return utc_now().isoformat()


def utc_today_iso() -> str:
    """Return today's UTC date as ISO-8601."""
    return utc_today().isoformat()


def utc_strftime(fmt: str) -> str:
    """Format the current UTC time."""
    return utc_now().strftime(fmt)


def ensure_utc_datetime(value: Optional[object]) -> Optional[datetime]:
    """Coerce datetimes and ISO strings into timezone-aware UTC datetimes."""
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)

    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=UTC)

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)

    raise TypeError(f"Unsupported datetime value: {type(value)!r}")
