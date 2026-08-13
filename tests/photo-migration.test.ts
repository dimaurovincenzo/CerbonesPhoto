import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { build } from 'esbuild'

test('migra il catalogo v4 preservando tag e creando un backup', async (t) => {
  const userData = mkdtempSync(join(tmpdir(), 'cerbonesphoto-migration-'))
  const dbPath = join(userData, 'cartelli.db')
  const bundlePath = join(userData, 'migration-test.mjs')
  t.after(() => rmSync(userData, { recursive: true, force: true }))

  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE folders (
      id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES folders(id), path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL, display_name TEXT, is_root INTEGER NOT NULL DEFAULT 0, color TEXT, icon TEXT,
      cover_path TEXT, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0, last_scanned_at INTEGER,
      file_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE files (
      id INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL REFERENCES folders(id), path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL, kind TEXT NOT NULL, mime TEXT, size_bytes INTEGER, width INTEGER, height INTEGER,
      duration_ms INTEGER, hash TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, metadata_json TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE, color TEXT, sort_order INTEGER DEFAULT 0, created_at INTEGER);
    CREATE TABLE file_tags (file_id INTEGER REFERENCES files(id), tag_id INTEGER REFERENCES tags(id), PRIMARY KEY(file_id, tag_id));
    CREATE TABLE categories (id INTEGER PRIMARY KEY, parent_id INTEGER, name TEXT, color TEXT, icon TEXT, sort_order INTEGER DEFAULT 0, created_at INTEGER);
    CREATE TABLE folder_tags (folder_id INTEGER, tag_id INTEGER, PRIMARY KEY(folder_id, tag_id));
    CREATE TABLE folder_categories (folder_id INTEGER, category_id INTEGER, PRIMARY KEY(folder_id, category_id));
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO folders VALUES (1, NULL, '/foto', 'Foto', NULL, 1, NULL, NULL, NULL, NULL, 0, NULL, 1, 1, 1);
    INSERT INTO files VALUES (1, 1, '/foto/a.jpg', 'a.jpg', 'image', 'image/jpeg', 10, NULL, NULL, NULL, NULL, 0, NULL, 1, 1);
    INSERT INTO tags VALUES (1, 'Famiglia', '#ff9f0a', 0, 1);
    INSERT INTO file_tags VALUES (1, 1);
    PRAGMA user_version = 4;
  `)
  db.close()

  await build({
    stdin: {
      contents: `
        import { openDb, closeDb } from './src/main/db/connection.ts'
        import { runMigrations, CURRENT_VERSION } from './src/main/db/migrations.ts'
        export function migrate() { const db = openDb(); runMigrations(); return { db, version: CURRENT_VERSION, closeDb } }
      `,
      resolveDir: new URL('..', import.meta.url).pathname,
      sourcefile: 'migration-entry.ts'
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    plugins: [
      {
        name: 'raw-sql',
        setup(buildApi) {
          buildApi.onLoad({ filter: /schema\.sql$/ }, async () => ({
            contents: await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main/db/schema.sql', import.meta.url), 'utf8')),
            loader: 'text'
          }))
        }
      },
      {
        name: 'stub-electron',
        setup(buildApi) {
          buildApi.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'test-stub' }))
          buildApi.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({
            contents: `export const app = { getPath: () => process.env.TEST_USER_DATA }`, loader: 'js'
          }))
        }
      }
    ],
    outfile: bundlePath
  })

  process.env.TEST_USER_DATA = userData
  const module = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`) as {
    migrate: () => { db: DatabaseSync; version: number; closeDb: () => void }
  }
  const migrated = module.migrate()
  t.after(() => migrated.closeDb())

  assert.equal(migrated.version, 5)
  assert.equal((migrated.db.prepare('PRAGMA user_version').get() as Record<string, number>)['user_version'], 5)
  assert.equal((migrated.db.prepare('SELECT COUNT(*) count FROM file_tags').get() as Record<string, number>)['count'], 1)
  assert.deepEqual({ ...migrated.db.prepare('SELECT processing_state, is_raw FROM files').get() }, {
    processing_state: 'pending', is_raw: 0
  })
  assert.equal((migrated.db.prepare("SELECT COUNT(*) count FROM sqlite_schema WHERE name='file_derivatives'").get() as Record<string, number>)['count'], 1)
  assert.deepEqual(migrated.db.prepare('PRAGMA foreign_key_check').all(), [])
  assert.equal(existsSync(join(userData, 'catalog.pre-v5.sqlite')), true)
})
