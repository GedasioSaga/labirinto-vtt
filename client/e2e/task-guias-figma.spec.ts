// GUIAS ESTILO FIGMA, FATIA 1 (pedido 3 de 30/09/2026, PEDIDOS.md): arrastar
// uma sala perto da altura de outra faz a sala encaixar pela BORDA ou pelo
// CENTRO da caixa da vizinha, e uma guia magenta fina liga as duas enquanto o
// botão está apertado.
//
// COMO PROVA. Gesto de ponteiro de verdade no canvas e régua de pixel na foto
// da página (o PNG é decodificado pelo próprio navegador): a guia é cobrada
// onde o olho a vê, com o renderer WebGL de verdade. A store é usada só para
// montar o mapa e para conferir onde a sala foi parar.
//
// O caso é o da imagem do pedido: sala REDONDA (polígono de 24 lados) e uma
// sala retangular que tem de ficar com o centro na mesma vertical. Antes, só
// `points[0]` da sala alinhava, e a redonda nunca encaixava pelo centro.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Region } from '../src/types/map'

/** `SMART_GUIDE_COLOR` (src/pixi/constants.ts): 0xff4fd8. */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 200 && cor.g <= 150 && cor.b >= 150
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

/** Sala redonda: centro (800, 200), raio 100 → caixa [700..900] × [100..300]. */
const CENTRO_DA_REDONDA_X = 800
/** Sala retangular [300..500] × [450..650]; pega-se perto do canto, longe do meio. */
const PEGA = { x: 320, y: 470 }
/** Faixa entre as duas salas (a redonda acaba em y = 300, a retangular começa em 450). */
const Y_ENTRE_AS_SALAS = 375

async function montaMapa(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_guias', 'E2E Guias', 30, 20, 64))
    store.setActiveTool('select')
    const lados = 24
    const redonda = Array.from({ length: lados }, (_, i) => ({
      x: 800 + 100 * Math.cos((2 * Math.PI * i) / lados),
      y: 200 + 100 * Math.sin((2 * Math.PI * i) / lados),
    }))
    const base: Pick<Region, 'tag' | 'fillColor' | 'fillPattern' | 'data'> = { tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
    store.addRegion({ ...base, id: 'redonda', points: redonda, room: { shape: 'polygon', name: '' } })
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

async function caixaDaRetangular(page: Page): Promise<{ minX: number; maxX: number }> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const sala = mod.useMapStore.getState().map.regions.find((r) => r.id === 'retangular')
    if (!sala) throw new Error('sem a sala retangular')
    const xs = sala.points.map((p) => p.x)
    return { minX: Math.min(...xs), maxX: Math.max(...xs) }
  })
}

const NA_GUIA = { x: CENTRO_DA_REDONDA_X, y: Y_ENTRE_AS_SALAS }

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await montaMapa(page)
})

test('sala retangular arrastada até 3 px do centro da redonda encaixa pelo centro, com a guia magenta na tela até soltar', async ({ page }) => {
  // Controle: antes do gesto, nada magenta entre as salas.
  await page.waitForTimeout(PINTURA_MS)
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)

  const de = await naPagina(page, PEGA)
  // +403: o centro da retangular (400) vai a 803, 3 px do centro da redonda.
  const para = await naPagina(page, { x: PEGA.x + 403, y: PEGA.y })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)

  expect(await caixaDaRetangular(page)).toEqual({ minX: 700, maxX: 900 })
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(true)

  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  // Soltou: a posição encaixada fica, e a guia some.
  expect(await caixaDaRetangular(page)).toEqual({ minX: 700, maxX: 900 })
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)
})

test('com Ctrl a sala anda livre: fica a 3 px e nenhuma guia aparece', async ({ page }) => {
  const de = await naPagina(page, PEGA)
  const para = await naPagina(page, { x: PEGA.x + 403, y: PEGA.y })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  // Ctrl só depois do botão descer: Ctrl no pointerdown abre o laço de seleção.
  await page.keyboard.down('Control')
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)
  expect(await caixaDaRetangular(page)).toEqual({ minX: 703, maxX: 903 })
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)
  await page.mouse.up()
  await page.keyboard.up('Control')
})

test('desempenho: arrastar a sala com guia não trava a tela (nenhuma tarefa longa de 200 ms ou mais)', async ({ page }) => {
  await page.evaluate(() => {
    const registro: number[] = []
    Reflect.set(window, '__tarefasLongas', registro)
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) registro.push(entrada.duration)
    }).observe({ type: 'longtask', buffered: false })
  })
  const de = await naPagina(page, PEGA)
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  // Vai e volta por cima do encaixe: entra e sai da tolerância várias vezes.
  for (const dx of [380, 403, 420, 397, 403]) {
    const para = await naPagina(page, { x: PEGA.x + dx, y: PEGA.y })
    await page.mouse.move(para.x, para.y, { steps: 15 })
  }
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  const tarefas = await page.evaluate(() => {
    const registro = Reflect.get(window, '__tarefasLongas')
    return Array.isArray(registro) ? registro.filter((d): d is number => typeof d === 'number') : []
  })
  const maior = tarefas.length === 0 ? 0 : Math.max(...tarefas)
  test.info().annotations.push({ type: 'tarefas longas no arrasto (ms)', description: `${tarefas.length} tarefa(s); maior ${Math.round(maior)} ms` })
  expect(maior).toBeLessThan(200)
})
