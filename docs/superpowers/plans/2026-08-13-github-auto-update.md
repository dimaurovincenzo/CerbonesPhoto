# CerbonesPhoto GitHub Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pubblicare CerbonesPhoto nel repository pubblico `dimaurovincenzo/CerbonesPhoto` e distribuire aggiornamenti macOS `arm64` tramite GitHub Releases con UX nativa, CI verificabile e release provvisorie firmate localmente.

**Architecture:** Un coordinatore puro mantiene la macchina a stati e dipende da una porta iniettabile; un adapter del main process collega la porta a `electron-updater`. IPC tipizzato espone al renderer soltanto stato, controllo e installazione, mentre packaging e pubblicazione restano in script fail-closed separati dal runtime.

**Tech Stack:** Electron 43, TypeScript 7, React 19, Zustand, `electron-updater` 6.8.9, `electron-log` 5.4.4, electron-builder 26.15.3, Node.js 24, GitHub Actions, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-08-13-github-auto-update-design.md`

## Global Constraints

- Repository: `dimaurovincenzo/CerbonesPhoto`, pubblico.
- macOS 12+, solo `arm64`; canale `latest`, SemVer stabile, tag derivato come `v${package.json.version}`.
- Directory dati `Cartelli` e bundle ID `com.cerbonesphoto.app` invariati.
- Nessun token, certificato o segreto nel repository, nei log o nel bundle.
- Build iniziali provvisorie `Apple Development`, non notarizzate.
- Release in bozza finché artefatti e smoke test non sono verificati.
- Updater isolato da SQLite, cache fotografica e originali.

---

### Task 1: Modello tipizzato e coordinatore aggiornamenti

**Files:**
- Create: `src/shared/update-types.ts`
- Create: `src/main/updater/update-coordinator.ts`
- Create: `tests/update-coordinator.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `UpdateStatus`, `UpdateSnapshot`, `UpdateCheckOrigin`, `UpdaterPort`, `UpdateCoordinator`.
- `UpdateCoordinator.snapshot(): UpdateSnapshot`
- `UpdateCoordinator.subscribe(listener): () => void`
- `UpdateCoordinator.check(origin): Promise<UpdateSnapshot>`
- `UpdateCoordinator.install(): boolean`; `dispose(): void`.

- [ ] **Step 1: Installare dipendenze runtime fissate**

```bash
npm install --save-exact electron-updater@6.8.9 electron-log@5.4.4
```

Expected: solo le due nuove dipendenze dirette e lockfile coerente.

- [ ] **Step 2: Scrivere test fallenti della macchina a stati**

Create `tests/update-coordinator.test.ts` con una `FakeUpdaterPort` e questi casi:

```ts
test('impedisce controlli concorrenti e conserva l origine', async () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: true })
  const first = coordinator.check('manual')
  const second = coordinator.check('automatic')
  assert.equal(port.checks, 1)
  port.emitUpToDate()
  assert.equal((await first).status, 'up-to-date')
  assert.equal((await second).origin, 'manual')
})

test('installa soltanto dopo il download', () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: true })
  assert.equal(coordinator.install(), false)
  port.emitDownloaded('0.1.1')
  assert.equal(coordinator.install(), true)
  assert.equal(port.installs, 1)
})

test('limita progresso e sanitizza gli errori', () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: true })
  port.emitProgress(140)
  assert.equal(coordinator.snapshot().percent, 100)
  port.emitError(new Error('GET https://github.com/token /Users/demo/file.zip failed'))
  assert.doesNotMatch(coordinator.snapshot().message ?? '', /https:|\/Users\//)
})
```

- [ ] **Step 3: Verificare il fallimento**

```bash
npm test
```

Expected: FAIL perché i moduli non esistono.

- [ ] **Step 4: Implementare tipi e porta senza dipendenze Electron**

Create `src/shared/update-types.ts`:

```ts
export type UpdateStatus = 'unsupported' | 'idle' | 'checking' | 'available' |
  'downloading' | 'downloaded' | 'up-to-date' | 'error'
export type UpdateCheckOrigin = 'automatic' | 'manual'
export interface UpdateSnapshot {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  percent: number | null
  origin: UpdateCheckOrigin | null
  message: string | null
}
export interface UpdaterPort {
  checkForUpdates: () => Promise<void>
  quitAndInstall: () => void
  onChecking: (cb: () => void) => () => void
  onAvailable: (cb: (version: string) => void) => () => void
  onProgress: (cb: (percent: number) => void) => () => void
  onDownloaded: (cb: (version: string) => void) => () => void
  onUpToDate: (cb: () => void) => () => void
  onError: (cb: (error: Error) => void) => () => void
}
```

