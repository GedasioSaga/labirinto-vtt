import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import type { useAdventureStore } from '../src/stores/adventureStore'
import type { useMapStore } from '../src/stores/mapStore'
import type { Agua, Carimbo, ConcealZone, MapData, Pin, RiscoDeBarranco } from '../src/types/map'

/**
 * UMA MÃO SÓ (Fase 4, 15/11/2026): mapa grande com 5.000 carimbos, 300 pinos,
 * 40 lagos, 200 riscos de Barranco e 40 zonas ocultas. O laço pega tudo, o
 * arrasto leva tudo num gesto, o Ctrl+Z desfaz num passo, sem tarefa longa de
 * 200 ms ou mais. Gesto de verdade no canvas (mouse), mapa sintético.
 *
 * As stores vêm da SONDA (`window.__labSonda`, src/lib/sondaDeDesempenho.ts),
 * que existe no vite de desenvolvimento e no build feito com `VITE_LAB_SONDA=1`:
 * o mesmo spec mede nos dois modos.
 *
 * Rodar em PRODUÇÃO (o número que vale; 16/11/2026), da pasta client:
 *   VITE_LAB_SONDA=1 npx vite build --outDir <dist> --emptyOutDir --sourcemap --minify false
 *   LAB_DES_DIST=<dist> npx playwright test -c playwright.desempenho.config.ts selecao-unica
 * Em desenvolvimento (perfil com nomes do vite):
 *   LAB_DES_MODO=dev LAB_NAVEGADOR=msedge npx playwright test -c playwright.desempenho.config.ts selecao-unica
 * `LAB_FASE4_SAIDA`: pasta dos números e das fotos (padrão: tmp/fase-4-selecao da árvore).
 */

const GRADE = 40
const CELULAS = 100
const ESCALA = 0.18
const TAREFA_LONGA_MAXIMA_MS = 200
const QUANTOS = { carimbos: 5000, pinos: 300, aguas: 40, riscos: 200, zonas: 40 }
const SAIDA = process.env.LAB_FASE4_SAIDA ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'tmp', 'fase-4-selecao')

/** O que a sonda do app pendura (`registrarNaSonda` em src/main.tsx). */
interface Sonda {
  mapStore: typeof useMapStore
  adventureStore: typeof useAdventureStore
}

interface JanelaDaMedida {
  __longas?: number[][]
  __quadros?: number[]
  __labSonda?: Sonda
}

/**
 * Abre o editor pelo menu (o caminho do `enterEditor` das jornadas, sem o
 * aquecimento por `import('/src/...')`, que no build de produção não existe).
 */
async function abrirOEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  // exact: o cartão "Criar Mapas" do menu também casaria com "Criar mapa" por substring.
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas', { timeout: 120_000 })
  await page.waitForFunction(() => (window as unknown as JanelaDaMedida).__labSonda?.mapStore !== undefined) // as: os campos da sonda pendurados no window
}

/** `n` pontos espalhados em grade pelo lado do mapa (o mesmo passo do teste do carimbo). */
function emGrade(n: number, lado: number): Array<{ x: number; y: number }> {
  const porLinha = Math.ceil(Math.sqrt(n))
  const passo = lado / (porLinha + 1)
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(passo * ((i % porLinha) + 1)), y: Math.round(passo * (Math.floor(i / porLinha) + 1)) }))
}

function mapaGrande(): MapData {
  const lado = CELULAS * GRADE
  const carimbos: Carimbo[] = emGrade(QUANTOS.carimbos, lado).map((p, i) => ({ id: `c${i}`, tipo: i % 3 === 0 ? 'arvore' : 'pinheiro', x: p.x, y: p.y, tamanho: 36, giro: (i * 45) % 360 }))
  const pins: Pin[] = emGrade(QUANTOS.pinos, lado).map((p, i) => ({ id: `p${i}`, x: p.x + 7, y: p.y + 7, kind: 'exclamacao', description: '', image: null }))
  const aguas: Agua[] = emGrade(QUANTOS.aguas, lado).map((p, i) => ({
    id: `a${i}`,
    tipo: 'lago',
    cor: '#2a6f97',
    pontos: [{ x: p.x - 60, y: p.y - 40 }, { x: p.x + 60, y: p.y - 40 }, { x: p.x + 60, y: p.y + 40 }, { x: p.x - 60, y: p.y + 40 }],
  }))
  const riscos: RiscoDeBarranco[] = emGrade(QUANTOS.riscos, lado).map((p, i) => ({ id: `r${i}`, lado: 1, pontos: [{ x: p.x - 30, y: p.y + 20 }, { x: p.x + 30, y: p.y + 20 }] }))
  const concealZones: ConcealZone[] = emGrade(QUANTOS.zonas, lado).map((p, i) => ({
    id: `z${i}`,
    name: `Zona ${i}`,
    revealed: false,
    points: [{ x: p.x - 20, y: p.y - 20 }, { x: p.x + 20, y: p.y - 20 }, { x: p.x + 20, y: p.y + 20 }, { x: p.x - 20, y: p.y + 20 }],
  }))
  const base = createEmptyMap('m-fase4', 'Vale grande', CELULAS, CELULAS, GRADE)
  return {
    ...base,
    carimbos,
    pins,
    aguas,
    concealZones,
    barranco: { quadrado: GRADE, origem: { x: 0, y: 0 }, riscos, quadrados: [], rampas: [] },
    props: [criarMovel('barril', { x: lado / 2 + 20, y: lado / 2 + 20 }, GRADE, 'barril')],
  }
}

