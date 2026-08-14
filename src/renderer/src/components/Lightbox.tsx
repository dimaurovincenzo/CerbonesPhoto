import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, FolderSearch, X } from 'lucide-react'
import { useLightboxStore } from '@renderer/stores/lightbox'
import { ZoomablePhoto } from './ZoomablePhoto'

/** Quick Look full-screen per immagini e video, navigabile da tastiera. */
export function Lightbox(): React.JSX.Element | null {
  const items = useLightboxStore((s) => s.items)
  const index = useLightboxStore((s) => s.index)
  const close = useLightboxStore((s) => s.close)
  const next = useLightboxStore((s) => s.next)
  const prev = useLightboxStore((s) => s.prev)

  const current = index >= 0 ? items[index] : undefined
  const [mediaError, setMediaError] = useState(false)

  useEffect(() => setMediaError(false), [current?.id])

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, close, next, prev])

  if (!current) return null

  return (
    <div className="lightbox" onClick={close} role="dialog" aria-modal="true">
      <button className="lightbox__close icon-btn" onClick={close} title="Chiudi (Esc)">
        <X size={20} />
      </button>

      {index > 0 && (
        <button
          className="lightbox__nav lightbox__nav--prev"
          onClick={(e) => {
            e.stopPropagation()
            prev()
          }}
          title="Precedente (←)"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          className="lightbox__nav lightbox__nav--next"
          onClick={(e) => {
            e.stopPropagation()
            next()
          }}
          title="Successiva (→)"
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div
        className="lightbox__stage"
        onClick={(e) => e.stopPropagation()}
        draggable
        onDragStart={(event) => {
          event.preventDefault()
          window.cartelli.files.startDrag(current.id)
        }}
      >
        {current.kind === 'image' ? (
          <ZoomablePhoto key={current.id} file={current} onOpenExternal={() => void window.cartelli.files.open(current.id)} />
        ) : !mediaError && current.kind === 'video' ? (
          <video
            className="lightbox__video"
            src={`media://file/${current.id}`}
            controls
            autoPlay
            onError={() => setMediaError(true)}
          />
        ) : (
          <div className="lightbox__unsupported">
            <p>Questo codec non può essere visualizzato direttamente.</p>
            <button className="btn btn--primary" onClick={() => void window.cartelli.files.open(current.id)}>
              <ExternalLink size={14} /> Apri con l’app predefinita
            </button>
          </div>
        )}
      </div>
      <div className="lightbox__caption" onClick={(e) => e.stopPropagation()}>
        <span>{current.name} <span className="lightbox__count">· {index + 1}/{items.length}</span></span>
        <button className="lightbox__open" onClick={() => void window.cartelli.files.showInFinder(current.id)}>
          <FolderSearch size={12} /> Mostra nel Finder
        </button>
        <button className="lightbox__open" onClick={() => void window.cartelli.files.open(current.id)}>
          <ExternalLink size={12} /> Apri nel sistema
        </button>
      </div>
    </div>
  )
}
