import { useState, type DragEvent } from 'react'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Category, Tag } from '@shared/types'
import { useLabelsStore } from '@renderer/stores/labels'
import { Popover } from './Popover'

const readDraggedId = (event: DragEvent): number => Number(event.dataTransfer.getData('text/cerbonesphoto-id'))

function TagFilterRow({ tag, active }: { tag: Tag; active: boolean }): React.JSX.Element {
  const setTagFilter = useLabelsStore((state) => state.setTagFilter)
  const updateTag = useLabelsStore((state) => state.updateTag)
  const deleteTag = useLabelsStore((state) => state.deleteTag)
  const reorderTags = useLabelsStore((state) => state.reorderTags)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)

  const save = (): void => {
    void updateTag(tag.id, { name: name.trim() || tag.name, color })
    setEditing(false)
  }

  return (
    <div
      className={`tag-row${active ? ' is-active' : ''}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/cerbonesphoto-id', String(tag.id))
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        void reorderTags(readDraggedId(event), tag.id)
      }}
    >
      <GripVertical className="drag-marker" size={13} aria-label={`Trascina ${tag.name}`} />
      <button className="tag-row__main" onClick={() => setTagFilter(tag.id)} title={active ? 'Rimuovi filtro' : 'Filtra per tag'}>
        <span className="tag-dot" style={{ background: tag.color }} />
        <span className="tag-row__name">{tag.name}</span>
      </button>
      <div className="tag-row__actions">
        <button className="icon-btn" onClick={() => setEditing((value) => !value)} title="Modifica tag">
          <Pencil size={11} />
        </button>
        <button
          className="icon-btn icon-btn--danger"
          onClick={() => {
            void window.cartelli.dialogs.confirmLabelRemoval('tag', tag.name)
              .then((confirmed) => { if (confirmed) void deleteTag(tag.id) })
          }}
          title="Elimina tag"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {editing && (
        <Popover onClose={() => setEditing(false)} className="tag-edit">
          <div className="assign-menu__title">Modifica tag</div>
          <div className="assign-menu__create">
            <label className="color-swatch" style={{ background: color }} title="Colore tag">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <input
              className="assign-menu__input"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') save() }}
            />
          </div>
          <button className="btn btn--primary btn--sm assign-menu__save" onClick={save}>Salva</button>
        </Popover>
      )}
    </div>
  )
}

function CategoryNode({
  category,
  depth,
  all,
  activeId
}: {
  category: Category
  depth: number
  all: Category[]
  activeId: number | null
}): React.JSX.Element {
  const setCategoryFilter = useLabelsStore((state) => state.setCategoryFilter)
  const updateCategory = useLabelsStore((state) => state.updateCategory)
  const deleteCategory = useLabelsStore((state) => state.deleteCategory)
  const reorderCategories = useLabelsStore((state) => state.reorderCategories)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color ?? '#8e8e93')
  const children = all.filter((item) => item.parentId === category.id)

  const save = (): void => {
    void updateCategory(category.id, { name: name.trim() || category.name, color })
    setEditing(false)
  }

  return (
    <div>
      <div
        className={`cat-row${activeId === category.id ? ' is-active' : ''}`}
        style={{ paddingLeft: 4 + depth * 14 }}
        draggable
        onClick={() => setCategoryFilter(category.id)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/cerbonesphoto-id', String(category.id))
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void reorderCategories(readDraggedId(event), category.id)
        }}
      >
        <GripVertical className="drag-marker" size={13} aria-label={`Trascina ${category.name}`} />
        <span className="tag-dot" style={{ background: category.color ?? '#8e8e93' }} />
        <span className="cat-row__name">{category.name}</span>
        <div className="cat-row__actions">
          <button
            className="icon-btn"
            onClick={(event) => {
              event.stopPropagation()
              setEditing((value) => !value)
            }}
            title="Modifica categoria"
          >
            <Pencil size={11} />
          </button>
          <button
            className="icon-btn icon-btn--danger"
            onClick={(event) => {
              event.stopPropagation()
              void window.cartelli.dialogs.confirmLabelRemoval('categoria', category.name)
                .then((confirmed) => { if (confirmed) void deleteCategory(category.id) })
            }}
            title="Elimina categoria"
          >
            <Trash2 size={11} />
          </button>
        </div>
        {editing && (
          <Popover onClose={() => setEditing(false)} className="tag-edit">
            <div className="assign-menu__title">Modifica categoria</div>
            <div className="assign-menu__create">
              <label className="color-swatch" style={{ background: color }} title="Colore categoria">
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              </label>
              <input
                className="assign-menu__input"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') save() }}
              />
            </div>
            <button className="btn btn--primary btn--sm assign-menu__save" onClick={save}>Salva</button>
          </Popover>
        )}
      </div>
      {children.map((child) => (
        <CategoryNode key={child.id} category={child} depth={depth + 1} all={all} activeId={activeId} />
      ))}
    </div>
  )
}

export function SidebarSections(): React.JSX.Element {
  const tags = useLabelsStore((state) => state.tags)
  const categories = useLabelsStore((state) => state.categories)
  const tagFilter = useLabelsStore((state) => state.tagFilter)
  const categoryFilter = useLabelsStore((state) => state.categoryFilter)
  const createTag = useLabelsStore((state) => state.createTag)
  const createCategory = useLabelsStore((state) => state.createCategory)
  const [activeTab, setActiveTab] = useState<'tags' | 'categories'>('tags')
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState('#0a84ff')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#8e8e93')
  const roots = categories.filter((category) => category.parentId == null)

  const submitTag = (): void => {
    if (!newTag.trim()) return
    void createTag(newTag.trim(), newTagColor)
    setNewTag('')
  }
  const submitCategory = (): void => {
    if (!newCategory.trim()) return
    void createCategory({ name: newCategory.trim(), color: newCategoryColor })
    setNewCategory('')
  }

  return (
    <div className="sb-sections">
      <div className="labels-tabs" role="tablist" aria-label="Etichette e categorie">
        <button
          role="tab"
          aria-selected={activeTab === 'tags'}
          className={activeTab === 'tags' ? 'is-selected' : ''}
          onClick={() => setActiveTab('tags')}
        >
          Tag <span>{tags.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'categories'}
          className={activeTab === 'categories' ? 'is-selected' : ''}
          onClick={() => setActiveTab('categories')}
        >
          Categorie <span>{categories.length}</span>
        </button>
      </div>

      <div className="labels-panel" role="tabpanel">
        {activeTab === 'tags' ? (
          <>
            <div className="labels-list">
              {tags.length === 0 && <p className="sb-section__empty">Nessun tag. Creane uno qui sotto.</p>}
              {tags.map((tag) => <TagFilterRow key={tag.id} tag={tag} active={tagFilter === tag.id} />)}
            </div>
            <div className="sb-section__create">
              <label className="color-swatch" style={{ background: newTagColor }} title="Colore nuovo tag">
                <input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} />
              </label>
              <input
                className="assign-menu__input"
                value={newTag}
                placeholder="Nuovo tag…"
                onChange={(event) => setNewTag(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') submitTag() }}
              />
              <button className="icon-btn" onClick={submitTag} disabled={!newTag.trim()} title="Crea tag"><Plus size={13} /></button>
            </div>
          </>
        ) : (
          <>
            <div className="labels-list">
              {categories.length === 0 && <p className="sb-section__empty">Nessuna categoria.</p>}
              {roots.map((category) => (
                <CategoryNode key={category.id} category={category} depth={0} all={categories} activeId={categoryFilter} />
              ))}
            </div>
            <div className="sb-section__create">
              <label className="color-swatch" style={{ background: newCategoryColor }} title="Colore nuova categoria">
                <input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} />
              </label>
              <input
                className="assign-menu__input"
                value={newCategory}
                placeholder="Nuova categoria…"
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') submitCategory() }}
              />
              <button className="icon-btn" onClick={submitCategory} disabled={!newCategory.trim()} title="Crea categoria"><Plus size={13} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
