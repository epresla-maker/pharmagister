# Copilot agent instructions for this workspace

## Scope and boundaries
- This repository is the Pharmagister project. Keep all work inside this repo unless the user explicitly asks for a different project.
- Do not mix Pharmagister changes with the separate bio-swarm project. All bio-swarm artifacts must stay under /Users/epresl/Desktop/bio-swarm only.
- Do not modify Pharmagister while working on the separate VBF app. All VBF work must stay under /Users/epresl/Desktop/vbf.
- If a command must touch a project outside the current repo root, use an explicit path and do not rely on the current working directory.
- For bio-swarm commands, prefer: `pnpm --dir /Users/epresl/Desktop/bio-swarm ...` to avoid accidentally running in the wrong folder.

## Working style
- Prefer small, targeted changes over broad refactors.
- Follow the existing code structure and naming conventions already used in this repo.
- Before making a change, read the directly relevant files and confirm the root cause.
- Keep edits surgical and understandable.
- Verify the result with the smallest relevant check available (tests, build, lint, or direct validation).

## Guardrails
- Never assume code from another project is safe to edit here.
- Never copy config, env files, build output, or infrastructure between projects.
- If the task could affect a different project, ask before proceeding.
- Keep the repo clean: no accidental stray files, debug artifacts, or temporary work in the wrong project.

## Goal
- Help with Pharmagister work efficiently while staying isolated from bio-swarm and VBF to protect project boundaries and keep the agent behavior consistent.
