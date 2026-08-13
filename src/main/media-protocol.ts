import { protocol } from 'electron'
import { createReadStream } from 'node:fs'
import { statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { getDb } from './db/connection'
import { mimeFromPath } from '@shared/media-formats'
import type { PhotoRuntime } from './photo/photo-runtime'
import type { DerivativeLevel } from '@shared/photo-types'
import { createPhotoProtocolResponse, parseIndexedMediaUrl, type PhotoProtocolDatabase } from './media-protocol-photo'

/**
 * Protocolli custom per servire i media al renderer:
 *   thumb://file/<fileId>   → thumbnail webp (generato on-demand, cached)
 *   media://file/<fileId>   → file raw con supporto HTTP Range (per il seek audio)
 *
 * Il renderer non accede mai al filesystem direttamente: passa dall'IPC o dai
 * protocolli custom, che validano tramite il DB.
 */

/** Da registrare PRIMA di app.ready (registerSchemesAsPrivileged). */
export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'thumb',
      privileges: { standard: false, supportFetchAPI: true, stream: false, bypassCSP: false }
    },
    {
      scheme: 'media',
      privileges: { standard: false, supportFetchAPI: true, stream: true, bypassCSP: false }
    },
    {
      scheme: 'preview',
      privileges: { standard: false, supportFetchAPI: true, stream: false, bypassCSP: false }
    }
  ])
}

/** Da registrare DOPO app.ready (protocol.handle). */
export function registerMediaProtocols(photoRuntime: PhotoRuntime): void {
  const photoDatabase: PhotoProtocolDatabase = {
    file: (fileId) => getDb().prepare(
      'SELECT id, kind, processing_state, processing_error_code FROM files WHERE id = ?'
    ).get(fileId) as ReturnType<PhotoProtocolDatabase['file']>,
    derivative: (fileId, level) => getDb().prepare(
      "SELECT path, mime FROM file_derivatives WHERE file_id = ? AND level = ? AND status = 'ready'"
    ).get(fileId, level) as ReturnType<PhotoProtocolDatabase['derivative']>
  }
  const requestDerivative = (fileId: number, level: DerivativeLevel): void => {
    if (level === 'thumbnail' || level === 'preview') photoRuntime.pipeline.enqueue(fileId, 1000)
    else photoRuntime.requestDerivative(fileId, level)
  }

  // Thumbnail webp per le immagini.
  protocol.handle('thumb', async (request) => {
    return createPhotoProtocolResponse(request, photoDatabase, 'thumbnail', requestDerivative)
  })

  protocol.handle('preview', (request) => createPhotoProtocolResponse(request, photoDatabase, undefined, requestDerivative))

  // File raw con HTTP Range (per lo scrubbing audio e le immagini full-size).
  protocol.handle('media', async (request) => {
    const parsed = parseIndexedMediaUrl(request.url)
    if (!parsed) return new Response('Bad request', { status: 400 })

    const row = getDb().prepare('SELECT path, is_raw FROM files WHERE id = ?').get(parsed.fileId) as
      | { path: string; is_raw: number }
      | undefined
    if (!row) return new Response('Not found', { status: 404 })
    if (row.is_raw === 1) return new Response('RAW requires a generated preview', { status: 415 })

    let size: number
    try {
      size = statSync(row.path).size
    } catch {
      return new Response('File non accessibile', { status: 500 })
    }
    const contentType = mimeFromPath(row.path)

    const range = request.headers.get('range')
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range)
      const start = m && m[1] ? parseInt(m[1], 10) : 0
      let end = m && m[2] ? parseInt(m[2], 10) : size - 1
      if (end >= size) end = size - 1
      if (start > end) return new Response('Range not satisfiable', { status: 416 })

      const len = end - start + 1
      const stream = createReadStream(row.path, { start, end })
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(len),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }

    const stream = createReadStream(row.path)
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    })
  })
}
