import { create } from 'zustand'

export type AboutEffect = 'shutter' | 'version-joke' | 'polaroid' | null

export interface LensSequenceState { count: number; effect: 'shutter' | null }
export interface AboutSequenceState { buffer: string; effect: 'polaroid' | null }

export function recordLensActivation(state: LensSequenceState): LensSequenceState {
  const count = state.count + 1
  return { count, effect: count % 5 === 0 ? 'shutter' : null }
}

export function activateVersionEasterEgg(optionPressed: boolean): { effect: 'version-joke' | null } {
  return { effect: optionPressed ? 'version-joke' : null }
}

export function recordAboutKey(state: AboutSequenceState, rawKey: string): AboutSequenceState {
  if (!/^[a-z]$/i.test(rawKey)) return state
  const buffer = `${state.buffer}${rawKey.toUpperCase()}`.slice(-7)
  return { buffer, effect: buffer === 'CERBONE' ? 'polaroid' : null }
}

interface AboutStoreState {
  isOpen: boolean
  effect: AboutEffect
  message: string | null
  lensCount: number
  keyBuffer: string
  show: () => void
  close: () => void
  activateLens: () => void
  activateVersion: (optionPressed: boolean) => void
  recordKey: (key: string) => void
  clearEffect: () => void
}

export const useAboutStore = create<AboutStoreState>((set) => ({
  isOpen: false,
  effect: null,
  message: null,
  lensCount: 0,
  keyBuffer: '',
  show: () => set({ isOpen: true, effect: null, message: null, keyBuffer: '' }),
  close: () => set({ isOpen: false, effect: null, message: null, keyBuffer: '' }),
  activateLens: () => set((state) => {
    const next = recordLensActivation({ count: state.lensCount, effect: null })
    return {
      lensCount: next.count,
      effect: next.effect,
      message: next.effect ? 'Il fotografo sostiene che fosse tutto perfettamente a fuoco.' : state.message
    }
  }),
  activateVersion: (optionPressed) => set((state) => {
    const next = activateVersionEasterEgg(optionPressed)
    return next.effect
      ? { effect: next.effect, message: 'Versione sviluppata con amore. I bug, invece, sono venuti senza invito.' }
      : state
  }),
  recordKey: (key) => set((state) => {
    const next = recordAboutKey({ buffer: state.keyBuffer, effect: null }, key)
    return {
      keyBuffer: next.buffer,
      effect: next.effect,
      message: next.effect ? 'Foto approvata dal cognato. Nessun RAW è stato maltrattato.' : state.message
    }
  }),
  clearEffect: () => set({ effect: null })
}))
