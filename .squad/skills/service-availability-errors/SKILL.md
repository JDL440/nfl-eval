# Skill: Service Availability Errors

## Pattern
When a dashboard action depends on an optional integration service, separate these cases in both server logic and UI copy:
1. required env/config is missing
2. service failed to initialize or was not injected
3. downstream API call failed after service was available

## Why
Users can act on missing config, but they cannot self-fix a wiring or startup bug. Blending those states into one generic configuration error creates false debugging steps and weakens trust in the dashboard.

## Apply it here
For Substack publish routes, article draft/publish needs `SUBSTACK_TOKEN` + `SUBSTACK_PUBLICATION_URL`. The UI should only tell users to set env vars when those keys are absent; otherwise it should say the dashboard session does not currently have publishing available and suggest restart or code-path investigation.

## Checks
- Verify what the server actually tested (`!service` vs missing env vs API failure).
- Match UI copy to the failing layer.
- If the service is unavailable before any user action, disable the control instead of letting the user discover it via 500.
