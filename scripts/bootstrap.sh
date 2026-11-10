#!/usr/bin/env bash
# Bootstrap Dotline on a fresh host: .env secrets + docker compose up.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="${EXAMPLE_FILE:-.env.example}"
SKIP_COMPOSE=0
PUBLIC_BASE_URL_ARG=""
DOTLINE_PORT_ARG=""
FORCE_SECRETS=0
RESET_DB=0

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap.sh [options]

Create or refresh .env with real secrets, then start Dotline with Docker Compose.

Options:
  --url URL           Optional. Set PUBLIC_BASE_URL now (e.g. https://dotline.example.com).
                      Omit for first run — defaults to http://localhost:PORT so LAN HTTP
                      login works; set the real HTTPS URL later behind Nginx Proxy Manager.
  --port N            Set DOTLINE_PORT (default from .env.example, usually 47391)
  --env-only          Write/update .env only; do not run docker compose
  --force-secrets     Regenerate SECRET_KEY and APP_ENCRYPTION_KEY even if set.
                      Does not change POSTGRES_PASSWORD unless --reset-db is also
                      passed (Postgres keeps the password from first volume init).
  --reset-db          Stop containers, delete ./data/postgres + ./data/app (and any
                      leftover named volumes), then generate a new POSTGRES_PASSWORD.
                      Destroys all Dotline data.
  -h, --help          Show this help

Environment:
  PUBLIC_BASE_URL     Same as --url
  DOTLINE_PORT        Same as --port
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      PUBLIC_BASE_URL_ARG="${2:-}"
      shift 2
      ;;
    --port)
      DOTLINE_PORT_ARG="${2:-}"
      shift 2
      ;;
    --env-only)
      SKIP_COMPOSE=1
      shift
      ;;
    --force-secrets)
      FORCE_SECRETS=1
      shift
      ;;
    --reset-db)
      RESET_DB=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "Missing $EXAMPLE_FILE — run this from the Dotline repo root (or scripts/../)." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to generate secrets." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE from $EXAMPLE_FILE"
else
  echo "Using existing $ENV_FILE"
fi

# Read a KEY=value from .env (last occurrence wins; ignores comments/blank).
env_get() {
  local key="$1"
  python3 - "$ENV_FILE" "$key" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
value = ""
with open(path, encoding="utf-8") as f:
    for line in f:
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, _, v = s.partition("=")
        if k.strip() == key:
            value = v.strip()
print(value)
PY
}

# Set or replace KEY=value in .env (preserves comments and order).
env_set() {
  local key="$1"
  local value="$2"
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = []
found = False
with open(path, encoding="utf-8") as f:
    for line in f:
        raw = line.rstrip("\n")
        s = raw.strip()
        if s and not s.startswith("#") and "=" in s:
            k, _, _ = s.partition("=")
            if k.strip() == key:
                lines.append(f"{key}={value}")
                found = True
                continue
        lines.append(raw)
if not found:
    if lines and lines[-1] != "":
        lines.append("")
    lines.append(f"{key}={value}")
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(lines) + "\n")
PY
}

is_placeholder() {
  local value="$1"
  [[ -z "$value" ]] && return 0
  case "$value" in
    change_me*|changeme*|REPLACE*|replace*|todo*|TODO*|example*|EXAMPLE*)
      return 0
      ;;
  esac
  return 1
}

gen_secret() {
  python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
}

# Fernet key = url-safe base64 of 32 random bytes (no cryptography package needed).
gen_fernet() {
  python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())'
}

gen_password() {
  python3 -c 'import secrets; print(secrets.token_urlsafe(24))'
}

ensure_secret() {
  local key="$1"
  local generator="$2"
  local current
  current="$(env_get "$key")"
  if [[ "$FORCE_SECRETS" -eq 1 ]] || is_placeholder "$current"; then
    local new_value
    new_value="$("$generator")"
    env_set "$key" "$new_value"
    echo "Set $key"
  else
    echo "Kept existing $key"
  fi
}

compose_project_name() {
  local name=""
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    name="$(
      docker compose config --format json 2>/dev/null \
        | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name") or "")' 2>/dev/null \
        || true
    )"
  fi
  if [[ -z "$name" && -n "${COMPOSE_PROJECT_NAME:-}" ]]; then
    name="$COMPOSE_PROJECT_NAME"
  fi
  if [[ -z "$name" ]]; then
    name="$(basename "$ROOT")"
  fi
  # Compose lowercases project names for volume prefixes.
  printf '%s' "$name" | tr '[:upper:]' '[:lower:]'
}

postgres_data_exists() {
  # Bind-mounted data next to compose, or leftover named volume from older installs.
  if [[ -f "$ROOT/data/postgres/PG_VERSION" ]] || [[ -d "$ROOT/data/postgres/base" ]]; then
    return 0
  fi
  command -v docker >/dev/null 2>&1 || return 1
  local project
  project="$(compose_project_name)"
  [[ -n "$project" ]] || return 1
  docker volume inspect "${project}_postgres_data" >/dev/null 2>&1
}

wipe_dotline_data() {
  echo "Stopping containers..."
  docker compose down --remove-orphans >/dev/null 2>&1 || true

  echo "Removing ./data/postgres and ./data/app ..."
  rm -rf "$ROOT/data/postgres" "$ROOT/data/app"

  # Older installs used named volumes — remove those too if present.
  local project
  project="$(compose_project_name)"
  if [[ -n "$project" ]]; then
    docker volume rm "${project}_postgres_data" "${project}_app_data" >/dev/null 2>&1 || true
  fi
  # compose down -v in case project name differs
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
}

