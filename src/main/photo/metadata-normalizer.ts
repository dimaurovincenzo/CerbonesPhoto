import type { PhotoMetadata } from '../../shared/photo-types.ts'

function first(tags: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (tags[name] != null) return tags[name]
  return null
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function exposure(value: unknown): number | null {
  if (typeof value === 'string' && value.includes('/')) {
    const [numerator, denominator] = value.split('/', 2).map(Number)
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator
    }
  }
  return finiteNumber(value)
}

function dateTime(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})(.*)$/)
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}${match[5]}` : raw
}

function keywords(...values: unknown[]): string[] {
  const unique = new Set<string>()
  for (const value of values) {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
    for (const item of items) {
      if (typeof item === 'string' && item.trim()) unique.add(item.trim())
    }
  }
  return [...unique]
}

export function normalizePhotoMetadata(tags: Record<string, unknown>): PhotoMetadata {
  return {
    cameraMake: text(first(tags, 'EXIF:Make', 'Make')),
    cameraModel: text(first(tags, 'EXIF:Model', 'Model')),
    lens: text(first(tags, 'EXIF:LensModel', 'Composite:LensID', 'LensModel')),
    capturedAt: dateTime(first(tags, 'EXIF:DateTimeOriginal', 'XMP:DateCreated', 'DateTimeOriginal')),
    width: finiteNumber(first(tags, 'EXIF:ImageWidth', 'File:ImageWidth', 'ImageWidth')),
    height: finiteNumber(first(tags, 'EXIF:ImageHeight', 'File:ImageHeight', 'ImageHeight')),
    orientation: finiteNumber(first(tags, 'EXIF:Orientation', 'Orientation')),
    iso: finiteNumber(first(tags, 'EXIF:ISO', 'ISO')),
    aperture: finiteNumber(first(tags, 'EXIF:FNumber', 'Composite:Aperture', 'FNumber')),
    exposureSeconds: exposure(first(tags, 'EXIF:ExposureTime', 'ExposureTime')),
    focalLengthMm: finiteNumber(first(tags, 'EXIF:FocalLength', 'FocalLength')),
    colorProfile: text(first(tags, 'ICC_Profile:ProfileDescription', 'ColorSpaceData', 'ProfileDescription')),
    keywords: keywords(tags['IPTC:Keywords'], tags['XMP:Subject'], tags['Keywords'], tags['Subject'])
  }
}
