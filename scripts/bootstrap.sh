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

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap.sh [options]

Create or refresh .env with real secrets, then start Dotline with Docker Compose.

Options:
  --url URL           Set PUBLIC_BASE_URL (e.g. https://dotline.example.com)
  --port N            Set DOTLINE_PORT (default from .env.example, usually 47391)
  --env-only          Write/update .env only; do not run docker compose
  --force-secrets     Regenerate SECRET_KEY, APP_ENCRYPTION_KEY, POSTGRES_PASSWORD
                      even if they already look set (destructive for existing data)
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
  echo "Missing $EXAMPLE_FILE — run this from a Dotline checkout." >&2
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

ensure_secret SECRET_KEY gen_secret
ensure_secret APP_ENCRYPTION_KEY gen_fernet
ensure_secret POSTGRES_PASSWORD gen_password

PUBLIC_BASE_URL_VALUE="${PUBLIC_BASE_URL_ARG:-${PUBLIC_BASE_URL:-}}"
if [[ -n "$PUBLIC_BASE_URL_VALUE" ]]; then
  env_set PUBLIC_BASE_URL "$PUBLIC_BASE_URL_VALUE"
  echo "Set PUBLIC_BASE_URL=$PUBLIC_BASE_URL_VALUE"
else
  current_url="$(env_get PUBLIC_BASE_URL)"
  if is_placeholder "$current_url" || [[ "$current_url" == *"example.com"* ]]; then
    echo "Warning: PUBLIC_BASE_URL is still a placeholder ($current_url)." >&2
    echo "         Pass --url https://your.domain or set it in $ENV_FILE." >&2
  else
    echo "Kept PUBLIC_BASE_URL=$current_url"
  fi
fi

if [[ -n "${DOTLINE_PORT_ARG:-${DOTLINE_PORT:-}}" ]]; then
  port_value="${DOTLINE_PORT_ARG:-$DOTLINE_PORT}"
  env_set DOTLINE_PORT "$port_value"
  echo "Set DOTLINE_PORT=$port_value"
fi

final_port="$(env_get DOTLINE_PORT)"
final_port="${final_port:-47391}"
final_url="$(env_get PUBLIC_BASE_URL)"

if [[ "$SKIP_COMPOSE" -eq 1 ]]; then
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

echo
echo "Building and starting containers..."
docker compose up -d --build

echo
echo "Waiting for /api/health ..."
ready=0
for _ in $(seq 1 60); do
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
  echo "Check: docker compose logs -f app" >&2
fi

echo
echo "Next: open the setup page and create the first admin."
echo "  http://localhost:${final_port}/setup"
if [[ -n "$final_url" && "$final_url" != *"example.com"* ]]; then
  echo "  ${final_url%/}/setup"
fi
echo
echo "Logs: docker compose logs -f"
