// DESEMPENHO DA PILHA DE CAMADAS (fase 3, fatia 3: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// Medida, antes e depois do render por faixas, num mapa denso montado por
// código (60 salas com paredes, 240 móveis, 60 fichas, 30 luzes, 10 escadas e
// 20 desenhos): pan e zoom pela câmera da store, um quadro por passo, e
// repintura ligando e desligando a visibilidade de camadas. Junta o intervalo
// entre quadros (p95), as tarefas longas (>= 50 ms, pelo PerformanceObserver)
// e o custo síncrono de cada troca de visibilidade (a store avisa o canvas na
// mesma chamada). Rodar com `--workers=1`: com a máquina dividida, os números
// são da máquina, não do app.
//
// SÓ a tarefa longa é portão (nenhuma >= 200 ms). Quadro e custo da troca são
// impressos para comparar antes e depois: o intervalo de quadro no Chromium
// sem tela anda em degraus de 16,7 ms.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { buildFreehandDrawing, buildLightAt, buildRoomFromDraft } from '../src/lib/drawingFactory'
import { addDrawing, addLight, addProp, addRoom, addStair, addToken, createEmptyMap } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { buildStairFromDraft } from '../src/lib/stairs'
import type { MapData } from '../src/types/map'

const GRADE = 64
const COLUNAS_DE_SALAS = 10
const LINHAS_DE_SALAS = 6
const PASSO = 6
const TAREFA_LONGA_MAXIMA_MS = 200

test.use({ viewport: { width: 1440, height: 900 }, trace: 'off', video: 'off' })

function mapaDenso(): MapData {
  let map = createEmptyMap('desempenho-camadas', 'Denso', COLUNAS_DE_SALAS * PASSO + 1, LINHAS_DE_SALAS * PASSO + 1, GRADE)
  const moveis = ['mesa', 'cadeira', 'bau', 'barril'] as const
  for (let r = 0; r < LINHAS_DE_SALAS; r++) {
    for (let c = 0; c < COLUNAS_DE_SALAS; c++) {
      const n = r * COLUNAS_DE_SALAS + c
      const x0 = (c * PASSO + 1) * GRADE
      const y0 = (r * PASSO + 1) * GRADE
      const fim = { x: x0 + 5 * GRADE, y: y0 + 5 * GRADE }
      const sala = buildRoomFromDraft(`r${n}`, [`w${n}-0`, `w${n}-1`, `w${n}-2`, `w${n}-3`], { x: x0, y: y0 }, fim, undefined, undefined, `Sala ${n}`)
      map = addRoom(map, sala.region, sala.walls)
      moveis.forEach((tipo, k) => {
        map = addProp(map, criarMovel(tipo, { x: x0 + (1 + k) * GRADE, y: y0 + 2 * GRADE }, GRADE, `o${n}-${k}`))
      })
      map = addToken(map, { id: `t${n}`, characterId: null, name: `F${n}`, x: x0 + 3 * GRADE, y: y0 + 4 * GRADE, size: 1, image: null })
      if (n % 2 === 0) map = addLight(map, buildLightAt(`l${n}`, { x: x0 + GRADE, y: y0 + GRADE }, GRADE))
      if (n % 6 === 0) map = addStair(map, buildStairFromDraft(`s${n}`, { x: x0 + 4 * GRADE, y: y0 + GRADE }, { x: x0 + 4 * GRADE, y: y0 + 3 * GRADE }, 6))
      if (n % 3 === 0) {
        map = addDrawing(map, buildFreehandDrawing(`d${n}`, [{ x: x0, y: y0 }, { x: x0 + 2 * GRADE, y: y0 + GRADE }, { x: fim.x, y: fim.y }], '#c0392b', 4))
      }
    }
  }
  return map
}

async function instalarColetor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as { __longas?: number[][]; __quadros?: number[][] }
    const longas: number[][] = []
    const quadros: number[][] = []
    alvo.__longas = longas
    alvo.__quadros = quadros
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push([e.startTime, e.duration])
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // Sem a API, as listas ficam vazias e o controle de quadros abaixo reprova.
    }
    let anterior = -1
    const laco = (agora: number) => {
      if (anterior >= 0) quadros.push([anterior, agora - anterior])
      anterior = agora
      requestAnimationFrame(laco)
    }
    requestAnimationFrame(laco)
  })
}

