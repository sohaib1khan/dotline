"""Static security checklist against blueprint section 2."""

from pathlib import Path

from app.main import create_app
from app.tests.route_helpers import iter_api_routes


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / "docker-compose.yml").is_file() and (parent / ".env.example").is_file():
            return parent
    return here.parents[3]


ROOT = _repo_root()


def test_env_example_has_placeholders_only() -> None:
    path = ROOT / ".env.example"
    if not path.is_file():
        import pytest

        pytest.skip("Repo root files not available in this environment")
    text = path.read_text(encoding="utf-8")
    assert "SECRET_KEY=" in text
    assert "APP_ENCRYPTION_KEY=" in text
    assert "re_" not in text
    assert "sk_live" not in text


def test_gitignore_blocks_secrets_and_blueprint() -> None:
    path = ROOT / ".gitignore"
    if not path.is_file():
        import pytest

        pytest.skip("Repo root files not available in this environment")
    text = path.read_text(encoding="utf-8")
    assert ".env" in text
    assert "blueprint.md" in text


def test_precommit_includes_gitleaks() -> None:
    path = ROOT / ".pre-commit-config.yaml"
    if not path.is_file():
        import pytest

        pytest.skip("Repo root files not available in this environment")
    text = path.read_text(encoding="utf-8")
    assert "gitleaks" in text


def test_compose_does_not_publish_db_port() -> None:
    path = ROOT / "docker-compose.yml"
    if not path.is_file():
        import pytest

        pytest.skip("Repo root files not available in this environment")
    text = path.read_text(encoding="utf-8")
    assert "postgres:16" in text
    db_block = text.split("app:")[0]
    assert "ports:" not in db_block


def test_state_changing_auth_routes_require_csrf_dependency() -> None:
    from app.security.deps import require_csrf

    app = create_app()
    mutating = [
        route
        for route in iter_api_routes(app)
        if route.path.startswith("/api/auth/")
        and any(method in {"POST", "PUT", "PATCH", "DELETE"} for method in route.methods or [])
    ]
    assert mutating
    for route in mutating:
        assert any(
            getattr(dep, "dependency", None) is require_csrf for dep in route.dependencies
        ), f"{route.path} missing CSRF dependency"
