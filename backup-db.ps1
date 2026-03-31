# backup-db.ps1 — Daily SQLite backup for production
param(
    [string]$DataDir = "$env:USERPROFILE\.nfl-lab-prod",
    [int]$RetainDays = 30
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

$dbPath = Join-Path $DataDir "pipeline.db"
$backupDir = Join-Path $DataDir "backups"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupPath = Join-Path $backupDir "pipeline_$timestamp.db"

if (-not (Test-Path $dbPath)) {
    Write-Host "ERROR: Database not found at $dbPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# Use SQLite's backup API (safe for WAL mode — includes WAL/SHM state)
& $sqlite3 $dbPath ".backup '$backupPath'"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backup failed" -ForegroundColor Red
    exit 1
}

# Verify the backup
$check = & $sqlite3 $backupPath "PRAGMA integrity_check;"
if ($check -ne "ok") {
    Write-Host "WARNING: Backup integrity check returned: $check" -ForegroundColor Yellow
}

# Prune old backups
$pruned = 0
Get-ChildItem $backupDir -Filter "pipeline_*.db" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetainDays) } |
    ForEach-Object { Remove-Item $_.FullName -Force; $pruned++ }

$size = [math]::Round((Get-Item $backupPath).Length / 1MB, 2)
Write-Host "Backup created: $backupPath ($size MB)"
if ($pruned -gt 0) {
    Write-Host "Pruned $pruned backups older than $RetainDays days"
}
