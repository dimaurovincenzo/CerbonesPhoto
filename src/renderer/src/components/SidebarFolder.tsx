import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  RefreshCw,
  Tag as TagIcon,
  Trash2
} from 'lucide-react'
import type { Folder } from '@shared/types'
import { useFoldersStore } from '@renderer/stores/folders'
import { useLabelsStore } from '@renderer/stores/labels'
import { selectFolderTagIds } from '@renderer/stores/selectors'
import { TagAssignMenu } from './AssignMenus'

interface Props {
  folder: Folder
  depth: number
  visibleIds: Set<number> | null
}

/** Riga di cartella nell'albero della sidebar, con figli annidati ricorsivamente. */
export function SidebarFolder({ folder, depth, visibleIds }: Props): React.JSX.Element {
  const [open, setOpen] = useState(depth === 0)
  const [tagMenu, setTagMenu] = useState(false)
  const folders = useFoldersStore((s) => s.folders)
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const select = useFoldersStore((s) => s.selectFolder)
  const rescan = useFoldersStore((s) => s.rescan)
  const remove = useFoldersStore((s) => s.removeFolder)
  const tagIds = useLabelsStore((s) => selectFolderTagIds(s, folder.id))
  const tags = useLabelsStore((s) => s.tags)

  const children = useMemo(
    () =>
      folders.filter(
        (f) => f.parentId === folder.id && (!visibleIds || visibleIds.has(f.id))
      ),
    [folders, folder.id, visibleIds]
  )
  const isSelected = selectedId === folder.id
  const hasChildren = children.length > 0
  const folderTags = tagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <div>
      <div
        className={`folder-row${isSelected ? ' is-selected' : ''}${hasChildren ? '' : ' is-leaf'}`}
        style={{ paddingLeft: 8 + depth * 15 }}
        onClick={() => select(folder.id)}
      >
        <button
          className="folder-row__disclose"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) setOpen((o) => !o)
          }}
          tabIndex={-1}
          aria-label={open ? 'Comprimi' : 'Espandi'}
        >
          {hasChildren ? (
            open ? <ChevronDown size={13} /> : <ChevronRight size={13} />
          ) : (
            <span className="folder-row__dot" />
          )}
        </button>
        <FolderIcon size={14} className="folder-row__icon" />
        <span className="folder-row__name">{folder.displayName || folder.name}</span>

        {folderTags.length > 0 && (
          <span className="folder-row__tagdots">
            {folderTags.slice(0, 4).map((t) => (
              <span key={t.id} className="tag-dot" style={{ background: t.color }} />
            ))}
          </span>
        )}

        {folder.fileCount > 0 && <span className="folder-row__count">{folder.fileCount}</span>}

        <div className="folder-row__actions">
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              setTagMenu((v) => !v)
            }}
            title="Tag"
          >
            <TagIcon size={12} />
          </button>
          {folder.isRoot && (
            <>
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  void rescan(folder.id)
                }}
                title="Aggiorna scansione"
              >
                <RefreshCw size={12} />
              </button>
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  void window.cartelli.dialogs
                    .confirmFolderRemoval(folder.displayName || folder.name)
                    .then((confirmed) => {
                      if (confirmed) void remove(folder.id)
                    })
                }}
                title="Rimuovi"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>

        {tagMenu && (
          <div className="folder-row__menu">
            <TagAssignMenu folderId={folder.id} onClose={() => setTagMenu(false)} />
          </div>
        )}
      </div>
      {open &&
        hasChildren &&
        children.map((c) => <SidebarFolder key={c.id} folder={c} depth={depth + 1} visibleIds={visibleIds} />)}
    </div>
  )
}
