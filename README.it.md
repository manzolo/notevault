# NoteVault — Knowledge Base Self-Hosted con Segreti Cifrati

![Licenza: MIT](https://img.shields.io/badge/Licenza-MIT-blue.svg)
![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)
![Frontend: Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg)
![Database: PostgreSQL 15](https://img.shields.io/badge/Database-PostgreSQL%2015-336791.svg)
![Cifratura: AES-256-GCM](https://img.shields.io/badge/Cifratura-AES--256--GCM-critical.svg)

NoteVault è una **knowledge base self-hosted e multi-utente** che unisce un editor di note in Markdown a una cassaforte per segreti completamente cifrata. Le note sono organizzate con tag e categorie, ricercabili tramite la ricerca full-text di PostgreSQL, e tutti i valori sensibili sono memorizzati cifrati a riposo con AES-256-GCM. L'intero stack gira in Docker ed è gestito tramite un unico `Makefile`.

---

## Indice

- [Funzionalità](#funzionalità)
- [Avvio Rapido](#avvio-rapido)
- [Comandi Make](#comandi-make)
- [Architettura](#architettura)
- [Sicurezza](#sicurezza)
- [Internazionalizzazione](#internazionalizzazione)
- [Panoramica API](#panoramica-api)
- [Variabili d'Ambiente](#variabili-dambiente)
- [Licenza](#licenza)

---

## Funzionalità

- **Multi-utente con autenticazione JWT** — ogni utente dispone di uno spazio di lavoro isolato; i token usano HS256 e scadono dopo 7 giorni.
- **Note con editor Markdown e anteprima live** — scrivi in Markdown e visualizza il risultato renderizzato in tempo reale, affiancato al testo.
- **Tag e categorie** — organizza le note liberamente con tag colorati e categorie gerarchiche.
- **Ricerca full-text** — basata su colonne `tsvector` di PostgreSQL e un indice `GIN` per risultati rapidi e classificati per rilevanza su titoli e contenuti.
- **Cassaforte per segreti cifrati (AES-256-GCM)** — salva chiavi API, password e altri valori sensibili cifrati con AES-256-GCM tramite una `MASTER_KEY` che non viene mai scritta nel database.
- **Rotazione automatica dei segreti dopo 30 secondi** — i segreti vengono mostrati su richiesta e nascosti automaticamente dopo 30 secondi; l'endpoint di rivelazione è soggetto a rate limiting tramite Redis per prevenire accessi automatizzati.
- **Log di audit** — ogni azione di creazione, modifica, eliminazione e rivelazione viene registrata con timestamp e contesto utente; i valori dei segreti vengono oscurati nei log di audit.
- **Internazionalizzazione (Italiano + Inglese)** — il frontend include traduzioni complete per `en` e `it`; la lingua è determinata dal prefisso URL (`/en/...`, `/it/...`).
- **Distribuzione basata su Docker** — un singolo `docker compose up -d` avvia l'intero stack (PostgreSQL, Redis, backend, frontend).

---

## Avvio Rapido

### Prerequisiti

- Docker >= 24 e Docker Compose v2
- Python 3.x (necessario solo per il comando `make keygen`, utilizza la libreria standard)
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
make up

# 5. Esegui le migrazioni del database
make migrate

# 6. Apri l'applicazione
# http://localhost:3000
```

> **Nota:** Al primo avvio, Docker costruirà le immagini del backend e del frontend. Questa operazione può richiedere alcuni minuti. Gli avvii successivi utilizzeranno le immagini in cache.

---

## Comandi Make

Tutte le operazioni quotidiane sono disponibili come target Make. Esegui `make help` per visualizzare l'elenco completo in qualsiasi momento.

| Target | Descrizione |
|---|---|
| `up` | Avvia tutti i servizi in modalità detached |
| `down` | Ferma e rimuove i container |
| `restart` | Riavvia tutti i servizi |
| `build` | (Ri)costruisce le immagini dei servizi |
| `migrate` | Applica tutte le migrazioni Alembic in attesa |
| `migrate-down` | Annulla l'ultima migrazione Alembic |
| `test` | Esegue l'intera suite di test (backend + frontend) |
| `test-backend` | Esegue la suite pytest del backend |
| `test-frontend` | Esegue la suite Jest/React del frontend in modalità CI |
| `logs` | Segue i log di tutti i servizi |
| `logs-backend` | Segue i log del solo servizio backend |
| `shell-backend` | Apre una shell bash nel container del backend |
| `shell-db` | Apre una sessione psql nel container del database |
| `keygen` | Genera i valori `SECRET_KEY` e `MASTER_KEY` per `.env` |
| `deploy` | Sincronizza il codice su un host remoto e riavvia i servizi |
| `clean` | Rimuove container, volumi e servizi orfani |

---

## Architettura

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP / JSON
┌───────────────────────────▼─────────────────────────────┐
│          Frontend  ·  Next.js 14  ·  :3000              │
│          App Router · TypeScript · Tailwind CSS         │
│          next-intl (routing per locale en / it)         │
└───────────────────────────┬─────────────────────────────┘
                            │ REST API
┌───────────────────────────▼─────────────────────────────┐
│          Backend  ·  FastAPI  ·  :8000                  │
│          SQLAlchemy async · Migrazioni Alembic          │
│          Cifratura AES-256-GCM · bcrypt 12 iterazioni   │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
┌────────────▼───────────┐  ┌──────────▼──────────────────┐
│  PostgreSQL 15  :5432  │  │  Redis 7        :6379        │
│  tsvector + indice GIN │  │  Rate limiting · sessioni    │
└────────────────────────┘  └─────────────────────────────┘
```

### Riepilogo dei Componenti

| Livello | Tecnologia | Note |
|---|---|---|
| Backend | FastAPI + SQLAlchemy async | Python 3.12, I/O asincrono completo |
| Database | PostgreSQL 15 | `tsvector` + indice `GIN` per la ricerca full-text |
| Migrazioni | Alembic | Modifiche allo schema versionato |
| Frontend | Next.js 14 App Router + TypeScript | Tailwind CSS, componenti server e client |
| Cache / Rate limiting | Redis 7 | Limita le richieste all'endpoint di rivelazione per utente |
| Autenticazione | JWT HS256 | Scadenza 7 giorni, `SECRET_KEY` da variabile d'ambiente |
| Cifratura | AES-256-GCM + PBKDF2 | `MASTER_KEY` da variabile d'ambiente, mai memorizzata |

---

## Sicurezza

NoteVault è progettato con un approccio a difesa in profondità per proteggere sia le credenziali degli utenti sia i segreti memorizzati.

- **Le chiavi non vengono mai registrate nei log** — `SECRET_KEY` e `MASTER_KEY` vengono lette dalle variabili d'ambiente e non vengono mai scritte nei log applicativi né nel database.
- **Segreti cifrati a riposo** — ogni valore segreto viene cifrato con AES-256-GCM prima di essere salvato. La `MASTER_KEY` è la radice unica della cifratura e deve essere custodita con cura; perderla significa perdere l'accesso a tutti i segreti.
- **I valori dei segreti vengono oscurati nei log di audit** — quando un segreto viene creato, modificato o rivelato, il log di audit registra l'evento e il nome del segreto, ma il valore viene sempre sostituito con `[REDACTED]`.
- **Rate limiting sull'endpoint di rivelazione** — Redis impone un limite di richieste per utente su `POST /api/secrets/{id}/reveal` per prevenire l'estrazione automatizzata dei segreti.
- **Nascondimento automatico dopo 30 secondi** — una volta che un segreto viene rivelato nell'interfaccia, un timer lato client nasconde automaticamente il valore in chiaro dopo 30 secondi.
- **bcrypt a 12 iterazioni** — le password degli utenti sono sottoposte ad hash con bcrypt con un fattore di costo pari a 12.
- **CORS** — il backend accetta richieste solo dalle origini elencate nella variabile d'ambiente `CORS_ORIGINS`.

> **Rotazione delle chiavi:** Per ruotare la `MASTER_KEY`, decifrare tutti i segreti con la vecchia chiave, riciclarli con la nuova, aggiornare `.env` e riavviare. Non è presente uno strumento di rotazione automatica nella versione attuale.

---

## Internazionalizzazione

NoteVault utilizza [next-intl](https://next-intl-docs.vercel.app/) con la strategia `localePrefix: 'always'`. Ogni URL di pagina include il codice lingua come primo segmento del percorso.

| Lingua | Prefisso URL | File di traduzione |
|---|---|---|
| Inglese | `/en/...` | `frontend/messages/en.json` |
| Italiano | `/it/...` | `frontend/messages/it.json` |

La lingua predefinita è `en`. Se un utente visita `/`, il middleware lo reindirizza automaticamente a `/en/`.

### Aggiungere una nuova lingua

1. Crea `frontend/messages/<locale>.json` copiando `en.json` e traducendo tutti i valori.
2. Aggiungi il codice della lingua all'array `locales` in `frontend/i18n.ts`:
   ```typescript
   export const locales = ['en', 'it', 'de'] as const; // esempio: aggiungere il tedesco
   ```
3. Ricostruisci l'immagine del frontend: `make build`.

---

## Panoramica API

L'API REST è servita da FastAPI su `http://localhost:8000`. La documentazione interattiva è disponibile su `/docs` (Swagger UI) e `/redoc` (ReDoc) quando `DEBUG=true`.

| Gruppo di endpoint | Percorso base | Descrizione |
|---|---|---|
| Autenticazione | `/api/auth` | Registrazione, accesso, rinnovo token |
| Note | `/api/notes` | CRUD per le note, contenuto Markdown |
| Tag | `/api/tags` | Creazione, elenco, assegnazione tag alle note |
| Categorie | `/api/categories` | Gestione delle categorie delle note |
| Ricerca | `/api/search` | Ricerca full-text sulle note |
| Segreti | `/api/secrets` | CRUD per i segreti cifrati, endpoint di rivelazione |
| Stato database | `/api/database` | Controllo di salute interno usato da Docker |

Tutti gli endpoint protetti richiedono un'intestazione `Authorization: Bearer <token>`.

---

## Variabili d'Ambiente

Copia `.env.example` in `.env` e compila i valori prima di avviare lo stack.

| Variabile | Obbligatoria | Predefinita | Descrizione |
|---|---|---|---|
| `SECRET_KEY` | Sì | — | Chiave di 32 byte in base64 usata per firmare i token JWT. Generare con `make keygen`. |
| `MASTER_KEY` | Sì | — | Chiave di 32 byte in base64 usata per la cifratura AES-256-GCM dei segreti. Generare con `make keygen`. |
| `DB_PASSWORD` | Sì | — | Password per l'utente PostgreSQL `notevault`. |
| `DATABASE_URL` | No | impostata da compose | Stringa di connessione SQLAlchemy asincrona completa. Sovrascritta automaticamente da Docker Compose. |
| `REDIS_URL` | No | `redis://redis:6379/0` | URL di connessione Redis. |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Elenco separato da virgole delle origini CORS consentite. |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | URL pubblico del backend, usato dal frontend Next.js. |
| `DEBUG` | No | `false` | Attiva la modalità debug di FastAPI e l'interfaccia Swagger UI. Non impostare a `true` in produzione. |
| `ACCESS_TOKEN_EXPIRE_DAYS` | No | `7` | Durata in giorni dei token JWT. |

---

## Licenza

Questo progetto è rilasciato sotto la [Licenza MIT](LICENSE).

---

*Realizzato con FastAPI, Next.js, PostgreSQL e Redis.*
