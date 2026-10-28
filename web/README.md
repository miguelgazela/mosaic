# Mosaic — web

```bash
cp .env.example .env   # add VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Checks: `npm run lint && npm test && npm run build`. E2E: `npx playwright install chromium && npm run e2e`.

## One-time Supabase setup (manual)
1. SQL Editor → run `supabase/migrations/0001_init.sql`.
2. Settings → API → Exposed schemas → add `milanote` (keep existing ones).
3. `insert into milanote.members (user_id, display_name) values ('<your auth uid>', 'Miguel');`
4. Auth → URL config: add the dev/prod URLs as redirect URLs (magic link).
