# pi-extensions

Pi extensions and prompt templates by [Cornelius Tantius](https://github.com/CorneliusTantius).

The repository is one Pi package, but each extension can be enabled independently with a package filter.

## Install everything

```bash
pi install git:github.com/CorneliusTantius/pi-extensions
```

Restart Pi or run `/reload` after installing.

## Install one extension

Replace the `packages` entry in `~/.pi/agent/settings.json` with an object. Paths are relative to this repository:

```json
{
  "packages": [
    {
      "source": "git:github.com/CorneliusTantius/pi-extensions",
      "extensions": ["extensions/pi-theme.ts"],
      "prompts": []
    }
  ]
}
```

Available extension paths:

| Extension | Path |
| --- | --- |
| Extension manager (`/extensions`) | `extensions/pi-ext-mgr.ts` |
| Subagents (`spawn_subagents`, `/subagents`) | `extensions/pi-subagents.ts` |
| YAGNI/KISS/DRY system prompt | `extensions/pi-sys-prompt.ts` |
| Compact TUI theme (`/theme-history`) | `extensions/pi-theme.ts` |

`prompts: []` disables this package's prompt templates. If omitted, all prompt templates load.

To enable the system prompt extension and its templates:

```json
{
  "packages": [
    {
      "source": "git:github.com/CorneliusTantius/pi-extensions",
      "extensions": ["extensions/pi-sys-prompt.ts"],
      "prompts": ["prompts/*.md"]
    }
  ]
}
```

## Prompt templates

When enabled, the package provides:

- `/grinding`
- `/implement-it`
- `/plan-n-breakdown`
- `/open-pr`

## Layout

```text
extensions/
  pi-ext-mgr.ts
  pi-subagents.ts
  pi-sys-prompt.ts
  pi-theme.ts
prompts/
  grinding.md
  implement-it.md
  open-pr.md
  plan-n-breakdown.md
```

The old standalone repositories remain available, but this repository is the canonical install source going forward.
