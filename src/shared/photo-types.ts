export type PhotoProcessingState = 'pending' | 'processing' | 'ready' | 'partial' | 'failed'
export type DerivativeLevel = 'thumbnail' | 'preview' | 'high-resolution'

export interface PhotoFormat {
  extension: string
  mime: string
  family: 'standard' | 'raw'
  vendor: string | null
}

export type PhotoErrorCode =
  | 'FILE_MISSING'
  | 'PERMISSION_DENIED'
  | 'METADATA_INVALID'
  | 'RAW_UNSUPPORTED'
  | 'PREVIEW_CORRUPT'
  | 'ENGINE_TIMEOUT'
  | 'CACHE_UNWRITABLE'
  | 'RESOURCE_LIMIT'

export interface PhotoError {
  code: PhotoErrorCode
  phase: 'scan' | 'metadata' | DerivativeLevel
  message: string
  retryable: boolean
}

export interface PhotoMetadata {
  cameraMake: string | null
  cameraModel: string | null
  lens: string | null
  capturedAt: string | null
  width: number | null
  height: number | null
  orientation: number | null
  iso: number | null
  aperture: number | null
  exposureSeconds: number | null
  focalLengthMm: number | null
  colorProfile: string | null
  keywords: string[]
}

export interface DerivativeRecord {
  fileId: number
  level: DerivativeLevel
  path: string
  mime: 'image/webp' | 'image/jpeg'
  width: number
  height: number
  sizeBytes: number
  cacheKey: string
}

export interface PhotoEngineHealth {
  name: 'exiftool' | 'libraw' | 'sharp'
  available: boolean
  version: string | null
  architecture: string | null
  errorCode: string | null
}

export interface PhotoPipelineSnapshot {
  pending: number
  processing: number
  ready: number
  partial: number
  failed: number
  paused: boolean
}
