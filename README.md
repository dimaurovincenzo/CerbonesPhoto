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
npm run verify:photo-engines # verifica binari, versioni, hash e licenze
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

## Workflow fotografico

CerbonesPhoto indicizza i file originali senza modificarli. Metadati, categorie,
tag e stato delle anteprime restano nel catalogo SQLite; miniature e preview
sRGB sono derivati eliminabili nella cache dell'app.

- standard: JPEG/JPG/JPE, PNG, TIFF/TIF, HEIF/HEIC, WebP, BMP, AVIF, GIF e SVG;
- RAW: CR2, CR3, CRW, NEF, NRW, ARW, SR2, SRF, RAF, ORF, ORI, RW2, RWL,
  DNG, PEF, PTX, 3FR, FFF, IIQ, MEF, MRW, X3F, ERF, DCR, KDC e SRW;
- metadati EXIF/IPTC/XMP letti tramite ExifTool persistente;
- preview RAW tramite LibRaw 0.22.2 arm64, con estrazione embedded e fallback render;
- orientamento automatico, conversione sRGB, zoom progressivo fino a 8×.

La compatibilità reale di un RAW dipende anche dal modello di fotocamera e dalla
variante del file: un'estensione riconosciuta non viene dichiarata certificata
senza un campione autorizzato passato nella matrice di test.

## Altri formati multimediali

- audio: MP3, M4A, AAC, WAV, FLAC, OGG/OGA, Opus, AIFF;
- video: MP4, M4V, MOV, WebM, OGV, MKV, AVI, MPEG/MPG, TS/M2TS.

Il contenitore viene sempre indicizzato. La riproduzione dipende dai codec
disponibili in Electron/Chromium; se un codec non è decodificabile, CerbonesPhoto
apre il file nell'app predefinita di macOS.
