# milanote-unfurl

`POST { url }` with a member JWT → `{ title?, description?, image?, favicon?, embed?, duration? }`.
Errors: 400 `bad_url`/`blocked`, 401, 403 (not a member), 502 `upstream`, 504 `timeout`.

Guards: http(s) only, no credentials in URL, no `localhost`/`.local`/`.internal`, every resolved IP must be public
(10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10, ::1, fc00::/7, fe80::/10, mapped v4 …), checked again on every
redirect (max 5). 5 s total timeout, 1 MB body cap. YouTube/Vimeo use oEmbed, then page meta fills gaps.

```bash
deno test --allow-net=127.0.0.1 supabase/functions/milanote-unfurl/ssrf_test.ts supabase/functions/milanote-unfurl/parse_test.ts
supabase functions deploy milanote-unfurl --project-ref varnswkomuckwgobplld
```

No extra secrets: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by Supabase. Keep JWT verification on (default).
DNS rebinding: the guard resolves the name once, checks every address, then connects to that validated IP itself (`pinned.ts`, a small HTTP/1.1 GET client over `Deno.connect`/`startTls`; TLS still checks the certificate against the hostname). `fetch` is not used, so there is no second lookup. Each redirect hop is resolved, checked and pinned the same way. Only GET, no compression, no keep-alive.
If `deno test` needs it, run with `--allow-net` (the pinned-IP test starts a server on 127.0.0.1).
