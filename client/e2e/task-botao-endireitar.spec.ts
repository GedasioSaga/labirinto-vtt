// E2E do pedido 5 (30/09/2026), fatia 3: o "Endireitar" do painel e a linha da
// tela de atalhos. É a porta de entrada visível do Alt tocado: desde a fatia 8
// do design consolidado, um item do "Mais ações" da cabeça da ficha, que só
// aparece com uma linha torta selecionada, endireita num passo de Ctrl+Z e
// some quando a linha já está reta. A tela de atalhos ensina o gesto: "Alt
// (tocar)", porque o Alt segurado é das guias de medir (pedido 3).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'
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
const DE = { x: 400, y: 200 }
const ATE = { x: 460, y: 420 }
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_botao_endireitar', 'E2E', 30, 20, 64))
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

/**
 * Onde ele mora desde a fatia 8 do design consolidado: um item do "Mais
 * ações" da cabeça da ficha (o menu abre num portal, por cima de tudo).
 */
async function abrirMaisAcoes(page: Page) {
  await page.locator('.lb-inspector__body').getByRole('button', { name: 'Mais ações', exact: true }).click()
}

function itemEndireitar(page: Page) {
  return page.getByRole('menuitem', { name: 'Endireitar', exact: true })
}

test.beforeEach(async ({ page }) => {
  // Disco de mentira, como nas outras jornadas do editor.
  await installTauriFsStub(page)
  await enterEditor(page)
  await resetMap(page)
})

test('1. linha torta selecionada: "Endireitar" no "Mais ações" da cabeça, o clique endireita num passo e o item some; Ctrl+Z traz os dois de volta', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  const antes = await lerEstado(page)

  await abrirMaisAcoes(page)
  await expect(itemEndireitar(page)).toBeVisible()
  await itemEndireitar(page).click()

  const depois = await lerEstado(page)
  const reta = linhaPorId(depois, torta.id)
  expect(Math.abs(reta.x1 - reta.x2)).toBeLessThanOrEqual(0.01)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)
  // Com a linha reta não há o que endireitar: item no menu tem de fazer alguma coisa.
  await abrirMaisAcoes(page)
  await expect(page.getByRole('menu', { name: 'Mais ações' })).toBeVisible()
  await expect(itemEndireitar(page)).toHaveCount(0)
  // Esc no menu só fecha o menu: a seleção fica.
  await page.keyboard.press('Escape')
  expect((await lerEstado(page)).selecionados).toEqual([torta.id])

  await page.keyboard.press('Control+z')
  const desfeito = await lerEstado(page)
  expect(linhaPorId(desfeito, torta.id)).toEqual(torta)
  await abrirMaisAcoes(page)
  await expect(itemEndireitar(page)).toBeVisible()
})

test('2. o item ensina a tecla (Alt, à vista) e diz o que faz', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  await desenharESelecionarLinhaTorta(page, box)

  await abrirMaisAcoes(page)
  const item = itemEndireitar(page)
  await expect(item.locator('kbd')).toHaveText('Alt')
  await expect(item).toHaveAccessibleDescription('Sem mudar o tamanho')
})

test('3. a tela de atalhos ensina o toque: "Endireitar a linha selecionada", Alt (tocar)', async ({ page }) => {
  await page.keyboard.press('Shift+Slash')
  const tela = page.getByRole('dialog', { name: 'Atalhos do teclado' })
  await expect(tela).toBeVisible()
  const linha = tela.getByRole('listitem').filter({ hasText: 'Endireitar a linha selecionada' })
  await expect(linha).toHaveCount(1)
  await expect(linha).toHaveText(/^Endireitar a linha selecionada\s+Alt\s+\(tocar\)$/)
  await expect(linha.locator('kbd')).toHaveText(['Alt'])
})
