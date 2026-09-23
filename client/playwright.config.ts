import { defineConfig } from '@playwright/test'
// Mesma porta que o vite desta árvore (client/porta.js): 1420 na principal,
// própria em cada worktree. Dois portões em paralelo na 1420 testavam o app da
// outra árvore com `reuseExistingServer`.
import { portaDoProjeto } from './porta.js'
const PORTA = portaDoProjeto()
const URL_BASE = `http://localhost:${PORTA}`

// Onde a prova de uma corrida SEM o portão é escrita.
//
// 20/09/2026: o conserto de `outputDir` só valia para quem rodava pelo portão.
// Quem roda o comando declarado de uma jornada na mão (`npx playwright test
// e2e/task-jornada-x.spec.ts`, que é como as jornadas desta noite foram
// declaradas) cai no `else` — e ali estava `./test-results`, DENTRO do
// repositório, apagado inteiro no começo da invocação seguinte. Duas jornadas
// rodadas em sequência: a prova da primeira some ao começar a segunda, que é
// exatamente o bug que o portão diz ter consertado.
//
// Uma pasta por invocação, sempre em %TEMP%, com o mesmo formato `<id>-<ms>`
// que `limparArtefatosAntigos` (scripts/portao.cjs) sabe podar — a evidência
// não se acumula para sempre, e nada do repositório nem do usuário é tocado.
//
// A pasta sai do AMBIENTE e não de `node:os`: `client/tsconfig.e2e.json` não
// carrega os tipos do Node (medido — `error TS2307: Cannot find module
// 'node:os'`), e o passo `tipos-e2e` do portão é justamente quem confere este
// arquivo. `process.env` já era usado aqui embaixo e continua sendo a única
// coisa que este config lê do sistema.
const TEMP = process.env.TEMP || process.env.TMP || process.env.TMPDIR || '/tmp'
const ARTEFATOS_AVULSOS = `${TEMP.replace(/[\\/]+$/, '')}/portao-labirinto/artefatos/avulso-${Date.now()}`

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
  // Sem o portão, cai em `ARTEFATOS_AVULSOS` (uma pasta por invocação, também
  // em %TEMP%): `./test-results` era compartilhado por TODA invocação e por
  // isso destruía a prova da corrida anterior — ver o comentário lá em cima.
  outputDir: process.env.PORTAO_ARTEFATOS || ARTEFATOS_AVULSOS,
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
    // Só o tempo de SUBIR o vite (não o de teste, que segue em 30 s lá em
    // cima). Medido em 23/09/2026 com 8+ árvores rodando o portão: vite com
    // `cacheDir` frio (porta nova = cache novo, ver vite.config.ts) passou de
    // 30 s para otimizar dependências, e três jornadas saíram vermelhas com
    // "Timed out waiting 30000ms from config.webServer" sem rodar teste algum.
    timeout: 120_000,
  },
})
