import type { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import sharp from 'sharp'
import type { DerivativeLevel, DerivativeRecord, PhotoEngineHealth } from '../../shared/photo-types.ts'
import { PhotoCache } from './cache.ts'
import { DerivativeService } from './derivative-service.ts'
import { ExifToolService } from './exiftool-service.ts'
import {
  PhotoPipeline,
  ProfessionalPhotoProcessor,
  SqlitePhotoRepository
} from './photo-pipeline.ts'
import { RawHelper } from './raw-helper.ts'

export interface PhotoRuntimeOptions {
  db: DatabaseSync
  userDataPath: string
  appPath: string
  resourcesPath: string
  isPackaged: boolean
}

/** Possiede e chiude tutti i motori fotografici del main process. */
export class PhotoRuntime {
  readonly pipeline: PhotoPipeline
  readonly derivatives: DerivativeService
  private readonly db: DatabaseSync
  private readonly repository: SqlitePhotoRepository
  private readonly exifTool: ExifToolService
  private readonly rawHelper: RawHelper

  constructor(options: PhotoRuntimeOptions) {
    this.db = options.db
    this.repository = new SqlitePhotoRepository(options.db)
    this.exifTool = new ExifToolService()
    const binaryPath = options.isPackaged
      ? join(options.resourcesPath, 'bin', 'darwin-arm64', 'simple_dcraw')
      : join(options.appPath, 'resources', 'bin', 'darwin-arm64', 'simple_dcraw')
    this.rawHelper = new RawHelper({ simpleDcrawPath: binaryPath })
    const cache = new PhotoCache(join(options.userDataPath, 'photo-cache'))
    this.derivatives = new DerivativeService({ cache, rawHelper: this.rawHelper })
    this.pipeline = new PhotoPipeline({
      repository: this.repository,
      processor: new ProfessionalPhotoProcessor(this.exifTool, this.derivatives)
    })
  }

  enqueuePending(): number {
    const rows = this.db.prepare(
      "SELECT id FROM files WHERE kind = 'image' AND processing_state = 'pending' ORDER BY id"
    ).all() as Array<{ id: number }>
    let accepted = 0
    for (const row of rows) if (this.pipeline.enqueue(row.id)) accepted++
    return accepted
  }

  async ensureDerivative(fileId: number, level: DerivativeLevel, signal: AbortSignal): Promise<DerivativeRecord | null> {
    const file = this.repository.getFile(fileId)
    if (!file || file.kind !== 'image') return null
    const record = await this.derivatives.ensure(file, level, signal)
    this.repository.saveDerivative(record, file.pipelineVersion)
    return record
  }

  async engines(): Promise<PhotoEngineHealth[]> {
    const [exifTool, libraw] = await Promise.all([this.exifTool.health(), this.rawHelper.health()])
    return [
      exifTool,
      libraw,
      {
        name: 'sharp',
        available: true,
        version: sharp.versions.sharp ?? null,
        architecture: process.arch,
        errorCode: null
      }
    ]
  }

  async shutdown(): Promise<void> {
    await this.pipeline.shutdown()
    await this.exifTool.close()
  }
}
