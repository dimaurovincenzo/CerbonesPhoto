import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useFoldersStore } from '@renderer/stores/folders'
import { useLabelsStore } from '@renderer/stores/labels'
import { SidebarFolder } from './SidebarFolder'
import { SidebarSections } from './SidebarSections'
import { PaneResizer } from './PaneResizer'

/** Sidebar: header, albero cartelle filtrato, sezioni Tag/Categorie. */
export function Sidebar(): React.JSX.Element {
  const folders = useFoldersStore((s) => s.folders)
  const loading = useFoldersStore((s) => s.loading)
  const error = useFoldersStore((s) => s.error)
  const addFolder = useFoldersStore((s) => s.addFolder)

  const tagFilter = useLabelsStore((s) => s.tagFilter)
  const categoryFilter = useLabelsStore((s) => s.categoryFilter)
  const folderTags = useLabelsStore((s) => s.folderTags)
  const folderCategories = useLabelsStore((s) => s.folderCategories)

  // La ricerca globale vive nel contenuto; la sidebar resta stabile e filtra solo le etichette.
  const { visibleRoots, visibleIds } = useMemo(() => {
    const matchers: Array<(f: (typeof folders)[number]) => boolean> = []
    if (tagFilter != null) matchers.push((f) => (folderTags[f.id] ?? []).includes(tagFilter))
    if (categoryFilter != null) matchers.push((f) => (folderCategories[f.id] ?? []).includes(categoryFilter))

    if (matchers.length === 0) {
      return { visibleRoots: folders.filter((f) => f.isRoot), visibleIds: null as Set<number> | null }
    }

    const byId = new Map(folders.map((f) => [f.id, f]))
    const matched = folders.filter((f) => matchers.every((m) => m(f)))
    const visible = new Set<number>()
    for (const f of matched) {
      let cur: number | null = f.id
      while (cur != null && !visible.has(cur)) {
        visible.add(cur)
        cur = byId.get(cur)?.parentId ?? null
      }
    }
    return {
      visibleRoots: folders.filter((f) => f.isRoot && visible.has(f.id)),
      visibleIds: visible
    }
  }, [folders, tagFilter, categoryFilter, folderTags, folderCategories])

  const rootsEmpty = visibleRoots.length === 0

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">Raccolte</span>
        <button className="icon-btn sidebar__add" onClick={() => void addFolder()} title="Aggiungi raccolta">
          <Plus size={15} />
        </button>
      </div>

      {error && <div className="sidebar__error">{error}</div>}

      <div className="sidebar__list">
        {rootsEmpty && !loading && (
          <div className="sidebar__empty">
            <p>Nessuna raccolta{tagFilter != null || categoryFilter != null ? ' per i filtri attivi.' : '.'}</p>
            {tagFilter == null && categoryFilter == null && (
              <button className="btn btn--ghost btn--sm" onClick={() => void addFolder()}>
                + Aggiungi
              </button>
            )}
          </div>
        )}
        {loading && rootsEmpty && <div className="sidebar__loading">Caricamento…</div>}
        {visibleRoots.map((f) => (
          <SidebarFolder key={f.id} folder={f} depth={0} visibleIds={visibleIds} />
        ))}
      </div>

      <PaneResizer pane="labels" />
      <SidebarSections />
    </aside>
  )
}
