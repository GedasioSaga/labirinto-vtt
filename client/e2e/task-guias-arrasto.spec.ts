// GUIAS ESTILO FIGMA, FATIA 2 (pedido 3 de 30/09/2026, PEDIDOS.md): todo
// arrasto de corpo e de ponto encaixa pela BORDA ou pelo CENTRO da caixa das
// vizinhas, com a guia magenta fina enquanto o botão está apertado.
//
// O caso é o da imagem do pedido: o corredor de DUAS LINHAS que liga a sala
// central a uma sala redonda. O mestre laça as duas linhas e arrasta o par até
// o centro da redonda; depois puxa a ponta de uma linha até a altura do centro
// dela. Antes, a seleção de vários não tinha guia nenhuma, e a ponta da linha
// também não.
//
// COMO PROVA. Gesto de ponteiro de verdade no canvas e régua de pixel na foto
// da página (o PNG é decodificado pelo próprio navegador), como em
// task-guias-figma.spec.ts: a guia é cobrada onde o olho a vê, com o WebGL de
// verdade. A store só monta o mapa e confere onde as peças foram parar.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Drawing, Region } from '../src/types/map'

/** `SMART_GUIDE_COLOR` (src/pixi/constants.ts): 0xff4fd8. */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 200 && cor.g <= 150 && cor.b >= 150
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

/** Sala redonda: centro (800, 250), raio 100 → caixa [700..900] × [150..350]. */
const CENTRO_DA_REDONDA = { x: 800, y: 250 }
/** As duas linhas do corredor, em x = 480 e x = 520, de y = 480 a 680: centro da união em (500, 580). */
const CENTRO_DO_CORREDOR = { x: 500, y: 580 }

async function montaMapa(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const store = mod.useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_guias_arrasto', 'E2E Guias arrasto', 30, 20, 64))
    store.setActiveTool('select')
    const lados = 24
    const redonda = Array.from({ length: lados }, (_, i) => ({
      x: 800 + 100 * Math.cos((2 * Math.PI * i) / lados),
      y: 250 + 100 * Math.sin((2 * Math.PI * i) / lados),
    }))
    const base: Pick<Region, 'tag' | 'fillColor' | 'fillPattern' | 'data'> = { tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
    store.addRegion({ ...base, id: 'redonda', points: redonda, room: { shape: 'polygon', name: '' } })
    const linha = (id: string, x: number): Drawing => ({ id, kind: 'line', x1: x, y1: 480, x2: x, y2: 680, color: '#ffffff', width: 2 })
    store.addDrawing(linha('corredor-a', 480))
    store.addDrawing(linha('corredor-b', 520))
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

/** As cores de uma faixa de 11 px centrada no ponto de mundo: deitada para cruzar guia em pé, em pé para cruzar guia deitada. */
async function coresEm(page: Page, mundo: { x: number; y: number }, faixa: 'deitada' | 'em-pe'): Promise<Array<{ r: number; g: number; b: number }>> {
  const p = await naPagina(page, mundo)
  const clip =
    faixa === 'deitada'
      ? { x: Math.round(p.x) - 5, y: Math.round(p.y), width: 11, height: 1 }
      : { x: Math.round(p.x), y: Math.round(p.y) - 5, width: 1, height: 11 }
  const foto = await page.screenshot({ clip })
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const tela = document.createElement('canvas')
    tela.width = bitmap.width
    tela.height = bitmap.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d para ler a foto')
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    const cores: Array<{ r: number; g: number; b: number }> = []
    for (let i = 0; i < data.length; i += 4) cores.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    return cores
  }, foto.toString('base64'))
}

async function linhas(page: Page): Promise<Record<string, { x1: number; y1: number; x2: number; y2: number }>> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const saida: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {}
    for (const d of mod.useMapStore.getState().map.drawings) {
      if (d.kind === 'line') saida[d.id] = { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 }
    }
    return saida
  })
}

async function selecao(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection.map((item) => item.id)
  })
}

/** Laça as duas linhas do corredor com a Selecionar: arrasto no vazio, da esquerda para a direita (contenção). */
async function lacaOCorredor(page: Page): Promise<void> {
  const de = await naPagina(page, { x: 440, y: 460 })
  const ate = await naPagina(page, { x: 560, y: 700 })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(ate.x, ate.y, { steps: 8 })
  await page.mouse.up()
  expect((await selecao(page)).sort()).toEqual(['corredor-a', 'corredor-b'])
}

/** Entre a redonda (acaba em y = 350) e o corredor (começa em y = 480), na vertical do centro da redonda. */
const NA_GUIA_DO_CORREDOR = { x: CENTRO_DA_REDONDA.x, y: 415 }

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await montaMapa(page)
})

