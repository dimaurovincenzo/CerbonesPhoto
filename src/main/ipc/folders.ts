import { ipcMain } from 'electron'
import { basename } from 'path'
import { existsSync, statSync } from 'fs'
import { getDb } from '../db/connection'
import { mapCategory, mapFolder, mapTag } from '../db/mappers'
import { scanRoot } from '../scanner'
import type { AddRootFolderInput, SqlValue, UpdateFolderPatch } from '@shared/types'
import type { PhotoRuntime } from '../photo/photo-runtime'

const now = (): number => Date.now()

function assertValidRootPath(p: string): void {
  if (!p || typeof p !== 'string') throw new Error('Percorso non valido')
  if (!existsSync(p)) throw new Error(`Il percorso non esiste: ${p}`)
  if (!statSync(p).isDirectory()) throw new Error(`Non è una cartella: ${p}`)
}

export function registerFoldersIpc(photoRuntime: PhotoRuntime): void {
  ipcMain.handle('folders:listRoots', () => {
    const rows = getDb()
      .prepare('SELECT * FROM folders WHERE is_root = 1 ORDER BY sort_order, name')
      .all() as Record<string, unknown>[]
    return rows.map(mapFolder)
  })

  /** Tutti i folder (root + discendenti), flat. Il renderer ricostruisce l'albero. */
  ipcMain.handle('folders:listAll', () => {
    const rows = getDb()
      .prepare(
        `SELECT * FROM folders
         ORDER BY is_root DESC, COALESCE(parent_id, id), sort_order, name`
      )
      .all() as Record<string, unknown>[]
    return rows.map(mapFolder)
  })

  /** Indice folder_id → tagIds[] e folder_id → categoryIds[] per filtri e inspector. */
  ipcMain.handle('folders:labelIndex', () => {
    const tagRows = getDb().prepare('SELECT folder_id, tag_id FROM folder_tags').all() as {
      folder_id: number
      tag_id: number
    }[]
    const catRows = getDb()
      .prepare('SELECT folder_id, category_id FROM folder_categories')
      .all() as { folder_id: number; category_id: number }[]
    const tags: Record<number, number[]> = {}
    for (const t of tagRows) (tags[t.folder_id] ??= []).push(t.tag_id)
    const categories: Record<number, number[]> = {}
    for (const c of catRows) (categories[c.folder_id] ??= []).push(c.category_id)
    return { tags, categories }
  })

  ipcMain.handle('folders:get', (_e, id: number) => {
    const row = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    return row ? mapFolder(row) : null
  })

  /** Tutti i discendenti di una root (esclusa la root), via CTE ricorsiva. */
  ipcMain.handle('folders:getChildren', (_e, rootId: number) => {
    const db = getDb()
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
  })

  /** Aggiunge una root e ne scansiona subito le sottocartelle. */
  ipcMain.handle('folders:addRoot', async (_e, input: AddRootFolderInput) => {
    assertValidRootPath(input.path)
    const db = getDb()
    const ts = now()
    const name = input.name?.trim() || basename(input.path)
    const info = db
      .prepare(
        `INSERT INTO folders
           (parent_id, path, name, display_name, is_root, color, icon, sort_order, created_at, updated_at)
         VALUES (NULL, ?, ?, NULL, 1, ?, ?, 0, ?, ?)`
      )
      .run(input.path, name, input.color ?? null, input.icon ?? null, ts, ts)
    const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>
    const root = mapFolder(row)
    const children = await scanRoot(root.id)
    photoRuntime.enqueuePending()
    return { root, children }
  })

  ipcMain.handle('folders:scan', async (_e, id: number) => {
    const children = await scanRoot(id)
    photoRuntime.enqueuePending()
    return children
  })

  ipcMain.handle('folders:update', (_e, id: number, patch: UpdateFolderPatch) => {
    const db = getDb()
    const sets: string[] = []
    const args: SqlValue[] = []
    if (patch.name !== undefined) { sets.push('name = ?'); args.push(patch.name) }
    if (patch.displayName !== undefined) { sets.push('display_name = ?'); args.push(patch.displayName) }
    if (patch.color !== undefined) { sets.push('color = ?'); args.push(patch.color) }
    if (patch.icon !== undefined) { sets.push('icon = ?'); args.push(patch.icon) }
    if (patch.coverPath !== undefined) { sets.push('cover_path = ?'); args.push(patch.coverPath) }
    if (patch.notes !== undefined) { sets.push('notes = ?'); args.push(patch.notes) }
    if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder) }
    sets.push('updated_at = ?'); args.push(now()); args.push(id)
    db.prepare(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Record<string, unknown>
    return mapFolder(row)
  })

  /** La rimozione è in cascade: elimina figli, file e tutte le associazioni tag/categoria. */
  ipcMain.handle('folders:remove', (_e, id: number) => {
    getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
  })

  // --- Tag della cartella (M:N) ---
  ipcMain.handle('folders:getTags', (_e, id: number) => {
    const rows = getDb()
      .prepare(
        `SELECT t.* FROM tags t
         JOIN folder_tags ft ON ft.tag_id = t.id
         WHERE ft.folder_id = ?
         ORDER BY t.name`
      )
      .all(id) as Record<string, unknown>[]
    return rows.map(mapTag)
  })

  ipcMain.handle('folders:setTags', (_e, id: number, tagIds: number[]) => {
    const db = getDb()
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM folder_tags WHERE folder_id = ?').run(id)
      const ins = db.prepare('INSERT OR IGNORE INTO folder_tags (folder_id, tag_id) VALUES (?, ?)')
      for (const tid of tagIds) ins.run(id, tid)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    const rows = getDb()
      .prepare(
        `SELECT t.* FROM tags t
         JOIN folder_tags ft ON ft.tag_id = t.id
         WHERE ft.folder_id = ?
         ORDER BY t.name`
      )
      .all(id) as Record<string, unknown>[]
    return rows.map(mapTag)
  })

  // --- Categorie della cartella (M:N) ---
  ipcMain.handle('folders:getCategories', (_e, id: number) => {
    const rows = getDb()
      .prepare(
        `SELECT c.* FROM categories c
         JOIN folder_categories fc ON fc.category_id = c.id
         WHERE fc.folder_id = ?
         ORDER BY c.sort_order, c.name`
      )
      .all(id) as Record<string, unknown>[]
    return rows.map(mapCategory)
  })

  ipcMain.handle('folders:setCategories', (_e, id: number, categoryIds: number[]) => {
    const db = getDb()
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM folder_categories WHERE folder_id = ?').run(id)
      const ins = db.prepare('INSERT OR IGNORE INTO folder_categories (folder_id, category_id) VALUES (?, ?)')
      for (const cid of categoryIds) ins.run(id, cid)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    const rows = getDb()
      .prepare(
        `SELECT c.* FROM categories c
         JOIN folder_categories fc ON fc.category_id = c.id
         WHERE fc.folder_id = ?
         ORDER BY c.sort_order, c.name`
      )
      .all(id) as Record<string, unknown>[]
    return rows.map(mapCategory)
  })
}
