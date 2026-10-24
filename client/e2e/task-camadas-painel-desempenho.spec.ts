// DESEMPENHO DO PAINEL DAS 13 CAMADAS (revisão da fatia 6: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// O QUE MEDE: CPU da thread principal POR QUADRO (CDP `Performance.getMetrics`,
// diferença de TaskDuration, ScriptDuration e LayoutDuration na janela,
// dividida pelos quadros), mediana de 5 rodadas, com a opacidade de Salas
// mudando a cada quadro e a página Cena do livro ABERTA com a ficha Camadas à
// vista (o painel que repinta). Mapa denso: 60 salas com paredes, 240 móveis,
// 60 fichas, 30 luzes, 60 peças de chão. O mapa já entra v2 (a virada é
// medida à parte).
//
// CENÁRIOS:
// - `opacidade-setState`: `useMapStore.setState` com a opacidade nova. Existe
//   nos dois códigos: é o par A/B (antes = `git archive` de e2fcd061 com este
//   spec copiado; `LAB_CPU_ANTES` = o JSON dele).
// - `opacidade-acao` (só depois): a ação da store (`definirOpacidadeDaCamada`).
// - `slider` (só depois): a mão no slider de verdade (abre a linha pelo nome
//   e arrasta, um movimento por quadro).
// - `virada` (só depois): o PRIMEIRO passo de opacidade num mapa de antes, o
//   quadro da virada para v2 sozinho.
//
// PORTÕES: nenhuma tarefa longa >= 200 ms; com `LAB_CPU_ANTES`, depois <= antes
// + 15% no `opacidade-setState`. Rodar com `--workers=1`.
import { test, expect, type CDPSession, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro } from './helpers/livroDoMestre'
import { buildLightAt, buildRoomFromDraft } from '../src/lib/drawingFactory'
import { buildFloorPiece } from '../src/lib/floorTool'
import { addFloorPiece, addLight, addProp, addRoom, addToken, createEmptyMap } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import type { MapData } from '../src/types/map'

const GRADE = 64
const COLUNAS_DE_SALAS = 10
const LINHAS_DE_SALAS = 6
const PASSO = 6
const RODADAS = 5
const QUADROS = 40
const TAREFA_LONGA_MAXIMA_MS = 200
const FOLGA_SOBRE_ANTES = 1.15

test.use({ viewport: { width: 1440, height: 900 }, trace: 'off', video: 'off' })

function mapaDenso(): MapData {
  let map = createEmptyMap('desempenho-painel', 'Denso', COLUNAS_DE_SALAS * PASSO + 1, LINHAS_DE_SALAS * PASSO + 1, GRADE)
  const moveis = ['mesa', 'cadeira', 'bau', 'barril'] as const
  for (let r = 0; r < LINHAS_DE_SALAS; r++) {
    for (let c = 0; c < COLUNAS_DE_SALAS; c++) {
      const n = r * COLUNAS_DE_SALAS + c
      const x0 = (c * PASSO + 1) * GRADE
      const y0 = (r * PASSO + 1) * GRADE
      const sala = buildRoomFromDraft(`r${n}`, [`w${n}-0`, `w${n}-1`, `w${n}-2`, `w${n}-3`], { x: x0, y: y0 }, { x: x0 + 5 * GRADE, y: y0 + 5 * GRADE }, undefined, undefined, `Sala ${n}`)
      map = addRoom(map, sala.region, sala.walls)
      moveis.forEach((tipo, k) => {
        map = addProp(map, criarMovel(tipo, { x: x0 + (1 + k) * GRADE, y: y0 + 2 * GRADE }, GRADE, `o${n}-${k}`))
      })
      map = addToken(map, { id: `t${n}`, characterId: null, name: `F${n}`, x: x0 + 3 * GRADE, y: y0 + 4 * GRADE, size: 1, image: null })
      if (n % 2 === 0) map = addLight(map, buildLightAt(`l${n}`, { x: x0 + GRADE, y: y0 + GRADE }, GRADE))
      map = addFloorPiece(map, buildFloorPiece(`f${n}`, { kind: 'rect', cx: x0 + 2.5 * GRADE, cy: y0 + 2.5 * GRADE, w: 5 * GRADE, h: 5 * GRADE }, 'add'))
    }
  }
  return map
}

