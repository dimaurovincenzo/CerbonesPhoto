import type { MediaKind } from './types'

export const MEDIA_MIME: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff',
  heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus',
  aiff: 'audio/aiff', aif: 'audio/aiff',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm',
  ogv: 'video/ogg', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mpeg: 'video/mpeg', mpg: 'video/mpeg', mts: 'video/mp2t', m2ts: 'video/mp2t'
}

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'avif', 'svg'])
const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus', 'aiff', 'aif'])
// `.ts` è intenzionalmente esclusa: nei progetti software identifica quasi sempre
// TypeScript. I contenitori MPEG-TS restano disponibili tramite `.mts` e `.m2ts`.
const VIDEO_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'mpeg', 'mpg', 'mts', 'm2ts'])

function extensionOf(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function classifyMediaPath(filePath: string): Exclude<MediaKind, 'other'> | null {
  const ext = extensionOf(filePath)
  if (IMAGE_EXT.has(ext)) return 'image'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (VIDEO_EXT.has(ext)) return 'video'
  return null
}

export function mimeFromPath(filePath: string): string {
  return MEDIA_MIME[extensionOf(filePath)] ?? 'application/octet-stream'
}
