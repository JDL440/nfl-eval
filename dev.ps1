param(
    [int]$Port,
    [switch]$Built,
    [switch]$CommandOnly,
    [switch]$WithMcp
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

$preflightArgs = $null
$serveArgs = if ($Built) {
    $preflightArgs = @('run', 'v2:build')
    @('run', 'v2:start')
} else {
    @('run', 'v2:serve')
}

if ($PSBoundParameters.ContainsKey('Port')) {
    $serveArgs += '--'
    $serveArgs += '--port'
    $serveArgs += $Port.ToString()
}

$commandParts = @()
if ($preflightArgs) {
    $commandParts += "npm $($preflightArgs -join ' ')"
}
$commandParts += "npm $($serveArgs -join ' ')"
$dashboardCommand = $commandParts -join ' && '
$displayPort = if ($PSBoundParameters.ContainsKey('Port')) { $Port } else { 3456 }
$startupMode = if ($Built) { 'built dist/cli.js (auto-build enabled)' } else { 'source tsx (no build required)' }
$mcpServers = @(
    [pscustomobject]@{
        Name = 'nfl-eval-local'
        Command = 'npm run mcp:server'
        Description = 'canonical local MCP server'
    },
    [pscustomobject]@{
        Name = 'nfl-eval-pipeline'
        Command = 'npm run v2:mcp'
        Description = 'pipeline MCP server'
    }
)

function Get-PowerShellCommandPath {
    $pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
    if ($pwsh) {
        return $pwsh.Source
    }

    $powershell = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if ($powershell) {
        return $powershell.Source
    }

    throw 'Unable to locate pwsh.exe or powershell.exe for MCP debug windows.'
}

function Start-RepoWindow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $psExe = Get-PowerShellCommandPath
    $escapedRepoRoot = $repoRoot.Replace("'", "''")
    $escapedTitle = $Title.Replace("'", "''")
    $escapedCommand = $Command.Replace("'", "''")
    $windowCommand = "Set-Location '$escapedRepoRoot'; `$Host.UI.RawUI.WindowTitle = '$escapedTitle'; Write-Host '$escapedTitle' -ForegroundColor Cyan; Write-Host 'Repo: $escapedRepoRoot' -ForegroundColor Gray; Write-Host 'Command: $escapedCommand' -ForegroundColor Gray; $Command"
    Start-Process -FilePath $psExe -WorkingDirectory $repoRoot -ArgumentList @('-NoExit', '-Command', $windowCommand) | Out-Null
}

Write-Host "NFL Lab v2 dashboard" -ForegroundColor Cyan
Write-Host "   Repo: $repoRoot" -ForegroundColor Gray
Write-Host "   Mode: $startupMode" -ForegroundColor Gray
if ($preflightArgs) {
    Write-Host "   Preflight: npm $($preflightArgs -join ' ')" -ForegroundColor Gray
}
Write-Host "   Command: $dashboardCommand" -ForegroundColor Gray
Write-Host "   URL: http://localhost:$displayPort" -ForegroundColor Gray
Write-Host "   Config: http://localhost:$displayPort/config" -ForegroundColor Gray

if ($WithMcp) {
    Write-Host "   MCP debug windows: enabled" -ForegroundColor Yellow
    foreach ($mcpServer in $mcpServers) {
        Write-Host "     - $($mcpServer.Name): $($mcpServer.Command)" -ForegroundColor Gray
    }
    Write-Host "   Note: MCP clients still self-start stdio servers from .copilot\mcp-config.json or .mcp.json." -ForegroundColor DarkGray
    Write-Host "   LM Studio note: current LM Studio runs stay chat-only; use /config plus these windows for manual wiring checks." -ForegroundColor DarkGray
}

if ($CommandOnly) {
    return
}

Push-Location $repoRoot
try {
    if ($WithMcp) {
        Write-Host ""
        Write-Host "Opening MCP debug windows..." -ForegroundColor Cyan
        foreach ($mcpServer in $mcpServers) {
            Start-RepoWindow -Title $mcpServer.Name -Command $mcpServer.Command
            Write-Host "   Opened: $($mcpServer.Name)" -ForegroundColor Green
        }
        Write-Host "   Close those windows when you are done inspecting MCP startup." -ForegroundColor Gray
        Write-Host ""
    }

    if ($preflightArgs) {
        & $npm.Source @preflightArgs
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }

    & $npm.Source @serveArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
