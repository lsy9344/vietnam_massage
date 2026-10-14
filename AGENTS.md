# Project Agent Instructions

## Agent skills

### Issue tracker

Issues and specs live as markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five default roles, and each label string equals its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

### Design system

UI work (building a screen, restyling, changing a shared component): read `design.md` at the repo root first. It defines the tokens and component shapes, and which older design docs and mockups it overrides.

## BMad Skill Priority

- For BMad work in this repository, prefer the project-local skills in `{project-root}/.agents/skills` over global skills in `C:/Users/KimYS/.codex/skills`.
- If the same BMad skill exists in both places, use the project-local `SKILL.md`.
- Use global BMad skills only when the project-local skill is missing.
