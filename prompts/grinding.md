---
description: Full-cycle implementation workflow combining brainstorming, planning, coding, and PR creation
argument-hint: "<requirement or file path>"
---
# Grinding Mode

Full-cycle: clarify requirement → `plan-n-breakdown` → `implement-it` → `open-pr`.

**Input:** `$@`

## Workflow

1. Read `$@`. Clarify the requirement. Ask questions one at a time. Output a one-sentence goal, key constraints, and a recommended approach.
2. Run `plan-n-breakdown` with the validated concept.
3. Wait for user confirmation, then run `implement-it`.
4. After implementation, run `open-pr` (base: `main` unless specified).

## Rules

- Don't skip validation. Don't build anything until the goal is confirmed.
- Check if the change is even needed before planning.