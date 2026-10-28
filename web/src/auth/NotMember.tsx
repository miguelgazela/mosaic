import { Lock } from 'lucide-react'
import { AuthShell } from '../ui/AuthShell'
import { Button } from '../ui'
import { useAuth } from './AuthProvider'

export function NotMember() {
  const { session, signOut } = useAuth()
  return (
    <AuthShell width={420}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--chrome-bg)] text-[var(--text)]">
        <Lock size={18} />
      </span>
      <h1 className="mt-4 text-[length:var(--text-h2)] font-semibold leading-[var(--leading-h2)]">This account doesn’t have access yet</h1>
      <p className="mt-3 text-[length:var(--text-body)] text-[var(--text-secondary)]">
        You’re signed in as <b className="font-bold text-[var(--text)]">{session?.user.email}</b>, but that email isn’t on the member list.
        Ask the owner to add it, then sign in again.
      </p>
      <Button variant="primary" className="mt-5" onClick={signOut}>Sign out</Button>
    </AuthShell>
  )
}
