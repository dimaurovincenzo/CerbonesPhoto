import type { DatabaseSync } from 'node:sqlite'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { getDb } from './db/connection'
import { mapFolder } from './db/mappers'
import type { Folder } from '@shared/types'
import { MEDIA_MIME, photoFormatFromPath } from '@shared/media-formats'
import { walkMedia } from './scanner-batch'

/** Directory da ignorare sempre durante la scansione. */
const BLACKLIST = new Set(['node_modules', '.git', '.svn', '.hg', 'CVS', '$RECYCLE.BIN'])

export const MIME = MEDIA_MIME

const now = (): number => Date.now()

interface TreeNode {
  path: string
  name: string
  children: TreeNode[]
}

/**
 * Scansiona ricorsivamente la root: upsert delle sottocartelle nel DB e
 * scoperta dei file multimediali (immagini, audio e video) in ogni cartella.
 * Riconosce cartelle e file già presenti (path UNIQUE) e ripulisce dall'indice
 * i file rimossi o non più classificabili come media.
 * Ritorna tutti i discendenti cartella (esclusa la root).
 */
export async function scanRoot(rootId: number, db: DatabaseSync = getDb()): Promise<Folder[]> {
  const root = db.prepare('SELECT path FROM folders WHERE id = ?').get(rootId) as
    | { path: string }
    | undefined
  if (!root) throw new Error(`Cartella root ${rootId} non trovata`)

  const tree = await buildTree(root.path)
  const ts = now()

  insertTree(db, tree, rootId, ts)
  // Ogni cartella usa transazioni corte; la scansione non blocca SQLite per l'intero albero.
  const folders = getSelfAndDescendantFolders(db, rootId)
  for (const f of folders) {
    const count = await scanFilesOfFolder(db, f.id, f.path, ts)
    db.prepare('UPDATE folders SET file_count = ? WHERE id = ?').run(count, f.id)
  }
  db.prepare('UPDATE folders SET last_scanned_at = ? WHERE id = ?').run(ts, rootId)

  return getDescendants(db, rootId)
}

/** Cammina ricorsivamente il filesystem costruendo un albero di sole directory. */
async function buildTree(dir: string): Promise<TreeNode[]> {
  const out: TreeNode[] = []
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return out // permessi / non leggibile: skip silenzioso
  }
  for (const name of entries) {
    if (name.startsWith('.') || BLACKLIST.has(name)) continue
    const full = join(dir, name)
    let s
    try {
      s = await stat(full)
    } catch {
      continue
    }
    if (!s.isDirectory()) continue
    out.push({ path: full, name, children: await buildTree(full) })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'it'))
  return out
}

/** Inserisce l'albero nel DB risolvendo i parentId durante la discesa DFS. */
function insertTree(db: DatabaseSync, nodes: TreeNode[], parentId: number, ts: number): void {
  const upsert = db.prepare(
    `INSERT INTO folders (parent_id, path, name, is_root, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       parent_id = excluded.parent_id,
       name      = excluded.name,
       updated_at = excluded.updated_at`
  )
  const getId = db.prepare('SELECT id FROM folders WHERE path = ?')
  for (const n of nodes) {
    upsert.run(parentId, n.path, n.name, ts, ts)
    const row = getId.get(n.path) as { id: number }
    if (n.children.length) insertTree(db, n.children, row.id, ts)
  }
}

/** Scopre i file multimediali di una cartella e fa upsert nella tabella files. */
async function scanFilesOfFolder(db: DatabaseSync, folderId: number, folderPath: string, ts: number): Promise<number> {
  const upsert = db.prepare(
    `INSERT INTO files
       (folder_id, path, name, kind, mime, size_bytes, source_mtime_ms, photo_format, is_raw, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       folder_id   = excluded.folder_id,
       name        = excluded.name,
       kind        = excluded.kind,
       mime        = excluded.mime,
       size_bytes  = excluded.size_bytes,
       source_mtime_ms = excluded.source_mtime_ms,
       photo_format = excluded.photo_format,
       is_raw = excluded.is_raw,
       processing_state = CASE
         WHEN files.source_mtime_ms IS NOT excluded.source_mtime_ms OR files.size_bytes IS NOT excluded.size_bytes
         THEN 'pending' ELSE files.processing_state END,
       processing_error_code = CASE
         WHEN files.source_mtime_ms IS NOT excluded.source_mtime_ms OR files.size_bytes IS NOT excluded.size_bytes
         THEN NULL ELSE files.processing_error_code END,
       processing_error_message = CASE
         WHEN files.source_mtime_ms IS NOT excluded.source_mtime_ms OR files.size_bytes IS NOT excluded.size_bytes
         THEN NULL ELSE files.processing_error_message END,
       updated_at  = excluded.updated_at`
  )
  const seenPaths = new Set<string>()
  let count = 0
  let complete = false
  for await (const batch of walkMedia(folderPath)) {
    complete = batch.complete
    if (batch.entries.length === 0) continue
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const entry of batch.entries) {
        const format = entry.kind === 'image' ? photoFormatFromPath(entry.path) : null
        upsert.run(
          folderId, entry.path, entry.name, entry.kind, entry.mime, entry.sizeBytes, entry.mtimeMs,
          format?.extension ?? null, format?.family === 'raw' ? 1 : 0, ts, ts
        )
        seenPaths.add(entry.path)
        count++
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  if (!complete) {
    // Un errore temporaneo non deve cancellare dati già indicizzati.
    const row = db.prepare('SELECT COUNT(*) AS count FROM files WHERE folder_id = ?').get(folderId) as { count: number }
    return row.count
  }

  const indexed = db.prepare('SELECT id, path FROM files WHERE folder_id = ?').all(folderId) as {
    id: number; path: string
  }[]
  const remove = db.prepare('DELETE FROM files WHERE id = ?')
  for (const file of indexed) {
    if (!seenPaths.has(file.path)) remove.run(file.id)
  }
  return count
}

/** Root + tutti i discendenti (id, path), via CTE ricorsiva. */
function getSelfAndDescendantFolders(db: DatabaseSync, rootId: number): { id: number; path: string }[] {
  return db
    .prepare(
      `WITH RECURSIVE d(id) AS (
         SELECT id FROM folders WHERE id = ?
         UNION ALL
         SELECT f.id FROM folders f JOIN d ON f.parent_id = d.id
       )
       SELECT f.id, f.path FROM folders f JOIN d ON f.id = d.id`
    )
    .all(rootId) as { id: number; path: string }[]
}

function getDescendants(db: DatabaseSync, rootId: number): Folder[] {
  const rows = db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
         SELECT id FROM folders WHERE parent_id = ?
         UNION ALL
         SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
       )
       SELECT f.* FROM folders f
       JOIN descendants d ON f.id = d.id
       ORDER BY f.parent_id, f.sort_order, f.name`
    )
    .all(rootId) as Record<string, unknown>[]
  return rows.map(mapFolder)
}
