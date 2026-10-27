import { useAuth } from './AuthProvider'

export function NotMember() {
  const { session, signOut } = useAuth()
  return (
    <main className="mx-auto mt-24 max-w-sm p-6 text-center">
      <h1 className="text-xl font-semibold">Not a member</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {session?.user.email} is not on the allow-list for this app.
      </p>
      <button className="mt-4 rounded-md border px-3 py-1.5 text-sm" onClick={signOut}>
        Sign out
      </button>
    </main>
  )
}
