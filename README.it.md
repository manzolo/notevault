# NoteVault — Knowledge Base Self-Hosted con Segreti Cifrati

![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-blue.svg)
![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)
![Frontend: Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg)
![Database: PostgreSQL 17](https://img.shields.io/badge/Database-PostgreSQL%2017-336791.svg)
![Cifratura: AES-256-GCM](https://img.shields.io/badge/Cifratura-AES--256--GCM-critical.svg)
![Docker Hub](https://img.shields.io/badge/Docker%20Hub-manzolo%2Fnotevault-blue.svg)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-☕-yellow.svg)](https://buymeacoffee.com/manzolo)

NoteVault è una **knowledge base self-hosted e multi-utente** che unisce un editor WYSIWYG Markdown a una cassaforte per segreti completamente cifrata, allegati, task, un calendario ed una potente ricerca full-text — il tutto in Docker.

---

## Indice

- [Funzionalità in Breve](#funzionalità-in-breve)
- [Panoramica delle Funzionalità](#panoramica-delle-funzionalità)
  - [Dashboard e Filtri](#dashboard-e-filtri)
  - [Editor Note](#editor-note)
  - [Cartelle e Organizzazione](#cartelle-e-organizzazione)
  - [Ricerca Full-Text](#ricerca-full-text)
  - [Allegati](#allegati)
  - [Task e Promemoria](#task-e-promemoria)
  - [Calendario ed Eventi](#calendario-ed-eventi)
  - [Segnalibri](#segnalibri)
  - [Campi Tecnici](#campi-tecnici)
  - [Notifiche](#notifiche)
  - [Wiki-link](#wiki-link)
  - [Condivisione Note](#condivisione-note)
  - [Cassaforte Segreti Cifrata](#cassaforte-segreti-cifrata)
  - [Autenticazione a Due Fattori (TOTP)](#autenticazione-a-due-fattori-totp)
- [Avvio Rapido](#avvio-rapido)
- [Comandi Make](#comandi-make)
- [Architettura](#architettura)
- [Sicurezza](#sicurezza)
- [Internazionalizzazione](#internazionalizzazione)
- [Panoramica API](#panoramica-api)
- [Variabili d'Ambiente](#variabili-dambiente)
- [Deploy in Produzione](#deploy-in-produzione)
- [Licenza](#licenza)

---

## Funzionalità in Breve

| Area | Punti salienti |
|---|---|
| **Note** | Editor WYSIWYG (TipTap), salvataggio in Markdown, tag, cartelle, pin, archiviazione |
| **Ricerca** | Full-text PostgreSQL su note, allegati, segnalibri e task |
| **Allegati** | Drag & drop, incolla (Ctrl+V), ZIP (anche protetti da password), EML, anteprima inline |
| **Task** | Checklist inline per nota + pagina task globale, scadenze, riordinamento drag, promemoria |
| **Calendario** | Eventi con regole di ricorrenza, multi-giorno, file allegati, promemoria; vista calendario mensile |
| **Segnalibri** | Segnalibri URL per nota con titolo/descrizione, archivio, drag-to-reorder; segnalibri virtuali da segreti/eventi |
| **Campi Tecnici** | Campi strutturati chiave→valore raggruppati per categoria; sotto-campi: data, link, prezzo, nota, immagine |
| **Notifiche** | Campanella in-app per promemoria task/eventi; posticipa con durata preimpostata o personalizzata |
| **Filtri** | Tag, intervallo date, ricorsivo nelle sottocartelle, solo in evidenza, solo archiviate |
| **Wiki-link** | Link bidirezionali `[[Titolo nota]]` con autocompletamento |
| **Condivisione** | Link pubblici o ristretti per utente, granularità per sezione |
| **Segreti** | Cassaforte AES-256-GCM: password, chiavi API, SSH, seed TOTP con codici live |
| **2FA** | Autenticazione TOTP a due fattori per il login |

---

## Panoramica delle Funzionalità

### Dashboard e Filtri

![Dashboard](docs/screenshots/dashboard.png)

La dashboard elenca tutte le note con un **pannello filtri avanzato** a scomparsa. I filtri possono essere combinati liberamente:

- **Tag** — seleziona un tag per restringere i risultati
- **Solo in evidenza** — mostra in cima le note pinnate
- **Solo archiviate** — sfoglia l'archivio senza intasare la vista principale
- **Intervallo date** — filtra per data di creazione o per date degli eventi nelle note
- **Includi sottocartelle** — ricerca ricorsiva in tutti i figli della cartella selezionata

I filtri attivi compaiono come chip rimovibili anche quando il pannello è chiuso, così è sempre chiaro cosa è attivo.

![Pannello filtri](docs/screenshots/filters.png)

---

### Editor Note

![Editor note](docs/screenshots/note-editor.png)

Le note si editano con un **editor WYSIWYG TipTap completo** che salva il contenuto in Markdown puro. La barra degli strumenti include:

- Grassetto, corsivo, barrato, codice inline
- Titoli H1–H3, liste puntate, liste numerate, liste di task
- Citazioni, blocchi di codice, separatori, link
- Autocompletamento wiki-link (`[[` apre un menu di ricerca live sui titoli)

Le note possono essere **pinnate** (sempre in cima) o **archiviate** (nascoste dalla vista principale, ma ancora ricercabili).

---

### Cartelle e Organizzazione

![Cartelle](docs/screenshots/folders.png)

Le note sono organizzate in un **albero di cartelle gerarchico** (profondità illimitata). Dalla barra laterale è possibile:

- Creare cartelle e sottocartelle
- Rinominare ed eliminare cartelle
- **Trascinare una card nota su una cartella** per spostarla istantaneamente
- Attivare *Includi sottocartelle* per cercare in un intero ramo dell'albero

---

### Ricerca Full-Text

![Risultati ricerca](docs/screenshots/dashboard-search.png)

La barra di ricerca interroga simultaneamente tutti i contenuti tramite **PostgreSQL `tsvector` / GIN** full-text:

- Titoli e testo del corpo delle note
- Testo estratto dagli allegati (PDF, testo, Markdown…)
- Titoli, URL e descrizioni dei segnalibri
- Testo dei task

Quando una corrispondenza è trovata **all'interno di un allegato**, il nome del file appare come chip cliccabile nella card del risultato. Cliccandolo si apre il file inline senza lasciare la pagina di ricerca.

---

### Allegati

![Pannello allegati](docs/screenshots/attachments-panel.png)

Ogni nota dispone di un **pannello allegati** che supporta:

- Click per selezionare un file
- **Drag & drop** direttamente sulla nota
- **Incolla** un'immagine dagli appunti con `Ctrl+V` (salva con nome personalizzato)

Gli allegati sono raggruppati per tipo (immagini, PDF, documenti, fogli di calcolo, archivi, email, script…). Un'ampia gamma di formati può essere visualizzata in anteprima inline:

| Formato | Anteprima |
|---|---|
| Immagini (PNG, JPG, GIF, WebP…) | Renderizzata direttamente |
| PDF | Visualizzatore PDF integrato |
| Testo, Markdown | Testo con evidenziazione |
| ZIP / TAR | Albero file con anteprima delle singole voci |
| ZIP protetto da password | Sblocca con password, poi naviga e visualizza in anteprima |
| EML (email) | Corpo HTML renderizzato + lista allegati incorporati con anteprima |

![Anteprima allegato — ZIP](docs/screenshots/attachment-preview-zip.png)

![Anteprima allegato — EML](docs/screenshots/attachment-preview-eml.png)

---

### Task e Promemoria

![Task](docs/screenshots/tasks.png)

Ogni nota ha una **lista task inline**: aggiungi voci, spuntale, riordina trascinando, imposta scadenze opzionali. Una **pagina Task globale** raccoglie tutte le attività di tutte le note con filtro Da fare / Completate / Tutte.

I task supportano i **promemoria**: imposta uno o più avvisi prima della scadenza, recapitati tramite notifica in-app, Telegram o email. Ogni task può avere fino a 5 promemoria con intervalli preimpostati (15 min, 1 h, 1 giorno, 1 settimana) o una durata completamente personalizzata.

---

### Calendario ed Eventi

![Calendario](docs/screenshots/calendar.png)

Le note possono avere **eventi** con data/ora di inizio, fine opzionale, URL (Google Meet, Zoom…) e file allegati. Tutti gli eventi appaiono in una **vista calendario mensile** insieme ai task con scadenza. Gli eventi multi-giorno si estendono su più colonne.

Il filtro date della dashboard trova le note i cui eventi ricadono nell'intervallo selezionato — non solo la data di creazione della nota.

Gli eventi supportano anche **regole di ricorrenza** (giornaliera, settimanale, mensile, annuale con limiti UNTIL/COUNT opzionali) e **promemoria** con la stessa consegna multicanale dei task.

---

### Segnalibri

Ogni nota ha un **pannello segnalibri** per salvare URL correlati con titolo e descrizione opzionali. I segnalibri supportano drag-to-reorder, archiviazione e indicizzazione full-text.

I **segnalibri virtuali** vengono derivati automaticamente dai segreti e dagli eventi che contengono un URL — appaiono come voci di sola lettura nel pannello segnalibri con un badge sorgente (ambra per i segreti, blu per gli eventi), mantenendo tutti i link rilevanti in un unico posto senza duplicazioni.

---

### Campi Tecnici

Ogni nota può avere **campi tecnici strutturati** — coppie chiave → valore raggruppate in categorie con nome. Ogni campo supporta sotto-campi opzionali: una data, un link URL, un prezzo, una nota e un'immagine (incolla dagli appunti o sfoglia). I campi sono ideali per memorizzare dati strutturati come specifiche di prodotto, parametri di configurazione o metadati di ricerca.

---

### Notifiche

Un'**icona campanella** nella navigazione superiore mostra le notifiche in-app non lette per i promemoria di task ed eventi. Cliccando una notifica si naviga direttamente alla nota pertinente.

Le notifiche possono essere **posticipate** — scegli un preset (10 min, 30 min, 1 h, 3 h, 8 h, 1 giorno, 1 settimana) e la notifica scompare fino alla scadenza del posticipo.

---

### Wiki-link

![Wiki-link](docs/screenshots/wiki-links.png)

Digita `[[` nell'editor per aprire un menu di autocompletamento che cerca i titoli delle note. Selezionando un titolo si inserisce un link `[[Titolo nota]]`. Nella visualizzazione della nota, i wiki-link vengono risolti in link cliccabili e la nota mostra:

- **Note collegate** (in uscita) — note a cui questa nota fa riferimento
- **Backlink** (in entrata) — note che fanno riferimento a questa

I link sono bidirezionali e si aggiornano automaticamente ad ogni salvataggio.

---

### Condivisione Note

![Modale condivisione](docs/screenshots/share-modal.png)

Genera un **link di condivisione** per qualsiasi nota. La condivisione è configurabile:

- **Pubblica** — chiunque con il link può vedere (nessun login richiesto)
- **Solo utenti registrati** — richiede un account NoteVault
- **Utente specifico** — solo un utente scelto può aprire il link

Puoi scegliere **quali sezioni esporre**: contenuto, task, allegati, segnalibri, eventi e opzionalmente i segreti. Ogni sezione è un toggle indipendente.

---

### Cassaforte Segreti Cifrata

![Cassaforte segreti](docs/screenshots/secrets.png)

Ogni nota ha una **cassaforte segreti** cifrata con AES-256-GCM tramite una `MASTER_KEY` che non viene mai scritta nel database. Tipi di segreto supportati:

| Tipo | Campi |
|---|---|
| Password | username, password, URL |
| Chiave API | key ID, segreto, URL |
| Chiave SSH | chiave privata, chiave pubblica opzionale, host |
| Seed TOTP | seed Base32 → **codice OTP live con anello di countdown** |

![Widget TOTP live](docs/screenshots/totp-live.png)

I seed TOTP mostrano un codice a 6 cifre rotante con un anello SVG di countdown da 30 secondi, aggiornato in tempo reale. Qualsiasi segreto può essere **copiato silenziosamente** (valore mai mostrato) o **rivelato per 30 secondi** prima di essere nascosto automaticamente. L'endpoint di rivelazione è soggetto a rate limiting per utente tramite Redis.

---

### Autenticazione a Due Fattori (TOTP)

![Login 2FA](docs/screenshots/login-2fa.png)

Gli utenti possono abilitare **TOTP 2FA** nelle Impostazioni scansionando un QR code con qualsiasi app di autenticazione (Google Authenticator, Aegis, ecc.). Con il 2FA attivo, il login è in due fasi: prima la password, poi il codice OTP a 6 cifre. La configurazione può essere disabilitata in qualsiasi momento inserendo la password attuale.

---

## Avvio Rapido

### Prerequisiti

- Docker >= 24 e Docker Compose v2
- Python 3.x (necessario solo per `make keygen`, utilizza la libreria standard)
- GNU Make

### Procedura

```bash
# 1. Clona il repository
git clone https://github.com/manzolo/notevault.git
cd noteVault

# 2. Genera le chiavi crittografiche
make keygen
# Esempio di output:
#   SECRET_KEY=<valore base64 di 32 byte>
#   MASTER_KEY=<valore base64 di 32 byte>

# 3. Crea il file di configurazione e incolla le chiavi generate
cp .env.example .env
# Modifica .env e inserisci SECRET_KEY, MASTER_KEY, DB_PASSWORD, ecc.

# 4. Costruisci le immagini e avvia tutti i servizi
make build
make up

# 5. Apri l'applicazione
# http://localhost:3000
```

> **Nota:** Al primo avvio `make build` compila le immagini del backend e del frontend, operazione che può richiedere qualche minuto. Gli avvii successivi usano la cache Docker. Le migrazioni vengono applicate automaticamente all'avvio del container.

---

## Comandi Make

Tutte le operazioni quotidiane sono disponibili come target Make. Esegui `make help` per l'elenco completo.

### Sviluppo

| Target | Descrizione |
|---|---|
| `build` | (Ri)costruisce le immagini per **sviluppo** |
| `up` | Avvia tutti i servizi in modalità detached |
| `down` | Ferma e rimuove i container |
| `restart` | Riavvia tutti i servizi |
| `migrate` | Applica tutte le migrazioni Alembic in attesa |
| `migrate-down` | Annulla l'ultima migrazione Alembic |
| `test-backend` | Esegue la suite pytest del backend nel container |
| `test-e2e` | Esegue i test end-to-end Playwright (richiede lo stack attivo) |
| `logs` | Segue i log di tutti i servizi |
| `logs-backend` | Segue i log del solo servizio backend |
| `shell-backend` | Apre una shell bash nel container del backend |
| `shell-db` | Apre una sessione psql nel container del database |
| `keygen` | Genera i valori `SECRET_KEY` e `MASTER_KEY` |
| `clean` | Rimuove container, volumi e servizi orfani |

### Release & Deploy (Docker Hub)

| Target | Descrizione |
|---|---|
| `build-prod` | Costruisce le immagini per la **produzione** |
| `tag` | Crea il tag git `vX.Y.Z` e tagga le immagini Docker — `make tag APP_VERSION=1.2.3` |
| `publish` | Pubblica le immagini su Docker Hub e invia il tag git — `make publish APP_VERSION=1.2.3` |
| `deploy` | **Prima installazione**: copia compose + `.env` sul server, scarica immagini, avvia, migra |
| `deploy-update` | **Aggiornamento**: scarica la nuova versione e riavvia — `make deploy-update APP_VERSION=1.2.3` |

> Le variabili di deploy (`DEPLOY_HOST`, `DEPLOY_PATH`) vengono lette da `.env.deploy` (gitignored). Vedi [Deploy in Produzione](#deploy-in-produzione).

---

## Architettura

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP (via reverse proxy)
┌───────────────────────────▼─────────────────────────────┐
│          Frontend  ·  Next.js 14  ·  Node 22  ·  :3000  │
│          App Router · TypeScript · Tailwind CSS         │
│          next-intl (en / it) · rewrite /api/* → backend │
└───────────────────────────┬─────────────────────────────┘
                            │ REST API (interna)
┌───────────────────────────▼─────────────────────────────┐
│          Backend  ·  FastAPI  ·  Python 3.12  ·  :8000  │
│          SQLAlchemy async · Migrazioni Alembic          │
│          Cifratura AES-256-GCM · bcrypt 12 iterazioni   │
│          APScheduler (consegna promemoria)              │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
┌────────────▼───────────┐  ┌──────────▼──────────────────┐
│  PostgreSQL 17  :5432  │  │  Redis 7        :6379        │
│  tsvector + indice GIN │  │  Rate limiting · sessioni    │
└────────────────────────┘  └─────────────────────────────┘
```

In produzione un reverse proxy (es. Nginx Proxy Manager) è posizionato davanti al container frontend. Il server Next.js fa da proxy interno per tutte le richieste `/api/*` verso il backend — il backend non è mai esposto pubblicamente.

---

## Sicurezza

- **Le chiavi non vengono mai registrate** — `SECRET_KEY` e `MASTER_KEY` vengono lette dalle variabili d'ambiente e non vengono mai scritte nei log né nel database.
- **Segreti cifrati a riposo** — ogni valore segreto viene cifrato con AES-256-GCM prima di essere salvato. La `MASTER_KEY` è la radice unica della cifratura; perderla significa perdere l'accesso a tutti i segreti.
- **Valori oscurati nei log di audit** — il log di audit registra eventi e nomi dei segreti, ma i valori vengono sempre sostituiti con `[REDACTED]`.
- **Rate limiting sull'endpoint di rivelazione** — Redis impone un limite di richieste per utente sulla rivelazione dei segreti.
- **Nascondimento automatico dopo 30 secondi** — un timer lato client nasconde automaticamente il valore in chiaro.
- **bcrypt a 12 iterazioni** — le password degli utenti sono sottoposte ad hash con bcrypt con fattore di costo 12.
- **TOTP 2FA** — autenticazione a due fattori opzionale per il login.
- **CORS** — il backend accetta richieste solo dalle origini elencate in `CORS_ORIGINS`.

> **Rotazione delle chiavi:** Per ruotare la `MASTER_KEY`, decifrare tutti i segreti con la vecchia chiave, riciclarli con la nuova, aggiornare `.env` e riavviare. Non è presente uno strumento di rotazione automatica nella versione attuale.

---

## Internazionalizzazione

NoteVault utilizza [next-intl](https://next-intl-docs.vercel.app/) con la strategia `localePrefix: 'always'`. Ogni URL di pagina include il codice lingua come primo segmento.

| Lingua | Prefisso URL | File di traduzione |
|---|---|---|
| Inglese | `/en/...` | `frontend/messages/en.json` |
| Italiano | `/it/...` | `frontend/messages/it.json` |

La lingua predefinita è `en`. Visitare `/` reindirizza automaticamente a `/en/`.

---

## Panoramica API

L'API REST è servita da FastAPI su `http://localhost:8000`. La documentazione interattiva è disponibile su `/docs` (Swagger UI) quando `DEBUG=true`.

| Gruppo endpoint | Percorso base | Descrizione |
|---|---|---|
| Autenticazione | `/api/auth` | Registrazione, accesso, verifica TOTP, configurazione 2FA |
| Note | `/api/notes` | CRUD, pin, archivio, resolve wiki-link, backlink |
| Tag | `/api/tags` | Creazione, elenco, assegnazione tag |
| Categorie | `/api/categories` | CRUD cartelle |
| Ricerca | `/api/search` | Ricerca full-text su note, allegati, segnalibri, task |
| Allegati | `/api/notes/{id}/attachments` | Upload, stream, anteprima ZIP/EML, eliminazione |
| Segnalibri | `/api/notes/{id}/bookmarks` | CRUD, archivio, ripristino, riordinamento |
| Segreti | `/api/secrets` | CRUD, rivelazione, copia silenziosa, seed TOTP |
| Task | `/api/tasks` | Task per nota + lista task globale, riordinamento, archivio |
| Promemoria task | `/api/tasks/{id}/reminders` | CRUD per i promemoria del singolo task |
| Eventi | `/api/notes/{id}/events` | CRUD eventi calendario con ricorrenza |
| Promemoria eventi | `/api/events/{id}/reminders` | CRUD per i promemoria del singolo evento |
| Campi tecnici | `/api/notes/{id}/fields` | CRUD, riordinamento per campi chiave→valore strutturati |
| Date campi | `/api/field-dates` | Aggregazione calendario dei campi di tipo data |
| Notifiche | `/api/notifications` | Elenco, segna come letto, posticipa |
| Condivisione | `/api/notes/{id}/share` | Creazione/revoca token; vista pubblica |

Tutti gli endpoint protetti richiedono un'intestazione `Authorization: Bearer <token>`.

---

## Variabili d'Ambiente

### Applicazione (`.env`)

Copia `.env.example` in `.env` e compila i valori prima di avviare lo stack.

| Variabile | Obbligatoria | Predefinita | Descrizione |
|---|---|---|---|
| `SECRET_KEY` | **sì** | — | Chiave di 32 byte in base64 per la firma dei token JWT. Generare con `make keygen`. |
| `MASTER_KEY` | **sì** | — | Chiave di 32 byte in base64 per la cifratura AES-256-GCM. Generare con `make keygen`. |
| `DB_PASSWORD` | **sì** | — | Password per l'utente PostgreSQL `notevault`. |
| `DATABASE_URL` | no | impostata da compose | Stringa di connessione SQLAlchemy asincrona. Sovrascritta da Docker Compose. |
| `REDIS_URL` | no | `redis://redis:6379/0` | URL di connessione Redis. |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Origini CORS consentite, separate da virgola. In produzione impostare al proprio dominio. |
| `NEXT_PUBLIC_API_URL` | no | `/api` | **Incorporato nel bundle frontend a build time.** Solo per configurazioni cross-origin. |
| `DEBUG` | no | `false` | Attiva la modalità debug di FastAPI e Swagger UI. Non usare in produzione. |
| `TOTP_REQUIRED` | no | `false` | Impone il 2FA TOTP a tutti gli utenti al login. |

### Configurazione deploy (`.env.deploy`, gitignored)

Copia `.env.deploy.example` in `.env.deploy` e inserisci le informazioni del server.

| Variabile | Descrizione |
|---|---|
| `DEPLOY_HOST` | Destinazione SSH, es. `root@your-server.lan` |
| `DEPLOY_PATH` | Percorso assoluto sul server remoto, es. `/root/notevault` |
| `NEXT_PUBLIC_API_URL` | Opzionale — solo per configurazioni cross-origin. |

---

## Deploy in Produzione

Consulta [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) per la guida completa. Riepilogo rapido:

```bash
# 1. Crea .env.deploy con le informazioni del server (gitignored)
cp .env.deploy.example .env.deploy
# Modifica: DEPLOY_HOST, DEPLOY_PATH

# 2. Crea il .env di produzione sul server (copia da .env.prod.example)
#    Imposta DB_PASSWORD, SECRET_KEY, MASTER_KEY, CORS_ORIGINS robusti

# 3. Costruisci, tagga e pubblica su Docker Hub
make build-prod
make tag APP_VERSION=1.0.0
make publish APP_VERSION=1.0.0

# 4. Prima installazione (copia compose + .env, scarica immagini, avvia, migra)
make deploy

# 5. Release successive
make build-prod && make tag APP_VERSION=1.1.0 && make publish APP_VERSION=1.1.0
make deploy-update APP_VERSION=1.1.0
```

---

## Licenza

Questo progetto è rilasciato sotto la [Licenza MIT](LICENSE).

---

*Realizzato con FastAPI, Next.js, PostgreSQL e Redis.*
