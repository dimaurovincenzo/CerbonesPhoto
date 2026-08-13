export type PhotoJobKind = 'metadata' | 'thumbnail' | 'preview' | 'high-resolution'
export type PhotoJobResource = 'io' | 'raw'

export interface PhotoJob {
  id: string
  fileId: number
  kind: PhotoJobKind
  priority: number
  resource: PhotoJobResource
  run(signal: AbortSignal): Promise<void>
}

export interface PhotoQueueOptions {
  ioConcurrency: number
  rawConcurrency: number
}

interface QueuedJob extends PhotoJob {
  sequence: number
}

/** Scheduler in-memory: limita separatamente I/O leggero e decodifica RAW. */
export class PhotoQueue {
  private readonly limits: Record<PhotoJobResource, number>
  private readonly pending: QueuedJob[] = []
  private readonly knownIds = new Set<string>()
  private readonly running = new Map<string, { job: QueuedJob; controller: AbortController; promise: Promise<void> }>()
  private readonly idleWaiters = new Set<() => void>()
  private sequence = 0
  private paused = false
  private closed = false
  private draining = false

  constructor(options: PhotoQueueOptions) {
    this.limits = {
      io: Math.max(1, Math.floor(options.ioConcurrency)),
      raw: Math.max(1, Math.floor(options.rawConcurrency))
    }
  }

  enqueue(job: PhotoJob): boolean {
    if (this.closed || this.knownIds.has(job.id)) return false
    this.knownIds.add(job.id)
    this.pending.push({ ...job, sequence: this.sequence++ })
    this.scheduleDrain()
    return true
  }

  promote(fileIds: readonly number[]): void {
    const promoted = new Set(fileIds)
    for (const job of this.pending) {
      if (promoted.has(job.fileId)) job.priority = Math.max(job.priority, 1000)
    }
    this.scheduleDrain()
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (!this.paused || this.closed) return
    this.paused = false
    this.scheduleDrain()
  }

  snapshot(): { pending: number; processing: number; paused: boolean } {
    return { pending: this.pending.length, processing: this.running.size, paused: this.paused }
  }

  onIdle(): Promise<void> {
    if (this.pending.length === 0 && this.running.size === 0) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.add(resolve))
  }

  async shutdown(): Promise<void> {
    this.closed = true
    this.pending.splice(0).forEach((job) => this.knownIds.delete(job.id))
    for (const active of this.running.values()) active.controller.abort()
    await Promise.allSettled([...this.running.values()].map((active) => active.promise))
    this.resolveIdleIfNeeded()
  }

  private scheduleDrain(): void {
    if (this.draining || this.closed) return
    this.draining = true
    queueMicrotask(() => {
      this.draining = false
      this.drain()
    })
  }

  private drain(): void {
    if (this.paused || this.closed) return
    this.pending.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence)

    let started = false
    for (let index = 0; index < this.pending.length;) {
      const job = this.pending[index]
      if (this.runningCount(job.resource) >= this.limits[job.resource]) {
        index++
        continue
      }
      this.pending.splice(index, 1)
      this.start(job)
      started = true
    }
    if (!started) this.resolveIdleIfNeeded()
  }

  private start(job: QueuedJob): void {
    const controller = new AbortController()
    const promise = Promise.resolve()
      .then(() => job.run(controller.signal))
      .catch(() => undefined)
      .finally(() => {
        this.running.delete(job.id)
        this.knownIds.delete(job.id)
        this.scheduleDrain()
        this.resolveIdleIfNeeded()
      })
    this.running.set(job.id, { job, controller, promise })
  }

  private runningCount(resource: PhotoJobResource): number {
    let count = 0
    for (const active of this.running.values()) if (active.job.resource === resource) count++
    return count
  }

  private resolveIdleIfNeeded(): void {
    if (this.pending.length !== 0 || this.running.size !== 0) return
    for (const resolve of this.idleWaiters) resolve()
    this.idleWaiters.clear()
  }
}
