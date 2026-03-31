# prod.ps1 — Start the production dashboard (manual use; NSSM service is preferred)
param([switch]$NoBuild)

$ErrorActionPreference = 'Stop'

# Production environment isolation
if (-not $env:NFL_DATA_DIR) {
    $env:NFL_DATA_DIR = "$env:USERPROFILE\.nfl-lab-prod"
}
$env:NODE_ENV = 'production'

# Safety: verify auth is configured in the per-env .env
$envFile = Join-Path $env:NFL_DATA_DIR "config\.env"
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    if ($content -match 'DASHBOARD_AUTH_MODE=off') {
        Write-Host "FATAL: Production .env has DASHBOARD_AUTH_MODE=off. Fix before starting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "WARNING: No .env found at $envFile — server will use defaults." -ForegroundColor Yellow
}

Write-Host "Starting NFL Lab PRODUCTION server..." -ForegroundColor Green
Write-Host "  Data dir : $env:NFL_DATA_DIR"
Write-Host "  NODE_ENV : $env:NODE_ENV"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $NoBuild) {
    Write-Host "Building..." -ForegroundColor Cyan
    Push-Location $repoRoot
    npm run v2:build
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "Build failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Pop-Location
}

# Run from compiled output (stable, no tsx overhead)
Push-Location $repoRoot
npm run v2:start
Pop-Location
