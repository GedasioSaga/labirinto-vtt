// Jornada de usuário escrita ANTES do conserto (passeio cego de 17/09/2026).
//
// DOR: com a ferramenta "Peça" ativa, o clique no mapa não cria nada, a tela
// não diz uma palavra e o botão "Peça" continua marcado como ativo — a pessoa
// acha que errou o alvo e insiste. Arrastar depois também não faz nada.
//
// CAUSA (confirmada, não re-descoberta aqui):
//   - PixiCanvas.tsx:2078 — `void (async () => { ... })()` SEM try/catch dentro
//     do bloco `if (activeTool === 'prop')`. Qualquer rejeição vira unhandled
//     rejection calada: sem UI de erro e sem resetar a ferramenta.
//   - lib/imageImport.ts:11 — `pickImageFile` usa o diálogo do Tauri, que lê
//     `window.__TAURI_INTERNALS__`. Fora da janela do Tauri (navegador) esse
//     global não existe: "Cannot read properties of undefined (reading 'invoke')".
//   - O guarda certo já existe no projeto: `isTauri()` de `@tauri-apps/api/core`
//     (App.tsx:380 e :549). O bloco da Peça não usa.
//
// CONTRATO QUE ESTA JORNADA FIXA (tudo pela TELA — asserção em `mapStore` é
// proibida aqui, contagem de store reflete a entrada, não o que a pessoa vê):
//   1. clique que não consegue criar a peça DIZ isso na tela, em até
//      LIMIAR_AVISO_MS — texto novo, visível, com a razão da falha;
//   2. depois da falha a pessoa NÃO fica presa. Dos dois caminhos aceitáveis
//      (voltar para Selecionar, ou oferecer um caminho visível) esta jornada
//      afirma O PRIMEIRO: a marcação de ativo sai de "Peça" e volta para
//      "Selecionar" — `aria-pressed` é a marcação que a pessoa enxerga no botão;
//   3. nenhuma unhandled promise rejection escapa nesse gesto.
//
// O CONTROLE POSITIVO é um teste separado e tem de passar HOJE: prova que o
// detector de texto novo e o detector de erro de página ENXERGAM quando há algo
// para ver. Sem ele, o vermelho da jornada poderia ser cegueira do teste.
//
// Coordenadas: a câmera nasce em { x: 0, y: 0, scale: 1 }, e o painel lateral
// (~0-280px) mais a barra (~0-70px) ficam POR CIMA do canvas — por isso o gesto
// mora em x >= 340, y >= 120 (mesmo cuidado de task-jornada-ferramentas-mudas).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'

/**
 * SERVIDOR: vem do `playwright.config.ts` (neste worktree de consertos, vite na
 * 1437, com `reuseExistingServer`). Esta spec NÃO sobe e NÃO mata processo
 * nenhum — o dev server é compartilhado com as outras jornadas daqui, e uma
 * spec que derruba o servidor dos vizinhos é pior que a dor que ela mede.
 *
 * Histórico (17/09/2026): a config apontava para a 1430, e quem atendia ali era
 * o dev server de OUTRO projeto (`C:/dev/learno`: `curl
 * http://localhost:1430/src/main.tsx` devolvia `fileName:
 * "C:/dev/learno/src/main.tsx"`). A jornada rodava contra um app que não é este
 * e morria em "Não deu para abrir o banco de dados" — vermelho pelo motivo
 * errado, que é o mesmo que cegueira. Corrigido na raiz, nos configs.
 */

// Disco apertado: nada de trace/vídeo/screenshot nesta spec.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

/** "Em segundos, não para sempre em silêncio": o aviso tem de aparecer dentro disso. */
const LIMIAR_AVISO_MS = 5_000
const PASSO_POLL_MS = 150

/**
 * Vocabulário de FALHA. Deliberadamente largo em forma e estreito em tema: a
 * jornada não trava a redação exata do aviso (isso é escolha de quem conserta),
 * mas exige que o texto novo fale de falha/indisponibilidade, e não seja
 * qualquer número que mudou na tela.
 */
const FALA_DE_FALHA = /n[ãa]o foi poss[íi]vel|n[ãa]o consegu|n[ãa]o deu|falh|erro|indispon[íi]vel|s[óo] funciona|no aplicativo|instalad/i

