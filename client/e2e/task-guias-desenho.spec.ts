// GUIAS ESTILO FIGMA, CORREÇÃO DA FATIA 1 (revisão de 11367caf): a caixa que
// vira guia é a da peça como ela APARECE no mapa. Um móvel girado 90 graus
// ficava com a caixa deitada, e a escada valia só pela linha do meio do lance;
// a sala encaixava numa borda onde não havia nada, o desalinhamento que o
// pedido 3 de 30/09/2026 quer acabar.
//
// COMO PROVA. Gesto de ponteiro de verdade no canvas, a posição da sala pela
// store e a guia magenta pela foto da página (a mesma régua de pixel de
// task-guias-figma.spec.ts), com o renderer WebGL de verdade.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Prop, Region, Stair } from '../src/types/map'

/** `SMART_GUIDE_COLOR` (src/pixi/constants.ts): 0xff4fd8. */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 200 && cor.g <= 150 && cor.b >= 150
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

/** As duas peças aparecem de x = 750 a 850, entre y = 100 e y = 300. */
const BORDA_QUE_SE_VE = 750
const MESA_EM_PE: Prop = { id: 'mesa', src: '', x: 800, y: 200, width: 200, height: 100, linkedMapPath: null, mobilia: 'mesa', rotation: 90 }
const ESCADA_EM_PE: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 800, y1: 100, x2: 800, y2: 300 }], stepWidth: 100 }

/** Sala retangular [300..500] × [450..650]; pega-se perto do canto, longe do nome. */
const PEGA = { x: 320, y: 470 }
/**
 * +452 leva a borda esquerda da sala (300) a 752: 2 px da borda que se vê e
 * 52 px de qualquer âncora da caixa antiga (700/800/900 da mesa sem giro, 800
 * da linha do meio da escada). Em qualquer zoom da câmera, 52 px de mundo
 * passam da tolerância de 6 px de tela.
 */
const ARRASTO = 452
/** Na guia vertical da borda, na faixa entre as peças (acabam em y = 300) e a sala (começa em y = 450). */
const NA_GUIA = { x: BORDA_QUE_SE_VE, y: 375 }

async function montaMapa(page: Page, pecas: { props: Prop[]; stairs: Stair[] }): Promise<void> {
  await page.evaluate(async ({ props, stairs }) => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap({ ...mapFactory.createEmptyMap('map_e2e_guias_desenho', 'E2E Guias pelo desenho', 30, 20, 64), props, stairs })
    store.setActiveTool('select')
    const base: Pick<Region, 'tag' | 'fillColor' | 'fillPattern' | 'data'> = { tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
    store.addRegion({
      ...base,
      id: 'retangular',
      points: [
        { x: 300, y: 450 },
        { x: 500, y: 450 },
        { x: 500, y: 650 },
        { x: 300, y: 650 },
      ],
      room: { shape: 'rect', name: '' },
    })
  }, pecas)
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

/** As cores de uma faixa horizontal de 11 px centrada no ponto de mundo. */
async function coresEm(page: Page, mundo: { x: number; y: number }): Promise<Array<{ r: number; g: number; b: number }>> {
  const p = await naPagina(page, mundo)
  const foto = await page.screenshot({ clip: { x: Math.round(p.x) - 5, y: Math.round(p.y), width: 11, height: 1 } })
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const tela = document.createElement('canvas')
    tela.width = bitmap.width
    tela.height = bitmap.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d para ler a foto')
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, 1)
    const cores: Array<{ r: number; g: number; b: number }> = []
    for (let i = 0; i < bitmap.width; i += 1) cores.push({ r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] })
    return cores
  }, foto.toString('base64'))
}

async function bordaEsquerdaDaSala(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const sala = mod.useMapStore.getState().map.regions.find((r) => r.id === 'retangular')
    if (!sala) throw new Error('sem a sala retangular')
    return Math.min(...sala.points.map((p) => p.x))
  })
}

/** Arrasta a sala até 2 px da borda que se vê, confere o encaixe e a guia, e solta. */
async function arrastaAteABordaQueSeVe(page: Page, foto: string): Promise<void> {
  await page.waitForTimeout(PINTURA_MS)
  // Controle: antes do gesto, nada magenta onde a guia vai aparecer.
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)

  const de = await naPagina(page, PEGA)
  const para = await naPagina(page, { x: PEGA.x + ARRASTO, y: PEGA.y })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)

  expect(await bordaEsquerdaDaSala(page)).toBe(BORDA_QUE_SE_VE)
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(true)
  await page.screenshot({ path: test.info().outputPath(foto) })

  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  expect(await bordaEsquerdaDaSala(page)).toBe(BORDA_QUE_SE_VE)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('móvel girado 90 graus: a sala encaixa na borda do desenho em pé, com a guia magenta ali', async ({ page }) => {
  await montaMapa(page, { props: [MESA_EM_PE], stairs: [] })
  await arrastaAteABordaQueSeVe(page, 'guia-na-mesa-em-pe.png')
})

test('escada: a sala encaixa na borda do lance (largura do degrau), com a guia magenta ali', async ({ page }) => {
  await montaMapa(page, { props: [], stairs: [ESCADA_EM_PE] })
  await arrastaAteABordaQueSeVe(page, 'guia-na-escada.png')
})
