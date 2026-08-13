# Native Search and Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare lo schermo nero e aggiungere ricerca globale bilingue e supporto video con UX macOS resiliente.

**Architecture:** Il main process mantiene scansione, query SQLite e apertura sicura dei file; il preload espone contratti tipizzati; React presenta cartelle, risultati e player. Le regole pure di ricerca e formato restano in moduli testabili senza Electron.

**Tech Stack:** Electron 43, React 19, TypeScript 7, Zustand 5, node:sqlite, Sharp, Node test runner.

**Spec:** `docs/specs/2026-08-13-native-search-media.md`

## Global Constraints

- Nessun servizio cloud o invio di nomi/percorso fuori dal Mac.
- Nessun accesso diretto al filesystem dal renderer.
- Nessuna dipendenza FFmpeg.
- Migrazioni SQLite transazionali e conservative.
- Limite di 200 risultati per ricerca.

---

### Task 1: Avvio renderer resiliente

**Files:**
- Create: `src/renderer/src/stores/selectors.ts`
- Create: `src/renderer/src/components/AppErrorBoundary.tsx`
- Create: `tests/selectors.test.ts`
- Modify: `src/renderer/src/components/SidebarFolder.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/src/styles/global.css`

**Interfaces:**
- Produces: `selectFolderTagIds(state, folderId): readonly number[]` con fallback referenzialmente stabile.

- [ ] Scrivere il test che richiede la stessa istanza vuota su chiamate ripetute.
- [ ] Eseguire il test e verificare il fallimento per modulo mancante.
- [ ] Implementare il selettore stabile e usarlo in `SidebarFolder`.
- [ ] Aggiungere Error Boundary con ricarica esplicita.
- [ ] Eseguire test, typecheck e smoke Electron senza `Maximum update depth exceeded`.

### Task 2: Motore di ricerca bilingue

**Files:**
- Create: `src/shared/search.ts`
- Create: `tests/search.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/api.ts`
- Modify: `src/main/ipc/files.ts`
- Modify: `src/preload/index.ts`

**Interfaces:**
- Produces: `expandSearchQuery(query): string[]`, `SearchResult`, `files.search(query, limit)`.

- [ ] Scrivere test per accenti, equivalenza italiano/inglese e query vuota.
- [ ] Verificare il fallimento iniziale.
- [ ] Implementare normalizzazione ed espansione bidirezionale.
- [ ] Aggiungere query globale parametrizzata con limite massimo 200.
- [ ] Eseguire test e typecheck.

### Task 3: Risultati globali Finder-like

**Files:**
- Create: `src/renderer/src/components/SearchResults.tsx`
- Create: `src/renderer/src/stores/search.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/MainContent.tsx`
- Modify: `src/renderer/src/components/SearchBar.tsx`
- Modify: `src/renderer/src/styles/global.css`

**Interfaces:**
- Consumes: `files.search(query, 200)`.
- Produces: stato ricerca con debounce, risultati, loading ed errore.

- [ ] Collegare la query globale allo store ricerca.
- [ ] Rendere risultati raggruppati per cartella/file e navigabili.
- [ ] Verificare stati vuoto, loading ed errore con typecheck/build.

### Task 4: Video e apertura macOS sicura

**Files:**
- Create: `src/shared/media-formats.ts`
- Create: `tests/media-formats.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/main/scanner.ts`
- Modify: `src/main/db/schema.sql`
- Modify: `src/main/db/migrations.ts`
- Modify: `src/main/ipc/files.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/components/MediaCard.tsx`
- Modify: `src/renderer/src/components/MediaGrid.tsx`
- Modify: `src/renderer/src/components/Lightbox.tsx`
- Modify: `src/renderer/src/styles/global.css`

**Interfaces:**
- Produces: `MediaKind = image | audio | video | other`, `classifyMediaPath`, `files.open(id)`.

- [ ] Scrivere test della matrice formati/MIME.
- [ ] Verificare il fallimento iniziale.
- [ ] Centralizzare formati e aggiungere scansione video.
- [ ] Migrare il vincolo SQLite preservando `file_tags`.
- [ ] Aggiungere Quick Look video e apertura esterna validata per ID.
- [ ] Eseguire test, typecheck e build.

### Task 5: Tema macOS e verifica completa

**Files:**
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/main/index.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm test` e smoke runtime ripetibile.

- [ ] Aggiungere tema scuro, focus visibile e reduced motion.
- [ ] Aggiungere comando di test e smoke diagnostico.
- [ ] Eseguire `npm test`, `npm run typecheck`, `npm run build` e smoke Electron.
- [ ] Documentare formati supportati e fallback codec.

