---
paths:
  - ".claude/skills/**/SKILL.md"
  - ".claude/skills/**/references/*.md"
---

# Skill authoring rules

- Keep each `SKILL.md` focused on routing, workflow, stop conditions, and navigation.
- Keep detailed policy/reference material in supporting files and link to it directly from `SKILL.md`.
- Avoid local reference chains. Runtime references should be reachable in one hop from `SKILL.md`.
- Put the key positive and negative routing boundary in frontmatter `description`; do not rely on body text for discovery.
- Use `${CLAUDE_SKILL_DIR}` for scripts or bundled resources so invocation is independent of the caller's current directory.
- Do not grant broad `allowed-tools` permissions merely for convenience. Let normal project permissions govern shell/network actions unless a narrow pre-approval has a demonstrated benefit.
- Treat user-facing skill behavior as a contract. If routing, output, source policy, prerequisites, or failure behavior changes, update the matching validator/reference in the same patch.
- Keep production skill instructions declarative and deterministic; maintainer-only procedure belongs in `maintain-official-docs-pack`.
