/**
 * Tipi di dominio condivisi tra main process, preload e renderer.
 * Mappano le righe SQLite (snake_case) in oggetti TS (camelCase).
 */

export type MediaKind = 'audio' | 'image' | 'video' | 'other'

/** Valori accettati da node:sqlite come parametri/risultato delle query. */
export type SqlValue = string | number | bigint | Uint8Array | null

export interface Folder {
  id: number
  parentId: number | null
  path: string
  name: string
  displayName: string | null
  isRoot: boolean
  color: string | null
  icon: string | null
  coverPath: string | null
  notes: string | null
  sortOrder: number
  lastScannedAt: number | null
  fileCount: number
  createdAt: number
  updatedAt: number
}

export interface MediaFile {
  id: number
  folderId: number
  path: string
  name: string
  kind: MediaKind
  mime: string | null
  sizeBytes: number | null
  sourceMtimeMs: number | null
  width: number | null
  height: number | null
  durationMs: number | null
  hash: string | null
  isFavorite: boolean
  metadataJson: string | null
  processingState: import('./photo-types').PhotoProcessingState
  photoFormat: string | null
  isRaw: boolean
  cameraMake: string | null
  cameraModel: string | null
  capturedAt: string | null
  orientation: number | null
  colorProfile: string | null
  pipelineVersion: number
  processingErrorCode: string | null
  processingErrorMessage: string | null
  lastProcessedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface SearchResult {
  resultKind: 'folder' | 'file'
  id: number
  folderId: number
  name: string
  folderName: string
  score: number
  mediaKind: MediaKind | null
  mime: string | null
}

/** Nodo categoria con figli (costruito dal renderer lato UI). */
export interface Category {
  id: number
  parentId: number | null
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
}

export interface Tag {
  id: number
  name: string
  color: string
  sortOrder: number
  createdAt: number
}

/** DTO per aggiungere una cartella root dal renderer. */
export interface AddRootFolderInput {
  path: string
  name?: string | null
  color?: string | null
  icon?: string | null
}

/** Risultato di addRoot: la root appena creata + i figli scoperti dallo scanner. */
export interface AddRootResult {
  root: Folder
  children: Folder[]
}

/** Indice folder_id → tagIds[] e folder_id → categoryIds[]. */
export interface FolderLabelIndex {
  tags: Record<number, number[]>
  categories: Record<number, number[]>
}

export interface UpdateFolderPatch {
  name?: string
  displayName?: string | null
  color?: string | null
  icon?: string | null
  coverPath?: string | null
  notes?: string | null
  sortOrder?: number
}

export interface CreateTagInput {
  name: string
  color: string
}

export interface UpdateTagPatch {
  name?: string
  color?: string
  sortOrder?: number
}

export interface CreateCategoryInput {
  name: string
  parentId?: number | null
  color?: string | null
  icon?: string | null
}

export interface UpdateCategoryPatch {
  name?: string
  parentId?: number | null
  color?: string | null
  icon?: string | null
  sortOrder?: number
}
