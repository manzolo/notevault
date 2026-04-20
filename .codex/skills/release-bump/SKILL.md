---
name: release-bump
description: Use when the user wants to perform a NoteVault release version bump such as patch, minor, or major, including changelog update, git tag, Docker publish, GitHub release, deploy, and post-release cleanup.
---

# Release Bump

Use this skill for the NoteVault release workflow. Supported bump types: `patch`, `minor`, `major`. Default is `patch`.

## Inputs

- Bump type: `patch`, `minor`, or `major`
- Optional: whether to run the full publish/deploy flow or stop before external side effects

## Safety Rules

- Follow the steps in sequence.
- Use non-interactive git commands only.
- Never use destructive git commands such as `reset --hard` or `checkout --`.
- Before any external side effect, ask for approval through the normal Codex escalation flow if required.
- Treat publish/deploy actions as explicit side effects:
  - Docker publish
  - GitHub release creation
  - Production deploy
  - `git push`
- If the worktree is dirty, inspect it before committing. Do not overwrite or revert unrelated user changes.
- If there are unrelated dirty changes that should not be released, stop and ask the user.

## Workflow

1. Inspect repo state
   - Run `git status --short`
   - Run `git branch --show-current`
   - Run `git describe --tags --abbrev=0`

2. Decide version
   - Parse latest tag `vX.Y.Z`
   - Compute next version from the requested bump type
   - Keep both forms:
     - git tag: `vX.Y.Z`
     - make version: `X.Y.Z`

3. Prepare pending changes
   - If the worktree contains intended release changes, commit them with:
     - `git add -A`
     - `git commit -m "chore: prepare release"`
   - If the tree is clean, continue
   - If changes look unrelated or risky, stop and ask

4. Update changelog
   - Read commits since previous tag with `git log <prev-tag>..HEAD --oneline`
   - Ensure `CHANGELOG.md` exists and has `# Changelog`
   - Insert a new section near the top in Keep a Changelog style:
     - `## [X.Y.Z] - YYYY-MM-DD`
     - grouped under `Added`, `Changed`, `Fixed`, `Removed` when applicable
   - Map commit prefixes as heuristics:
     - `feat` -> `Added`
     - `fix` -> `Fixed`
     - `refactor`, `perf`, `docs`, selected `chore` -> `Changed`
   - Omit low-signal commits such as merge commits and generic bump noise
   - Commit the changelog:
     - `git add CHANGELOG.md`
     - `git commit -m "chore: update CHANGELOG for vX.Y.Z"`

5. Build production image
   - Run `make build-prod APP_VERSION=X.Y.Z`

6. Create tag artifacts
   - Run `make tag APP_VERSION=X.Y.Z`

7. Publish Docker images
   - Run `make publish APP_VERSION=X.Y.Z`

8. Create GitHub release
   - Run `gh release create vX.Y.Z --generate-notes --title "vX.Y.Z"`

9. Deploy production
   - Run `make deploy-update APP_VERSION=X.Y.Z`

10. Push branch and tags
   - Run `git push origin main`
   - If needed, also push tags with `git push --tags`

11. Clean old Docker images
   - Keep only:
     - new version
     - previous version
     - `latest`
   - Use repository:tag formatting, never image size columns
   - Local pattern:
     - `docker images --format "{{.Repository}}:{{.Tag}}"`
   - Remote cleanup may use SSH if the project deploy target requires it

12. Update memory
   - If `MEMORY.md` exists, update the current released version reference

## Execution Notes

- Prefer running verification after changelog update and before publish if the user asks for a safer release.
- If a required command is missing locally, try the project-supported path first, such as Docker-based commands from the `Makefile`.
- In the final response, report:
  - previous version
  - new version
  - commands executed
  - whether publish/release/deploy happened
  - any skipped or blocked steps

## Invocation

Use one of these prompts:

- `Usa la skill release-bump e fai un bump patch`
- `Usa la skill release-bump e prepara una release minor`
- `Usa la skill release-bump ma fermati prima di publish e deploy`

If the skill is not auto-discovered in your Codex setup, reference this file explicitly:

- `Segui le istruzioni in .codex/skills/release-bump/SKILL.md e fai un bump patch`
