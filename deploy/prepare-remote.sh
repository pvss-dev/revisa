#!/bin/sh
set -eu

: "${APP_DIR:?VPS_APP_DIR is missing}"
: "${IMAGE_REPO:?GitHub repository is missing}"
: "${PROXY_NETWORK:=nginx_local-net}"

case "$APP_DIR" in
  /*) ;;
  *) echo 'VPS_APP_DIR must be an absolute path.' >&2; exit 1 ;;
esac
case "$PROXY_NETWORK" in
  *[!A-Za-z0-9_.-]*|'') echo 'Invalid PROXY_NETWORK.' >&2; exit 1 ;;
esac

mkdir -p "$APP_DIR"
env_file="$APP_DIR/.env.production"

if [ -f "$env_file" ]; then
  stored_password=''
  while IFS='=' read -r name value || [ -n "$name$value" ]; do
    if [ "$name" = POSTGRES_PASSWORD ]; then
      stored_password=$value
    fi
  done < "$env_file"
  case "$stored_password" in
    *[!0-9a-fA-F]*|'') echo 'Invalid POSTGRES_PASSWORD in the existing .env.production.' >&2; exit 1 ;;
  esac
  if [ "${#stored_password}" -ne 64 ]; then
    echo 'Invalid POSTGRES_PASSWORD length in the existing .env.production.' >&2
    exit 1
  fi
  postgres_password=$stored_password
elif docker volume inspect revisa_postgres_data >/dev/null 2>&1; then
  echo 'The PostgreSQL volume already exists but .env.production is missing. Recover the previous password before deploying.' >&2
  exit 1
else
  command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL is required to generate the PostgreSQL password.' >&2; exit 1; }
  postgres_password=$(openssl rand -hex 32)
fi

repository=$(printf '%s' "$IMAGE_REPO" | tr '[:upper:]' '[:lower:]')
umask 077
temporary_file=$(mktemp "$APP_DIR/.env.production.tmp.XXXXXX")
trap 'rm -f "$temporary_file"' EXIT
printf 'PROXY_NETWORK=%s\nPOSTGRES_PASSWORD=%s\nREVISA_IMAGE=ghcr.io/%s:latest\n' \
  "$PROXY_NETWORK" "$postgres_password" "$repository" > "$temporary_file"
mv "$temporary_file" "$env_file"
trap - EXIT

if [ -f "$APP_DIR/docker-compose.yml" ]; then
  cp "$APP_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml.previous"
fi
echo 'VPS directory and production environment are ready.'