interface Amostra {
  frame_p95_ms: number
  frame_max_ms: number
  quadros: number
  longtask_max_ms: number
  longtasks: number
}

async function colher(page: Page, de: number, ate: number): Promise<Amostra> {
  return page.evaluate(
    ([inicio, fim]) => {
      const alvo = window as unknown as { __longas?: number[][]; __quadros?: number[][] }
      const janela = (lista: number[][]) => lista.filter(([t]) => t >= inicio && t <= fim).map(([, d]) => d)
      const quadros = janela(alvo.__quadros ?? []).sort((a, b) => a - b)
      const longas = janela(alvo.__longas ?? [])
      const r = (n: number) => Math.round(n * 10) / 10
      return {
        frame_p95_ms: r(quadros.length === 0 ? 0 : quadros[Math.min(quadros.length - 1, Math.floor(quadros.length * 0.95))]),
        frame_max_ms: r(quadros.reduce((a, b) => Math.max(a, b), 0)),
        quadros: quadros.length,
        longtask_max_ms: r(longas.reduce((a, b) => Math.max(a, b), 0)),
        longtasks: longas.length,
      }
    },
    [de, ate],
  )
}

const agora = (page: Page) => page.evaluate(() => performance.now())

test('camadas: pan, zoom e repintura num mapa denso (medida)', async ({ page }) => {
  test.setTimeout(240_000)
  await instalarColetor(page)
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
  }, mapaDenso())
  await page.mouse.move(1, 1)
  await page.evaluate(async () => {
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: 0, y: 0, scale: 0.4 } } })
  })
  // Aquecer: a primeira pintura do mapa (e a montagem em fatias) fica fora das janelas.
  await page.waitForTimeout(2000)

  const passos = (fn: string) =>
    page.evaluate(async (corpo) => {
      const aventura = await import('/src/stores/adventureStore.ts')
      const quadro = () => new Promise((pronto) => requestAnimationFrame(pronto))
      const camera = (i: number) => {
        // Corpo fixo por nome: pan anda 12 px por quadro; zoom vai de 0,4 a 1,2 e volta.
        if (corpo === 'pan') return { x: -i * 12, y: -i * 6, scale: 0.4 }
        const t = i < 30 ? i / 30 : (60 - i) / 30
        return { x: 0, y: 0, scale: 0.4 + 0.8 * t }
      }
      for (let i = 0; i <= 60; i++) {
        aventura.useAdventureStore.setState({ cameraRequest: { camera: camera(i) } })
        await quadro()
      }
    }, fn)

  let inicio = await agora(page)
  await passos('pan')
  const pan = await colher(page, inicio, await agora(page))

  await page.waitForTimeout(500)
  inicio = await agora(page)
  await passos('zoom')
  const zoom = await colher(page, inicio, await agora(page))

  await page.waitForTimeout(800)
  inicio = await agora(page)
  const custos = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const quadro = () => new Promise((pronto) => requestAnimationFrame(pronto))
    const ms: number[] = []
    for (let i = 0; i < 20; i++) {
      const camada = i % 4 < 2 ? 'paredes' : 'objetos'
      const t0 = performance.now()
      mod.useMapStore.getState().toggleLayerVisibility(camada)
      ms.push(performance.now() - t0)
      await quadro()
    }
    return ms
  })
  const repintura = await colher(page, inicio, await agora(page))
  const ordenados = [...custos].sort((a, b) => a - b)
  const troca = {
    sync_p95_ms: Math.round(ordenados[Math.floor(ordenados.length * 0.95)] * 10) / 10,
    sync_max_ms: Math.round(ordenados[ordenados.length - 1] * 10) / 10,
  }
  const nos = await page.locator('[data-nos-da-pilha]').first().getAttribute('data-nos-da-pilha', { timeout: 1000 }).catch(() => null)

  console.log(`MEDIDA camadas ${JSON.stringify({ pan, zoom, repintura, troca, nos })}`)
  for (const [nome, amostra] of [['pan', pan], ['zoom', zoom], ['repintura', repintura]] as const) {
    expect(amostra.quadros, `${nome}: o coletor viu quadros`).toBeGreaterThan(10)
    expect(amostra.longtask_max_ms, `${nome}: nenhuma tarefa longa >= 200 ms`).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  }
})
