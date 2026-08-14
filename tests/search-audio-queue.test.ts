import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { orderSearchAudioQueue } from '../src/renderer/src/components/search-audio-queue.ts'
import type { MediaFile, SearchResult } from '../src/shared/types.ts'

const audio = (id: number, folderId: number): MediaFile => ({
  id, folderId, path: `/tmp/${id}.mp3`, name: `${id}.mp3`, kind: 'audio', mime: 'audio/mpeg',
  sizeBytes: null, sourceMtimeMs: null, width: null, height: null, durationMs: null, hash: null,
  isFavorite: false, metadataJson: null, processingState: 'ready', photoFormat: null, isRaw: false,
  cameraMake: null, cameraModel: null, capturedAt: null, orientation: null, colorProfile: null,
  pipelineVersion: 0, processingErrorCode: null, processingErrorMessage: null, lastProcessedAt: null,
  createdAt: 0, updatedAt: 0
})

const result = (id: number, folderId: number, mediaKind: SearchResult['mediaKind']): SearchResult => ({
  resultKind: 'file', id, folderId, name: `${id}`, folderName: `${folderId}`, score: 10, mediaKind, mime: null
})

test('la coda audio conserva l ordine dei risultati anche tra cartelle diverse', () => {
  const results = [result(2, 10, 'audio'), result(80, 20, 'image'), result(1, 10, 'audio'), result(3, 30, 'audio')]
  const filesByFolder = new Map<number, readonly MediaFile[]>([
    [10, [audio(1, 10), audio(2, 10)]],
    [20, []],
    [30, [audio(3, 30)]]
  ])

  assert.deepEqual(orderSearchAudioQueue(results, filesByFolder).map((file) => file.id), [2, 1, 3])
})

test('risultati e card mostrano il logo per la traccia corrente', () => {
  const projectFile = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const search = projectFile('src/renderer/src/components/SearchResults.tsx')
  const card = projectFile('src/renderer/src/components/MediaCard.tsx')

  assert.match(search, /orderSearchAudioQueue/)
  assert.match(search, /search-result__now-playing/)
  assert.match(card, /media-card--now-playing/)
  assert.match(search, /iconUrl/)
  assert.match(card, /iconUrl/)
})
