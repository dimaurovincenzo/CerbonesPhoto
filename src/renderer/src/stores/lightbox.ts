import { create } from 'zustand'
import type { MediaFile } from '@shared/types'

/** Store Quick Look per immagini e video (full-screen, navigabile). */
interface LightboxState {
  items: MediaFile[]
  index: number
  open: (items: MediaFile[], index: number) => void
  close: () => void
  next: () => void
  prev: () => void
}

export const useLightboxStore = create<LightboxState>((set) => ({
  items: [],
  index: -1,
  open: (items, index) => set({ items, index }),
  close: () => set({ items: [], index: -1 }),
  next: () =>
    set((s) => (s.index < s.items.length - 1 ? { index: s.index + 1 } : s)),
  prev: () => set((s) => (s.index > 0 ? { index: s.index - 1 } : s))
}))
