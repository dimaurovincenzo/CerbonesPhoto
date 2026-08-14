import { useEffect, useMemo, useState } from 'react'
import { FileAudio, FileImage, FileVideo, Folder, SearchX } from 'lucide-react'
import type { SearchResult } from '@shared/types'
import { useFoldersStore } from '@renderer/stores/folders'
import { useLightboxStore } from '@renderer/stores/lightbox'
import { currentPlayerFile, usePlayerStore } from '@renderer/stores/player'
import { useSearchStore } from '@renderer/stores/search'
import { orderSearchAudioQueue } from './search-audio-queue'
import iconUrl from '../../../../build/icon.png'

function ResultIcon({ result }: { result: SearchResult }): React.JSX.Element {
  if (result.resultKind === 'folder') return <Folder size={18} />
  if (result.mediaKind === 'image') return <FileImage size={18} />
  if (result.mediaKind === 'video') return <FileVideo size={18} />
  return <FileAudio size={18} />
}

const mediaKindLabel = (kind: SearchResult['mediaKind']): string => {
  if (kind === 'image') return 'Foto'
  if (kind === 'video') return 'Video'
  if (kind === 'audio') return 'Audio'
  return 'File'
}

const resultCountLabel = (count: number): string => `${count} ${count === 1 ? 'risultato' : 'risultati'}`

export function SearchResults({ query }: { query: string }): React.JSX.Element {
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all')
  const results = useSearchStore((s) => s.results)
  const loading = useSearchStore((s) => s.loading)
  const error = useSearchStore((s) => s.error)
  const run = useSearchStore((s) => s.run)
  const clearResults = useSearchStore((s) => s.clear)
  const selectFolder = useFoldersStore((s) => s.selectFolder)
  const clearQuery = useFoldersStore((s) => s.setSearchQuery)
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const folders = useFoldersStore((s) => s.folders)
  const scopeFolder = folders.find((folder) => folder.id === selectedId)
  const playerQueue = usePlayerStore((s) => s.queue)
  const playerIndex = usePlayerStore((s) => s.index)
  const currentPlayer = currentPlayerFile(playerQueue, playerIndex)
  const scopeLabel = !scopeFolder
    ? 'Ricerca globale'
    : scopeFolder.isRoot
      ? 'Ricerca nella raccolta e sottocartelle'
      : 'Ricerca nella cartella selezionata'

  useEffect(() => {
    const timer = window.setTimeout(() => void run(query, selectedId), 160)
    return () => window.clearTimeout(timer)
  }, [query, run, selectedId])

  useEffect(() => clearResults, [clearResults])

  const visibleResults = useMemo(
    () => filter === 'all' ? results : results.filter((result) => result.mediaKind === filter),
    [filter, results]
  )

  const openResult = async (result: SearchResult): Promise<void> => {
    if (result.resultKind === 'folder') {
      selectFolder(result.folderId)
      clearQuery('')
      return
    }

    if (result.mediaKind === 'image' || result.mediaKind === 'video') {
      const files = await window.cartelli.files.listByFolder(result.folderId)
      const items = files.filter((file) => file.kind === 'image' || file.kind === 'video')
      useLightboxStore.getState().open(items, Math.max(0, items.findIndex((file) => file.id === result.id)))
    } else if (result.mediaKind === 'audio') {
      const folderIds = [...new Set(results
        .filter((candidate) => candidate.resultKind === 'file' && candidate.mediaKind === 'audio')
        .map((candidate) => candidate.folderId))]
      const filesByFolder = new Map(await Promise.all(folderIds.map(async (folderId) => (
        [folderId, await window.cartelli.files.listByFolder(folderId)] as const
      ))))
      const items = orderSearchAudioQueue(results, filesByFolder)
      usePlayerStore.getState().playQueue(items, Math.max(0, items.findIndex((file) => file.id === result.id)))
    }
  }

  if (query.trim().length < 2) {
    return (
      <section className="search-results">
        <div className="grid-empty">
          <p>Continua a scrivere per cercare.</p>
          <span>Inserisci almeno 2 caratteri.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="search-results" aria-live="polite">
      <header className="search-results__header">
        <div>
          <p className="search-results__eyebrow">{scopeLabel} · Italiano + English</p>
          <h1>Risultati per “{query.trim()}”</h1>
        </div>
        {!loading && <span className="search-results__count">{resultCountLabel(visibleResults.length)}</span>}
      </header>

      <div className="segmented-control" role="group" aria-label="Filtra risultati">
        {([['all', 'Tutti'], ['image', 'Foto'], ['video', 'Video'], ['audio', 'Audio']] as const).map(([value, label]) => (
          <button key={value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="grid-empty">Ricerca nell’indice…</div>}
      {error && <div className="search-results__error">Ricerca non disponibile: {error}</div>}
      {!loading && !error && visibleResults.length === 0 && (
        <div className="grid-empty">
          <SearchX size={34} strokeWidth={1.3} />
          <p>Nessuna cartella o file corrisponde alla ricerca.</p>
          <span>Prova anche un termine equivalente in italiano o inglese.</span>
        </div>
      )}
      {!loading && !error && visibleResults.length > 0 && (
        <div className="search-results__list">
          {visibleResults.map((result) => {
            const isCurrent = result.resultKind === 'file' && result.id === currentPlayer?.id
            return (
            <button
              key={`${result.resultKind}-${result.id}`}
              className={`search-result${isCurrent ? ' is-current' : ''}`}
              onClick={() => void openResult(result)}
            >
              <span className={`search-result__icon search-result__icon--${result.resultKind}`}>
                <ResultIcon result={result} />
              </span>
              <span className="search-result__copy">
                <strong>{result.name}</strong>
                <span>In {result.folderName}</span>
              </span>
              <span className="search-result__kind">
                {result.resultKind === 'folder' ? 'Cartella' : mediaKindLabel(result.mediaKind)}
              </span>
              {isCurrent && <img className="search-result__now-playing" src={iconUrl} alt="In riproduzione" />}
            </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
