import { create } from 'zustand'
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla'
import type { UpdatesApi } from '../../../shared/api.ts'
import type { UpdateSnapshot } from '../../../shared/update-types.ts'

export interface UpdatePresentation {
  label: string
  action: 'check' | 'install' | null
  busy: boolean
}

export interface UpdateBannerPresentation {
  status: 'available' | 'downloading' | 'downloaded'
  label: string
  percent: number | null
  installable: boolean
}

export interface UpdatesStoreState {
  snapshot: UpdateSnapshot
  connect: () => () => void
  check: () => Promise<void>
  install: () => Promise<boolean>
}

const INITIAL_UPDATE_SNAPSHOT: Readonly<UpdateSnapshot> = Object.freeze({
  status: 'idle',
  currentVersion: '0.0.0',
  availableVersion: null,
  percent: null,
  origin: null,
  message: null
})

export function updatePresentation(snapshot: UpdateSnapshot): UpdatePresentation {
  switch (snapshot.status) {
    case 'unsupported':
      return { label: 'Aggiornamenti non disponibili in questa build', action: null, busy: false }
    case 'checking':
      return { label: 'Verifica aggiornamenti…', action: null, busy: true }
    case 'available':
      return {
        label: snapshot.availableVersion ? `Versione ${snapshot.availableVersion} disponibile` : 'Aggiornamento disponibile',
        action: null,
        busy: true
      }
    case 'downloading':
      return { label: `Download ${snapshot.percent ?? 0}%`, action: null, busy: true }
    case 'downloaded':
      return {
        label: snapshot.availableVersion ? `Versione ${snapshot.availableVersion} pronta` : 'Aggiornamento pronto',
        action: 'install',
        busy: false
      }
    case 'up-to-date':
      return { label: 'CerbonesPhoto è aggiornato', action: 'check', busy: false }
    case 'error':
      return { label: snapshot.message || 'Impossibile verificare gli aggiornamenti', action: 'check', busy: false }
    case 'idle':
      return { label: 'Verifica aggiornamenti…', action: 'check', busy: false }
  }
}

export function updateBannerPresentation(snapshot: UpdateSnapshot): UpdateBannerPresentation | null {
  const version = snapshot.availableVersion ? ` ${snapshot.availableVersion}` : ''
  const percent = Math.round(Math.max(0, Math.min(100, snapshot.percent ?? 0)))
  if (snapshot.status === 'available') {
    return {
      status: 'available',
      label: `Preparazione CerbonesPhoto${version}`,
      percent: null,
      installable: false
    }
  }
  if (snapshot.status === 'downloading') {
    return {
      status: 'downloading',
      label: `Scaricamento CerbonesPhoto${version}`,
      percent,
      installable: false
    }
  }
  if (snapshot.status === 'downloaded') {
    return {
      status: 'downloaded',
      label: `CerbonesPhoto${version} è pronto`,
      percent: 100,
      installable: true
    }
  }
  return null
}

function sameSnapshot(left: UpdateSnapshot, right: UpdateSnapshot): boolean {
  return left.status === right.status && left.currentVersion === right.currentVersion &&
    left.availableVersion === right.availableVersion && left.percent === right.percent &&
    left.origin === right.origin && left.message === right.message
}

function stateCreator(api: UpdatesApi): StateCreator<UpdatesStoreState> {
  return (set) => {
    const apply = (snapshot: UpdateSnapshot): void => {
      set((state) => sameSnapshot(state.snapshot, snapshot) ? state : { snapshot })
    }
    return {
      snapshot: { ...INITIAL_UPDATE_SNAPSHOT },
      connect: () => {
        let active = true
        let eventSeen = false
        const unsubscribe = api.onSnapshot((snapshot) => {
          eventSeen = true
          if (active) apply(snapshot)
        })
        void api.snapshot().then((snapshot) => {
          if (active && !eventSeen) apply(snapshot)
        }).catch(() => undefined)
        return () => {
          active = false
          unsubscribe()
        }
      },
      check: async () => { apply(await api.check()) },
      install: () => api.install()
    }
  }
}

export function createUpdatesStore(api: UpdatesApi): StoreApi<UpdatesStoreState> {
  return createStore<UpdatesStoreState>(stateCreator(api))
}

const browserApi: UpdatesApi = {
  snapshot: () => window.cartelli.updates.snapshot(),
  check: () => window.cartelli.updates.check(),
  install: () => window.cartelli.updates.install(),
  onSnapshot: (callback) => window.cartelli.updates.onSnapshot(callback)
}

export const useUpdatesStore = create<UpdatesStoreState>(stateCreator(browserApi))
