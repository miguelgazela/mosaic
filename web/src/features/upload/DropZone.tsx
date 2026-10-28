import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { clientToWorld } from '../../canvas/canvasDom'
import { dropFiles } from './dropFiles'

const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')

/** Dashed overlay while files are dragged over the canvas (04-board-file-drop-offline). */
export function DropZone() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const inCanvas = (e: DragEvent) => {
      const r = document.querySelector('[data-testid="canvas"]')?.getBoundingClientRect()
      return !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    }
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault() // also stops the browser opening the file when dropped outside the canvas
      if (inCanvas(e)) {
        e.dataTransfer!.dropEffect = 'copy'
        setCount(e.dataTransfer!.items.length || 1)
      } else setCount(null)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      if (!e.relatedTarget) setCount(null) // left the window
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setCount(null)
      if (!inCanvas(e)) return
      dropFiles([...e.dataTransfer!.files], clientToWorld(e.clientX, e.clientY))
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  if (count === null) return null
  return (
    <div
      data-testid="drop-zone"
      className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-menu)] border-2 border-dashed border-[var(--primary)] bg-[var(--primary-soft)]/90"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-tile)] bg-[var(--primary)] text-white">
        <Upload size={28} aria-hidden />
      </span>
      <div className="mt-2 text-[length:var(--text-h3)] font-semibold leading-[var(--leading-h3)] text-[var(--primary-ink)]">Drop to add to board</div>
      <div className="text-[length:var(--text-sm)] text-[var(--primary-ink)]">
        {count} {count === 1 ? 'file' : 'files'}. Images become image cards, everything else file cards. Up to 10 MB each.
      </div>
    </div>
  )
}
