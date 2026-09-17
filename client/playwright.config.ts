import { defineConfig } from '@playwright/test'
// Mesma porta que o vite desta árvore (client/porta.js): 1420 na principal,
// própria em cada worktree. Dois portões em paralelo na 1420 testavam o app da
// outra árvore com `reuseExistingServer`.
import { portaDoProjeto } from './porta.js'
const PORTA = portaDoProjeto()
const URL_BASE = `http://localhost:${PORTA}`

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
    baseURL: URL_BASE,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: URL_BASE,
    // ATENÇÃO — servidor reaproveitado é servidor com história. A cada HMR o
    // vite passa a servir o módulo carimbado (`mapStore.ts?t=<ms>`), e a página
    // acaba carregando as DUAS versões: a do app (carimbada) e a que um
    // `page.evaluate(import('/src/stores/mapStore.ts'))` de spec pede (sem
    // carimbo). São duas stores zustand. Medido em 17/09/2026: o botão Sala
    // ficava com `aria-pressed="true"` e o canvas desenhava, mas
    // `task-room-tool.spec.ts:85` lia `regions: []` — vermelho falso. No
    // sentido oposto, um spec que escreve E lê pela store do evaluate não toca
    // o app nenhuma vez: verde falso. `node scripts/portao.cjs --so=servidor-limpo`
    // detecta, e reiniciar o `npm run dev` resolve.
    //
    // 17/09/2026: o padrão virou servidor NOVO a cada invocação. Reaproveitar
    // custou duas vezes no mesmo dia — um vite órfão de antes de um commit
    // servindo código velho (as jornadas passavam sobre o app errado) e outro
    // órfão preso só em `::1`, que fazia o Playwright abortar com "Port 1420 is
    // already in use" e ZERO teste rodado. Subir o servidor custa poucos
    // segundos; testar o app errado custa uma rodada inteira de gauntlet.
    // `LAB_REUSA_SERVIDOR=1` volta ao reaproveitamento, quando alguém quiser a
    // suíte mais rápida sabendo do risco.
    reuseExistingServer: process.env.LAB_REUSA_SERVIDOR === '1',
    timeout: 30_000,
  },
})
