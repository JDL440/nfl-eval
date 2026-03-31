# Ralph Watch — Autonomous Squad Agent Monitor for NFL Lab
# Launches a fresh Copilot Squad session each round to process actionable issues.
# Interval: 5 minutes | To stop: Ctrl+C
#
# Features:
# - Single-instance guard (mutex + lockfile)
# - git pull before each round (fresh context)
# - Structured logging to ~/.squad/ralph-watch.log
# - Heartbeat file at ~/.squad/ralph-heartbeat.json
# - Log rotation: 500 entries / 1MB
# - Consecutive failure alerting

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# --- Single-instance guard (mutex + lockfile) ---
$mutexName = "Global\RalphWatch_nfl-eval"
$mutex = [System.Threading.Mutex]::new($false, $mutexName)
$lockFile = Join-Path (Get-Location) ".ralph-watch.lock"

if (-not $mutex.WaitOne(0)) {
    Write-Host "ERROR: Ralph watch is already running (mutex held)" -ForegroundColor Red
    exit 1
}

if (Test-Path $lockFile) {
    $lockContent = Get-Content $lockFile -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($lockContent -and $lockContent.pid) {
        $existing = Get-Process -Id $lockContent.pid -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "ERROR: Ralph watch is already running in this directory (PID $($lockContent.pid), started $($lockContent.started))" -ForegroundColor Red
            Write-Host "Kill it first: Stop-Process -Id $($lockContent.pid) -Force" -ForegroundColor Yellow
            $mutex.ReleaseMutex()
            exit 1
        }
    }
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}

# Write lockfile
[ordered]@{ pid = $PID; started = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'); directory = (Get-Location).Path } |
    ConvertTo-Json | Out-File $lockFile -Encoding utf8 -Force

# Cleanup on exit
Register-EngineEvent PowerShell.Exiting -Action {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    $mutex.ReleaseMutex()
} | Out-Null
trap {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    $mutex.ReleaseMutex()
    break
}

# --- Configuration ---
$intervalMinutes = 5
$round = 0
$consecutiveFailures = 0
$maxLogEntries = 500
$maxLogBytes = 1048576  # 1MB

# Ralph runs in a separate worktree to avoid disrupting main checkout
$ralphDir = "C:\github\nfl-eval-ralph"
if (-not (Test-Path $ralphDir)) {
    Write-Host "ERROR: Ralph worktree not found at $ralphDir" -ForegroundColor Red
    Write-Host "Create it with: git worktree add $ralphDir v2" -ForegroundColor Yellow
    exit 1
}
Set-Location $ralphDir

# Ralph uses the dev data directory, never prod
$env:NFL_DATA_DIR = "$env:USERPROFILE\.nfl-lab-dev"
$env:NODE_ENV = "development"

$prompt = @'
Ralph, Go!

MAXIMIZE PARALLELISM: For every round, identify ALL actionable issues in JDL440/nfl-eval and spawn agents for ALL of them simultaneously as background tasks — do NOT work on issues one at a time. If there are 5 actionable issues, spawn 5 agents in one turn.

BOARD WORKFLOW: Read .squad/skills/github-project-board/SKILL.md BEFORE starting. Update the GitHub Project board status for every issue you touch:
- BEFORE spawning an agent → move issue to "In Progress"
- When agent completes and PR is merged → move to "Done"
- When blocked → move to "Blocked" with comment
- When needing human input → move to "Pending User" with @JDL440 tag

TLDR RULE: Always start issue comments with **TLDR:** (2-3 sentence summary). Full analysis below.

PR AUTO-MERGE: Create PRs, review them, and merge when tests pass. Exception: auth/secrets/deployment changes need human review.

DONE ARCHIVING: Check the board for items in "Done" status for more than 7 days. Close the issue if still open, add a summary comment.

PIPELINE SEPARATION: The article pipeline agents in src/config/defaults/charters/ are separate from Squad. Do NOT modify pipeline charters or pipeline code unless explicitly asked via a Squad issue.
'@

# --- Observability paths ---
$squadDir = Join-Path $env:USERPROFILE ".squad"
$logFile = Join-Path $squadDir "ralph-watch.log"
$heartbeatFile = Join-Path $squadDir "ralph-heartbeat.json"

if (-not (Test-Path $squadDir)) {
    New-Item -ItemType Directory -Path $squadDir -Force | Out-Null
}
if (-not (Test-Path $logFile)) {
    "# Ralph Watch Log - Started $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')" | Out-File -FilePath $logFile -Encoding utf8
}

# --- Helper functions ---

function Write-RalphLog {
    param(
        [int]$Round,
        [string]$Timestamp,
        [int]$ExitCode,
        [double]$DurationSeconds,
        [int]$ConsecutiveFailures,
        [string]$Status
    )

    $logEntry = "[$Timestamp] round=$Round status=$Status exitCode=$ExitCode duration=$([math]::Round($DurationSeconds, 1))s consecutiveFailures=$ConsecutiveFailures"
    Add-Content -Path $logFile -Value $logEntry -Encoding utf8

    # Rotate log if too large
    if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt $maxLogBytes)) {
        $entries = Get-Content $logFile | Select-Object -Last $maxLogEntries
        $entries | Out-File $logFile -Encoding utf8 -Force
    }
}

