import { useExportJob } from './store'

/** "Exporting …" panel (00-menus): title, Cancel, progress bar, detail line. Bottom-centre above the toasts. */
export function ExportProgress() {
  const job = useExportJob((s) => s.job)
  if (!job) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[4000001] flex justify-center">
      <div
        data-testid="export-progress"
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-[240px] rounded-[var(--radius-menu)] border border-[var(--border)] bg-[var(--card-bg)] p-3.5"
        style={{ boxShadow: 'var(--shadow-menu)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--text-card)] font-semibold text-[var(--text)]">Exporting {job.label}…</span>
          <button className="text-[length:var(--text-card)] font-medium text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => job.abort.abort()}>
            Cancel
          </button>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--fill-hover)]">
          <div
            className={`h-full rounded-full bg-[var(--primary)] transition-[width] ${job.ratio === null ? 'w-1/3 animate-pulse' : ''}`}
            style={job.ratio === null ? undefined : { width: `${Math.round(job.ratio * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-[length:var(--text-meta,12px)] text-[var(--text-muted)]">{job.detail}</div>
      </div>
    </div>
  )
}
