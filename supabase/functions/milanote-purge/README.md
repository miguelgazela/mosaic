# milanote-purge

Daily clean-up, called by a schedule (never by the web app). `POST` with header `x-cron-secret: <PURGE_CRON_SECRET>`.

1. Hard-deletes cards and lines soft-deleted more than 30 days ago, then boards trashed more than 30 days ago
   (their cards, lines and sub-boards go through the foreign keys: all trashed together, so all older than the cutoff).
2. Removes objects from bucket `milanote-files` that no card refers to (`content.path`, `thumbPath`, `previewPath` of image
   and file cards, trashed cards included). Duplicated boards share objects, so an object stays while any card uses it.
   Objects younger than 24 h stay (their card may still sit in a browser's write queue).

Answer: `{ elements, connections, boards, removedObjects, dryRun }`. `?dry=1` removes nothing and reports the orphan count only.
Errors: 401 wrong or missing secret, 405, 500 `failed` (a read error stops the run before any object is removed).

```bash
deno test --allow-net=none supabase/functions/milanote-purge/purge_test.ts
```

## Deploy (once)

```bash
SECRET=$(openssl rand -hex 32); echo "$SECRET"   # keep it: the schedule below needs it
supabase secrets set PURGE_CRON_SECRET="$SECRET" --project-ref varnswkomuckwgobplld
supabase functions deploy milanote-purge --no-verify-jwt --project-ref varnswkomuckwgobplld
# check without deleting anything:
curl -s -X POST 'https://varnswkomuckwgobplld.supabase.co/functions/v1/milanote-purge?dry=1' -H "x-cron-secret: $SECRET"
```

`--no-verify-jwt` because the caller is the database scheduler, not a signed-in user; the secret is the guard.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase. The service role key never leaves the function.

## Schedule (once, SQL Editor)

Needs the `pg_cron` and `pg_net` extensions (Database → Extensions). The job lives in the `cron` schema, which is shared by all apps in this project.

```sql
select cron.schedule('milanote-purge', '17 3 * * *', $$
  select net.http_post(
    url := 'https://varnswkomuckwgobplld.supabase.co/functions/v1/milanote-purge',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<SECRET>'),
    body := '{}'::jsonb
  );
$$);
-- remove it later: select cron.unschedule('milanote-purge');
```