test('o corredor de duas linhas, laçado e arrastado, encaixa pelo centro da união no centro da sala redonda; a guia some ao soltar e Ctrl+Z desfaz num passo', async ({ page }) => {
  await lacaOCorredor(page)
  await page.waitForTimeout(PINTURA_MS)
  // Controle: antes do arrasto, nada magenta entre as peças.
  expect((await coresEm(page, NA_GUIA_DO_CORREDOR, 'deitada')).some(ehMagenta)).toBe(false)

  const de = await naPagina(page, CENTRO_DO_CORREDOR)
  // +303: o centro da união (500) vai a 803, 3 px do centro da redonda.
  const para = await naPagina(page, { x: CENTRO_DO_CORREDOR.x + 303, y: CENTRO_DO_CORREDOR.y })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)

  const presas = await linhas(page)
  expect(presas['corredor-a']).toEqual({ x1: 780, y1: 480, x2: 780, y2: 680 })
  expect(presas['corredor-b']).toEqual({ x1: 820, y1: 480, x2: 820, y2: 680 })
  expect((await coresEm(page, NA_GUIA_DO_CORREDOR, 'deitada')).some(ehMagenta)).toBe(true)

  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  expect((await linhas(page))['corredor-a'].x1).toBe(780)
  expect((await coresEm(page, NA_GUIA_DO_CORREDOR, 'deitada')).some(ehMagenta)).toBe(false)

  await page.keyboard.press('Control+z')
  const desfeitas = await linhas(page)
  expect(desfeitas['corredor-a'].x1).toBe(480)
  expect(desfeitas['corredor-b'].x1).toBe(520)
})

test('a ponta de uma linha puxada até 3 px da altura do centro da redonda encaixa nela, com a guia deitada até a sala', async ({ page }) => {
  // Seleciona a linha da esquerda clicando no corpo dela, longe das pontas.
  const corpo = await naPagina(page, { x: 480, y: 580 })
  await page.mouse.click(corpo.x, corpo.y)
  expect(await selecao(page)).toEqual(['corredor-a'])

  const ponta = await naPagina(page, { x: 480, y: 480 })
  const para = await naPagina(page, { x: 560, y: CENTRO_DA_REDONDA.y + 3 })
  await page.mouse.move(ponta.x, ponta.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)

  expect((await linhas(page))['corredor-a']).toEqual({ x1: 560, y1: CENTRO_DA_REDONDA.y, x2: 480, y2: 680 })
  // Guia deitada em y = 250, da ponta (x = 560) até o centro da redonda (x = 800).
  expect((await coresEm(page, { x: 650, y: CENTRO_DA_REDONDA.y }, 'em-pe')).some(ehMagenta)).toBe(true)
  await page.mouse.up()
})

test('desempenho: arrastar o corredor laçado por cima do encaixe não trava a tela (nenhuma tarefa longa de 200 ms ou mais)', async ({ page }) => {
  await lacaOCorredor(page)
  await page.evaluate(() => {
    const registro: number[] = []
    Reflect.set(window, '__tarefasLongas', registro)
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) registro.push(entrada.duration)
    }).observe({ type: 'longtask', buffered: false })
    // Intervalo entre quadros durante o gesto: só para a anotação (o tempo do navegador sem tela varia).
    const quadros: number[] = []
    Reflect.set(window, '__quadros', quadros)
    let anterior = performance.now()
    const conta = (agora: number): void => {
      quadros.push(agora - anterior)
      anterior = agora
      if (Reflect.get(window, '__quadros') === quadros) requestAnimationFrame(conta)
    }
    requestAnimationFrame(conta)
  })
  const de = await naPagina(page, CENTRO_DO_CORREDOR)
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  // Vai e volta por cima do encaixe: entra e sai da tolerância várias vezes.
  for (const dx of [280, 303, 320, 297, 303]) {
    const para = await naPagina(page, { x: CENTRO_DO_CORREDOR.x + dx, y: CENTRO_DO_CORREDOR.y })
    await page.mouse.move(para.x, para.y, { steps: 15 })
  }
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  const { tarefas, quadros } = await page.evaluate(() => {
    const numeros = (chave: string): number[] => {
      const lista = Reflect.get(window, chave)
      return Array.isArray(lista) ? lista.filter((d): d is number => typeof d === 'number') : []
    }
    const medidos = { tarefas: numeros('__tarefasLongas'), quadros: numeros('__quadros') }
    // Para a contagem de quadros: o `conta` só se reagenda enquanto a lista dele é a da janela.
    Reflect.set(window, '__quadros', null)
    return medidos
  })
  const maior = tarefas.length === 0 ? 0 : Math.max(...tarefas)
  const ordenados = [...quadros].sort((a, b) => a - b)
  const p95 = ordenados.length === 0 ? 0 : ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))]
  test.info().annotations.push({ type: 'tarefas longas no arrasto (ms)', description: `${tarefas.length} tarefa(s); maior ${Math.round(maior)} ms` })
  test.info().annotations.push({ type: 'quadros no arrasto (ms)', description: `${quadros.length} quadros; p95 ${p95.toFixed(1)} ms; maior ${(ordenados.at(-1) ?? 0).toFixed(1)} ms` })
  expect(maior).toBeLessThan(200)
})