async function instalarColetor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as JanelaDaMedida // as: os campos da medida pendurados no window da página (sem tipo no DOM)
    const longas: number[][] = []
    const quadros: number[] = []
    alvo.__longas = longas
    alvo.__quadros = quadros
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push([e.startTime, e.duration])
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // Sem a API, a lista fica vazia; o tempo de quadro continua medido.
    }
    const quadro = (t: number) => {
      quadros.push(t)
      requestAnimationFrame(quadro)
    }
    requestAnimationFrame(quadro)
  })
}

interface Medida {
  longtask_max_ms: number
  frame_p95_ms: number
  frame_max_ms: number
  duracao_ms: number
}

interface NoDoPerfil {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number }
}

/** `LAB_FASE4_PERFIL=1`: o perfil de CPU do gesto, as 15 funções que mais gastaram sozinhas (para achar onde otimizar). */
async function comPerfil(page: Page, nome: string, gesto: () => Promise<void>): Promise<void> {
  if (process.env.LAB_FASE4_PERFIL !== '1') return gesto()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.start')
  await gesto()
  const { profile } = await cdp.send('Profiler.stop')
  const nos = new Map<number, NoDoPerfil>(profile.nodes.map((n) => [n.id, n]))
  const porFuncao = new Map<string, number>()
  const deltas = profile.timeDeltas ?? []
  ;(profile.samples ?? []).forEach((id, i) => {
    const no = nos.get(id)
    if (no === undefined) return
    const chave = `${no.callFrame.functionName || '(anon)'} ${no.callFrame.url.split('/').pop() ?? ''}:${no.callFrame.lineNumber + 1}`
    porFuncao.set(chave, (porFuncao.get(chave) ?? 0) + (deltas[i] ?? 0) / 1000)
  })
  const top = [...porFuncao.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  writeFileSync(join(SAIDA, `perfil-${nome}.json`), JSON.stringify(top.map(([f, ms]) => ({ f, ms: Math.round(ms) })), null, 2))
}

async function medir(page: Page, gesto: () => Promise<void>, nome = 'gesto'): Promise<Medida> {
  const inicio = await page.evaluate(() => performance.now())
  await comPerfil(page, nome, gesto)
  await page.waitForTimeout(400)
  const fim = await page.evaluate(() => performance.now())
  return page.evaluate(
    ([de, ate]) => {
      const janela = window as unknown as JanelaDaMedida // as: os campos que `instalarColetor` pendurou
      const longas = (janela.__longas ?? []).filter(([t]) => t >= de && t <= ate).map(([, d]) => d)
      const tempos = (janela.__quadros ?? []).filter((t) => t >= de && t <= ate)
      const deltas = tempos.slice(1).map((t, i) => t - tempos[i]).sort((a, b) => a - b)
      const p95 = deltas.length === 0 ? 0 : deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))]
      const r1 = (n: number) => Math.round(n * 10) / 10
      return { longtask_max_ms: r1(Math.max(0, ...longas)), frame_p95_ms: r1(p95), frame_max_ms: r1(Math.max(0, ...deltas)), duracao_ms: r1(ate - de) }
    },
    [inicio, fim],
  )
}

/** O primeiro de cada tipo, para conferir que andou e voltou. */
async function amostra(page: Page) {
  return page.evaluate(() => {
    const sonda = (window as unknown as JanelaDaMedida).__labSonda // as: os campos da sonda pendurados no window
    if (sonda === undefined) throw new Error('sem a sonda do app')
    const loja = sonda.mapStore.getState()
    const m = loja.map
    return {
      c0: m.carimbos?.[0]?.x,
      p0: m.pins[0]?.x,
      a0: m.aguas?.[0]?.pontos[0]?.x,
      r0: m.barranco?.riscos[0]?.pontos[0]?.x,
      z0: m.concealZones[0]?.points[0]?.x,
      passado: loja.past.length,
    }
  })
}

