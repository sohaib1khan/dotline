"""Inbox and bug report route registration smoke tests."""

from app.main import create_app
from app.services import bugs as bugs_service
from app.tests.route_helpers import api_paths


def test_inbox_and_bug_routes_registered() -> None:
    app = create_app()
    paths = api_paths(app)
    assert "/api/inbox" in paths
    assert "/api/inbox/unread-count" in paths
    assert "/api/inbox/{message_id}/read" in paths
    assert "/api/inbox/read-all" in paths
    assert "/api/bugs" in paths
    assert "/api/bugs/categories" in paths
    assert "/api/bugs/mine" in paths
    assert "/api/admin/bugs" in paths
    assert "/api/admin/bugs/{report_id}/reply" in paths


def test_bug_categories_cover_blueprint_set() -> None:
    expected = {
        "sound_not_working",
        "vibration_not_working",
        "controller_problem",
        "hard_to_see_read",
        "lesson_stuck_or_wrong",
        "tracing_not_scoring",
        "login_or_account",
        "layout_broken",
        "other",
    }
    assert set(bugs_service.BUG_CATEGORIES) == expected
    assert set(bugs_service.CATEGORY_LABELS) == expected