const mapaV2 = (): MapData => ({ ...mapaDenso(), versaoDasCamadas: 2, ocultasDoJogador: [] })

async function instalarColetor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as { __longas?: number[][] } // as: campo nosso pendurado no window da página (sem tipo no DOM)
    const longas: number[][] = []
    alvo.__longas = longas
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push([e.startTime, e.duration])
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // Sem a API, a lista fica vazia: o portão de tarefa longa passa sem medir (o de CPU continua).
    }
  })
}

async function carregar(page: Page, map: MapData): Promise<void> {
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
  }, map)
  await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))))
}

async function abrir(page: Page): Promise<CDPSession> {
  await instalarColetor(page)
  await enterEditor(page)
  await carregar(page, mapaV2())
  await page.evaluate(async () => {
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: 0, y: 0, scale: 0.35 } } })
  })
  await abrirPaginaDoLivro(page, 'Cena')
  const secao = page.getByRole('button', { name: 'Camadas', exact: true })
  await expect(secao).toBeVisible()
  if ((await secao.getAttribute('aria-expanded')) !== 'true') await secao.click()
  await expect(page.getByRole('list', { name: 'Camadas do mapa' })).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  return cdp
}

type Cenario = 'opacidade-setState' | 'opacidade-acao'

async function andar(page: Page, cenario: Cenario): Promise<void> {
  await page.evaluate(
    async ({ corpo, quadros }) => {
      const loja = await import('/src/stores/mapStore.ts')
      const quadro = () => new Promise((pronto) => requestAnimationFrame(pronto))
      for (let i = 0; i < quadros; i++) {
        const valor = Math.round((i % 2 === 0 ? 0.4 : 0.7) * 100 - (i % 10)) / 100
        if (corpo === 'opacidade-setState') {
          const { map } = loja.useMapStore.getState()
          loja.useMapStore.setState({ map: { ...map, opacidadeDasCamadas: { salas: valor } } })
        } else {
          loja.useMapStore.getState().definirOpacidadeDaCamada('salas', valor, 'medida')
        }
        await quadro()
      }
    },
    { corpo: cenario, quadros: QUADROS },
  )
}

async function metricas(cdp: CDPSession): Promise<Map<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return new Map(metrics.map((m) => [m.name, m.value]))
}

const mediana = (valores: number[]): number => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)]
const r2 = (n: number): number => Math.round(n * 100) / 100

interface Medida {
  task_ms_por_quadro: number
  script_ms_por_quadro: number
  layout_ms_por_quadro: number
  longtask_max_ms: number
}

async function longasEntre(page: Page, de: number, ate: number): Promise<number[]> {
  // as: o campo que `instalarColetor` pendurou no window da página (sem tipo no DOM).
  return page.evaluate(([a, b]) => ((window as unknown as { __longas?: number[][] }).__longas ?? []).filter(([t]) => t >= a && t <= b).map(([, d]) => d), [de, ate])
}

async function medir(page: Page, cdp: CDPSession, rodar: () => Promise<void>, quadros: number): Promise<Medida> {
  const task: number[] = []
  const script: number[] = []
  const layout: number[] = []
  let longaMax = 0
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    const inicio = await page.evaluate(() => performance.now())
    const antes = await metricas(cdp)
    await rodar()
    const depois = await metricas(cdp)
    const fim = await page.evaluate(() => performance.now())
    const porQuadro = (nome: string) => (((depois.get(nome) ?? 0) - (antes.get(nome) ?? 0)) * 1000) / quadros
    task.push(porQuadro('TaskDuration'))
    script.push(porQuadro('ScriptDuration'))
    layout.push(porQuadro('LayoutDuration'))
    longaMax = Math.max(longaMax, ...(await longasEntre(page, inicio, fim)), 0)
    await page.waitForTimeout(200)
  }
  return { task_ms_por_quadro: r2(mediana(task)), script_ms_por_quadro: r2(mediana(script)), layout_ms_por_quadro: r2(mediana(layout)), longtask_max_ms: r2(longaMax) }
}

