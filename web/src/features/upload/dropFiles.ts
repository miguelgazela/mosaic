import { listCards } from '../../cards/registry'
import type { Point } from '../../canvas/geometry'

/** Hand files to every card type that takes them (images, files). Each filters for what it owns. */
export function dropFiles(files: File[], at: Point): void {
  if (!files.length) return
  for (const def of listCards()) def.onDropFiles?.(files, at)
}

/** Open the system file picker and drop the chosen files at the centre of the view. */
export function pickFiles(at: () => Point): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.onchange = () => dropFiles([...(input.files ?? [])], at())
  input.click()
}
