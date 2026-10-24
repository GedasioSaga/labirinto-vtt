// MESAS DO MEIO-TERMO (pedido de 24/10/2026: "falta a versão redonda, a quadrada
// pode ser melhor, a mesa parece um móvel e não uma mesa"): as 3 formas
// (retangular 2 x 1, quadrada, redonda) em cada uma das 3 madeiras (carvalho,
// nogueira, madeira velha), medidas no Chromium a 3x com a SEMENTE DO APP
// (`chaveDoMovel`): a fria (a primeira imagem de uma página nova, motor frio)
// e a mediana morna de 5, as duas até 50 ms, e nenhuma tarefa longa >= 200 ms.
// E o jogador abrindo um mapa com as 9 mesas e a retangular de 3 x 1, com a
// chave de obra ligada (`?obra=meio-termo`): nenhuma tarefa longa >= 200 ms.
// Só PC (decisão do usuário de 24/10/2026); não toca no golden.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addProp, addToken, createEmptyMap, setGridSettings, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { MATERIAIS } from '../src/texturas/meioTermo/materiais'
import type { MapData, Prop, RegionPoint } from '../src/types/map'

const GRADE = 64
const COLUNAS = 16
const LINHAS = 12
const FICHA = 'ficha-ana'
const TETO_DA_IMAGEM_MS = 50
const TETO_DA_TAREFA_LONGA_MS = 200
const MORNAS = 5
/** A grade de referência do desenho (`GRADE_DE_REFERENCIA`): o app pede a imagem com a pegada em casas de 50 px. */
const CASA = 50

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

const MADEIRAS = ['carvalho', 'nogueira', 'velha'] as const
const FORMAS = [
  { tipo: 'mesa', casasW: 2, casasH: 1 },
  { tipo: 'mesaQuadrada', casasW: 1, casasH: 1 },
  { tipo: 'mesaRedonda', casasW: 1.25, casasH: 1.25 },
] as const

const COMBINACOES = FORMAS.flatMap((forma) => MADEIRAS.map((madeira) => ({ ...forma, madeira, nome: `${forma.tipo} ${madeira}` })))

/** Junta a observação de tarefas longas (início e duração, em ms da página) antes de qualquer script da página. */
async function observarTarefasLongas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const longas: number[] = []
    Object.defineProperty(window, '__tarefasLongasDasMesas', { value: longas })
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) longas.push(e.startTime, e.duration)
    }).observe({ type: 'longtask', buffered: true })
  })
}

/** A duração das tarefas longas que começaram a partir de `desde` (ms da página). */
async function tarefasLongas(page: Page, desde = 0): Promise<number[]> {
  const pares = await page.evaluate(() => {
    const v: unknown = Reflect.get(window, '__tarefasLongasDasMesas')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  })
  const duracoes: number[] = []
  for (let i = 0; i + 1 < pares.length; i += 2) if (pares[i] >= desde) duracoes.push(pares[i + 1])
  return duracoes
}

test('tempo no Chromium a 3x, semente do app: cada mesa como a PRIMEIRA imagem da página (fria) e a mediana morna, até 50 ms, sem tarefa longa >= 200 ms', async ({ browser }) => {
  test.setTimeout(240_000)
  const tempos: { nome: string; fria: number; morna: number; maiorTarefa: number }[] = []
  for (const c of COMBINACOES) {
    const page = await browser.newPage()
    await observarTarefasLongas(page)
    await page.goto('/player.html')
    const prop: Prop = { id: `m-${c.tipo}`, src: '', x: 0, y: 0, width: c.casasW * CASA, height: c.casasH * CASA, linkedMapPath: null, mobilia: c.tipo, mobiliaCor: MATERIAIS[c.madeira].hex }
    const medida = await page.evaluate(
      async ({ p, mornasPedidas }) => {
        const moveis = (await import(/* @vite-ignore */ '/src/texturas/meioTermo/moveis/index.ts')) as typeof import('../src/texturas/meioTermo/moveis') // cast seguro: é este mesmo módulo servido pelo Vite, e import por string não traz tipo
        const raster = (await import(/* @vite-ignore */ '/src/pixi/rasterDosMoveis.ts')) as typeof import('../src/pixi/rasterDosMoveis') // idem
        const chave = raster.chaveDoMovel(p, 3, 1)
        if (chave === null) throw new Error('mesa sem desenho com textura')
        const medir = (): number => {
          const t0 = performance.now()
          moveis.pintarMovel(chave.desenho, moveis.escalaDoNivel(3))
          return performance.now() - t0
        }
        const fria = medir()
        const mornas = Array.from({ length: mornasPedidas }, medir).sort((a, b) => a - b)
        return { fria, morna: mornas[Math.floor(mornasPedidas / 2)] }
      },
      { p: prop, mornasPedidas: MORNAS },
    )
    const longas = await tarefasLongas(page)
    tempos.push({ nome: c.nome, ...medida, maiorTarefa: Math.max(0, ...longas) })
    await page.close()
  }
  console.log(`[medida] mesas a 3x no Chromium, fria / mediana morna de ${MORNAS} (maior tarefa longa da página): ${tempos.map((t) => `${t.nome} ${t.fria.toFixed(1)} / ${t.morna.toFixed(1)} ms (${t.maiorTarefa.toFixed(0)})`).join('; ')}`)
  for (const { nome, fria, morna, maiorTarefa } of tempos) {
    expect(fria, `${nome}: fria`).toBeLessThanOrEqual(TETO_DA_IMAGEM_MS)
    expect(morna, `${nome}: mediana morna`).toBeLessThanOrEqual(TETO_DA_IMAGEM_MS)
    expect(maiorTarefa, `${nome}: tarefa longa`).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
  }
})

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

