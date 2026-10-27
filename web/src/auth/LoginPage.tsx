import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, ok?: string) => {
    setBusy(true)
    setMessage(null)
    const { error } = await fn()
    setBusy(false)
    setMessage(error ? error.message : (ok ?? null))
  }

  const onPassword = (e: FormEvent) => {
    e.preventDefault()
    void run(() => supabase.auth.signInWithPassword({ email, password }))
  }

  const onMagic = () =>
    run(
      () => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }),
      'Check your email for the sign-in link.',
    )

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {!supabaseConfigured && (
        <p className="mt-2 text-sm text-red-600">Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.</p>
      )}
      <form onSubmit={onPassword} className="mt-4 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        />
        <button disabled={busy || !password} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-50">
          Sign in
        </button>
        <button type="button" disabled={busy || !email} onClick={onMagic} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">
          Email me a magic link
        </button>
      </form>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  )
}
