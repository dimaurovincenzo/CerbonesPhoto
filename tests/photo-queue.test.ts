import assert from 'node:assert/strict'
import test from 'node:test'
import { PhotoQueue, type PhotoJob } from '../src/main/photo/photo-queue.ts'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

test('limita i RAW a uno e promuove il file visibile successivo', async () => {
  const queue = new PhotoQueue({ ioConcurrency: 2, rawConcurrency: 1 })
  const firstGate = deferred()
  const promotedGate = deferred()
  const starts: number[] = []
  let runningRaw = 0
  let maxRunningRaw = 0

  const makeJob = (fileId: number, gate?: Promise<void>): PhotoJob => ({
    id: `metadata:${fileId}`,
    fileId,
    kind: 'metadata',
    priority: 0,
    resource: 'raw',
    async run() {
      starts.push(fileId)
      runningRaw++
      maxRunningRaw = Math.max(maxRunningRaw, runningRaw)
      await gate
      runningRaw--
    }
  })

  queue.pause()
  queue.enqueue(makeJob(1, firstGate.promise))
  queue.enqueue(makeJob(2))
  queue.enqueue(makeJob(9, promotedGate.promise))
  queue.promote([9])
  queue.resume()

  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(starts, [9])
  promotedGate.resolve()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(starts, [9, 1])
  firstGate.resolve()
  await queue.onIdle()

  assert.deepEqual(starts, [9, 1, 2])
  assert.equal(maxRunningRaw, 1)
  await queue.shutdown()
})

test('pausa impedisce nuovi job e la deduplica evita doppia esecuzione', async () => {
  const queue = new PhotoQueue({ ioConcurrency: 1, rawConcurrency: 1 })
  let runs = 0
  const job: PhotoJob = {
    id: 'thumbnail:4', fileId: 4, kind: 'thumbnail', priority: 0, resource: 'io',
    async run() { runs++ }
  }

  queue.pause()
  assert.equal(queue.enqueue(job), true)
  assert.equal(queue.enqueue(job), false)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(runs, 0)
  queue.resume()
  await queue.onIdle()
  assert.equal(runs, 1)
  await queue.shutdown()
})
