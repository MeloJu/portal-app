#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
    Write-Host '==> .env nao existe; criando a partir de .env.example'
    Copy-Item .env.example .env
}

$lines = @(Get-Content .env)
$secretLine = $lines | Where-Object { $_ -match '^JWT_SECRET=' } | Select-Object -Last 1
$currentSecret = if ($secretLine) { ($secretLine -replace '^JWT_SECRET=', '').Trim() } else { '' }

if (-not $currentSecret) {
    Write-Host '==> JWT_SECRET vazio; gerando um'
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    if ($secretLine) {
        $lines = $lines | ForEach-Object { if ($_ -match '^JWT_SECRET=') { "JWT_SECRET=$secret" } else { $_ } }
    }
    else {
        $lines += "JWT_SECRET=$secret"
    }
    Set-Content .env $lines
}

foreach ($line in Get-Content .env) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim())
}

Write-Host '==> subindo o Postgres e esperando ficar saudavel'
docker compose up -d --wait db
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> API em http://localhost:8080 (actuator em :8081)'
Set-Location backend
& .\mvnw.cmd spring-boot:run @args
exit $LASTEXITCODE