test('fase 4: laço misto, arrasto e Ctrl+Z num mapa grande sem tarefa longa de 200 ms', async ({ page }) => {
  test.setTimeout(300_000)
  mkdirSync(SAIDA, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await instalarColetor(page)
  await abrirOEditor(page)
  await page.evaluate((m) => {
    const sonda = (window as unknown as JanelaDaMedida).__labSonda // as: os campos da sonda pendurados no window
    if (sonda === undefined) throw new Error('sem a sonda do app')
    sonda.mapStore.getState().loadMap(m)
    sonda.mapStore.getState().setActiveTool('select')
    sonda.adventureStore.setState({ cameraRequest: { camera: { x: 360, y: 40, scale: 0.18 } } })
  }, mapaGrande())
  await page.waitForTimeout(4000)
  const canvas = page.locator('canvas').first()
  const caixa = await canvas.boundingBox()
  if (caixa === null) throw new Error('canvas sem caixa')
  const camera = await page.evaluate(() => {
    const sonda = (window as unknown as JanelaDaMedida).__labSonda // as: os campos da sonda pendurados no window
    if (sonda === undefined) throw new Error('sem a sonda do app')
    return sonda.mapStore.getState().camera
  })
  const naTela = (x: number, y: number) => ({ x: caixa.x + camera.x + x * camera.scale, y: caixa.y + camera.y + y * camera.scale })
  const lado = CELULAS * GRADE

  // 1. LAÇO: de fora a fora do mapa, da direita para a esquerda (pega o que toca).
  const de = naTela(lado + 10, lado + 10)
  const ate = naTela(-10, -10)
  const laco = await medir(page, async () => {
    await page.mouse.move(de.x, de.y)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) await page.mouse.move(de.x + ((ate.x - de.x) * i) / 20, de.y + ((ate.y - de.y) * i) / 20)
    await page.mouse.up()
  })
  const porTipo = await page.evaluate(() => {
    const sonda = (window as unknown as JanelaDaMedida).__labSonda // as: os campos da sonda pendurados no window
    if (sonda === undefined) throw new Error('sem a sonda do app')
    const contagem: Record<string, number> = {}
    for (const item of sonda.mapStore.getState().selection) contagem[item.kind] = (contagem[item.kind] ?? 0) + 1
    return contagem
  })
  await page.screenshot({ path: join(SAIDA, '1-laco-misto.png') })

  // 2. ARRASTO: pega a seleção pelo barril e anda 30 passos.
  const antes = await amostra(page)
  const pega = naTela(lado / 2 + 20, lado / 2 + 20)
  const arrasto = await medir(page, async () => {
    await page.mouse.move(pega.x, pega.y)
    await page.mouse.down()
    for (let i = 1; i <= 30; i++) await page.mouse.move(pega.x + i * 5, pega.y + i * 3)
    await page.mouse.up()
  }, 'arrasto')
  const depois = await amostra(page)
  await page.screenshot({ path: join(SAIDA, '2-arrasto-misto.png') })

  // 3. CTRL+Z: um passo devolve tudo.
  const desfazer = await medir(page, async () => {
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
  })
  const desfeito = await amostra(page)

  const numeros = {
    quando: new Date().toISOString(),
    no_mapa: QUANTOS,
    escala: ESCALA,
    selecionados_por_tipo: porTipo,
    passos_no_desfazer_do_arrasto: depois.passado - antes.passado,
    antes,
    depois,
    desfeito_igual_ao_antes: desfeito.c0 === antes.c0 && desfeito.p0 === antes.p0 && desfeito.a0 === antes.a0 && desfeito.r0 === antes.r0 && desfeito.z0 === antes.z0,
    laco,
    arrasto,
    desfazer,
  }
  writeFileSync(join(SAIDA, 'numeros-fase-4.json'), JSON.stringify(numeros, null, 2))
  console.log(JSON.stringify(numeros))

  expect(porTipo.carimbo).toBe(QUANTOS.carimbos)
  expect(porTipo.pin).toBe(QUANTOS.pinos)
  expect(porTipo.agua).toBe(QUANTOS.aguas)
  expect(porTipo.barranco).toBe(QUANTOS.riscos)
  expect(porTipo.zone).toBe(QUANTOS.zonas)
  expect(depois.passado - antes.passado).toBe(1)
  for (const chave of ['c0', 'p0', 'a0', 'r0', 'z0'] as const) expect(depois[chave], chave).not.toBe(antes[chave])
  expect(numeros.desfeito_igual_ao_antes).toBe(true)
  for (const [nome, m] of Object.entries({ laco, arrasto, desfazer })) {
    expect.soft(m.longtask_max_ms, `${nome}: nenhuma tarefa longa >= ${TAREFA_LONGA_MAXIMA_MS} ms`).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  }
})
