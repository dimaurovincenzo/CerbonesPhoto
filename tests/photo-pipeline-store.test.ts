import assert from 'node:assert/strict'
import test from 'node:test'
import { createPhotoPipelineStore } from '../src/renderer/src/stores/photo-pipeline.ts'
import type { PhotoApi } from '../src/shared/api.ts'
import type { PhotoPipelineSnapshot } from '../src/shared/photo-types.ts'

const initial: PhotoPipelineSnapshot = { pending: 2, processing: 0, ready: 1, partial: 0, failed: 0, paused: false }

test('deduplica snapshot uguali, inoltra azioni e rimuove la sottoscrizione', async () => {
  let listener: ((snapshot: PhotoPipelineSnapshot) => void) | null = null
  let unsubscribed = false
  const calls: string[] = []
  const api: PhotoApi = {
    snapshot: async () => initial,
    pause: async () => { calls.push('pause') },
    resume: async () => { calls.push('resume') },
    retry: async (fileId) => { calls.push(`retry:${fileId}`); return true },
    promoteVisible: async (ids) => { calls.push(`visible:${ids.join(',')}`) },
    engines: async () => [],
    onSnapshot: (callback) => {
      listener = callback
      return () => { unsubscribed = true }
    }
  }
  const store = createPhotoPipelineStore(api)
  const disconnect = store.getState().connect()
  await new Promise((resolve) => setImmediate(resolve))
  const firstReference = store.getState().snapshot

  listener?.({ ...initial })
  assert.equal(store.getState().snapshot, firstReference)
  await store.getState().pause()
  await store.getState().resume()
  await store.getState().retry(7)
  await store.getState().promoteVisible([7, 8])
  disconnect()

  assert.deepEqual(calls, ['pause', 'resume', 'retry:7', 'visible:7,8'])
  assert.equal(unsubscribed, true)
})
