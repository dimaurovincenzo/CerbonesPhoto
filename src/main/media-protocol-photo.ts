import { readFile } from 'node:fs/promises'
import type { DerivativeLevel, PhotoProcessingState } from '../shared/photo-types.ts'

export interface PhotoProtocolDatabase {
  file(fileId: number): {
    id: number
    kind: string
    processing_state: PhotoProcessingState
    processing_error_code: string | null
  } | undefined
  derivative(fileId: number, level: DerivativeLevel): { path: string; mime: string } | undefined
}

export interface IndexedMediaUrl {
  fileId: number
}

export function parseIndexedMediaUrl(rawUrl: string): IndexedMediaUrl | null {
  if (rawUrl.includes('..')) return null
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.hostname !== 'file') return null
  const match = /^\/(\d+)$/.exec(url.pathname)
  if (!match) return null
  const fileId = Number(match[1])
  return Number.isSafeInteger(fileId) && fileId > 0 ? { fileId } : null
}

export async function createPhotoProtocolResponse(
  request: Request,
  database: PhotoProtocolDatabase,
  fixedLevel?: DerivativeLevel,
  onMissing?: (fileId: number, level: DerivativeLevel) => void
): Promise<Response> {
  const parsed = parseIndexedMediaUrl(request.url)
  if (!parsed) return textResponse('Richiesta non valida', 400)
  const url = new URL(request.url)
  const requestedLevel = fixedLevel ?? url.searchParams.get('level')
  if (!isPreviewLevel(requestedLevel) && requestedLevel !== 'thumbnail') {
    return textResponse('Livello anteprima non valido', 400)
  }
  const level = requestedLevel
  const file = database.file(parsed.fileId)
  if (!file || file.kind !== 'image') return textResponse('Fotografia non trovata', 404)
  if (file.processing_state === 'failed' && file.processing_error_code === 'RAW_UNSUPPORTED') {
    return textResponse('Anteprima RAW non disponibile', 415)
  }

  const derivative = database.derivative(parsed.fileId, level)
  if (derivative && file.processing_state !== 'pending' && file.processing_state !== 'processing') {
    try {
      const data = await readFile(derivative.path)
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': derivative.mime,
          'Cache-Control': 'private, max-age=86400'
        }
      })
    } catch {
      // Un record cache stantio viene rigenerato senza rivelarne il path.
    }
  }

  onMissing?.(parsed.fileId, level)
  return new Response(null, { status: 202, headers: { 'Retry-After': '1', 'Cache-Control': 'no-store' } })
}

function isPreviewLevel(value: unknown): value is 'preview' | 'high-resolution' {
  return value === 'preview' || value === 'high-resolution'
}

function textResponse(message: string, status: number): Response {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
