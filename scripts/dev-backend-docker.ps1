#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
    Write-Host '==> .env nao existe; criando a partir de .env.example'
    Copy-Item .env.example .env
}

function Initialize-Secret([string]$Name) {
    $lines = @(Get-Content .env)
    $secretLine = $lines | Where-Object { $_ -match "^$Name=" } | Select-Object -Last 1
    $currentSecret = if ($secretLine) { ($secretLine -replace "^$Name=", '').Trim() } else { '' }

    if (-not $currentSecret) {
        Write-Host "==> $Name vazio; gerando um"
        $bytes = [byte[]]::new(32)
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
        $secret = [Convert]::ToBase64String($bytes)
        if ($secretLine) {
            $lines = $lines | ForEach-Object { if ($_ -match "^$Name=") { "$Name=$secret" } else { $_ } }
        }
        else {
            $lines += "$Name=$secret"
        }
        Set-Content .env $lines
    }
}

Initialize-Secret 'JWT_SECRET'
Initialize-Secret 'APP_CODE_PEPPER'

foreach ($line in Get-Content .env) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim())
}

Write-Host '==> subindo o Postgres e esperando ficar saudavel'
docker compose up -d --wait db
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> buildando a imagem do backend'
Set-Location backend
docker build -t l2-api:dev .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> API em http://localhost:8080 (actuator em :8081)'
& docker run --rm `
	-p 8080:8080 -p 8081:8081 `
	--network host `
	-e "DB_URL=jdbc:postgresql://localhost:5432/lumi" `
	-e "DB_USER=$env:DB_USER" `
	-e "DB_PASSWORD=$env:DB_PASSWORD" `
	-e "PUBLIC_BASE_URL=$env:PUBLIC_BASE_URL" `
	-e "JWT_SECRET=$env:JWT_SECRET" `
	-e "APP_CODE_PEPPER=$env:APP_CODE_PEPPER" `
	l2-api:dev
exit $LASTEXITCODE
