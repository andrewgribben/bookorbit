#!/usr/bin/env bash
# Build a local BookOrbit image for Unraid testing.
#
# Default: andrewgribben/bookorbit:development (all commits on the current branch)
# Optional: also tag a PR-specific image, e.g.
#   ./scripts/build-dev-image.sh --pr 1535
#   ./scripts/build-dev-image.sh --tag bookorbit:pr-feeds
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE_REPO="${BOOKORBIT_IMAGE_REPO:-andrewgribben/bookorbit}"
PRIMARY_TAG="${BOOKORBIT_IMAGE_TAG:-development}"
EXTRA_TAGS=()
PR_NUMBER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      PR_NUMBER="${2:?PR number required}"
      shift 2
      ;;
    --tag)
      EXTRA_TAGS+=("${2:?tag required}")
      shift 2
      ;;
    --repo)
      IMAGE_REPO="${2:?repo required}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
PRIMARY="${IMAGE_REPO}:${PRIMARY_TAG}"
SHA_TAG="${IMAGE_REPO}:${PRIMARY_TAG}-${SHA}"

if [[ -n "$PR_NUMBER" ]]; then
  EXTRA_TAGS+=("${IMAGE_REPO}:pr-${PR_NUMBER}" "bookorbit:pr-${PR_NUMBER}")
fi

TAG_ARGS=(-t "$PRIMARY" -t "$SHA_TAG")
for tag in "${EXTRA_TAGS[@]}"; do
  TAG_ARGS+=(-t "$tag")
done

echo "Building BookOrbit image from ${BRANCH}@${SHA}"
echo "Tags: ${PRIMARY} ${SHA_TAG} ${EXTRA_TAGS[*]:-}"

docker build \
  --build-arg "APP_VERSION=${PRIMARY_TAG}-${SHA}" \
  "${TAG_ARGS[@]}" \
  .

echo
echo "Built:"
docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}\t{{.CreatedSince}}' \
  | awk -v repo="$IMAGE_REPO" -v primary="$PRIMARY_TAG" '
      NR==1 { print; next }
      index($1, repo ":" primary) == 1 || index($1, "bookorbit:pr-") == 1 { print }
    '

echo
echo "Unraid: set the bookorbit container Repository to ${PRIMARY}"
echo "Or a PR-specific tag such as ${IMAGE_REPO}:pr-<number> / bookorbit:pr-<number>"
