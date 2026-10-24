// DESEMPENHO DA PILHA DE CAMADAS (fase 3, fatia 3: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// O QUE MEDE: tempo de CPU da thread principal POR QUADRO, não o intervalo
// entre quadros. Neste Chromium sem tela o intervalo anda em degraus de
// 16,7 ms (o p95 deu 16,8 numa rodada e 33,4 na seguinte, mesmo código): ruído
// que não diz nada de regressão. Aqui o número sai do `Performance.getMetrics`
// do CDP — diferença de TaskDuration, ScriptDuration e LayoutDuration na
// janela, dividida pelos quadros que a janela andou —, mediana de 5 rodadas.
//
// DOIS MAPAS DENSOS montados por código (60 salas com paredes, 240 móveis, 60
// fichas, 30 luzes, 10 escadas, 20 desenhos):
// - PADRÃO: sem camada mexida (o caminho rápido; é o que existia antes da
//   fatia 3). Comparado com o código de ANTES (98d679e9~1) por `LAB_CPU_ANTES`.
// - NOVO: camada livre com paredes e móveis, Decoração a 70% (os móveis se
//   separam de Objetos) e Escadas movida para entre Paredes e Portas (as faixas
//   das paredes e das linhas se separam). Só existe depois da fatia 3.
// Cenários: pan e zoom pela câmera da store (um quadro por passo), repintura
// (lista de paredes nova a cada quadro), alternância de visibilidade e, no
// NOVO, troca da lista e da opacidade pela store.
//
// PORTÕES (reprovam): nenhuma tarefa longa >= 200 ms; CPU por quadro abaixo do
// teto de segurança; com `LAB_CPU_ANTES` (o JSON da medida de antes), o mapa
// padrão depois <= antes + 15% em cada cenário. O p95 de 20 ms do plano é de
// GPU real: fica para a Fase 4 (ux-driver no app). Rodar com `--workers=1`.
import { test, expect, type CDPSession, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { buildFreehandDrawing, buildLightAt, buildRoomFromDraft } from '../src/lib/drawingFactory'
import { addDrawing, addLight, addProp, addRoom, addStair, addToken, createEmptyMap } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { buildStairFromDraft } from '../src/lib/stairs'
import { CAMADAS_PADRAO } from '../src/lib/camadas/padrao'
import type { CamadaId, MapData, ModeloDeCamadas } from '../src/types/map'

const GRADE = 64
const COLUNAS_DE_SALAS = 10
const LINHAS_DE_SALAS = 6
const PASSO = 6
const RODADAS = 5
const TAREFA_LONGA_MAXIMA_MS = 200
/** Teto de SEGURANÇA de CPU por quadro (TaskDuration), não meta: o pior medido em 23/10/2026 foi 18,6 ms (visibilidade no caminho novo; ver o plano). */
const TETO_CPU_POR_QUADRO_MS = 30
/** Depois <= antes + 15% (critério da revisão da fatia 3). */
const FOLGA_SOBRE_ANTES = 1.15
const LIVRE: CamadaId = 'livre_af8e74a2'

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

/** A lista padrão com Escadas entre Paredes e Portas e a livre no topo. */
function listaMexida(): ModeloDeCamadas {
  const sem = CAMADAS_PADRAO.filter((c) => c !== 'escadas')
  const i = sem.indexOf('paredes')
  const ids: CamadaId[] = [...sem.slice(0, i + 1), 'escadas', ...sem.slice(i + 1), LIVRE]
  return { ordem: ids.map((id) => ({ id })) }
}

/** O caminho NOVO: 1 de cada 4 paredes e móveis na livre, baús em Decoração a 70%. */
function mapaDensoMexido(): MapData {
  const base = mapaDenso()
  return {
    ...base,
    walls: base.walls.map((w, i) => (i % 4 === 0 ? { ...w, camada: LIVRE } : w)),
    props: base.props.map((p, i): MapData['props'][number] => (p.mobilia === 'bau' ? { ...p, layer: 'decoracao' } : i % 4 === 1 ? { ...p, camada: LIVRE } : p)),
    modeloCamadas: listaMexida(),
    opacidadeDasCamadas: { decoracao: 0.7 },
  }
}

async function instalarColetor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as { __longas?: number[][] } // as: a lista de tarefas longas é um campo nosso pendurado no window da página (sem tipo no DOM)
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

type Cenario = 'pan' | 'zoom' | 'repintura' | 'visibilidade' | 'troca-de-camadas'
const QUADROS: Record<Cenario, number> = { pan: 60, zoom: 60, repintura: 30, visibilidade: 20, 'troca-de-camadas': 20 }

/** Anda o cenário, um quadro por passo, e devolve quantas vezes o número de nós do `world` mudou. */
async function andar(page: Page, cenario: Cenario): Promise<{ nos: number[] }> {
  return page.evaluate(
    async ({ corpo, quadros, livre, padrao }) => {
      const aventura = await import('/src/stores/adventureStore.ts')
      const loja = await import('/src/stores/mapStore.ts')
      const quadro = () => new Promise((pronto) => requestAnimationFrame(pronto))
      const nos = () => Number(document.querySelector('[data-nos-da-pilha]')?.getAttribute('data-nos-da-pilha') ?? 'NaN')
      const vistos: number[] = [nos()]
      for (let i = 0; i < quadros; i++) {
        if (corpo === 'pan') aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: -i * 12, y: -i * 6, scale: 0.4 } } })
        else if (corpo === 'zoom') {
          const t = i < quadros / 2 ? i / (quadros / 2) : (quadros - i) / (quadros / 2)
          aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: 0, y: 0, scale: 0.4 + 0.8 * t } } })
        } else if (corpo === 'repintura') {
          const { map } = loja.useMapStore.getState()
          loja.useMapStore.setState({ map: { ...map, walls: [...map.walls] } })
        } else if (corpo === 'visibilidade') loja.useMapStore.getState().toggleLayerVisibility(i % 4 < 2 ? 'paredes' : 'objetos')
        else {
          const { map } = loja.useMapStore.getState()
          // Ida e volta: a lista com a livre no topo e a com Escadas entre Paredes e Portas (separa as faixas das paredes).
          const semEscadas = padrao.filter((c) => c !== 'escadas')
          const ids: CamadaId[] = i % 2 === 0 ? [...padrao, livre] : [...semEscadas.slice(0, 5), 'escadas', ...semEscadas.slice(5), livre]
          loja.useMapStore.setState({ map: { ...map, modeloCamadas: { ordem: ids.map((id) => ({ id })) }, opacidadeDasCamadas: { decoracao: i % 2 === 0 ? 1 : 0.7 } } })
        }
        await quadro()
        vistos.push(nos())
      }
      return { nos: vistos }
    },
    { corpo: cenario, quadros: QUADROS[cenario], livre: LIVRE, padrao: [...CAMADAS_PADRAO] },
  )
}

