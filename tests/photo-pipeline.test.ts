import assert from 'node:assert/strict'
import test from 'node:test'
import { PhotoPipeline, type PhotoPipelineRepository, type PhotoProcessor } from '../src/main/photo/photo-pipeline.ts'
import { PhotoQueue } from '../src/main/photo/photo-queue.ts'
import { RawHelperError } from '../src/main/photo/raw-helper.ts'
import type { DerivativeRecord, PhotoMetadata, PhotoProcessingState } from '../src/shared/photo-types.ts'
import type { MediaFile } from '../src/shared/types.ts'

function file(id: number): MediaFile {
  return {
    id, folderId: 1, path: `/foto/${id}.cr3`, name: `${id}.cr3`, kind: 'image', mime: 'image/x-canon-cr3',
    sizeBytes: 10, sourceMtimeMs: 1, width: null, height: null, durationMs: null, hash: null, isFavorite: false,
    metadataJson: null, processingState: 'pending', photoFormat: 'cr3', isRaw: true,
    cameraMake: null, cameraModel: null, capturedAt: null, orientation: null, colorProfile: null,
    pipelineVersion: 1, processingErrorCode: null, processingErrorMessage: null,
    lastProcessedAt: null, createdAt: 1, updatedAt: 1
  }
}

class MemoryRepository implements PhotoPipelineRepository {
  readonly files = new Map([1, 2, 3].map((id) => [id, file(id)]))
  getFile(id: number): MediaFile | null { return this.files.get(id) ?? null }
  updateState(id: number, state: PhotoProcessingState, errorCode: string | null, errorMessage: string | null): void {
    Object.assign(this.files.get(id)!, {
      processingState: state,
      processingErrorCode: errorCode,
      processingErrorMessage: errorMessage
    })
  }
  saveMetadata(): void {}
  saveDerivative(): void {}
  snapshot(paused: boolean) {
    const states = [...this.files.values()].map((item) => item.processingState)
    return {
      pending: states.filter((state) => state === 'pending').length,
      processing: states.filter((state) => state === 'processing').length,
      ready: states.filter((state) => state === 'ready').length,
      partial: states.filter((state) => state === 'partial').length,
      failed: states.filter((state) => state === 'failed').length,
      paused
    }
  }
}

test('isola il fallimento di un RAW e continua i file successivi', async () => {
  const repository = new MemoryRepository()
  const processor: PhotoProcessor = {
    async process(item) {
      if (item.id === 2) throw new RawHelperError('RAW_UNSUPPORTED', '/segreto/foto: stack non pubblico')
      return { metadata: null, derivatives: [], partial: false }
    }
  }
  const pipeline = new PhotoPipeline({
    repository,
    processor,
    queue: new PhotoQueue({ ioConcurrency: 2, rawConcurrency: 1 })
  })

  assert.equal(pipeline.enqueue(1), true)
  assert.equal(pipeline.enqueue(2), true)
  assert.equal(pipeline.enqueue(3), true)
  await pipeline.onIdle()

  assert.equal(repository.files.get(1)?.processingState, 'ready')
  assert.equal(repository.files.get(2)?.processingState, 'failed')
  assert.equal(repository.files.get(3)?.processingState, 'ready')
  assert.equal(repository.files.get(2)?.processingErrorCode, 'RAW_UNSUPPORTED')
  assert.equal(repository.files.get(2)?.processingErrorMessage.includes('/segreto'), false)
  assert.equal(pipeline.snapshot().failed, 1)
  await pipeline.shutdown()
})

test('retry è consentito solo da failed o partial', async () => {
  const repository = new MemoryRepository()
  repository.updateState(1, 'failed', 'RAW_UNSUPPORTED', 'Anteprima RAW non disponibile')
  repository.updateState(2, 'ready', null, null)
  const processor: PhotoProcessor = {
    async process(): Promise<{ metadata: PhotoMetadata | null; derivatives: DerivativeRecord[]; partial: boolean }> {
      return { metadata: null, derivatives: [], partial: false }
    }
  }
  const pipeline = new PhotoPipeline({ repository, processor, queue: new PhotoQueue({ ioConcurrency: 1, rawConcurrency: 1 }) })

  assert.equal(pipeline.retry(2), false)
  assert.equal(pipeline.retry(1), true)
  await pipeline.onIdle()
  assert.equal(repository.files.get(1)?.processingState, 'ready')
  await pipeline.shutdown()
})
