# restore-test.ps1 — Verify a SQLite backup is restorable
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath
)

$ErrorActionPreference = 'Stop'

# Resolve sqlite3 (winget install path or PATH)
$sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $sqlite3) {
    $sqlite3 = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*sqlite*" -Recurse -Filter "sqlite3.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $sqlite3) {
    Write-Host "ERROR: sqlite3 not found. Install with: winget install SQLite.SQLite" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $BackupPath)) {
    Write-Host "ERROR: Backup file not found: $BackupPath" -ForegroundColor Red
    exit 1
}

$testDir = Join-Path $env:TEMP "nfl-lab-restore-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

try {
    Copy-Item $BackupPath (Join-Path $testDir "pipeline.db")

    # Run integrity check
    $integrity = & $sqlite3 (Join-Path $testDir "pipeline.db") "PRAGMA integrity_check;"
    Write-Host "Integrity check: $integrity"

    # Count articles as a smoke test
    $count = & $sqlite3 (Join-Path $testDir "pipeline.db") "SELECT count(*) FROM articles;"
    Write-Host "Article count: $count"

    if ($integrity -eq "ok") {
        Write-Host "PASS: Backup is restorable" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Integrity check failed" -ForegroundColor Red
        exit 1
    }
} finally {
    Remove-Item -Recurse -Force $testDir -ErrorAction SilentlyContinue
}
