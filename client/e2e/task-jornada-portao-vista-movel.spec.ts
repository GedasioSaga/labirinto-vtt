// JORNADA DA PEÇA DO PORTÃO — Invariante 4: "o gesto de mover a vista não pode
// morrer". Se arrastar no vazio passar a SELECIONAR, a pessoa ainda precisa
// conseguir empurrar o mapa por um caminho que já existe no app hoje. São dois:
//
//   1. botão do meio (roda do mouse) arrastando  — PixiCanvas.tsx:1972
//   2. Espaço segurado + arrastar com o botão esquerdo — PixiCanvas.tsx:1982
//
// POR QUE ESTE ARQUIVO EXISTE. O único teste que cobria a Invariante 4 era
// `task-middle-button-pan.spec.ts`, e ele era verde falso por três motivos ao
// mesmo tempo: montava o cenário injetando estado (`loadMap` dentro de um
// `page.evaluate`), fazia o gesto com `PointerEvent` sintético via
// `dispatchEvent` — que entra no Pixi por um caminho que mouse de verdade não
// percorre — e provava o resultado lendo `camera` da store, que é justamente a
// instância que pode estar duplicada por HMR (ver `sondarServidorLimpo` em
// scripts/portao.cjs). O caminho do Espaço (PixiCanvas.tsx:1982) não tinha e2e
// NENHUM. Um teste que passa com o app quebrado não é portão, é decoração.
//
// REGRA DE PROVA DESTE ARQUIVO: só entra asserção sobre o que a pessoa VÊ —
// pixel do canvas comparado byte a byte — e sobre o que ela TOCA — botões da
// barra pelo nome acessível. Nada de store, nada de `dispatchEvent`, nada de
// `setState`. O cenário é montado desenhando com o mouse, como a pessoa faria.
//
// GESTO REAL: ponteiro desce, move em vários passos, PAUSA parado e só então
// sobe — humano nenhum solta o botão no mesmo quadro do último movimento, e
// bug de arrasto costuma aparecer exatamente na parada.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** O Pixi redesenha na mutação, mas PINTA no próximo quadro (requestAnimationFrame). */
const PAINT_MS = 150
/** Pausa com o botão ainda apertado, antes de soltar. */
const PAUSA_ANTES_DE_SOLTAR_MS = 120
/** Um arrasto humano é uma sequência de posições, não um salto. */
const PASSOS_DO_ARRASTO = 14
/** Deslocamento do gesto de pan, em px de tela. Diagonal de propósito: pan que
 *  só trata um eixo passaria num teste de eixo único. */
const PAN_DX = 120
const PAN_DY = 80
/** Bar de fluidez, igual à de `task-jornada-portao-fluidez.spec.ts`: nenhuma
 *  tarefa longa pode passar de 200 ms durante o gesto. */
const TETO_LONGTASK_MS = 200

/** O que `page.screenshot()` devolve. `Buffer` não é tipo declarado no projeto
 *  de tipos dos e2e (não há `@types/node`), então o tipo vem da própria API. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

interface Caixa {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Ponto vazio do canvas onde o arrasto de pan COMEÇA. O `<canvas>` ocupa a
 * janela inteira e a barra lateral fica POR CIMA dele (x < ~280), com a barra
 * de ferramentas e a dica por cima do topo do meio (y < ~140). Medido em
 * 17/09/2026 numa falha desta jornada: começar o arrasto em (90, 90) põe o
 * ponteiro na barra lateral, o canvas não recebe gesto nenhum e o teste
 * reprova dizendo "a vista não saiu do lugar" — vermelho certo, causa errada.
 */
function pontoVazioDoCanvas(canvas: Caixa): { x: number; y: number } {
  return { x: canvas.x + canvas.width * 0.78, y: canvas.y + canvas.height * 0.75 }
}

/** Retângulo do canvas que nenhum gesto desta jornada pinta — o controle de "vazio". */
function janelaDeControleVazia(canvas: Caixa): Caixa {
  return { x: canvas.x + canvas.width - 280, y: canvas.y + 180, width: 240, height: 160 }
}

async function caixaDoCanvas(page: Page): Promise<Caixa> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

/** Recorte do que está DESENHADO na tela, em px de CSS da página. */
async function recorte(page: Page, x: number, y: number, width: number, height: number): Promise<Foto> {
  return page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width, height } })
}

