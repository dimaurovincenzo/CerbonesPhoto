import { create } from 'zustand'
import type { Category, CreateCategoryInput, Tag, UpdateCategoryPatch, UpdateTagPatch } from '@shared/types'
import { reorderIds } from '@shared/reorder'

/**
 * Store delle etichette: tag (piatti, colorati) e categorie (gerarchiche).
 * Mantiene anche l'indice folder_id → etichette assegnate, per filtri e inspector.
 */
interface LabelsState {
  tags: Tag[]
  categories: Category[]
  folderTags: Record<number, number[]>
  folderCategories: Record<number, number[]>
  tagFilter: number | null
  categoryFilter: number | null
  loaded: boolean

  loadAll: () => Promise<void>
  createTag: (name: string, color: string) => Promise<Tag>
  updateTag: (id: number, patch: UpdateTagPatch) => Promise<void>
  deleteTag: (id: number) => Promise<void>
  createCategory: (input: CreateCategoryInput) => Promise<void>
  updateCategory: (id: number, patch: UpdateCategoryPatch) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
  reorderTags: (draggedId: number, targetId: number) => Promise<void>
  reorderCategories: (draggedId: number, targetId: number) => Promise<void>
  assignTags: (folderId: number, tagIds: number[]) => Promise<void>
  assignCategories: (folderId: number, categoryIds: number[]) => Promise<void>
  setTagFilter: (id: number | null) => void
  setCategoryFilter: (id: number | null) => void
  tagsOf: (folderId: number) => Tag[]
  categoriesOf: (folderId: number) => Category[]
}

async function reload(set: (p: Partial<LabelsState>) => void): Promise<void> {
  const [tags, categories, idx] = await Promise.all([
    window.cartelli.tags.list(),
    window.cartelli.categories.list(),
    window.cartelli.folders.labelIndex()
  ])
  set({ tags, categories, folderTags: idx.tags, folderCategories: idx.categories, loaded: true })
}

export const useLabelsStore = create<LabelsState>()((set, get) => ({
  tags: [],
  categories: [],
  folderTags: {},
  folderCategories: {},
  tagFilter: null,
  categoryFilter: null,
  loaded: false,

  loadAll: () => reload(set),

  createTag: async (name, color) => {
    const t = await window.cartelli.tags.create({ name, color })
    await reload(set)
    return t
  },
  updateTag: async (id, patch) => {
    await window.cartelli.tags.update(id, patch)
    await reload(set)
  },
  deleteTag: async (id) => {
    await window.cartelli.tags.remove(id)
    await reload(set)
  },

  createCategory: async (input) => {
    await window.cartelli.categories.create(input)
    await reload(set)
  },
  updateCategory: async (id, patch) => {
    await window.cartelli.categories.update(id, patch)
    await reload(set)
  },
  deleteCategory: async (id) => {
    await window.cartelli.categories.remove(id)
    await reload(set)
  },
  reorderTags: async (draggedId, targetId) => {
    const ids = reorderIds(get().tags.map((tag) => tag.id), draggedId, targetId)
    await Promise.all(ids.map((id, sortOrder) => window.cartelli.tags.update(id, { sortOrder })))
    await reload(set)
  },
  reorderCategories: async (draggedId, targetId) => {
    const categories = get().categories
    const dragged = categories.find((category) => category.id === draggedId)
    const target = categories.find((category) => category.id === targetId)
    if (!dragged || !target || dragged.parentId !== target.parentId) return
    const siblings = categories.filter((category) => category.parentId === dragged.parentId)
    const ids = reorderIds(siblings.map((category) => category.id), draggedId, targetId)
    await Promise.all(ids.map((id, sortOrder) => window.cartelli.categories.update(id, { sortOrder })))
    await reload(set)
  },

  assignTags: async (folderId, tagIds) => {
    await window.cartelli.folders.setTags(folderId, tagIds)
    await reload(set)
  },
  assignCategories: async (folderId, categoryIds) => {
    await window.cartelli.folders.setCategories(folderId, categoryIds)
    await reload(set)
  },

  setTagFilter: (id) => set((s) => ({ tagFilter: s.tagFilter === id ? null : id })),
  setCategoryFilter: (id) => set((s) => ({ categoryFilter: s.categoryFilter === id ? null : id })),

  tagsOf: (folderId) => {
    const { tags, folderTags } = get()
    const ids = folderTags[folderId] ?? []
    const byId = new Map(tags.map((t) => [t.id, t]))
    return ids.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t))
  },
  categoriesOf: (folderId) => {
    const { categories, folderCategories } = get()
    const ids = folderCategories[folderId] ?? []
    const byId = new Map(categories.map((c) => [c.id, c]))
    return ids.map((id) => byId.get(id)).filter((c): c is Category => Boolean(c))
  }
}))
