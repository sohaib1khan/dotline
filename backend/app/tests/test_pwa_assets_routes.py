"""PWA asset route registration smoke tests."""

from fastapi.routing import APIRoute

from app.main import create_app


def test_pwa_routes_registered() -> None:
    app = create_app()
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}
    assert "/sw.js" in paths
    assert "/manifest.webmanifest" in paths
