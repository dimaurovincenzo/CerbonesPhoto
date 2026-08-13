import { createHash } from 'node:crypto'
import { mkdir, readdir, rm, stat, utimes } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DerivativeLevel } from '../../shared/photo-types.ts'

export interface PhotoCacheKeyInput {
  sourcePath: string
  sizeBytes: number
  mtimeMs: number
  pipelineVersion: number
  level: DerivativeLevel
}

export interface PruneResult {
  deletedFiles: number
  deletedBytes: number
  remainingBytes: number
}

export function photoCacheKey(input: PhotoCacheKeyInput): string {
  const canonical = [
    input.sourcePath,
    String(input.sizeBytes),
    String(input.mtimeMs),
    String(input.pipelineVersion),
    input.level
  ].join('\0')
  return createHash('sha256').update(canonical).digest('hex')
}

/** Cache confinata alla propria root; non accetta path o estensioni arbitrarie. */
export class PhotoCache {
  readonly rootPath: string
  private readonly lastTouches = new Map<string, number>()

  constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  pathFor(key: string, level: DerivativeLevel, extension: 'webp' | 'jpg' | 'tiff'): string {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Chiave cache non valida')
    return join(this.rootPath, key.slice(0, 2), `${key}-${level}.${extension}`)
  }

  async ensureParent(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
  }

  async touch(path: string, now = Date.now()): Promise<void> {
    const previous = this.lastTouches.get(path) ?? 0
    if (now - previous < 60_000) return
    this.lastTouches.set(path, now)
    const date = new Date(now)
    await utimes(path, date, date).catch(() => undefined)
  }

  async prune(maxBytes: number): Promise<PruneResult> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('Limite cache non valido')
    const entries = await this.collectFiles(this.rootPath)
    let remainingBytes = entries.reduce((sum, entry) => sum + entry.size, 0)
    let deletedFiles = 0
    let deletedBytes = 0
    entries.sort((left, right) => left.accessedAt - right.accessedAt)
    for (const entry of entries) {
      if (remainingBytes <= maxBytes) break
      await rm(entry.path, { force: true })
      this.lastTouches.delete(entry.path)
      remainingBytes -= entry.size
      deletedBytes += entry.size
      deletedFiles += 1
    }
    return { deletedFiles, deletedBytes, remainingBytes }
  }

  private async collectFiles(directory: string): Promise<Array<{ path: string; size: number; accessedAt: number }>> {
    let items
    try {
      items = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const result: Array<{ path: string; size: number; accessedAt: number }> = []
    for (const item of items) {
      const path = join(directory, item.name)
      if (item.isDirectory()) {
        result.push(...await this.collectFiles(path))
      } else if (item.isFile()) {
        const info = await stat(path)
        result.push({ path, size: info.size, accessedAt: Math.max(info.atimeMs, info.mtimeMs) })
      }
    }
    return result
  }
}
