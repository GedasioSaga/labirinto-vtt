import { defineConfig } from '@playwright/test'

/**
 * Harness de recriação dos mapas de `Objetivo/` usando o chão por peças.
 * Separado do `playwright.config.ts` de propósito: não entra no gate normal
 * nem muda a contagem de testes e2e. Uso: `npx playwright test -c playwright.recreate.config.ts`.
 */
export default defineConfig({
  testDir: './recreate',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:1422',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx vite --config vite.recreate.config.ts',
    url: 'http://localhost:1422',
    // Servidor novo a cada rodada: sem watch, só assim ele enxerga o código atual.
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
