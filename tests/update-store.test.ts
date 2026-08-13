import assert from 'node:assert/strict'
import test from 'node:test'
import { createUpdatesStore, updatePresentation } from '../src/renderer/src/stores/updates.ts'
import type { UpdatesApi } from '../src/shared/api.ts'
import type { UpdateSnapshot, UpdateStatus } from '../src/shared/update-types.ts'

function snapshot(status: UpdateStatus): UpdateSnapshot {
  return {
    status, currentVersion: '0.1.0', availableVersion: null,
    percent: null, origin: null, message: null
  }
}

test('presenta gli stati aggiornamento con azioni chiare', () => {
  assert.deepEqual(updatePresentation(snapshot('up-to-date')), {
    label: 'CerbonesPhoto è aggiornato', action: 'check', busy: false
  })
  assert.deepEqual(updatePresentation({ ...snapshot('downloading'), percent: 42 }), {
    label: 'Download 42%', action: null, busy: true
  })
  assert.deepEqual(updatePresentation({ ...snapshot('downloaded'), availableVersion: '0.1.1' }), {
    label: 'Versione 0.1.1 pronta', action: 'install', busy: false
  })
  assert.deepEqual(updatePresentation(snapshot('unsupported')), {
    label: 'Aggiornamenti non disponibili in questa build', action: null, busy: false
  })
})

test('connette eventi, inoltra azioni e rimuove la sottoscrizione', async () => {
  let listener: ((value: UpdateSnapshot) => void) | null = null
  let unsubscribed = false
  const calls: string[] = []
  const api: UpdatesApi = {
    snapshot: async () => snapshot('idle'),
    check: async () => { calls.push('check'); return snapshot('up-to-date') },
    install: async () => { calls.push('install'); return true },
    onSnapshot: (callback) => {
      listener = callback
      return () => { unsubscribed = true }
    }
  }
  const store = createUpdatesStore(api)
  const disconnect = store.getState().connect()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(store.getState().snapshot.status, 'idle')

  listener?.({ ...snapshot('downloading'), percent: 37 })
  assert.equal(store.getState().snapshot.percent, 37)
  await store.getState().check()
  assert.equal(store.getState().snapshot.status, 'up-to-date')
  assert.equal(await store.getState().install(), true)
  disconnect()

  assert.deepEqual(calls, ['check', 'install'])
  assert.equal(unsubscribed, true)
})

