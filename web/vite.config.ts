import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['..'] } },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
})
