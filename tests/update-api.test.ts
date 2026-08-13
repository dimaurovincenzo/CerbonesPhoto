import assert from 'node:assert/strict'
import test from 'node:test'
import { connectUpdateIpc, type UpdateIpcBridge, type UpdateRuntimeApi } from '../src/main/ipc/update-router.ts'
import type { UpdateSnapshot } from '../src/shared/update-types.ts'

test('il router IPC espone snapshot, controllo manuale, installazione ed eventi', async () => {
  const initial: UpdateSnapshot = {
    status: 'idle', currentVersion: '0.1.0', availableVersion: null,
    percent: null, origin: null, message: null
  }
  const checked: UpdateSnapshot = { ...initial, status: 'up-to-date', origin: 'manual' }
  const handlers = new Map<string, () => unknown>()
  const events: Array<{ channel: string; snapshot: UpdateSnapshot }> = []
  let listener: ((snapshot: UpdateSnapshot) => void) | null = null
  let unsubscribed = false
  const runtime: UpdateRuntimeApi = {
    snapshot: () => ({ ...initial }),
    checkManual: async () => ({ ...checked }),
    install: () => true,
    subscribe: (callback) => {
      listener = callback
      return () => { unsubscribed = true }
    }
  }
  const bridge: UpdateIpcBridge = {
    handle: (channel, handler) => { handlers.set(channel, handler) },
    send: (channel, snapshot) => { events.push({ channel, snapshot }) }
  }

  const disconnect = connectUpdateIpc(runtime, bridge)
  assert.deepEqual(await handlers.get('updates:snapshot')?.(), initial)
  assert.deepEqual(await handlers.get('updates:check')?.(), checked)
  assert.equal(await handlers.get('updates:install')?.(), true)
  assert.ok(listener)
  ;(listener as (snapshot: UpdateSnapshot) => void)(checked)
  assert.deepEqual(events, [{ channel: 'updates:snapshot-event', snapshot: checked }])

  disconnect()
  assert.equal(unsubscribed, true)
})

