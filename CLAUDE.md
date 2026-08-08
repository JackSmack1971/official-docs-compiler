@AGENTS.md

# Claude Code

- Use `.claude/rules/` for path-specific maintainer constraints instead of growing this file.
- Use `.claude/skills/maintain-official-docs-pack/` for the multi-step maintenance workflow.
- Resolve files bundled inside a skill with `${CLAUDE_SKILL_DIR}` rather than assuming the current working directory.
- Do not add a nested `CLAUDE.md` inside the production skill directory. Its runtime package should remain self-contained and free of maintenance-only memory.
- Do not set a project-wide output style in `.claude/settings.json`; the included `Docpack Operator` style is optional because response style is a user preference, not a correctness mechanism.
