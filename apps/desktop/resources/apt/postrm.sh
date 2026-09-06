#!/bin/sh
# Grognard .deb postrm — remove the apt repository onboarding on `purge` only.
#
# On a plain `apt remove` the sources list and keyring are left in place, so a
# later reinstall keeps working and security updates still flow (this mirrors
# how google-chrome's package behaves). `apt purge` removes them.

set -e

KEYRING="/usr/share/keyrings/grognard.asc"
SOURCES_LIST="/etc/apt/sources.list.d/grognard.list"

case "$1" in
  purge)
    rm -f "$SOURCES_LIST" "$KEYRING"
    ;;
esac

exit 0
