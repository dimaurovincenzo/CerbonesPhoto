import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { useFoldersStore } from '@renderer/stores/folders'

/** Overlay drag&drop: trascinando cartelle dal Finder sull'app, vengono aggiunte come root. */
export function Dropzone(): React.JSX.Element | null {
  const [dragging, setDragging] = useState(false)
  const addPaths = useFoldersStore((s) => s.addPaths)

  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean => Boolean(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'))

    const onDragOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const onDrop = async (e: DragEvent): Promise<void> => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(false)
      const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
      const paths = files.map((f) => window.cartelli.web.pathForFile(f))
      if (paths.length > 0) await addPaths(paths)
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addPaths])

  if (!dragging) return null
  return (
    <div className="dropzone">
      <div className="dropzone__panel">
        <FolderPlus size={44} strokeWidth={1.2} />
        <p>Rilascia per aggiungere le cartelle</p>
      </div>
    </div>
  )
}
