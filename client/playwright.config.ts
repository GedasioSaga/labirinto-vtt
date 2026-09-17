import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  // PROVA QUE NÃO SE APAGA. O Playwright LIMPA o `outputDir` inteiro no começo
  // de cada invocação — screenshot de falha, trace e error-context da rodada
  // anterior somem antes de alguém olhar. Rodar as jornadas uma a uma, como o
  // portão faz, significava apagar a evidência de cada uma ao começar a
  // seguinte. Com `PORTAO_ARTEFATOS` cada passo escreve numa pasta própria
  // (scripts/portao.cjs passa `<temp>/portao-labirinto/artefatos/<passo>-<ms>`),
  // sempre em pasta temporária — nada do repositório nem do usuário é tocado.
  outputDir: process.env.PORTAO_ARTEFATOS || './test-results',
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
    // ATENÇÃO — servidor reaproveitado é servidor com história. A cada HMR o
    // vite passa a servir o módulo carimbado (`mapStore.ts?t=<ms>`), e a página
    // acaba carregando as DUAS versões: a do app (carimbada) e a que um
    // `page.evaluate(import('/src/stores/mapStore.ts'))` de spec pede (sem
    // carimbo). São duas stores zustand. Medido em 17/09/2026: o botão Sala
    // ficava com `aria-pressed="true"` e o canvas desenhava, mas
    // `task-room-tool.spec.ts:85` lia `regions: []` — vermelho falso. No
    // sentido oposto, um spec que escreve E lê pela store do evaluate não toca
    // o app nenhuma vez: verde falso. `node scripts/portao.cjs --so=servidor-limpo`
    // detecta, e reiniciar o `npm run dev` resolve. Para o portão pegar um
    // servidor recém-nascido, rode com PORTAO_SERVIDOR_LIMPO=1 (exige a 1420 livre).
    reuseExistingServer: process.env.PORTAO_SERVIDOR_LIMPO !== '1',
    timeout: 30_000,
  },
})
