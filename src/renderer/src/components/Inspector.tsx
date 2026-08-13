import { useMemo, useState } from 'react'
import { FolderTree, Tag as TagIcon, Folder as FolderIcon } from 'lucide-react'
import { useFoldersStore } from '@renderer/stores/folders'
import { useLabelsStore } from '@renderer/stores/labels'
import { selectFolderCategoryIds, selectFolderTagIds } from '@renderer/stores/selectors'
import { TagChip } from './TagChip'
import { CategoryAssignMenu, TagAssignMenu } from './AssignMenus'
import { clearAssignedIds, removeAssignedId } from './label-assignment'

const fmtDate = (ms: number | null): string =>
  ms ? new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

/** Pannello destro: dettagli della cartella selezionata + gestione etichette. */
export function Inspector(): React.JSX.Element | null {
  const folders = useFoldersStore((s) => s.folders)
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const loadAll = useFoldersStore((s) => s.loadAll)
  const allTags = useLabelsStore((s) => s.tags)
  const allCategories = useLabelsStore((s) => s.categories)
  const tagIds = useLabelsStore((s) => selectFolderTagIds(s, selectedId ?? -1))
  const categoryIds = useLabelsStore((s) => selectFolderCategoryIds(s, selectedId ?? -1))
  const assignTags = useLabelsStore((s) => s.assignTags)
  const assignCategories = useLabelsStore((s) => s.assignCategories)

  const [tagMenu, setTagMenu] = useState(false)
  const [catMenu, setCatMenu] = useState(false)

  const tags = useMemo(
    () => allTags.filter((tag) => tagIds.includes(tag.id)),
    [allTags, tagIds]
  )
  const categories = useMemo(
    () => allCategories.filter((category) => categoryIds.includes(category.id)),
    [allCategories, categoryIds]
  )

  const folder = folders.find((f) => f.id === selectedId)
  if (!folder) return null

  const removeTag = (id: number): void => {
    void assignTags(folder.id, removeAssignedId(tagIds, id))
  }
  const removeCat = (id: number): void => {
    void assignCategories(folder.id, removeAssignedId(categoryIds, id))
  }

  return (
    <aside className="inspector">
      <div className="inspector__header">
        <FolderIcon size={15} className="inspector__icon" />
        <div className="inspector__title">
          {folder.displayName || folder.name}
        </div>
      </div>

      <section className="inspector__meta">
        <div className="meta-row">
          <span className="meta-row__k">Elementi</span>
          <span className="meta-row__v">{folder.fileCount}</span>
        </div>
        <div className="meta-row">
          <span className="meta-row__k">Ultima scansione</span>
          <span className="meta-row__v">{fmtDate(folder.lastScannedAt)}</span>
        </div>
        <div className="meta-row">
          <span className="meta-row__k">Aggiunta</span>
          <span className="meta-row__v">{fmtDate(folder.createdAt)}</span>
        </div>
      </section>

      <section className="inspector__section">
        <div className="inspector__sectionhead">
          <TagIcon size={13} />
          <span>Etichette</span>
          {tags.length > 0 && (
            <button className="inspector__clear" onClick={() => void assignTags(folder.id, clearAssignedIds())}>
              Rimuovi tutte
            </button>
          )}
          <button className="inspector__add" onClick={() => setTagMenu((v) => !v)}>
            + Aggiungi
          </button>
        </div>
        <div className="inspector__chips">
          {tags.length === 0 && <span className="inspector__empty">Nessun tag</span>}
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} onRemove={() => removeTag(t.id)} removeLabel={`Rimuovi etichetta ${t.name}`} />
          ))}
        </div>
        {tagMenu && <TagAssignMenu folderId={folder.id} onClose={() => setTagMenu(false)} />}
      </section>

      <section className="inspector__section">
        <div className="inspector__sectionhead">
          <FolderTree size={13} />
          <span>Categorie</span>
          {categories.length > 0 && (
            <button className="inspector__clear" onClick={() => void assignCategories(folder.id, clearAssignedIds())}>
              Rimuovi tutte
            </button>
          )}
          <button className="inspector__add" onClick={() => setCatMenu((v) => !v)}>
            + Aggiungi
          </button>
        </div>
        <div className="inspector__chips">
          {categories.length === 0 && <span className="inspector__empty">Nessuna categoria</span>}
          {categories.map((c) => (
            <TagChip
              key={c.id}
              tag={{ id: c.id, name: c.name, color: c.color ?? '#8E8E93', sortOrder: c.sortOrder, createdAt: 0 }}
              onRemove={() => removeCat(c.id)}
              removeLabel={`Rimuovi categoria ${c.name}`}
            />
          ))}
        </div>
        {catMenu && <CategoryAssignMenu folderId={folder.id} onClose={() => setCatMenu(false)} />}
      </section>

      <section className="inspector__section">
        <div className="inspector__sectionhead">
          <span>Note</span>
        </div>
        <textarea
          className="inspector__notes"
          placeholder="Annotazioni libere su questa cartella…"
          defaultValue={folder.notes ?? ''}
          onBlur={(e) => {
            if (e.target.value !== (folder.notes ?? '')) {
              void window.cartelli.folders.update(folder.id, { notes: e.target.value }).then(() => loadAll())
            }
          }}
        />
      </section>
    </aside>
  )
}
