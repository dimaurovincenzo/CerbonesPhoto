import type { DatabaseSync } from 'node:sqlite'
import type {
  DerivativeRecord,
  PhotoErrorCode,
  PhotoMetadata,
  PhotoPipelineSnapshot,
  PhotoProcessingState
} from '../../shared/photo-types.ts'
import type { MediaFile } from '../../shared/types.ts'
import { mapFile } from '../db/mappers.ts'
import type { DerivativeService } from './derivative-service.ts'
import type { ExifToolService } from './exiftool-service.ts'
import { normalizePhotoMetadata } from './metadata-normalizer.ts'
import { PhotoQueue } from './photo-queue.ts'
import { RawHelperError } from './raw-helper.ts'

export interface PhotoProcessResult {
  metadata: PhotoMetadata | null
  derivatives: DerivativeRecord[]
  partial: boolean
}

export interface PhotoProcessor {
  process(file: MediaFile, signal: AbortSignal): Promise<PhotoProcessResult>
}

export interface PhotoPipelineRepository {
  getFile(fileId: number): MediaFile | null
  updateState(fileId: number, state: PhotoProcessingState, errorCode: string | null, errorMessage: string | null): void
  saveMetadata(fileId: number, metadata: PhotoMetadata): void
  saveDerivative(record: DerivativeRecord, pipelineVersion: number): void
  snapshot(paused: boolean): PhotoPipelineSnapshot
}

export interface PhotoPipelineOptions {
  repository: PhotoPipelineRepository
  processor: PhotoProcessor
  queue?: PhotoQueue
}

/** Coordina transizioni per-file: un errore non interrompe mai il drain globale. */
export class PhotoPipeline {
  private readonly repository: PhotoPipelineRepository
  private readonly processor: PhotoProcessor
  private readonly queue: PhotoQueue
  private readonly listeners = new Set<(snapshot: PhotoPipelineSnapshot) => void>()
  private notificationTimer: ReturnType<typeof setTimeout> | null = null
  private paused = false

  constructor(options: PhotoPipelineOptions) {
    this.repository = options.repository
    this.processor = options.processor
    this.queue = options.queue ?? new PhotoQueue({ ioConcurrency: 4, rawConcurrency: 1 })
  }

  enqueue(fileId: number, priority = 0): boolean {
    const file = this.repository.getFile(fileId)
    if (!file || file.kind !== 'image' || file.processingState !== 'pending') return false
    const accepted = this.queue.enqueue({
      id: `photo:${fileId}`,
      fileId,
      kind: 'thumbnail',
      priority,
      resource: file.isRaw ? 'raw' : 'io',
      run: (signal) => this.processOne(fileId, signal)
    })
    if (accepted) this.scheduleNotification()
    return accepted
  }

  retry(fileId: number): boolean {
    const file = this.repository.getFile(fileId)
    if (!file || !['failed', 'partial'].includes(file.processingState)) return false
    this.repository.updateState(fileId, 'pending', null, null)
    this.scheduleNotification()
    return this.enqueue(fileId, 1000)
  }

  promoteVisible(fileIds: readonly number[]): void {
    this.queue.promote(fileIds.filter((id) => Number.isSafeInteger(id) && id > 0))
  }

  pause(): void {
    this.paused = true
    this.queue.pause()
    this.scheduleNotification()
  }

  resume(): void {
    this.paused = false
    this.queue.resume()
    this.scheduleNotification()
  }

  snapshot(): PhotoPipelineSnapshot {
    return this.repository.snapshot(this.paused)
  }

