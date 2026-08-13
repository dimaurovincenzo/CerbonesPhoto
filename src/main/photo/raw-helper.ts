import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rename, rm, symlink } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { PhotoEngineHealth, PhotoErrorCode } from '../../shared/photo-types.ts'

export class RawHelperError extends Error {
  readonly code: PhotoErrorCode

  constructor(code: PhotoErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RawHelperError'
  }
}

export interface RawHelperOptions {
  simpleDcrawPath: string
  timeoutMs?: number
}

/** Adapter sicuro del sample ufficiale simple_dcraw distribuito con LibRaw. */
export class RawHelper {
  private readonly executable: string
  private readonly timeoutMs: number

  constructor(options: RawHelperOptions) {
    this.executable = options.simpleDcrawPath
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  async extractPreview(sourcePath: string, outputPath: string, signal: AbortSignal): Promise<void> {
    await this.withCacheSymlink(sourcePath, outputPath, signal, ['-e'], ['.thumb.jpg', '.thumb.jxl', '.thumb.ppm', '.thumb.pgm'])
  }

  async render(sourcePath: string, outputPath: string, signal: AbortSignal): Promise<void> {
    await this.withCacheSymlink(sourcePath, outputPath, signal, ['-4', '-T'], ['.tiff'])
  }

  async health(): Promise<PhotoEngineHealth> {
    try {
      const result = await runProcess(this.executable, [], this.timeoutMs, new AbortController().signal, true)
      const version = /LibRaw\s+([\d.]+)/.exec(`${result.stdout}\n${result.stderr}`)?.[1] ?? null
      return { name: 'libraw', available: true, version, architecture: process.arch, errorCode: null }
    } catch {
      return { name: 'libraw', available: false, version: null, architecture: process.arch, errorCode: 'ENGINE_UNAVAILABLE' }
    }
  }

  private async withCacheSymlink(
    sourcePath: string,
    outputPath: string,
    signal: AbortSignal,
    args: string[],
    expectedSuffixes: string[]
  ): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true })
    const workspace = await mkdtemp(join(dirname(outputPath), '.raw-job-'))
    const linkPath = join(workspace, `${basename(sourcePath, extname(sourcePath))}${extname(sourcePath).toLowerCase()}`)
    try {
      await symlink(sourcePath, linkPath)
      await runProcess(this.executable, [...args, linkPath], this.timeoutMs, signal)
      const generated = (await readdir(workspace))
        .map((name) => join(workspace, name))
        .find((path) => expectedSuffixes.some((suffix) => path.endsWith(suffix)))
      if (!generated) throw new RawHelperError('RAW_UNSUPPORTED', 'LibRaw non ha prodotto un’anteprima compatibile')
      await rename(generated, outputPath)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  }
}

interface ProcessResult { stdout: string; stderr: string }

function runProcess(
  executable: string,
  args: string[],
  timeoutMs: number,
  signal: AbortSignal,
  acceptNonZero = false
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, {
      shell: false,
      timeout: timeoutMs,
      signal,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8'
    }, (error, stdout, stderr) => {
      const exitCode = error ? (error as NodeJS.ErrnoException & { code?: string | number }).code : undefined
      if (!error || (acceptNonZero && typeof exitCode === 'number')) {
        resolve({ stdout, stderr })
        return
      }
      const processError = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
      if (processError.killed || processError.signal === 'SIGTERM') {
        reject(new RawHelperError('ENGINE_TIMEOUT', `LibRaw non ha risposto entro ${timeoutMs} ms`))
      } else if (processError.code === 'ABORT_ERR') {
        reject(new DOMException('Operazione annullata', 'AbortError'))
      } else {
        reject(new RawHelperError('RAW_UNSUPPORTED', stderr.trim().slice(0, 1024) || 'LibRaw non supporta il file'))
      }
    })
  })
}
