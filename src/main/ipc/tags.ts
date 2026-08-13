import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { mapTag } from '../db/mappers'
import type { CreateTagInput, SqlValue, UpdateTagPatch } from '@shared/types'

const now = (): number => Date.now()

export function registerTagsIpc(): void {
  ipcMain.handle('tags:list', () => {
    const rows = getDb().prepare('SELECT * FROM tags ORDER BY sort_order, name').all() as Record<string, unknown>[]
    return rows.map(mapTag)
  })

  ipcMain.handle('tags:create', (_e, input: CreateTagInput) => {
    const db = getDb()
    const name = input.name.trim()
    if (!name) throw new Error('Il nome del tag è obbligatorio')
    const info = db
      .prepare(`INSERT INTO tags (name, color, sort_order, created_at)
                VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM tags), 0), ?)`)
      .run(name, input.color, now())
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>
    return mapTag(row)
  })

  ipcMain.handle('tags:update', (_e, id: number, patch: UpdateTagPatch) => {
    const db = getDb()
    const sets: string[] = []
    const args: SqlValue[] = []
    if (patch.name !== undefined) { sets.push('name = ?'); args.push(patch.name.trim()) }
    if (patch.color !== undefined) { sets.push('color = ?'); args.push(patch.color) }
    if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder) }
    if (sets.length === 0) {
      const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Record<string, unknown>
      return mapTag(row)
    }
    args.push(id)
    db.prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Record<string, unknown>
    return mapTag(row)
  })

  /** cascade su folder_tags e file_tags. */
  ipcMain.handle('tags:remove', (_e, id: number) => {
    getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
  })
}
