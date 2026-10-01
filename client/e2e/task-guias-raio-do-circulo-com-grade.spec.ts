// GUIAS AO DESENHAR, CÍRCULO COM A GRADE LIGADA (pedido 3 de 30/09/2026,
// PEDIDOS.md; correção da fatia 4). O centro do Círculo vai para a grade, mas
// o ponto do raio nunca teve grade. Com a grade de parede ligada, a regra da
// grade (guia só no alinhamento exato) valia também para o raio, que então
// ficava sem grade E sem guia: puxado a 3 px da borda da vizinha, não
// encaixava e nenhuma guia aparecia. A grade não manda num ponto que ela não
// tocou: ali a guia encaixa.
//
// COMO PROVA. Gesto de ponteiro de verdade no canvas, o círculo pela store e a
// guia pela foto da página (a mesma régua de pixel de
// task-guias-ao-desenhar.spec.ts), com o renderer WebGL de verdade.
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

/** A vizinha fora da grade: borda direita em x = 963, que a grade nunca daria. */
const VIZINHA = { minX: 643, maxX: 963, minY: 100, maxY: 250 }
/** O centro cai no vértice (704, 448) da grade. */
const CENTRO_PUXADO = { x: 706, y: 446 }
const CENTRO = { x: 704, y: 448 }
/** O raio puxado a 3 px da borda da vizinha (x = 963) e a 3 px da reta do centro (y = 448). */
const RAIO_PUXADO = { x: 966, y: 451 }
/** Na guia vertical x = 963, entre a vizinha (acaba em y = 250) e o ponto do raio (y = 448). */
const NA_GUIA = { x: 963, y: 350 }

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

/** Mapa vazio com a vizinha e a grade LIGADA: é o caso que estava quebrado. */
async function montaMapaComGrade(page: Page, sala: { region: Region; walls: Wall[] }): Promise<void> {
  await page.evaluate(
    async ({ sala, grade }) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mod = await import('/src/stores/mapStore.ts')
      const store = mod.useMapStore.getState()
      const vazio: MapData = mapFactory.createEmptyMap('map_e2e_guias_raio_circulo', 'E2E Guias no raio do Círculo', 30, 20, grade)
      store.loadMap({ ...vazio, regions: [sala.region], walls: sala.walls })
      store.setActiveTool('select')
      store.setSnapEnabled(true)
    },
    { sala, grade: GRADE },
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

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('grade ligada: o raio do Círculo a 3 px da borda da vizinha encaixa nela, a guia magenta aparece e o círculo nasce com o raio encaixado', async ({ page }) => {
  await montaMapaComGrade(page, salaRetangular('vizinha', VIZINHA.minX, VIZINHA.minY, VIZINHA.maxX, VIZINHA.maxY))
  await pickTool(page, 'Círculo')
  await page.waitForTimeout(PINTURA_MS)
  // Controle: antes do gesto, nada magenta onde a guia vai aparecer.
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)

  const a = await naPagina(page, CENTRO_PUXADO)
  const b = await naPagina(page, RAIO_PUXADO)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 12 })
  await page.waitForTimeout(PINTURA_MS)
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(true)
  // Foto do gesto como evidência (pasta temporária da corrida, fora do repositório).
  await page.screenshot({ path: test.info().outputPath('raio-do-circulo-encaixa-com-grade.png') })

  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  // Soltou: o centro ficou na grade e o raio vai até (963, 448), os dois eixos
  // encaixados — o que se viu no arrasto é o que fica. E a guia some.
  const circulo = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.drawings.at(-1) ?? null
  })
  expect(circulo).toMatchObject({ kind: 'circle', cx: CENTRO.x, cy: CENTRO.y })
  if (circulo === null || circulo.kind !== 'circle') throw new Error('a ferramenta Círculo não criou o círculo')
  expect(circulo.radius).toBeCloseTo(VIZINHA.maxX - CENTRO.x)
  expect((await coresEm(page, NA_GUIA)).some(ehMagenta)).toBe(false)
})
