import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { currentPlayerFile } from '../src/renderer/src/stores/player.ts'
import type { MediaFile } from '../src/shared/types.ts'

const projectFile = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const audio = (id: number): MediaFile => ({
  id, folderId: 8, path: `/tmp/${id}.mp3`, name: `${id}.mp3`, kind: 'audio', mime: 'audio/mpeg',
  sizeBytes: null, sourceMtimeMs: null, width: null, height: null, durationMs: null, hash: null,
  isFavorite: false, metadataJson: null, processingState: 'ready', photoFormat: null, isRaw: false,
  cameraMake: null, cameraModel: null, capturedAt: null, orientation: null, colorProfile: null,
  pipelineVersion: 0, processingErrorCode: null, processingErrorMessage: null, lastProcessedAt: null,
  createdAt: 0, updatedAt: 0
})

test('il pannello informazioni può seguire il brano corrente del player', () => {
  const queue = [audio(1), audio(2)]
  assert.equal(currentPlayerFile(queue, 0)?.id, 1)
  assert.equal(currentPlayerFile(queue, 1)?.id, 2)
  assert.equal(currentPlayerFile(queue, -1), undefined)
  assert.equal(currentPlayerFile(queue, 2), undefined)

  const inspector = projectFile('src/renderer/src/components/Inspector.tsx')
  assert.match(inspector, /currentPlayerFile\(queue, playerIndex\)/)
  assert.match(inspector, /window\.cartelli\.files\.showInFinder\(playingFile\.id\)/)
})

test('la ricerca porta il perimetro della cartella selezionata fino al main process', () => {
  const api = projectFile('src/shared/api.ts')
  const preload = projectFile('src/preload/index.ts')
  const store = projectFile('src/renderer/src/stores/search.ts')
  const ipc = projectFile('src/main/ipc/files.ts')

  assert.match(api, /search: \(query: string, limit\?: number, scopeFolderId\?: number \| null\) => Promise<SearchResult\[\]>/)
  assert.match(preload, /search: \(query, limit, scopeFolderId\) => ipcRenderer\.invoke\('files:search', query, limit, scopeFolderId\)/)
  assert.match(store, /run: \(query: string, scopeFolderId: number \| null\)/)
  assert.match(store, /window\.cartelli\.files\.search\(query, 60, scopeFolderId\)/)
  assert.match(ipc, /WITH RECURSIVE selected_scope\(id, recursive\)/)
  assert.match(ipc, /JOIN selected_scope AS selected ON selected\.recursive = 1/)
})
