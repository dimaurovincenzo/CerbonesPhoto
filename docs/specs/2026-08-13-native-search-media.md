# CerbonesPhoto: avvio affidabile, ricerca bilingue e media

## Obiettivo

Rendere CerbonesPhoto affidabile all'avvio e coerente con le convenzioni macOS, con ricerca globale offline italiano/inglese e anteprima dei principali formati immagine, audio e video.

## Vincoli

- Nessun servizio cloud: nomi, percorsi e query restano sul Mac.
- Nessun accesso diretto al filesystem dal renderer.
- Nessuna copia dei file: SQLite conserva solo metadati e percorsi.
- Nessun FFmpeg incluso: Electron/Chromium riproduce i codec supportati; gli altri file si aprono nell'app predefinita di macOS.
- Le migrazioni SQLite devono preservare cartelle, file e associazioni esistenti.

## Avvio e resilienza

Il crash iniziale deriva da un selettore Zustand che restituisce un nuovo array vuoto a ogni snapshot. Il selettore userà una costante stabile. Un Error Boundary renderà un errore recuperabile con comando di ricarica, evitando finestre vuote per futuri errori renderer.

## Ricerca bilingue

La ricerca è globale e comprende nomi di cartelle e file indicizzati. La query viene normalizzata rimuovendo differenze di maiuscole, diacritici e punteggiatura, poi espansa tramite un lessico bidirezionale italiano/inglese focalizzato sui nomi comuni dei contenuti multimediali. Per esempio `mare` e `sea` producono gli stessi termini di ricerca.

I risultati sono ordinati privilegiando corrispondenza esatta, prefisso e infine contenimento. La ricerca è limitata a 200 risultati per proteggere UI e IPC.

## Formati

- Immagini: JPEG, PNG, GIF, WebP, BMP, TIFF, HEIC/HEIF, AVIF, SVG.
- Audio: MP3, M4A, AAC, WAV, FLAC, OGG/OGA, Opus, AIFF.
- Video: MP4, M4V, MOV, WebM, OGV, MKV, AVI, MPEG/MPG, TS/M2TS.

La presenza nell'indice non garantisce la decodifica del codec. Quando Electron non può mostrare o riprodurre un file, l'utente può aprirlo nell'app macOS associata.

## UX macOS

- Toolbar compatta con ricerca globale e scorciatoia Cmd+F.
- Sidebar Finder-like per cartelle, tag e categorie.
- Risultati globali nel pannello centrale, raggruppati per tipo.
- Quick Look per immagini e video, player persistente per audio.
- Modalità chiara/scura tramite `prefers-color-scheme`.
- Stati di caricamento, vuoto ed errore sempre espliciti.

## Sicurezza e operatività

I protocolli `media://` e `thumb://` risolvono solo ID presenti nel database. Anche l'apertura esterna riceve un ID, risolve il percorso nel main process e usa `shell.openPath`; il renderer non invia percorsi arbitrari.

## Validazione

- Test unitari del selettore stabile, normalizzazione/espansione bilingue e classificazione formati.
- Test della ricerca e dei limiti sull'IPC con database locale.
- Typecheck e build completi.
- Smoke test Electron reale con controllo degli errori renderer e dell'albero DOM.
