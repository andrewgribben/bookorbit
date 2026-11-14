#!/usr/bin/env bash
# Syncs the Reactor web library build from a pinned ref of the Reactor repo into this repo
# (docs/plans/W1.md section 3, task W1-B1). Mirrors bookorbit-android's scripts/sync-reactor.sh.
#
# Builds in a temporary git worktree so this repo never depends on the reactor checkout's working
# directory state (branch, dirty files, node_modules) staying put.
#
# Usage: scripts/sync-reactor.sh <git-tag-or-commit> [reactor-repo-path]
#   <git-tag-or-commit>   Required. A ref in the reactor repo to build and pin.
#   [reactor-repo-path]   Optional. Defaults to D:/Development/reactor.
#
# Writes:
#   client/vendor/reactor/dist/            the built library (dist/reactor.js, dist/index.d.ts)
#   client/vendor/reactor/package.json     reactor's package.json (so pnpm can resolve the file: dep)
#   client/vendor/reactor/LICENSE          reactor's LICENSE, if it has one
#   client/vendor/reactor/REACTOR_VERSION  "ref=<ref>\nversion=<package version>\n"
set -euo pipefail

usage() {
  echo "Usage: $0 <git-tag-or-commit> [reactor-repo-path]" >&2
  echo "  Builds the Reactor web library from a pinned ref in a temporary git worktree" >&2
  echo "  of the reactor repo, and copies the built dist/ into client/vendor/reactor/." >&2
  exit 1
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  usage
fi

REF="$1"
if [ -z "$REF" ]; then
  usage
fi
REACTOR_REPO="${2:-D:/Development/reactor}"

if ! git -C "$REACTOR_REPO" rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: '$REACTOR_REPO' is not a git repository" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKTREE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sync-reactor.XXXXXX")"
rmdir "$WORKTREE_DIR" # git worktree add requires the target not to exist yet
# On Windows git-bash, native git cannot resolve MSYS paths like /tmp/...
if command -v cygpath >/dev/null 2>&1; then WORKTREE_DIR="$(cygpath -m "$WORKTREE_DIR")"; fi
cleanup() {
  git -C "$REACTOR_REPO" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
  rm -rf "$WORKTREE_DIR"
}
trap cleanup EXIT

echo "Adding a worktree of '$REACTOR_REPO' at '$REF'..."
git -C "$REACTOR_REPO" worktree add --detach "$WORKTREE_DIR" "$REF"

echo "Installing dependencies (pnpm install --frozen-lockfile)..."
(cd "$WORKTREE_DIR" && pnpm install --frozen-lockfile)

HAS_BUILD="$(cd "$WORKTREE_DIR" && node -e "
const pkg = require('./package.json');
process.stdout.write(pkg.scripts && pkg.scripts['build'] ? 'yes' : 'no');
")"
if [ "$HAS_BUILD" != "yes" ]; then
  echo "error: reactor's package.json at ref '$REF' has no 'build' script." >&2
  exit 1
fi

echo "Building the web library (pnpm build)..."
(cd "$WORKTREE_DIR" && pnpm build)

DIST_DIR="$WORKTREE_DIR/dist"
if [ ! -d "$DIST_DIR" ]; then
  echo "error: expected '$DIST_DIR' after 'pnpm build' but it does not exist." >&2
  exit 1
fi
if [ ! -f "$DIST_DIR/reactor.js" ] || [ ! -f "$DIST_DIR/index.d.ts" ]; then
  echo "error: '$DIST_DIR' is missing reactor.js or index.d.ts." >&2
  exit 1
fi

PACKAGE_VERSION="$(cd "$WORKTREE_DIR" && node -e "
const pkg = require('./package.json');
process.stdout.write(pkg.version || '');
")"
if [ -z "$PACKAGE_VERSION" ]; then
  echo "error: reactor's package.json has no 'version' field." >&2
  exit 1
fi

VENDOR_DIR="$REPO_ROOT/client/vendor/reactor"

echo "Copying the built library into $VENDOR_DIR ..."
rm -rf "$VENDOR_DIR"
mkdir -p "$VENDOR_DIR"
cp -R "$DIST_DIR" "$VENDOR_DIR/dist"
cp "$WORKTREE_DIR/package.json" "$VENDOR_DIR/package.json"
if [ -f "$WORKTREE_DIR/LICENSE" ]; then
  cp "$WORKTREE_DIR/LICENSE" "$VENDOR_DIR/LICENSE"
fi

VERSION_FILE="$VENDOR_DIR/REACTOR_VERSION"
{
  echo "ref=$REF"
  echo "version=$PACKAGE_VERSION"
} > "$VERSION_FILE"

# pnpm copies file: dependencies into node_modules, so refresh that copy or type-check and
# builds keep using the previous version.
echo "Refreshing the installed copy ..."
pnpm install --frozen-lockfile

echo "Done. Pinned ref=$REF version=$PACKAGE_VERSION in $VERSION_FILE"
