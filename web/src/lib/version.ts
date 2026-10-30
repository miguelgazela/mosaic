/** Which build is running: short commit and build time, set by `vite.config.ts`. */
export const buildCommit = __BUILD_COMMIT__

/** e.g. "a390186 · 30 Oct, 14:05" (time in the viewer's zone). */
export function versionLabel(commit = __BUILD_COMMIT__, iso = __BUILD_TIME__, locale?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return commit
  const when = d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  return `${commit} · ${when}`
}
