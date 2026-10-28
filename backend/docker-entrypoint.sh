#!/bin/sh
set -eu

# A mounted Railway volume is owned by root at runtime and hides image-layer ownership.
# Only prepare the dedicated data directory, then run the API as the unprivileged node user.
deck_dir="${CUSTOM_DECK_DIR:-/app/data/custom-decks}"
case "$deck_dir" in
  /app/data|/app/data/*) ;;
  *) echo 'CUSTOM_DECK_DIR must be inside /app/data in the container.' >&2; exit 1 ;;
esac
case "/$deck_dir/" in
  */../*|*/./*) echo 'CUSTOM_DECK_DIR must not contain dot segments.' >&2; exit 1 ;;
esac
mkdir -p "$deck_dir"
chown node:node /app/data "$deck_dir"
find "$deck_dir" -maxdepth 1 -type f -exec chown node:node {} +
exec su-exec node:node "$@"