if [[ "$RESET_DB" -eq 1 ]]; then
  FORCE_SECRETS=1
fi

ensure_secret SECRET_KEY gen_secret
ensure_secret APP_ENCRYPTION_KEY gen_fernet

# Postgres only applies POSTGRES_PASSWORD on first data init. Changing .env later
# without wiping ./data/postgres causes "password authentication failed".
pg_pass_current="$(env_get POSTGRES_PASSWORD)"
data_present=0
if postgres_data_exists; then
  data_present=1
fi

if [[ "$RESET_DB" -eq 1 ]]; then
  env_set POSTGRES_PASSWORD "$(gen_password)"
  echo "Set POSTGRES_PASSWORD (will re-init after data wipe)"
elif [[ "$data_present" -eq 1 ]]; then
  if is_placeholder "$pg_pass_current"; then
    echo "Warning: Postgres data already exists under ./data/postgres (or an old" >&2
    echo "         named volume), but POSTGRES_PASSWORD still looks like a placeholder." >&2
    echo "         Keep the original password, or wipe with: ./scripts/bootstrap.sh --reset-db" >&2
  else
    echo "Kept existing POSTGRES_PASSWORD (Postgres data already initialized)"
  fi
elif is_placeholder "$pg_pass_current" || [[ "$FORCE_SECRETS" -eq 1 ]]; then
  env_set POSTGRES_PASSWORD "$(gen_password)"
  echo "Set POSTGRES_PASSWORD"
else
  echo "Kept existing POSTGRES_PASSWORD"
fi

if [[ -n "${DOTLINE_PORT_ARG:-${DOTLINE_PORT:-}}" ]]; then
  port_value="${DOTLINE_PORT_ARG:-$DOTLINE_PORT}"
  env_set DOTLINE_PORT "$port_value"
  echo "Set DOTLINE_PORT=$port_value"
fi

final_port="$(env_get DOTLINE_PORT)"
final_port="${final_port:-47391}"
default_local_url="http://localhost:${final_port}"

PUBLIC_BASE_URL_VALUE="${PUBLIC_BASE_URL_ARG:-${PUBLIC_BASE_URL:-}}"
if [[ -n "$PUBLIC_BASE_URL_VALUE" ]]; then
  env_set PUBLIC_BASE_URL "$PUBLIC_BASE_URL_VALUE"
  echo "Set PUBLIC_BASE_URL=$PUBLIC_BASE_URL_VALUE"
else
  current_url="$(env_get PUBLIC_BASE_URL)"
  if is_placeholder "$current_url" || [[ "$current_url" == *"example.com"* ]] || [[ -z "$current_url" ]]; then
    env_set PUBLIC_BASE_URL "$default_local_url"
    echo "Set PUBLIC_BASE_URL=$default_local_url (set --url later for Nginx Proxy Manager)"
  else
    echo "Kept PUBLIC_BASE_URL=$current_url"
  fi
fi

final_url="$(env_get PUBLIC_BASE_URL)"

# Secure cookies break plain HTTP (LAN IP). Only enable when the chosen URL is HTTPS.
if [[ "${final_url}" == https://* ]]; then
  env_set COOKIE_SECURE true
  echo "Set COOKIE_SECURE=true (HTTPS URL)"
else
  env_set COOKIE_SECURE false
  echo "Set COOKIE_SECURE=false (HTTP — required for LAN login / CSRF cookies)"
fi

mkdir -p "$ROOT/data/postgres" "$ROOT/data/app"

if [[ "$SKIP_COMPOSE" -eq 1 ]]; then
  if [[ "$RESET_DB" -eq 1 ]]; then
    echo "Note: --reset-db with --env-only only updated .env; data was not wiped." >&2
  fi
  echo
  echo "Env ready. Start later with: docker compose up -d --build"
  echo "Then open http://localhost:${final_port}/setup (or ${final_url}/setup)"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required (or re-run with --env-only)." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required (Docker Compose v2 plugin)." >&2
  exit 1
fi

if [[ "$RESET_DB" -eq 1 ]]; then
  echo
  wipe_dotline_data
  mkdir -p "$ROOT/data/postgres" "$ROOT/data/app"
fi

echo
echo "Building and starting containers..."
docker compose up -d --build

echo
echo "Waiting for /api/health ..."
ready=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${final_port}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -eq 1 ]]; then
  echo "Dotline is up."
else
  echo "Containers started, but health check did not pass yet." >&2
  app_logs="$(docker compose logs --no-color --tail=80 app 2>/dev/null || true)"
  if echo "$app_logs" | grep -qi 'password authentication failed'; then
    echo >&2
    echo "Postgres rejected the password in .env." >&2
    echo "Fresh install (destroys data): ./scripts/bootstrap.sh --reset-db" >&2
  else
    echo "Check: docker compose logs -f app" >&2
  fi
fi

echo
echo "Data directory: $ROOT/data  (postgres/ + app/)"
echo "Next: open the setup page and create the first admin."
echo "  http://SERVER_IP:${final_port}/setup"
echo "  http://localhost:${final_port}/setup"
if [[ -n "$final_url" && "$final_url" != *"example.com"* && "$final_url" != http://localhost* ]]; then
  echo "  ${final_url%/}/setup"
fi
echo
echo "Logs: docker compose logs -f"
