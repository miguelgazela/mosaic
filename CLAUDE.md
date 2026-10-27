# Milanote Clone

Web clone of Milanote. Read before working:
- `REQUIREMENTS.md` — what to build (FR numbers).
- `ARCHITECTURE.md` — stack, canvas engine, sync, edge functions.
- `DATA_MODEL.md` — schema `milanote`, RLS, RPCs.
- `ROADMAP.md` — phases. Do only the phase you were given; note anything out of scope as a follow-up.

## Supabase (shared project — be careful)

- Project `nsatnbeayrfaynqjouef` is shared with KangarooSplit and another app.
- Only touch schema `milanote`, bucket `milanote-files`, functions `milanote-*`. Never alter `public`, other schemas, auth settings, or other apps' functions/buckets.
- Migrations: `supabase/migrations/NNNN_name.sql`, numbered, wrapped in `begin; … commit;`, idempotent where cheap. Applied by hand in the SQL Editor — never assume it ran; tell the user what to run.
- Update `DATA_MODEL.md` in the same change as any schema change.
- No service role key in `web/`.

## Code rules

- Card types live in `web/src/cards/<type>/` and register in `cards/registry.ts`. Engine code (`web/src/canvas/`) must not import a specific card type.
- Every canvas mutation goes through a command so undo works.
- Hot-path components subscribe to the smallest store slice possible.
- Pure logic (geometry, ordering, transforms) gets Vitest tests. User flows get a Playwright test.
- Before finishing: `npm run lint && npm test && npm run build` in `web/`.

## UI

- Follow `design/README.md` and `design/tokens.css`. No new colours/sizes without reason.
- UI text: English.
