import { app, shell, BrowserWindow, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { closeDb, getDb, openDb } from './db/connection'
import { runMigrations } from './db/migrations'
import { registerIpc } from './ipc'
import { registerMediaProtocols, registerPrivilegedSchemes } from './media-protocol'
import { setupAppMenu } from './menu'
import { PhotoRuntime } from './photo/photo-runtime'

// Schemi custom vanno registrati PRIMA di app.ready.
registerPrivilegedSchemes()

const smokeUserData = process.env['CARTELLI_SMOKE'] === '1'
  ? mkdtempSync(join(tmpdir(), 'cartelli-smoke-'))
  : null
if (smokeUserData) {
  app.setPath('userData', smokeUserData)
} else {
  // Il rebranding non deve nascondere il database creato dalle versioni Cartelli.
  app.setPath('userData', join(app.getPath('appData'), 'Cartelli'))
}

let photoRuntime: PhotoRuntime | null = null
let shutdownStarted = false

function seedSmokeData(): void {
  const db = getDb()
  const ts = Date.now()
  const mediaDirectory = join(app.getPath('userData'), 'smoke-media')
  mkdirSync(mediaDirectory, { recursive: true })
  const photoPath = join(mediaDirectory, 'Cerbone portrait.svg')
  const videoPath = join(mediaDirectory, 'Summer sea sunset.mov')
  writeFileSync(photoPath, `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff9f0a"/><stop offset="1" stop-color="#1c1c1e"/></linearGradient></defs>
      <rect width="1200" height="800" fill="url(#g)"/><circle cx="600" cy="400" r="230" fill="none" stroke="#fff" stroke-width="36"/>
      <circle cx="600" cy="400" r="82" fill="#fff"/><text x="600" y="735" text-anchor="middle" fill="#fff" font-size="58" font-family="sans-serif">CerbonesPhoto</text>
    </svg>`)
  const root = db.prepare(
    `INSERT INTO folders (path, name, is_root, file_count, created_at, updated_at)
     VALUES (?, ?, 1, 2, ?, ?)`
  ).run(mediaDirectory, 'Smoke media', ts, ts)
  db.prepare(
    `INSERT INTO files (folder_id, path, name, kind, mime, created_at, updated_at)
     VALUES (?, ?, ?, 'video', 'video/quicktime', ?, ?)`
  ).run(root.lastInsertRowid, videoPath, 'Summer sea sunset.mov', ts, ts)
  db.prepare(
    `INSERT INTO files
     (folder_id, path, name, kind, mime, size_bytes, source_mtime_ms, photo_format, is_raw, created_at, updated_at)
     VALUES (?, ?, ?, 'image', 'image/svg+xml', ?, ?, 'svg', 0, ?, ?)`
  ).run(root.lastInsertRowid, photoPath, 'Cerbone portrait.svg', 512, ts, ts, ts)
  const tag = db.prepare(
    `INSERT INTO tags (name, color, sort_order, created_at) VALUES ('Preferiti', '#ff9f0a', 0, ?)`
  ).run(ts)
  const category = db.prepare(
    `INSERT INTO categories (name, color, sort_order, created_at) VALUES ('Viaggi', '#0a84ff', 0, ?)`
  ).run(ts)
  db.prepare('INSERT INTO folder_tags (folder_id, tag_id) VALUES (?, ?)').run(root.lastInsertRowid, tag.lastInsertRowid)
  db.prepare('INSERT INTO folder_categories (folder_id, category_id) VALUES (?, ?)')
    .run(root.lastInsertRowid, category.lastInsertRowid)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // UX macOS: traffic light nativi con inset, content full-width
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    // La superficie opaca mantiene contrasto corretto in entrambi i temi macOS.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f5f5f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Lo stdout può essere chiuso quando l'app viene avviata fuori dal terminale.
  // I log diagnostici non devono mai propagare un errore EIO al processo main.
  const diagnosticLog = (...args: unknown[]): void => {
    try {
      console.log(...args)
    } catch {
      // La diagnostica è best-effort; il runtime dell'app resta prioritario.
    }
  }
  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    diagnosticLog('[renderer]', message)
  })
  mainWindow.webContents.on('preload-error', (_e, path, error) => {
    diagnosticLog('[preload-error]', path, error?.message)
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    diagnosticLog('[did-fail-load]', code, desc, url)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    diagnosticLog('[render-process-gone]', details.reason)
  })

  // I link esterni aprono nel browser di sistema, mai dentro l'app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (process.env['CARTELLI_SMOKE'] === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('cartelli:menu-action', 'show-about')
      void mainWindow.webContents.executeJavaScript(`
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(async () => {
          const waitFor = async (selector, timeout = 3000) => {
            const started = Date.now()
            while (Date.now() - started < timeout) {
              const element = document.querySelector(selector)
              if (element) return element
              await new Promise((done) => setTimeout(done, 30))
            }
            return null
          }
          const italian = await window.cartelli.files.search('mare tramonto')
          const english = await window.cartelli.files.search('sea sunset')
          const [rootFolder] = await window.cartelli.folders.listRoots()
          const [smokeTag] = await window.cartelli.tags.list()
          const smokeTagSecond = await window.cartelli.tags.create({ name: 'Da rivedere', color: '#ff453a' })
          await window.cartelli.tags.update(smokeTagSecond.id, { sortOrder: 0 })
          await window.cartelli.tags.update(smokeTag.id, { sortOrder: 1 })
          const orderedTags = await window.cartelli.tags.list()
          const [smokeCategory] = await window.cartelli.categories.list()
          const smokeCategorySecond = await window.cartelli.categories.create({ name: 'Famiglia', color: '#bf5af2' })
          await window.cartelli.categories.update(smokeCategorySecond.id, { sortOrder: 0 })
          await window.cartelli.categories.update(smokeCategory.id, { sortOrder: 1 })
          const orderedCategories = await window.cartelli.categories.list()
          const smokeSubcategory = await window.cartelli.categories.create({
            name: 'Estate', parentId: smokeCategory.id, color: '#30d158'
          })
          await window.cartelli.folders.setTags(rootFolder.id, [smokeTag.id])
          await window.cartelli.folders.setCategories(rootFolder.id, [smokeCategory.id, smokeSubcategory.id])
          const [assignedTags, assignedCategories] = await Promise.all([
            window.cartelli.folders.getTags(rootFolder.id),
            window.cartelli.folders.getCategories(rootFolder.id)
          ])
          const mediaCard = await waitFor('.media-card')
          const imageCard = await waitFor('.media-card--image')
          imageCard?.querySelector('.media-card__primary')?.click()
          const zoomable = await waitFor('.zoomable-photo')
          const previewStarted = Date.now()
          while (Date.now() - previewStarted < 4000 && !zoomable?.querySelector('img')?.src.startsWith('blob:')) {
            await new Promise((done) => setTimeout(done, 50))
          }
          const progressivePreview = Boolean(zoomable?.querySelector('img')?.src.startsWith('blob:'))
          const zoomIn = zoomable?.querySelector('[aria-label="Aumenta zoom"]')
          zoomIn?.click()
          await new Promise((done) => requestAnimationFrame(() => done()))
          const zoomWorks = zoomable?.querySelector('.zoomable-photo__scale')?.textContent !== '100%'
          const photoLightboxOpened = Boolean(document.querySelector('.lightbox'))
          document.querySelector('.lightbox__close')?.click()

          const filterButtons = [...document.querySelectorAll('.media-filterbar .segmented-control button')]
          const videoFilter = filterButtons.find((button) => button.textContent?.trim() === 'Video')
          videoFilter?.click()
          await new Promise((done) => requestAnimationFrame(() => done()))

          const pausedBefore = await window.cartelli.photo.snapshot()
          await window.cartelli.photo.pause()
          const pausedDuring = await window.cartelli.photo.snapshot()
          await window.cartelli.photo.resume()
          const pausedAfter = await window.cartelli.photo.snapshot()

          const aboutDialog = await waitFor('.about-dialog')
          const aboutLens = aboutDialog?.querySelector('.about-dialog__lens')
          for (let index = 0; index < 5; index++) aboutLens?.click()
          await new Promise((done) => requestAnimationFrame(() => done()))
          const lensJoke = document.body.innerText.includes('Il fotografo sostiene che fosse tutto perfettamente a fuoco.')
          aboutDialog?.querySelector('.about-dialog__version')?.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }))
          await new Promise((done) => requestAnimationFrame(() => done()))
          const versionJoke = document.body.innerText.includes('Versione sviluppata con amore. I bug, invece, sono venuti senza invito.')
          for (const key of 'CERBONE') aboutDialog?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
          await new Promise((done) => requestAnimationFrame(() => done()))
          const polaroidJoke = document.body.innerText.includes('Foto approvata dal cognato. Nessun RAW è stato maltrattato.')
          aboutDialog?.querySelector('.about-dialog__close')?.click()

          const inspectorButton = document.querySelector('[aria-label="Mostra o nascondi informazioni"]')
          inspectorButton?.click()
          await new Promise((done) => requestAnimationFrame(() => done()))
          const inspectorHidden = !document.querySelector('.inspector')
          inspectorButton?.click()

          const sidebarSeparator = document.querySelector('[aria-label="Ridimensiona barra laterale"]')
          const sidebarBefore = document.querySelector('.sidebar')?.getBoundingClientRect().width ?? 0
          sidebarSeparator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
          await new Promise((done) => requestAnimationFrame(() => done()))
          const sidebarAfter = document.querySelector('.sidebar')?.getBoundingClientRect().width ?? 0

          const labelsTabs = [...document.querySelectorAll('[role="tab"]')]
          labelsTabs.forEach((tab) => tab.dispatchEvent(new MouseEvent('click', { bubbles: true })))

          resolve({
            shell: Boolean(document.querySelector('.app-shell')),
            fatal: Boolean(document.querySelector('.fatal-state')),
            title: document.title,
            bilingual: italian.length === 1 && english.length === 1 && italian[0].id === english[0].id,
            filters: filterButtons.length === 4 && videoFilter?.classList.contains('is-selected'),
            lightboxOpened: photoLightboxOpened,
            zoomWorks,
            progressivePreview,
            photoControls: !pausedBefore.paused && pausedDuring.paused && !pausedAfter.paused,
            about: Boolean(aboutDialog) && lensJoke && versionJoke && polaroidJoke,
            signature: document.body.innerText.includes('Powered by VDM with love — Cerbone Antonio'),
            inspectorHidden,
            noTechnicalPaths: !document.body.innerText.includes('/tmp/cartelli-smoke-media'),
            labels: assignedTags.some((tag) => tag.id === smokeTag.id) &&
              assignedCategories.some((category) => category.id === smokeCategory.id) &&
              assignedCategories.some((category) => category.id === smokeSubcategory.id),
            markerOrder: orderedTags[0]?.id === smokeTagSecond.id &&
              orderedCategories[0]?.id === smokeCategorySecond.id,
            resizable: sidebarAfter > sidebarBefore,
            tabs: labelsTabs.length === 2,
            noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth &&
              document.documentElement.scrollHeight <= window.innerHeight
          })
        })))
      `).then(async (state: {
        shell: boolean; fatal: boolean; title: string; bilingual: boolean; filters: boolean
        lightboxOpened: boolean; zoomWorks: boolean; progressivePreview: boolean; photoControls: boolean; about: boolean; signature: boolean
        inspectorHidden: boolean; noTechnicalPaths: boolean; labels: boolean; markerOrder: boolean
        resizable: boolean; tabs: boolean; noPageOverflow: boolean
      }) => {
        if (!state.shell || state.fatal || !state.bilingual || !state.filters ||
            !state.lightboxOpened || !state.zoomWorks || !state.progressivePreview || !state.photoControls || !state.about || !state.signature ||
            !state.inspectorHidden || !state.noTechnicalPaths ||
            !state.labels || !state.markerOrder || !state.resizable || !state.tabs || !state.noPageOverflow) {
          throw new Error(`Renderer non valido: ${JSON.stringify(state)}`)
        }
        const screenshotPath = process.env['CARTELLI_SCREENSHOT']
        if (screenshotPath) {
          const image = await mainWindow.webContents.capturePage()
          writeFileSync(screenshotPath, image.toPNG())
        }
        const screenshotDirectory = process.env['CARTELLI_SCREENSHOT_DIR']
        if (screenshotDirectory) {
          mkdirSync(screenshotDirectory, { recursive: true })
          for (const [width, height] of [[900, 600], [1180, 720], [1440, 900]]) {
            mainWindow.setSize(width, height)
            await new Promise((done) => setTimeout(done, 120))
            const image = await mainWindow.webContents.capturePage()
            writeFileSync(join(screenshotDirectory, `cerbonesphoto-${width}x${height}.png`), image.toPNG())
          }
          mainWindow.setSize(1180, 720)
          await mainWindow.webContents.executeJavaScript(`
            (() => {
              const photoFilter = [...document.querySelectorAll('.media-filterbar .segmented-control button')]
                .find((button) => button.textContent?.trim() === 'Foto')
              photoFilter?.click()
              return new Promise((resolve) => requestAnimationFrame(() => {
                document.querySelector('.media-card--image .media-card__primary')?.click()
                requestAnimationFrame(() => resolve(true))
              }))
            })()
          `)
          await new Promise((done) => setTimeout(done, 180))
          const lightboxImage = await mainWindow.webContents.capturePage()
          writeFileSync(join(screenshotDirectory, 'cerbonesphoto-lightbox-1180x720.png'), lightboxImage.toPNG())
          await mainWindow.webContents.executeJavaScript(`document.querySelector('.lightbox__close')?.click()`)
          await new Promise((done) => setTimeout(done, 120))

          mainWindow.setSize(900, 600)
          mainWindow.webContents.send('cartelli:menu-action', 'show-about')
          await new Promise((done) => setTimeout(done, 180))
          const aboutImage = await mainWindow.webContents.capturePage()
          writeFileSync(join(screenshotDirectory, 'cerbonesphoto-about-900x600.png'), aboutImage.toPNG())
          await mainWindow.webContents.executeJavaScript(`document.querySelector('.about-dialog__close')?.click()`)
        }
        console.log(`[smoke] READY ${JSON.stringify(state)}`)
        if (process.env['CARTELLI_SMOKE_HOLD'] !== '1') app.quit()
      }).catch((error: unknown) => {
        console.error('[smoke] FAILED', error)
        app.exit(1)
      })
    })
  }
}

app.whenReady().then(() => {
  // 1. Database + schema (prima della UI)
  openDb()
  runMigrations()
  if (smokeUserData) seedSmokeData()
  photoRuntime = new PhotoRuntime({
    db: getDb(),
    userDataPath: app.getPath('userData'),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged
  })
  // 2. Handler IPC (folder/files/tags/categories/settings/dialogs)
  registerIpc(photoRuntime)
  // 3. Protocolli media (thumb://, media://)
  registerMediaProtocols(photoRuntime)
  // 4. Menu applicazione
  setupAppMenu()
  // 5. Finestra
  createWindow()
  photoRuntime.enqueuePending()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[startup-fatal]', error)
  dialog.showErrorBox('CerbonesPhoto non può avviarsi', `${message}\n\nI file originali non sono stati modificati.`)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (!shutdownStarted && photoRuntime) {
    event.preventDefault()
    shutdownStarted = true
    void photoRuntime.shutdown().finally(() => {
      photoRuntime = null
      closeDb()
      if (smokeUserData) rmSync(smokeUserData, { recursive: true, force: true })
      app.quit()
    })
    return
  }
  closeDb()
  if (smokeUserData) rmSync(smokeUserData, { recursive: true, force: true })
})
