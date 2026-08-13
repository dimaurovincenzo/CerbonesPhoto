import type { Tag } from '@shared/types'

interface Props {
  tag: Tag
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}

/** Chip di un tag con punto colorato. Clickabile (filtro) e con rimozione opzionale. */
export function TagChip({ tag, onRemove, onClick, active }: Props): React.JSX.Element {
  return (
    <span
      className={`tag-chip${active ? ' is-active' : ''}${onClick ? ' is-clickable' : ''}`}
      onClick={onClick}
      style={{ '--tag-color': tag.color } as React.CSSProperties}
    >
      <span className="tag-chip__dot" style={{ background: tag.color }} />
      <span className="tag-chip__name">{tag.name}</span>
      {onRemove && (
        <button
          className="tag-chip__remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Rimuovi"
        >
          ×
        </button>
      )}
    </span>
  )
}
