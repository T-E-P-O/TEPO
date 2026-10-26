#!/bin/sh
set -e

# Support DATABASE_URL from Render/Neon if DB_URL is not set
if [ -n "$DATABASE_URL" ] && [ -z "$DB_URL" ]; then
  DB_URL="$DATABASE_URL"
fi

# Ensure DB_URL starts with jdbc: for PostgreSQL driver
if [ -n "$DB_URL" ]; then
  case "$DB_URL" in
    jdbc:*) ;;
    *) DB_URL="jdbc:$DB_URL" ;;
  esac
  export DB_URL
fi

export PORT="${PORT:-8080}"
echo "=================================================="
echo "TEPO Full-Stack Application (Spring Boot + React)"
echo "Starting on port ${PORT}..."
echo "=================================================="

exec java -Dserver.port="${PORT}" -jar app.jar
