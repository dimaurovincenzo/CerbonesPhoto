import { FolderPlus } from 'lucide-react'
import { MediaGrid } from './MediaGrid'
import { useFoldersStore } from '@renderer/stores/folders'
import { SearchResults } from './SearchResults'

/** Area principale: empty state, placeholder o anteprima cartella con griglia media. */
export function MainContent(): React.JSX.Element {
  const folders = useFoldersStore((s) => s.folders)
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const addFolder = useFoldersStore((s) => s.addFolder)
  const searchQuery = useFoldersStore((s) => s.searchQuery)

  if (searchQuery.trim()) return <SearchResults query={searchQuery} />

  if (folders.length === 0) {
    return (
      <div className="empty-state">
        <FolderPlus size={52} strokeWidth={1.1} />
        <h2>Nessuna raccolta</h2>
        <p>Aggiungi una cartella dal tuo Mac per organizzare foto, video e audio.</p>
        <button className="btn btn--primary" onClick={() => void addFolder()}>
          Aggiungi raccolta
        </button>
      </div>
    )
  }

  const selected = folders.find((f) => f.id === selectedId)
  if (!selected) {
    return (
      <div className="content__placeholder">
        <p>Seleziona una raccolta dalla barra laterale.</p>
      </div>
    )
  }

  return (
    <div className="folder-view">
      <header className="folder-view__header">
        <div className="folder-view__titleline">
          <h1>{selected.displayName || selected.name}</h1>
          {selected.fileCount > 0 && (
            <span className="folder-view__count">{selected.fileCount} file</span>
          )}
        </div>
        <p className="folder-view__subtitle">La tua raccolta multimediale</p>
      </header>
      <div className="folder-view__body">
        <MediaGrid />
      </div>
    </div>
  )
}
