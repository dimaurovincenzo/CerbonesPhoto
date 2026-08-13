import { useEffect, type CSSProperties } from 'react'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { MainContent } from './components/MainContent'
import { Inspector } from './components/Inspector'
import { PlayerBar } from './components/PlayerBar'
import { Lightbox } from './components/Lightbox'
import { Dropzone } from './components/Dropzone'
import { useFoldersStore } from './stores/folders'
import { useLabelsStore } from './stores/labels'
import { usePlayerStore } from './stores/player'
import { useUiStore } from './stores/ui'
import { PaneResizer } from './components/PaneResizer'
import { AppFooter } from './components/AppFooter'
import { usePhotoPipelineStore } from './stores/photo-pipeline'

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || el.isContentEditable
}

export default function App(): React.JSX.Element {
  const loadAll = useFoldersStore((s) => s.loadAll)
  const loadLabels = useLabelsStore((s) => s.loadAll)
  const selectedId = useFoldersStore((s) => s.selectedFolderId)
  const inspectorVisible = useUiStore((s) => s.inspectorVisible)
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const inspectorWidth = useUiStore((s) => s.inspectorWidth)
  const labelsHeight = useUiStore((s) => s.labelsHeight)

  useEffect(() => {
    void loadAll()
    void loadLabels()
  }, [loadAll, loadLabels])

  useEffect(() => usePhotoPipelineStore.getState().connect(), [])

  // Menu app → azioni nel renderer
  useEffect(() => {
    return window.cartelli.events.onMenuAction((action) => {
      if (action === 'add-folder') void useFoldersStore.getState().addFolder()
      if (action === 'refresh-folder') {
        const id = useFoldersStore.getState().selectedFolderId
        if (id != null) void useFoldersStore.getState().rescan(id)
      }
      if (action === 'toggle-inspector') useUiStore.getState().toggleInspector()
    })
  }, [])

  // Keyboard shortcuts globali
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Cmd/Ctrl+F → focus ricerca
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.search-bar__input')
        input?.focus()
        input?.select()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        useUiStore.getState().toggleInspector()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        const id = useFoldersStore.getState().selectedFolderId
        if (id != null) {
          e.preventDefault()
          void useFoldersStore.getState().rescan(id)
        }
        return
      }
      // Space → play/pause (se non si sta scrivendo e c'è una traccia)
      if (e.key === ' ' && !isTyping(e.target)) {
        const st = usePlayerStore.getState()
        if (st.index >= 0) {
          e.preventDefault()
          st.togglePlay()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="app-shell"
      style={{
        '--sidebar-width': `${sidebarWidth}px`,
        '--inspector-width': `${inspectorWidth}px`,
        '--labels-height': `${labelsHeight}px`
      } as CSSProperties}
    >
      <header className="title-bar">
        <span className="title-bar__label">CerbonesPhoto</span>
      </header>

      <Toolbar />

      <div className="workspace">
        <Sidebar />
        <PaneResizer pane="sidebar" />
        <main className="content">
          <MainContent />
        </main>
        {selectedId != null && inspectorVisible && (
          <>
            <PaneResizer pane="inspector" />
            <Inspector />
          </>
        )}
      </div>

      <PlayerBar />
      <AppFooter />
      <Lightbox />
      <Dropzone />
    </div>
  )
}
