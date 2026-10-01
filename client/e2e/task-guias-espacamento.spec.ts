// GUIAS ESTILO FIGMA, FATIA 3 (pedido 3 de 30/09/2026, PEDIDOS.md): com três
// salas em fileira, arrastar a última até perto do ponto em que os vãos ficam
// iguais faz a sala ENCAIXAR no espaçamento igual, e cada vão ganha o número
// dele numa pílula magenta, na unidade do mapa, enquanto o botão está apertado.
//
// COMO PROVA. Gesto de ponteiro de verdade no canvas e régua de pixel na foto
// da página (o PNG é decodificado pelo próprio navegador), como em
// task-guias-figma.spec.ts: a pílula é cobrada onde o olho a vê, com o WebGL de
// verdade. A store só monta o mapa e confere onde a sala foi parar.
//
// O caso é o da imagem do pedido: salas em volta, com vãos desencontrados. A e
// B ficam a 128 px uma da outra; M começa a 216 px de B e é arrastada até 3 px
// do vão igual (128 px = 2 células de 64 = "3,0 m" na escala padrão). A
// fileira começa em x = 350: o painel da esquerda cobre o canvas até ~280 px.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Region } from '../src/types/map'

/** `SMART_GUIDE_LABEL_COLOR` (src/pixi/constants.ts): 0xd600a8; também aceita o magenta da guia. */
function ehMagenta(cor: { r: number; g: number; b: number }): boolean {
  return cor.r >= 200 && cor.g <= 150 && cor.b >= 150
}

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300

/** Fileira em y = 400..528. */
const TOPO = 400
const BASE = 528
const MEIO_DA_FILEIRA = (TOPO + BASE) / 2
/** A em 350..478, B em 606..734 (vão de 128), M em 950..1078 (216 depois de B). */
const SALAS: Record<'a' | 'b' | 'm', [number, number]> = { a: [350, 478], b: [606, 734], m: [950, 1078] }
/** Pega-se M perto do canto, longe do nome (que mora no meio). */
const PEGA = { x: 960, y: 410 }
/** -85: a borda esquerda de M vai de 950 a 865, a 3 px de 862 (= 734 + 128). */
const ARRASTO = -85
const BORDA_ENCAIXADA = 862
/** Meio de cada vão quando M encaixa: A→B (478..606) e B→M (734..862). */
const MEIO_DO_VAO_AB = { x: 542, y: MEIO_DA_FILEIRA }
const MEIO_DO_VAO_BM = { x: 798, y: MEIO_DA_FILEIRA }
/**
 * Linha da foto que corta a pílula abaixo das letras: o número (11 px) fica no
 * meio da pílula de 17 px de altura; 6,5 px abaixo do meio é pílula, sem
 * letra e sem a cota (que passa no meio).
 */
const ABAIXO_DAS_LETRAS_PX = 6.5

async function montaMapa(page: Page): Promise<void> {
  await page.evaluate(
    async ({ topo, base, salas }) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mod = await import('/src/stores/mapStore.ts')
      const store = mod.useMapStore.getState()
      store.loadMap(mapFactory.createEmptyMap('map_e2e_espacamento', 'E2E Espaçamento', 30, 20, 64))
      store.setActiveTool('select')
      const base0: Pick<Region, 'tag' | 'fillColor' | 'fillPattern' | 'data'> = { tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
      const sala = (id: string, minX: number, maxX: number) =>
        store.addRegion({
          ...base0,
          id,
          points: [
            { x: minX, y: topo },
            { x: maxX, y: topo },
            { x: maxX, y: base },
            { x: minX, y: base },
          ],
          room: { shape: 'rect', name: '' },
        })
      for (const [id, [minX, maxX]] of Object.entries(salas)) sala(id, minX, maxX)
    },
    { topo: TOPO, base: BASE, salas: SALAS },
  )
}

/** Ponto de mundo em px de página, pela câmera de agora, mais um desvio em px de TELA. */
async function naPagina(page: Page, mundo: { x: number; y: number }, desvioY = 0): Promise<{ x: number; y: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const camera = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().camera
  })
  return { x: caixa.x + camera.x + mundo.x * camera.scale, y: caixa.y + camera.y + mundo.y * camera.scale + desvioY }
}

/** As cores de uma faixa horizontal de 11 px centrada no ponto (mundo + desvio de tela). */
async function coresEm(page: Page, mundo: { x: number; y: number }, desvioY = 0): Promise<Array<{ r: number; g: number; b: number }>> {
  const p = await naPagina(page, mundo, desvioY)
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

/** Toda a faixa é pílula: magenta de ponta a ponta, sem o fundo escuro aparecendo. */
async function pilulaEm(page: Page, mundo: { x: number; y: number }): Promise<boolean> {
  return (await coresEm(page, mundo, ABAIXO_DAS_LETRAS_PX)).every(ehMagenta)
}

async function bordaEsquerdaDeM(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const sala = mod.useMapStore.getState().map.regions.find((r) => r.id === 'm')
    if (!sala) throw new Error('sem a sala m')
    return Math.min(...sala.points.map((p) => p.x))
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await montaMapa(page)
})

test('a sala arrastada até 3 px do vão igual encaixa nele, e os dois vãos mostram o número numa pílula magenta até soltar', async ({ page }) => {
  // Controle: antes do gesto, nenhuma pílula nos vãos.
  await page.waitForTimeout(PINTURA_MS)
  expect(await pilulaEm(page, MEIO_DO_VAO_AB)).toBe(false)
  expect(await pilulaEm(page, MEIO_DO_VAO_BM)).toBe(false)

  const de = await naPagina(page, PEGA)
  const para = await naPagina(page, { x: PEGA.x + ARRASTO, y: PEGA.y })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)

  expect(await bordaEsquerdaDeM(page)).toBe(BORDA_ENCAIXADA)
  expect(await pilulaEm(page, MEIO_DO_VAO_AB)).toBe(true)
  expect(await pilulaEm(page, MEIO_DO_VAO_BM)).toBe(true)
  // Foto do gesto como evidência (pasta temporária da corrida, fora do repositório).
  await page.screenshot({ path: test.info().outputPath('espacamento-igual.png') })

  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  // Soltou: a posição encaixada fica, e os números somem.
  expect(await bordaEsquerdaDeM(page)).toBe(BORDA_ENCAIXADA)
  expect(await pilulaEm(page, MEIO_DO_VAO_AB)).toBe(false)
  expect(await pilulaEm(page, MEIO_DO_VAO_BM)).toBe(false)
})

test('com Ctrl a sala anda livre: fica a 3 px do vão igual e nenhum número aparece', async ({ page }) => {
  const de = await naPagina(page, PEGA)
  const para = await naPagina(page, { x: PEGA.x + ARRASTO, y: PEGA.y })
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  // Ctrl só depois do botão descer: Ctrl no pointerdown abre o laço de seleção.
  await page.keyboard.down('Control')
  await page.mouse.move(para.x, para.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)
  expect(await bordaEsquerdaDeM(page)).toBe(BORDA_ENCAIXADA + 3)
  expect(await pilulaEm(page, MEIO_DO_VAO_AB)).toBe(false)
  await page.mouse.up()
  await page.keyboard.up('Control')
})

test('desempenho: arrastar por cima do encaixe, com os números entrando e saindo, não trava a tela (nenhuma tarefa longa de 200 ms ou mais)', async ({ page }) => {
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
  // Vai e volta por cima do vão igual: entra e sai da tolerância várias vezes.
  for (const dx of [-60, ARRASTO, -110, -88, ARRASTO]) {
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
