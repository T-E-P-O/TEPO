#!/bin/sh
set -e

# Support DATABASE_URL from Render/Neon if DB_URL is not set
RAW_URL="${DATABASE_URL:-$DB_URL}"

if [ -n "$RAW_URL" ]; then
  # Strip jdbc: prefix if present
  clean_url="${RAW_URL#jdbc:}"
  # Strip postgres:// or postgresql:// prefix
  proto_stripped="${clean_url#*://}"

  # Check if credentials exist: user:password@host...
  case "$proto_stripped" in
    *@*)
      userpass="${proto_stripped%%@*}"
      hostpart="${proto_stripped#*@}"
      parsed_user="${userpass%%:*}"
      parsed_pass="${userpass#*:}"
      jdbc_url="jdbc:postgresql://${hostpart}"
      ;;
    *)
      jdbc_url="jdbc:postgresql://${proto_stripped}"
      ;;
  esac

  # Use parsed credentials if not explicitly supplied by environment
  if [ -z "$DB_USERNAME" ] && [ -n "$parsed_user" ]; then
    DB_USERNAME="$parsed_user"
  fi

  if [ -z "$DB_PASSWORD" ] && [ -n "$parsed_pass" ]; then
    DB_PASSWORD="$parsed_pass"
  fi

  DB_URL="$jdbc_url"
  DATABASE_URL="$jdbc_url"
fi

export DB_URL
export DATABASE_URL
export DB_USERNAME
export DB_PASSWORD
export PORT="${PORT:-8080}"

echo "=================================================="
echo "TEPO Full-Stack Application (Spring Boot + React)"
echo "Starting on port ${PORT}..."
if [ -n "$DB_URL" ]; then
  echo "Database URL configured: ${DB_URL}"
  if [ -n "$DB_USERNAME" ]; then
    echo "Database User: ${DB_USERNAME}"
  fi
else
  echo "WARNING: Neither DB_URL nor DATABASE_URL is set!"
  echo "Falling back to default (localhost:5432/tepo)."
  echo "If deploying on Render, configure DB_URL or DATABASE_URL in Environment tab."
fi
echo "=================================================="

set -- -Dserver.port="${PORT}"

if [ -n "$DB_URL" ]; then
  set -- "$@" -Dspring.datasource.url="${DB_URL}"
fi
if [ -n "$DB_USERNAME" ]; then
  set -- "$@" -Dspring.datasource.username="${DB_USERNAME}"
fi
if [ -n "$DB_PASSWORD" ]; then
  set -- "$@" -Dspring.datasource.password="${DB_PASSWORD}"
fi

exec java "$@" -jar app.jar
