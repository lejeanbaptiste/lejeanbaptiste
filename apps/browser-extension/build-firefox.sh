#!/bin/sh
# Assemble the Firefox build of the extension into dist/firefox/.
# The shared sources (content scripts, popup, icons) are single-source in this
# folder; only the manifest differs between Chrome and Firefox.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
out="$here/dist/firefox"

rm -rf "$out"
mkdir -p "$out"

cp "$here/content.js" \
   "$here/content-kanripo.js" \
   "$here/content-bdrc.js" \
   "$here/popup.html" \
   "$here/popup.js" \
   "$out/"
cp -R "$here/icons" "$out/icons"
cp "$here/manifest.firefox.json" "$out/manifest.json"

echo "Built Firefox extension at $out"
echo "Load it via about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> $out/manifest.json"
