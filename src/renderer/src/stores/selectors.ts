const EMPTY_IDS: readonly number[] = Object.freeze([])

interface FolderTagsState {
  folderTags: Record<number, number[]>
}

interface FolderCategoriesState {
  folderCategories: Record<number, number[]>
}

/**
 * Zustand richiede snapshot referenzialmente stabili. La costante condivisa
 * evita un nuovo `[]` a ogni render per le cartelle senza tag.
 */
export function selectFolderTagIds(state: FolderTagsState, folderId: number): readonly number[] {
  return state.folderTags[folderId] ?? EMPTY_IDS
}

export function selectFolderCategoryIds(
  state: FolderCategoriesState,
  folderId: number
): readonly number[] {
  return state.folderCategories[folderId] ?? EMPTY_IDS
}

export function resolveSelectedFolderId(
  folders: readonly { id: number; isRoot: boolean }[],
  currentId: number | null
): number | null {
  if (currentId != null && folders.some((folder) => folder.id === currentId)) return currentId
  return folders.find((folder) => folder.isRoot)?.id ?? null
}
