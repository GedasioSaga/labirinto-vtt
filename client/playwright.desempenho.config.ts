// Config do HARNESS DE DESEMPENHO (`client/desempenho/`). Quem chama é
// `scripts/medir-desempenho.cjs`, que faz o build e diz aqui onde ele ficou.
//
// - `LAB_DES_MODO=prod` (padrão): serve o build de produção já feito
//   (`LAB_DES_DIST`) com `vite preview`. O build é feito com `VITE_LAB_SONDA=1`
//   (ver `src/lib/sondaDeDesempenho.ts`): sem a sonda o spec não acha a store
//   nem o Pixi.
// - `LAB_DES_MODO=dev`: o vite de desenvolvimento (perfil com nomes legíveis).
//
// Um worker só e nada de retry: é medida, não portão. Mesma escolha de GPU do
// `playwright.config.ts` (ANGLE em D3D11 na placa de alto desempenho).
import { defineConfig } from '@playwright/test'
import { portaDoProjeto } from './porta.js'

const PORTA = portaDoProjeto()
const MODO = process.env.LAB_DES_MODO === 'dev' ? 'dev' : 'prod'
const DIST = process.env.LAB_DES_DIST ?? ''
const TEMP = process.env.TEMP || process.env.TMP || process.env.TMPDIR || '/tmp'

// `LAB_GPU=baixa`: a placa integrada (a WebView2 do app pode cair nela; o Chromium do teste vai na de alto desempenho).
const ARGS = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', process.env.LAB_GPU === 'baixa' ? '--force-low-power-gpu' : '--force-high-performance-gpu']
/** `LAB_NAVEGADOR`: caminho de um chrome.exe, `msedge`, ou vazio (o Chromium do Playwright). */
const NAVEGADOR = process.env.LAB_NAVEGADOR ?? ''
const EXECUTAVEL = NAVEGADOR === '' || NAVEGADOR === 'msedge' ? '' : NAVEGADOR

if (MODO === 'prod' && DIST === '') throw new Error('LAB_DES_DIST vazio: rode pelo scripts/medir-desempenho.cjs (ele faz o build)')

export default defineConfig({
  testDir: './desempenho',
  testMatch: /.*\.spec\.ts$/,
  timeout: 900_000,
  retries: 0,
  workers: 1,
  outputDir: `${TEMP.replace(/[\\/]+$/, '')}/labirinto-desempenho/artefatos-${Date.now()}`,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: 'off',
    // `LAB_DES_JANELA=1`: navegador com janela de verdade (o headless pode esconder custo de GPU e de composição).
    headless: process.env.LAB_DES_JANELA !== '1',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    launchOptions: { args: ARGS, ...(EXECUTAVEL === '' ? {} : { executablePath: EXECUTAVEL }) },
    ...(NAVEGADOR === '' ? { channel: 'chromium' } : NAVEGADOR === 'msedge' ? { channel: 'msedge' } : {}),
  },
  webServer: {
    command: MODO === 'dev' ? 'npx vite' : `npx vite preview --outDir "${DIST}" --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
