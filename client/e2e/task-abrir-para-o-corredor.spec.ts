// E2E do pedido 4 (30/09/2026), fatia 3: o botão "Abrir para o corredor" do
// painel da Sala. A imagem 4 do pedido: duas linhas de parede solta (o
// corredor) entram na Sala, uma pela borda de cima e a outra pela lateral
// esquerda, e riscam o chão. Selecionada a Sala, o painel conta UM corredor —
// par de linhas, não paredes —, o clique abre a parede da Sala entre as duas
// linhas (a quina de cima à esquerda) e as linhas param na borda, num passo
// só de Ctrl+Z. Aberto tudo, o botão some; o Ctrl+Z fecha e o traz de volta.
//
// Tudo por gesto: a Sala pelo arrasto da ferramenta Sala, as linhas pela
// ferramenta Parede, a seleção por clique no chão. Só o mapa vazio vem do
// `loadMap`. Sem grade, para as pontas caírem onde o mouse soltou.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'
import type { Region, Wall } from '../src/types/map'

interface Ponto {
  x: number
  y: number
}

interface Estado {
  sala: Region | null
  soltas: Wall[]
  daSala: Wall[]
  passosDeDesfazer: number
}

/**
 * A Sala: retângulo de 650,350 a 970,606 (px do canvas = px do mundo no mapa
 * novo). O canvas ocupa a janela inteira, e o painel (até x≈280) e a barra de
 * ferramentas (até y≈100) flutuam por cima: o gesto que começa debaixo deles
 * não chega ao canvas. Por isso tudo fica à direita e abaixo dos dois.
 */
const CANTO_A = { x: 650, y: 350 }
const CANTO_B = { x: 970, y: 606 }
/** A entra pela borda de cima (cruza em 690,350); B pela lateral esquerda (cruza perto de 650,416). */
const LINHA_A: [Ponto, Ponto] = [
  { x: 530, y: 190 },
  { x: 750, y: 410 },
]
const LINHA_B: [Ponto, Ponto] = [
  { x: 450, y: 270 },
  { x: 710, y: 460 },
]
/** Um ponto do chão longe das linhas e do nome da Sala: o clique ali seleciona a Sala. */
const NO_CHAO = { x: 900, y: 560 }
/** Folga de comparação de coordenada (px). */
const FOLGA = 0.5

async function lerEstado(page: Page): Promise<Estado> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map, past } = mod.useMapStore.getState()
    const sala = map.regions.find((r) => r.room !== undefined) ?? null
    return {
      sala,
      soltas: map.walls.filter((w) => w.regionId === undefined),
      daSala: sala === null ? [] : map.walls.filter((w) => w.regionId === sala.id),
      passosDeDesfazer: past.length,
    }
  })
}

async function resetMap(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_abrir_corredor', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function arrastar(page: Page, origem: Ponto, de: Ponto, ate: Ponto): Promise<void> {
  await page.mouse.move(origem.x + de.x, origem.y + de.y)
  await page.mouse.down()
  await page.mouse.move(origem.x + ate.x, origem.y + ate.y, { steps: 6 })
  await page.mouse.up()
}

/** A ponta da parede que está sobre a borda da Sala (topo y=300 ou esquerda x=400), ou `null`. */
function pontaNaBorda(w: Wall): Ponto | null {
  const pontas = [
    { x: w.x1, y: w.y1 },
    { x: w.x2, y: w.y2 },
  ]
  const naBorda = (p: Ponto) =>
    (Math.abs(p.y - CANTO_A.y) <= FOLGA && p.x >= CANTO_A.x && p.x <= CANTO_B.x) ||
    (Math.abs(p.x - CANTO_A.x) <= FOLGA && p.y >= CANTO_A.y && p.y <= CANTO_B.y)
  return pontas.find(naBorda) ?? null
}

function temPontaNaQuina(w: Wall): boolean {
  return [
    { x: w.x1, y: w.y1 },
    { x: w.x2, y: w.y2 },
  ].some((p) => Math.hypot(p.x - CANTO_A.x, p.y - CANTO_A.y) <= FOLGA)
}

function botaoAbrir(page: Page) {
  return page.getByRole('button', { name: 'Abrir para o corredor (1)', exact: true })
}

test.beforeEach(async ({ page }) => {
  // Disco de mentira, como nas outras jornadas do editor.
  await installTauriFsStub(page)
  await enterEditor(page)
  await resetMap(page)
})

test('imagem 4: o painel conta 1 corredor, o clique abre a quina e para as linhas na borda, o botão some; Ctrl+Z fecha e o traz de volta', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await pickTool(page, 'Sala')
  await arrastar(page, box, CANTO_A, CANTO_B)
  await pickTool(page, 'Parede')
  await arrastar(page, box, LINHA_A[0], LINHA_A[1])
  await arrastar(page, box, LINHA_B[0], LINHA_B[1])
  await pickTool(page, 'Selecionar')
  await page.mouse.click(box.x + NO_CHAO.x, box.y + NO_CHAO.y)

  const antes = await lerEstado(page)
  if (antes.sala === null || antes.sala.room === undefined) throw new Error('a Sala não foi desenhada')
  expect(antes.soltas).toHaveLength(2)
  expect(antes.daSala).toHaveLength(4)
  // A quina de cima à esquerda ainda fecha a Sala.
  expect(antes.daSala.some(temPontaNaQuina)).toBe(true)

  const botao = botaoAbrir(page)
  await expect(botao).toBeVisible()
  await expect(botao).toBeEnabled()
  await botao.click()

  const depois = await lerEstado(page)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)
  // As duas linhas param na borda (mesmos ids), e a parede da Sala abriu na quina.
  expect(depois.soltas.map((w) => w.id).sort()).toEqual(antes.soltas.map((w) => w.id).sort())
  for (const linha of depois.soltas) expect(pontaNaBorda(linha)).not.toBeNull()
  expect(depois.daSala.some(temPontaNaQuina)).toBe(false)
  await expect(page.locator('.lb-toast__text', { hasText: `Vão aberto entre ${antes.sala.room.name} e o corredor. Ctrl+Z desfaz.` })).toBeVisible()
  // Nada mais a abrir: botão na tela sempre faz alguma coisa.
  await expect(page.getByRole('button', { name: /^Abrir para/ })).toHaveCount(0)

  await page.keyboard.press('Control+z')
  const desfeito = await lerEstado(page)
  expect(desfeito.soltas).toEqual(antes.soltas)
  expect(desfeito.daSala).toEqual(antes.daSala)
  await expect(botao).toBeVisible()
})
