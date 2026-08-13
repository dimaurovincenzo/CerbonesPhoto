import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import sharp from 'sharp'
import { PhotoCache } from '../src/main/photo/cache.ts'
import { DerivativeService } from '../src/main/photo/derivative-service.ts'
import { MacImageHelper } from '../src/main/photo/mac-image-helper.ts'
import { photoFormatFromPath } from '../src/shared/media-formats.ts'
import type { MediaFile } from '../src/shared/types.ts'

const execFileAsync = promisify(execFile)

test('matrice standard: JPEG PNG TIFF HEIC HEIF WebP BMP e AVIF', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cerbonesphoto-standard-matrix-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const base = join(directory, 'base.png')
  const image = sharp({ create: { width: 640, height: 480, channels: 3, background: '#9b5522' } })
  await image.png().toFile(base)
  const paths = {
    jpg: join(directory, 'foto.jpg'),
    png: join(directory, 'foto.png'),
    tif: join(directory, 'foto.tif'),
    heic: join(directory, 'foto.heic'),
    heif: join(directory, 'foto.heif'),
    webp: join(directory, 'foto.webp'),
    bmp: join(directory, 'foto.bmp'),
    avif: join(directory, 'foto.avif')
  }
  await Promise.all([
    sharp(base).jpeg().toFile(paths.jpg),
    copyFile(base, paths.png),
    sharp(base).tiff().toFile(paths.tif),
    sharp(base).webp().toFile(paths.webp),
    sharp(base).avif().toFile(paths.avif),
    execFileAsync('/usr/bin/sips', ['-s', 'format', 'heic', base, '--out', paths.heic]),
    execFileAsync('/usr/bin/sips', ['-s', 'format', 'bmp', base, '--out', paths.bmp])
  ])
  await copyFile(paths.heic, paths.heif)

  const service = new DerivativeService({
    cache: new PhotoCache(join(directory, 'cache')),
    standardFallback: new MacImageHelper()
  })
  let id = 1
  for (const [extension, source] of Object.entries(paths)) {
    const info = await stat(source)
    const before = await sha256(source)
    const derivative = await service.ensure(mediaFile(id++, source, info.size, info.mtimeMs), 'preview', new AbortController().signal)
    assert.equal(photoFormatFromPath(source)?.family, 'standard', extension)
    assert.equal((await sharp(derivative.path).metadata()).space, 'srgb', extension)
    assert.equal(await sha256(source), before, extension)
  }
})

function mediaFile(id: number, path: string, sizeBytes: number, sourceMtimeMs: number): MediaFile {
  const format = photoFormatFromPath(path)
  return {
    id, folderId: 1, path, name: path.split('/').at(-1) ?? path, kind: 'image', mime: format?.mime ?? null,
    sizeBytes, sourceMtimeMs, width: null, height: null, durationMs: null, hash: null, isFavorite: false,
    metadataJson: null, processingState: 'pending', photoFormat: format?.extension ?? null, isRaw: false,
    cameraMake: null, cameraModel: null, capturedAt: null, orientation: null, colorProfile: null,
    pipelineVersion: 1, processingErrorCode: null, processingErrorMessage: null, lastProcessedAt: null,
    createdAt: 1, updatedAt: 1
  }
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}
