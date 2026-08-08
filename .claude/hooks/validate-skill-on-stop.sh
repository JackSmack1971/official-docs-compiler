#!/usr/bin/env bash
set -euo pipefail

INPUT="$(cat || true)"
if printf '%s' "$INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "$ROOT"

SKILL=".claude/skills/official-docs-pack"
if [[ ! -d "$SKILL" ]]; then
  exit 0
fi

WATCH_PATHS=(
  "AGENTS.md"
  "CLAUDE.md"
  ".claude/settings.json"
  ".claude/rules"
  ".claude/hooks"
  ".claude/output-styles"
  ".claude/skills/official-docs-pack"
  ".claude/skills/maintain-official-docs-pack"
)

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ -z "$(git status --porcelain -- "${WATCH_PATHS[@]}")" ]]; then
    exit 0
  fi
fi

if ! OUTPUT="$(bash "$SKILL/scripts/validate-skill.sh" 2>&1)"; then
  {
    echo "Official docs pack validation failed. Fix it before finishing."
    echo "Reproduce with: bash $SKILL/scripts/validate-skill.sh"
    echo
    printf '%s\n' "$OUTPUT"
  } >&2
  exit 2
fi

exit 0
