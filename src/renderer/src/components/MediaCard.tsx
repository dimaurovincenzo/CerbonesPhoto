import { useEffect, useState } from 'react'
import { FileAudio, FileImage, FileVideo } from 'lucide-react'
import type { MediaFile } from '@shared/types'

interface Props {
  file: MediaFile
  onSelect?: (file: MediaFile) => void
}

/** Card di un file multimediale: thumbnail immagine o icona audio/video. */
export function MediaCard({ file, onSelect }: Props): React.JSX.Element {
  const [thumbnailError, setThumbnailError] = useState(false)
  const isImage = file.kind === 'image'
  const isVideo = file.kind === 'video'

  useEffect(() => setThumbnailError(false), [file.id])
  return (
    <button
      className={`media-card media-card--${file.kind}`}
      onClick={() => onSelect?.(file)}
      onDoubleClick={() => void window.cartelli.files.open(file.id)}
      title={file.name}
    >
      <div className="media-card__thumb">
        {isImage && !thumbnailError ? (
          <img
            src={`thumb://file/${file.id}`}
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
          {file.kind === 'image' ? 'IMG' : file.kind === 'video' ? 'VID' : 'AUD'}
        </span>
      </div>
      <div className="media-card__name" title={file.name}>
        {file.name}
      </div>
    </button>
  )
}
