import { create } from 'zustand'
import type { Folder } from '@shared/types'
import { resolveSelectedFolderId } from './selectors'

interface FoldersState {
  folders: Folder[]
  selectedFolderId: number | null
  loading: boolean
  error: string | null
  searchQuery: string
  loadAll: () => Promise<void>
  addFolder: () => Promise<void>
  addPaths: (paths: string[]) => Promise<void>
  selectFolder: (id: number | null) => void
  rescan: (id: number) => Promise<void>
  removeFolder: (id: number) => Promise<void>
  setSearchQuery: (q: string) => void
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export const useFoldersStore = create<FoldersState>()((set, get) => ({
  folders: [],
  selectedFolderId: null,
  loading: false,
  error: null,
  searchQuery: '',

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const folders = await window.cartelli.folders.listAll()
      set((state) => ({
        folders,
        loading: false,
        selectedFolderId: resolveSelectedFolderId(folders, state.selectedFolderId)
      }))
    } catch (e) {
      set({ loading: false, error: errMsg(e) })
    }
  },

  addFolder: async () => {
    const path = await window.cartelli.dialogs.pickDirectory()
    if (!path) return
    try {
      const { root } = await window.cartelli.folders.addRoot({ path })
      await get().loadAll()
      set({ selectedFolderId: root.id })
    } catch (e) {
      set({ error: errMsg(e) })
    }
  },

  selectFolder: (id) => set({ selectedFolderId: id }),

  addPaths: async (paths) => {
    let lastId: number | null = null
    for (const p of paths) {
      try {
        const { root } = await window.cartelli.folders.addRoot({ path: p })
        lastId = root.id
      } catch (e) {
        set({ error: errMsg(e) })
      }
    }
    await get().loadAll()
    if (lastId != null) set({ selectedFolderId: lastId })
  },

  rescan: async (id) => {
    set({ loading: true, error: null })
    try {
      await window.cartelli.folders.scan(id)
      await get().loadAll()
    } catch (e) {
      set({ loading: false, error: errMsg(e) })
    }
  },

  removeFolder: async (id) => {
    try {
      await window.cartelli.folders.remove(id)
      set((s) => ({
        selectedFolderId: s.selectedFolderId === id ? null : s.selectedFolderId
      }))
      await get().loadAll()
    } catch (e) {
      set({ error: errMsg(e) })
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q })
}))