interface Detectores {
  /** Erros de página + unhandled rejections vistos pelo Playwright. */
  errosDePagina: string[]
  /** Unhandled rejections vistas pela PRÓPRIA página (listener injetado antes do app). */
  rejeicoesDaPagina: () => Promise<string[]>
  /** Zera os dois buffers — chamado logo antes do gesto que está sob julgamento. */
  limpar: () => Promise<void>
}

const CHAVE_REJEICOES = '__jornadaPecaRejeicoes'

/**
 * Instala os dois detectores ANTES do `goto` (o listener de unhandledrejection
 * precisa existir antes do app carregar) e devolve como lê-los.
 */
async function instalarDetectores(page: Page): Promise<Detectores> {
  const errosDePagina: string[] = []
  page.on('pageerror', (erro) => errosDePagina.push(String(erro.message ?? erro)))

  await page.addInitScript((chave: string) => {
    const alvo = window as unknown as Record<string, string[]>
    alvo[chave] = []
    window.addEventListener('unhandledrejection', (evento) => {
      const motivo = evento.reason
      alvo[chave].push(motivo instanceof Error ? motivo.message : String(motivo))
    })
  }, CHAVE_REJEICOES)

  return {
    errosDePagina,
    rejeicoesDaPagina: () =>
      page.evaluate((chave: string) => [...((window as unknown as Record<string, string[]>)[chave] ?? [])], CHAVE_REJEICOES),
    limpar: async () => {
      errosDePagina.length = 0
      await page.evaluate((chave: string) => {
        const lista = (window as unknown as Record<string, string[]>)[chave]
        if (lista) lista.length = 0
      }, CHAVE_REJEICOES)
    },
  }
}

/**
 * Tudo que uma pessoa CONSEGUE LER na tela agora, linha a linha. `innerText`
 * (não `textContent`) de propósito: já respeita `display:none`,
 * `visibility:hidden` e o que está fora de fluxo — é a leitura do olho, não a
 * do DOM. Nenhuma store é consultada.
 */
async function textoNaTela(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document.body.innerText
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0),
  )
}

/** Linhas que apareceram depois da linha de base. */
function textoNovo(base: string[], agora: string[]): string[] {
  const conhecido = new Set(base)
  return agora.filter((linha) => !conhecido.has(linha))
}

/**
 * Espera até LIMIAR_AVISO_MS por uma linha NOVA na tela que fale de falha.
 * Devolve todas as linhas novas vistas na última leitura (vazio ou não), para a
 * mensagem de erro mostrar o que a tela realmente disse.
 */
async function esperarAvisoDeFalha(page: Page, base: string[]): Promise<{ aviso: string | null; novas: string[] }> {
  const limite = Date.now() + LIMIAR_AVISO_MS
  let novas: string[] = []
  for (;;) {
    novas = textoNovo(base, await textoNaTela(page))
    const aviso = novas.find((linha) => FALA_DE_FALHA.test(linha))
    if (aviso) return { aviso, novas }
    if (Date.now() >= limite) return { aviso: null, novas }
    await page.waitForTimeout(PASSO_POLL_MS)
  }
}

async function pontoNoMapa(page: Page, dx: number, dy: number) {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return { x: caixa.x + dx, y: caixa.y + dy }
}

/** Botão da barra pelo nome — `aria-pressed` é a marcação de ativo que a pessoa vê. */
const botaoDaBarra = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true })

