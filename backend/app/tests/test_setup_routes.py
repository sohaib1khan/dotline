"""Setup router wiring smoke tests (no database required)."""

from app.main import create_app
from app.tests.route_helpers import api_paths


def test_setup_routes_are_registered() -> None:
    app = create_app()
    paths = api_paths(app)
    assert "/api/setup/status" in paths
    assert "/api/setup/admin" in paths
    assert "/api/health" in paths
