// MT12, A VERSÃO EM LINHAS NO EDITOR DE VERDADE (Chromium, Vite dev, só PC).
// Desde a MT12 o Meio-Termo é o padrão: o app abre SEM `?obra` e os móveis de
// antes saem com textura. O "Desenho" do painel do móvel (Textura | Linhas)
// troca a mesa para o desenho de antes: a tela muda, o mapa grava
// `mobiliaDesenho: 'linhas'` e Ctrl+Z volta à textura. Nenhuma tarefa longa
// >= 200 ms nos cliques. PROVA de layout (só com GERAR_PROVAS_MT12=1): o
// painel do móvel com o "Desenho".
import { test, expect, type Page } from '@playwright/test'
import { addProp, createEmptyMap, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { serializeMap } from '../src/lib/mapFile'
import { MATERIAIS } from '../src/texturas/meioTermo/materiais'
import type { MapData, Prop, Region, RegionPoint, TipoMobilia, Wall } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

const GRADE = 64
const COLUNAS = 16
const LINHAS = 10
const TETO_DA_TAREFA_LONGA_MS = 200
/** Diferença de canal (0-255) a partir da qual o pixel "mudou". */
const MUDOU = 8
/** A mesa de 2 x 1 casas a 1:1 tem 8192 px; trocar o desenho tem de mudar boa parte dela. */
const MINIMO_DE_PIXELS_QUE_MUDAM = 1500
const PASTA_DO_MESTRE = 'C:/appdata/maps/map_mt12'
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT12 === '1'
const PROVA_DO_PAINEL = '../docs/design/objetos/provas/mt12-painel-desenho.png'

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

type Png = Awaited<ReturnType<Page['screenshot']>>

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function sala(): MapData {
  const g = (casas: number): number => casas * GRADE
  let map = setShowGrid(createEmptyMap('mt12-editor', 'Taverna', COLUNAS, LINHAS, GRADE), false)
  const regiao: Region = { id: 'taverna', points: anel(g(1), g(1), g(15), g(9)), tag: '', fillColor: '#6b5a48', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Taverna' } }
  map = {
    ...map,
    regions: [regiao],
    walls: [parede('n', g(1), g(1), g(15), g(1)), parede('s', g(1), g(9), g(15), g(9)), parede('o', g(1), g(1), g(1), g(9)), parede('l', g(15), g(1), g(15), g(9))],
  }
  const poe = (tipo: TipoMobilia, x: number, y: number, extra: Partial<Prop> = {}): void => {
    map = addProp(map, { ...criarMovel(tipo, { x: g(x), y: g(y) }, GRADE, `${tipo}-${x}-${y}`), ...extra })
  }
  poe('mesa', 8, 5, { width: g(2), height: g(1), mobiliaCor: MATERIAIS.carvalho.hex })
  poe('cadeira', 7.5, 4.2)
  poe('catre', 3, 3)
  poe('barril', 13, 3)
  return map
}

function discoDoMestre(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_mt12', name: 'Taverna', startSceneId: 'scene_mt12', scenes: [{ id: 'scene_mt12', name: 'Taverna', file: 'map.json' }] }
  return { [`${PASTA_DO_MESTRE}/map.json`]: serializeMap(sala()), [`${PASTA_DO_MESTRE}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

async function observarTarefasLongas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const longas: number[] = []
    Object.defineProperty(window, '__tarefasLongasMt12', { value: longas })
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) longas.push(e.startTime, e.duration)
    }).observe({ type: 'longtask', buffered: true })
  })
}

async function maiorTarefaLonga(page: Page, desde: number): Promise<number> {
  const pares = await page.evaluate(() => {
    const v: unknown = Reflect.get(window, '__tarefasLongasMt12')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  })
  let maior = 0
  for (let i = 0; i + 1 < pares.length; i += 2) if (pares[i] >= desde) maior = Math.max(maior, pares[i + 1])
  return maior
}

async function fotoParada(page: Page): Promise<Png> {
  const canvas = page.locator('canvas').first()
  let anterior = await canvas.screenshot({ animations: 'disabled' })
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(150)
    const atual = await canvas.screenshot({ animations: 'disabled' })
    if (atual.equals(anterior)) return atual
    anterior = atual
  }
  return anterior
}

async function pixelsQueMudam(page: Page, a: Png, b: Png): Promise<number> {
  return page.evaluate(
    async ([pngA, pngB, mudou]) => {
      const ler = async (png: string): Promise<ImageData> => {
        const imagem = new Image()
        imagem.src = `data:image/png;base64,${png}`
        await imagem.decode()
        const tela = document.createElement('canvas')
        tela.width = imagem.width
        tela.height = imagem.height
        const g = tela.getContext('2d')
        if (g === null) throw new Error('sem 2D')
        g.drawImage(imagem, 0, 0)
        return g.getImageData(0, 0, imagem.width, imagem.height)
      }
      const [x, y] = await Promise.all([ler(pngA), ler(pngB)])
      if (x.width !== y.width || x.height !== y.height) return Number.POSITIVE_INFINITY
      let n = 0
      for (let i = 0; i < x.data.length; i += 4) {
        if (Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2])) >= mudou) n += 1
      }
      return n
    },
    [a.toString('base64'), b.toString('base64'), MUDOU] as const,
  )
}

async function desenhoNaStore(page: Page): Promise<string | null> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.props.find((p) => p.id === 'mesa-8-5')?.mobiliaDesenho ?? null)
}

test('editor sem ?obra (o padrão da MT12): "Desenho" troca a mesa para linhas, grava no mapa e volta com Ctrl+Z; nenhuma tarefa de 200 ms', async ({ page }) => {
  test.setTimeout(180_000)
  await observarTarefasLongas(page)
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Taverna', 'MT12A')
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'prop', id: 'mesa-8-5' }])
  })
  const desenho = page.getByRole('radiogroup', { name: 'Desenho' })
  await expect(desenho).toBeVisible()
  const textura = desenho.getByRole('radio', { name: 'Textura' })
  const linhas = desenho.getByRole('radio', { name: 'Linhas' })
  await expect(textura).toHaveAttribute('aria-checked', 'true')
  if (GERAR_PROVAS) await page.locator('aside').first().screenshot({ path: PROVA_DO_PAINEL })

  const antes = await fotoParada(page)
  const noClique = await page.evaluate(() => performance.now())
  await linhas.click()
  await expect.poll(() => desenhoNaStore(page)).toBe('linhas')
  await expect(linhas).toHaveAttribute('aria-checked', 'true')
  const emLinhas = await fotoParada(page)
  const mudou = await pixelsQueMudam(page, antes, emLinhas)

  await page.keyboard.press('Control+z')
  await expect.poll(() => desenhoNaStore(page)).toBeNull()
  await expect(textura).toHaveAttribute('aria-checked', 'true')
  const desfeita = await fotoParada(page)
  const sobrou = await pixelsQueMudam(page, antes, desfeita)
  const maior = await maiorTarefaLonga(page, noClique)
  console.log(`[medida] editor: Linhas muda ${mudou} px do canvas; depois do Ctrl+Z sobram ${sobrou} px; maior tarefa longa nos cliques ${maior.toFixed(0)} ms`)
  expect(mudou).toBeGreaterThan(MINIMO_DE_PIXELS_QUE_MUDAM)
  expect(sobrou).toBeLessThan(MINIMO_DE_PIXELS_QUE_MUDAM / 20)
  expect(maior).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
})
