#!/bin/sh
set -e

# Default to https://tepobozza.onrender.com if BACKEND_URL is not set
BACKEND_URL="${BACKEND_URL:-https://tepobozza.onrender.com}"
BACKEND_URL=$(echo "$BACKEND_URL" | sed -E 's|/+$||')

# Extract hostname for Host header (e.g. tepobozza.onrender.com or backend:8080)
BACKEND_HOST=$(echo "$BACKEND_URL" | sed -E 's|^https?://||' | sed -E 's|/.*$||')

echo "Configuring Nginx upstream: BACKEND_URL=${BACKEND_URL}, BACKEND_HOST=${BACKEND_HOST}..."

# Replace placeholders in default.conf
sed -i "s|__BACKEND_URL__|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf
sed -i "s|__BACKEND_HOST__|${BACKEND_HOST}|g" /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
