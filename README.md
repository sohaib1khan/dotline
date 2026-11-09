# Dotline

Learn **braille** (English UEB Grade 1) and **cursive** — designed **low-vision first**.

Self-hosted Progressive Web App. Open source. Runs in Docker.

## Features

- Braille track with YAML-seeded units and Learn / Write / Read / Review lessons
- Cursive track with stroke library, 2D/3D tracing, and Signature Studio
- Games: Dot Drop, Cell Match, Lantern Path, Word Weaver
- XP, levels, streaks, badges, progress reset, settings (theme / speech / haptics)
- Inbox, Report a Problem (with device context), admin replies
- Admin: users, content CMS, bugs, announcements, settings, monitoring, login log
- PWA: installable, offline lesson practice, queued progress sync

### Screenshots

> Placeholders — add real captures under `docs/screenshots/` when ready.

- Statusboard — daily goal, XP, continue lessons
- Braille lesson — six-dot pad + feedback
- Cursive tracing — 2D / 3D guide
- Admin monitoring — drag-and-drop widgets

## Quick start (Docker)

```bash
git clone https://github.com/sohaib1khan/dotline.git
cd dotline
cp .env.example .env
```

Generate real secrets and put them in `.env` (do not leave the `change_me` placeholders):

```bash
# SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# APP_ENCRYPTION_KEY (Fernet — must be a valid Fernet key)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

If `cryptography` is not installed yet:

```bash
pip install cryptography
```

Also set `PUBLIC_BASE_URL` to your real URL (for email links), e.g. `https://dotline.example.com`.

Start in the background:

```bash
docker compose up -d --build
```

Open [http://localhost:47391](http://localhost:47391) (or `DOTLINE_PORT` from `.env`).

- Health: `/api/health`
- First visit with an empty DB redirects to `/setup` to create the admin
- The Postgres container has **no published host port**

Point Nginx Proxy Manager (or similar) at `host:${DOTLINE_PORT}`.

## Roles

| Role | Access |
|---|---|
| **admin** | Users, content, bugs, announcements, settings, monitoring, learner view |
| **learner** | Learn, play, progress, inbox, report problems, settings |

## NPM / frontend notes

The production UI is built inside the Docker image (`docker/app.Dockerfile`). For local UI work:

```bash
cd frontend
npm install
npm run build    # typecheck + Vite production build
npm run test     # Vitest unit tests (if present)
```

End-to-end smoke (app must already be running on `DOTLINE_PORT`):

```bash
cd e2e
npm install
npx playwright install chromium
DOTLINE_BASE_URL=http://localhost:47391 npm test
```

## Backend tests

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -q
```

Or inside the running app container:

```bash
docker compose exec app pip install -e ".[dev]"
docker compose exec app pytest -q
```

## Security

Blueprint section 2 checklist (verified in CI/local hardening):

- Secrets only in `.env` (gitignored); `.env.example` has placeholders
- Passwords hashed with **argon2**
- Sessions: **httpOnly**, **Secure**, **SameSite=Lax** cookies + CSRF on state-changing requests
- Rate limits on login, signup, password reset, bug reports
- Server-side Pydantic validation; admin routes enforced on the server
- Third-party API keys encrypted with Fernet (`APP_ENCRYPTION_KEY`); masked only to clients
- `gitleaks` pre-commit hook; run full history: `gitleaks detect --source . --verbose`

Dependency audits:

```bash
# Python
cd backend && pip install pip-audit && pip-audit

# Frontend
cd frontend && npm audit --omit=dev
```

## Contributing

1. Read `AGENTS.md` and `.cursor/rules/` — accessibility and layout rules always apply.
2. Do **not** commit `blueprint.md`, `.env`, or secrets.
3. Prefer small focused PRs; add/update backend tests for service logic you change.
4. Keep features talking to devices only through `frontend/src/input` and `frontend/src/feedback`.

## License

MIT — see [LICENSE](LICENSE).
