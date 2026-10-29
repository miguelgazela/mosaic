import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy } from 'lucide-react'
import { Button, Dialog, Toggle, toast } from '../../ui'
import { getShareRepo, linkMeta, shareUrl, sharesKey, subBoardHint, useShares, useSubBoards, type ShareLink } from './shareApi'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Shown address: host + /s/ + the start of the token (the whole link is what gets copied). */
const shortUrl = (token: string) => `${window.location.host}/s/${token.slice(0, 10)}…`

export function ShareDialog({ boardId, title, onClose }: { boardId: string; title: string; onClose: () => void }) {
  const qc = useQueryClient()
  const shares = useShares(boardId)
  const subs = useSubBoards(boardId)
  const [include, setInclude] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<ShareLink | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  // The confirm dialog sits on top: Escape and backdrop clicks must only close that one.
  const confirming = useRef(false)
  confirming.current = revoking !== null
  const close = useCallback(() => { if (!confirming.current) onClose() }, [onClose])

  const cancelRevoke = useCallback(() => setRevoking(null), [])

  const copy = async (l: ShareLink) => {
    if (!(await copyText(shareUrl(l.token)))) {
      toast('Couldn’t copy. Select the address and copy it by hand.', { tone: 'error' })
      return
    }
    setCopied(l.id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2500)
  }

  const create = useMutation({
    mutationFn: () => getShareRepo().create(boardId, include),
    onSuccess: (l) => {
      void qc.invalidateQueries({ queryKey: sharesKey(boardId) })
      void copy(l)
    },
    onError: () => toast('Couldn’t create the link', { tone: 'error' }),
  })

  const revoke = useMutation({
    mutationFn: (l: ShareLink) => getShareRepo().revoke(l.id),
    onSuccess: () => {
      setRevoking(null)
      void qc.invalidateQueries({ queryKey: sharesKey(boardId) })
      toast('Link revoked')
    },
    onError: () => toast('Couldn’t revoke the link', { tone: 'error' }),
  })

  const links = shares.data ?? []
  const hint = subs.data && subs.data.length > 0 ? subBoardHint(subs.data) : null

  return (
    <>
      <Dialog title={`Share “${title || 'Untitled board'}”`} onClose={close} width={520}>
        <p className="mb-4 text-[length:var(--text-body)] text-[var(--text-secondary)]">
          Anyone with a link can view this board. They can’t edit it or see your other boards.
        </p>
        <div className="flex items-center gap-4 rounded-[var(--radius-menu)] bg-[var(--chrome-bg)] p-4">
          <div className="min-w-0 flex-1">
            <Toggle
              checked={include}
              onChange={setInclude}
              label={
                <span className="block">
                  <span className="block text-[length:var(--text-card)] font-medium">Include sub-boards</span>
                  {hint && <span className="block text-[length:var(--text-caption)] font-normal leading-[var(--leading-caption)] text-[var(--text-secondary)]">{hint}</span>}
                </span>
              }
            />
          </div>
          <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>Create link</Button>
        </div>

        {shares.isError ? (
          <div className="mt-4 rounded-[var(--radius-menu)] border border-dashed border-[var(--border-strong)] p-5 text-center text-[var(--text-secondary)]">
            Couldn’t load the links. <button className="font-semibold text-[var(--primary)] underline" onClick={() => void shares.refetch()}>Try again</button>
          </div>
        ) : shares.isSuccess && links.length === 0 ? (
          <div data-testid="share-empty" className="mt-4 rounded-[var(--radius-menu)] border border-dashed border-[var(--border-strong)] px-6 py-5 text-center text-[var(--text-secondary)]">
            No links yet. Create one so people can view this board without signing in.
          </div>
        ) : links.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-[length:var(--text-sm)] font-semibold text-[var(--text-secondary)]">Active links</h3>
            <ul className="flex flex-col gap-2">
              {links.map((l) => {
                const done = copied === l.id
                return (
                  <li
                    key={l.id}
                    data-testid="share-link"
                    className={`flex items-center gap-2 rounded-[var(--radius-menu)] border px-3 py-2 ${done ? 'border-[var(--primary)] bg-[var(--primary-soft)]/40' : 'border-[var(--border)]'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[length:var(--text-card)] font-medium" title={shareUrl(l.token)}>{shortUrl(l.token)}</div>
                      <div className="text-[length:var(--text-caption)] text-[var(--text-secondary)]">{linkMeta(l)}</div>
                    </div>
                    {done ? (
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-ui)] bg-[var(--success-soft)] px-3 text-[length:var(--text-card)] font-semibold text-[var(--success)]" role="status">
                        <Check size={14} /> Copied
                      </span>
                    ) : (
                      <Button className="!h-8 !px-3" aria-label={`Copy link created ${linkMeta(l)}`} onClick={() => void copy(l)}><Copy size={14} /> Copy</Button>
                    )}
                    <Button variant="ghost" className="!h-8 !px-3 !text-[var(--danger)]" onClick={() => setRevoking(l)}>Revoke</Button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Dialog>

      {revoking && (
        <Dialog
          title="Revoke this link?"
          onClose={cancelRevoke}
          width={420}
          footer={
            <>
              <Button autoFocus onClick={cancelRevoke}>Cancel</Button>
              <Button variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(revoking)}>Revoke link</Button>
            </>
          }
        >
          <p className="text-[var(--text-secondary)]">
            Anyone using it will see “This link doesn’t work any more”. Your other links keep working.
          </p>
        </Dialog>
      )}
    </>
  )
}
