import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { ExifToolService } from '../src/main/photo/exiftool-service.ts'

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex')

test('legge metadata senza modificare il file e chiude il processo persistente', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cerbonesphoto-exiftool-'))
  const imagePath = join(directory, 'profilo test.jpg')
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  await sharp({ create: { width: 8, height: 6, channels: 3, background: '#cc6600' } })
    .jpeg().toFile(imagePath)
  const before = sha256(imagePath)
  const service = new ExifToolService()
  t.after(() => service.close())

  const tags = await service.read(imagePath, new AbortController().signal)
  const health = await service.health()

  assert.equal(tags['File:FileType'], 'JPEG')
  assert.equal(tags['File:ImageWidth'], 8)
  assert.equal(tags['File:ImageHeight'], 6)
  assert.equal(sha256(imagePath), before)
  assert.equal(health.name, 'exiftool')
  assert.equal(health.available, true)
  assert.match(health.version ?? '', /^\d+\.\d+$/)
})
