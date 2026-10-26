#!/usr/bin/env bash
# Esegue i test backend in un container Maven/Temurin 21.
# Funziona su qualsiasi OS con Docker.
#
# Uso:
#   ./scripts/test-backend.sh                                    # tutti i test
#   ./scripts/test-backend.sh RuleBasedAiAssistantTest           # singola classe

set -euo pipefail

TEST_CLASS="${1:-}"
MVN_ARGS="clean test"
if [ -n "$TEST_CLASS" ]; then
    MVN_ARGS="$MVN_ARGS -Dtest=$TEST_CLASS"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "Esecuzione test backend in container maven:3.9-eclipse-temurin-21..."
echo "Comando: mvn -B $MVN_ARGS"
echo

docker run --rm \
    -v "$ROOT:/workspace" \
    -w /workspace/backend \
    maven:3.9-eclipse-temurin-21 \
    mvn -B $MVN_ARGS