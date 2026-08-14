/**
 * Contratto dell'API esposta dal main process al renderer via contextBridge.
 * Il preload implementa questa interfaccia; il renderer la consuma via `window.cartelli`.
 */
import type {
  AddRootFolderInput,
  AddRootResult,
  Category,
  CreateCategoryInput,
  CreateTagInput,
  Folder,
  FolderLabelIndex,
  MediaFile,
  SearchResult,
  Tag,
  UpdateCategoryPatch,
  UpdateFolderPatch,
  UpdateTagPatch
} from './types'
import type { PhotoEngineHealth, PhotoPipelineSnapshot } from './photo-types'
import type { UpdateSnapshot } from './update-types'

export interface FoldersApi {
  listRoots: () => Promise<Folder[]>
  /** Tutti i folder (root + discendenti), flat. */
  listAll: () => Promise<Folder[]>
  /** Indice folder_id → tagIds[] e folder_id → categoryIds[]. */
  labelIndex: () => Promise<FolderLabelIndex>
  get: (id: number) => Promise<Folder | null>
  /** Sottoalbero completo a partire da una cartella root (inclusi discendenti piatti). */
  getChildren: (id: number) => Promise<Folder[]>
  /** Aggiunge una root e ne scansiona subito le sottocartelle. */
  addRoot: (input: AddRootFolderInput) => Promise<AddRootResult>
  /** Ri-scansiona una root esistente (scopre nuove sottocartelle). */
  scan: (id: number) => Promise<Folder[]>
  update: (id: number, patch: UpdateFolderPatch) => Promise<Folder>
  remove: (id: number) => Promise<void>
  getTags: (id: number) => Promise<Tag[]>
  setTags: (id: number, tagIds: number[]) => Promise<Tag[]>
  getCategories: (id: number) => Promise<Category[]>
  setCategories: (id: number, categoryIds: number[]) => Promise<Category[]>
}

export interface TagsApi {
  list: () => Promise<Tag[]>
  create: (input: CreateTagInput) => Promise<Tag>
  update: (id: number, patch: UpdateTagPatch) => Promise<Tag>
  remove: (id: number) => Promise<void>
}

export interface CategoriesApi {
  list: () => Promise<Category[]>
  create: (input: CreateCategoryInput) => Promise<Category>
  update: (id: number, patch: UpdateCategoryPatch) => Promise<Category>
  remove: (id: number) => Promise<void>
}

export interface SettingsApi {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  getAll: () => Promise<Record<string, string>>
}

export interface DialogsApi {
  /** Apre il dialog nativo di selezione cartella. Ritorna il path assoluto o null. */
  pickDirectory: () => Promise<string | null>
  confirmFolderRemoval: (name: string) => Promise<boolean>
  confirmLabelRemoval: (kind: 'tag' | 'categoria', name: string) => Promise<boolean>
}

export interface EventsApi {
  /** Sottoscrive le azioni provenienti dal menu app. Ritorna una funzione di unsubscribe. */
  onMenuAction: (cb: (action: string) => void) => () => void
}

export interface WebUtilsApi {
  /** Path assoluto di un File rilasciato via drag&drop dal Finder. */
  pathForFile: (file: File) => string
}

export interface FilesApi {
  /** File multimediali diretti di una cartella (non ricorsivo). */
  listByFolder: (folderId: number) => Promise<MediaFile[]>
  /** Ricerca globale offline su cartelle e file già indicizzati. */
  /** Ricerca nell'intero catalogo o nel perimetro della cartella selezionata. */
  search: (query: string, limit?: number, scopeFolderId?: number | null) => Promise<SearchResult[]>
  /** Apre un file indicizzato nell'app predefinita del sistema. */
  open: (fileId: number) => Promise<void>
  /** Seleziona un file indicizzato nel Finder. */
  showInFinder: (fileId: number) => Promise<void>
  /** Avvia un drag nativo di un file indicizzato verso Finder o un'altra app. */
  startDrag: (fileId: number) => void
}

export interface AppInfo {
  version: string
  platform: string
}

export interface UpdatesApi {
  snapshot: () => Promise<UpdateSnapshot>
  check: () => Promise<UpdateSnapshot>
  install: () => Promise<boolean>
  onSnapshot: (callback: (snapshot: UpdateSnapshot) => void) => () => void
}

export interface PhotoApi {
  snapshot: () => Promise<PhotoPipelineSnapshot>
  pause: () => Promise<void>
  resume: () => Promise<void>
  retry: (fileId: number) => Promise<boolean>
  promoteVisible: (fileIds: number[]) => Promise<void>
  engines: () => Promise<PhotoEngineHealth[]>
  onSnapshot: (callback: (snapshot: PhotoPipelineSnapshot) => void) => () => void
}

export interface CartelliApi {
  app: AppInfo
  folders: FoldersApi
  files: FilesApi
  tags: TagsApi
  categories: CategoriesApi
  settings: SettingsApi
  dialogs: DialogsApi
  events: EventsApi
  photo: PhotoApi
  updates: UpdatesApi
  web: WebUtilsApi
}
