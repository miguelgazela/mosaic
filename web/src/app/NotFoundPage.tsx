import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { LogoMark } from '../ui'

export function NotFoundIllustration() {
  return (
    <div className="relative h-[100px] w-[150px]" aria-hidden>
      <div className="absolute left-0 top-[18px] h-[70px] w-[100px] -rotate-6 rounded-[var(--radius-card)] border border-dashed border-[var(--icon-subtle)]" />
      <div className="absolute left-[40px] top-0 flex h-[66px] w-[96px] rotate-3 items-center justify-center rounded-[var(--radius-card)] bg-white text-[var(--icon-subtle)]" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
        <Search size={20} />
      </div>
    </div>
  )
}

const btn = 'inline-flex h-10 items-center rounded-[var(--radius-ui)] px-4 text-[length:var(--text-card)] font-semibold'

/** 404 / no access. Also rendered for unknown routes. */
export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4" style={{ height: 'var(--topbar-h)' }}>
        <Link to="/" aria-label="Home"><LogoMark /></Link>
      </header>
      <main className="dotted flex flex-1 flex-col items-center justify-center px-4 text-center">
        <NotFoundIllustration />
        <h1 className="mt-6 text-[length:var(--text-h2)] font-semibold leading-[var(--leading-h2)]">We can’t find this board</h1>
        <p className="mt-2 max-w-[440px] text-[length:var(--text-body)] text-[var(--text-secondary)]">
          It may have been moved to Trash, or the link points to a board you don’t have access to.
        </p>
        <div className="mt-6 flex gap-2">
          <Link to="/" className={`${btn} bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]`}>Go to Home</Link>
          <Link to="/trash" className={`${btn} border border-[var(--border)] bg-white hover:bg-[var(--fill-hover)]`}>Open Trash</Link>
        </div>
      </main>
    </div>
  )
}
