"""Admin Phase 12 route registration smoke tests."""

from fastapi.routing import APIRoute

from app.main import create_app


def test_admin_phase12_routes_registered() -> None:
    app = create_app()
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}
    assert "/api/admin/users" in paths
    assert "/api/admin/users/{user_id}" in paths
    assert "/api/admin/users/{user_id}/active" in paths
    assert "/api/admin/content/units" in paths
    assert "/api/admin/content/lessons/{lesson_id}" in paths
    assert "/api/admin/content/reseed" in paths
    assert "/api/admin/announcements" in paths
    assert "/api/admin/settings/signups" in paths
    assert "/api/admin/settings/general" in paths
