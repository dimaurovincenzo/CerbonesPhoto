import { app, shell, BrowserWindow, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  const root = db.prepare(
    `INSERT INTO folders (path, name, is_root, file_count, created_at, updated_at)
     VALUES (?, ?, 1, 1, ?, ?)`
  ).run('/tmp/cartelli-smoke-media', 'Smoke media', ts, ts)
  db.prepare(
    `INSERT INTO files (folder_id, path, name, kind, mime, created_at, updated_at)
     VALUES (?, ?, ?, 'video', 'video/quicktime', ?, ?)`
  ).run(root.lastInsertRowid, '/tmp/cartelli-smoke-media/Summer sea sunset.mov', 'Summer sea sunset.mov', ts, ts)
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
          const filterButtons = [...document.querySelectorAll('.media-filterbar .segmented-control button')]
          const videoFilter = filterButtons.find((button) => button.textContent?.trim() === 'Video')
          videoFilter?.click()
          await new Promise((done) => requestAnimationFrame(() => done()))
          mediaCard?.click()
          await new Promise((done) => requestAnimationFrame(() => done()))
          const lightboxOpened = Boolean(document.querySelector('.lightbox'))
          document.querySelector('.lightbox__close')?.click()

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
            lightboxOpened,
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
        lightboxOpened: boolean; inspectorHidden: boolean; noTechnicalPaths: boolean
        labels: boolean; markerOrder: boolean; resizable: boolean; tabs: boolean; noPageOverflow: boolean
      }) => {
        if (!state.shell || state.fatal || !state.bilingual || !state.filters ||
            !state.lightboxOpened || !state.inspectorHidden || !state.noTechnicalPaths ||
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
          for (const [width, height] of [[900, 600], [1180, 720], [1440, 900]]) {
            mainWindow.setSize(width, height)
            await new Promise((done) => setTimeout(done, 120))
            const image = await mainWindow.webContents.capturePage()
            writeFileSync(join(screenshotDirectory, `cerbonesphoto-${width}x${height}.png`), image.toPNG())
          }
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
