"""PWA asset route registration smoke tests."""

from app.main import create_app
from app.tests.route_helpers import api_paths


def test_pwa_routes_registered() -> None:
    app = create_app()
    paths = api_paths(app)
    assert "/sw.js" in paths
    assert "/manifest.webmanifest" in paths
