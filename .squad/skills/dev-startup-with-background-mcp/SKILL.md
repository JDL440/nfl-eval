# Dev Startup with Background MCP

## When to use

Use this skill when:
- Configuring local development startup to optionally launch MCP servers
- Building ergonomic PowerShell dev scripts that manage background processes
- Documenting local dev workflows that require multiple services (dashboard + tools)
- Windows developers need MCP tools available without manually opening second terminal

## Pattern

### 1. Optional flag, not always-on
Add an explicit switch parameter to the dev startup script (e.g., -WithMcp). Never auto-launch MCP servers during default dev startup.

### 2. Use Start-Process for background launch
Prefer Start-Process over call operator or PowerShell jobs for background process management.

Key advantages:
- PassThru returns process object with Id property for deterministic cleanup
- NoNewWindow prevents console clutter
- Log redirection isolates server output from dev console
- Stop-Process -Id is reliable on all Windows PS versions

### 3. Add startup verification
After launching, check if process exited immediately (indicates startup failure).

### 4. Cleanup in finally block
Ensure background process stops when script exits.

### 5. Document with examples
Update README to show default usage, usage with -WithMcp flag, log file location, and cleanup behavior.

### 6. Update .gitignore
Add patterns to avoid accidental log file commits.

## Caveats

- Process cleanup: Use -ErrorAction SilentlyContinue to avoid errors if process already exited
- stdio vs HTTP: This pattern works for stdio MCP servers. For HTTP, use port binding check instead
- Cross-platform: Windows-specific (uses Start-Process/Stop-Process). Use nohup/disown on Unix
- Detached processes: By default still terminated if parent PowerShell exits

## Validation

Test these scenarios:
1. Default startup (no MCP) - works as before
2. With MCP flag - both services start, logs appear, console clean
3. Exit cleanup - Ctrl+C stops both processes
4. Process failure - startup errors detected with informative message
5. Port override - flags like -Port work with MCP enabled
6. Integration - Copilot CLI discovers running MCP server

## Related files

- dev.ps1 - main local dev startup script
- .mcp-server.log / .mcp-server.err.log - log output
- mcp/server.mjs - canonical local MCP server
- README.md - user-facing dev docs
- .gitignore - excludes log files
