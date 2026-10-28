# milanote-unfurl

`POST { url }` with a member JWT → `{ title?, description?, image?, favicon?, embed?, duration? }`.
Errors: 400 `bad_url`/`blocked`, 401, 403 (not a member), 502 `upstream`, 504 `timeout`.

Guards: http(s) only, no credentials in URL, no `localhost`/`.local`/`.internal`, every resolved IP must be public
(10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10, ::1, fc00::/7, fe80::/10, mapped v4 …), checked again on every
redirect (max 5). 5 s total timeout, 1 MB body cap. YouTube/Vimeo use oEmbed, then page meta fills gaps.

```bash
deno test --allow-net=none supabase/functions/milanote-unfurl/ssrf_test.ts supabase/functions/milanote-unfurl/parse_test.ts
supabase functions deploy milanote-unfurl --project-ref varnswkomuckwgobplld
```

No extra secrets: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by Supabase. Keep JWT verification on (default).
Known gap: DNS is resolved by the guard and again by `fetch`, so a rebinding server could answer differently the second time.
