import { opendir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { MediaKind } from '../shared/types.ts'
import { classifyMediaPath, mimeFromPath } from '../shared/media-formats.ts'

export interface ScannedMediaEntry {
  name: string
  path: string
  kind: Exclude<MediaKind, 'other'>
  mime: string
  sizeBytes: number
}

export interface ScannedEntryBatch {
  directory: string
  entries: ScannedMediaEntry[]
  complete: boolean
}

export interface WalkMediaOptions {
  batchSize?: number
}

/** Enumera una singola directory senza trattenere l'intero contenuto in memoria. */
export async function* walkMedia(
  directory: string,
  options: WalkMediaOptions = {}
): AsyncGenerator<ScannedEntryBatch> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 200, 1000))
  let handle
  try {
    handle = await opendir(directory)
  } catch {
    yield { directory, entries: [], complete: false }
    return
  }

  let entries: ScannedMediaEntry[] = []
  try {
    for await (const dirent of handle) {
      if (!dirent.isFile() || dirent.name.startsWith('.')) continue
      const kind = classifyMediaPath(dirent.name)
      if (!kind) continue
      const path = join(directory, dirent.name)
      try {
        const fileStat = await stat(path)
        entries.push({ name: dirent.name, path, kind, mime: mimeFromPath(path), sizeBytes: fileStat.size })
      } catch {
        continue
      }

      if (entries.length >= batchSize) {
        yield { directory, entries, complete: false }
        entries = []
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
    }
  } catch {
    yield { directory, entries, complete: false }
    return
  }

  yield { directory, entries, complete: true }
}
