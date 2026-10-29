import { create } from 'zustand'

export interface ExportJob {
  /** "PNG", "PDF", "Markdown zip". */
  label: string
  /** 0–1; null = unknown (spinner-ish bar). */
  ratio: number | null
  detail: string
  abort: AbortController
}

export const useExportJob = create<{ job: ExportJob | null }>()(() => ({ job: null }))
