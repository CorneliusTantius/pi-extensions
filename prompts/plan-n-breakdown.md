---
description: Analyze a requirement/file/prompt, create plan.md then break down into tasks.md
argument-hint: "<requirement or file path>"
---

# Plan & Breakdown

Analyze a requirement and produce two files: `plan.md` and `tasks.md`.

**Input:** `$@`

## Workflow

1. Read `$@`. Identify goal, constraints, dependencies, acceptance criteria. Grep the codebase for existing patterns.
2. Write `plan.md` (overwrite):

   ```
   # Implementation Plan

   ## Goal
   One sentence: what we are building.

   ## Files to Change
   - `path/to/file.ts` — what changes (one line each)

   ## Must Not Change
   - Public APIs, schemas, behavior contracts (list explicitly)

   ## Risks / Unknowns
   - Risk — how to verify

   ## Test Surface
   - Existing tests that cover this
   - New tests needed
   ```

3. Write `tasks.md` (overwrite):

   ```
   # Tasks

   ## Phase 1: Setup / Scaffolding
   - [ ] Task description — file:line or command

   ## Phase 2: Core Implementation
   - [ ] Task description — file:line

   ## Phase 3: Tests
   - [ ] Task description — file:line

   ## Phase 4: Polish / PR
   - [ ] Task description
   ```

   Each task: actionable in one session, no further design needed.

## Rules

- No implementation code. Only plan and tasks.
- Reuse existing patterns. Skip speculative tasks — note them as "deferred".
- Stop after writing both files. Wait for user before running `implement-it`.