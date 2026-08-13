import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { DerivativeService } from '../src/main/photo/derivative-service.ts'
import { PhotoCache } from '../src/main/photo/cache.ts'
import type { MediaFile } from '../src/shared/types.ts'

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

function mediaFile(path: string, isRaw = false): MediaFile {
  return {
    id: 7, folderId: 1, path, name: 'foto.jpg', kind: 'image', mime: 'image/jpeg',
    sizeBytes: null, sourceMtimeMs: null, width: null, height: null, durationMs: null, hash: null,
    isFavorite: false, metadataJson: null, processingState: 'pending', photoFormat: isRaw ? 'cr3' : 'jpg',
    isRaw, cameraMake: null, cameraModel: null, capturedAt: null, orientation: null,
    colorProfile: null, pipelineVersion: 1, processingErrorCode: null,
    processingErrorMessage: null, lastProcessedAt: null, createdAt: 1, updatedAt: 1
  }
}

test('genera thumbnail sRGB senza modificare l’originale', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cerbonesphoto-derivative-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'originale.jpg')
  await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#cc7733' } }).jpeg().toFile(source)
  const before = await sha256(source)
  const service = new DerivativeService({ cache: new PhotoCache(join(directory, 'cache')) })

  const result = await service.ensure(mediaFile(source), 'thumbnail', new AbortController().signal)

  assert.equal(await sha256(source), before)
  assert.equal(result.width <= 480 && result.height <= 480, true)
  assert.equal(result.mime, 'image/webp')
  assert.equal((await sharp(result.path).metadata()).space, 'srgb')
})

test('per un RAW usa preview incorporata e non scrive nella cartella originale', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cerbonesphoto-raw-derivative-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'originale.cr3')
  const embedded = join(directory, 'embedded.jpg')
  await writeFile(source, 'raw-originale')
  await sharp({ create: { width: 900, height: 600, channels: 3, background: '#224466' } }).jpeg().toFile(embedded)
  const before = await sha256(source)
  const rawHelper = {
    extractPreview: async (_source: string, output: string): Promise<void> => copyFile(embedded, output),
    render: async (): Promise<void> => { throw new Error('render non atteso') }
  }
  const service = new DerivativeService({ cache: new PhotoCache(join(directory, 'cache')), rawHelper })

  const result = await service.ensure(mediaFile(source, true), 'preview', new AbortController().signal)

  assert.equal(await sha256(source), before)
  assert.equal(result.width <= 2048 && result.height <= 2048, true)
  assert.equal((await readFile(source)).toString(), 'raw-originale')
})

test('se il RAW non ha preview incorporata usa il render temporaneo', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cerbonesphoto-raw-render-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = join(directory, 'originale.nef')
  await writeFile(source, 'raw-originale')
  let renders = 0
  const rawHelper = {
    extractPreview: async (): Promise<void> => { throw new Error('preview assente') },
    render: async (_source: string, output: string): Promise<void> => {
      renders += 1
      await sharp({ create: { width: 700, height: 500, channels: 3, background: '#335577' } }).tiff().toFile(output)
    }
  }
  const service = new DerivativeService({ cache: new PhotoCache(join(directory, 'cache')), rawHelper })

  const result = await service.ensure(mediaFile(source, true), 'thumbnail', new AbortController().signal)

  assert.equal(renders, 1)
  assert.equal(result.width <= 480 && result.height <= 480, true)
  assert.equal((await readFile(source)).toString(), 'raw-originale')
})
