import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileAudio, FileImage, FileVideo, LoaderCircle, RotateCcw } from 'lucide-react'
import type { MediaFile } from '@shared/types'
import { usePhotoPipelineStore } from '@renderer/stores/photo-pipeline'

interface Props {
  file: MediaFile
  onSelect?: (file: MediaFile) => void
  onVisibilityChange?: (fileId: number, visible: boolean) => void
}

/** Card di un file multimediale: thumbnail immagine o icona audio/video. */
export function MediaCard({ file, onSelect, onVisibilityChange }: Props): React.JSX.Element {
  const [thumbnailError, setThumbnailError] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const retry = usePhotoPipelineStore((state) => state.retry)
  const isImage = file.kind === 'image'
  const isVideo = file.kind === 'video'
  const isBusy = isImage && (file.processingState === 'pending' || file.processingState === 'processing')
  const needsAttention = isImage && (file.processingState === 'failed' || file.processingState === 'partial')

  useEffect(() => setThumbnailError(false), [file.id])
  useEffect(() => {
    const element = cardRef.current
    if (!element || !onVisibilityChange) return
    const observer = new IntersectionObserver(([entry]) => onVisibilityChange(file.id, entry.isIntersecting), {
      rootMargin: '160px'
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      onVisibilityChange(file.id, false)
    }
  }, [file.id, onVisibilityChange])

  return (
    <article
      ref={cardRef}
      className={`media-card media-card--${file.kind}`}
      title={file.name}
      aria-busy={isBusy}
    >
      <button
        type="button"
        className="media-card__primary"
        onClick={() => onSelect?.(file)}
        onDoubleClick={() => void window.cartelli.files.open(file.id)}
      >
        <div className="media-card__thumb">
          {isImage && !thumbnailError ? (
            <img
              src={`thumb://file/${file.id}?v=${file.updatedAt}`}
              alt=""
              loading="lazy"
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <div className="media-card__icon">
              {isImage ? <FileImage size={30} strokeWidth={1.5} /> : isVideo ? <FileVideo size={30} strokeWidth={1.5} /> : <FileAudio size={30} strokeWidth={1.5} />}
            </div>
          )}
          <span className="media-card__badge">
            {file.kind === 'image' ? (file.isRaw ? 'RAW' : 'IMG') : file.kind === 'video' ? 'VID' : 'AUD'}
          </span>
          {isBusy && (
            <span className="media-card__state" role="status">
              <LoaderCircle className="is-spinning" size={14} /> Anteprima
            </span>
          )}
          {needsAttention && (
            <span className="media-card__state media-card__state--warning" role="status">
              <AlertTriangle size={14} /> Da controllare
            </span>
          )}
        </div>
        <span className="media-card__name" title={file.name}>{file.name}</span>
      </button>
      {needsAttention && (
        <button type="button" className="media-card__retry" onClick={() => void retry(file.id)}>
          <RotateCcw size={11} /> Riprova anteprima
        </button>
      )}
    </article>
  )
}
