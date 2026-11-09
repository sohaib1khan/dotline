"""Unit tests for active-time heartbeat accounting."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from app.services.activity import HEARTBEAT_CAP_SECONDS, SESSION_GAP, _track_key


def test_track_key_normalizes() -> None:
    assert _track_key("braille") == "braille"
    assert _track_key("cursive") == "cursive"
    assert _track_key(None) == "general"
    assert _track_key("other") == "general"


def test_heartbeat_cap_is_below_session_gap() -> None:
    assert HEARTBEAT_CAP_SECONDS == 35
    assert SESSION_GAP.total_seconds() == 120
    assert HEARTBEAT_CAP_SECONDS < SESSION_GAP.total_seconds()


def test_elapsed_cap_math() -> None:
    now = datetime.now(UTC)
    last = now - timedelta(seconds=90)
    elapsed = int((now - last).total_seconds())
    added = max(0, min(elapsed, HEARTBEAT_CAP_SECONDS))
    assert added == HEARTBEAT_CAP_SECONDS


def test_session_gap_boundary() -> None:
    now = datetime.now(UTC)
    stale = SimpleNamespace(last_heartbeat_at=now - SESSION_GAP - timedelta(seconds=1), user_id=uuid4())
    fresh = SimpleNamespace(last_heartbeat_at=now - timedelta(seconds=30), user_id=uuid4())
    assert stale.last_heartbeat_at < now - SESSION_GAP
    assert fresh.last_heartbeat_at >= now - SESSION_GAP
