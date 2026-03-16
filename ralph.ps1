[CmdletBinding()]
param(
    [int]$MaxIterations = 10,
    [int]$TimeoutSeconds = 900,
    [string]$TargetRepo = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Resolve target repo: explicit param > sibling checkout > error
if (-not $TargetRepo) {
    $siblingPath = Join-Path (Split-Path -Parent $scriptRoot) "nfl-eval"
    if (Test-Path $siblingPath) {
        $TargetRepo = $siblingPath
    } else {
        Write-Host "Error: No -TargetRepo specified and no sibling nfl-eval checkout found." -ForegroundColor Red
        Write-Host "Usage: ./ralph.ps1 -TargetRepo C:\path\to\nfl-eval" -ForegroundColor Yellow
        exit 1
    }
}

if (-not (Test-Path $TargetRepo)) {
    Write-Host "Error: Target repo not found: $TargetRepo" -ForegroundColor Red
    exit 1
}

# Work inside the target repo so Copilot CLI sees its .copilot/ config and content/
Set-Location $TargetRepo

$Model = "claude-sonnet-4.5"
$Agent = "squad"
# $Model = "gpt-5.1-codex-mini"  # fallback if rate-limited

$ProgressFile = Join-Path $scriptRoot "ralph\state\progress.txt"
$PrdFile = Join-Path $scriptRoot "ralph\prd.json"
$PromptFile = Join-Path $scriptRoot "ralph\prompt.md"

function Write-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║     Ralph Wiggum Method - NFL Article Pipeline Loop            ║" -ForegroundColor Blue
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
}

function Ensure-RequiredFiles {
    param(
        [string]$PrdFile,
        [string]$PromptFile
    )

    if (-not (Test-Path $PrdFile)) {
        Write-Host "Error: PRD file not found: $PrdFile" -ForegroundColor Red
        exit 1
    }

    if (-not (Test-Path $PromptFile)) {
        Write-Host "Error: Prompt file not found: $PromptFile" -ForegroundColor Red
        exit 1
    }
}

function Initialize-ProgressFile {
    param([string]$ProgressFile)

    $progressDir = Split-Path -Parent $ProgressFile
    if (-not (Test-Path $progressDir)) {
        New-Item -Path $progressDir -ItemType Directory | Out-Null
    }

    if (-not (Test-Path $ProgressFile)) {
        @(
            "iteration: 0",
            "status: not_started",
            "current_item: none",
            "completed_items: []",
            "last_stage: none",
            "follow_on_issue: none",
            "follow_on_target_date: none"
        ) | Set-Content -Path $ProgressFile -Encoding UTF8
    }
}

function Set-ProgressValues {
    param(
        [string]$ProgressFile,
        [hashtable]$Values
    )

    $content = if (Test-Path $ProgressFile) { Get-Content -Path $ProgressFile } else { @() }

    foreach ($key in $Values.Keys) {
        $pattern = '^{0}:' -f [regex]::Escape($key)
        $updated = $false
        $content = $content | ForEach-Object {
            if ($_ -match $pattern) {
                $updated = $true
                "{0}: {1}" -f $key, $Values[$key]
            } else {
                $_
            }
        }

        if (-not $updated) {
            $content += "{0}: {1}" -f $key, $Values[$key]
        }
    }

    $content | Set-Content -Path $ProgressFile -Encoding UTF8
}

function Get-ProgressValue {
    param(
        [string]$ProgressFile,
        [string]$Key
    )

    if (-not (Test-Path $ProgressFile)) {
        return $null
    }

    $line = Select-String -Path $ProgressFile -Pattern ("^{0}:" -f [regex]::Escape($Key)) | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    return ($line.Line -replace ("^{0}:\s*" -f [regex]::Escape($Key)), '').Trim()
}

function Reset-IterationMetadata {
    param([string]$ProgressFile)

    Set-ProgressValues -ProgressFile $ProgressFile -Values @{
        last_stage = "none"
        follow_on_issue = "none"
        follow_on_target_date = "none"
    }
}

function Get-WeekThursday {
    param([datetime]$ReferenceDate)

    $offsetFromMonday = (([int]$ReferenceDate.DayOfWeek + 6) % 7)
    $weekStart = $ReferenceDate.Date.AddDays(-$offsetFromMonday)
    return $weekStart.AddDays(3)
}

