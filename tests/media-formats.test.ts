import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyMediaPath, mimeFromPath } from '../src/shared/media-formats.ts'

test('classifica immagini comuni e professionali', () => {
  assert.equal(classifyMediaPath('/foto/ritratto.HEIC'), 'image')
  assert.equal(classifyMediaPath('/foto/grafica.avif'), 'image')
  assert.equal(mimeFromPath('/foto/grafica.svg'), 'image/svg+xml')
})

test('classifica audio lossless e compressi', () => {
  assert.equal(classifyMediaPath('/audio/master.flac'), 'audio')
  assert.equal(classifyMediaPath('/audio/voce.m4a'), 'audio')
  assert.equal(mimeFromPath('/audio/master.flac'), 'audio/flac')
})

test('classifica i principali contenitori video', () => {
  assert.equal(classifyMediaPath('/video/clip.mov'), 'video')
  assert.equal(classifyMediaPath('/video/export.mp4'), 'video')
  assert.equal(classifyMediaPath('/video/archive.mkv'), 'video')
  assert.equal(mimeFromPath('/video/export.webm'), 'video/webm')
})

test('ignora documenti e file senza estensione', () => {
  assert.equal(classifyMediaPath('/docs/report.pdf'), null)
  assert.equal(classifyMediaPath('/src/search-service.ts'), null)
  assert.equal(classifyMediaPath('/docs/README'), null)
  assert.equal(mimeFromPath('/docs/file.unknown'), 'application/octet-stream')
})
