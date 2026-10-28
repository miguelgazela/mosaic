export interface CanvasElement {
  id: string
  /** Card type key; looked up in cards/registry.ts. */
  type: string
  x: number
  y: number
  width: number
  /** null = auto-height (measured from the DOM). */
  height: number | null
  /** Fractional index, canvas stacking. */
  z: string
  /** Palette key '1'..'10' or null. */
  color: string | null
  content: Record<string, unknown>
}