Implementare una Promise condivisa durante il controllo, snapshot copiati, unsubscribe idempotente, percentuale limitata 0–100 e messaggio massimo 180 caratteri senza URL/path. `supported: false` non chiama la porta.

- [ ] **Step 5: Verificare e committare**

```bash
npm test
npm run typecheck:node
git add package.json package-lock.json src/shared/update-types.ts src/main/updater/update-coordinator.ts tests/update-coordinator.test.ts
git commit -m "feat: add typed update coordinator"
```

---

### Task 2: Adapter Electron, IPC, lifecycle e menu

**Files:**
- Create: `src/main/updater/electron-update-port.ts`
- Create: `src/main/updater/update-runtime.ts`
- Create: `src/main/ipc/updates.ts`
- Create: `tests/update-runtime.test.ts`
- Create: `tests/update-api.test.ts`
- Modify: `src/shared/api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/menu.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `UpdateRuntime` con `start`, `checkManual`, `install`, `snapshot`, `subscribe`, `dispose`.
- Renderer: `window.cartelli.updates.snapshot/check/install/onSnapshot`.

- [ ] **Step 1: Scrivere test fallenti per timer e API**

In `tests/update-runtime.test.ts`, con clock fake:

```ts
test('controlla dopo 10 secondi e ogni 6 ore', () => {
  const clock = new FakeClock()
  const coordinator = new FakeCoordinator()
  createUpdateRuntime({ coordinator, clock, supported: true }).start()
  clock.advanceBy(9_999)
  assert.equal(coordinator.automaticChecks, 0)
  clock.advanceBy(1)
  assert.equal(coordinator.automaticChecks, 1)
  clock.advanceBy(21_600_000)
  assert.equal(coordinator.automaticChecks, 2)
})
```

Aggiungere il caso `supported: false` con zero timer. In `tests/update-api.test.ts` verificare i canali esatti `updates:snapshot`, `updates:check`, `updates:install`, `updates:snapshot-event` in API/preload.

- [ ] **Step 2: Verificare il fallimento**

```bash
npm test
```

Expected: FAIL per runtime e API mancanti.

- [ ] **Step 3: Implementare adapter e runtime**

Configurazione obbligatoria in `electron-update-port.ts`:

```ts
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false
autoUpdater.logger = log
log.transports.file.maxSize = 1_048_576
```

Ogni `on*` restituisce `removeListener`. Il runtime è supportato solo con:

```ts
app.isPackaged && process.env['CARTELLI_SMOKE'] !== '1' && process.platform === 'darwin'
```

Usare timeout 10.000 ms e intervallo 21.600.000 ms; `dispose()` cancella timer e listener.
Definire i codici stabili `UPDATE_CHECK_FAILED`, `UPDATE_DOWNLOAD_FAILED`, `UPDATE_VERIFY_FAILED` e `UPDATE_INSTALL_FAILED`; il logger registra solo codice, fase e messaggio già sanitizzato, mai URL completi o stack trace.

- [ ] **Step 4: Implementare IPC e preload tipizzati**

In `src/shared/api.ts`:

```ts
export interface UpdatesApi {
  snapshot: () => Promise<UpdateSnapshot>
  check: () => Promise<UpdateSnapshot>
  install: () => Promise<boolean>
  onSnapshot: (callback: (snapshot: UpdateSnapshot) => void) => () => void
}
```

Gli handler inoltrano snapshot a `BrowserWindow.getAllWindows()` non distrutte; nessun feed o URL è accettato dal renderer.

- [ ] **Step 5: Integrare lifecycle, menu e dialog**

Passare `updateRuntime` a `registerIpc` e `setupAppMenu`. Avviare da `ready-to-show`, disporre nello shutdown. Aggiungere `Verifica aggiornamenti…` con ID `check-for-updates`, disabilitato in `checking|available|downloading`.

Alla prima transizione `downloaded` per versione:

```ts
const result = await dialog.showMessageBox({
  type: 'info', title: 'Aggiornamento pronto',
  message: `CerbonesPhoto ${snapshot.availableVersion} è pronto.`,
  detail: 'L’app verrà chiusa e riavviata per completare l’installazione.',
  buttons: ['Installa e riavvia', 'Più tardi'], defaultId: 0, cancelId: 1
})
if (result.response === 0) updateRuntime.install()
```

Nessun dialog automatico per `up-to-date` o `error`.

- [ ] **Step 6: Verificare e committare**

```bash
npm test
npm run typecheck
npm run build
git add src/main/updater src/main/ipc/updates.ts src/main/ipc/index.ts src/main/index.ts src/main/menu.ts src/shared/api.ts src/preload/index.ts tests/update-runtime.test.ts tests/update-api.test.ts
git commit -m "feat: integrate GitHub updater runtime"
```

---

### Task 3: UX aggiornamenti nell'About

**Files:**
- Create: `src/renderer/src/stores/updates.ts`
- Create: `src/renderer/src/components/UpdateStatus.tsx`
- Create: `tests/update-store.test.ts`
- Modify: `src/renderer/src/components/AboutCerbonesPhoto.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/main/index.ts`
- Modify: `tests/styles.test.ts`

**Interfaces:**
- Consumes: `UpdatesApi`, `UpdateSnapshot`.
- Produces: `useUpdatesStore.connect/check/install` e `<UpdateStatus />`.

- [ ] **Step 1: Scrivere test fallenti di presentazione**

```ts
assert.deepEqual(updatePresentation(snapshot('up-to-date')), {
  label: 'CerbonesPhoto è aggiornato', action: 'check', busy: false
})
assert.deepEqual(updatePresentation({ ...snapshot('downloading'), percent: 42 }), {
  label: 'Download 42%', action: null, busy: true
})
assert.deepEqual(updatePresentation({ ...snapshot('downloaded'), availableVersion: '0.1.1' }), {
  label: 'Versione 0.1.1 pronta', action: 'install', busy: false
})
```

Estendere `tests/styles.test.ts` per contrasto 4.5:1 e reduced motion di `.update-status`.

- [ ] **Step 2: Verificare il fallimento**

```bash
npm test
```

- [ ] **Step 3: Implementare store e componente**

`connect()` deve essere idempotente, caricare lo snapshot e restituire unsubscribe. Il componente usa `role="status"`, `aria-live="polite"`, pulsante testuale per check/retry e primario per `Installa e riavvia`; non mostra dettagli tecnici.

- [ ] **Step 4: Integrare About e smoke**

Montare `<UpdateStatus />` sotto la versione, connettere lo store una volta in `App.tsx`. Lo smoke deve trovare `.update-status`, testo `Aggiornamenti non disponibili in questa build` e nessun overflow a 900×600, 1180×720, 1440×900.

- [ ] **Step 5: Verificare e committare**

```bash
npm test
npm run typecheck
tmp_dir=$(mktemp -d)
CARTELLI_SCREENSHOT_DIR="$tmp_dir" npm run smoke
git add src/renderer/src/stores/updates.ts src/renderer/src/components/UpdateStatus.tsx src/renderer/src/components/AboutCerbonesPhoto.tsx src/renderer/src/App.tsx src/renderer/src/styles/global.css src/main/index.ts tests/update-store.test.ts tests/styles.test.ts
git commit -m "feat: add native update experience"
```

---

### Task 4: Packaging aggiornabile, preflight e CI

**Files:**
- Create: `scripts/release-preflight.mjs`
- Create: `scripts/release-github.mjs`
- Create: `tests/release-preflight.test.ts`
- Create: `tests/update-packaging.test.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `electron-builder.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces: `validateReleaseContext(input): string[]` e `npm run release:github`.
- CI pinned SHAs: checkout `11d5960a326750d5838078e36cf38b85af677262`, setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020`, upload-artifact `ea165f8d65b6e75b540449e92b4886f43607fa02`.

