import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import sharp from 'sharp'
import { MacImageHelper } from '../src/main/photo/mac-image-helper.ts'

const execFileAsync = promisify(execFile)

test('converte un HEIC tramite ImageIO senza modificare l’originale', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cerbonesphoto-imageio-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const png = join(directory, 'origine.png')
  const heic = join(directory, 'foto; touch NON_ESEGUIRE.heic')
  const tiff = join(directory, 'cache', 'preview.tiff')
  await sharp({ create: { width: 320, height: 240, channels: 3, background: '#cc8844' } }).png().toFile(png)
  await execFileAsync('/usr/bin/sips', ['-s', 'format', 'heic', png, '--out', heic])
  const before = await sha256(heic)

  await new MacImageHelper().convertToTiff(heic, tiff, new AbortController().signal)

  assert.equal(await sha256(heic), before)
  assert.equal((await sharp(tiff).metadata()).format, 'tiff')
})

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}
