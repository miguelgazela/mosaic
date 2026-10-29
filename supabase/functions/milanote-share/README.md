# milanote-share

Public, read-only view of a shared board (`/s/:token`). The visitor has no session; the token is the credential.

`POST` JSON `{ "token": "<48 hex chars>", "boardId"?: "<uuid>" }` (no `boardId` = the shared board itself).

Answers `200 { status: 'ok', ownerName, includeSubboards, root, board, path, elements, connections, children, urls }`:
- `path` runs from the shared board down to the board shown; `children` has title, icon, colour and item count for the board cards on this board (empty when the link is "this board only"); `urls` maps storage paths of image/file cards to signed URLs (1 h).
- Only live (not trashed) cards and lines. No owner id, no e-mail, no client ids, no search text.
- Files: only objects under the owner's own folder (`{owner_id}/…`) are signed.

`404 { status: 'not_found' }` for everything that should look the same to a visitor: unknown or revoked token, trashed board, a board outside the shared tree, a sub-board on a "this board only" link. `400` malformed board id, `500 { status: 'error' }`.

```bash
deno test --allow-net=none supabase/functions/milanote-share/share_test.ts
```

## Deploy (once, not done yet)

1. Run `supabase/migrations/0009_share_grants.sql` in the SQL Editor (gives the service role `select` on `milanote.shares`; `0007` already covered boards, elements, connections).
2. ```bash
   supabase functions deploy milanote-share --no-verify-jwt --project-ref varnswkomuckwgobplld
   ```
   `--no-verify-jwt`: visitors are signed out. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase; the key never leaves the function.
3. Check (use a real token from the share dialog):
   ```bash
   curl -s -X POST 'https://varnswkomuckwgobplld.supabase.co/functions/v1/milanote-share' \
     -H 'content-type: application/json' -d '{"token":"<TOKEN>"}' | head -c 400
   ```
   A revoked or made-up token must answer `{"status":"not_found"}`.
