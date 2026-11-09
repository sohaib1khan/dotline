# Dotline — Agent & Contributor Guide

Dotline is a self-hosted PWA that teaches **braille** (English UEB Grade 1) and **cursive** to beginners, designed **low-vision first**.

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Postgres 16 |
| Auth | argon2, httpOnly session cookies, CSRF |
| Frontend | React 18, Vite, TypeScript (strict), Tailwind, Zustand, TanStack Query |
| 3D | React Three Fiber + drei |
| Containers | Docker Compose — `app` (published port) + `db` (internal only) |

## Layout

```
backend/app/          FastAPI app (routers, models, services, security)
frontend/src/         React app (pages, features, input, feedback, theme)
docker/app.Dockerfile Multi-stage: Node builds UI, Python serves API + static
```

## Conventions

- Build **one phase at a time** from the private blueprint. Do not invent ahead.
- Never commit secrets or `blueprint.md`. Use `.env` (gitignored); commit only `.env.example`.
- Accessibility and layout rules in `.cursor/rules/` always apply.
- Business logic lives in `backend/app/services/`, not routers.
- Device I/O goes through `frontend/src/input` and `frontend/src/feedback` only.
- Small files, one responsibility, TypeScript strict, Python type hints.

## Local run

```bash
cp .env.example .env
# Generate secrets (see README) and put them in .env
docker compose up --build
```

App: `http://localhost:${DOTLINE_PORT}` (default `47391`). Health: `/api/health`.

## Roles

- **admin** — users, content, settings, bugs, monitoring
- **learner** — learn, play, progress, report bugs
