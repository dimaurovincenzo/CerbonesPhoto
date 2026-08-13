import assert from 'node:assert/strict'
import test from 'node:test'
import { createUpdateRuntime, type UpdateClock, type UpdateCoordinatorLike } from '../src/main/updater/update-runtime.ts'
import type { UpdateCheckOrigin, UpdateSnapshot } from '../src/shared/update-types.ts'

class FakeClock implements UpdateClock {
  private now = 0
  private nextId = 1
  private timers = new Map<number, { at: number; every: number | null; callback: () => void }>()

  setTimeout(callback: () => void, delay: number): number {
    return this.add(callback, delay, null)
  }

  clearTimeout(id: unknown): void { this.timers.delete(Number(id)) }

  setInterval(callback: () => void, delay: number): number {
    return this.add(callback, delay, delay)
  }

  clearInterval(id: unknown): void { this.timers.delete(Number(id)) }

  pending(): number { return this.timers.size }

  advanceBy(milliseconds: number): void {
    const target = this.now + milliseconds
    while (true) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0]
      if (!due) break
      const [id, timer] = due
      this.now = timer.at
      if (timer.every == null) this.timers.delete(id)
      else timer.at += timer.every
      timer.callback()
    }
    this.now = target
  }

  private add(callback: () => void, delay: number, every: number | null): number {
    const id = this.nextId++
    this.timers.set(id, { at: this.now + delay, every, callback })
    return id
  }
}

class FakeCoordinator implements UpdateCoordinatorLike {
  automaticChecks = 0
  manualChecks = 0
  disposed = false
  installs = 0
  private state: UpdateSnapshot = {
    status: 'idle', currentVersion: '0.1.0', availableVersion: null,
    percent: null, origin: null, message: null
  }

  snapshot(): UpdateSnapshot { return { ...this.state } }
  subscribe(): () => void { return () => undefined }
  check(origin: UpdateCheckOrigin): Promise<UpdateSnapshot> {
    if (origin === 'automatic') this.automaticChecks += 1
    else this.manualChecks += 1
    this.state = { ...this.state, origin }
    return Promise.resolve(this.snapshot())
  }
  install(): boolean { this.installs += 1; return true }
  dispose(): void { this.disposed = true }
}

test('controlla dopo 10 secondi e poi ogni 6 ore', () => {
  const clock = new FakeClock()
  const coordinator = new FakeCoordinator()
  const runtime = createUpdateRuntime({ coordinator, clock, supported: true })

  runtime.start()
  clock.advanceBy(9_999)
  assert.equal(coordinator.automaticChecks, 0)
  clock.advanceBy(1)
  assert.equal(coordinator.automaticChecks, 1)
  clock.advanceBy(21_600_000)
  assert.equal(coordinator.automaticChecks, 2)
})

test('non crea timer se la build non supporta aggiornamenti', () => {
  const clock = new FakeClock()
  const coordinator = new FakeCoordinator()
  createUpdateRuntime({ coordinator, clock, supported: false }).start()

  assert.equal(clock.pending(), 0)
  clock.advanceBy(30_000_000)
  assert.equal(coordinator.automaticChecks, 0)
})

test('start è idempotente e dispose cancella timer e coordinatore', () => {
  const clock = new FakeClock()
  const coordinator = new FakeCoordinator()
  const runtime = createUpdateRuntime({ coordinator, clock, supported: true })

  runtime.start()
  runtime.start()
  assert.equal(clock.pending(), 1)
  runtime.dispose()

  assert.equal(clock.pending(), 0)
  assert.equal(coordinator.disposed, true)
})

