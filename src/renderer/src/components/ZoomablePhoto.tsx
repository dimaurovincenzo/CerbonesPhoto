import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ExternalLink, Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react'
import type { MediaFile } from '@shared/types'
import { nextPhotoSource, type PhotoSourceState } from './photo-source-state'

interface Props {
  file: MediaFile
  onOpenExternal: () => void
}

interface Point { x: number; y: number }

const initialSource: PhotoSourceState = { level: 'thumbnail', pending: null, unsupported: false }

export function ZoomablePhoto({ file, onOpenExternal }: Props): React.JSX.Element {
  const [sourceState, dispatchSource] = useReducer(nextPhotoSource, initialSource)
  const [displaySource, setDisplaySource] = useState(`thumb://file/${file.id}?v=${file.updatedAt}`)
  const [scale, setScaleState] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null)
  const objectUrls = useRef<string[]>([])

  useEffect(() => {
    setDisplaySource(`thumb://file/${file.id}?v=${file.updatedAt}`)
    setScaleState(1)
    setPan({ x: 0, y: 0 })
    dispatchSource({ type: 'request-preview' })
    stageRef.current?.focus()
  }, [file.id, file.updatedAt])

  useEffect(() => () => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url)
    objectUrls.current = []
  }, [])

  useEffect(() => {
    if (scale > 2 && !sourceState.pending) dispatchSource({ type: 'zoom', scale })
  }, [scale, sourceState.level, sourceState.pending])

  useEffect(() => {
    const level = sourceState.pending
    if (!level) return
    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(`preview://file/${file.id}?level=${level}`, { cache: 'no-store' })
        if (!active) return
        if (response.status === 202) {
          retryTimer = setTimeout(() => void load(), 850)
          return
        }
        if (response.status === 415) {
          dispatchSource({ type: 'unsupported' })
          return
        }
        if (!response.ok) throw new Error(`Preview HTTP ${response.status}`)
        const objectUrl = URL.createObjectURL(await response.blob())
        const probe = new Image()
        probe.src = objectUrl
        await probe.decode()
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        objectUrls.current.push(objectUrl)
        setDisplaySource(objectUrl)
        dispatchSource({ type: 'loaded', level })
      } catch {
        if (active) retryTimer = setTimeout(() => void load(), 1200)
      }
    }
    void load()
    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [file.id, sourceState.pending])

  const constrainPan = useCallback((candidate: Point, nextScale = scale): Point => {
    const stage = stageRef.current
    if (!stage || nextScale <= 1) return { x: 0, y: 0 }
    const maxX = stage.clientWidth * (nextScale - 1) / 2
    const maxY = stage.clientHeight * (nextScale - 1) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, candidate.x)),
      y: Math.max(-maxY, Math.min(maxY, candidate.y))
    }
  }, [scale])

  const setScale = useCallback((value: number): void => {
    const next = Math.max(1, Math.min(8, Math.round(value * 10) / 10))
    setScaleState(next)
    setPan((current) => constrainPan(current, next))
    dispatchSource({ type: 'zoom', scale: next })
  }, [constrainPan])

  const retryPreview = (): void => {
    dispatchSource({ type: 'request-preview' })
    if (scale > 2) dispatchSource({ type: 'zoom', scale })
  }

  return (
    <div
      ref={stageRef}
      className={`zoomable-photo${scale > 1 ? ' is-zoomed' : ''}`}
      tabIndex={0}
      aria-label={`Visualizzazione di ${file.name}, zoom ${scale.toFixed(1)} per`}
      onDoubleClick={() => setScale(scale > 1 ? 1 : 2)}
      onWheel={(event) => {
        if (!event.metaKey && !event.ctrlKey) return
        event.preventDefault()
        setScale(scale + (event.deltaY < 0 ? 0.5 : -0.5))
      }}
      onKeyDown={(event) => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); setScale(scale + 0.5) }
        else if (event.key === '-') { event.preventDefault(); setScale(scale - 0.5) }
        else if (event.key === '0') { event.preventDefault(); setScale(1) }
        else if (scale > 1 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault()
          const delta = 36
          setPan((current) => constrainPan({
            x: current.x + (event.key === 'ArrowLeft' ? delta : event.key === 'ArrowRight' ? -delta : 0),
            y: current.y + (event.key === 'ArrowUp' ? delta : event.key === 'ArrowDown' ? -delta : 0)
          }))
        }
      }}
      onPointerDown={(event) => {
        if (scale <= 1) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, pan }
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        setPan(constrainPan({
          x: drag.pan.x + event.clientX - drag.origin.x,
          y: drag.pan.y + event.clientY - drag.origin.y
        }))
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
      }}
      onPointerCancel={() => { dragRef.current = null }}
    >
      <img
        className="zoomable-photo__image"
        src={displaySource}
        alt={file.name}
        draggable={false}
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
      />

      <div className="zoomable-photo__controls" aria-label="Controlli zoom">
        <button type="button" onClick={() => setScale(scale - 0.5)} disabled={scale <= 1} aria-label="Riduci zoom">
          <Minus size={14} />
        </button>
        <button type="button" className="zoomable-photo__scale" onClick={() => setScale(1)} aria-label="Reimposta zoom">
          {Math.round(scale * 100)}%
        </button>
        <button type="button" onClick={() => setScale(scale + 0.5)} disabled={scale >= 8} aria-label="Aumenta zoom">
          <Plus size={14} />
        </button>
      </div>

      {sourceState.pending && (
        <span className="zoomable-photo__quality" role="status">
          <RefreshCw className="is-spinning" size={12} /> Qualità superiore…
        </span>
      )}
      {sourceState.unsupported && (
        <div className="zoomable-photo__fallback" role="alert">
          <p>Anteprima non disponibile</p>
          <div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={retryPreview}>
              <RotateCcw size={13} /> Riprova anteprima
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={onOpenExternal}>
              <ExternalLink size={13} /> Apri nel sistema
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