/** As 9 mesas e a retangular de 3 x 1, longe da ficha da Ana. */
function mapaDasMesas(): MapData {
  let map = setGridSettings(setShowGrid(createEmptyMap('meio-termo-mesas', 'Taverna', COLUNAS, LINHAS, GRADE), true), { color: '#6a6a6a', opacity: 0.6 })
  map = addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 960, y: 704, size: 1, image: null })
  COMBINACOES.forEach((c, i) => {
    const movel = criarMovel(c.tipo, { x: 128 + (i % 3) * 224, y: 128 + Math.floor(i / 3) * 192 }, GRADE, `mesa-${i}`)
    map = addProp(map, { ...movel, mobiliaCor: MATERIAIS[c.madeira].hex })
  })
  const comprida = criarMovel('mesa', { x: 832, y: 352 }, GRADE, 'mesa-3x1')
  return addProp(map, { ...comprida, width: 3 * GRADE, mobiliaCor: MATERIAIS.carvalho.hex })
}

function hostCom(map: MapData): (ws: WebSocketRoute) => void {
  const explored = encodeExploration(createExploration(map))
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(JSON.stringify({ type: 'snapshot', rev: 1, map, vision: [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)], explored, ownTokens: [FICHA], concealed: [], sceneName: map.name }))
    })
  }
}

/** O mesmo mapa sem os móveis: o controle do custo de abrir o jogador. */
function mapaSemMesas(): MapData {
  const map = mapaDasMesas()
  return { ...map, props: [] }
}

/**
 * Abre o jogador com o mapa e a chave ligada, espera a tela parar e devolve as
 * tarefas longas da abertura da página (antes de haver mapa: o Vite dev
 * avaliando o main de ~1,7 MB) e as que começam no clique em Entrar (o mapa
 * chegando, os móveis montados e as imagens geradas em fatias).
 */
async function abrirJogador(page: Page, map: MapData): Promise<{ abrindo: number[]; depoisDoEntrar: number[] }> {
  await observarTarefasLongas(page)
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(map))
  await page.goto('/player.html?obra=meio-termo')
  await page.getByLabel('Código da sala').fill('MESAS1')
  await page.getByLabel('Seu nome').fill('Ana')
  const abrindo = await tarefasLongas(page)
  const noClique = await page.evaluate(() => performance.now())
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  const canvas = page.locator('canvas').first()
  let anterior = ''
  await expect
    .poll(
      async () => {
        const atual = (await canvas.screenshot({ animations: 'disabled' })).toString('base64')
        const parada = atual === anterior
        anterior = atual
        return parada
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true)
  return { abrindo, depoisDoEntrar: await tarefasLongas(page, noClique) }
}

function resumo(t: { abrindo: number[]; depoisDoEntrar: number[] }): string {
  return `abrindo a página ${t.abrindo.length} tarefas longas (a maior ${Math.max(0, ...t.abrindo).toFixed(0)} ms); do Entrar à tela parada ${t.depoisDoEntrar.length} (a maior ${Math.max(0, ...t.depoisDoEntrar).toFixed(0)} ms)`
}

test('jogador com as 9 mesas e a de 3 x 1, chave de obra ligada: do Entrar até as imagens prontas, nenhuma tarefa longa >= 200 ms (controle: o mesmo mapa sem móveis)', async ({ browser }) => {
  test.setTimeout(120_000)
  const controle = await browser.newPage()
  const semMesas = await abrirJogador(controle, mapaSemMesas())
  await controle.close()
  const page = await browser.newPage()
  const comMesas = await abrirJogador(page, mapaDasMesas())
  await page.close()
  console.log(`[medida] jogador, chave ligada. Sem móveis: ${resumo(semMesas)}. Com as 10 mesas: ${resumo(comMesas)}`)
  expect(Math.max(0, ...comMesas.depoisDoEntrar)).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
})
