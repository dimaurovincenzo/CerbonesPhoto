import schema from './schema.sql?raw'
import { getDb } from './connection'

/**
 * Migrazioni schema basate su `PRAGMA user_version`.
 * Ogni versione è idempotente (CREATE TABLE IF NOT EXISTS) e applicata in ordine.
 */
const CURRENT_VERSION = 4

export function runMigrations(): void {
  const db = getDb()

  // v1: schema base.
  // Le DDL usano IF NOT EXISTS → sicure anche su DB già esistenti.
  if (readVersion(db) < 1) {
    db.exec(schema)
    setVersion(db, 1)
  }

  if (readVersion(db) < 2) {
    migrateFilesForVideo(db)
    setVersion(db, 2)
  }

  if (readVersion(db) < 3) {
    // `.ts` è ambiguo con TypeScript e nelle raccolte software produceva
    // migliaia di falsi video. Si rimuove solo il riferimento dall'indice.
    db.prepare("DELETE FROM files WHERE kind = 'video' AND lower(name) LIKE '%.ts'").run()
    setVersion(db, 3)
  }

  if (readVersion(db) < 4) {
    const columns = db.prepare('PRAGMA table_info(tags)').all() as { name: string }[]
    if (!columns.some((column) => column.name === 'sort_order')) {
      db.exec('ALTER TABLE tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
    }
    setVersion(db, 4)
  }

  // Future migrazioni:
  // if (readVersion(db) < 2) { db.exec('ALTER TABLE ...'); setVersion(db, 2) }
}

function migrateFilesForVideo(db: ReturnType<typeof getDb>): void {
  const row = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'files'").get() as
    | { sql: string }
    | undefined
  if (row?.sql.includes("'video'")) return

  db.exec('PRAGMA foreign_keys = OFF')
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE files_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('audio','image','video','other')),
        mime TEXT,
        size_bytes INTEGER,
        width INTEGER,
        height INTEGER,
        duration_ms INTEGER,
        hash TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
        metadata_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO files_v2 SELECT * FROM files;

      CREATE TABLE file_tags_v2 (
        file_id INTEGER NOT NULL REFERENCES files_v2(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (file_id, tag_id)
      );
      INSERT INTO file_tags_v2 SELECT * FROM file_tags;

      DROP TABLE file_tags;
      DROP TABLE files;
      ALTER TABLE files_v2 RENAME TO files;
      ALTER TABLE file_tags_v2 RENAME TO file_tags;
      CREATE INDEX idx_files_folder ON files(folder_id);
      CREATE INDEX idx_files_kind ON files(kind);
      CREATE INDEX idx_file_tags_tag ON file_tags(tag_id);
      COMMIT;
    `)
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* transaction already closed */ }
    throw error
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }

  const violations = db.prepare('PRAGMA foreign_key_check').all()
  if (violations.length > 0) throw new Error('Migrazione media v2: riferimenti SQLite non validi')
}

function readVersion(db: ReturnType<typeof getDb>): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | null
  return row?.user_version ?? 0
}

function setVersion(db: ReturnType<typeof getDb>, version: number): void {
  db.exec(`PRAGMA user_version = ${version}`)
}

export { CURRENT_VERSION }
