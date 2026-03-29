# Convert joe-agent to OpenClaw

## Status: ✅ COMPLETE

## What was done
1. ✅ Created `agents/joe-agent/Dockerfile` — Node.js 22 image with git + openclaw@latest
2. ✅ Created `agents/joe-agent/openclaw.json` — LM Studio provider config with qwen3-4b-thinking-2507
3. ✅ Created `agents/joe-agent/entrypoint.sh` — Auto-bootstraps on first boot: onboard → start temp gateway → health check → auto-approve device pairing → restart as final gateway
4. ✅ Updated `docker-compose.yml` joe-agent service with own Dockerfile, port 18789, Docker volume for .openclaw
5. ✅ Gateway starts, CLI pairing auto-approved, health check passes
6. ✅ Dashboard accessible at `http://localhost:18789/#token=joe-agent-token`
7. ✅ Container restarts skip bootstrap (`.onboarded` flag persisted in volume)

## Key technical detail: Device pairing bootstrap
OpenClaw requires device pairing (cryptographic). The entrypoint solves the chicken-and-egg problem by:
1. Running `openclaw onboard --skip-health` to create device identity
2. Starting gateway in background
3. Running `openclaw health` which creates a pending pairing request
4. Auto-approving the request via Node.js script
5. Verifying health, then stopping temp gateway and exec'ing final gateway

## Next steps (not yet done)
- Convert remaining 4 agents (miles, romeo, enzo, anisa) using same pattern
- Each needs: own Dockerfile, openclaw.json (with its API key), port mapping, gateway token
