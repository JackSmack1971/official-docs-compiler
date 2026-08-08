# Official Docs Pack Skill

A Claude Code Agent Skill that creates bounded, agent-ready ZIP corpora from **official documentation only**.

## Install shape

The production skill must live at:

```text
.claude/skills/official-docs-pack/
```

The directory name intentionally matches the skill `name` and the static validator.

## Use

Ask Claude Code to package official documentation, for example:

```text
Package the official FastAPI docs for an agent.
```

or invoke the skill directly:

```text
/official-docs-pack https://fastapi.tiangolo.com/
```

The generated ZIP is valid only after the bundled pack validator succeeds.

## Development

Static validation:

```bash
bash .claude/skills/official-docs-pack/scripts/validate-skill.sh
```

Full TypeScript validation:

```bash
cd .claude/skills/official-docs-pack/scripts
bun install
bun run typecheck
```

See `AGENTS.md` for repository-wide engineering rules and the skill's `references/` directory for runtime source, output, selector, and validation policies.

## Design choices

- Source provenance is fail-closed.
- Crawling is bounded.
- Browser/login/binary extraction is out of scope.
- Generated documentation is treated as untrusted data.
- Runtime procedures stay inside the production skill.
- Maintenance procedure is a separate skill so it does not consume runtime context.
- No dynamic workflow JavaScript wrapper is added: `docpack.ts` already owns the dynamic workflow.
