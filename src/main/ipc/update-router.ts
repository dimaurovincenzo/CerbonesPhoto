import type { UpdateSnapshot } from '../../shared/update-types'

export interface UpdateRuntimeApi {
  snapshot: () => UpdateSnapshot
  checkManual: () => Promise<UpdateSnapshot>
  install: () => boolean
  subscribe: (listener: (snapshot: UpdateSnapshot) => void) => () => void
}

export interface UpdateIpcBridge {
  handle: (channel: string, handler: () => unknown) => void
  send: (channel: string, snapshot: UpdateSnapshot) => void
}

export function connectUpdateIpc(runtime: UpdateRuntimeApi, bridge: UpdateIpcBridge): () => void {
  bridge.handle('updates:snapshot', () => runtime.snapshot())
  bridge.handle('updates:check', () => runtime.checkManual())
  bridge.handle('updates:install', () => runtime.install())
  return runtime.subscribe((snapshot) => bridge.send('updates:snapshot-event', snapshot))
}

