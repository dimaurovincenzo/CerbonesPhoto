import { useEffect, useRef } from 'react'

interface Props {
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/** Popover con chiusura su click-outside ed Esc. */
export function Popover({ onClose, children, className }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className={className ? `popover ${className}` : 'popover'} ref={ref}>
      {children}
    </div>
  )
}
