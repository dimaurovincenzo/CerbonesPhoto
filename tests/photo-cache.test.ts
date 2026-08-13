import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { PhotoCache, photoCacheKey } from '../src/main/photo/cache.ts'

const base = {
  sourcePath: '/foto/ritratto.cr3',
  sizeBytes: 100,
  mtimeMs: 1,
  pipelineVersion: 1,
  level: 'thumbnail' as const
}

test('la chiave cache cambia con contenuto, versione e livello', () => {
  assert.notEqual(photoCacheKey({ ...base, mtimeMs: 2 }), photoCacheKey(base))
  assert.notEqual(photoCacheKey({ ...base, pipelineVersion: 2 }), photoCacheKey(base))
  assert.notEqual(photoCacheKey({ ...base, level: 'preview' }), photoCacheKey(base))
  assert.equal(photoCacheKey(base), photoCacheKey({ ...base }))
})

test('prune elimina prima i derivati meno recenti e mai file esterni', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cerbonesphoto-cache-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const cache = new PhotoCache(join(directory, 'cache'))
  const oldPath = cache.pathFor('a'.repeat(64), 'thumbnail', 'webp')
  const newPath = cache.pathFor('b'.repeat(64), 'preview', 'webp')
  const external = join(directory, 'originale.cr3')
  await cache.ensureParent(oldPath)
  await cache.ensureParent(newPath)
  writeFileSync(oldPath, Buffer.alloc(10))
  writeFileSync(newPath, Buffer.alloc(10))
  writeFileSync(external, 'originale')
  utimesSync(oldPath, new Date(1_000), new Date(1_000))
  utimesSync(newPath, new Date(2_000), new Date(2_000))

  const result = await cache.prune(10)

  assert.equal(result.deletedFiles, 1)
  assert.equal(existsSync(oldPath), false)
  assert.equal(existsSync(newPath), true)
  assert.equal(existsSync(external), true)
})
