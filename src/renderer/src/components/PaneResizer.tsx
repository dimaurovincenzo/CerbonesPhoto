import type { PointerEvent as ReactPointerEvent } from 'react'
import { useUiStore } from '@renderer/stores/ui'

type Pane = 'sidebar' | 'inspector' | 'labels'

export function PaneResizer({ pane }: { pane: Pane }): React.JSX.Element {
  const sidebarWidth = useUiStore((state) => state.sidebarWidth)
  const inspectorWidth = useUiStore((state) => state.inspectorWidth)
  const labelsHeight = useUiStore((state) => state.labelsHeight)
  const setSidebarWidth = useUiStore((state) => state.setSidebarWidth)
  const setInspectorWidth = useUiStore((state) => state.setInspectorWidth)
  const setLabelsHeight = useUiStore((state) => state.setLabelsHeight)
  const resetSidebarWidth = useUiStore((state) => state.resetSidebarWidth)
  const resetInspectorWidth = useUiStore((state) => state.resetInspectorWidth)
  const resetLabelsHeight = useUiStore((state) => state.resetLabelsHeight)
  const horizontal = pane === 'labels'

  const startResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startValue = pane === 'sidebar' ? sidebarWidth : pane === 'inspector' ? inspectorWidth : labelsHeight
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add(horizontal ? 'is-resizing-row' : 'is-resizing-column')

    const onMove = (moveEvent: PointerEvent): void => {
      if (pane === 'sidebar') setSidebarWidth(startValue + moveEvent.clientX - startX)
      else if (pane === 'inspector') setInspectorWidth(startValue - (moveEvent.clientX - startX))
      else setLabelsHeight(startValue - (moveEvent.clientY - startY))
    }
    const onEnd = (): void => {
      document.body.classList.remove('is-resizing-row', 'is-resizing-column')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  const adjust = (delta: number): void => {
    if (pane === 'sidebar') setSidebarWidth(sidebarWidth + delta)
    else if (pane === 'inspector') setInspectorWidth(inspectorWidth + delta)
    else setLabelsHeight(labelsHeight + delta)
  }

  const reset = (): void => {
    if (pane === 'sidebar') resetSidebarWidth()
    else if (pane === 'inspector') resetInspectorWidth()
    else resetLabelsHeight()
  }

  return (
    <div
      className={`pane-resizer pane-resizer--${horizontal ? 'horizontal' : 'vertical'}`}
      role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-label={horizontal ? 'Ridimensiona etichette' : `Ridimensiona ${pane === 'sidebar' ? 'barra laterale' : 'informazioni'}`}
      tabIndex={0}
      onPointerDown={startResize}
      onDoubleClick={reset}
      onKeyDown={(event) => {
        const decrement = horizontal ? event.key === 'ArrowUp' : event.key === 'ArrowLeft'
        const increment = horizontal ? event.key === 'ArrowDown' : event.key === 'ArrowRight'
        if (decrement || increment) {
          event.preventDefault()
          adjust(increment ? 12 : -12)
        }
      }}
    />
  )
}
