import sharp from 'sharp'
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Dimensione massima (lato lungo) del thumbnail. */
const THUMB_SIZE = 480

/** Cartella cache dei thumbnail, in userData. */
function thumbDir(): string {
  return join(app.getPath('userData'), 'thumbnails')
}

export function ensureThumbDir(): string {
  const dir = thumbDir()
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Cache key: hash di path + mtime (invalida se il file cambia).
 */
function cacheKey(sourcePath: string, mtimeMs: number): string {
  return createHash('sha1').update(`${sourcePath}::${mtimeMs}`).digest('hex').slice(0, 24)
}

/**
 * Ritorna il path del thumbnail webp, generandolo se mancante o scaduto.
 * La cache è keyed per path+mtime, così cambiamenti al file rigenerano il thumb.
 */
export async function getThumbnailPath(sourcePath: string): Promise<string> {
  const dir = ensureThumbDir()
  const st = statSync(sourcePath)
  const key = cacheKey(sourcePath, st.mtimeMs)
  const out = join(dir, `${key}.webp`)
  if (existsSync(out)) return out

  await sharp(sourcePath)
    .rotate() // rispetta l'orientamento EXIF
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out)

  return out
}