test('opacidade de Salas com o painel das camadas à vista: CPU por quadro e tarefa longa', async ({ page }) => {
  test.setTimeout(300_000)
  const cdp = await abrir(page)
  const resultado: Record<string, Medida> = {}
  resultado['opacidade-setState'] = await medir(page, cdp, () => andar(page, 'opacidade-setState'), QUADROS)

  const temAcao = await page.evaluate(async () => typeof (await import('/src/stores/mapStore.ts')).useMapStore.getState().definirOpacidadeDaCamada === 'function')
  if (temAcao) {
    resultado['opacidade-acao'] = await medir(page, cdp, () => andar(page, 'opacidade-acao'), QUADROS)

    // A mão no slider: abre a linha pelo nome e arrasta, um movimento por quadro.
    const nome = page.getByRole('button', { name: 'Salas, opacidade', exact: true })
    if ((await nome.count()) === 1) {
      await nome.click()
      const faixa = page.getByRole('slider', { name: 'Opacidade de Salas' })
      await expect(faixa).toBeVisible()
      const caixa = await faixa.boundingBox()
      if (caixa === null) throw new Error('slider sem caixa')
      const y = caixa.y + caixa.height / 2
      resultado.slider = await medir(
        page,
        cdp,
        async () => {
          await page.mouse.move(caixa.x + caixa.width * 0.9, y)
          await page.mouse.down()
          for (let i = 0; i < QUADROS; i++) {
            await page.mouse.move(caixa.x + caixa.width * (i % 2 === 0 ? 0.3 : 0.6) + (i % 7), y)
            await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(pronto)))
          }
          await page.mouse.up()
        },
        QUADROS,
      )
    }

    // A virada: o primeiro passo num mapa de antes, um quadro (o carregamento fica FORA da janela medida).
    const viradas: number[] = []
    let viradaLonga = 0
    for (let rodada = 0; rodada < RODADAS; rodada++) {
      await carregar(page, mapaDenso())
      await page.waitForTimeout(200)
      const inicio = await page.evaluate(() => performance.now())
      const antes = await metricas(cdp)
      await page.evaluate(async () => {
        ;(await import('/src/stores/mapStore.ts')).useMapStore.getState().definirOpacidadeDaCamada('salas', 0.5, 'virada')
        await new Promise((pronto) => requestAnimationFrame(pronto))
      })
      const depois = await metricas(cdp)
      const fim = await page.evaluate(() => performance.now())
      viradas.push(((depois.get('TaskDuration') ?? 0) - (antes.get('TaskDuration') ?? 0)) * 1000)
      viradaLonga = Math.max(viradaLonga, ...(await longasEntre(page, inicio, fim)), 0)
    }
    resultado.virada = { task_ms_por_quadro: r2(mediana(viradas)), script_ms_por_quadro: 0, layout_ms_por_quadro: 0, longtask_max_ms: r2(viradaLonga) }
  }

  console.log(`MEDIDA_DO_PAINEL ${JSON.stringify(resultado)}`)
  for (const [cenario, medida] of Object.entries(resultado)) {
    if (cenario === 'virada') continue
    expect(medida.longtask_max_ms, `${cenario}: tarefa longa`).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  }
  const antes = process.env.LAB_CPU_ANTES
  if (antes !== undefined && antes !== '') {
    const base = (JSON.parse(antes) as Record<string, Medida>)['opacidade-setState'] // as: o JSON que este mesmo spec imprimiu no código de antes
    expect(resultado['opacidade-setState'].task_ms_por_quadro, `depois ${resultado['opacidade-setState'].task_ms_por_quadro} contra antes ${base.task_ms_por_quadro}`).toBeLessThanOrEqual(base.task_ms_por_quadro * FOLGA_SOBRE_ANTES)
  }
})
