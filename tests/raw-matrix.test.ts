import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { PhotoCache } from '../src/main/photo/cache.ts'
import { DerivativeService } from '../src/main/photo/derivative-service.ts'
import { ExifToolService } from '../src/main/photo/exiftool-service.ts'
import { normalizePhotoMetadata } from '../src/main/photo/metadata-normalizer.ts'
import { RawHelper } from '../src/main/photo/raw-helper.ts'
import { photoFormatFromPath } from '../src/shared/media-formats.ts'
import type { MediaFile } from '../src/shared/types.ts'

interface RawFixture {
  file: string
  sha256: string
  vendor: string
  cameraModel: string
  format: string
  sourceUrl: string
  license: string
  expectedOutcome: 'ready' | 'partial'
}

test('matrice RAW CC0: metadata, preview sRGB e originali immutati', async (t) => {
  const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'raw')
  const manifest = JSON.parse(await readFile(join(fixtureRoot, 'MANIFEST.json'), 'utf8')) as RawFixture[]
  const required = ['cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'dng', 'pef']
  assert.deepEqual([...new Set(manifest.map((entry) => entry.format))].sort(), required.sort())
  for (const entry of manifest) {
    assert.equal(entry.license, 'CC0-1.0')
    assert.match(entry.sourceUrl, /^https:\/\/raw\.pixls\.us\//)
    assert.match(entry.sha256, /^[a-f0-9]{64}$/)
  }

  const cacheRoot = await mkdtemp(join(tmpdir(), 'cerbonesphoto-raw-matrix-'))
  t.after(() => rm(cacheRoot, { recursive: true, force: true }))
  const exifTool = new ExifToolService()
  t.after(() => exifTool.close())
  const rawHelper = new RawHelper({
    simpleDcrawPath: join(process.cwd(), 'resources', 'bin', 'darwin-arm64', 'simple_dcraw'),
    timeoutMs: 30_000
  })
  const derivatives = new DerivativeService({ cache: new PhotoCache(cacheRoot), rawHelper })
  const results: Record<string, unknown>[] = []

  for (const [index, fixture] of manifest.entries()) {
    await t.test(`${fixture.vendor} ${fixture.cameraModel} .${fixture.format}`, async () => {
      const sourcePath = join(fixtureRoot, fixture.file)
      const sourceInfo = await stat(sourcePath)
      const before = await sha256(sourcePath)
      assert.equal(before, fixture.sha256)
      const format = photoFormatFromPath(sourcePath)
      assert.equal(format?.family, 'raw')
      const file = mediaFile(index + 1, sourcePath, fixture, sourceInfo.size, sourceInfo.mtimeMs)
      const metadata = normalizePhotoMetadata(await exifTool.read(sourcePath, new AbortController().signal))
      assert.ok(metadata.cameraMake || metadata.cameraModel)

      const thumbnail = await derivatives.ensure(file, 'thumbnail', new AbortController().signal)
      const preview = await derivatives.ensure(file, 'preview', new AbortController().signal)
      const previewMetadata = await sharp(preview.path).metadata()
      assert.equal(thumbnail.width <= 480 && thumbnail.height <= 480, true)
      assert.equal(preview.width <= 2048 && preview.height <= 2048, true)
      assert.equal(previewMetadata.space, 'srgb')
      assert.equal(await sha256(sourcePath), before)
      assert.equal(fixture.expectedOutcome, 'ready')
      results.push({
        format: fixture.format,
        vendor: fixture.vendor,
        cameraModel: fixture.cameraModel,
        outcome: 'ready',
        metadata: { width: metadata.width, height: metadata.height, orientation: metadata.orientation },
        thumbnail: { width: thumbnail.width, height: thumbnail.height },
        preview: { width: preview.width, height: preview.height }
      })
    })
  }

  const reportPath = join(process.cwd(), 'artifacts', 'photo-qa', 'raw-matrix.json')
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`)
})

function mediaFile(
  id: number,
  path: string,
  fixture: RawFixture,
  sizeBytes: number,
  sourceMtimeMs: number
): MediaFile {
  return {
    id, folderId: 1, path, name: fixture.file, kind: 'image', mime: photoFormatFromPath(path)?.mime ?? null,
    sizeBytes, sourceMtimeMs, width: null, height: null, durationMs: null, hash: fixture.sha256,
    isFavorite: false, metadataJson: null, processingState: 'pending', photoFormat: fixture.format,
    isRaw: true, cameraMake: null, cameraModel: null, capturedAt: null, orientation: null,
    colorProfile: null, pipelineVersion: 1, processingErrorCode: null, processingErrorMessage: null,
    lastProcessedAt: null, createdAt: 1, updatedAt: 1
  }
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}
