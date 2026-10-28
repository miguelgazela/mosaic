import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { AuthShell } from '../ui/AuthShell'
import { Button, TextField } from '../ui'
import { useAuth } from './AuthProvider'

const RESEND_SECONDS = 60

export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  if (!loading && session) return <Navigate to="/" replace />

  const onPassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) setError(err.message)
  }

  const sendLink = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (err) { setError(err.message); return }
    setSentTo(email)
    setWait(RESEND_SECONDS)
  }

  if (sentTo) {
    return (
      <AuthShell width={380}>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
            <Mail size={22} />
          </span>
          <h1 className="mt-4 text-[length:var(--text-h2)] font-semibold leading-[var(--leading-h2)]">Check your email</h1>
          <p className="mt-3 text-[length:var(--text-body)] text-[var(--text-secondary)]">
            We sent a sign-in link to <b className="font-bold text-[var(--text)]">{sentTo}</b>. It works once and expires in 1 hour.
          </p>
          <div className="mt-5 flex gap-2">
            <Button disabled={busy || wait > 0} onClick={sendLink}>Resend link</Button>
            <Button variant="ghost" onClick={() => setSentTo(null)}>Use a different email</Button>
          </div>
          {wait > 0 && <p className="mt-3 text-[length:var(--text-sm)] text-[var(--text-secondary)]">You can resend in {wait} s.</p>}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell footer="Access is by invitation. Ask the board owner to add your email.">
      <h1 className="text-[length:var(--text-h2)] font-semibold leading-[var(--leading-h2)]">Sign in</h1>
      {!supabaseConfigured && (
        <p className="mt-2 text-[length:var(--text-sm)] text-[var(--danger)]">Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.</p>
      )}
      <form onSubmit={onPassword} className="mt-5 flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="!h-11"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          className="!h-11"
        />
        <Button variant="primary" type="submit" block className="h-11" disabled={busy || !password}>Sign in</Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-[length:var(--text-sm)] text-[var(--text-secondary)]">
        <span className="h-px flex-1 bg-[var(--divider)]" />or<span className="h-px flex-1 bg-[var(--divider)]" />
      </div>
      <Button block className="h-11" disabled={busy || !email} onClick={sendLink}>
        <Mail size={16} /> Email me a magic link
      </Button>
    </AuthShell>
  )
}
