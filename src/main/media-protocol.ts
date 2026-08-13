import { protocol } from 'electron'
import { createReadStream } from 'node:fs'
import { statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { getDb } from './db/connection'
import { getThumbnailPath } from './thumbnails'
import { mimeFromPath } from '@shared/media-formats'

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
    }
  ])
}

/** Da registrare DOPO app.ready (protocol.handle). */
export function registerMediaProtocols(): void {
  // Thumbnail webp per le immagini.
  protocol.handle('thumb', async (request) => {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/file\/(\d+)$/)
    if (!match) return new Response('Bad request', { status: 400 })

    const fileId = Number(match[1])
    const row = getDb().prepare('SELECT path, kind FROM files WHERE id = ?').get(fileId) as
      | { path: string; kind: string }
      | undefined
    if (!row) return new Response('Not found', { status: 404 })
    if (row.kind !== 'image') return new Response('Not an image', { status: 404 })

    try {
      const thumbPath = await getThumbnailPath(row.path)
      const { readFile } = await import('node:fs/promises')
      const data = await readFile(thumbPath)
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' }
      })
    } catch {
      return new Response('Thumbnail error', { status: 500 })
    }
  })

  // File raw con HTTP Range (per lo scrubbing audio e le immagini full-size).
  protocol.handle('media', async (request) => {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/file\/(\d+)$/)
    if (!match) return new Response('Bad request', { status: 400 })

    const fileId = Number(match[1])
    const row = getDb().prepare('SELECT path FROM files WHERE id = ?').get(fileId) as
      | { path: string }
      | undefined
    if (!row) return new Response('Not found', { status: 404 })

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
