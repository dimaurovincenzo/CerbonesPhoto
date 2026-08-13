# CerbonesPhoto Professional Photo Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a CerbonesPhoto una pipeline fotografica asincrona per RAW, metadati EXIF/IPTC/XMP, derivati colore-corretti, zoom progressivo, stati UX e About personalizzato, mantenendo gli originali immutati.

**Architecture:** Lo scanner indicizza rapidamente senza decodificare; una coda nel main process assegna priorità ai file visibili e delega metadati a ExifTool e RAW a un helper LibRaw `arm64`. SQLite conserva stato e metadati normalizzati, mentre miniature e preview sRGB restano in una cache versionata servita da protocolli Electron validati.

**Tech Stack:** Electron 43, Node 24, React 19, TypeScript 7, Zustand 5, node:sqlite, Sharp/libvips, ExifTool vendorizzato, binario ufficiale LibRaw 0.22.2 per macOS arm64, Node test runner, electron-builder.

**Spec:** `docs/superpowers/specs/2026-08-13-professional-photo-workflow-design.md`

## Global Constraints

- Target iniziale: macOS Apple Silicon (`arm64`); deployment target operativo: macOS 12 Monterey o successivo, coerente con Electron 43.
- Originali e sidecar esistenti sono sempre in sola lettura; nessuna scrittura nelle cartelle fotografiche.
- Categorie, tag, preferiti e valutazioni restano nel catalogo SQLite.
- Miniatura: lato lungo massimo 480 px; preview: lato lungo massimo 2.048 px.
- Derivati visuali normalizzati in sRGB; profilo ICC originale rilevato e registrato.
- Nessun path assoluto viene esposto al renderer.
- ExifTool e helper LibRaw sono avviati senza shell, con timeout e limiti di output.
- Concorrenza iniziale: 4 job metadata/I/O e 1 job RAW pesante; valori centralizzati e testabili.
- Cache derivati sotto `app.getPath('userData')/photo-cache`, con chiave `path + size + mtime + pipelineVersion + level`.
- La compatibilità è dichiarata per campione reale di fotocamera/variante, non per sola estensione.
- Copy esatto: `Powered by VDM with love — Cerbone Antonio`.
- Git governance: la cartella corrente non è un repository. Prima di implementare Task 1 serve autorizzazione esplicita a inizializzare Git oppure un repository/worktree valido; i checkpoint `git commit` sotto riportati non vanno eseguiti finché questo prerequisito non è risolto.

---

## File map

### Moduli condivisi

- `src/shared/media-formats.ts`: registro centralizzato formati/MIME/capacità RAW.
- `src/shared/photo-types.ts`: contratti di pipeline, metadati, derivati, progresso ed errori.
- `src/shared/api.ts`: API IPC tipizzata per stato pipeline, retry, pausa e About.

### Main process

- `src/main/scanner.ts`: sola enumerazione asincrona e upsert a batch.
- `src/main/photo/photo-queue.ts`: scheduling, priorità, limiti di concorrenza e cancellazione logica.
- `src/main/photo/metadata-normalizer.ts`: normalizzazione deterministica ExifTool -> `PhotoMetadata`.
- `src/main/photo/exiftool-service.ts`: processo ExifTool persistente, timeout e shutdown.
- `src/main/photo/raw-helper.ts`: adapter sicuro del binario LibRaw.
- `src/main/photo/cache.ts`: chiavi, path, invalidazione e LRU.
- `src/main/photo/derivative-service.ts`: orchestrazione preview incorporata, fallback RAW e Sharp.
- `src/main/photo/photo-pipeline.ts`: coordinamento coda, DB ed eventi aggregati.
- `src/main/ipc/photo.ts`: IPC query/azioni pipeline.
- `src/main/media-protocol.ts`: servizio di thumbnail e preview validate.
- `src/main/db/migrations.ts`, `src/main/db/schema.sql`, `src/main/db/mappers.ts`: persistenza v5.

### Helper nativo

- `scripts/build-raw-helper.sh`: download verificato SHA-256 del binario ufficiale LibRaw e copia in `resources/bin/darwin-arm64`.
- `scripts/verify-photo-engines.mjs`: architettura/versione/hash/health check.

### Renderer

- `src/renderer/src/stores/photo-pipeline.ts`: snapshot progresso e azioni.
- `src/renderer/src/components/PhotoPipelineStatus.tsx`: footer operativo.
- `src/renderer/src/components/MediaCard.tsx`: stati per file.
- `src/renderer/src/components/Lightbox.tsx`: preview progressiva e zoom.
- `src/renderer/src/components/AboutCerbonesPhoto.tsx`: About e easter egg.
- `src/renderer/src/components/AppFooter.tsx`: firma.
- `src/renderer/src/styles/global.css`: layout, contrasto, animazioni e reduced motion.