async function ferramenta(page: Page, label: 'Selecionar' | 'Parede'): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/**
 * Arrasto de gente: desce, anda em `PASSOS_DO_ARRASTO` posições, para, e só
 * então solta. `botao` escolhe o caminho de pan que está sendo provado.
 */
async function arrastar(
  page: Page,
  de: { x: number; y: number },
  para: { x: number; y: number },
  botao: 'left' | 'middle',
): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down({ button: botao })
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(de.x + (para.x - de.x) * t, de.y + (para.y - de.y) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up({ button: botao })
  await page.waitForTimeout(PAINT_MS)
}

/**
 * Desenha uma parede DIAGONAL com a ferramenta Parede, no mouse. Diagonal
 * porque é a única forma que denuncia pan trocado de eixo: uma parede
 * horizontal transladada 120 px na horizontal continua parecendo a mesma
 * parede horizontal.
 */
async function desenharParedeDiagonal(page: Page, canvas: Caixa): Promise<void> {
  await ferramenta(page, 'Parede')
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  await arrastar(page, { x: cx - 160, y: cy - 110 }, { x: cx + 160, y: cy + 110 }, 'left')
  await ferramenta(page, 'Selecionar')
}

/**
 * Coletor de tarefa longa (bloqueio da thread principal). Escreve só numa
 * propriedade própria de `window` — não toca estado do app, não chama ação de
 * store. Mesmo instrumento de `task-jornada-portao-fluidez.spec.ts`.
 */
async function instalarColetor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const alvo = window as unknown as { __portaoVistaLongtasks?: number[] }
    if (alvo.__portaoVistaLongtasks) return
    const duracoes: number[] = []
    alvo.__portaoVistaLongtasks = duracoes
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) duracoes.push(entrada.duration)
    }).observe({ entryTypes: ['longtask'] })
  })
}

async function maiorTravamentoMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    const alvo = window as unknown as { __portaoVistaLongtasks?: number[] }
    const duracoes = alvo.__portaoVistaLongtasks ?? []
    return duracoes.length === 0 ? 0 : Math.max(...duracoes)
  })
}

/**
 * A prova de que a VISTA andou, na mesma representação que a pessoa enxerga:
 * o retângulo que continha o desenho passa a ser outro retângulo, e o desenho
 * reaparece inteiro no retângulo deslocado exatamente pelo tanto do gesto.
 *
 * Duas asserções, não uma. Só "mudou" passaria com o app apagando o desenho;
 * só "apareceu lá" passaria com um app que desenha a mesma coisa em todo lugar.
 */
async function provarQueAVistaAndou(
  page: Page,
  canvas: Caixa,
  gesto: (de: { x: number; y: number }, para: { x: number; y: number }) => Promise<void>,
): Promise<void> {
  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  // Janela centrada na parede, pequena o bastante para o destino (janela + pan)
  // continuar dentro do canvas.
  const janela = { x: cx - 120, y: cy - 80, width: 240, height: 160 }

  const antesNaOrigem = await recorte(page, janela.x, janela.y, janela.width, janela.height)

  // Ponto de partida do arrasto: canvas vazio, longe da parede desenhada — é
  // lá que o gesto de pan tem de continuar funcionando mesmo se arrastar no
  // vazio virar seleção.
  const de = pontoVazioDoCanvas(canvas)
  await gesto(de, { x: de.x + PAN_DX, y: de.y + PAN_DY })

  const depoisNaOrigem = await recorte(page, janela.x, janela.y, janela.width, janela.height)
  expect(
    depoisNaOrigem.equals(antesNaOrigem),
    'a vista não saiu do lugar: o mesmo retângulo da tela continua pintado igual',
  ).toBe(false)

  const depoisNoDestino = await recorte(page, janela.x + PAN_DX, janela.y + PAN_DY, janela.width, janela.height)
  expect(
    depoisNoDestino.equals(antesNaOrigem),
    `o desenho não reapareceu deslocado ${PAN_DX}x${PAN_DY} px: a vista mexeu, mas não foi um pan`,
  ).toBe(true)
}

test.beforeEach(async ({ page }) => {
  // Sem injeção de estado: `enterEditor` entra pelo menu e cria um mapa novo,
  // do mesmo jeito que a pessoa cria.
  await enterEditor(page)
  await instalarColetor(page)
})

