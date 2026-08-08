---
name: maintain-official-docs-pack
description: Maintains or extends the official-docs-pack skill itself. Use when editing its SKILL.md, source policy, selectors, crawler, fetcher, validators, dependencies, output schema, or Claude Code integration. Do not use for building a documentation pack for an end user.
argument-hint: "<maintenance task>"
compatibility: "Claude Code; Bun is required for full TypeScript validation and network smoke tests."
---

# Maintain Official Docs Pack

Apply the requested maintenance task to the sibling production skill at `${CLAUDE_SKILL_DIR}/../official-docs-pack`.

Task:

```text
$ARGUMENTS
```

## Read only what the change needs

Start with the production `SKILL.md`, then load supporting references selectively:

- Source trust, discovery, hosts, or crawl scope: `references/source-policy.md`
- ZIP structure, Markdown, indexes, or chunking: `references/output-spec.md`
- Selectors or extraction: `references/selectors.md`
- Validation or smoke tests: `references/validation.md`
- Operator procedure/failure handling: `references/SOP.md`

Do not read every reference by default.

## Maintenance invariants

1. Preserve official-source provenance as a fail-closed boundary.
2. Do not make a search result official from hostname/path shape alone.
3. Do not add unofficial fallback sources to improve coverage.
4. Do not add browser/login/binary workflows unless the requested product scope explicitly changes.
5. Keep runtime instructions concise and move detail to supporting references.
6. Update deterministic validators when a contract changes.
7. Keep generator/package versions synchronized.

## Validation sequence

Run static validation after every completed change:

```bash
bash "${CLAUDE_SKILL_DIR}/../official-docs-pack/scripts/validate-skill.sh"
```

For TypeScript or dependency changes, ensure Bun dependencies exist and typecheck:

```bash
cd "${CLAUDE_SKILL_DIR}/../official-docs-pack/scripts"
if [ ! -d node_modules ]; then
  bun install
fi
bun run typecheck
```

Run network smoke tests only if the change affects discovery, source verification, fetching, crawling, extraction, or selectors. Use the exact positive/rejection tests in `references/validation.md`.

If a required check fails, fix it before declaring the task complete. If a check cannot run because a prerequisite or network capability is unavailable, state that explicitly rather than treating it as passed.
