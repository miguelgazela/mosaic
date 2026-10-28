import { defineConfig } from '@playwright/test'

// Parallel worktrees can each run e2e: set E2E_PORT so a session never talks to another session's dev server.
const port = Number(process.env.E2E_PORT ?? 5173)

export default defineConfig({
  testDir: 'e2e',
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: true },
  use: { baseURL: `http://localhost:${port}` },
})
