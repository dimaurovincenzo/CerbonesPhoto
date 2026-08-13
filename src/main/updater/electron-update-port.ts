import type { EventEmitter } from 'node:events'
import type { UpdaterPort } from '../../shared/update-types'
import { sanitizeUpdateMessage } from './update-coordinator.ts'

export interface UpdateLoggerLike {
  info: (message?: unknown) => void
  warn: (message?: unknown) => void
  error: (message?: unknown) => void
  debug?: (message: string) => void
  transports?: { file?: { maxSize: number } }
}

export interface ElectronUpdaterLike extends Pick<EventEmitter, 'on' | 'removeListener'> {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  allowDowngrade: boolean
  logger: UpdateLoggerLike | null
  checkForUpdates: () => Promise<unknown>
  quitAndInstall: () => void
}

function safeValue(value: unknown): string {
  if (value instanceof Error) return sanitizeUpdateMessage(value.message)
  if (typeof value === 'string') return sanitizeUpdateMessage(value)
  try {
    return sanitizeUpdateMessage(JSON.stringify(value))
  } catch {
    return '[dato non serializzabile]'
  }
}

function safeLogger(logger: UpdateLoggerLike): UpdateLoggerLike {
  return {
    info: (message) => logger.info(safeValue(message)),
    warn: (message) => logger.warn(safeValue(message)),
    error: (message) => logger.error(safeValue(message)),
    debug: (message) => logger.debug?.(safeValue(message))
  }
}

export function createElectronUpdatePort(
  updater: ElectronUpdaterLike,
  logger: UpdateLoggerLike
): UpdaterPort {
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.allowPrerelease = false
  updater.allowDowngrade = false
  if (logger.transports?.file) logger.transports.file.maxSize = 1_048_576
  updater.logger = safeLogger(logger)

  const on = (event: string, listener: (...args: unknown[]) => void): (() => void) => {
    updater.on(event, listener)
    return () => { updater.removeListener(event, listener) }
  }

  return {
    checkForUpdates: async () => { await updater.checkForUpdates() },
    quitAndInstall: () => updater.quitAndInstall(),
    onChecking: (listener) => on('checking-for-update', listener),
    onAvailable: (listener) => on('update-available', (info) => {
      if (typeof info === 'object' && info != null && 'version' in info && typeof info.version === 'string') {
        listener(info.version)
      }
    }),
    onProgress: (listener) => on('download-progress', (progress) => {
      if (typeof progress === 'object' && progress != null && 'percent' in progress && typeof progress.percent === 'number') {
        listener(progress.percent)
      }
    }),
    onDownloaded: (listener) => on('update-downloaded', (info) => {
      if (typeof info === 'object' && info != null && 'version' in info && typeof info.version === 'string') {
        listener(info.version)
      }
    }),
    onUpToDate: (listener) => on('update-not-available', listener),
    onError: (listener) => on('error', (error) => {
      listener(error instanceof Error ? error : new Error(String(error)))
    })
  }
}
