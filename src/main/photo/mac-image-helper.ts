import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Fallback macOS ImageIO tramite sips, confinato a input read-only e output cache. */
export class MacImageHelper {
  private readonly executable = '/usr/bin/sips'
  private readonly timeoutMs = 30_000

  async convertToTiff(sourcePath: string, outputPath: string, signal: AbortSignal): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true })
    await new Promise<void>((resolve, reject) => {
      execFile(this.executable, ['-s', 'format', 'tiff', sourcePath, '--out', outputPath], {
        shell: false,
        timeout: this.timeoutMs,
        signal,
        maxBuffer: 256 * 1024,
        encoding: 'utf8'
      }, (error, _stdout, stderr) => {
        if (!error) {
          resolve()
          return
        }
        const processError = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
        if (processError.code === 'ABORT_ERR') reject(new DOMException('Operazione annullata', 'AbortError'))
        else if (processError.killed || processError.signal === 'SIGTERM') reject(new Error('ENGINE_TIMEOUT: ImageIO non ha risposto'))
        else reject(new Error(`PREVIEW_CORRUPT: ${stderr.trim().slice(0, 512) || 'ImageIO non supporta il file'}`))
      })
    })
  }
}