function Update-Heartbeat {
    param(
        [string]$Status,
        [int]$Round,
        [int]$ConsecutiveFailures
    )

    [ordered]@{
        lastRun               = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
        status                = $Status
        round                 = $Round
        consecutiveFailures   = $ConsecutiveFailures
        pid                   = $PID
        directory             = (Get-Location).Path
    } | ConvertTo-Json | Out-File $heartbeatFile -Encoding utf8 -Force
}

# --- Main loop ---

Write-Host "🤖 Ralph Watch Starting..." -ForegroundColor Cyan
Write-Host "   Repo: JDL440/nfl-eval" -ForegroundColor Gray
Write-Host "   Interval: $intervalMinutes minutes" -ForegroundColor Gray
Write-Host "   Log: $logFile" -ForegroundColor Gray
Write-Host "   Heartbeat: $heartbeatFile" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

while ($true) {
    $round++
    $startTime = Get-Date
    $timestamp = $startTime.ToString('yyyy-MM-ddTHH:mm:ss')

    Write-Host "[$timestamp] 🔄 Round $round starting..." -ForegroundColor Green

    try {
        # Pull latest code (stash/unstash to avoid conflicts)
        $hasChanges = (git status --porcelain 2>$null | Measure-Object).Count -gt 0
        if ($hasChanges) { git stash --quiet 2>$null }
        git fetch --quiet 2>$null
        git pull --quiet 2>$null
        if ($hasChanges) { git stash pop --quiet 2>$null }

        # Update heartbeat: running
        Update-Heartbeat -Status "running" -Round $round -ConsecutiveFailures $consecutiveFailures

        # Run Copilot Squad session
        copilot --agent squad -p $prompt

        $exitCode = $LASTEXITCODE
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds

        if ($exitCode -eq 0) {
            $consecutiveFailures = 0
            Write-RalphLog -Round $round -Timestamp $timestamp -ExitCode $exitCode -DurationSeconds $duration -ConsecutiveFailures $consecutiveFailures -Status "OK"
            Update-Heartbeat -Status "healthy" -Round $round -ConsecutiveFailures $consecutiveFailures
            Write-Host "[$($endTime.ToString('yyyy-MM-ddTHH:mm:ss'))] ✅ Round $round complete ($([math]::Round($duration, 1))s)" -ForegroundColor Green
        } else {
            $consecutiveFailures++
            Write-RalphLog -Round $round -Timestamp $timestamp -ExitCode $exitCode -DurationSeconds $duration -ConsecutiveFailures $consecutiveFailures -Status "FAIL"
            Update-Heartbeat -Status "unhealthy" -Round $round -ConsecutiveFailures $consecutiveFailures
            Write-Host "[$($endTime.ToString('yyyy-MM-ddTHH:mm:ss'))] ❌ Round $round failed (exit $exitCode, $([math]::Round($duration, 1))s)" -ForegroundColor Red

            if ($consecutiveFailures -ge 3) {
                Write-Host "   ⚠️  $consecutiveFailures consecutive failures — check logs" -ForegroundColor Yellow
            }
        }
    } catch {
        $consecutiveFailures++
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        Write-RalphLog -Round $round -Timestamp $timestamp -ExitCode -1 -DurationSeconds $duration -ConsecutiveFailures $consecutiveFailures -Status "ERROR"
        Update-Heartbeat -Status "error" -Round $round -ConsecutiveFailures $consecutiveFailures
        Write-Host "[$($endTime.ToString('yyyy-MM-ddTHH:mm:ss'))] ⚠️  Round $round exception: $_" -ForegroundColor Red
    }

    Write-Host "   Next round in $intervalMinutes minutes..." -ForegroundColor Gray
    Write-Host ""
    Start-Sleep -Seconds ($intervalMinutes * 60)
}
