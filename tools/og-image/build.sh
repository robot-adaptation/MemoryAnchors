#!/usr/bin/env bash
# Regenerate the social preview card from card.html.
#
#   ./tools/og-image/build.sh          # rebuild the version index.html uses
#   ./tools/og-image/build.sh 3        # cut v3 and repoint index.html at it
#
# Bump the version whenever the card's CONTENT changes. Twitter/X, LinkedIn and
# Slack cache og:image by URL and will keep serving the old picture for links
# already shared, so a new filename is the only reliable way to make them
# re-fetch. Old versions stay in assets/ on purpose: a scraper that cached the
# old URL should still get an image, not a 404.
#
# Needs Google Chrome and a network connection (the card pulls IBM Plex from
# Google Fonts; with no network it silently renders in a fallback face, which
# the check at the end catches).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# default to whatever index.html currently points at, so a plain run rebuilds
# in place rather than quietly cutting a new version
current="$(sed -n 's|.*assets/og-image-v\([0-9]*\)\.png.*|\1|p' "$root/index.html" | head -1)"
version="${1:-${current:-1}}"
out="$root/assets/og-image-v${version}.png"

[ -x "$chrome" ] || { echo "Chrome not found at $chrome" >&2; exit 1; }

"$chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --virtual-time-budget=10000 \
  --window-size=1200,630 --screenshot="$out" "file://$here/card.html" 2>/dev/null

# --- sanity checks -----------------------------------------------------------
# A screenshot always "succeeds", so verify the thing we actually care about:
# correct canvas, and real IBM Plex rather than a fallback face. The title's
# second line is 851px of ink when the webfont loaded; a fallback misses badly.
python3 - "$out" <<'PY'
import sys
try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("note: Pillow/numpy not installed, skipping render check")
    sys.exit(0)

a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int)
h, w = a.shape[:2]
assert (w, h) == (1200, 630), f"expected 1200x630, got {w}x{h}"

ink = (np.abs(a - a[5, 5]).sum(2) > 18)
cols = np.where(ink[306:378].any(0))[0]          # title, second line
width = cols[-1] - cols[0] + 1
if abs(width - 851) > 8:
    sys.exit(f"title line is {width}px wide, expected ~851 — webfont probably "
             "did not load (no network?); card NOT written correctly")
print(f"ok: 1200x630, title {width}px")
PY

# --- point the page at this version ------------------------------------------
sed -i '' -E "s|assets/og-image(-v[0-9]+)?\.png|assets/og-image-v${version}.png|g" "$root/index.html"

echo "wrote assets/og-image-v${version}.png and pointed index.html at it"
echo "reminder: og:image must stay an absolute URL for scrapers"