- [ ] **Step 1: Scrivere test fallenti**

`tests/update-packaging.test.ts` deve richiedere:

```ts
for (const marker of [
  'provider: github', 'owner: dimaurovincenzo', 'repo: CerbonesPhoto',
  'channel: latest', 'releaseType: draft', "electronUpdaterCompatibility: '>= 2.16'",
  '- target: dmg', '- target: zip'
]) assert.match(builder, new RegExp(escape(marker)))
assert.equal(pkg.name, 'cerbones-photo')
assert.equal(pkg.repository.url, 'https://github.com/dimaurovincenzo/CerbonesPhoto.git')
```

`tests/release-preflight.test.ts` copre branch diverso da `main`, worktree sporca, package/lock discordi, tag esistente, origin errato, piattaforma o architettura errate.
Aggiungere anche un test che scandisce file tracciati e bundle ASAR e fallisce sulle variabili sensibili `GH_TOKEN`, `GITHUB_RELEASE_TOKEN`, `CSC_LINK` o password quando associate a un valore letterale.

- [ ] **Step 2: Verificare il fallimento**

```bash
npm test
```

- [ ] **Step 3: Configurare package ed electron-builder**

In `package.json` impostare `name: cerbones-photo`, repository HTTPS esatto e script `release:github`. In `electron-builder.yml`:

