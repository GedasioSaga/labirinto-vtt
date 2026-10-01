// E2E do pedido 5 (30/09/2026): "depois que eu faço uma linha seria legal eu
// poder alinhar ela mesmo depois de feita apertando alt, para ela ficar em
// angulos retos". Alt TOCADO (soltar antes de ALT_TOQUE_JANELA_MS, sem outra
// entrada no meio) com a linha pronta selecionada deixa a linha em pé ou
// deitada, num passo só de Ctrl+Z. O Alt que já tem dono continua dele:
// Alt+arrastar duplica, Alt no meio de um arrasto não endireita, e Alt
// SEGURADO fica reservado para as guias de medir (pedido 3).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import { ALT_TOQUE_JANELA_MS } from '../src/lib/toqueDeAlt'
import type { Drawing } from '../src/types/map'

type Linha = Extract<Drawing, { kind: 'line' }>

interface Caixa {
  x: number
  y: number
}

interface Estado {
  linhas: Linha[]
  selecionados: string[]
  passosDeDesfazer: number
}

/** A linha torta do gesto, em px do canvas (mapa novo: câmera na origem, 1 px de tela = 1 px de mundo). */
const DE = { x: 300, y: 200 }
const ATE = { x: 360, y: 420 }
const MEIO = { x: (DE.x + ATE.x) / 2, y: (DE.y + ATE.y) / 2 }

async function lerEstado(page: Page): Promise<Estado> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map, selection, past } = mod.useMapStore.getState()
    return {
      linhas: map.drawings.filter((d): d is Linha => d.kind === 'line'),
      selecionados: selection.map((s) => s.id),
      passosDeDesfazer: past.length,
    }
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_alt_endireitar', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    // Sem grade: a ponta solta cai onde o mouse soltou, e o meio da linha é conhecido.
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function caixaDoCanvas(page: Page): Promise<Caixa> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

function linhaPorId(estado: Pick<Estado, 'linhas'>, id: string): Linha {
  const linha = estado.linhas.find((l) => l.id === id)
  if (linha === undefined) throw new Error(`a linha ${id} sumiu`)
  return linha
}

function comprimento(l: Linha): number {
  return Math.hypot(l.x2 - l.x1, l.y2 - l.y1)
}

/** Em pé ou deitada, a menos de 0,01 px — a mesma régua do endireitar. */
function estaReta(l: Linha): boolean {
  return Math.abs(l.x2 - l.x1) <= 0.01 || Math.abs(l.y2 - l.y1) <= 0.01
}

/** O caminho do mestre: ferramenta Linha, arrasto torto, Selecionar, clique no meio da linha. */
async function desenharESelecionarLinhaTorta(page: Page, box: Caixa): Promise<Linha> {
  await pickTool(page, 'Linha')
  await page.mouse.move(box.x + DE.x, box.y + DE.y)
  await page.mouse.down()
  await page.mouse.move(box.x + ATE.x, box.y + ATE.y, { steps: 5 })
  await page.mouse.up()

  await pickTool(page, 'Selecionar')
  await page.mouse.click(box.x + MEIO.x, box.y + MEIO.y)

  const estado = await lerEstado(page)
  expect(estado.linhas).toHaveLength(1)
  const torta = estado.linhas[0]
  expect(estaReta(torta)).toBe(false)
  expect(estado.selecionados).toEqual([torta.id])
  return torta
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. Alt tocado com a linha torta selecionada: fica em pé, do mesmo tamanho e no mesmo lugar, e um Ctrl+Z a devolve torta', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  const antes = await lerEstado(page)

  await page.keyboard.press('Alt')

  const depois = await lerEstado(page)
  const reta = linhaPorId(depois, torta.id)
  // Mais para em pé que deitada: fica em pé, com o x copiado (sem ruído de cos/sin).
  expect(Math.abs(reta.x1 - reta.x2)).toBeLessThanOrEqual(0.01)
  expect(comprimento(reta)).toBeCloseTo(comprimento(torta), 6)
  // Solta, sem encostar em nada: gira em volta do meio, como no Figma.
  expect((reta.x1 + reta.x2) / 2).toBeCloseTo((torta.x1 + torta.x2) / 2, 6)
  expect((reta.y1 + reta.y2) / 2).toBeCloseTo((torta.y1 + torta.y2) / 2, 6)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)

  await page.keyboard.press('Control+z')
  const desfeito = await lerEstado(page)
  expect(linhaPorId(desfeito, torta.id)).toEqual(torta)
  expect(desfeito.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})

test('2. Alt+arrastar a linha continua duplicando, e soltar o Alt depois não endireita nada', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)

  await page.keyboard.down('Alt')
  await page.mouse.move(box.x + MEIO.x, box.y + MEIO.y)
  await page.mouse.down()
  await page.mouse.move(box.x + MEIO.x + 100, box.y + MEIO.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Alt')

  const { linhas } = await lerEstado(page)
  expect(linhas).toHaveLength(2)
  // O original fica onde estava; a cópia andou. Nenhuma das duas endireitou.
  expect(linhaPorId({ linhas }, torta.id)).toEqual(torta)
  for (const linha of linhas) expect(estaReta(linha)).toBe(false)
})

test('3. tocar Alt no meio de um arrasto não endireita, e um Ctrl+Z desfaz o arrasto inteiro', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  const antes = await lerEstado(page)

  await page.mouse.move(box.x + MEIO.x, box.y + MEIO.y)
  await page.mouse.down()
  await page.mouse.move(box.x + MEIO.x + 30, box.y + MEIO.y + 20, { steps: 3 })
  await page.keyboard.press('Alt')
  await page.mouse.move(box.x + MEIO.x + 70, box.y + MEIO.y + 40, { steps: 3 })
  await page.mouse.up()

  const depois = await lerEstado(page)
  const movida = linhaPorId(depois, torta.id)
  expect(movida.x1).not.toBe(torta.x1)
  expect(estaReta(movida)).toBe(false)
  // Um passo só: o do arrasto. O endireitar no meio dele empurraria um segundo.
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)

  await page.keyboard.press('Control+z')
  const desfeito = await lerEstado(page)
  expect(linhaPorId(desfeito, torta.id)).toEqual(torta)
  expect(desfeito.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})

test('4. Alt segurado além da janela do toque é do medir (pedido 3): soltar não endireita', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  const antes = await lerEstado(page)

  await page.keyboard.down('Alt')
  // O tempo É o gesto aqui: segurar além da janela do toque.
  await page.waitForTimeout(ALT_TOQUE_JANELA_MS + 150)
  await page.keyboard.up('Alt')

  const depois = await lerEstado(page)
  expect(linhaPorId(depois, torta.id)).toEqual(torta)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})
