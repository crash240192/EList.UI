#!/bin/sh
# docker-entrypoint.sh

set -e

BACKEND_URL="${BACKEND_URL:-http://92.118.113.6:35028}"
FILE_STORAGE_URL="${FILE_STORAGE_URL:-http://92.118.113.6:35029}"

echo ">>> Starting EList UI"
echo "    BACKEND_URL      = $BACKEND_URL"
echo "    FILE_STORAGE_URL = $FILE_STORAGE_URL"

envsubst '${BACKEND_URL} ${FILE_STORAGE_URL}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo ">>> nginx config ready, starting nginx..."
exec nginx -g "daemon off;"