test('1. arrastar com o botão do meio empurra a vista, mesmo com a ferramenta Selecionar ativa', async ({ page }) => {
  const canvas = await caixaDoCanvas(page)
  await desenharParedeDiagonal(page, canvas)

  await provarQueAVistaAndou(page, canvas, (de, para) => arrastar(page, de, para, 'middle'))
})

test('2. Espaço segurado + arrastar empurra a vista e NÃO desenha nem seleciona nada por baixo', async ({ page }) => {
  const canvas = await caixaDoCanvas(page)
  await desenharParedeDiagonal(page, canvas)

  await provarQueAVistaAndou(page, canvas, async (de, para) => {
    await page.keyboard.down(' ')
    await arrastar(page, de, para, 'left')
    await page.keyboard.up(' ')
    await page.waitForTimeout(PAINT_MS)
  })

  // Se o gesto tivesse caído na seleção por baixo do pan, o painel diria o que
  // ficou selecionado em vez de "Nada selecionado". Prova visível, sem store.
  await expect(page.getByText('Nada selecionado')).toBeVisible()
})

test('3. com a ferramenta Parede ativa, o botão do meio ainda é pan: a vista anda e nenhuma parede nasce do gesto', async ({ page }) => {
  const canvas = await caixaDoCanvas(page)
  await desenharParedeDiagonal(page, canvas)
  await ferramenta(page, 'Parede')

  const cx = canvas.x + canvas.width / 2
  const cy = canvas.y + canvas.height / 2
  const janela = { x: cx - 120, y: cy - 80, width: 240, height: 160 }
  const antes = await recorte(page, janela.x, janela.y, janela.width, janela.height)

  const de = pontoVazioDoCanvas(canvas)
  await arrastar(page, de, { x: de.x + PAN_DX, y: de.y + PAN_DY }, 'middle')

  const noDestino = await recorte(page, janela.x + PAN_DX, janela.y + PAN_DY, janela.width, janela.height)
  expect(noDestino.equals(antes), 'o botão do meio com a ferramenta Parede ativa deixou de fazer pan').toBe(true)

  // Uma parede nova nascida do gesto de pan apareceria no meio do trajeto do
  // arrasto, que estava vazio antes. O trecho tem de continuar igual a um
  // pedaço de fundo do mesmo tamanho que o gesto não atravessou.
  const trajeto = await recorte(page, de.x + PAN_DX / 2 - 30, de.y + PAN_DY / 2 - 30, 60, 60)
  const controle = janelaDeControleVazia(canvas)
  const vazioDeControle = await recorte(page, controle.x, controle.y, 60, 60)
  expect(trajeto.equals(vazioDeControle), 'sobrou desenho no caminho do arrasto: o pan virou traço de parede').toBe(true)
})

test('4. o gesto de pan não trava a tela: nenhuma tarefa longa acima do teto durante o arrasto', async ({ page }) => {
  const canvas = await caixaDoCanvas(page)
  await desenharParedeDiagonal(page, canvas)

  const de = pontoVazioDoCanvas(canvas)
  await arrastar(page, de, { x: de.x + PAN_DX, y: de.y + PAN_DY }, 'middle')
  await arrastar(page, { x: de.x + PAN_DX, y: de.y + PAN_DY }, de, 'middle')

  // Controle positivo primeiro: sem ele, um app morto (gesto que não chega no
  // canvas) mede 0 ms de travamento e passa no teto com louvor.
  const janela = { x: canvas.x + canvas.width / 2 - 120, y: canvas.y + canvas.height / 2 - 80, width: 240, height: 160 }
  const voltou = await recorte(page, janela.x, janela.y, janela.width, janela.height)
  const controle = janelaDeControleVazia(canvas)
  const vazioDeControle = await recorte(page, controle.x, controle.y, controle.width, controle.height)
  expect(voltou.equals(vazioDeControle), 'o canvas está vazio: o gesto medido não desenhou nem moveu nada').toBe(false)

  const travamento = await maiorTravamentoMs(page)
  expect(travamento, `maior tarefa longa durante o pan: ${travamento} ms`).toBeLessThan(TETO_LONGTASK_MS)
})
