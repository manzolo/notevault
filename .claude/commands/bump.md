---
description: Release a new NoteVault version (patch/minor/major bump + publish + deploy)
argument-hint: [patch|minor|major]
allowed-tools: [Bash, Read, Edit, Write]
---

# NoteVault Bump & Release

Esegui il processo completo di release per NoteVault. L'argomento opzionale è `$ARGUMENTS` (può essere `patch`, `minor`, o `major`; default: `patch`).

## Istruzioni

1. **Commit delle modifiche pendenti**
   - Esegui `git status` per verificare se ci sono modifiche non committate
   - Se ci sono file modificati o non tracciati, esegui `git add -A` e poi `git commit -m "chore: prepare release"` (con il co-authored-by trailer standard)
   - Se il working tree è pulito, salta questo passo

2. **Determina la nuova versione**
   - Esegui `git describe --tags --abbrev=0` per ottenere il tag corrente (es. `v0.8.13`)
   - In base all'argomento `$ARGUMENTS`:
     - nessun argomento o `patch` → incrementa PATCH (es. `v0.8.13` → `v0.8.14`)
     - `minor` → incrementa MINOR e azzera PATCH (es. `v0.8.13` → `v0.9.0`)
     - `major` → incrementa MAJOR e azzera MINOR e PATCH (es. `v0.8.13` → `v1.0.0`)
   - Ricava il numero senza `v` per i comandi make (es. `0.8.14`)

2. **Aggiorna il CHANGELOG**
   - Leggi i commit dall'ultimo tag ad oggi: `git log <prev-tag>..HEAD --oneline`
   - Se `CHANGELOG.md` non esiste, crealo con intestazione `# Changelog`
   - Aggiungi in cima (subito dopo l'intestazione) una nuova sezione nel formato Keep a Changelog:
     ```
     ## [X.Y.Z] - YYYY-MM-DD
     ### Added / Changed / Fixed / Removed
     - ...
     ```
   - Raggruppa i commit per tipo (`feat` → Added, `fix` → Fixed, `chore`/`refactor` → Changed, ecc.); ometti i commit irrilevanti (merge, bump, chore generico)
   - Committa il changelog: `git add CHANGELOG.md && git commit -m "chore: update CHANGELOG for vX.Y.Z"` (con co-authored-by trailer)

4. **Build produzione**
   - `make build-prod APP_VERSION=X.Y.Z`

5. **Tag git e Docker**
   - `make tag APP_VERSION=X.Y.Z`

6. **Pubblica su Docker Hub**
   - `make publish APP_VERSION=X.Y.Z`

7. **Crea GitHub release**
   - `gh release create vX.Y.Z --generate-notes --title "vX.Y.Z"`

8. **Deploy su server di produzione**
   - `make deploy-update APP_VERSION=X.Y.Z`

9. **Push branch main**
   - `git push origin main`

10. **Pulizia immagini Docker vecchie** (mantieni nuova, precedente, latest)
   - Locale:
     ```
     docker images --format "{{.Repository}}:{{.Tag}}" | grep "manzolo/notevault" | grep -v "<new>\|<prev>\|latest" | xargs -r docker rmi -f
     ```
   - Server remoto:
     ```
     ssh root@home-server.lan "docker images --format '{{.Repository}}:{{.Tag}}' | grep 'manzolo/notevault' | grep -v '<new>\|<prev>\|latest' | xargs -r docker rmi -f; docker image prune -f"
     ```
   - IMPORTANTE: usa sempre `--format "{{.Repository}}:{{.Tag}}"` — mai `awk '{print $3}'` (col 3 = SIZE)
   - IMPORTANTE: `docker rmi -f` (force) obbligatorio

11. **Aggiorna la memoria** — aggiorna `MEMORY.md` con la nuova versione corrente

Esegui i passi **in sequenza**, uno alla volta, aspettando il completamento di ciascuno prima di procedere.
