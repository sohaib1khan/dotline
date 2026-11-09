# Security review (Phase 15)

Checked against blueprint §2 and `.cursor/rules/30-security.mdc`.

| Control | Status | Notes |
|---|---|---|
| No secrets in Git | Pass | `.env` + `blueprint.md` gitignored; only `.env.example` placeholders |
| argon2 passwords | Pass | `app.security.passwords` |
| httpOnly Secure SameSite=Lax sessions | Pass | cookie helpers + session store |
| CSRF on state-changing requests | Pass | `require_csrf` on mutating auth/admin/learner writes |
| Rate limits | Pass | login/signup/reset + bug reports (slowapi + service caps) |
| Server-side validation | Pass | Pydantic schemas on routers |
| Server-enforced roles | Pass | `require_admin` / `get_current_user` |
| Encrypted third-party keys | Pass | Fernet via `APP_ENCRYPTION_KEY`; masked in API |
| DB not published | Pass | Compose `db` service has no host `ports:` |
| gitleaks hook + full history | Pass | `.pre-commit-config.yaml`; `gitleaks detect` clean (15 commits) |

## Dependency audits (2026-11-09)

| Surface | Result | Action |
|---|---|---|
| App Python deps (`pip-audit` in container) | No app-package CVEs | Image upgrades `pip` before install |
| Tooling `pip` (pre-upgrade) | Known CVEs in pip 25.0.1 | Mitigated via `pip install --upgrade pip` in Dockerfile |
| Frontend (`npm audit --omit=dev`) | 2 moderate: `react-router` / `react-router-dom` 6.30.6 | Fix requires major bump to 7.18.5; deferred (client SPA, no SSR hydration path for the constructor advisory) |

Re-run:

```bash
gitleaks detect --source . --verbose
docker compose exec app pip-audit
cd frontend && npm audit --omit=dev
docker compose exec app pytest -q
cd e2e && DOTLINE_BASE_URL=http://localhost:47391 npm test
```