async function metricas(cdp: CDPSession): Promise<Map<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return new Map(metrics.map((m) => [m.name, m.value]))
}

interface Medida {
  task_ms_por_quadro: number
  script_ms_por_quadro: number
  layout_ms_por_quadro: number
  longtask_max_ms: number
  /** Quantas vezes o número de nós do `world` mudou na rodada (nó criado ou destruído). */
  mudancas_de_nos: number
  nos_min: number
  nos_max: number
}

const mediana = (valores: number[]): number => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)]
const r2 = (n: number): number => Math.round(n * 100) / 100

async function medir(page: Page, cdp: CDPSession, cenario: Cenario): Promise<Medida> {
  const task: number[] = []
  const script: number[] = []
  const layout: number[] = []
  let longaMax = 0
  let mudancas = 0
  let nosMin = Infinity
  let nosMax = -Infinity
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    const inicio = await page.evaluate(() => performance.now())
    const antes = await metricas(cdp)
    const { nos } = await andar(page, cenario)
    const depois = await metricas(cdp)
    const fim = await page.evaluate(() => performance.now())
    const porQuadro = (nome: string) => (((depois.get(nome) ?? 0) - (antes.get(nome) ?? 0)) * 1000) / QUADROS[cenario]
    task.push(porQuadro('TaskDuration'))
    script.push(porQuadro('ScriptDuration'))
    layout.push(porQuadro('LayoutDuration'))
    const longas = await page.evaluate(
      // as: o campo que `instalarColetor` pendurou no window da página (sem tipo no DOM).
      ([de, ate]) => ((window as unknown as { __longas?: number[][] }).__longas ?? []).filter(([t]) => t >= de && t <= ate).map(([, d]) => d),
      [inicio, fim],
    )
    longaMax = Math.max(longaMax, ...longas, 0)
    mudancas += nos.slice(1).filter((n, i) => n !== nos[i]).length
    nosMin = Math.min(nosMin, ...nos)
    nosMax = Math.max(nosMax, ...nos)
    await page.waitForTimeout(200)
  }
  return {
    task_ms_por_quadro: r2(mediana(task)),
    script_ms_por_quadro: r2(mediana(script)),
    layout_ms_por_quadro: r2(mediana(layout)),
    longtask_max_ms: r2(longaMax),
    mudancas_de_nos: mudancas,
    nos_min: nosMin,
    nos_max: nosMax,
  }
}

