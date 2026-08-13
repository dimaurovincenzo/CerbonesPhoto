import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { mapCategory } from '../db/mappers'
import type { CreateCategoryInput, SqlValue, UpdateCategoryPatch } from '@shared/types'

const now = (): number => Date.now()

export function registerCategoriesIpc(): void {
  /** Lista piatta; il renderer ricostruisce l'albero via parentId. */
  ipcMain.handle('categories:list', () => {
    const rows = getDb()
      .prepare('SELECT * FROM categories ORDER BY sort_order, name')
      .all() as Record<string, unknown>[]
    return rows.map(mapCategory)
  })

  ipcMain.handle('categories:create', (_e, input: CreateCategoryInput) => {
    const db = getDb()
    const name = input.name.trim()
    if (!name) throw new Error('Il nome della categoria è obbligatorio')
    const info = db
      .prepare(
        `INSERT INTO categories (parent_id, name, color, icon, sort_order, created_at)
         VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM categories WHERE parent_id IS ?), 0), ?)`
      )
      .run(input.parentId ?? null, name, input.color ?? null, input.icon ?? null, input.parentId ?? null, now())
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>
    return mapCategory(row)
  })

  ipcMain.handle('categories:update', (_e, id: number, patch: UpdateCategoryPatch) => {
    const db = getDb()
    const sets: string[] = []
    const args: SqlValue[] = []
    if (patch.name !== undefined) { sets.push('name = ?'); args.push(patch.name) }
    if (patch.parentId !== undefined) { sets.push('parent_id = ?'); args.push(patch.parentId) }
    if (patch.color !== undefined) { sets.push('color = ?'); args.push(patch.color) }
    if (patch.icon !== undefined) { sets.push('icon = ?'); args.push(patch.icon) }
    if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder) }
    if (sets.length === 0) {
      const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Record<string, unknown>
      return mapCategory(row)
    }
    args.push(id)
    db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Record<string, unknown>
    return mapCategory(row)
  })

  /** cascade: rimuove i figli e le associazioni folder_categories. */
  ipcMain.handle('categories:remove', (_e, id: number) => {
    getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
  })
}
