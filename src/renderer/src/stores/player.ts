import { create } from 'zustand'
import type { MediaFile } from '@shared/types'

/**
 * Store del player audio. L'elemento <audio> è gestito dal componente PlayerBar
 * e registrato qui via setAudioEl; le azioni operative (play/pause/seek) agiscono
 * su quell'elemento, mentre i metadati derivati (isPlaying/currentTime/duration)
 * sono aggiornati dai listener del PlayerBar.
 */
let audioEl: HTMLAudioElement | null = null

interface PlayerState {
  queue: MediaFile[]
  index: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  speed: number
  playbackError: string | null

  setAudioEl: (el: HTMLAudioElement | null) => void
  playQueue: (files: MediaFile[], index: number) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (t: number) => void
  setVolume: (v: number) => void
  setSpeed: (s: number) => void

  onTimeUpdate: (t: number) => void
  onDurationChange: (d: number) => void
  onPlayPause: (playing: boolean) => void
  onEnded: () => void
}

function loadAndPlay(files: MediaFile[], index: number): void {
  const f = files[index]
  if (audioEl && f) {
    audioEl.src = `media://file/${f.id}`
    audioEl.currentTime = 0
    void audioEl.play().then(
      () => usePlayerStore.setState({ isPlaying: true, playbackError: null }),
      () => usePlayerStore.setState({ isPlaying: false, playbackError: 'Riproduzione non disponibile' })
    )
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  speed: 1,
  playbackError: null,

  setAudioEl: (el) => {
    audioEl = el
    if (el) {
      el.volume = get().volume
      el.playbackRate = get().speed
    }
  },

  playQueue: (files, index) => {
    set({ queue: files, index, currentTime: 0, duration: 0, playbackError: null })
    loadAndPlay(files, index)
  },

  togglePlay: () => {
    if (!audioEl) return
    if (audioEl.paused) {
      void audioEl.play().then(
        () => set({ playbackError: null }),
        () => set({ isPlaying: false, playbackError: 'Riproduzione non disponibile' })
      )
    }
    else audioEl.pause()
  },

  next: () => {
    const { queue, index } = get()
    if (index < queue.length - 1) {
      const ni = index + 1
      set({ index: ni, currentTime: 0, duration: 0, playbackError: null })
      loadAndPlay(queue, ni)
    } else {
      set({ isPlaying: false })
      if (audioEl) audioEl.pause()
    }
  },

  prev: () => {
    const { queue, index } = get()
    if (index > 0) {
      const ni = index - 1
      set({ index: ni, currentTime: 0, duration: 0, playbackError: null })
      loadAndPlay(queue, ni)
    }
  },

  seek: (t) => {
    if (audioEl) audioEl.currentTime = t
  },

  setVolume: (v) => {
    set({ volume: v })
    if (audioEl) audioEl.volume = v
  },

  setSpeed: (s) => {
    set({ speed: s })
    if (audioEl) audioEl.playbackRate = s
  },

  onTimeUpdate: (t) => set({ currentTime: t }),
  onDurationChange: (d) => set({ duration: d }),
  onPlayPause: (playing) => set({ isPlaying: playing }),
  onEnded: () => get().next()
}))
