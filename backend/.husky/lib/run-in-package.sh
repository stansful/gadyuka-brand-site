#!/usr/bin/env sh
# Runs a package's own tool inside the package, for lint-staged tasks of the repository root:
#   sh backend/.husky/lib/run-in-package.sh <package dir> <binary> [args...] <files appended by lint-staged>
# The files are absolute paths, so changing into the package keeps them valid and lets the tool
# find the package's own config (.oxfmtrc.json, .oxlintrc.json).
package_dir=$1
binary=$2
shift 2
cd "$package_dir" || exit 1
if [ ! -x "./node_modules/.bin/$binary" ]; then
  echo "lint-staged: $package_dir/node_modules/.bin/$binary not found — run \`npm ci\` in $package_dir/" >&2
  exit 1
fi
exec "./node_modules/.bin/$binary" "$@"
