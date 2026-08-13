import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { build } from 'esbuild'

test('la nuova scansione rimuove dall’indice file eliminati o non più multimediali', async (t) => {
  const rootPath = mkdtempSync(join(tmpdir(), 'cerbonesphoto-scanner-'))
  const bundlePath = join(rootPath, 'scanner-test.mjs')
  await build({
    entryPoints: [new URL('../src/main/scanner.ts', import.meta.url).pathname],
    bundle: true,
    platform: 'node',
    format: 'esm',
    plugins: [{
      name: 'stub-electron',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'test-stub' }))
        buildApi.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({
          contents: 'export const app = { getPath: () => "/tmp" }',
          loader: 'js'
        }))
      }
    }],
    alias: { '@shared': new URL('../src/shared', import.meta.url).pathname },
    outfile: bundlePath
  })
  const { scanRoot } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`) as {
    scanRoot: (rootId: number, database: DatabaseSync) => Promise<unknown>
  }
  const db = new DatabaseSync(':memory:')
  t.after(() => {
    db.close()
    rmSync(rootPath, { recursive: true, force: true })
  })

  db.exec(readFileSync(new URL('../src/main/db/schema.sql', import.meta.url), 'utf8'))
  const ts = Date.now() - 10_000
  const root = db.prepare(
    `INSERT INTO folders (path, name, is_root, created_at, updated_at)
     VALUES (?, 'Media', 1, ?, ?)`
  ).run(rootPath, ts, ts)
  db.prepare(
    `INSERT INTO files (folder_id, path, name, kind, mime, created_at, updated_at)
     VALUES (?, ?, 'source.ts', 'video', 'video/mp2t', ?, ?)`
  ).run(root.lastInsertRowid, join(rootPath, 'source.ts'), ts, ts)

  writeFileSync(join(rootPath, 'source.ts'), 'export const value = 1')
  writeFileSync(join(rootPath, 'foto.jpg'), 'jpeg fixture')
  writeFileSync(join(rootPath, 'fotocamera.cr3'), 'raw fixture')

  await scanRoot(Number(root.lastInsertRowid), db)

  const rows = db.prepare('SELECT name, kind, photo_format, is_raw, source_mtime_ms FROM files ORDER BY name').all()
    .map((row) => ({
      name: row['name'], kind: row['kind'], photoFormat: row['photo_format'],
      isRaw: row['is_raw'], hasMtime: Number(row['source_mtime_ms']) > 0
    }))
  assert.deepEqual(rows, [
    { name: 'foto.jpg', kind: 'image', photoFormat: 'jpg', isRaw: 0, hasMtime: true },
    { name: 'fotocamera.cr3', kind: 'image', photoFormat: 'cr3', isRaw: 1, hasMtime: true }
  ])
})