```yaml
electronUpdaterCompatibility: '>= 2.16'
publish:
  provider: github
  owner: dimaurovincenzo
  repo: CerbonesPhoto
  channel: latest
  releaseType: draft
mac:
  artifactName: ${productName}-${version}-${arch}-mac.${ext}
  target:
    - target: dmg
      arch: [arm64]
    - target: zip
      arch: [arm64]
dmg:
  artifactName: ${productName}-${version}-${arch}.${ext}
```

Non cambiare appId, directory dati, minimumSystemVersion, extraResources o asarUnpack.

- [ ] **Step 4: Implementare preflight puro e orchestratore**

`validateReleaseContext` riceve dati e restituisce errori, senza processi. L'orchestratore usa sempre `spawnSync(command, args, { shell: false, stdio: 'inherit' })`, fallisce al primo exit code e non stampa credenziali.

Sequenza:

```text
git status --porcelain
git branch --show-current
git remote get-url origin
version=$(node -p "require('./package.json').version")
tag="v$version"
git ls-remote --tags origin "refs/tags/$tag"
npm test
npm run typecheck
npm run build
npm run verify:photo-engines
npx electron-builder --mac arm64 --publish never
codesign --verify --deep --strict dist/mac-arm64/CerbonesPhoto.app
file dist/mac-arm64/CerbonesPhoto.app/Contents/MacOS/CerbonesPhoto
shasum -a 256 "dist/CerbonesPhoto-$version-arm64.dmg" "dist/CerbonesPhoto-$version-arm64-mac.zip" dist/latest-mac.yml
git push origin main
current_sha=$(git rev-parse HEAD)
gh release create "$tag" --repo dimaurovincenzo/CerbonesPhoto --target "$current_sha" --draft --generate-notes --notes-file dist/release-notes.md --title "CerbonesPhoto $version" "dist/CerbonesPhoto-$version-arm64.dmg" "dist/CerbonesPhoto-$version-arm64-mac.zip" dist/latest-mac.yml
```

Eseguire inoltre `spctl --assess --type execute --verbose=4 dist/mac-arm64/CerbonesPhoto.app` come diagnostica: status 0 viene registrato come accettato, status 3 come rifiuto atteso per build non notarizzata, ogni altro status blocca il flusso. `dist/release-notes.md` deve iniziare con `Build provvisoria non notarizzata` e contenere gli SHA-256 appena calcolati. Se la creazione fallisce, lasciare l'eventuale bozza e terminare con errore; mai promuovere automaticamente.

