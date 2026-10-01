// GUIAS ESTILO FIGMA, FATIA 5: A PEÇA DENTRO DA CAIXA DO GRUPO (correção da
// revisão de f1ac7bc3). Com DUAS salas selecionadas, segurar o Alt com o mouse
// sobre a sala que está ENTRE elas (dentro da caixa da união, fora da seleção)
// mede as folgas entre a caixa do grupo e ela, como no Figma. Antes, dentro da
// caixa o hover era só do grupo (o clique ali arrasta tudo) e nada era medido,
// enquanto a mesma sala fora da caixa era.
//
// COMO PROVA. A mesma de `task-guias-alt-medir.spec.ts`: teclado e mouse de
// verdade, e régua de pixel na foto da página, com o renderer WebGL de verdade.
// A store só monta o mapa e confere que ele não mudou.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { ALT_TOQUE_JANELA_MS } from '../src/lib/toqueDeAlt'
import type { Region } from '../src/types/map'

/** O mesmo limiar de `task-guias-alt-medir.spec.ts`: a cota magenta de 1 px sai na foto como (193, 60, 163). */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 150 && cor.b >= 120 && cor.g <= 110 && cor.r - cor.g >= 100
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

/**
 * Selecionadas: [100..300] x [100..300] e [700..900] x [100..300]; a caixa do
 * grupo é [100..900] x [100..300]. A do meio, [400..600] x [150..250], fica
 * dentro dela: as folgas da esquerda (x = 100 a 400) e da direita (x = 600 a
 * 900) passam na altura y = 200, com o número no meio de cada uma (x = 250 e
 * x = 750).
 */
const SOBRE_A_DO_MEIO = { x: 500, y: 200 }
const SOBRE_A_SELECIONADA = { x: 200, y: 200 }
/** Nas folgas, no vão entre as salas e longe dos números. */
const NA_FOLGA_DA_ESQUERDA = { x: 340, y: 200 }
const NA_FOLGA_DA_DIREITA = { x: 660, y: 200 }

async function montaMapa(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_alt_medir_grupo', 'E2E Alt medir grupo', 30, 20, 64))
    store.setActiveTool('select')
    const base: Pick<Region, 'tag' | 'fillColor' | 'fillPattern' | 'data'> = { tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
    const retangulo = (minX: number, minY: number, maxX: number, maxY: number) => [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]
    store.addRegion({ ...base, id: 'esquerda', points: retangulo(100, 100, 300, 300), room: { shape: 'rect', name: '' } })
    store.addRegion({ ...base, id: 'meio', points: retangulo(400, 150, 600, 250), room: { shape: 'rect', name: '' } })
    store.addRegion({ ...base, id: 'direita', points: retangulo(700, 100, 900, 300), room: { shape: 'rect', name: '' } })
    store.setSelection([
      { kind: 'region', id: 'esquerda' },
      { kind: 'region', id: 'direita' },
    ])
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

/** As cores de uma faixa VERTICAL de 11 px centrada no ponto de mundo: atravessa a cota deitada. */
async function coresNaColuna(page: Page, mundo: { x: number; y: number }): Promise<Array<{ r: number; g: number; b: number }>> {
  const p = await naPagina(page, mundo)
  const foto = await page.screenshot({ clip: { x: Math.round(p.x), y: Math.round(p.y) - 5, width: 1, height: 11 } })
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const tela = document.createElement('canvas')
    tela.width = bitmap.width
    tela.height = bitmap.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d para ler a foto')
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, 1, bitmap.height)
    const cores: Array<{ r: number; g: number; b: number }> = []
    for (let i = 0; i < bitmap.height; i += 1) cores.push({ r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] })
    return cores
  }, foto.toString('base64'))
}

async function temCotaEm(page: Page, mundo: { x: number; y: number }): Promise<boolean> {
  return (await coresNaColuna(page, mundo)).some(ehMagenta)
}

interface Retrato {
  salas: Region[]
  selecao: string[]
  passosDeDesfazer: number
}

async function retrato(page: Page): Promise<Retrato> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map, selection, past } = mod.useMapStore.getState()
    return { salas: map.regions, selecao: selection.map((s) => s.id), passosDeDesfazer: past.length }
  })
}

/** Põe o mouse sobre a sala do meio com movimento de verdade: é o pointermove ocioso que acha a peça sob ele. */
async function mouseSobreADoMeio(page: Page): Promise<void> {
  const alvo = await naPagina(page, SOBRE_A_DO_MEIO)
  await page.mouse.move(alvo.x - 20, alvo.y)
  await page.mouse.move(alvo.x, alvo.y, { steps: 4 })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await montaMapa(page)
  await mouseSobreADoMeio(page)
  await page.waitForTimeout(PINTURA_MS)
})

