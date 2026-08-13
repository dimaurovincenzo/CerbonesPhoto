import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { walkMedia } from '../src/main/scanner-batch.ts'

test('due scansioni di 10.000 foto restano responsive e senza crescita anomala', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cerbonesphoto-load-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  for (let index = 0; index < 10_000; index++) {
    writeFileSync(join(directory, `foto-${String(index).padStart(5, '0')}.jpg`), '')
  }

  let lastTick = performance.now()
  let maxGapMs = 0
  const heartbeat = setInterval(() => {
    const now = performance.now()
    maxGapMs = Math.max(maxGapMs, now - lastTick)
    lastTick = now
  }, 10)
  t.after(() => clearInterval(heartbeat))

  const beforeRss = process.memoryUsage().rss
  const firstCount = await countEntries(directory)
  const afterFirstRss = process.memoryUsage().rss
  const secondCount = await countEntries(directory)
  const afterSecondRss = process.memoryUsage().rss
  clearInterval(heartbeat)

  assert.equal(firstCount, 10_000)
  assert.equal(secondCount, 10_000)
  assert.ok(maxGapMs < 500, `heartbeat massimo ${maxGapMs.toFixed(1)} ms`)
  assert.ok(afterSecondRss - Math.max(beforeRss, afterFirstRss) < 96 * 1024 * 1024)
})

async function countEntries(directory: string): Promise<number> {
  let count = 0
  for await (const batch of walkMedia(directory, { batchSize: 200 })) count += batch.entries.length
  return count
}
