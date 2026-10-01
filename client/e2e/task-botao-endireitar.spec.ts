// E2E do pedido 5 (30/09/2026), fatia 3: o botão "Endireitar" do painel e a
// linha da tela de atalhos. O botão é a porta de entrada visível do Alt
// tocado: aparece sozinho com uma linha torta selecionada, logo abaixo da
// faixa da seleção, endireita num passo de Ctrl+Z e some quando a linha já
// está reta. A tela de atalhos ensina o gesto: "Alt (tocar)", porque o Alt
// segurado é das guias de medir (pedido 3).
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

/** O botão, onde ele mora: a seção logo depois da faixa da seleção, no corpo do painel. */
function botaoEndireitar(page: Page) {
  return page.locator('.lb-inspector__body .lb-selhead + section').getByRole('button', { name: 'Endireitar', exact: true })
}

test.beforeEach(async ({ page }) => {
  // Disco de mentira, como nas outras jornadas do editor.
  await installTauriFsStub(page)
  await enterEditor(page)
  await resetMap(page)
})

test('1. linha torta selecionada: o botão aparece abaixo da faixa, o clique endireita num passo e ele some; Ctrl+Z traz os dois de volta', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  const torta = await desenharESelecionarLinhaTorta(page, box)
  const antes = await lerEstado(page)

  const botao = botaoEndireitar(page)
  await expect(botao).toBeVisible()
  await botao.click()

  const depois = await lerEstado(page)
  const reta = linhaPorId(depois, torta.id)
  expect(Math.abs(reta.x1 - reta.x2)).toBeLessThanOrEqual(0.01)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)
  // Com a linha reta não há o que endireitar: botão na tela tem de fazer alguma coisa.
  await expect(botao).toHaveCount(0)

  await page.keyboard.press('Control+z')
  const desfeito = await lerEstado(page)
  expect(linhaPorId(desfeito, torta.id)).toEqual(torta)
  await expect(botao).toBeVisible()
})

test('2. parar o ponteiro no botão abre o balão que ensina o atalho e o desfazer', async ({ page }) => {
  const box = await caixaDoCanvas(page)
  await desenharESelecionarLinhaTorta(page, box)

  await botaoEndireitar(page).hover()
  const balao = page.locator('.lb-inspector__body .lb-field__hint[data-dica="aberta"]')
  await expect(balao).toBeVisible()
  await expect(balao).toHaveText('Deixa a linha em pé ou deitada, sem mudar o tamanho. Atalho: tocar o Alt. Ctrl+Z desfaz.')
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
