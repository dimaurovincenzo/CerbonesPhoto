import type {
  UpdateCheckOrigin,
  UpdateSnapshot,
  UpdateStatus,
  UpdaterPort
} from '../../shared/update-types'

interface UpdateCoordinatorOptions {
  currentVersion: string
  supported: boolean
}

type SnapshotListener = (snapshot: UpdateSnapshot) => void

export function sanitizeUpdateMessage(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b[A-Za-z]:\\\S+/g, '[path]')
    .replace(/\/(?:Users|private|var|tmp)\/\S+/g, '[path]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'Aggiornamento non disponibile.'
}

export class UpdateCoordinator {
  private readonly port: UpdaterPort
  private state: UpdateSnapshot
  private readonly listeners = new Set<SnapshotListener>()
  private readonly unsubscribePort: Array<() => void> = []
  private pendingCheck: Promise<UpdateSnapshot> | null = null
  private resolvePending: ((snapshot: UpdateSnapshot) => void) | null = null
  private disposed = false

  constructor(port: UpdaterPort, options: UpdateCoordinatorOptions) {
    this.port = port
    this.state = {
      status: options.supported ? 'idle' : 'unsupported',
      currentVersion: options.currentVersion,
      availableVersion: null,
      percent: null,
      origin: null,
      message: options.supported ? null : 'Aggiornamenti non disponibili in questa build.'
    }
    if (options.supported) this.connectPort()
  }

  snapshot(): UpdateSnapshot {
    return { ...this.state }
  }

  subscribe(listener: SnapshotListener): () => void {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  check(origin: UpdateCheckOrigin): Promise<UpdateSnapshot> {
    if (this.state.status === 'unsupported' || this.disposed) {
      return Promise.resolve(this.snapshot())
    }
    if (this.pendingCheck) return this.pendingCheck
    if (this.isBusyAfterCheck()) return Promise.resolve(this.snapshot())

    this.setState({
      status: 'checking',
      origin,
      availableVersion: null,
      percent: null,
      message: null
    })
    this.pendingCheck = new Promise((resolve) => { this.resolvePending = resolve })
    void this.port.checkForUpdates().catch((error: unknown) => {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
    })
    return this.pendingCheck
  }

  install(): boolean {
    if (this.state.status !== 'downloaded' || this.disposed) return false
    this.port.quitAndInstall()
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribePort.splice(0).forEach((unsubscribe) => unsubscribe())
    this.listeners.clear()
    this.finishPending()
  }

  private connectPort(): void {
    this.unsubscribePort.push(
      this.port.onChecking(() => this.setState({ status: 'checking' })),
      this.port.onAvailable((version) => {
        this.setState({ status: 'available', availableVersion: version, percent: null })
        this.finishPending()
      }),
      this.port.onProgress((percent) => this.setState({
        status: 'downloading',
        percent: Math.round(Math.max(0, Math.min(100, percent)))
      })),
      this.port.onDownloaded((version) => {
        this.setState({ status: 'downloaded', availableVersion: version, percent: 100 })
        this.finishPending()
      }),
      this.port.onUpToDate(() => {
        this.setState({ status: 'up-to-date', availableVersion: null, percent: null })
        this.finishPending()
      }),
      this.port.onError((error) => this.handleError(error))
    )
  }

  private handleError(error: Error): void {
    this.setState({ status: 'error', percent: null, message: sanitizeUpdateMessage(error.message) })
    this.finishPending()
  }

  private setState(patch: Partial<UpdateSnapshot> & { status?: UpdateStatus }): void {
    this.state = { ...this.state, ...patch }
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private finishPending(): void {
    const resolve = this.resolvePending
    this.resolvePending = null
    this.pendingCheck = null
    resolve?.(this.snapshot())
  }

  private isBusyAfterCheck(): boolean {
    return this.state.status === 'available' ||
      this.state.status === 'downloading' ||
      this.state.status === 'downloaded'
  }
}
