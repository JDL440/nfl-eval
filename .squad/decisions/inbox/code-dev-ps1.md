# Code decision — repo-root v2 dashboard launcher

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-23

## TLDR

The repo-root `dev.ps1` should launch `npm run v2:serve`, not `v2:dev`, and it should not set extra runtime env vars. The current v2 startup path already derives config from `.env` plus defaults and initializes the data directory during `serve`.

## Basis

- `package.json` defines both `v2:dev` (`tsx watch src/cli.ts serve`) and `v2:serve` (`tsx src/cli.ts serve`).
- `README.md` explicitly says to use `npm run v2:serve` for source-mode development.
- `src/cli.ts` routes `serve` to `startServer()`.
- `src/config/index.ts` loads `.env` from the repo root and data dir config.
- `src/dashboard/server.ts` calls `initDataDir()` during startup.

## Implementation note

Keep the PowerShell wrapper thin: resolve the repo root from the script location, print the exact npm command being run, and pass a port override through to `serve` when needed for local validation.
