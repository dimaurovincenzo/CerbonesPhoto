import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { MediaFile } from '@shared/types'
import { MediaCard } from './MediaCard'
import { useFoldersStore } from '@renderer/stores/folders'
import { useLightboxStore } from '@renderer/stores/lightbox'
import { usePlayerStore } from '@renderer/stores/player'
import { usePhotoPipelineStore } from '@renderer/stores/photo-pipeline'

/** Griglia dei file multimediali della cartella selezionata. */
export function MediaGrid(): React.JSX.Element {
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const rescan = useFoldersStore((s) => s.rescan)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all')
  const photoSnapshot = usePhotoPipelineStore((state) => state.snapshot)
  const visibleIds = useRef(new Set<number>())
  const visibilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selectedId == null) {
      setFiles([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    window.cartelli.files
      .listByFolder(selectedId)
      .then((fs) => {
        if (!cancelled) {
          setFiles(fs)
          setLoading(false)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoading(false)
          setError(reason instanceof Error ? reason.message : 'Impossibile caricare i contenuti')
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, photoSnapshot.ready, photoSnapshot.partial, photoSnapshot.failed])

  const handleVisibilityChange = useCallback((fileId: number, visible: boolean): void => {
    if (visible) visibleIds.current.add(fileId)
    else visibleIds.current.delete(fileId)
    if (visibilityTimer.current) clearTimeout(visibilityTimer.current)
    visibilityTimer.current = setTimeout(() => {
      visibilityTimer.current = null
      void usePhotoPipelineStore.getState().promoteVisible([...visibleIds.current])
    }, 150)
  }, [])

  useEffect(() => () => {
    if (visibilityTimer.current) clearTimeout(visibilityTimer.current)
  }, [])

  const handleSelect = (file: MediaFile): void => {
    if (file.kind === 'image' || file.kind === 'video') {
      const visuals = files.filter((f) => f.kind === 'image' || f.kind === 'video')
      const idx = visuals.findIndex((f) => f.id === file.id)
      useLightboxStore.getState().open(visuals, idx)
    } else if (file.kind === 'audio') {
      const audios = files.filter((f) => f.kind === 'audio')
      const idx = audios.findIndex((f) => f.id === file.id)
      usePlayerStore.getState().playQueue(audios, idx)
    }
  }

  const visibleFiles = useMemo(
    () => filter === 'all' ? files : files.filter((file) => file.kind === filter),
    [files, filter]
  )

  if (loading) return <div className="grid-empty">Caricamento…</div>

  if (error) {
    return (
      <div className="grid-empty" role="alert">
        <p>Non è stato possibile mostrare questa raccolta.</p>
        <button className="btn btn--ghost btn--sm" onClick={() => selectedId != null && void rescan(selectedId)}>
          <RefreshCw size={13} /> Riprova
        </button>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="grid-empty">
        <p>Nessun file multimediale in questa cartella.</p>
        {selectedId != null && (
          <button className="btn btn--ghost btn--sm" onClick={() => void rescan(selectedId)}>
            <RefreshCw size={13} /> Aggiorna scansione
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="media-filterbar">
        <div className="segmented-control" role="group" aria-label="Filtra contenuti">
          {([['all', 'Tutti'], ['image', 'Foto'], ['video', 'Video'], ['audio', 'Audio']] as const).map(([value, label]) => (
            <button key={value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <span>{visibleFiles.length} {visibleFiles.length === 1 ? 'elemento' : 'elementi'}</span>
      </div>
      {visibleFiles.length === 0 ? (
        <div className="grid-empty"><p>Nessun contenuto per questo filtro.</p></div>
      ) : (
        <div className="media-grid">
          {visibleFiles.map((f) => (
            <MediaCard key={f.id} file={f} onSelect={handleSelect} onVisibilityChange={handleVisibilityChange} />
          ))}
        </div>
      )}
    </>
  )
}
