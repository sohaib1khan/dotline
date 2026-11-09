# Dotline

Learn **braille** and **cursive** — made for low vision.

Self-hosted web app (installable as a PWA). Open source. Runs in Docker.

## Quick start

```bash
cp .env.example .env
```

Generate secrets and put them in `.env`:

```bash
# SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# APP_ENCRYPTION_KEY (Fernet)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

If you do not have `cryptography` installed yet:

```bash
pip install cryptography
```

Then:

```bash
docker compose up --build
```

Open [http://localhost:47391](http://localhost:47391). Health check: [http://localhost:47391/api/health](http://localhost:47391/api/health).

Change `DOTLINE_PORT` in `.env` if that port is taken. Point Nginx Proxy Manager at `host:${DOTLINE_PORT}`.

## Status

Phase 0 scaffold is in place. Features land in later phases — see `AGENTS.md` for structure and conventions.

## License

MIT — see [LICENSE](LICENSE).
