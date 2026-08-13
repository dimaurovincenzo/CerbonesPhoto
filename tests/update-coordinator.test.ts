import assert from 'node:assert/strict'
import test from 'node:test'
import { UpdateCoordinator } from '../src/main/updater/update-coordinator.ts'
import type { UpdaterPort } from '../src/shared/update-types.ts'

class FakeUpdaterPort implements UpdaterPort {
  checks = 0
  installs = 0
  private checking = new Set<() => void>()
  private available = new Set<(version: string) => void>()
  private progress = new Set<(percent: number) => void>()
  private downloaded = new Set<(version: string) => void>()
  private upToDate = new Set<() => void>()
  private errors = new Set<(error: Error) => void>()

  checkForUpdates = async (): Promise<void> => {
    this.checks += 1
    this.checking.forEach((listener) => listener())
  }

  quitAndInstall = (): void => {
    this.installs += 1
  }

  onChecking = (listener: () => void): (() => void) => this.add(this.checking, listener)
  onAvailable = (listener: (version: string) => void): (() => void) => this.add(this.available, listener)
  onProgress = (listener: (percent: number) => void): (() => void) => this.add(this.progress, listener)
  onDownloaded = (listener: (version: string) => void): (() => void) => this.add(this.downloaded, listener)
  onUpToDate = (listener: () => void): (() => void) => this.add(this.upToDate, listener)
  onError = (listener: (error: Error) => void): (() => void) => this.add(this.errors, listener)

  emitAvailable(version: string): void { this.available.forEach((listener) => listener(version)) }
  emitProgress(percent: number): void { this.progress.forEach((listener) => listener(percent)) }
  emitDownloaded(version: string): void { this.downloaded.forEach((listener) => listener(version)) }
  emitUpToDate(): void { this.upToDate.forEach((listener) => listener()) }
  emitError(error: Error): void { this.errors.forEach((listener) => listener(error)) }

  private add<T>(listeners: Set<T>, listener: T): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}

test('impedisce controlli concorrenti e conserva l origine del primo', async () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: true })

  const first = coordinator.check('manual')
  const second = coordinator.check('automatic')
  assert.equal(port.checks, 1)
  port.emitUpToDate()

  assert.equal((await first).status, 'up-to-date')
  assert.equal((await second).origin, 'manual')
})

test('installa soltanto dopo che il pacchetto è stato scaricato', () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: true })

  assert.equal(coordinator.install(), false)
  port.emitDownloaded('0.1.1')
  assert.equal(coordinator.install(), true)
  assert.equal(port.installs, 1)
})

test('limita il progresso e rimuove URL e percorsi dagli errori', () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: true })

  port.emitAvailable('0.1.1')
  port.emitProgress(140.4)
  assert.equal(coordinator.snapshot().percent, 100)
  port.emitError(new Error('GET https://github.com/token /Users/demo/file.zip failed'))

  const snapshot = coordinator.snapshot()
  assert.equal(snapshot.status, 'error')
  assert.doesNotMatch(snapshot.message ?? '', /https:|\/Users\//)
  assert.ok((snapshot.message?.length ?? 0) <= 180)
})

test('una build non supportata non contatta il provider e unsubscribe ferma gli eventi', async () => {
  const port = new FakeUpdaterPort()
  const coordinator = new UpdateCoordinator(port, { currentVersion: '0.1.0', supported: false })
  let notifications = 0
  const unsubscribe = coordinator.subscribe(() => { notifications += 1 })
  unsubscribe()

  const snapshot = await coordinator.check('manual')
  port.emitDownloaded('0.1.1')

  assert.equal(snapshot.status, 'unsupported')
  assert.equal(port.checks, 0)
  assert.equal(notifications, 0)
})

