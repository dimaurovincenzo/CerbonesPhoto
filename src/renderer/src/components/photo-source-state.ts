import type { DerivativeLevel } from '../../../shared/photo-types.ts'

export type DisplayPhotoLevel = Extract<DerivativeLevel, 'thumbnail' | 'preview' | 'high-resolution'>

export interface PhotoSourceState {
  level: DisplayPhotoLevel
  pending: Exclude<DisplayPhotoLevel, 'thumbnail'> | null
  unsupported: boolean
}

export type PhotoSourceEvent =
  | { type: 'request-preview' }
  | { type: 'zoom'; scale: number }
  | { type: 'loaded'; level: 'preview' | 'high-resolution' }
  | { type: 'retry' }
  | { type: 'unsupported' }

export function nextPhotoSource(state: PhotoSourceState, event: PhotoSourceEvent): PhotoSourceState {
  if (event.type === 'request-preview' && state.level === 'thumbnail' && !state.pending) {
    return { ...state, pending: 'preview', unsupported: false }
  }
  if (event.type === 'zoom' && event.scale > 2 && state.level !== 'high-resolution' && !state.pending) {
    return { ...state, pending: 'high-resolution', unsupported: false }
  }
  if (event.type === 'loaded' && state.pending === event.level) {
    return { level: event.level, pending: null, unsupported: false }
  }
  if (event.type === 'unsupported') return { ...state, pending: null, unsupported: true }
  return state
}
