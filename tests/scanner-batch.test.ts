import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { walkMedia } from '../src/main/scanner-batch.ts'

test('enumera grandi cartelle a batch cedendo il controllo all event loop', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cerbonesphoto-scan-batch-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (let index = 0; index < 450; index++) writeFileSync(join(root, `foto-${index}.jpg`), '')
  writeFileSync(join(root, 'documento.txt'), '')

  let heartbeat = 0
  const timer = setInterval(() => { heartbeat++ }, 0)
  t.after(() => clearInterval(timer))

  const batches = []
  for await (const batch of walkMedia(root, { batchSize: 100 })) batches.push(batch)

  assert.equal(batches.length, 5)
  assert.equal(batches.flatMap((batch) => batch.entries).length, 450)
  assert.ok(heartbeat > 0, 'lo scanner deve cedere il controllo all event loop')
})

test('segnala una directory illeggibile senza fingere una scansione completa', async () => {
  const batches = []
  for await (const batch of walkMedia('/percorso/che/non/esiste', { batchSize: 10 })) batches.push(batch)
  assert.deepEqual(batches, [{ directory: '/percorso/che/non/esiste', entries: [], complete: false }])
})
