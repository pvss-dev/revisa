#!/bin/sh
set -eu

: "${APP_DIR:?VPS_APP_DIR is missing}"
: "${IMAGE_REPO:?GitHub repository is missing}"
: "${IMAGE_TAG:?Image tag is missing}"
: "${GHCR_USER:?GitHub user is missing}"
: "${GHCR_TOKEN:?GitHub token is missing}"

case "$APP_DIR" in
  /*) ;;
  *) echo 'VPS_APP_DIR must be an absolute path.' >&2; exit 1 ;;
esac
case "$IMAGE_TAG" in
  *[!A-Za-z0-9_.-]*|'') echo 'Invalid image tag.' >&2; exit 1 ;;
esac

cd "$APP_DIR"
[ -f .env.production ] || { echo '.env.production is missing on the VPS.' >&2; exit 1; }
[ -f docker-compose.yml ] || { echo 'docker-compose.yml is missing on the VPS.' >&2; exit 1; }

deploy_complete=false
DOCKER_CONFIG=''
cleanup() {
  if [ -n "$DOCKER_CONFIG" ]; then
    rm -rf "$DOCKER_CONFIG"
  fi
  if [ "$deploy_complete" != true ] && [ -f docker-compose.yml.previous ]; then
    cp docker-compose.yml.previous docker-compose.yml
  fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

repository=$(printf '%s' "$IMAGE_REPO" | tr '[:upper:]' '[:lower:]')
REVISA_IMAGE="ghcr.io/$repository:$IMAGE_TAG"
export REVISA_IMAGE

compose() {
  docker compose --env-file .env.production -f docker-compose.yml "$@"
}

compose config --quiet

previous=none
rollback_image=''
previous_container=$(docker ps -aq \
  --filter label=com.docker.compose.project=revisa-prod \
  --filter label=com.docker.compose.service=app | head -n 1)
if [ -n "$previous_container" ]; then
  previous=$(docker inspect --format '{{.Config.Image}}' "$previous_container")
  previous_id=$(docker inspect --format '{{.Image}}' "$previous_container")
  rollback_image=revisa-prod:rollback
  docker image tag "$previous_id" "$rollback_image"
fi

echo "Previous image: $previous"
echo "Deploying: $REVISA_IMAGE"

DOCKER_CONFIG=$(mktemp -d)
export DOCKER_CONFIG
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin >/dev/null
unset GHCR_TOKEN
docker pull "$REVISA_IMAGE"

start_ok=true
if [ "${RESTART:-false}" = true ]; then
  if ! compose up -d --no-build --force-recreate; then
    start_ok=false
  fi
else
  if ! compose up -d --no-build; then
    start_ok=false
  fi
fi

wait_healthy() {
  limit=$1
  attempt=0
  while [ "$attempt" -lt "$limit" ]; do
    attempt=$((attempt + 1))
    container=$(compose ps -a -q app | head -n 1)
    if [ -n "$container" ]; then
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo missing)
      if [ "$status" = healthy ]; then
        echo "Application healthy after check $attempt."
        return 0
      fi
      if [ "$status" = unhealthy ] || [ "$status" = exited ]; then
        echo "Application status: $status" >&2
        return 1
      fi
    fi
    sleep 10
  done
  echo 'Application health check timed out.' >&2
  return 1
}

if [ "$start_ok" = true ] && wait_healthy 30; then
  deploy_complete=true
  docker image prune -f --filter 'until=168h' >/dev/null || true
  exit 0
fi

container=$(compose ps -a -q app | head -n 1)
if [ -n "$container" ]; then
  docker logs --tail 60 "$container" || true
fi

if [ -n "$rollback_image" ]; then
  echo "Rolling back to $previous"
  if [ -f docker-compose.yml.previous ]; then
    cp docker-compose.yml.previous docker-compose.yml
  fi
  REVISA_IMAGE=$rollback_image
  export REVISA_IMAGE
  if ! compose config --quiet || ! compose up -d --no-build --force-recreate || ! wait_healthy 18; then
    echo 'Rollback also failed its health check.' >&2
  fi
fi
exit 1