function Test-FollowOnIssueEnforcement {
    param(
        [string]$ProgressFile,
        [datetime]$ReferenceDate
    )

    $lastStage = Get-ProgressValue -ProgressFile $ProgressFile -Key "last_stage"
    if (-not $lastStage -or $lastStage -eq "none") {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: progress file did not record last_stage." -ForegroundColor Red
        return $false
    }

    if ($lastStage -ne "stage:published") {
        return $true
    }

    $followOnIssue = Get-ProgressValue -ProgressFile $ProgressFile -Key "follow_on_issue"
    $followOnTargetDate = Get-ProgressValue -ProgressFile $ProgressFile -Key "follow_on_target_date"

    if (-not $followOnIssue -or $followOnIssue -eq "none" -or -not $followOnTargetDate -or $followOnTargetDate -eq "none") {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: stage:published requires follow_on_issue and follow_on_target_date." -ForegroundColor Red
        return $false
    }

    $issueNumber = ($followOnIssue -replace '[^0-9]', '')
    if (-not $issueNumber) {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: follow_on_issue '$followOnIssue' is not a valid issue number." -ForegroundColor Red
        return $false
    }

    $targetDate = $null
    if (-not [datetime]::TryParse($followOnTargetDate, [ref]$targetDate)) {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: follow_on_target_date '$followOnTargetDate' is not a valid date." -ForegroundColor Red
        return $false
    }

    $expectedThursday = Get-WeekThursday -ReferenceDate $ReferenceDate
    if ($targetDate.Date -ne $expectedThursday.Date) {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: follow_on_target_date must equal Thursday of this week ($($expectedThursday.ToString('yyyy-MM-dd')))." -ForegroundColor Red
        return $false
    }

    try {
        $issue = gh issue view $issueNumber --repo JDL440/nfl-eval --json title,body | ConvertFrom-Json
    }
    catch {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: could not read follow-on issue #$issueNumber from GitHub." -ForegroundColor Red
        return $false
    }

    if (-not $issue.body -or $issue.body -notmatch 'IDEA GENERATION REQUIRED') {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: follow-on issue #$issueNumber is missing the idea-generation marker." -ForegroundColor Red
        return $false
    }

    if ($issue.body -notmatch '## Target Publish Date' -or $issue.body -notmatch [regex]::Escape($expectedThursday.ToString('yyyy-MM-dd'))) {
        Write-Host ""
        Write-Host "  ⚠ Enforcement failure: follow-on issue #$issueNumber does not record the required Thursday target date ($($expectedThursday.ToString('yyyy-MM-dd')))." -ForegroundColor Red
        return $false
    }

    Write-Host "  ✓ Follow-on issue enforcement satisfied (#$issueNumber → $($expectedThursday.ToString('yyyy-MM-dd')))" -ForegroundColor Green
    return $true
}

function Get-Iteration {
    param([string]$ProgressFile)

    $line = Select-String -Path $ProgressFile -Pattern '^iteration:' | Select-Object -First 1
    if (-not $line) {
        return 0
    }

    return [int]($line.Line -replace 'iteration:\s*', '')
}

function Check-Completion {
    param([string]$ProgressFile)

    $line = Select-String -Path $ProgressFile -Pattern '^status:' | Select-Object -First 1
    if (-not $line) {
        return $false
    }

    $status = ($line.Line -replace 'status:\s*', '').Trim()
    return $status -eq 'complete'
}

function Update-Iteration {
    param(
        [string]$ProgressFile,
        [int]$Iteration
    )

    $content = Get-Content -Path $ProgressFile
    $content = $content | ForEach-Object {
        if ($_ -match '^iteration:') { "iteration: $Iteration" } else { $_ }
    }

    $content | Set-Content -Path $ProgressFile -Encoding UTF8
}

function Show-Spinner {
    param(
        [scriptblock]$Action,
        [string]$Message = "Processing"
    )

    $spinChars = @('⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏')
    $spinIndex = 0
    $job = Start-Job -ScriptBlock $Action
    
    Write-Host ""
    $cursorTop = [Console]::CursorTop
    $startTime = Get-Date
    
    try {
        while ($job.State -eq 'Running') {
            $elapsed = (Get-Date) - $startTime
            [Console]::SetCursorPosition(0, $cursorTop)
            $spin = $spinChars[$spinIndex % $spinChars.Length]
            $durationText = "($($elapsed.TotalSeconds.ToString('F1'))s)"
            Write-Host "  $spin $Message... $durationText" -NoNewline -ForegroundColor Cyan
            $spinIndex++
            Start-Sleep -Milliseconds 100
        }
        
        $finalElapsed = (Get-Date) - $startTime
        [Console]::SetCursorPosition(0, $cursorTop)
        Write-Host "  ✓ $Message - Complete ($($finalElapsed.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green
        Write-Host ""
        
        $result = Receive-Job -Job $job -Wait
        return $result
    }
    finally {
        Remove-Job -Job $job -Force
    }
}

