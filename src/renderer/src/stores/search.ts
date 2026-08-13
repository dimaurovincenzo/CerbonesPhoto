import { create } from 'zustand'
import type { SearchResult } from '@shared/types'

interface SearchState {
  results: SearchResult[]
  loading: boolean
  error: string | null
  run: (query: string) => Promise<void>
  clear: () => void
}

let requestSequence = 0

export const useSearchStore = create<SearchState>()((set) => ({
  results: [],
  loading: false,
  error: null,

  run: async (query) => {
    const requestId = ++requestSequence
    if (query.trim().length < 2) {
      set({ results: [], loading: false, error: null })
      return
    }
    set({ loading: true, error: null })
    try {
      const results = await window.cartelli.files.search(query, 60)
      if (requestId === requestSequence) set({ results, loading: false })
    } catch (error) {
      if (requestId === requestSequence) {
        set({
          results: [],
          loading: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  },

  clear: () => {
    requestSequence++
    set({ results: [], loading: false, error: null })
  }
}))