### Test e fixture

- Test puri sotto `tests/*.test.ts`.
- Fixture generate sotto `tests/fixtures/generated`; non committare fotografie proprietarie.
- Campioni RAW autorizzati sotto `tests/fixtures/raw/<vendor>` con `MANIFEST.json` contenente origine, licenza, camera e SHA-256.

---

### Task 1: Registro formati fotografici e contratti condivisi

**Files:**
- Create: `src/shared/photo-types.ts`
- Create: `tests/photo-formats.test.ts`
- Modify: `src/shared/media-formats.ts`
- Modify: `src/shared/types.ts`

**Interfaces:**
- Produces: `PhotoFormat`, `PhotoProcessingState`, `DerivativeLevel`, `PhotoMetadata`, `PhotoError`, `PhotoPipelineSnapshot`.
- Produces: `photoFormatFromPath(path): PhotoFormat | null`, `isRawPath(path): boolean`.

- [ ] **Step 1: Scrivere il test fallente della matrice formati**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { isRawPath, photoFormatFromPath } from '../src/shared/media-formats.ts'

test('classifica formati standard e RAW professionali', () => {
  for (const ext of ['jpg', 'png', 'tif', 'heic', 'webp', 'avif', 'bmp']) {
    assert.equal(photoFormatFromPath(`foto.${ext}`)?.family, 'standard')
  }
  for (const ext of ['cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'dng', 'pef', '3fr', 'iiq']) {
    assert.equal(isRawPath(`foto.${ext}`), true, ext)
    assert.equal(photoFormatFromPath(`foto.${ext}`)?.family, 'raw')
  }
  assert.equal(photoFormatFromPath('senza-estensione'), null)
})
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/photo-formats.test.ts`  
Expected: FAIL perché `photoFormatFromPath` e `isRawPath` non esistono.

- [ ] **Step 3: Implementare tipi e registro immutabile**

Definire in `photo-types.ts`:

```ts
export type PhotoProcessingState = 'pending' | 'processing' | 'ready' | 'partial' | 'failed'
export type DerivativeLevel = 'thumbnail' | 'preview' | 'high-resolution'
export interface PhotoFormat {
  extension: string
  mime: string
  family: 'standard' | 'raw'
  vendor: string | null
}
export interface PhotoError {
  code: 'FILE_MISSING' | 'PERMISSION_DENIED' | 'METADATA_INVALID' | 'RAW_UNSUPPORTED' |
    'PREVIEW_CORRUPT' | 'ENGINE_TIMEOUT' | 'CACHE_UNWRITABLE' | 'RESOURCE_LIMIT'
  phase: 'scan' | 'metadata' | 'thumbnail' | 'preview' | 'high-resolution'
  message: string
  retryable: boolean
}
export interface PhotoMetadata {
  cameraMake: string | null
  cameraModel: string | null
  lens: string | null
  capturedAt: string | null
  width: number | null
  height: number | null
  orientation: number | null
  iso: number | null
  aperture: number | null
  exposureSeconds: number | null
  focalLengthMm: number | null
  colorProfile: string | null
  keywords: string[]
}
export interface DerivativeRecord {
  fileId: number
  level: DerivativeLevel
  path: string
  mime: 'image/webp' | 'image/jpeg'
  width: number
  height: number
  sizeBytes: number
  cacheKey: string
}
export interface PhotoEngineHealth {
  name: 'exiftool' | 'libraw' | 'sharp'
  available: boolean
  version: string | null
  architecture: string | null
  errorCode: string | null
}
export interface PhotoPipelineSnapshot {
  pending: number
  processing: number
  ready: number
  partial: number
  failed: number
  paused: boolean
}
```

Integrare le nuove estensioni in `classifyMediaPath` senza cambiare audio/video.

- [ ] **Step 4: Eseguire test e typecheck**

Run: `npm test && npm run typecheck`  
Expected: tutti i test PASS; RAW classificati come `image`.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/shared/photo-types.ts src/shared/media-formats.ts src/shared/types.ts tests/photo-formats.test.ts
git commit -m "feat: add professional photo format registry"
```

---

### Task 2: Schema SQLite v5 e backup catalogo

**Files:**
- Create: `tests/photo-migration.test.ts`
- Modify: `src/main/db/schema.sql`
- Modify: `src/main/db/migrations.ts`
- Modify: `src/main/db/mappers.ts`
- Modify: `src/shared/types.ts`

**Interfaces:**
- Consumes: `PhotoProcessingState`, `DerivativeLevel`.
- Produces: `CURRENT_VERSION = 5`, tabella `file_derivatives`, campi fotografia in `MediaFile`.

- [ ] **Step 1: Scrivere il test fallente della migrazione conservativa**

Il test crea un DB v4 con una cartella, un file e un tag, esegue `runMigrations`, poi verifica:

```ts
assert.equal(db.prepare('PRAGMA user_version').get().user_version, 5)
assert.equal(db.prepare('SELECT COUNT(*) count FROM file_tags').get().count, 1)
assert.deepEqual(
  db.prepare('SELECT processing_state, is_raw FROM files').get(),
  { processing_state: 'pending', is_raw: 0 }
)
assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='file_derivatives'").get().name, 'file_derivatives')
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/photo-migration.test.ts`  
Expected: FAIL con versione 4 o colonna mancante.

- [ ] **Step 3: Implementare la migrazione v5 atomica**

Aggiungere colonne `processing_state`, `photo_format`, `is_raw`, `camera_make`, `camera_model`, `captured_at`, `orientation`, `color_profile`, `pipeline_version`, `processing_error_code`, `processing_error_message`, `last_processed_at`; creare `file_derivatives` con UNIQUE `(file_id, level)` e indici su stato, data scatto e camera.

Prima di migrare un DB persistente, creare una sola copia `catalog.pre-v5.sqlite` accanto al DB usando `VACUUM INTO` con path parametrizzato validato. La migrazione termina con `foreign_key_check` prima del commit logico della versione.

- [ ] **Step 4: Aggiornare mapper e test completi**

Run: `npm test && npm run typecheck`  
Expected: PASS, relazioni esistenti preservate.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/db src/shared/types.ts tests/photo-migration.test.ts
git commit -m "feat: persist photo processing state and derivatives"
```

---

### Task 3: Scanner asincrono incrementale

**Files:**
- Create: `src/main/scanner-batch.ts`
- Create: `tests/scanner-batch.test.ts`
- Modify: `src/main/scanner.ts`
- Modify: `tests/scanner.test.ts`

**Interfaces:**
- Produces: `walkMedia(rootPath, options): AsyncGenerator<ScannedEntryBatch>`.
- Produces: `scanRoot(rootId, db, callbacks?): Promise<Folder[]>` con callback opzionale `onBatch`.

- [ ] **Step 1: Scrivere il test fallente di resa all'event loop**

Generare 1.000 file vuoti con estensioni miste e avviare un heartbeat `setInterval(0)`. Consumare `walkMedia` e verificare almeno due batch e heartbeat maggiore di zero prima del completamento.

```ts
assert.ok(batches.length >= 2)
assert.equal(entries.filter((entry) => entry.kind === 'image').length, 1000)
assert.ok(heartbeat > 0, 'lo scanner deve cedere il controllo all event loop')
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/scanner-batch.test.ts`  
Expected: FAIL per modulo mancante.

- [ ] **Step 3: Implementare enumerazione asincrona a batch**

Usare `fs.promises.opendir`, `Dirent`, batch massimo 200 e `await setImmediate()` fra batch. Non usare `readdirSync` o `statSync`. Conservare blacklist e skip dei dotfile. Gli upsert SQLite avvengono in transazioni per singolo batch e la pulizia dei file rimossi avviene solo dopo scansione completa e leggibile della cartella.

- [ ] **Step 4: Eseguire scanner test e suite completa**

Run: `node --experimental-strip-types --test tests/scanner.test.ts tests/scanner-batch.test.ts && npm run typecheck`  
Expected: PASS e comportamento precedente preservato.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/scanner.ts src/main/scanner-batch.ts tests/scanner*.test.ts
git commit -m "perf: make media scanning incremental"
```

---

### Task 4: Coda fotografica prioritaria e limitata

**Files:**
- Create: `src/main/photo/photo-queue.ts`
- Create: `tests/photo-queue.test.ts`

**Interfaces:**
- Consumes: `DerivativeLevel`, `PhotoError`.
- Produces: `PhotoQueue.enqueue(job)`, `promote(fileIds)`, `pause()`, `resume()`, `snapshot()`, `shutdown()`.
- Job contract: `{ id, fileId, kind, priority, resource: 'io' | 'raw', run(signal): Promise<void> }`.

- [ ] **Step 1: Scrivere test fallenti per priorità, concorrenza e pausa**

```ts
const queue = new PhotoQueue({ ioConcurrency: 2, rawConcurrency: 1 })
// Accodare due RAW bloccanti e verificare maxRunningRaw === 1.
// Promuovere fileId 9 e verificare che parta prima dei pending normali.
// Chiamare pause e verificare che nessun nuovo job inizi fino a resume.
assert.equal(maxRunningRaw, 1)
assert.equal(startOrder[1], 9)
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/photo-queue.test.ts`  
Expected: FAIL per classe mancante.

- [ ] **Step 3: Implementare scheduler idempotente**

Usare due contatori di risorse, ordinamento stabile `priority DESC, sequence ASC`, deduplica per job ID e `AbortController` per shutdown. `pause` non interrompe job già avviati. `snapshot` restituisce soli conteggi aggregati.

- [ ] **Step 4: Eseguire test e rilevamento handle aperti**

Run: `node --experimental-strip-types --test tests/photo-queue.test.ts && npm run typecheck:node`  
Expected: PASS; processo termina senza timer o promise pendenti.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/photo/photo-queue.ts tests/photo-queue.test.ts
git commit -m "feat: add bounded priority photo queue"
```

---

### Task 5: Adapter ExifTool e normalizzazione metadata

**Files:**
- Create: `src/main/photo/exiftool-service.ts`
- Create: `src/main/photo/metadata-normalizer.ts`
- Create: `tests/metadata-normalizer.test.ts`
- Create: `tests/exiftool-service.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `ExifToolService.read(path, signal): Promise<Record<string, unknown>>`, `health(): Promise<PhotoEngineHealth>`, `close(): Promise<void>`.
- Produces: `normalizePhotoMetadata(tags): PhotoMetadata`.

- [ ] **Step 1: Scrivere il test fallente di normalizzazione**

Usare un payload con tag duplicati qualificati per gruppo e verificare:

```ts
assert.deepEqual(normalizePhotoMetadata(tags), {
  cameraMake: 'Canon', cameraModel: 'EOS R5', lens: 'RF24-70mm F2.8 L IS USM',
  capturedAt: '2026-08-13T18:42:10+02:00', width: 8192, height: 5464,
  orientation: 6, iso: 400, aperture: 2.8, exposureSeconds: 0.004,
  focalLengthMm: 50, colorProfile: 'Display P3', keywords: ['famiglia', 'mare']
})
```

- [ ] **Step 2: Installare dipendenza fissata e verificare il test rosso**

Run: `npm install --save-exact exiftool-vendored@37.2.0`  
Expected: `package.json` contiene esattamente `37.2.0` e il lockfile risolve la stessa versione.  
Run: `node --experimental-strip-types --test tests/metadata-normalizer.test.ts`  
Expected: FAIL per normalizzatore mancante.

- [ ] **Step 3: Implementare servizio read-only e normalizzatore**

Configurare un solo processo persistente, timeout 15 secondi, massimo una richiesta per processo e argomenti esclusivamente di lettura. Vietare ogni metodo di scrittura nell'interfaccia. Limitare il JSON tecnico serializzato a 1 MiB e troncare i messaggi diagnostici a 1.024 caratteri.

- [ ] **Step 4: Verificare JPEG generato e shutdown**

Creare in test un JPEG con orientamento EXIF usando Sharp, leggere i metadati, chiamare `close`, quindi eseguire:

Run: `node --experimental-strip-types --test tests/metadata-normalizer.test.ts tests/exiftool-service.test.ts && npm run typecheck`  
Expected: PASS e nessun processo figlio residuo.

- [ ] **Step 5: Checkpoint Git**

```bash
git add package.json package-lock.json src/main/photo tests/metadata-normalizer.test.ts tests/exiftool-service.test.ts
git commit -m "feat: read and normalize professional photo metadata"
```

---

### Task 6: Helper LibRaw Apple Silicon

**Files:**
- Create: `native/raw-helper/CMakeLists.txt`
- Create: `native/raw-helper/src/main.cpp`
- Create: `native/raw-helper/tests/cli-contract.test.sh`
- Create: `scripts/build-raw-helper.sh`
- Create: `src/main/photo/raw-helper.ts`
- Create: `tests/raw-helper.test.ts`

**Interfaces:**
- Native CLI: `cerbones-raw-helper probe --input PATH` -> JSON su stdout.
- Native CLI: `cerbones-raw-helper extract-preview --input PATH --output PATH`.
- Native CLI: `cerbones-raw-helper render --input PATH --output PATH --color-space srgb`.
- TypeScript: `RawHelper.probe`, `extractPreview`, `render`, `health`.

- [ ] **Step 1: Scrivere il test fallente del wrapper senza shell**

Iniettare un fake executable che registra `argv`; passare un path contenente spazi, apostrofo e punto e virgola. Verificare che rimanga un singolo argomento e che timeout/exit non zero diventino `PhotoError`.

```ts
assert.deepEqual(observedArgv.slice(-2), ['--input', weirdPath])
assert.equal(error.code, 'ENGINE_TIMEOUT')
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/raw-helper.test.ts`  
Expected: FAIL per wrapper mancante.

- [ ] **Step 3: Implementare CLI C++20 e build fissata**

Fissare LibRaw 0.22 nel CMake. `probe` apre il file e restituisce versione helper, versione LibRaw, make/model, raw dimensions e lista preview. `extract-preview` usa la preview incorporata selezionata più grande. `render` usa bilanciamento camera, highlight clipping predefinito e output TIFF sRGB a 16 bit. Tutti gli errori vanno su stderr con codice stabile; stdout resta JSON o vuoto.

- [ ] **Step 4: Compilare e verificare architettura/contratto**

Run: `bash scripts/build-raw-helper.sh`  
Run: `file resources/bin/darwin-arm64/cerbones-raw-helper`  
Expected: `Mach-O 64-bit executable arm64`.  
Run: `bash native/raw-helper/tests/cli-contract.test.sh && node --experimental-strip-types --test tests/raw-helper.test.ts`  
Expected: PASS.

- [ ] **Step 5: Checkpoint Git**

```bash
git add native/raw-helper scripts/build-raw-helper.sh src/main/photo/raw-helper.ts tests/raw-helper.test.ts resources/bin/darwin-arm64
git commit -m "feat: add arm64 LibRaw helper"
```

---

### Task 7: Cache versionata e servizio derivati

**Files:**
- Create: `src/main/photo/cache.ts`
- Create: `src/main/photo/derivative-service.ts`
- Create: `tests/photo-cache.test.ts`
- Create: `tests/derivative-service.test.ts`
- Modify: `src/main/thumbnails.ts`

**Interfaces:**
- Produces: `photoCacheKey(input): string`, `PhotoCache.pathFor(key, level, ext)`, `prune(maxBytes)`.
- Produces: `DerivativeService.ensure(file, level, signal): Promise<DerivativeRecord>`.

- [ ] **Step 1: Scrivere test fallenti per chiave e originali immutati**

```ts
assert.notEqual(photoCacheKey({ ...base, mtimeMs: 2 }), photoCacheKey({ ...base, mtimeMs: 1 }))
assert.notEqual(photoCacheKey({ ...base, pipelineVersion: 2 }), photoCacheKey({ ...base, pipelineVersion: 1 }))
assert.equal(await sha256(source), sourceHashBefore)
assert.equal(result.width <= 480 && result.height <= 480, true)
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/photo-cache.test.ts tests/derivative-service.test.ts`  
Expected: FAIL per moduli mancanti.

- [ ] **Step 3: Implementare pipeline standard e RAW**

Standard: `sharp(path, { limitInputPixels: true }).autoOrient().resize(...).withIccProfile('srgb')`. RAW: `extractPreview`; se non disponibile, `render` in file temporaneo sotto cache; quindi Sharp genera WebP. Scrivere sempre su file `.partial-<pid>` e rinominare atomicamente. Non sovrascrivere una cache valida.

- [ ] **Step 4: Implementare LRU e test completo**

Aggiornare `last_accessed_at` senza scrittura per ogni richiesta: coalescere al massimo una volta al minuto per derivato. `prune` elimina solo record/file cache, mai originali.

Run: `node --experimental-strip-types --test tests/photo-cache.test.ts tests/derivative-service.test.ts && npm run typecheck:node`  
Expected: PASS.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/photo src/main/thumbnails.ts tests/photo-cache.test.ts tests/derivative-service.test.ts
git commit -m "feat: generate color managed photo derivatives"
```

---

### Task 8: Coordinatore pipeline, DB ed eventi IPC

**Files:**
- Create: `src/main/photo/photo-pipeline.ts`
- Create: `src/main/ipc/photo.ts`
- Create: `tests/photo-pipeline.test.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/ipc/files.ts`
- Modify: `src/shared/api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- API: `photo.snapshot()`, `photo.pause()`, `photo.resume()`, `photo.retry(fileId)`, `photo.promoteVisible(fileIds)`, `photo.engines()`.
- Event: `photo:onSnapshot(callback): unsubscribe` aggregato ogni 100 ms massimo.

- [ ] **Step 1: Scrivere test fallente di isolamento errori**

Accodare tre file con adapter fake: il secondo fallisce `RAW_UNSUPPORTED`. Verificare file 1 e 3 `ready`, file 2 `failed`, snapshot `failed = 1`, coda ancora attiva.

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/photo-pipeline.test.ts`  
Expected: FAIL per pipeline mancante.

- [ ] **Step 3: Implementare orchestrazione e transizioni**

Transizioni ammesse: `pending -> processing -> ready|partial|failed`; `failed|partial -> pending` solo via retry o cambio versione pipeline. Salvare errori stabili, non stack trace, nel DB. Chiudere queue ed ExifTool in `before-quit`.

- [ ] **Step 4: Collegare API/preload e verificare cleanup**

Run: `node --experimental-strip-types --test tests/photo-pipeline.test.ts && npm run typecheck`  
Expected: PASS e contratti renderer/main allineati.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/photo src/main/ipc src/shared/api.ts src/preload src/main/index.ts tests/photo-pipeline.test.ts
git commit -m "feat: coordinate photo processing over typed IPC"
```

---

### Task 9: Protocolli thumbnail/preview e fallback

**Files:**
- Create: `tests/media-protocol-photo.test.ts`
- Modify: `src/main/media-protocol.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Produces: `preview://file/<id>?level=preview|high-resolution`.
- Consumes: `DerivativeService.ensure` e record DB validati.

- [ ] **Step 1: Scrivere smoke Chromium fallente**

Nel BrowserWindow invisibile, richiedere thumbnail standard, thumbnail RAW fake, preview, ID inesistente e livello invalido. Asserire status/MIME e assenza del path assoluto negli header/body di errore.

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/media-protocol-photo.test.ts`  
Expected: FAIL perché `preview:` non è registrato.

- [ ] **Step 3: Registrare schema e handler validati**

Accettare solo ID interi positivi e livelli enumerati. Non servire RAW tramite `media:`. Restituire 202 con `Retry-After: 1` durante elaborazione, 415 per RAW definitivamente non supportato, 404 per ID assente e 200 per derivato pronto.

- [ ] **Step 4: Eseguire smoke e suite main**

Run: `node --experimental-strip-types --test tests/media-protocol-photo.test.ts && npm run typecheck:node`  
Expected: PASS per 200/202/404/415 e contenuto sRGB.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/media-protocol.ts src/main/index.ts tests/media-protocol-photo.test.ts
git commit -m "feat: serve validated progressive photo previews"
```

---

### Task 10: Stati UX e controllo della coda

**Files:**
- Create: `src/renderer/src/stores/photo-pipeline.ts`
- Create: `src/renderer/src/components/PhotoPipelineStatus.tsx`
- Create: `src/renderer/src/components/AppFooter.tsx`
- Create: `tests/photo-pipeline-store.test.ts`
- Modify: `src/renderer/src/components/MediaCard.tsx`
- Modify: `src/renderer/src/components/MediaGrid.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/global.css`

**Interfaces:**
- Consumes: API `photo.*` e snapshot evento.
- Produces: store con `snapshot`, `pause`, `resume`, `retry`, `promoteVisible`.

- [ ] **Step 1: Scrivere test fallente dello store**

Verificare unsubscribe, deduplica snapshot uguale e mapping azioni. Lo stato iniziale deve essere referenzialmente stabile per evitare loop Zustand.

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/photo-pipeline-store.test.ts`  
Expected: FAIL per store mancante.

- [ ] **Step 3: Implementare stato e card accessibili**

Usare testo + icona, non solo colore. `MediaCard` espone `aria-busy`, `role=status` per aggiornamenti e pulsante `Riprova anteprima` solo per `failed/partial`. `IntersectionObserver` invia gli ID visibili con debounce 150 ms.

- [ ] **Step 4: Implementare footer operativo e verificare CSS**

Il footer include progresso, pausa/riprendi e firma esatta. A 900x600 resta su una riga compatta o va a due righe senza overlay.

Run: `npm test && npm run typecheck:web && npm run build`  
Expected: PASS.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/renderer/src tests/photo-pipeline-store.test.ts
git commit -m "feat: expose photo processing status in the UI"
```

---

### Task 11: Lightbox con preview progressiva e zoom

**Files:**
- Create: `src/renderer/src/components/ZoomablePhoto.tsx`
- Create: `tests/lightbox-photo.test.ts`
- Modify: `src/renderer/src/components/Lightbox.tsx`
- Modify: `src/renderer/src/stores/lightbox.ts`
- Modify: `src/renderer/src/styles/global.css`

**Interfaces:**
- Produces: `ZoomablePhoto({ file, onOpenExternal })`.
- Consumes: `thumb:`, `preview:?level=preview`, `preview:?level=high-resolution`.

- [ ] **Step 1: Scrivere test fallente della macchina di stato zoom**

Estrarre una funzione pura `nextPhotoSource(state, event)` e verificare thumbnail -> preview -> high-resolution, retry 202 e fallback 415.

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/lightbox-photo.test.ts`  
Expected: FAIL per funzione mancante.

- [ ] **Step 3: Implementare visualizzazione progressiva**

Mantenere la sorgente precedente finché la successiva non è decodificata con `img.decode()`. Zoom da 1x a 8x, doppio click 1x/2x, rotella con modificatore e pan limitato ai bordi. Richiedere high-resolution sopra 2x.

- [ ] **Step 4: Aggiungere accessibilità e fallback**

Scorciatoie `+`, `-`, `0`, frecce ed Escape; controlli con label; reduced motion senza interpolazione. Su 415 mostrare `Anteprima non disponibile`, `Riprova anteprima`, `Apri nel sistema`.

Run: `node --experimental-strip-types --test tests/lightbox-photo.test.ts && npm run typecheck:web && npm run build`  
Expected: PASS.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/renderer/src/components/ZoomablePhoto.tsx src/renderer/src/components/Lightbox.tsx src/renderer/src/stores/lightbox.ts src/renderer/src/styles/global.css tests/lightbox-photo.test.ts
git commit -m "feat: add progressive photo zoom"
```

---

### Task 12: About CerbonesPhoto ed easter egg ironici

**Files:**
- Create: `src/renderer/src/components/AboutCerbonesPhoto.tsx`
- Create: `src/renderer/src/stores/about.ts`
- Create: `tests/about-easter-eggs.test.ts`
- Modify: `src/main/menu.ts`
- Modify: `src/shared/api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/global.css`

**Interfaces:**
- Produces: menu action `show-about`, store `recordLensActivation`, `activateVersion(event)`, `recordAboutKey(key)`.
- Consumes: `photo.engines()` per stato motori.

- [ ] **Step 1: Scrivere test fallenti delle tre sequenze**

```ts
assert.equal(fiveLensActivations.effect, 'shutter')
assert.equal(optionVersion.effect, 'version-joke')
assert.equal(typeSequence('CERBONE').effect, 'polaroid')
assert.equal(typeSequence('CERBXONE').effect, null)
```

- [ ] **Step 2: Verificare il fallimento**

Run: `node --experimental-strip-types --test tests/about-easter-eggs.test.ts`  
Expected: FAIL per store mancante.

- [ ] **Step 3: Implementare About e copy approvato**

Mostrare icona, versione, firma e health dei tre motori. Gestire la sequenza solo con dialog aperto e focus attivo. Inserire esattamente i tre messaggi approvati nella spec.

- [ ] **Step 4: Implementare animazioni e reduced motion**

Otturatore massimo 320 ms, Polaroid massimo 500 ms; con reduced motion usare dissolvenza 120 ms. Nessun suono e nessuna persistenza.

Run: `node --experimental-strip-types --test tests/about-easter-eggs.test.ts && npm run typecheck:web && npm run build`  
Expected: PASS.

- [ ] **Step 5: Checkpoint Git**

```bash
git add src/main/menu.ts src/shared/api.ts src/preload/index.ts src/renderer/src tests/about-easter-eggs.test.ts
git commit -m "feat: add personalized About and easter eggs"
```

---

### Task 13: Packaging arm64 e verifica motori

**Files:**
- Create: `scripts/verify-photo-engines.mjs`
- Create: `resources/licenses/ExifTool.txt`
- Create: `resources/licenses/LibRaw-LGPL-2.1.txt`
- Create: `resources/licenses/LibRaw-CDDL-1.0.txt`
- Modify: `electron-builder.yml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run verify:photo-engines`, `npm run build:mac` con risorse arm64 incluse.

- [ ] **Step 1: Scrivere verifier fallente**

Il verifier controlla file eseguibile, `file` contiene `arm64`, health JSON, versione LibRaw `0.22`, versione ExifTool fissata nel lockfile, SHA-256 non vuoto e licenze presenti.

- [ ] **Step 2: Verificare il fallimento prima del packaging**

Run: `node scripts/verify-photo-engines.mjs`  
Expected: FAIL finché risorse/config non sono complete.

- [ ] **Step 3: Configurare extraResources e unpack**

Includere `resources/bin/darwin-arm64`, distribuzione ExifTool e `resources/licenses`. Assicurare che script/binari necessari non restino compressi in ASAR. Aggiungere `minimumSystemVersion: '12.0'` e conservare target solo `arm64`.

- [ ] **Step 4: Costruire e ispezionare il DMG**

Run: `npm run verify:photo-engines && npm run build:mac`  
Run: `codesign --verify --deep --strict dist/mac-arm64/CerbonesPhoto.app`  
Run: `spctl --assess --type execute --verbose dist/mac-arm64/CerbonesPhoto.app || true`  
Expected: build e codesign verification PASS; `spctl` può segnalare non notarizzato finché mancano credenziali Developer ID.

- [ ] **Step 5: Checkpoint Git**

```bash
git add scripts/verify-photo-engines.mjs resources/licenses electron-builder.yml package.json README.md
git commit -m "build: package arm64 photo engines"
```

---

### Task 14: Matrice RAW, carico e QA visuale finale

**Files:**
- Create: `tests/fixtures/raw/MANIFEST.json`
- Create: `tests/raw-matrix.test.ts`
- Create: `tests/photo-load.test.ts`
- Modify: `src/main/index.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: pipeline completa e campioni autorizzati.
- Produces: report `artifacts/photo-qa/raw-matrix.json`, screenshot responsive e metriche carico.

- [ ] **Step 1: Preparare manifest verificabile**

Ogni entry contiene `file`, `sha256`, `vendor`, `cameraModel`, `format`, `sourceUrl`, `license`, `expectedOutcome: ready|partial`. Lo script rifiuta campioni senza licenza o hash.

- [ ] **Step 2: Eseguire matrice RAW inizialmente rossa**

Run: `node --experimental-strip-types --test tests/raw-matrix.test.ts`  
Expected: FAIL per ogni famiglia richiesta senza fixture autorizzata; non mascherare assenze come skip silenziosi.

- [ ] **Step 3: Eseguire flusso completo e immutabilità**

Per JPEG, TIFF, HEIC, CR2, CR3, NEF, ARW, RAF, ORF, RW2, DNG e PEF verificare metadata, orientamento, thumbnail, preview, zoom source e SHA-256 originale invariato. Un formato non decodificabile passa solo se il manifest attende `partial` e il fallback è `RAW_UNSUPPORTED`.

- [ ] **Step 4: Eseguire carico e QA visuale**

Run: `node --experimental-strip-types --test tests/photo-load.test.ts`  
Expected: heartbeat renderer massimo 500 ms; RSS seconda scansione entro 15% della prima dopo 60 secondi idle.  
Run: `CARTELLI_SMOKE=1 npm run dev`  
Expected: verifica automatizzata di tutti i pulsanti, categorie, tag, pausa/riprendi, retry, lightbox, zoom, About ed easter egg; screenshot 900x600, 1180x720 e 1440x900 senza overlay o troncamenti.

- [ ] **Step 5: Verifica finale e checkpoint**

Run: `npm test && npm run typecheck && npm run build && npm run verify:photo-engines && npm run build:mac`  
Expected: tutti i comandi exit 0; DMG `CerbonesPhoto-<version>-arm64.dmg` presente.  
Aggiornare README con matrice realmente passata, distinguendo `ready` da `partial`.

```bash
git add tests README.md src/main/index.ts
git commit -m "test: certify professional photo workflow"
```

---

## Rollback operativo

1. Disattivare la preferenza interna della nuova pipeline.
2. Arrestare e chiudere queue, ExifTool e helper RAW.
3. Conservare il DB v5: le vecchie query ignorano le nuove colonne.
4. Eliminare solo `userData/photo-cache`; non toccare directory indicizzate.
5. Se la migrazione non è completata, ripristinare `catalog.pre-v5.sqlite` con app chiusa e dopo verifica hash/dimensione.
6. Rieseguire ricerca, categorie, tag, audio, video e immagini standard prima di ridistribuire.

## Final review gates

- Nessun test usa o modifica fotografie fuori da directory temporanee/fixture autorizzate.
- Nessuna API renderer accetta un path arbitrario per generare derivati.
- Nessun child process usa `shell: true`.
- Nessuna eccezione di un file interrompe la coda globale.
- Nessuna dichiarazione di supporto RAW supera gli esiti del manifest reale.
- Firma ed easter egg hanno copy esatto.
- Il DMG è `arm64`, firmato localmente e chiaramente distinto da una build notarizzata.
