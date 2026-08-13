import assert from 'node:assert/strict'
import test from 'node:test'
import { nextPhotoSource, type PhotoSourceState } from '../src/renderer/src/components/photo-source-state.ts'

test('avanza da thumbnail a preview e high-resolution solo quando pronte', () => {
  let state: PhotoSourceState = { level: 'thumbnail', pending: null, unsupported: false }
  state = nextPhotoSource(state, { type: 'request-preview' })
  assert.deepEqual(state, { level: 'thumbnail', pending: 'preview', unsupported: false })
  state = nextPhotoSource(state, { type: 'loaded', level: 'preview' })
  assert.deepEqual(state, { level: 'preview', pending: null, unsupported: false })
  state = nextPhotoSource(state, { type: 'zoom', scale: 3 })
  assert.equal(state.pending, 'high-resolution')
  state = nextPhotoSource(state, { type: 'loaded', level: 'high-resolution' })
  assert.equal(state.level, 'high-resolution')
})

test('202 mantiene la sorgente corrente e 415 attiva il fallback', () => {
  const loading: PhotoSourceState = { level: 'preview', pending: 'high-resolution', unsupported: false }
  assert.deepEqual(nextPhotoSource(loading, { type: 'retry' }), loading)
  assert.deepEqual(
    nextPhotoSource(loading, { type: 'unsupported' }),
    { level: 'preview', pending: null, unsupported: true }
  )
})
