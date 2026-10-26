#!/bin/sh
set -e

# Support DATABASE_URL from Render/Neon if DB_URL is not set
if [ -n "$DATABASE_URL" ] && [ -z "$DB_URL" ]; then
  DB_URL="$DATABASE_URL"
fi

if [ -n "$DB_URL" ] && [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="$DB_URL"
fi

export DB_URL
export DATABASE_URL
export PORT="${PORT:-8080}"

echo "=================================================="
echo "TEPO Full-Stack Application (Spring Boot + React)"
echo "Starting on port ${PORT}..."
if [ -n "$DB_URL" ]; then
  echo "Database URL configured (Cloud database detected)."
else
  echo "WARNING: Neither DB_URL nor DATABASE_URL is set!"
  echo "Falling back to default (localhost:5432/tepo)."
  echo "If deploying on Render, configure DB_URL or DATABASE_URL in Environment tab."
fi
echo "=================================================="

exec java -Dserver.port="${PORT}" -jar app.jar
