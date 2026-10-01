// GUIAS ESTILO FIGMA, FATIA 4 (pedido 3 de 30/09/2026, PEDIDOS.md): as guias
// também valem ENQUANTO SE DESENHA. O canto da Sala que chega a poucos px da
// borda da vizinha encaixa nela, com a guia magenta fina na tela durante o
// arrasto, e a sala nasce alinhada. A Linha de corredor puxada quase deitada
// fica deitada: a ponta encaixa na altura do começo.
//
// COMO PROVA. Gesto de ponteiro de verdade no canvas, a forma pela store e a
// guia pela foto da página (a régua de pixel de task-guias-figma.spec.ts), com
// o renderer WebGL de verdade. Coordenadas a partir de x = 350: o painel da
// esquerda cobre o canvas até ~280 px.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'
import type { MapData, Region, Wall } from '../src/types/map'

/** `SMART_GUIDE_COLOR` (src/pixi/constants.ts): 0xff4fd8. */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 200 && cor.g <= 150 && cor.b >= 150
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

const GRADE = 64

/** A vizinha: [640..960] × [100..250]. */
const VIZINHA = { minX: 640, maxX: 960, minY: 100, maxY: 250 }
/** O canto puxado chega a 3 px da borda direita da vizinha (960). */
const DE = { x: 400, y: 350 }
const ATE = { x: 957, y: 520 }
/** Na guia vertical x = 960, entre a vizinha (acaba em y = 250) e a sala nova (começa em y = 350). */
const NA_GUIA = { x: 960, y: 300 }

type Ponto = { x: number; y: number }