  onSnapshot(listener: (snapshot: PhotoPipelineSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  onIdle(): Promise<void> {
    return this.queue.onIdle()
  }

  async shutdown(): Promise<void> {
    if (this.notificationTimer) clearTimeout(this.notificationTimer)
    this.notificationTimer = null
    this.listeners.clear()
    await this.queue.shutdown()
  }

  private async processOne(fileId: number, signal: AbortSignal): Promise<void> {
    const file = this.repository.getFile(fileId)
    if (!file || file.processingState !== 'pending') return
    this.repository.updateState(fileId, 'processing', null, null)
    this.scheduleNotification()
    try {
      const result = await this.processor.process(file, signal)
      if (result.metadata) this.repository.saveMetadata(fileId, result.metadata)
      for (const derivative of result.derivatives) {
        this.repository.saveDerivative(derivative, file.pipelineVersion)
      }
      this.repository.updateState(fileId, result.partial ? 'partial' : 'ready', null, null)
    } catch (error) {
      if (isAbortError(error)) {
        this.repository.updateState(fileId, 'pending', null, null)
      } else {
        const failure = stableFailure(error)
        this.repository.updateState(fileId, 'failed', failure.code, failure.message)
      }
    } finally {
      this.scheduleNotification()
    }
  }

  private scheduleNotification(): void {
    if (this.notificationTimer) return
    this.notificationTimer = setTimeout(() => {
      this.notificationTimer = null
      const snapshot = this.snapshot()
      for (const listener of this.listeners) listener(snapshot)
    }, 100)
  }
}

export class ProfessionalPhotoProcessor implements PhotoProcessor {
  private readonly exifTool: ExifToolService
  private readonly derivatives: DerivativeService

  constructor(exifTool: ExifToolService, derivatives: DerivativeService) {
    this.exifTool = exifTool
    this.derivatives = derivatives
  }

  async process(file: MediaFile, signal: AbortSignal): Promise<PhotoProcessResult> {
    const metadata = normalizePhotoMetadata(await this.exifTool.read(file.path, signal))
    const thumbnail = await this.derivatives.ensure(file, 'thumbnail', signal)
    try {
      const preview = await this.derivatives.ensure(file, 'preview', signal)
      return { metadata, derivatives: [thumbnail, preview], partial: false }
    } catch (error) {
      if (isAbortError(error)) throw error
      return { metadata, derivatives: [thumbnail], partial: true }
    }
  }
}

export class SqlitePhotoRepository implements PhotoPipelineRepository {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  getFile(fileId: number): MediaFile | null {
    const row = this.db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as Record<string, unknown> | undefined
    return row ? mapFile(row) : null
  }

  updateState(fileId: number, state: PhotoProcessingState, errorCode: string | null, errorMessage: string | null): void {
    this.db.prepare(
      `UPDATE files SET processing_state = ?, processing_error_code = ?, processing_error_message = ?,
       last_processed_at = ?, updated_at = ? WHERE id = ?`
    ).run(state, errorCode, errorMessage, state === 'pending' ? null : Date.now(), Date.now(), fileId)
  }

  saveMetadata(fileId: number, metadata: PhotoMetadata): void {
    this.db.prepare(
      `UPDATE files SET metadata_json = ?, camera_make = ?, camera_model = ?, captured_at = ?,
       width = ?, height = ?, orientation = ?, color_profile = ?, updated_at = ? WHERE id = ?`
    ).run(
      JSON.stringify(metadata), metadata.cameraMake, metadata.cameraModel, metadata.capturedAt,
      metadata.width, metadata.height, metadata.orientation, metadata.colorProfile, Date.now(), fileId
    )
  }

  saveDerivative(record: DerivativeRecord, pipelineVersion: number): void {
    const now = Date.now()
    this.db.prepare(
      `INSERT INTO file_derivatives
       (file_id, level, path, mime, width, height, size_bytes, cache_key, pipeline_version, status, last_accessed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)
       ON CONFLICT(file_id, level) DO UPDATE SET
       path = excluded.path, mime = excluded.mime, width = excluded.width, height = excluded.height,
       size_bytes = excluded.size_bytes, cache_key = excluded.cache_key, pipeline_version = excluded.pipeline_version,
       status = 'ready', last_accessed_at = excluded.last_accessed_at`
    ).run(
      record.fileId, record.level, record.path, record.mime, record.width, record.height,
      record.sizeBytes, record.cacheKey, pipelineVersion, now, now
    )
  }

  snapshot(paused: boolean): PhotoPipelineSnapshot {
    const counts = this.db.prepare(
      `SELECT processing_state AS state, COUNT(*) AS count FROM files
       WHERE kind = 'image' GROUP BY processing_state`
    ).all() as Array<{ state: PhotoProcessingState; count: number }>
    const result: PhotoPipelineSnapshot = { pending: 0, processing: 0, ready: 0, partial: 0, failed: 0, paused }
    for (const row of counts) result[row.state] = Number(row.count)
    return result
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function stableFailure(error: unknown): { code: PhotoErrorCode; message: string } {
  if (error instanceof RawHelperError) return { code: error.code, message: stableMessage(error.code) }
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ENOENT') return { code: 'FILE_MISSING', message: stableMessage('FILE_MISSING') }
  if (code === 'EACCES' || code === 'EPERM') return { code: 'PERMISSION_DENIED', message: stableMessage('PERMISSION_DENIED') }
  return { code: 'PREVIEW_CORRUPT', message: stableMessage('PREVIEW_CORRUPT') }
}

function stableMessage(code: PhotoErrorCode): string {
  const messages: Record<PhotoErrorCode, string> = {
    FILE_MISSING: 'Il file originale non è più disponibile',
    PERMISSION_DENIED: 'CerbonesPhoto non ha il permesso di leggere il file',
    METADATA_INVALID: 'I metadati della fotografia non sono validi',
    RAW_UNSUPPORTED: 'Anteprima RAW non disponibile per questo file',
    PREVIEW_CORRUPT: 'Non è stato possibile generare un’anteprima valida',
    ENGINE_TIMEOUT: 'Il motore fotografico non ha risposto in tempo',
    CACHE_UNWRITABLE: 'La cache delle anteprime non è scrivibile',
    RESOURCE_LIMIT: 'La fotografia supera i limiti di elaborazione sicuri'
  }
  return messages[code]
}
