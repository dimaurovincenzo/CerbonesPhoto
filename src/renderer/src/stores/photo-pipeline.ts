import { create } from 'zustand'
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla'
import type { PhotoApi } from '../../../shared/api.ts'
import type { PhotoPipelineSnapshot } from '../../../shared/photo-types.ts'

export const EMPTY_PHOTO_SNAPSHOT: Readonly<PhotoPipelineSnapshot> = Object.freeze({
  pending: 0,
  processing: 0,
  ready: 0,
  partial: 0,
  failed: 0,
  paused: false
})

export interface PhotoPipelineStoreState {
  snapshot: PhotoPipelineSnapshot
  connect: () => () => void
  pause: () => Promise<void>
  resume: () => Promise<void>
  retry: (fileId: number) => Promise<boolean>
  promoteVisible: (fileIds: number[]) => Promise<void>
}

function stateCreator(api: PhotoApi): StateCreator<PhotoPipelineStoreState> {
  return (set) => {
    const applySnapshot = (snapshot: PhotoPipelineSnapshot): void => {
      set((state) => equalSnapshot(state.snapshot, snapshot) ? state : { snapshot })
    }
    return {
      snapshot: EMPTY_PHOTO_SNAPSHOT,
      connect: () => {
        let eventSeen = false
        let active = true
        const unsubscribe = api.onSnapshot((snapshot) => {
          eventSeen = true
          if (active) applySnapshot(snapshot)
        })
        void api.snapshot().then((snapshot) => {
          if (active && !eventSeen) applySnapshot(snapshot)
        }).catch(() => undefined)
        return () => {
          active = false
          unsubscribe()
        }
      },
      pause: async () => { await api.pause() },
      resume: async () => { await api.resume() },
      retry: (fileId) => api.retry(fileId),
      promoteVisible: async (fileIds) => { await api.promoteVisible(fileIds) }
    }
  }
}

export function createPhotoPipelineStore(api: PhotoApi): StoreApi<PhotoPipelineStoreState> {
  return createStore<PhotoPipelineStoreState>(stateCreator(api))
}

const browserApi: PhotoApi = {
  snapshot: () => window.cartelli.photo.snapshot(),
  pause: () => window.cartelli.photo.pause(),
  resume: () => window.cartelli.photo.resume(),
  retry: (fileId) => window.cartelli.photo.retry(fileId),
  promoteVisible: (fileIds) => window.cartelli.photo.promoteVisible(fileIds),
  engines: () => window.cartelli.photo.engines(),
  onSnapshot: (callback) => window.cartelli.photo.onSnapshot(callback)
}

export const usePhotoPipelineStore = create<PhotoPipelineStoreState>(stateCreator(browserApi))

function equalSnapshot(left: PhotoPipelineSnapshot, right: PhotoPipelineSnapshot): boolean {
  return left.pending === right.pending && left.processing === right.processing && left.ready === right.ready &&
    left.partial === right.partial && left.failed === right.failed && left.paused === right.paused
}
