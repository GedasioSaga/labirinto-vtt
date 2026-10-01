// GUIAS ESTILO FIGMA, FATIA 5 (pedido 3 de 30/09/2026, PEDIDOS.md): com uma
// sala selecionada, SEGURAR o Alt com o mouse sobre outra sala mostra a
// distância entre as duas, numa cota magenta com o número. Soltar o Alt apaga.
// Medir é só olhar: o mapa não muda e nada entra no desfazer.
//
// O Alt é dividido com o pedido 5 pela régua de `lib/toqueDeAlt.ts`: o TOQUE
// curto é do endireitar, e só depois da janela do toque o Alt mede. Clique no
// meio do Alt cancela a medida (é o Alt+clique de outra coisa).
//
// COMO PROVA. Teclado e mouse de verdade, e régua de pixel na foto da página
// (o PNG é decodificado pelo próprio navegador): a cota é cobrada onde o olho a
// vê, com o renderer WebGL de verdade. A store só monta o mapa e confere que
// ele não mudou.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { ALT_TOQUE_JANELA_MS } from '../src/lib/toqueDeAlt'
import type { Region } from '../src/types/map'

/**
 * `SMART_GUIDE_COLOR` (src/pixi/constants.ts): 0xff4fd8. A cota deitada de 1 px
 * sai na foto como (193, 60, 163), não com a cor cheia: medido neste spec em
 * 01/10/2026, a mesma cota do vão das guias (fatia 3). O limiar aceita isso e
 * ainda separa do fundo (cinza), do chão da sala (168, 119, 106) e do amarelo
 * da seleção (verde alto).
 */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 150 && cor.b >= 120 && cor.g <= 110 && cor.r - cor.g >= 100
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

/**
 * Sala selecionada [100..300] x [100..300] e a outra [500..700] x [150..250]:
 * a faixa em comum na vertical é 150..250, e a cota vai de x = 300 a x = 500 na
 * altura do meio dela, y = 200. O número fica no meio da cota (x = 400).
 */
const SOBRE_A_OUTRA = { x: 600, y: 200 }
/** Na cota, longe da pílula do número. */
const NA_COTA = { x: 340, y: 200 }

async function montaMapa(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_alt_medir', 'E2E Alt medir', 30, 20, 64))
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

async function temCota(page: Page): Promise<boolean> {
  return (await coresNaColuna(page, NA_COTA)).some(ehMagenta)
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

/** Põe o mouse sobre a outra sala com movimento de verdade: é o pointermove ocioso que acha a peça sob ele. */
async function mouseSobreAOutra(page: Page): Promise<void> {
  const alvo = await naPagina(page, SOBRE_A_OUTRA)
  await page.mouse.move(alvo.x - 20, alvo.y)
  await page.mouse.move(alvo.x, alvo.y, { steps: 4 })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await montaMapa(page)
  await mouseSobreAOutra(page)
  await page.waitForTimeout(PINTURA_MS)
})

test('Alt segurado com o mouse parado sobre a outra sala: depois da janela do toque aparece a cota magenta; soltar apaga, e o mapa não muda', async ({ page }) => {
  // Controle: sem Alt, nada magenta entre as salas.
  expect(await temCota(page)).toBe(false)
  const antes = await retrato(page)

  const desceu = Date.now()
  await page.keyboard.down('Alt')
  // Dentro da janela do toque o Alt ainda pode ser o toque que endireita: nada de medida.
  await page.waitForTimeout(100)
  const cedo = await temCota(page)
  const cedoEm = Date.now() - desceu
  // Só vale se a foto saiu mesmo dentro da janela (máquina carregada pode atrasar a foto).
  if (cedoEm < ALT_TOQUE_JANELA_MS - 100) expect(cedo).toBe(false)
  else test.info().annotations.push({ type: 'janela do toque', description: `foto tardia (${cedoEm} ms): conferência do "ainda não mede" pulada` })

  // O tempo É o gesto: segurar além da janela, sem mexer o mouse.
  await page.waitForTimeout(ALT_TOQUE_JANELA_MS + PINTURA_MS)
  expect(await temCota(page)).toBe(true)

  await page.keyboard.up('Alt')
  await page.waitForTimeout(PINTURA_MS)
  expect(await temCota(page)).toBe(false)

  const depois = await retrato(page)
  expect(depois.salas).toEqual(antes.salas)
  expect(depois.selecao).toEqual(['selecionada'])
  expect(depois.passosDeDesfazer).toBe(antes.passosDeDesfazer)
})

test('mexer o mouse com o Alt apertado mede na hora; clique do botão do meio no meio do Alt cancela, e a medida só volta num Alt novo', async ({ page }) => {
  const alvo = await naPagina(page, SOBRE_A_OUTRA)
  await page.keyboard.down('Alt')
  // Mais de 3 px com o Alt apertado: é medir, não toque.
  await page.mouse.move(alvo.x + 15, alvo.y + 5, { steps: 3 })
  await page.waitForTimeout(PINTURA_MS)
  expect(await temCota(page)).toBe(true)

  // Clique (botão do meio, que só move a vista e não mexe no mapa) com o Alt ainda apertado.
  await page.mouse.down({ button: 'middle' })
  await page.mouse.up({ button: 'middle' })
  await page.mouse.move(alvo.x, alvo.y, { steps: 3 })
  await page.waitForTimeout(ALT_TOQUE_JANELA_MS + PINTURA_MS)
  expect(await temCota(page)).toBe(false)
  await page.keyboard.up('Alt')

  // Um Alt novo mede de novo.
  await page.keyboard.down('Alt')
  await page.mouse.move(alvo.x + 15, alvo.y, { steps: 3 })
  await page.waitForTimeout(PINTURA_MS)
  expect(await temCota(page)).toBe(true)
  await page.keyboard.up('Alt')
})

test('sem nada selecionado, o Alt segurado não mede nada', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSelection([])
  })
  await mouseSobreAOutra(page)
  await page.keyboard.down('Alt')
  await page.waitForTimeout(ALT_TOQUE_JANELA_MS + PINTURA_MS)
  expect(await temCota(page)).toBe(false)
  await page.keyboard.up('Alt')
})

test('desempenho: passear o mouse pelo mapa com o Alt segurado não trava a tela (nenhuma tarefa longa de 200 ms ou mais)', async ({ page }) => {
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
  // Entra e sai da outra sala, passa pelo vazio e pela selecionada: a medida aparece, muda e some.
  for (const ponto of [{ x: 600, y: 200 }, { x: 650, y: 230 }, { x: 420, y: 400 }, { x: 200, y: 200 }, { x: 560, y: 170 }]) {
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
    type: 'fluidez com o Alt segurado',
    description: `tarefas longas: ${tarefas.length}, maior ${Math.round(maior)} ms; quadros: ${quadros.length}, p95 ${p95.toFixed(1)} ms`,
  })
  expect(maior).toBeLessThan(200)
})
