"""Login-event admin CRUD service tests (in-memory SQLite not used — pure helpers via route map)."""

from app.main import create_app
from app.tests.route_helpers import api_paths


def test_login_event_crud_routes_registered() -> None:
    paths = api_paths(create_app())
    assert "/api/admin/login-events" in paths
    assert "/api/admin/login-events/{event_id}" in paths
    assert "/api/admin/login-events/purge" in paths


def test_login_event_mutations_require_csrf_dependency() -> None:
    from app.security.deps import require_csrf

    app = create_app()
    mutating = []
    for route in app.routes:
        path = getattr(route, "path", "")
        methods = getattr(route, "methods", set()) or set()
        if not path.startswith("/api/admin/login-events"):
            continue
        if methods & {"POST", "PATCH", "DELETE", "PUT"}:
            mutating.append(route)

    assert mutating, "expected mutating login-event routes"
    for route in mutating:
        deps = getattr(route, "dependencies", []) or []
        assert any(getattr(dep, "dependency", None) is require_csrf for dep in deps), path
