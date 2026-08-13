import { ExifTool } from 'exiftool-vendored'
import type { PhotoEngineHealth } from '../../shared/photo-types.ts'

const MAX_METADATA_JSON_BYTES = 1024 * 1024

/** Interfaccia volutamente read-only: non espone alcuna API di scrittura ExifTool. */
export class ExifToolService {
  private readonly tool: ExifTool
  private closing: Promise<void> | null = null

  constructor() {
    this.tool = new ExifTool({
      maxProcs: 1,
      taskTimeoutMillis: 15_000,
      spawnTimeoutMillis: 15_000,
      taskRetries: 0
    })
  }

  async read(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    if (signal.aborted) throw new DOMException('Operazione annullata', 'AbortError')
    const task = this.tool.readRaw(path, { readArgs: ['-G', '-a', '-struct'], ignoreMinorErrors: true })
    const tags = await raceAbort(task as Promise<Record<string, unknown>>, signal)
    const encoded = JSON.stringify(tags)
    if (Buffer.byteLength(encoded, 'utf8') > MAX_METADATA_JSON_BYTES) {
      throw new Error('METADATA_INVALID: output ExifTool oltre 1 MiB')
    }
    return tags
  }

  async health(): Promise<PhotoEngineHealth> {
    try {
      const version = await this.tool.version()
      return { name: 'exiftool', available: true, version: String(version), architecture: process.arch, errorCode: null }
    } catch {
      return { name: 'exiftool', available: false, version: null, architecture: process.arch, errorCode: 'ENGINE_UNAVAILABLE' }
    }
  }

  close(): Promise<void> {
    if (!this.closing) this.closing = this.tool.end()
    return this.closing
  }
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(new DOMException('Operazione annullata', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
