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
./scripts/bootstrap.sh
```

That is the full first-run path: secrets, containers, health check. Then open:

`http://SERVER_IP:47391/setup`

Create the admin and log in. No domain required yet.

### Later: Nginx Proxy Manager + HTTPS

1. Proxy NPM to `http://host:47391` (or your `DOTLINE_PORT`)
2. Set the real URL in `.env`:

```bash
PUBLIC_BASE_URL=https://your.domain
docker compose up -d
```

Email links and Secure cookies then follow that HTTPS URL. Until then, leave `PUBLIC_BASE_URL=http://localhost:47391` so LAN HTTP login works.

### Bootstrap flags

```bash
./scripts/bootstrap.sh --port 47391
./scripts/bootstrap.sh --env-only          # write .env only
./scripts/bootstrap.sh --force-secrets    # rotate app secrets (not DB password)
./scripts/bootstrap.sh --reset-db         # wipe volumes + new DB password (destroys data)
./scripts/bootstrap.sh --url https://your.domain   # optional, when HTTPS is ready
```

Postgres only reads `POSTGRES_PASSWORD` on first volume init. If auth fails after rotating that password, run `./scripts/bootstrap.sh --reset-db` (destroys data) or restore the original password.

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
