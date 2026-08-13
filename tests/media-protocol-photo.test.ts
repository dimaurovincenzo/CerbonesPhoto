import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createPhotoProtocolResponse, parseIndexedMediaUrl } from '../src/main/media-protocol-photo.ts'

test('interpreta URL custom senza confondere host e pathname', () => {
  assert.deepEqual(parseIndexedMediaUrl('thumb://file/42'), { fileId: 42 })
  assert.deepEqual(parseIndexedMediaUrl('preview://file/42?level=preview'), { fileId: 42 })
  assert.equal(parseIndexedMediaUrl('thumb://evil/42'), null)
  assert.equal(parseIndexedMediaUrl('thumb://file/42/../../1'), null)
})

test('preview valida ID e livello senza esporre path locali', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cerbonesphoto-protocol-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const derivativePath = join(directory, 'preview.webp')
  await writeFile(derivativePath, 'webp')
  const rows = new Map<number, Record<string, unknown>>([
    [1, { id: 1, kind: 'image', processing_state: 'ready', processing_error_code: null }],
    [2, { id: 2, kind: 'image', processing_state: 'processing', processing_error_code: null }],
    [3, { id: 3, kind: 'image', processing_state: 'failed', processing_error_code: 'RAW_UNSUPPORTED' }]
  ])
  const database = {
    file: (id: number) => rows.get(id),
    derivative: (id: number, level: string) => id === 1 && level === 'preview'
      ? { path: derivativePath, mime: 'image/webp' }
      : undefined
  }

  const ok = await createPhotoProtocolResponse(new Request('preview://file/1?level=preview'), database)
  const pending = await createPhotoProtocolResponse(new Request('preview://file/2?level=preview'), database)
  const unsupported = await createPhotoProtocolResponse(new Request('preview://file/3?level=preview'), database)
  const missing = await createPhotoProtocolResponse(new Request('preview://file/99?level=preview'), database)
  const invalid = await createPhotoProtocolResponse(new Request('preview://file/1?level=original'), database)

  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('content-type'), 'image/webp')
  assert.equal(pending.status, 202)
  assert.equal(pending.headers.get('retry-after'), '1')
  assert.equal(unsupported.status, 415)
  assert.equal(missing.status, 404)
  assert.equal(invalid.status, 400)
  assert.equal((await unsupported.text()).includes(directory), false)
})
