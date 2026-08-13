# Search, Preview and Labels Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere affidabili ricerca bilingue, apertura interna, visualizzazione completa delle fotografie e rimozione di etichette/categorie prima della release `v0.1.0`.

**Architecture:** La ricerca continua a funzionare offline tramite gruppi concettuali versionati e matching per token. Le card non delegano più il doppio clic al sistema; la lightbox mantiene azioni esterne soltanto quando esplicitamente richieste. La preview usa un canvas `contain` indipendente dalle dimensioni intrinseche, mentre le associazioni cartella-marker espongono rimozione singola e totale.

**Tech Stack:** Electron, React, TypeScript, Zustand, SQLite, Node test runner, Sharp/LibRaw.

**Spec:** Design approvato in chat il 13 agosto 2026.

## Global Constraints

- Originali fotografici sempre read-only; soltanto SQLite e cache derivati sono modificabili.
- Ricerca offline: nessun nome file inviato a servizi esterni.
- L’apertura nel software predefinito rimane disponibile solo tramite pulsante esplicito.
- Zoom iniziale `100%`, pan `{ x: 0, y: 0 }`, immagine completa con `object-fit: contain`.
- Le associazioni vengono rimosse senza eliminare la definizione globale del tag o della categoria.
- La release GitHub esistente resta in bozza fino alla verifica finale.

---

### Task 1: Dizionario bilingue offline

**Files:**
- Create: `src/shared/search-lexicon.ts`
- Modify: `src/shared/search.ts`
- Modify: `tests/search.test.ts`

**Interfaces:**
- Produces: `SEARCH_LEXICON`, gruppi normalizzati consumati da `expandSearchQuery`.

- [ ] Scrivere test fallenti per `barca -> boat` su `123_boat_23fs.mp3`, plurali e campioni trasversali di persone, natura, trasporti, colori, eventi, azioni e formati.
- [ ] Eseguire `node --experimental-strip-types --test tests/search.test.ts` e confermare fallimenti per termini assenti.
- [ ] Estrarre e ampliare il lessico offline con sinonimi e forme comuni, senza matching parziale dei termini tradotti.
- [ ] Rieseguire il test e confermare tutti i casi verdi.

### Task 2: Doppio clic confinato nell’app

**Files:**
- Modify: `src/renderer/src/components/MediaCard.tsx`
- Create: `tests/media-card-interaction.test.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- La card produce soltanto `onSelect(file)` sia con clic singolo sia con doppio clic; nessuna chiamata `files.open`.

- [ ] Scrivere un test comportamentale sul controller della card che dimostri che il doppio clic seleziona ma non richiede apertura esterna.
- [ ] Confermare il fallimento contro il comportamento corrente.
- [ ] Rimuovere la delega a `window.cartelli.files.open` dalla card e mantenere le azioni esterne esplicite nella lightbox.
- [ ] Estendere lo smoke affinché un doppio clic non generi apertura esterna e verificare il test.

### Task 3: Preview completa e zoom iniziale RAW

**Files:**
- Modify: `src/renderer/src/components/ZoomablePhoto.tsx`
- Modify: `src/renderer/src/styles/global.css`
- Modify: `tests/lightbox-photo.test.ts`
- Modify: `tests/styles.test.ts`
- Modify: `tests/raw-matrix.test.ts`

**Interfaces:**
- Produce un viewport `contain` al 100%, reset su cambio file e rapporto dimensioni del derivato coerente con la fotografia sorgente.

- [ ] Scrivere test fallenti per stile canvas completo, reset file e rapporto d’aspetto RAW entro tolleranza.
- [ ] Confermare i fallimenti mirati.
- [ ] Applicare `width: 100%; height: 100%; object-fit: contain` e consolidare il reset di scala/pan.
- [ ] Verificare matrice RAW e test lightbox.

### Task 4: Rimozione marker chiara e verificata

**Files:**
- Modify: `src/renderer/src/components/TagChip.tsx`
- Modify: `src/renderer/src/components/Inspector.tsx`
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/main/index.ts`
- Create: `tests/label-assignment.test.ts`

**Interfaces:**
- Produce rimozione singola accessibile e azione `Rimuovi tutte`; conserva tag/categorie globali.

- [ ] Scrivere test fallenti per calcolo degli ID residui e rimozione completa.
- [ ] Confermare il fallimento.
- [ ] Implementare helper puro, etichette ARIA specifiche, hit target chiaro e azione totale nell’Inspector.
- [ ] Estendere lo smoke: assegna, rimuove, verifica indice vuoto, riassegna e verifica definizioni globali intatte.

### Task 5: Verifica integrata e aggiornamento bozza

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-github-auto-update-design.md` solo dopo verifica reale.

- [ ] Eseguire test completi, typecheck, build, motori fotografici e packaging ARM64.
- [ ] Eseguire smoke visuale a `900x600`, `1180x720`, `1440x900` e dal DMG.
- [ ] Revisionare screenshot, firma, hash, `latest-mac.yml` e worktree.
- [ ] Integrare su `main`, attendere CI verde e sostituire la bozza `v0.1.0` soltanto dopo conferma del contenuto.
- [ ] Non pubblicare la release senza approvazione esplicita finale.
