"""Admin Phase 12 route registration smoke tests."""

from app.main import create_app
from app.tests.route_helpers import api_paths


def test_admin_phase12_routes_registered() -> None:
    app = create_app()
    paths = api_paths(app)
    assert "/api/admin/users" in paths
    assert "/api/admin/users/{user_id}" in paths
    assert "/api/admin/users/{user_id}/active" in paths
    assert "/api/admin/content/units" in paths
    assert "/api/admin/content/lessons/{lesson_id}" in paths
    assert "/api/admin/content/reseed" in paths
    assert "/api/admin/content/export" in paths
    assert "/api/admin/content/import" in paths
    assert "/api/admin/announcements" in paths
    assert "/api/admin/settings/signups" in paths
    assert "/api/admin/settings/general" in paths
