#!/usr/bin/env bash
# Isolated test run of one slice, so several engineers can test in parallel:
#   own build      backend/.build/<slice>/          (tsc + tsc-alias; never touches dist/ or generated/)
#   own database   gadyuka_test_<slice> on the dev Postgres (created and migrated by `prisma migrate deploy`)
#   own tests      the slice's compiled *.test.js (unit + e2e) with node --test
#
#   npm run test:slice -- <slice> [pattern ...]
#   sh scripts/test-slice.sh catalog                          # every test of the catalog slice
#   sh scripts/test-slice.sh catalog 'usecases/admin/catalog/collections/**/*.e2e.test.js'
#   sh scripts/test-slice.sh my-topic module/site-messages     # any name + explicit patterns
#
# Patterns are relative to src/: a directory (= its **/*.test.js) or a glob ending in .js. Without
# patterns the slice's default directories are used (table below). Requires the generated Prisma
# client (`npm run prisma:prepare`) and the services of docker-compose.yml. Environment: .env, then
# .env.test, then POSTGRES_NAME=gadyuka_test_<slice> (the process environment wins over both files).
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"

usage() {
  echo "usage: scripts/test-slice.sh <slice> [pattern ...]" >&2
  echo "slices with default patterns: entities content leads site-texts catalog content-entities media seed policy all" >&2
  exit 2
}

default_patterns() {
  case "$1" in
    entities) echo "usecases/admin/entities core/entities" ;;
    content) echo "usecases/public/content core/public-content" ;;
    leads) echo "usecases/public/leads usecases/admin/leads core/leads module/lead-notification" ;;
    site-texts) echo "usecases/admin/site-texts usecases/admin/dashboard module/site-messages core/site-texts" ;;
    catalog) echo "usecases/admin/catalog core/catalog usecases/admin/common" ;;
    content-entities) echo "usecases/admin/content core/content-entities usecases/admin/common" ;;
    media) echo "usecases/admin/media core/media" ;;
    seed) echo "cli" ;;
    policy) echo "test swagger" ;;
    all) echo "." ;;
    *) return 1 ;;
  esac
}

[ "$#" -ge 1 ] || usage
SLICE="$1"
shift
[[ "$SLICE" =~ ^[a-z][a-z0-9-]{0,40}$ ]] || { echo "slice: lowercase letters, digits and '-' only" >&2; exit 2; }

if [ "$#" -gt 0 ]; then
  PATTERNS=("$@")
else
  read -r -a PATTERNS <<< "$(default_patterns "$SLICE" || usage)"
fi

BUILD_DIR=".build/$SLICE"
LOCK_DIR=".build/$SLICE.lock"
DATABASE="gadyuka_test_${SLICE//-/_}"

mkdir -p .build
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "test-slice: '$SLICE' is already running (remove $BACKEND_DIR/$LOCK_DIR if it is stale)" >&2
  exit 1
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

echo "test-slice: compiling into $BUILD_DIR"
rm -rf "$BUILD_DIR"
./node_modules/.bin/tsc --project ./tsconfig.json --outDir "$BUILD_DIR"
./node_modules/.bin/tsc-alias --project ./tsconfig.json --outDir "$BUILD_DIR"

echo "test-slice: migrating database $DATABASE"
export POSTGRES_NAME="$DATABASE"
node --env-file-if-exists=./.env --env-file-if-exists=./.env.test ./node_modules/prisma/build/index.js migrate deploy

SRC_DIR="$BUILD_DIR/backend/src"
GLOBS=()
for pattern in "${PATTERNS[@]}"; do
  pattern="${pattern#./}"
  pattern="${pattern%/}"
  case "$pattern" in
    *.js) GLOBS+=("$SRC_DIR/$pattern") ;;
    .) GLOBS+=("$SRC_DIR/**/*.test.js") ;;
    *) GLOBS+=("$SRC_DIR/$pattern/**/*.test.js") ;;
  esac
done

echo "test-slice: node --test ${GLOBS[*]}"
node --env-file-if-exists=./.env --env-file-if-exists=./.env.test --test "${GLOBS[@]}"