test.describe('Ferramenta Peça nunca falha em silêncio', () => {
  test('controle positivo: os detectores enxergam texto novo e erro de página', async ({ page }) => {
    const detectores = await instalarDetectores(page)
    await enterEditor(page)

    // --- Controle do DETECTOR DE TEXTO: um gesto que o app JÁ responde com
    // texto. Trocar de ferramenta troca a dica (Toolbar.tsx:380, role=status).
    await pickTool(page, 'Selecionar')
    const base = await textoNaTela(page)
    await pickTool(page, 'Porta')
    const novasLinhas = await page.waitForFunction(
      (conhecidas: string[]) => {
        const atual = document.body.innerText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        const novas = atual.filter((l) => !conhecidas.includes(l))
        return novas.length > 0 ? novas : null
      },
      base,
      { timeout: LIMIAR_AVISO_MS },
    )
    expect(await novasLinhas.jsonValue(), 'detector de texto cego: a troca de ferramenta mudou a tela e ele não viu').not.toHaveLength(0)

    // --- Controle do DETECTOR DE ERRO: provoca um erro e uma rejeição
    // conhecidos. Isto NÃO é o gesto da jornada e não muda estado do app — é a
    // calibração do instrumento, e por isso vive num teste separado.
    await detectores.limpar()
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('controle-positivo-erro')
      }, 0)
      void Promise.reject(new Error('controle-positivo-rejeicao'))
    })
    await expect
      .poll(() => detectores.errosDePagina.join(' | '), { timeout: LIMIAR_AVISO_MS })
      .toContain('controle-positivo-erro')
    await expect
      .poll(async () => (await detectores.rejeicoesDaPagina()).join(' | '), { timeout: LIMIAR_AVISO_MS })
      .toContain('controle-positivo-rejeicao')
  })

  test('clique com a Peça ativa que não cria nada avisa na tela, solta a ferramenta e não vaza rejeição', async ({ page }) => {
    const detectores = await instalarDetectores(page)
    await enterEditor(page)

    await pickTool(page, 'Peça')
    await expect(botaoDaBarra(page, 'Peça')).toHaveAttribute('aria-pressed', 'true')

    // Linha de base DEPOIS de ativar a Peça: a dica da ferramenta já está na
    // tela, então ela não conta como "texto novo" do clique.
    const base = await textoNaTela(page)
    await detectores.limpar()

    // --- GESTO 1: um clique de verdade no mapa, longe do painel e da barra.
    const alvo = await pontoNoMapa(page, 500, 380)
    await page.mouse.move(alvo.x, alvo.y)
    await page.mouse.down()
    await page.waitForTimeout(80)
    await page.mouse.up()

    // 1. A tela DIZ que não deu, e por quê.
    const { aviso, novas } = await esperarAvisoDeFalha(page, base)
    // As rejeições entram na mensagem de propósito: o vermelho tem de mostrar,
    // na mesma linha, que a tela ficou muda E que o app quebrou por baixo.
    const rejeicoesAteAqui = await detectores.rejeicoesDaPagina()
    expect(
      aviso,
      `Silêncio: ${LIMIAR_AVISO_MS}ms depois do clique com a Peça ativa nenhuma linha nova na tela fala de falha.` +
        ` Linhas novas vistas: ${JSON.stringify(novas)}.` +
        ` Enquanto isso, rejeições engolidas: ${JSON.stringify(rejeicoesAteAqui)};` +
        ` erros de página: ${JSON.stringify(detectores.errosDePagina)}`,
    ).not.toBeNull()

    // 2. A pessoa não fica presa: a marcação de ativo sai da Peça e volta para
    //    Selecionar (caminho escolhido por esta jornada — ver cabeçalho).
    await expect(botaoDaBarra(page, 'Peça'), 'ferramenta Peça continua marcada como ativa depois de falhar').toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(botaoDaBarra(page, 'Selecionar'), 'ferramenta não voltou para Selecionar depois da falha').toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // --- GESTO 2: a dor diz que arrastar depois também não faz nada. Arrasto
    // real, com pausa antes de soltar — só para provar que ele também não vaza.
    const inicio = await pontoNoMapa(page, 620, 300)
    const fim = await pontoNoMapa(page, 780, 430)
    await page.mouse.move(inicio.x, inicio.y)
    await page.mouse.down()
    await page.mouse.move((inicio.x + fim.x) / 2, (inicio.y + fim.y) / 2, { steps: 8 })
    await page.mouse.move(fim.x, fim.y, { steps: 8 })
    await page.waitForTimeout(120)
    await page.mouse.up()
    await page.waitForTimeout(300)

    // 3. Nenhuma rejeição/erro escapou nesses gestos.
    expect(detectores.errosDePagina, 'erro de página escapou durante o gesto da Peça').toEqual([])
    expect(await detectores.rejeicoesDaPagina(), 'unhandled promise rejection escapou durante o gesto da Peça').toEqual([])
  })
})
