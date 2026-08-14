import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectFile = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('le azioni sul file restano validate nel main process', () => {
  const source = projectFile('src/main/ipc/files.ts')

  assert.match(source, /ipcMain\.handle\('files:showInFinder'/)
  assert.match(source, /shell\.showItemInFolder\(getIndexedFilePath\(fileId\)\)/)
  assert.match(source, /ipcMain\.on\('files:startDrag'/)
  assert.match(source, /event\.sender\.startDrag\(\{ file: path, icon: dragIcon \}\)/)
})

test('il contratto preload espone solo azioni per ID indicizzato', () => {
  const api = projectFile('src/shared/api.ts')
  const preload = projectFile('src/preload/index.ts')

  assert.match(api, /showInFinder: \(fileId: number\) => Promise<void>/)
  assert.match(api, /startDrag: \(fileId: number\) => void/)
  assert.match(preload, /showInFinder: \(fileId\) => ipcRenderer\.invoke\('files:showInFinder', fileId\)/)
  assert.match(preload, /startDrag: \(fileId\) => ipcRenderer\.send\('files:startDrag', fileId\)/)
})

test('card e Quick Look offrono mostra nel Finder e trascinamento nativo', () => {
  const card = projectFile('src/renderer/src/components/MediaCard.tsx')
  const lightbox = projectFile('src/renderer/src/components/Lightbox.tsx')

  assert.match(card, /draggable/)
  assert.match(card, /window\.cartelli\.files\.startDrag\(file\.id\)/)
  assert.match(lightbox, /window\.cartelli\.files\.startDrag\(current\.id\)/)
  assert.match(lightbox, /window\.cartelli\.files\.showInFinder\(current\.id\)/)
})
