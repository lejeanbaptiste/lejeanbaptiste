#!/bin/sh
# Grognard .deb postinst — onboard the machine to the Grognard apt repository so
# that `apt upgrade` keeps the app up to date. The standalone .deb otherwise has
# no update channel (the in-app updater is macOS/Windows only).
#
# What this does, once, on first configure:
#   * installs the repository signing key (shipped inside this package) to
#     /usr/share/keyrings/grognard.asc
#   * writes /etc/apt/sources.list.d/grognard.list
#
# Opt out by creating /etc/default/grognard with:  repo_add_once="false"
# (an existing sources.list.d entry is never overwritten, so local edits stick).

set -e

APT_REPO_URL="https://grognard.github.io/grognard/apt"
APT_SUITE="stable"
APT_COMPONENT="main"
KEYRING="/usr/share/keyrings/grognard.asc"
SOURCES_LIST="/etc/apt/sources.list.d/grognard.list"
DEFAULTS="/etc/default/grognard"

case "$1" in
  configure) ;;
  *) exit 0 ;;
esac

# Honour an explicit opt-out.
repo_add_once="true"
if [ -r "$DEFAULTS" ]; then
  # shellcheck disable=SC1090
  . "$DEFAULTS" || true
fi
if [ "$repo_add_once" = "false" ]; then
  exit 0
fi

# Locate the signing key bundled with the app (extraResources -> resources/apt).
KEY_SRC=""
for candidate in \
  /opt/Grognard/resources/apt/grognard-archive-key.asc \
  /opt/*/resources/apt/grognard-archive-key.asc
do
  if [ -f "$candidate" ]; then
    KEY_SRC="$candidate"
    break
  fi
done

if [ -z "$KEY_SRC" ]; then
  echo "grognard: bundled apt signing key not found; skipping apt repository setup." >&2
  echo "grognard: see https://grognard.github.io/grognard/ for manual instructions." >&2
  exit 0
fi

mkdir -p "$(dirname "$KEYRING")"
cp "$KEY_SRC" "$KEYRING"
chmod 0644 "$KEYRING"

# Pin to this machine's architecture — the repo only publishes amd64 and arm64,
# and an unpinned entry makes apt complain about any foreign architecture added
# with `dpkg --add-architecture`.
ARCH="$(dpkg --print-architecture 2>/dev/null || echo amd64)"

if [ ! -e "$SOURCES_LIST" ]; then
  mkdir -p "$(dirname "$SOURCES_LIST")"
  cat > "$SOURCES_LIST" <<EOF
# Added by the grognard-desktop package. Delete this file to stop receiving
# Grognard updates via apt; set repo_add_once="false" in $DEFAULTS to keep it
# deleted across reinstalls.
deb [arch=$ARCH signed-by=$KEYRING] $APT_REPO_URL $APT_SUITE $APT_COMPONENT
EOF
  echo "grognard: added apt repository $APT_REPO_URL ($APT_SUITE $APT_COMPONENT)." >&2
  echo "grognard: run 'sudo apt update' to pick up future updates." >&2
fi

exit 0
