import type { PasteData } from '../cards/types'

const URL_RE = /^https?:\/\/[^\s]+$/i

/** Build the data handed to cards' `onPaste` hooks. `url` is set only for a single http(s) URL. */
export function toPasteData(text: string | null | undefined, files: File[] = []): PasteData {
  const t = text?.trim()
  return {
    ...(text ? { text } : {}),
    ...(t && URL_RE.test(t) ? { url: t } : {}),
    ...(files.length ? { files } : {}),
  }
}
