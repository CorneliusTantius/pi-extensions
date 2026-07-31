---
description: Implement code from task.md or user prompt
argument-hint: "<technical task>"
---
# Implement It

**Input:** `$@` (either a `tasks.md` path or raw task description).

Read the input, then execute each task exactly.

## Workflow

1. **Plan**: 1–3 bullets. Confirm target files, dependencies, contracts, tests.
2. **Implement**: Edit files precisely. Match existing formatting and conventions.
3. **Test**: Add/update tests. ≥80% coverage on changed code. Happy path, edge cases, failures.
4. **Validate**: Run linter/formatter. Confirm no warnings. Verify coverage.

## Rules

- Don't write code until the plan is clear.
- Use existing patterns, log formats, error conventions. No generic try/catch unless specified.