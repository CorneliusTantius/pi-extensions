---
description: Open a semantic-pull-request with this pipeline
argument-hint: "[base-branch]"
---
# Open PR

Open a draft PR from the current branch using conventional commits.

**Input:** `$@` — base branch (default `main`).

## Workflow

1. Refuse if on base branch (default `main`). Require a feature branch.
2. Diff: `git fetch origin $@ && git log --oneline $@..HEAD && git diff $@...HEAD --stat`
3. Title: `<type>: <summary>` — one of `feat|fix|refactor|chore|docs|test|build`. No trailing punctuation.
4. Body: 2–4 sentences on what and why, list changed files, and test plan.
5. Push if needed, then:
   `gh pr create --base $@ --title "$TITLE" --body "$BODY" --draft`
6. Output the PR URL. Don't merge.