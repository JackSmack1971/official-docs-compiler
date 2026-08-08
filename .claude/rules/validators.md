---
paths:
  - ".claude/skills/official-docs-pack/scripts/validate-*.py"
  - ".claude/skills/official-docs-pack/scripts/validate-*.sh"
  - ".claude/hooks/*.sh"
---

# Validator and hook rules

- Validators must be deterministic and must not require network access.
- Fail closed when a required artifact contract is violated; do not downgrade a failed required check to a warning.
- Preserve machine-readable JSON from Python validators.
- A validator change must test the actual invariant, not only the presence of a keyword.
- Hook scripts must be safe to run repeatedly and must not install dependencies or mutate production files.
- Stop hooks must avoid infinite re-blocking. If `stop_hook_active` is already true, allow the turn to end.
- Hook failure feedback must include the command the agent can run manually to reproduce the failure.
- Do not add `jq` or another runtime dependency solely for hook input parsing when a shell-safe check is sufficient.
