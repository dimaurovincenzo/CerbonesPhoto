import assert from 'node:assert/strict'
import test from 'node:test'
import { connectAppInfoIpc, type AppInfoIpcBridge } from '../src/main/ipc/app-info-router.ts'

test('la versione About proviene dal main process anche senza variabili npm', () => {
  const handlers = new Map<string, () => string>()
  const bridge: AppInfoIpcBridge = {
    on: (channel, handler) => handlers.set(channel, handler)
  }

  connectAppInfoIpc('0.1.0', bridge)

  assert.equal(handlers.get('app:getVersion')?.(), '0.1.0')
})