function Run-Iteration {
    param(
        [int]$Iteration,
        [int]$MaxIterations,
        [string]$ProgressFile,
        [string]$PromptFile,
        [int]$TimeoutSeconds
    )

    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "Starting iteration $Iteration of $MaxIterations" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

    Update-Iteration -ProgressFile $ProgressFile -Iteration $Iteration
    Reset-IterationMetadata -ProgressFile $ProgressFile

    $prompt = Get-Content -Path $PromptFile -Raw
    
    Write-Host "  Agent: $Agent" -ForegroundColor Cyan
    Write-Host "  Model: $Model" -ForegroundColor Cyan
    Write-Host "  Prompt length: $($prompt.Length) characters" -ForegroundColor Cyan
    Write-Host "  Mode: --yolo --agent $Agent (autonomous)" -ForegroundColor Cyan
    Write-Host "  Timeout: $TimeoutSeconds seconds" -ForegroundColor Cyan
    Write-Host ""

    $startTime = Get-Date
    
    try {
        # Start process with output capture
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = "copilot"
        # Use ArgumentList to properly handle arguments with spaces
        $processInfo.ArgumentList.Add("--yolo")
        $processInfo.ArgumentList.Add("--agent")
        $processInfo.ArgumentList.Add($Agent)
        $processInfo.ArgumentList.Add("--model")
        $processInfo.ArgumentList.Add($Model)
        $processInfo.ArgumentList.Add("--prompt")
        $processInfo.ArgumentList.Add($prompt)
        $processInfo.UseShellExecute = $false
        $processInfo.CreateNoWindow = $true
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        
        # String builders for output capture
        $stdoutBuilder = New-Object System.Text.StringBuilder
        $stderrBuilder = New-Object System.Text.StringBuilder
        
        # Event handlers for async output reading
        $stdoutEvent = Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action {
            if ($EventArgs.Data) {
                $null = $Event.MessageData.AppendLine($EventArgs.Data)
            }
        } -MessageData $stdoutBuilder
        
        $stderrEvent = Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action {
            if ($EventArgs.Data) {
                $null = $Event.MessageData.AppendLine($EventArgs.Data)
            }
        } -MessageData $stderrBuilder
        
        Write-Host "  ⠋ Running GitHub Copilot CLI..." -ForegroundColor Cyan
        $cursorTop = [Console]::CursorTop - 1
        
        $null = $process.Start()
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        $spinChars = @('⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏')
        $spinIndex = 0
        
        # Monitor process with timeout
        while (-not $process.HasExited) {
            $elapsed = (Get-Date) - $startTime
            
            if ($elapsed.TotalSeconds -gt $TimeoutSeconds) {
                Write-Host ""
                Write-Host "  ⚠ Timeout after $TimeoutSeconds seconds - killing process" -ForegroundColor Red
                $process.Kill($true)
                $process.WaitForExit(5000)
                return $false
            }
            
            [Console]::SetCursorPosition(0, $cursorTop)
            $spin = $spinChars[$spinIndex % $spinChars.Length]
            $durationText = "($($elapsed.TotalSeconds.ToString('F1'))s)"
            Write-Host "  $spin Running GitHub Copilot CLI... $durationText" -NoNewline -ForegroundColor Cyan
            $spinIndex++
            
            Start-Sleep -Milliseconds 100
        }
        
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        # Wait for output to be fully captured
        Start-Sleep -Milliseconds 200
        
        [Console]::SetCursorPosition(0, $cursorTop)
        Write-Host "  ✓ Running GitHub Copilot CLI - Complete ($($duration.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green
        Write-Host ""
        
        # Unregister events
        Unregister-Event -SourceIdentifier $stdoutEvent.Name -ErrorAction SilentlyContinue
        Unregister-Event -SourceIdentifier $stderrEvent.Name -ErrorAction SilentlyContinue
        
        # Get captured output
        $stdout = $stdoutBuilder.ToString()
        $stderr = $stderrBuilder.ToString()
        
        # Display results
        Write-Host "  Duration: $($duration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Magenta
        Write-Host "  Exit Code: $($process.ExitCode)" -ForegroundColor $(if ($process.ExitCode -eq 0) { 'Green' } else { 'Red' })
        
        if ($stdout -and $stdout.Trim()) {
            Write-Host ""
            Write-Host "  Output:" -ForegroundColor White
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
            $stdout.Split("`n") | ForEach-Object {
                if ($_.Trim()) {
                    Write-Host "  $_" -ForegroundColor Gray
                }
            }
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
        }
        
        if ($stderr -and $stderr.Trim()) {
            Write-Host ""
            # Show as Info when successful, as Errors when failed
            if ($process.ExitCode -eq 0) {
                Write-Host "  Status/Info:" -ForegroundColor Cyan
                Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
                $stderr.Split("`n") | ForEach-Object {
                    Write-Host "  $_" -ForegroundColor DarkGray
                }
            } else {
                Write-Host "  Errors/Warnings (Complete Details):" -ForegroundColor Yellow
                Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
                $stderr.Split("`n") | ForEach-Object {
                    Write-Host "  $_" -ForegroundColor Red
                }
            }
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
        }
        
        if ($process.ExitCode -ne 0) {
            Write-Host ""
            Write-Host "  ⚠ Copilot CLI exited with error code $($process.ExitCode)" -ForegroundColor Red
            return $false
        }

        if (-not (Test-FollowOnIssueEnforcement -ProgressFile $ProgressFile -ReferenceDate $endTime)) {
            return $false
        }
        
        Write-Host ""
        return $true
    }
    catch {
        Write-Host ""
        Write-Host "  ✗ Error running Copilot CLI" -ForegroundColor Red
        Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
        Write-Host "  Exception: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.InnerException) {
            Write-Host "  Inner Exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
        }
        Write-Host "  Stack Trace:" -ForegroundColor Red
        Write-Host "$($_.ScriptStackTrace)" -ForegroundColor DarkRed
        Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
        
        # Try to get any captured output before the error
        if ($stdoutBuilder -and $stdoutBuilder.Length -gt 0) {
            Write-Host "  Captured Output before error:" -ForegroundColor Yellow
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
            $stdoutBuilder.ToString().Split("`n") | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Gray
            }
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
        }
        
        if ($stderrBuilder -and $stderrBuilder.Length -gt 0) {
            Write-Host "  Captured Errors before exception:" -ForegroundColor Yellow
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
            $stderrBuilder.ToString().Split("`n") | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Red
            }
            Write-Host "  " + ("-" * 60) -ForegroundColor DarkGray
        }
        
        if ($process -and -not $process.HasExited) {
            $process.Kill($true)
        }
        return $false
    }
    finally {
        # Cleanup events
        if ($stdoutEvent) {
            Unregister-Event -SourceIdentifier $stdoutEvent.Name -ErrorAction SilentlyContinue
        }
        if ($stderrEvent) {
            Unregister-Event -SourceIdentifier $stderrEvent.Name -ErrorAction SilentlyContinue
        }
        if ($process) {
            $process.Dispose()
        }
    }
}

