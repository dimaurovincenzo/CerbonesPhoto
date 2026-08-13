export type UpdateStatus =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'

export type UpdateCheckOrigin = 'automatic' | 'manual'

export interface UpdateSnapshot {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  percent: number | null
  origin: UpdateCheckOrigin | null
  message: string | null
}

export interface UpdaterPort {
  checkForUpdates: () => Promise<void>
  quitAndInstall: () => void
  onChecking: (listener: () => void) => () => void
  onAvailable: (listener: (version: string) => void) => () => void
  onProgress: (listener: (percent: number) => void) => () => void
  onDownloaded: (listener: (version: string) => void) => () => void
  onUpToDate: (listener: () => void) => () => void
  onError: (listener: (error: Error) => void) => () => void
}