- [ ] **Step 5: Creare CI a permessi minimi**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    runs-on: macos-14
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '24.19.0'
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run build
      - run: npm run verify:photo-engines
      - run: npx electron-builder --mac arm64 --publish never
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: 'false'
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: unsigned-macos-arm64-diagnostic
          path: |
            dist/*.dmg
            dist/*.zip
            dist/latest-mac.yml
          if-no-files-found: error
          retention-days: 7
```

Nessun `contents: write`, trigger tag o secret nella CI.

- [ ] **Step 6: Documentare e verificare**

README deve spiegare updater, comando release, bozza manuale e limite Apple Development. Poi:

```bash
npm test
npm run typecheck
npm run build
npm run verify:photo-engines
npx electron-builder --mac arm64 --publish never
test -f dist/latest-mac.yml
test -f dist/CerbonesPhoto-0.1.0-arm64.dmg
test -f dist/CerbonesPhoto-0.1.0-arm64-mac.zip
git diff --check
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json electron-builder.yml scripts/release-preflight.mjs scripts/release-github.mjs tests/release-preflight.test.ts tests/update-packaging.test.ts .github/workflows/ci.yml .gitignore README.md
git commit -m "build: prepare GitHub update releases"
```

---

### Task 5: Repository, integrazione e prima release

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-github-auto-update-design.md` (solo stato verificato)
- Modify: `README.md` (badge solo dopo CI reale)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: repository pubblico, origin, main, CI verde e release `v0.1.0` in bozza.

- [ ] **Step 1: Preflight Git e GitHub**

```bash
git status --short --branch
git log --oneline --decorate -n 8
git merge-base main feature/github-auto-update
gh auth status
gh repo view dimaurovincenzo/CerbonesPhoto --json nameWithOwner,visibility,url 2>/dev/null || true
```

Expected: worktree pulita, account corretto e repository assente oppure identità esatta.

- [ ] **Step 2: Verifica completa e fast-forward locale**

```bash
npm test
npm run typecheck
npm run build
npm run verify:photo-engines
npx electron-builder --mac arm64 --publish never
git switch main
git merge --ff-only feature/github-auto-update
```

- [ ] **Step 3: Creare repository pubblico e origin**

Se assente:

```bash
gh repo create dimaurovincenzo/CerbonesPhoto --public --source=. --remote=origin --description "Catalogo fotografico privato per macOS con supporto RAW professionale" --push
```

Se già esistente e confermato:

```bash
git remote add origin https://github.com/dimaurovincenzo/CerbonesPhoto.git
git push -u origin main
```

Verificare visibilità `PUBLIC` e default branch `main`.

- [ ] **Step 4: Attendere CI**

```bash
gh run list --repo dimaurovincenzo/CerbonesPhoto --workflow CI --limit 1
gh run watch --repo dimaurovincenzo/CerbonesPhoto --exit-status
```

Expected: CI verde. In caso contrario usare `superpowers:systematic-debugging` e non creare release.

- [ ] **Step 5: Creare e verificare la bozza v0.1.0**

```bash
npm run release:github
gh release view v0.1.0 --repo dimaurovincenzo/CerbonesPhoto --json isDraft,isPrerelease,tagName,url,assets
release_dir=$(mktemp -d)
gh release download v0.1.0 --repo dimaurovincenzo/CerbonesPhoto --dir "$release_dir"
shasum -a 256 "$release_dir"/*
cmp -s dist/CerbonesPhoto-0.1.0-arm64.dmg "$release_dir/CerbonesPhoto-0.1.0-arm64.dmg"
cmp -s dist/CerbonesPhoto-0.1.0-arm64-mac.zip "$release_dir/CerbonesPhoto-0.1.0-arm64-mac.zip"
codesign --verify --deep --strict dist/mac-arm64/CerbonesPhoto.app
spctl --assess --type execute --verbose=4 dist/mac-arm64/CerbonesPhoto.app || test $? -eq 3
file dist/mac-arm64/CerbonesPhoto.app/Contents/MacOS/CerbonesPhoto
mount_dir=$(mktemp -d)
hdiutil attach "$release_dir/CerbonesPhoto-0.1.0-arm64.dmg" -mountpoint "$mount_dir" -nobrowse
CARTELLI_SMOKE=1 "$mount_dir/CerbonesPhoto.app/Contents/MacOS/CerbonesPhoto"
hdiutil detach "$mount_dir"
```

Expected: bozza, non prerelease, DMG/ZIP/latest-mac presenti, hash identici, app arm64 firmata e smoke del DMG scaricato verde. L'esito Gatekeeper è registrato senza trasformare il limite non notarizzato in un falso successo. Non pubblicare.

- [ ] **Step 6: Approval gate e pubblicazione v0.1.0**

Presentare URL, asset, SHA, CI e limite non notarizzata. Solo dopo conferma esplicita:

```bash
gh release edit v0.1.0 --repo dimaurovincenzo/CerbonesPhoto --draft=false --latest
```

- [ ] **Step 7: Certificare con v0.1.1**

Dopo installazione manuale di v0.1.0:

```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: prepare v0.1.1 updater certification"
git push origin main
npm run release:github
```

Verificare la bozza, chiedere seconda approvazione, pubblicare, poi verificare rilevamento, download, riavvio, versione 0.1.1, SQLite invariato e originali invariati.

- [ ] **Step 8: Stato documentale finale**

Segnare `implementato e certificato tra v0.1.0 e v0.1.1` solo se la prova reale passa; altrimenti registrare il limite preciso.

```bash
git add docs/superpowers/specs/2026-08-13-github-auto-update-design.md README.md
git commit -m "docs: record GitHub updater verification"
git push origin main
```

---

## Verifica finale

```bash
git status --short --branch
npm test
npm run typecheck
npm run build
npm run verify:photo-engines
git ls-remote --heads --tags origin
gh repo view dimaurovincenzo/CerbonesPhoto --json nameWithOwner,visibility,url,defaultBranchRef
gh run list --repo dimaurovincenzo/CerbonesPhoto --workflow CI --limit 3
gh release list --repo dimaurovincenzo/CerbonesPhoto
```

Completamento significa repository pubblico, CI, artefatti, release e aggiornamento reale verificati separatamente. Una bozza o una build non notarizzata non è distribuzione Apple certificata.
