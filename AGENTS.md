# AGENTS.md

This repository is the Pharmagister workspace. Keep all project work scoped to this repo unless the user explicitly requests something else.

## Project boundaries
- Do not mix Pharmagister work with bio-swarm. All bio-swarm artifacts must remain under /Users/epresl/Desktop/bio-swarm.
- Do not modify Pharmagister while working on the separate VBF app. All VBF work must stay under /Users/epresl/Desktop/vbf.
- If a command targets another project, use an explicit path instead of relying on the current shell directory.
- For bio-swarm commands, use `pnpm --dir /Users/epresl/Desktop/bio-swarm ...`.

## Working rules
- Prefer small, surgical changes.
- Follow the repo’s existing patterns and conventions.
- Read the relevant files before changing behavior.
- Validate with the smallest relevant check.
- Ask before broad refactors or cross-project changes.

## Guardrails
- Never copy config, secrets, environment files, build output, or infrastructure between projects.
- Never assume a file from another repo belongs in this workspace.
- Keep the repo free of stray debug artifacts.