$null = Register-EngineEvent -SourceIdentifier ConsoleCancelEvent -Action {
    Write-Host "`nInterrupted. Progress saved in $ProgressFile" -ForegroundColor Yellow
    exit 130
}

Write-Banner
Write-Host "  Target repo : $TargetRepo" -ForegroundColor Cyan
Write-Host "  Agent       : $Agent" -ForegroundColor Cyan
Write-Host "  Model       : $Model" -ForegroundColor Cyan
Write-Host ""
Ensure-RequiredFiles -PrdFile $PrdFile -PromptFile $PromptFile
Initialize-ProgressFile -ProgressFile $ProgressFile

$iteration = (Get-Iteration -ProgressFile $ProgressFile) + 1

while ($iteration -le $MaxIterations) {
    if (Check-Completion -ProgressFile $ProgressFile) {
        Write-Host "" -ForegroundColor Green
        Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║            All backlog items complete! Great success!          ║" -ForegroundColor Green
        Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
        Write-Host "" -ForegroundColor Green
        exit 0
    }

    if (-not (Run-Iteration -Iteration $iteration -MaxIterations $MaxIterations -ProgressFile $ProgressFile -PromptFile $PromptFile -TimeoutSeconds $TimeoutSeconds)) {
        Write-Host "Iteration $iteration failed. Check logs and retry." -ForegroundColor Red
        exit 1
    }

    $iteration++
    Start-Sleep -Seconds 2
}

Write-Host "" -ForegroundColor Yellow
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║     Max iterations reached. Review progress and continue.    ║" -ForegroundColor Yellow
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Yellow
