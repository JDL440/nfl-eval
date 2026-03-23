param(
    [int]$Port,
    [switch]$CommandOnly
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJson = Join-Path $repoRoot 'package.json'

if (-not (Test-Path $packageJson)) {
    Write-Host "ERROR: package.json not found at $packageJson" -ForegroundColor Red
    exit 1
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
    $npm = Get-Command npm -ErrorAction Stop
}

$npmArgs = @('run', 'v2:serve')
if ($PSBoundParameters.ContainsKey('Port')) {
    $npmArgs += '--'
    $npmArgs += '--port'
    $npmArgs += $Port.ToString()
}

$displayPort = if ($PSBoundParameters.ContainsKey('Port')) { $Port } else { 3456 }

Write-Host "🏈 NFL Lab v2 dashboard" -ForegroundColor Cyan
Write-Host "   Repo: $repoRoot" -ForegroundColor Gray
Write-Host "   Command: npm $($npmArgs -join ' ')" -ForegroundColor Gray
Write-Host "   URL: http://localhost:$displayPort" -ForegroundColor Gray

if ($CommandOnly) {
    return
}

Push-Location $repoRoot
try {
    & $npm.Source @npmArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
