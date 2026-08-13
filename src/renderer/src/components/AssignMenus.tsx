import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { Category } from '@shared/types'
import { useLabelsStore } from '@renderer/stores/labels'
import { selectFolderCategoryIds, selectFolderTagIds } from '@renderer/stores/selectors'
import { Popover } from './Popover'

interface MenuProps {
  folderId: number
  onClose: () => void
}

/** Menu assegnazione tag a una cartella, con creazione inline (nome + colore). */
export function TagAssignMenu({ folderId, onClose }: MenuProps): React.JSX.Element {
  const tags = useLabelsStore((s) => s.tags)
  const assigned = useLabelsStore((s) => selectFolderTagIds(s, folderId))
  const assignTags = useLabelsStore((s) => s.assignTags)
  const createTag = useLabelsStore((s) => s.createTag)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#007AFF')
  const assignedSet = new Set(assigned)

  const toggle = (id: number): void => {
    const next = assignedSet.has(id) ? assigned.filter((x) => x !== id) : [...assigned, id]
    void assignTags(folderId, next)
  }
  const create = async (): Promise<void> => {
    if (!newName.trim()) return
    const t = await createTag(newName.trim(), newColor)
    toggle(t.id)
    setNewName('')
  }

  return (
    <Popover onClose={onClose} className="assign-menu">
      <div className="assign-menu__title">Tag</div>
      <div className="assign-menu__list">
        {tags.length === 0 && <div className="assign-menu__empty">Nessun tag. Creane uno qui sotto.</div>}
        {tags.map((t) => (
          <button
            key={t.id}
            className={`assign-menu__item${assignedSet.has(t.id) ? ' is-on' : ''}`}
            onClick={() => toggle(t.id)}
          >
            <span className="tag-dot" style={{ background: t.color }} />
            <span className="assign-menu__name">{t.name}</span>
            {assignedSet.has(t.id) && <Check size={14} />}
          </button>
        ))}
      </div>
      <div className="assign-menu__create">
        <label className="color-swatch" style={{ background: newColor }} title="Colore">
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
        </label>
        <input
          className="assign-menu__input"
          value={newName}
          placeholder="Nuovo tag…"
          autoFocus
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
        />
        <button className="icon-btn" onClick={() => void create()} title="Crea tag">
          <Plus size={14} />
        </button>
      </div>
    </Popover>
  )
}

function categoryLabel(c: Category, byId: Map<number, Category>): string {
  if (c.parentId == null) return c.name
  const parent = byId.get(c.parentId)
  return parent ? `${parent.name} › ${c.name}` : c.name
}

/** Menu assegnazione categorie a una cartella, con creazione inline (nome + parent). */
export function CategoryAssignMenu({ folderId, onClose }: MenuProps): React.JSX.Element {
  const categories = useLabelsStore((s) => s.categories)
  const assigned = useLabelsStore((s) => selectFolderCategoryIds(s, folderId))
  const assignCategories = useLabelsStore((s) => s.assignCategories)
  const createCategory = useLabelsStore((s) => s.createCategory)
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState<string>('')
  const assignedSet = new Set(assigned)
  const byId = new Map(categories.map((c) => [c.id, c]))

  const toggle = (id: number): void => {
    const next = assignedSet.has(id) ? assigned.filter((x) => x !== id) : [...assigned, id]
    void assignCategories(folderId, next)
  }
  const create = async (): Promise<void> => {
    if (!newName.trim()) return
    await createCategory({ name: newName.trim(), parentId: newParent ? Number(newParent) : null })
    setNewName('')
  }

  return (
    <Popover onClose={onClose} className="assign-menu">
      <div className="assign-menu__title">Categorie</div>
      <div className="assign-menu__list">
        {categories.length === 0 && <div className="assign-menu__empty">Nessuna categoria.</div>}
        {categories.map((c) => (
          <button
            key={c.id}
            className={`assign-menu__item${assignedSet.has(c.id) ? ' is-on' : ''}`}
            onClick={() => toggle(c.id)}
          >
            <span className="assign-menu__name">{categoryLabel(c, byId)}</span>
            {assignedSet.has(c.id) && <Check size={14} />}
          </button>
        ))}
      </div>
      <div className="assign-menu__create">
        <input
          className="assign-menu__input"
          value={newName}
          placeholder="Nuova categoria…"
          autoFocus
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
        />
        {categories.length > 0 && (
          <select className="assign-menu__select" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
            <option value="">Root</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, byId)}
              </option>
            ))}
          </select>
        )}
        <button className="icon-btn" onClick={() => void create()} title="Crea categoria">
          <Plus size={14} />
        </button>
      </div>
    </Popover>
  )
}
