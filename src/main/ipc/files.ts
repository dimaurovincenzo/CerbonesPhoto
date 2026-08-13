import { ipcMain, shell } from 'electron'
import { getDb } from '../db/connection'
import { mapFile } from '../db/mappers'
import { rankSearchCandidates } from '@shared/search'
import type { MediaKind, SearchResult } from '@shared/types'

const MAX_SEARCH_RESULTS = 60

export function registerFilesIpc(): void {
  /** File multimediali diretti di una cartella. */
  ipcMain.handle('files:listByFolder', (_e, folderId: number) => {
    const rows = getDb()
      .prepare('SELECT * FROM files WHERE folder_id = ? ORDER BY name')
      .all(folderId) as Record<string, unknown>[]
    return rows.map(mapFile)
  })

  ipcMain.handle('files:search', (_e, rawQuery: string, requestedLimit?: number) => {
    const query = typeof rawQuery === 'string' ? rawQuery.trim().slice(0, 200) : ''
    if (query.length < 2) return []

    const limit = Math.min(Math.max(Number(requestedLimit) || MAX_SEARCH_RESULTS, 1), MAX_SEARCH_RESULTS)
    const db = getDb()
    const folders = db.prepare(
      `WITH RECURSIVE folder_context(id, collection_name) AS (
         SELECT id, COALESCE(display_name, name) FROM folders WHERE is_root = 1
         UNION ALL
         SELECT child.id, context.collection_name
         FROM folders AS child JOIN folder_context AS context ON child.parent_id = context.id
       )
       SELECT child.id, child.name, child.display_name, child.path, child.is_root,
              COALESCE(parent.display_name, parent.name, 'Raccolte') AS parent_name,
              COALESCE(context.collection_name, child.display_name, child.name) AS collection_name
       FROM folders AS child
       LEFT JOIN folders AS parent ON parent.id = child.parent_id
       LEFT JOIN folder_context AS context ON context.id = child.id
       WHERE child.is_root = 1 OR child.file_count > 0`
    ).all() as {
      id: number; name: string; display_name: string | null; path: string; is_root: number
      parent_name: string; collection_name: string
    }[]
    const files = db.prepare(
      `WITH RECURSIVE folder_context(id, collection_name) AS (
         SELECT id, COALESCE(display_name, name) FROM folders WHERE is_root = 1
         UNION ALL
         SELECT child.id, context.collection_name
         FROM folders AS child JOIN folder_context AS context ON child.parent_id = context.id
       )
       SELECT files.id, files.folder_id, files.name, files.kind, files.mime,
              COALESCE(folders.display_name, folders.name) AS folder_name,
              COALESCE(context.collection_name, folders.display_name, folders.name) AS collection_name
       FROM files
       JOIN folders ON folders.id = files.folder_id
       LEFT JOIN folder_context AS context ON context.id = folders.id`
    ).all() as {
      id: number; folder_id: number; name: string; kind: MediaKind; mime: string | null
      folder_name: string; collection_name: string
    }[]

    const results: SearchResult[] = []
    const rankedFiles = rankSearchCandidates(files, query)
    for (const file of rankedFiles) {
      results.push({
        resultKind: 'file', id: file.id, folderId: file.folder_id, name: file.name,
        folderName: file.folder_name === file.collection_name
          ? file.folder_name
          : `${file.folder_name} · ${file.collection_name}`,
        score: file.score + 20, mediaKind: file.kind, mime: file.mime
      })
    }
    const rankedFolders = rankSearchCandidates(
      folders.map((folder) => ({ ...folder, name: folder.display_name || folder.name })),
      query
    )
    for (const folder of rankedFolders) {
        results.push({
          resultKind: 'folder', id: folder.id, folderId: folder.id, name: folder.name,
          folderName: folder.is_root === 1 || folder.parent_name === folder.collection_name
            ? folder.parent_name
            : `${folder.parent_name} · ${folder.collection_name}`,
          score: folder.score, mediaKind: null, mime: null
        })
    }

    return results
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'it'))
      .slice(0, limit)
  })

  ipcMain.handle('files:open', async (_e, fileId: number) => {
    if (!Number.isSafeInteger(fileId) || fileId <= 0) throw new Error('File non valido')
    const row = getDb().prepare('SELECT path FROM files WHERE id = ?').get(fileId) as
      | { path: string }
      | undefined
    if (!row) throw new Error('File non trovato nell’indice')

    const error = await shell.openPath(row.path)
    if (error) throw new Error(`Impossibile aprire il file: ${error}`)
  })
}
