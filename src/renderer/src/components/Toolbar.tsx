import { Info, Plus, RefreshCw } from 'lucide-react'
import { useFoldersStore } from '@renderer/stores/folders'
import { useUiStore } from '@renderer/stores/ui'
import { SearchBar } from './SearchBar'

/** Barra strumenti principale, sotto il title bar. */
export function Toolbar(): React.JSX.Element {
  const addFolder = useFoldersStore((s) => s.addFolder)
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const rescan = useFoldersStore((s) => s.rescan)
  const inspectorVisible = useUiStore((s) => s.inspectorVisible)
  const toggleInspector = useUiStore((s) => s.toggleInspector)
  return (
    <div className="toolbar">
      <div className="toolbar__left">
        <button className="toolbar-action" onClick={() => void addFolder()} title="Aggiungi raccolta (⌘O)">
          <Plus size={15} /> <span>Aggiungi</span>
        </button>
      </div>
      <div className="toolbar__center">
        <SearchBar />
      </div>
      <div className="toolbar__right">
        <button
          className="toolbar-action toolbar-action--icon"
          disabled={selectedId == null}
          onClick={() => selectedId != null && void rescan(selectedId)}
          title="Aggiorna raccolta (⌘R)"
          aria-label="Aggiorna raccolta"
        >
          <RefreshCw size={15} />
        </button>
        <button
          className={`toolbar-action toolbar-action--icon${inspectorVisible ? ' is-active' : ''}`}
          onClick={toggleInspector}
          title="Mostra o nascondi informazioni (⌘I)"
          aria-label="Mostra o nascondi informazioni"
        >
          <Info size={15} />
        </button>
      </div>
    </div>
  )
}
