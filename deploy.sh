#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
STAGE_DIR="$ROOT_DIR/.deploy/pennywise"
GO_CACHE_DIR="$ROOT_DIR/.deploy/go-build-cache"

REMOTE="neelchana@192.168.0.7"
DEST="/home/neelchana/app/pennywise"
REMOTE_MIGRATE_DATABASE_URL="mysql://root:admin123@tcp(127.0.0.1:3306)/pennywise?parseTime=true&multiStatements=true"
GOOS_TARGET="linux"
GOARCH_TARGET="amd64"
SSH_CONTROL_DIR="$ROOT_DIR/.deploy/ssh-control"
SSH_CONTROL_PATH="$SSH_CONTROL_DIR/%r@%h:%p"
SSH_OPTS=(
  -o ControlMaster=auto
  -o ControlPath="$SSH_CONTROL_PATH"
  -o ControlPersist=10m
)
RSYNC_RSH="ssh -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=10m"

close_ssh_control() {
  ssh "${SSH_OPTS[@]}" -O exit "$REMOTE" >/dev/null 2>&1 || true
}

mkdir -p "$SSH_CONTROL_DIR"
trap close_ssh_control EXIT

echo "==> Building frontend"
(
  cd "$FRONTEND_DIR"
  npm run build
)

echo "==> Building backend for ${GOOS_TARGET}/${GOARCH_TARGET}"
(
  cd "$BACKEND_DIR"
  mkdir -p "$GO_CACHE_DIR"
  GOCACHE="$GO_CACHE_DIR" GOOS="$GOOS_TARGET" GOARCH="$GOARCH_TARGET" CGO_ENABLED=0 go build -o "$ROOT_DIR/.deploy/pennywise-bin" ./cmd/server
)

echo "==> Staging files"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/public" "$STAGE_DIR/migrations"

cp "$ROOT_DIR/.deploy/pennywise-bin" "$STAGE_DIR/pennywise"
cp -R "$BACKEND_DIR/migrations/." "$STAGE_DIR/migrations/"
cp -R "$FRONTEND_DIR/dist/." "$STAGE_DIR/public/"
cp "$BACKEND_DIR/.env" "$STAGE_DIR/.env"

echo "==> Opening SSH connection to ${REMOTE}"
ssh -fN "${SSH_OPTS[@]}" "$REMOTE"

echo "==> Copying release to ${REMOTE}:${DEST}"
rsync -az --delete -e "$RSYNC_RSH" --rsync-path="mkdir -p '$DEST' && rsync" "$STAGE_DIR/" "$REMOTE:$DEST/"

echo "==> Running migrations and restarting pennywise service"
ssh -t "${SSH_OPTS[@]}" "$REMOTE" "cd '$DEST' && go run -tags mysql github.com/golang-migrate/migrate/v4/cmd/migrate@v4.18.3 -path migrations -database '$REMOTE_MIGRATE_DATABASE_URL' up && sudo systemctl restart pennywise"

echo "==> Deployed"
echo "Remote layout:"
echo "  $DEST/pennywise"
echo "  $DEST/migrations"
echo "  $DEST/public"