test('Alt segurado sobre a sala do meio, dentro da caixa do grupo: depois da janela do toque as folgas dos dois lados ficam magenta; soltar apaga, e o mapa não muda', async ({ page }) => {
  // Controle: sem Alt, nada magenta nas folgas.
  expect(await temCotaEm(page, NA_FOLGA_DA_ESQUERDA)).toBe(false)
  expect(await temCotaEm(page, NA_FOLGA_DA_DIREITA)).toBe(false)
  const antes = await retrato(page)

  // O tempo É o gesto: segurar além da janela do toque, sem mexer o mouse.
  await page.keyboard.down('Alt')
  await page.waitForTimeout(ALT_TOQUE_JANELA_MS + PINTURA_MS)
  expect(await temCotaEm(page, NA_FOLGA_DA_ESQUERDA)).toBe(true)
  expect(await temCotaEm(page, NA_FOLGA_DA_DIREITA)).toBe(true)

  await page.keyboard.up('Alt')
  await page.waitForTimeout(PINTURA_MS)
  expect(await temCotaEm(page, NA_FOLGA_DA_ESQUERDA)).toBe(false)
  expect(await temCotaEm(page, NA_FOLGA_DA_DIREITA)).toBe(false)

  const depois = await retrato(page)
  expect(depois.salas).toEqual(antes.salas)
  expect(depois.selecao).toEqual(['esquerda', 'direita'])
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})

test('com o Alt segurado, a sala do próprio grupo não é medida; de volta à do meio, a medida volta', async ({ page }) => {
  const selecionada = await naPagina(page, SOBRE_A_SELECIONADA)
  const meio = await naPagina(page, SOBRE_A_DO_MEIO)
  await page.keyboard.down('Alt')
  // Mais de 3 px com o Alt apertado: é medir, não toque.
  await page.mouse.move(selecionada.x, selecionada.y, { steps: 6 })
  await page.waitForTimeout(PINTURA_MS)
  expect(await temCotaEm(page, NA_FOLGA_DA_ESQUERDA)).toBe(false)

  await page.mouse.move(meio.x, meio.y, { steps: 6 })
  await page.waitForTimeout(PINTURA_MS)
  expect(await temCotaEm(page, NA_FOLGA_DA_ESQUERDA)).toBe(true)
  await page.keyboard.up('Alt')
})

test('desempenho: passear o mouse dentro da caixa do grupo com o Alt segurado não trava a tela (nenhuma tarefa longa de 200 ms ou mais)', async ({ page }) => {
  await page.evaluate(() => {
    const registro: number[] = []
    Reflect.set(window, '__tarefasLongas', registro)
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) registro.push(entrada.duration)
    }).observe({ type: 'longtask', buffered: false })
    // Intervalo entre quadros enquanto o mouse passeia: o p95 vai anotado no relatório.
    const quadros: number[] = []
    Reflect.set(window, '__quadros', quadros)
    let anterior = performance.now()
    const medir = (agora: number): void => {
      quadros.push(agora - anterior)
      anterior = agora
      if (Reflect.get(window, '__parar') !== true) requestAnimationFrame(medir)
    }
    requestAnimationFrame(medir)
  })
  await page.keyboard.down('Alt')
  // Dentro da caixa do grupo: a do meio, o vão, as duas selecionadas e a do meio de novo. A medida aparece, muda e some.
  for (const ponto of [{ x: 500, y: 200 }, { x: 560, y: 230 }, { x: 350, y: 260 }, { x: 200, y: 200 }, { x: 800, y: 150 }, { x: 450, y: 170 }]) {
    const p = await naPagina(page, ponto)
    await page.mouse.move(p.x, p.y, { steps: 15 })
  }
  await page.keyboard.up('Alt')
  await page.waitForTimeout(PINTURA_MS)
  const { tarefas, quadros } = await page.evaluate(() => {
    Reflect.set(window, '__parar', true)
    const numeros = (valor: unknown): number[] => (Array.isArray(valor) ? valor.filter((d): d is number => typeof d === 'number') : [])
    return { tarefas: numeros(Reflect.get(window, '__tarefasLongas')), quadros: numeros(Reflect.get(window, '__quadros')) }
  })
  const maior = tarefas.length === 0 ? 0 : Math.max(...tarefas)
  const ordenados = [...quadros].sort((a, b) => a - b)
  const p95 = ordenados.length === 0 ? 0 : ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))]
  test.info().annotations.push({
    type: 'fluidez com o Alt segurado dentro da caixa do grupo',
    description: `tarefas longas: ${tarefas.length}, maior ${Math.round(maior)} ms; quadros: ${quadros.length}, p95 ${p95.toFixed(1)} ms`,
  })
  expect(maior).toBeLessThan(200)
})
