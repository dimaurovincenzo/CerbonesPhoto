import { ipcMain } from 'electron'
import { getDb } from '../db/connection'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_e, key: string) => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value?: string }
      | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value)
  })

  ipcMain.handle('settings:getAll', () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    return out
  })
}
