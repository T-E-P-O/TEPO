#!/usr/bin/env pwsh
# Esegue i test backend in un container Maven/Temurin 21.
# Funziona su qualsiasi OS con Docker e non richiede Java/Maven nativi.

param(
    [string]$Test = ""
)

# I warning su stderr (es. JVM) non devono interrompere lo script.
$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Esecuzione test backend in container maven:3.9-eclipse-temurin-21..."

if ($Test) {
    Write-Host "Comando: mvn -B clean test -Dtest=$Test"
    & docker run --rm `
        -v "${root}:/workspace" `
        -w /workspace/backend `
        maven:3.9-eclipse-temurin-21 `
        mvn -B clean test "-Dtest=$Test"
} else {
    Write-Host "Comando: mvn -B clean test"
    & docker run --rm `
        -v "${root}:/workspace" `
        -w /workspace/backend `
        maven:3.9-eclipse-temurin-21 `
        mvn -B clean test
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
