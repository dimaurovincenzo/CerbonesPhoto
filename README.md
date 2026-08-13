# CerbonesPhoto

Organizzatore di cartelle multimediale per macOS (Electron + React + TypeScript).

## Sviluppo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build        # compila main/preload/renderer
npm run build:mac    # produce un .dmg in /release (electron-builder)
npm test             # test unitari ricerca/formati/store
npm run smoke        # avvio Electron e verifica automatica del renderer
```

## Architettura

- **Main process** (`src/main`): finestra, DB SQLite, scanner filesystem, thumbnail, protocollo media, IPC
- **Preload** (`src/preload`): API sicura esposta al renderer via `contextBridge`
- **Renderer** (`src/renderer`): UI React

Le cartelle sono gestite come **riferimenti** al filesystem (nessuna copia).
Le etichette sono ibride: **categorie gerarchiche** + **tag piatti colorati**.

## Ricerca bilingue

La ricerca globale lavora offline sui nomi già indicizzati di cartelle e file.
I termini italiani e inglesi più comuni sono equivalenti: per esempio `mare`
trova anche file con `sea` nel nome. Nessun nome o percorso lascia il Mac.

## Formati multimediali

- immagini: JPEG, PNG, GIF, WebP, BMP, TIFF, HEIC/HEIF, AVIF, SVG;
- audio: MP3, M4A, AAC, WAV, FLAC, OGG/OGA, Opus, AIFF;
- video: MP4, M4V, MOV, WebM, OGV, MKV, AVI, MPEG/MPG, TS/M2TS.

Il contenitore viene sempre indicizzato. La riproduzione dipende dai codec
disponibili in Electron/Chromium; se un codec non è decodificabile, CerbonesPhoto
apre il file nell'app predefinita di macOS.
