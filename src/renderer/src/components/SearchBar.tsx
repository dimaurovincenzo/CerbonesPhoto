import { Search, X } from 'lucide-react'
import { useFoldersStore } from '@renderer/stores/folders'

/** Campo di ricerca che filtra le cartelle nella sidebar per nome. */
export function SearchBar(): React.JSX.Element {
  const query = useFoldersStore((s) => s.searchQuery)
  const setQuery = useFoldersStore((s) => s.setSearchQuery)
  return (
    <div className="search-bar">
      <Search size={13} className="search-bar__icon" />
      <input
        className="search-bar__input"
        value={query}
        placeholder="Cerca cartelle e file, IT / EN…"
        aria-label="Cerca cartelle e file in italiano o inglese"
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button className="icon-btn search-bar__clear" onClick={() => setQuery('')} title="Cancella">
          <X size={12} />
        </button>
      )}
      {!query && <kbd className="search-bar__shortcut">⌘F</kbd>}
    </div>
  )
}
