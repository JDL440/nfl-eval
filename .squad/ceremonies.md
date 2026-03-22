# Ceremonies — NFL Lab

## Design Review

- **Trigger:** manual ("design review", "design meeting")
- **When:** before
- **Facilitator:** Lead
- **Participants:** Relevant domain agents (determined by Lead)
- **Purpose:** Align on architecture before implementation
- **Output:** Decision entries in decisions.md

## Retrospective

- **Trigger:** manual ("retro", "retrospective", "what went well")
- **When:** after
- **Facilitator:** Lead
- **Participants:** All active agents from recent work
- **Purpose:** Reflect on what worked and what didn't
- **Output:** Process improvements captured in decisions.md

## Pre-Flight Check

- **Trigger:** auto
- **Condition:** Multi-agent task touching 3+ domains
- **When:** before
- **Facilitator:** Lead
- **Participants:** All agents involved in the task
- **Purpose:** Identify dependencies and conflicts before parallel fan-out
- **Output:** Spawn plan with sequencing

## Code Review

- **Trigger:** auto
- **Condition:** Implementation task completed
- **When:** after
- **Facilitator:** Lead
- **Participants:** Lead + original author
- **Purpose:** Quality gate before merge
- **Output:** Approve or reject with feedback
