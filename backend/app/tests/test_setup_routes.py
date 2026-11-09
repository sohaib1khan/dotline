"""Setup router wiring smoke tests (no database required)."""

from fastapi.routing import APIRoute

from app.main import create_app


def test_setup_routes_are_registered() -> None:
    app = create_app()
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}
    assert "/api/setup/status" in paths
    assert "/api/setup/admin" in paths
    assert "/api/health" in paths
