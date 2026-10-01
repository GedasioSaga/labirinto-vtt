// CONFERÊNCIA guias-4e5 (01/10/2026): "Clique durante o Alt não dispara nada
// estranho". O Alt segurado MEDE (pedido 3, fatia 5) e por isso convida a
// clicar com ele apertado; o Alt+arrastar duplicava já no aperto do botão, e o
// Alt+clique parado deixava uma CÓPIA INVISÍVEL empilhada sobre a peça, gastava
// um passo de desfazer e levava a seleção para a cópia (a sala clonada ainda
// ficava "Dentro de" da original). Agora a cópia só nasce quando o gesto
// ARRASTA de fato; o Alt+arrastar continua duplicando.
//
// COMO PROVA. Teclado e mouse de verdade sobre o canvas; a store só monta o
// mapa e confere o que ficou nele, no desfazer e na seleção.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { ALT_TOQUE_JANELA_MS } from '../src/lib/toqueDeAlt'
import type { Drawing, Region } from '../src/types/map'

type Linha = Extract<Drawing, { kind: 'line' }>

/** A linha torta do print 18 da conferência, e o meio dela (onde o clique a acerta). */
const LINHA: Linha = { id: 'torta', kind: 'line', x1: 400, y1: 520, x2: 520, y2: 700, color: '#ffffff', width: 4 }
const MEIO_DA_LINHA = { x: 460, y: 610 }
/** Sala selecionada [100..300]² e a outra [500..700] x [150..250], como no spec do Alt que mede. */
const SOBRE_A_OUTRA = { x: 600, y: 200 }

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

interface Retrato {
  linhas: Linha[]
  salas: Region[]
  paredes: number
  selecao: string[]
  passosDeDesfazer: number
}

async function retrato(page: Page): Promise<Retrato> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map, selection, past } = mod.useMapStore.getState()
    return {
      linhas: map.drawings.filter((d): d is Linha => d.kind === 'line'),
      salas: map.regions,
      paredes: map.walls.length,
      selecao: selection.map((s) => s.id),
      passosDeDesfazer: past.length,
    }
  })
}

async function mapaComLinhaSelecionada(page: Page): Promise<void> {
  await page.evaluate(async (linha) => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_alt_clique', 'E2E Alt clique', 30, 20, 64))
    store.setActiveTool('select')
    // Sem grade: a cópia do Alt+arrastar anda o que a mão andou.
    store.setSnapEnabled(false)
    store.addDrawing(linha)
    store.setSelection([{ kind: 'drawing', id: linha.id }])
  }, LINHA)
}

async function mapaComDuasSalas(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_alt_clique_salas', 'E2E Alt clique salas', 30, 20, 64))
    store.setActiveTool('select')
    const base: Pick<Region, 'tag' | 'fillColor' | 'fillPattern' | 'data'> = { tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
    const retangulo = (minX: number, minY: number, maxX: number, maxY: number) => [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]
    store.addRegion({ ...base, id: 'selecionada', points: retangulo(100, 100, 300, 300), room: { shape: 'rect', name: '' } })
    store.addRegion({ ...base, id: 'outra', points: retangulo(500, 150, 700, 250), room: { shape: 'rect', name: '' } })
    store.setSelection([{ kind: 'region', id: 'selecionada' }])
  })
}

/** Ponto de mundo em px de página, pela câmera de agora. */
async function naPagina(page: Page, mundo: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const camera = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })
  return { x: caixa.x + camera.x + mundo.x * camera.scale, y: caixa.y + camera.y + mundo.y * camera.scale }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('1. Alt+clique na linha selecionada: nenhuma cópia, nenhum passo de desfazer, a seleção fica na linha e ela não endireita', async ({ page }) => {
  await mapaComLinhaSelecionada(page)
  const antes = await retrato(page)
  const meio = await naPagina(page, MEIO_DA_LINHA)

  await page.mouse.move(meio.x, meio.y)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await page.waitForTimeout(PINTURA_MS)

  const depois = await retrato(page)
  expect(depois.linhas, 'o Alt+clique não deixa cópia empilhada').toEqual([LINHA])
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer)
  expect(depois.selecao).toEqual([LINHA.id])
})

test('2. tremor de mão no Alt+clique (2 px): ainda é clique, nada nasce e nada anda', async ({ page }) => {
  await mapaComLinhaSelecionada(page)
  const antes = await retrato(page)
  const meio = await naPagina(page, MEIO_DA_LINHA)

  await page.mouse.move(meio.x, meio.y)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.move(meio.x + 2, meio.y + 1, { steps: 2 })
  await page.mouse.up()
  await page.keyboard.up('Alt')

  const depois = await retrato(page)
  expect(depois.linhas).toEqual([LINHA])
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})

test('3. medindo com o Alt sobre a outra sala e clicando nela: nenhuma sala nova nem aninhada, e o clique só seleciona a sala', async ({ page }) => {
  await mapaComDuasSalas(page)
  const antes = await retrato(page)
  const alvo = await naPagina(page, SOBRE_A_OUTRA)

  // O gesto da conferência: o mouse sobre a outra sala, o Alt segurado além da janela do toque (mede), e o clique.
  await page.mouse.move(alvo.x - 20, alvo.y)
  await page.mouse.move(alvo.x, alvo.y, { steps: 4 })
  await page.keyboard.down('Alt')
  await page.waitForTimeout(ALT_TOQUE_JANELA_MS + PINTURA_MS)
  await page.mouse.down()
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await page.waitForTimeout(PINTURA_MS)

  const depois = await retrato(page)
  expect(depois.salas.map((s) => s.id), 'nenhuma cópia invisível da sala').toEqual(['selecionada', 'outra'])
  expect(depois.salas.every((s) => s.parentId === undefined), 'nada ficou "Dentro de" outra sala').toBe(true)
  expect(depois.paredes).toBe(antes.paredes)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer)
  expect(depois.selecao).toEqual(['outra'])
})

test('4. Alt+arrastar além da folga continua duplicando: a cópia anda, a original fica, e um Ctrl+Z desfaz o gesto inteiro', async ({ page }) => {
  await mapaComLinhaSelecionada(page)
  const antes = await retrato(page)
  const meio = await naPagina(page, MEIO_DA_LINHA)

  await page.mouse.move(meio.x, meio.y)
  await page.keyboard.down('Alt')
  await page.mouse.down()
  await page.mouse.move(meio.x + 100, meio.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Alt')

  const depois = await retrato(page)
  expect(depois.linhas).toHaveLength(2)
  expect(depois.linhas.find((l) => l.id === LINHA.id), 'a original fica onde estava').toEqual(LINHA)
  const copia = depois.linhas.find((l) => l.id !== LINHA.id)
  if (copia === undefined) throw new Error('o Alt+arrastar não criou a cópia')
  expect(copia.x1, 'a cópia andou com a mão').toBeGreaterThan(LINHA.x1)
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer + 1)

  await page.keyboard.press('Control+z')
  const desfeito = await retrato(page)
  expect(desfeito.linhas).toEqual([LINHA])
  expect(desfeito.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})
