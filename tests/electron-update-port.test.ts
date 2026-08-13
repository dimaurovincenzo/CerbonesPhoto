import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { createElectronUpdatePort, type ElectronUpdaterLike, type UpdateLoggerLike } from '../src/main/updater/electron-update-port.ts'

class FakeElectronUpdater extends EventEmitter implements ElectronUpdaterLike {
  autoDownload = false
  autoInstallOnAppQuit = false
  allowPrerelease = true
  allowDowngrade = true
  logger: UpdateLoggerLike | null = null
  checks = 0
  installs = 0

  async checkForUpdates(): Promise<unknown> { this.checks += 1; return null }
  quitAndInstall(): void { this.installs += 1 }
}

test('configura il provider sicuro, traduce eventi e rimuove listener', async () => {
  const updater = new FakeElectronUpdater()
  const messages: string[] = []
  const logger: UpdateLoggerLike = {
    info: (message) => { messages.push(String(message)) },
    warn: (message) => { messages.push(String(message)) },
    error: (message) => { messages.push(String(message)) },
    debug: (message) => { messages.push(String(message)) }
  }
  const port = createElectronUpdatePort(updater, logger)
  let availableVersion: string | null = null
  let progress = 0
  const removeAvailable = port.onAvailable((version) => { availableVersion = version })
  port.onProgress((percent) => { progress = percent })

  updater.emit('update-available', { version: '0.1.1' })
  updater.emit('download-progress', { percent: 42.7 })
  assert.equal(updater.autoDownload, true)
  assert.equal(updater.autoInstallOnAppQuit, true)
  assert.equal(updater.allowPrerelease, false)
  assert.equal(updater.allowDowngrade, false)
  assert.equal(availableVersion, '0.1.1')
  assert.equal(progress, 42.7)

  removeAvailable()
  updater.emit('update-available', { version: '0.1.2' })
  assert.equal(availableVersion, '0.1.1')

  updater.logger?.info('GET https://github.com/secret /Users/demo/update.zip')
  assert.doesNotMatch(messages.join(' '), /https:|\/Users\//)
  await port.checkForUpdates()
  port.quitAndInstall()
  assert.equal(updater.checks, 1)
  assert.equal(updater.installs, 1)
})
