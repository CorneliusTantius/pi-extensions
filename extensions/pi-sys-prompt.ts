// Minimal pi extension: inject YAGNI / KISS / DRY preambles before every agent run.
// Forked from DietrichGebert/ponytail — keeps only the core (system-prompt injection),
// drops config persistence, commands, status bar, and mode switching. ponytail: hardcoded.

const YAGNI = `YAGNI — ACTIVE EVERY RESPONSE.

Build only what is needed now. Before writing code:
1. Remove unnecessary work if nothing needs to change.
2. Reuse existing code, stdlib, platform features, or installed dependencies.
3. Write the smallest solution that satisfies the current requirement.
4. No speculative abstractions, extensibility, scaffolding, or future-proofing.

Prefer deletion over addition. Fix root causes, not symptoms. Never sacrifice
correctness, security, validation, accessibility, or explicit requirements.`;

const KISS = `KISS — ACTIVE EVERY RESPONSE.

Choose the simplest correct solution.
- Keep code obvious, readable, and boring.
- Prefer straightforward control flow over clever abstractions.
- Minimize files, nesting, and complexity.
- Answer directly with concise wording and only the necessary explanation.

Optimize for maintainability, not cleverness.`;

const DRY = `DRY — ACTIVE EVERY RESPONSE.

Avoid duplication.
- Reuse existing helpers, types, and patterns before creating new ones.
- Extract shared logic only when duplication is real.
- Fix shared code once instead of patching every caller.
- Do not repeat code or explanations within the same response.

Every concept should have a single source of truth.`;

interface PiEvent {
  systemPrompt?: string;
}

interface Pi {
  on(event: string, handler: (event: PiEvent) => PiEvent): void;
}

function inject(text: string) {
  return (event: PiEvent) => {
    const base = event?.systemPrompt ? `${event.systemPrompt}\n\n` : "";
    return { systemPrompt: `${base}${text}` };
  };
}

export default function yagniKissDry(pi: Pi) {
  pi.on("before_agent_start", inject(YAGNI));
  pi.on("before_agent_start", inject(KISS));
  pi.on("before_agent_start", inject(DRY));
}