async function abrir(page: Page, map: MapData): Promise<CDPSession> {
  await instalarColetor(page)
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
  }, map)
  await page.mouse.move(1, 1)
  await page.evaluate(async () => {
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: 0, y: 0, scale: 0.4 } } })
  })
  // Aquecer: a primeira pintura do mapa (e a montagem em fatias) fica fora das janelas.
  await page.waitForTimeout(2000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' })
  return cdp
}

/** Os números de antes (o JSON que a medida do mapa padrão imprimiu no código de 98d679e9~1), se vieram. */
function medidaDeAntes(): Partial<Record<Cenario, Medida>> | null {
  const bruto = process.env.LAB_CPU_ANTES
  if (bruto === undefined || bruto === '') return null
  const lido: unknown = JSON.parse(bruto)
  if (typeof lido !== 'object' || lido === null) throw new Error('LAB_CPU_ANTES não é um objeto JSON')
  const saida: Partial<Record<Cenario, Medida>> = {}
  for (const cenario of ['pan', 'zoom', 'repintura', 'visibilidade'] as const) {
    const valor: unknown = Reflect.get(lido, cenario)
    if (typeof valor === 'object' && valor !== null && typeof Reflect.get(valor, 'task_ms_por_quadro') === 'number') {
      saida[cenario] = { task_ms_por_quadro: Reflect.get(valor, 'task_ms_por_quadro'), script_ms_por_quadro: 0, layout_ms_por_quadro: 0, longtask_max_ms: 0, mudancas_de_nos: 0, nos_min: 0, nos_max: 0 }
    }
  }
  return saida
}

function portoes(nome: string, medidas: Partial<Record<Cenario, Medida>>): void {
  for (const [cenario, m] of Object.entries(medidas)) {
    expect(m.longtask_max_ms, `${nome}/${cenario}: nenhuma tarefa longa >= 200 ms`).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
    expect(m.task_ms_por_quadro, `${nome}/${cenario}: CPU por quadro abaixo do teto de segurança`).toBeLessThan(TETO_CPU_POR_QUADRO_MS)
  }
}

test('camadas: CPU por quadro no mapa denso PADRÃO (pan, zoom, repintura, visibilidade)', async ({ page }) => {
  test.setTimeout(300_000)
  const cdp = await abrir(page, mapaDenso())
  const medidas: Partial<Record<Cenario, Medida>> = {}
  for (const cenario of ['pan', 'zoom', 'repintura', 'visibilidade'] as const) medidas[cenario] = await medir(page, cdp, cenario)
  // A linha que vira `LAB_CPU_ANTES` (medida no código de antes) e o registro do plano.
  console.log(`MEDIDA-CPU padrao ${JSON.stringify(medidas)}`)
  portoes('padrao', medidas)
  const antes = medidaDeAntes()
  if (antes !== null) {
    for (const cenario of ['pan', 'zoom', 'repintura', 'visibilidade'] as const) {
      const depois = medidas[cenario]?.task_ms_por_quadro
      const deAntes = antes[cenario]?.task_ms_por_quadro
      if (depois === undefined || deAntes === undefined) continue
      expect(depois, `padrao/${cenario}: depois ${depois} <= antes ${deAntes} + 15%`).toBeLessThanOrEqual(r2(deAntes * FOLGA_SOBRE_ANTES))
    }
  }
})

test('camadas: CPU por quadro no caminho NOVO (livre com paredes e móveis, Decoração a 70%, Escadas entre Paredes e Portas)', async ({ page }) => {
  test.setTimeout(300_000)
  const cdp = await abrir(page, mapaDensoMexido())
  const nos = Number(await page.locator('[data-nos-da-pilha]').first().getAttribute('data-nos-da-pilha'))
  // 53 faixas + 1 Text fora da lista = 54 no mapa padrão; aqui há nós criados de verdade.
  expect(nos, 'o caminho novo cria nós').toBeGreaterThan(54)
  const medidas: Partial<Record<Cenario, Medida>> = {}
  for (const cenario of ['pan', 'zoom', 'repintura', 'visibilidade', 'troca-de-camadas'] as const) medidas[cenario] = await medir(page, cdp, cenario)
  console.log(`MEDIDA-CPU novo ${JSON.stringify({ nos, ...medidas })}`)
  portoes('novo', medidas)
  expect(medidas['troca-de-camadas']?.mudancas_de_nos, 'a troca de lista e de opacidade cria e solta nós').toBeGreaterThan(0)
})
