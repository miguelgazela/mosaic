export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center bg-[var(--text)]"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="9" height="9" rx="2" fill="#fff" />
        <rect x="7" y="7" width="8" height="8" rx="2" fill="var(--text)" stroke="#fff" strokeWidth="1.5" />
      </svg>
    </span>
  )
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={36} />
      <span className="text-[length:var(--text-h3)] font-bold">Mosaic</span>
    </div>
  )
}
