"""Phase 13 activity + monitoring route registration and heartbeat math helpers."""

from datetime import UTC, datetime, timedelta

from app.main import create_app
from app.services.activity import HEARTBEAT_CAP_SECONDS, SESSION_GAP
from app.tests.route_helpers import api_paths


def test_activity_and_monitoring_routes_registered() -> None:
    app = create_app()
    paths = api_paths(app)
    assert "/api/activity/heartbeat" in paths
    assert "/api/admin/monitoring" in paths
    assert "/api/admin/monitoring/layout" in paths
    assert "/api/admin/login-events" in paths


def test_heartbeat_caps_and_session_gap() -> None:
    assert HEARTBEAT_CAP_SECONDS == 35
    assert SESSION_GAP == timedelta(seconds=120)
    assert HEARTBEAT_CAP_SECONDS >= 30
    now = datetime.now(UTC)
    assert (now - SESSION_GAP) < now
