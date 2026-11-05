#!/bin/sh
# docker-entrypoint.sh

set -e

export BACKEND_URL="${BACKEND_URL:-http://92.118.113.6:35028}"
export FILE_STORAGE_URL="${FILE_STORAGE_URL:-http://92.118.113.6:35029}"
export MAPTILER_KEY="${MAPTILER_KEY:-}"
export MAPTILER_STYLE="${MAPTILER_STYLE:-streets-v2}"

echo ">>> Starting EList UI"
echo "    BACKEND_URL      = $BACKEND_URL"
echo "    FILE_STORAGE_URL = $FILE_STORAGE_URL"
if [ -n "$MAPTILER_KEY" ]; then
  echo "    MAPTILER_STYLE   = $MAPTILER_STYLE"
  echo "    MAPTILER_KEY     = (set)"
else
  echo "    MAPTILER_KEY     = (empty — OSM fallback)"
fi

envsubst '${BACKEND_URL} ${FILE_STORAGE_URL}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# JSON-escape для строки в JS (ключи MapTiler обычно alphanumeric)
js_str() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/'"'"'/\\'\''/g'
}

KEY_JS=$(js_str "$MAPTILER_KEY")
STYLE_JS=$(js_str "$MAPTILER_STYLE")

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__ELIST_RUNTIME__={mapTilerKey:"${KEY_JS}",mapTilerStyle:"${STYLE_JS}"};
EOF

echo ">>> nginx config ready, starting nginx..."
exec nginx -g "daemon off;"
