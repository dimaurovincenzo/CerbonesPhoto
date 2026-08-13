import { randomUUID } from 'node:crypto'
import { link, mkdtemp, readFile, rm, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import type { DerivativeLevel, DerivativeRecord } from '../../shared/photo-types.ts'
import type { MediaFile } from '../../shared/types.ts'
import { PhotoCache, photoCacheKey } from './cache.ts'
import { RawHelperError } from './raw-helper.ts'

interface RawAdapter {
  extractPreview(sourcePath: string, outputPath: string, signal: AbortSignal): Promise<void>
  render(sourcePath: string, outputPath: string, signal: AbortSignal): Promise<void>
}

interface StandardImageAdapter {
  convertToTiff(sourcePath: string, outputPath: string, signal: AbortSignal): Promise<void>
}

export interface DerivativeServiceOptions {
  cache: PhotoCache
  rawHelper?: RawAdapter
  standardFallback?: StandardImageAdapter
}

const MAX_SIDE: Record<DerivativeLevel, number> = {
  thumbnail: 480,
  preview: 2048,
  'high-resolution': 8192
}

/** Genera solo derivati cache sRGB; il path originale è sempre un input read-only. */
export class DerivativeService {
  private readonly cache: PhotoCache
  private readonly rawHelper?: RawAdapter
  private readonly standardFallback?: StandardImageAdapter

  constructor(options: DerivativeServiceOptions) {
    this.cache = options.cache
    this.rawHelper = options.rawHelper
    this.standardFallback = options.standardFallback
  }

  async ensure(file: MediaFile, level: DerivativeLevel, signal: AbortSignal): Promise<DerivativeRecord> {
    throwIfAborted(signal)
    const sourceInfo = await stat(file.path)
    const cacheKey = photoCacheKey({
      sourcePath: file.path,
      sizeBytes: sourceInfo.size,
      mtimeMs: sourceInfo.mtimeMs,
      pipelineVersion: file.pipelineVersion,
      level
    })
    const outputPath = this.cache.pathFor(cacheKey, level, 'webp')
    await this.cache.ensureParent(outputPath)

    if (!await isReadableFile(outputPath)) {
      await this.generate(file, level, outputPath, signal)
    }
    throwIfAborted(signal)
    await this.cache.touch(outputPath)
    const [metadata, outputInfo] = await Promise.all([sharp(outputPath).metadata(), stat(outputPath)])
    if (!metadata.width || !metadata.height) throw new Error('PREVIEW_CORRUPT: dimensioni derivato mancanti')
    return {
      fileId: file.id,
      level,
      path: outputPath,
      mime: 'image/webp',
      width: metadata.width,
      height: metadata.height,
      sizeBytes: outputInfo.size,
      cacheKey
    }
  }

  private async generate(file: MediaFile, level: DerivativeLevel, outputPath: string, signal: AbortSignal): Promise<void> {
    const partialPath = `${outputPath}.partial-${process.pid}-${randomUUID()}`
    let processingInput = file.path
    let inputWorkspace: string | null = null
    try {
      if (file.isRaw) {
        if (!this.rawHelper) throw new RawHelperError('RAW_UNSUPPORTED', 'Motore RAW non disponibile')
        inputWorkspace = await mkdtemp(join(this.cache.rootPath, '.raw-source-'))
        processingInput = join(inputWorkspace, 'source-preview')
        try {
          await this.rawHelper.extractPreview(file.path, processingInput, signal)
          // Alcune fotocamere incorporano PPM/JXL che il build corrente di libvips
          // può non decodificare: validare qui evita un errore tardivo e abilita il render RAW.
          await sharp(processingInput).metadata()
        } catch (error) {
          if (isAbortError(error)) throw error
          processingInput = join(inputWorkspace, 'source-render.tiff')
          await this.rawHelper.render(file.path, processingInput, signal)
        }
      }

      throwIfAborted(signal)
      try {
        await writeWebp(processingInput, partialPath, level)
      } catch (error) {
        if (file.isRaw || !this.standardFallback || isAbortError(error)) throw error
        await unlink(partialPath).catch(() => undefined)
        inputWorkspace = await mkdtemp(join(this.cache.rootPath, '.standard-source-'))
        processingInput = join(inputWorkspace, 'imageio-source.tiff')
        await this.standardFallback.convertToTiff(file.path, processingInput, signal)
        await writeWebp(processingInput, partialPath, level)
      }
      throwIfAborted(signal)

      // L'hard-link è un publish atomico che non sovrascrive un derivato creato in parallelo.
      try {
        await link(partialPath, outputPath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    } finally {
      await unlink(partialPath).catch(() => undefined)
      if (inputWorkspace) await rm(inputWorkspace, { recursive: true, force: true })
    }
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Operazione annullata', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function isReadableFile(path: string): Promise<boolean> {
  try {
    const bytes = await readFile(path)
    return bytes.length > 0
  } catch {
    return false
  }
}

async function writeWebp(inputPath: string, outputPath: string, level: DerivativeLevel): Promise<void> {
  await sharp(inputPath, { limitInputPixels: 268_402_689, sequentialRead: true })
    .autoOrient()
    .resize(MAX_SIDE[level], MAX_SIDE[level], { fit: 'inside', withoutEnlargement: true })
    .withIccProfile('srgb')
    .webp({ quality: level === 'thumbnail' ? 82 : 90, effort: 4 })
    .toFile(outputPath)
}
