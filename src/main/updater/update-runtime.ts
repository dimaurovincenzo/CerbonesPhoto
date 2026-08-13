import type { UpdateCheckOrigin, UpdateSnapshot } from '../../shared/update-types'

export interface UpdateCoordinatorLike {
  snapshot: () => UpdateSnapshot
  subscribe: (listener: (snapshot: UpdateSnapshot) => void) => () => void
  check: (origin: UpdateCheckOrigin) => Promise<UpdateSnapshot>
  install: () => boolean
  dispose: () => void
}

export interface UpdateClock {
  setTimeout: (callback: () => void, delay: number) => unknown
  clearTimeout: (id: unknown) => void
  setInterval: (callback: () => void, delay: number) => unknown
  clearInterval: (id: unknown) => void
}

interface CreateUpdateRuntimeOptions {
  coordinator: UpdateCoordinatorLike
  clock?: UpdateClock
  supported: boolean
}

export interface UpdateRuntime {
  start: () => void
  snapshot: () => UpdateSnapshot
  subscribe: (listener: (snapshot: UpdateSnapshot) => void) => () => void
  checkManual: () => Promise<UpdateSnapshot>
  install: () => boolean
  dispose: () => void
}

const STARTUP_DELAY_MS = 10_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

const systemClock: UpdateClock = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>)
}

export function createUpdateRuntime(options: CreateUpdateRuntimeOptions): UpdateRuntime {
  const clock = options.clock ?? systemClock
  let startupTimer: unknown = null
  let intervalTimer: unknown = null
  let started = false
  let disposed = false

  const checkAutomatic = (): void => {
    if (!disposed) void options.coordinator.check('automatic')
  }

  return {
    start: () => {
      if (started || disposed || !options.supported) return
      started = true
      startupTimer = clock.setTimeout(() => {
        startupTimer = null
        checkAutomatic()
        if (!disposed) intervalTimer = clock.setInterval(checkAutomatic, CHECK_INTERVAL_MS)
      }, STARTUP_DELAY_MS)
    },
    snapshot: () => options.coordinator.snapshot(),
    subscribe: (listener) => options.coordinator.subscribe(listener),
    checkManual: () => options.coordinator.check('manual'),
    install: () => options.coordinator.install(),
    dispose: () => {
      if (disposed) return
      disposed = true
      if (startupTimer != null) clock.clearTimeout(startupTimer)
      if (intervalTimer != null) clock.clearInterval(intervalTimer)
      startupTimer = null
      intervalTimer = null
      options.coordinator.dispose()
    }
  }
}