function salaRetangular(id: string, minX: number, minY: number, maxX: number, maxY: number): { region: Region; walls: Wall[] } {
  const points = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const region: Region = { id, points, tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: '' } }
  const walls: Wall[] = points.map((p, i) => {
    const q = points[(i + 1) % points.length]
    return { id: `${id}-p${i}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y, blocksLight: true, blocksMove: true, door: null, regionId: id, regionEdgeIndex: i }
  })
  return { region, walls }
}

/** Mapa vazio com as salas dadas (com as 4 paredes de cada, como a ferramenta Sala cria), grade desligada. */
async function montaMapa(page: Page, salas: Array<{ region: Region; walls: Wall[] }>): Promise<void> {
  await page.evaluate(
    async ({ salas, grade }) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mod = await import('/src/stores/mapStore.ts')
      const store = mod.useMapStore.getState()
      const vazio: MapData = mapFactory.createEmptyMap('map_e2e_guias_ao_desenhar', 'E2E Guias ao desenhar', 30, 20, grade)
      store.loadMap({ ...vazio, regions: salas.map((s) => s.region), walls: salas.flatMap((s) => s.walls) })
      store.setActiveTool('select')
      store.setSnapEnabled(false)
    },
    { salas, grade: GRADE },
  )
}

/** Ponto de mundo em px de página, pela câmera de agora. */
async function naPagina(page: Page, mundo: Ponto): Promise<Ponto> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const camera = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })
  return { x: caixa.x + camera.x + mundo.x * camera.scale, y: caixa.y + camera.y + mundo.y * camera.scale }
}

/** As cores de uma faixa horizontal de 11 px centrada no ponto de mundo. */
async function coresEm(page: Page, mundo: Ponto): Promise<Array<{ r: number; g: number; b: number }>> {
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

/** A caixa da sala que a ferramenta criou (a que não estava no mapa montado). */
async function caixaDaSalaNova(page: Page, idsAntigos: string[]): Promise<{ minX: number; maxX: number; minY: number; maxY: number }> {
  return page.evaluate(async (antigos) => {
    const mod = await import('/src/stores/mapStore.ts')
    const nova = mod.useMapStore.getState().map.regions.find((r) => !antigos.includes(r.id))
    if (!nova) throw new Error('a ferramenta Sala não criou a sala')
    const xs = nova.points.map((p) => p.x)
    const ys = nova.points.map((p) => p.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }, idsAntigos)
}

async function arrastaNoMundo(page: Page, de: Ponto, ate: Ponto, passos: number): Promise<void> {
  const a = await naPagina(page, de)
  const b = await naPagina(page, ate)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: passos })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('Sala: o canto puxado a 3 px da borda da vizinha encaixa nela, a guia magenta aparece no arrasto e a sala nasce alinhada', async ({ page }) => {
  await montaMapa(page, [salaRetangular('vizinha', VIZINHA.minX, VIZINHA.minY, VIZINHA.maxX, VIZINHA.maxY)])
  await pickTool(page, 'Sala')
  await page.waitForTimeout(PINTURA_MS)
  // Controle: antes do gesto, nada magenta onde a guia vai aparecer.
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)

  await arrastaNoMundo(page, DE, ATE, 12)
  await page.waitForTimeout(PINTURA_MS)
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(true)
  // Foto do gesto como evidência (pasta temporária da corrida, fora do repositório).
  await page.screenshot({ path: test.info().outputPath('sala-encaixa-ao-desenhar.png') })

  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  // Soltou: a sala nasce com a borda direita na da vizinha, e a guia some.
  expect(await caixaDaSalaNova(page, ['vizinha'])).toEqual({ minX: DE.x, maxX: VIZINHA.maxX, minY: DE.y, maxY: ATE.y })
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)
})

test('Sala com Ctrl: o canto fica onde o cursor está, sem guia', async ({ page }) => {
  await montaMapa(page, [salaRetangular('vizinha', VIZINHA.minX, VIZINHA.minY, VIZINHA.maxX, VIZINHA.maxY)])
  await pickTool(page, 'Sala')
  const a = await naPagina(page, DE)
  const b = await naPagina(page, ATE)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.keyboard.down('Control')
  await page.mouse.move(b.x, b.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)
  await page.mouse.up()
  await page.keyboard.up('Control')
  expect((await caixaDaSalaNova(page, ['vizinha'])).maxX).toBe(ATE.x)
})

test('Linha de corredor puxada quase deitada fica deitada: a ponta encaixa na altura do começo', async ({ page }) => {
  await montaMapa(page, [salaRetangular('vizinha', VIZINHA.minX, VIZINHA.minY, VIZINHA.maxX, VIZINHA.maxY)])
  await pickTool(page, 'Linha')
  // 4 px de desnível em 300: a mão tremendo.
  await arrastaNoMundo(page, { x: 400, y: 450 }, { x: 700, y: 454 }, 10)
  await page.mouse.up()
  const linha = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.drawings.at(-1) ?? null
  })
  expect(linha).toMatchObject({ kind: 'line', x1: 400, y1: 450, x2: 700, y2: 450 })
})

test('desempenho: desenhar uma sala por cima de 400 salas, com as guias entrando e saindo, não trava a tela (nenhuma tarefa longa de 200 ms ou mais)', async ({ page }) => {
  // 400 salas de 40 x 40 com as 4 paredes cada, uma por célula de 64.
  const salas = Array.from({ length: 400 }, (_, i) => {
    const coluna = i % 20
    const linha = Math.floor(i / 20)
    return salaRetangular(`s${i}`, coluna * GRADE + 12, linha * GRADE + 12, coluna * GRADE + 52, linha * GRADE + 52)
  })
  await montaMapa(page, salas)
  await pickTool(page, 'Sala')
  await page.evaluate(() => {
    const registro: number[] = []
    Reflect.set(window, '__tarefasLongas', registro)
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) registro.push(entrada.duration)
    }).observe({ type: 'longtask', buffered: false })
  })
  const a = await naPagina(page, { x: 400, y: 120 })
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  // Vai e volta por cima das bordas e dos centros das salas: a guia entra e sai a cada célula.
  for (const ate of [{ x: 900, y: 500 }, { x: 610, y: 300 }, { x: 1000, y: 560 }, { x: 700, y: 400 }]) {
    const b = await naPagina(page, ate)
    await page.mouse.move(b.x, b.y, { steps: 20 })
  }
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  const tarefas = await page.evaluate(() => {
    const registro = Reflect.get(window, '__tarefasLongas')
    return Array.isArray(registro) ? registro.filter((d): d is number => typeof d === 'number') : []
  })
  const maior = tarefas.length === 0 ? 0 : Math.max(...tarefas)
  test.info().annotations.push({ type: 'tarefas longas ao desenhar (ms)', description: `${tarefas.length} tarefa(s); maior ${Math.round(maior)} ms` })
  expect(maior).toBeLessThan(200)
})
