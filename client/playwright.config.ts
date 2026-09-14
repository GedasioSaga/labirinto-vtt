import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  // Todos os workers batem no MESMO vite dev (módulos sem bundle) e cada um
  // sobe um Pixi/WebGL. No padrão (metade dos núcleos, 10 aqui) a máquina
  // satura e testes aleatórios estouram os 30s em goto/beforeEach — medido
  // igual com o PixiCanvas de HEAD, então não é regressão de código. Com 4 a
  // suíte fecha verde no mesmo 1,5-1,7 min.
  workers: 4,
  use: {
    baseURL: 'http://localhost:1420',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
