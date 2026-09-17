// Verificação e2e: segurar o botão do meio do mouse (roda) e arrastar sempre
// faz pan da câmera, independente da ferramenta ativa e do que estiver sob o
// cursor — inclusive quando o cursor começa EM CIMA de uma parede, que antes
// do fix caía em 'dragging-wall-body'.
//
// REESCRITO em 17/09/2026. A versão anterior deste arquivo era verde falso de
// três jeitos ao mesmo tempo e teria passado com o pan do botão do meio morto:
//
//   1. montava o cenário com `loadMap` dentro de `page.evaluate` — estado
//      injetado, não gesto;
//   2. fazia o "arrasto" com `canvas.dispatchEvent(new PointerEvent(...))`. O
//      comentário de lá dizia que `page.mouse` não expõe o botão do meio; é
//      falso — `page.mouse.down({ button: 'middle' })` existe e é o que este
//      arquivo usa agora. Evento sintético entra no Pixi por um caminho que
//      mouse de verdade não percorre (sem hit-test do navegador, sem captura
//      de ponteiro), então aprovava código que o usuário não consegue usar;
//   3. provava o resultado lendo `camera` da store por um `import()` dentro do
//      evaluate — justamente a instância que o vite duplica a cada HMR (ver
//      `sondarServidorLimpo`, scripts/portao.cjs). A afirmação era sobre uma
//      store que a tela podia nunca ter usado.
//
// Agora: gesto de gente (desce, move em vários passos, PAUSA, sobe) e prova no
// que a pessoa vê — o desenho reaparece deslocado exatamente pelo tanto do
// arrasto, e o painel continua dizendo "Nada selecionado".
//
// A cobertura dos outros caminhos de pan (Espaço+arrastar, pan com a
// ferramenta Parede ativa, travamento durante o gesto) está na jornada
// `task-jornada-portao-vista-movel.spec.ts`.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const PAINT_MS = 150
const PAUSA_ANTES_DE_SOLTAR_MS = 120
const PASSOS_DO_ARRASTO = 14
const PAN_DX = 120
const PAN_DY = 80

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function recorte(page: Page, x: number, y: number, width: number, height: number): Promise<Foto> {
  return page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width, height } })
}

async function ferramenta(page: Page, label: 'Selecionar' | 'Parede'): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}

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

/** Traça uma parede horizontal passando pelo ponto onde o pan vai começar. */
async function desenharParedeEm(page: Page, y: number): Promise<void> {
  await ferramenta(page, 'Parede')
  await arrastar(page, { x: 600, y }, { x: 900, y }, 'left')
  await ferramenta(page, 'Selecionar')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(PAINT_MS)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('1. botão do meio começando EM CIMA de uma parede faz pan: a parede anda junto com a vista', async ({ page }) => {
  const y = 400
  await desenharParedeEm(page, y)

  const janela = { x: 620, y: y - 40, width: 260, height: 80 }
  const antes = await recorte(page, janela.x, janela.y, janela.width, janela.height)

  // O arrasto COMEÇA sobre a parede — é o caso que o fix existe para cobrir.
  await arrastar(page, { x: 750, y }, { x: 750 + PAN_DX, y: y + PAN_DY }, 'middle')

  const naOrigem = await recorte(page, janela.x, janela.y, janela.width, janela.height)
  expect(naOrigem.equals(antes), 'a vista não saiu do lugar com o botão do meio sobre a parede').toBe(false)

  const noDestino = await recorte(page, janela.x + PAN_DX, janela.y + PAN_DY, janela.width, janela.height)
  expect(
    noDestino.equals(antes),
    `a parede não reapareceu deslocada ${PAN_DX}x${PAN_DY} px: o gesto mexeu a parede, não a vista`,
  ).toBe(true)
})

test('2. botão do meio sobre a parede não a seleciona: o painel continua em "Nada selecionado"', async ({ page }) => {
  const y = 400
  await desenharParedeEm(page, y)
  await expect(page.getByText('Nada selecionado')).toBeVisible()

  await arrastar(page, { x: 750, y }, { x: 750 + PAN_DX, y: y + PAN_DY }, 'middle')

  await expect(page.getByText('Nada selecionado')).toBeVisible()
})
