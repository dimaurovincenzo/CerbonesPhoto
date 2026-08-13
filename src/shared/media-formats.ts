import type { MediaKind } from './types'
import type { PhotoFormat } from './photo-types'

export const MEDIA_MIME: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff',
  heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', svg: 'image/svg+xml',
  cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3', crw: 'image/x-canon-crw',
  nef: 'image/x-nikon-nef', nrw: 'image/x-nikon-nrw',
  arw: 'image/x-sony-arw', sr2: 'image/x-sony-sr2', srf: 'image/x-sony-srf',
  raf: 'image/x-fuji-raf', orf: 'image/x-olympus-orf', ori: 'image/x-olympus-ori',
  rw2: 'image/x-panasonic-rw2', rwl: 'image/x-leica-rwl', dng: 'image/x-adobe-dng',
  pef: 'image/x-pentax-pef', ptx: 'image/x-pentax-ptx',
  '3fr': 'image/x-hasselblad-3fr', fff: 'image/x-hasselblad-fff',
  iiq: 'image/x-phaseone-iiq', mef: 'image/x-mamiya-mef', mrw: 'image/x-minolta-mrw',
  x3f: 'image/x-sigma-x3f', erf: 'image/x-epson-erf', dcr: 'image/x-kodak-dcr',
  kdc: 'image/x-kodak-kdc', srw: 'image/x-samsung-srw',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus',
  aiff: 'audio/aiff', aif: 'audio/aiff',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm',
  ogv: 'video/ogg', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mpeg: 'video/mpeg', mpg: 'video/mpeg', mts: 'video/mp2t', m2ts: 'video/mp2t'
}

const STANDARD_PHOTO_EXT = new Set(['jpg', 'jpeg', 'jpe', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'avif'])
const RAW_VENDOR: Readonly<Record<string, string>> = {
  cr2: 'Canon', cr3: 'Canon', crw: 'Canon', nef: 'Nikon', nrw: 'Nikon',
  arw: 'Sony', sr2: 'Sony', srf: 'Sony', raf: 'Fujifilm', orf: 'Olympus/OM System',
  ori: 'Olympus/OM System', rw2: 'Panasonic', rwl: 'Leica', dng: 'Adobe',
  pef: 'Pentax', ptx: 'Pentax', '3fr': 'Hasselblad', fff: 'Hasselblad',
  iiq: 'Phase One', mef: 'Mamiya', mrw: 'Minolta', x3f: 'Sigma', erf: 'Epson',
  dcr: 'Kodak', kdc: 'Kodak', srw: 'Samsung'
}
const RAW_EXT = new Set(Object.keys(RAW_VENDOR))
const IMAGE_EXT = new Set([...STANDARD_PHOTO_EXT, ...RAW_EXT, 'svg'])
const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus', 'aiff', 'aif'])
// `.ts` è intenzionalmente esclusa: nei progetti software identifica quasi sempre
// TypeScript. I contenitori MPEG-TS restano disponibili tramite `.mts` e `.m2ts`.
const VIDEO_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'mpeg', 'mpg', 'mts', 'm2ts'])

export function extensionOf(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function isRawPath(filePath: string): boolean {
  return RAW_EXT.has(extensionOf(filePath))
}

export function photoFormatFromPath(filePath: string): PhotoFormat | null {
  const extension = extensionOf(filePath)
  if (RAW_EXT.has(extension)) {
    return { extension, mime: MEDIA_MIME[extension], family: 'raw', vendor: RAW_VENDOR[extension] }
  }
  if (STANDARD_PHOTO_EXT.has(extension)) {
    return { extension, mime: MEDIA_MIME[extension], family: 'standard', vendor: null }
  }
  return null
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
