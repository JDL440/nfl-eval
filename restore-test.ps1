# restore-test.ps1 — Verify a SQLite backup is restorable
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BackupPath)) {
    Write-Host "ERROR: Backup file not found: $BackupPath" -ForegroundColor Red
    exit 1
}

$testDir = Join-Path $env:TEMP "nfl-lab-restore-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $testDir -Force | Out-Null

try {
    Copy-Item $BackupPath (Join-Path $testDir "pipeline.db")

    # Run integrity check
    $integrity = sqlite3 (Join-Path $testDir "pipeline.db") "PRAGMA integrity_check;"
    Write-Host "Integrity check: $integrity"

    # Count articles as a smoke test
    $count = sqlite3 (Join-Path $testDir "pipeline.db") "SELECT count(*) FROM articles;"
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
