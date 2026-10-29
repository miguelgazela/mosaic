/** The Mosaic app icon (design/brand). Transparent rounded corners are in the PNG. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return <img src="/mosaic-icon-512.png" alt="" aria-hidden width={size} height={size} draggable={false} className="block shrink-0" style={{ width: size, height: size }} />
}

/** Lockup: icon + "Mosaic" 18 px bold, 10 px gap. */
export function Wordmark({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-[10px]">
      <LogoMark size={size} />
      <span className="text-[18px] font-bold leading-none">Mosaic</span>
    </div>
  )
}
