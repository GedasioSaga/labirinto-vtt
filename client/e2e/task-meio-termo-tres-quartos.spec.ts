// VISTA 3/4 DOS MÓVEIS (Meio-Termo, MT11), no Chromium (Vite dev), só PC:
// 1. Tempo a 3x de CADA tipo do catálogo em 3/4, com a semente do app
//    (`chaveDoMovel`): a fria (a primeira imagem de uma página nova, motor
//    frio; teto registrado de 100 ms, convenção da seção 7 do plano) e a
//    mediana morna de 5 (teto de 50 ms), sem tarefa longa >= 200 ms.
// 2. O jogador com uma sala mobiliada em 3/4 e a obra ligada (`?obra=meio-termo`),
//    o mapa passado pelo recorte de verdade (`filterMapForPlayer`): do Entrar
//    à tela parada, nenhuma tarefa longa >= 200 ms e o p95 do intervalo entre
//    quadros <= 20 ms (controle: a mesma sala "de cima").
// 3. PROVA (só com GERAR_PROVAS_MT11=1): o jogador a 1440 com a sala em 3/4.
import { writeFileSync } from 'node:fs'
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addProp, addToken, createEmptyMap, setShowGrid } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { TIPOS_MOBILIA } from '../src/lib/mobilia/tipos'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import { deserializeMap, serializeMap } from '../src/lib/mapFile'
import { MATERIAIS } from '../src/texturas/meioTermo/materiais'
import type { MapData, Prop, Region, RegionPoint, TipoMobilia, Wall } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

const GRADE = 64
const COLUNAS = 22
const LINHAS = 14
const CASA = 50
const TETO_MORNA_MS = 50
const TETO_FRIA_MS = 100
const TETO_DA_TAREFA_LONGA_MS = 200
const TETO_DO_P95_DO_QUADRO_MS = 20
const MORNAS = 5
const JANELA_DOS_QUADROS_MS = 3000
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT11 === '1'
const DESTINO_DO_JOGADOR = '../docs/design/objetos/provas/mt11-jogador-1440.png'

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

async function observarTarefasLongas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const longas: number[] = []
    Object.defineProperty(window, '__tarefasLongasMt11', { value: longas })
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) longas.push(e.startTime, e.duration)
    }).observe({ type: 'longtask', buffered: true })
  })
}

async function tarefasLongas(page: Page, desde = 0): Promise<number[]> {
  const pares = await page.evaluate(() => {
    const v: unknown = Reflect.get(window, '__tarefasLongasMt11')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  })
  const duracoes: number[] = []
  for (let i = 0; i + 1 < pares.length; i += 2) if (pares[i] >= desde) duracoes.push(pares[i + 1])
  return duracoes
}

test('tempo a 3x de cada tipo do catálogo em 3/4, semente do app: fria <= 100 ms (registrada), mediana morna <= 50 ms, sem tarefa longa >= 200 ms', async ({ browser }) => {
  test.setTimeout(300_000)
  const tempos: { tipo: TipoMobilia; fria: number; morna: number; maiorTarefa: number }[] = []
  for (const tipo of TIPOS_MOBILIA) {
    const page = await browser.newPage()
    await observarTarefasLongas(page)
    await page.goto('/player.html')
    const prop: Prop = { ...criarMovel(tipo, { x: 0, y: 0 }, CASA, `e2e-${tipo}`), mobiliaCor: MATERIAIS.carvalho.hex }
    const medida = await page.evaluate(
      async ({ p, mornasPedidas }) => {
        const moveis = (await import(/* @vite-ignore */ '/src/texturas/meioTermo/moveis/index.ts')) as typeof import('../src/texturas/meioTermo/moveis') // cast seguro: o módulo servido pelo Vite
        const raster = (await import(/* @vite-ignore */ '/src/pixi/rasterDosMoveis.ts')) as typeof import('../src/pixi/rasterDosMoveis') // idem
        const chave = raster.chaveDoMovel(p, 3, 1, 'tres-quartos')
        if (chave === null) throw new Error('sem desenho com textura')
        const medir = (): number => {
          const t0 = performance.now()
          moveis.pintarMovel(chave.desenho, moveis.escalaDoNivel(3))
          return performance.now() - t0
        }
        // Uma pintura por tarefa (o app pinta em fatias de 8 ms): sem a folga, as 6 medidas juntas viravam UMA tarefa longa da medida.
        const folga = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
        const fria = medir()
        const mornas: number[] = []
        for (let i = 0; i < mornasPedidas; i += 1) {
          await folga()
          mornas.push(medir())
        }
        mornas.sort((a, b) => a - b)
        return { fria, morna: mornas[Math.floor(mornasPedidas / 2)] }
      },
      { p: prop, mornasPedidas: MORNAS },
    )
    tempos.push({ tipo, ...medida, maiorTarefa: Math.max(0, ...(await tarefasLongas(page))) })
    await page.close()
  }
  console.log(`[medida] 3/4 a 3x no Chromium, fria / mediana morna de ${MORNAS} (maior tarefa longa da página): ${tempos.map((t) => `${t.tipo} ${t.fria.toFixed(1)} / ${t.morna.toFixed(1)} (${t.maiorTarefa.toFixed(0)})`).join('; ')}`)
  for (const { tipo, fria, morna, maiorTarefa } of tempos) {
    expect(fria, `${tipo}: fria`).toBeLessThanOrEqual(TETO_FRIA_MS)
    expect(morna, `${tipo}: mediana morna`).toBeLessThanOrEqual(TETO_MORNA_MS)
    expect(maiorTarefa, `${tipo}: tarefa longa`).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
  }
})

// ---------- o jogador com a sala mobiliada ----------

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

const SALA = { x0: 2 * GRADE, y0: 2 * GRADE, x1: 18 * GRADE, y1: 12 * GRADE }

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function salaMobiliada(vista: MapData['vistaDosMoveis']): MapData {
  let map = setShowGrid(createEmptyMap('mt11-jogador', 'Taverna', COLUNAS, LINHAS, GRADE), false)
  const sala: Region = { id: 'taverna', points: anel(SALA.x0, SALA.y0, SALA.x1, SALA.y1), tag: '', fillColor: '#6b5a48', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Taverna' } }
  map = {
    ...map,
    regions: [sala],
    walls: [parede('n', SALA.x0, SALA.y0, SALA.x1, SALA.y0), parede('s', SALA.x0, SALA.y1, SALA.x1, SALA.y1), parede('o', SALA.x0, SALA.y0, SALA.x0, SALA.y1), parede('l', SALA.x1, SALA.y0, SALA.x1, SALA.y1)],
    ...(vista === undefined ? {} : { vistaDosMoveis: vista }),
  }
  const g = (casas: number): number => casas * GRADE
  const poe = (tipo: TipoMobilia, x: number, y: number, extra: Partial<Prop> = {}): void => {
    map = addProp(map, { ...criarMovel(tipo, { x: g(x), y: g(y) }, GRADE, `${tipo}-${x}-${y}`), ...extra })
  }
  poe('tapete', 9, 7.5, { width: g(4), height: g(3) })
  poe('mesa', 9, 7, { width: g(2), height: g(1), mobiliaCor: MATERIAIS.carvalho.hex })
  poe('cadeira', 8.5, 6.2)
  poe('cadeira', 9.5, 7.9, { rotation: 180 })
  poe('mesaRedonda', 13.5, 9, { mobiliaCor: MATERIAIS.nogueira.hex })
  poe('catre', 3.2, 4)
  poe('catre', 4.6, 4, { mobiliaCor: MATERIAIS.nogueira.hex })
  poe('bau', 3.5, 6, { mobiliaCor: MATERIAIS.velha.hex })
  poe('armario', 7, 2.7)
  poe('aparador', 12, 2.6)
  poe('barril', 16.8, 3.2)
  poe('barril', 16.2, 3.9, { mobiliaCor: MATERIAIS.nogueira.hex })
  poe('caixa', 17, 5)
  poe('fogueira', 15.5, 10.4)
  poe('lampiao', 5.5, 9.5)
  poe('vaso', 2.7, 11.2)
  poe('mesaQuadrada', 6, 10.5, { mobiliaCor: MATERIAIS.velha.hex })
  return addToken(map, { id: 'ficha-ana', characterId: null, name: 'Ana', x: g(11), y: g(5), size: 1, image: null })
}

function hostCom(mapa: MapData): (ws: WebSocketRoute) => void {
  const doArquivo = deserializeMap(serializeMap(mapa))
  const recorte = filterMapForPlayer(doArquivo, 'p-ana', { 'p-ana': ['ficha-ana'] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(doArquivo)).map
  if (recorte.vistaDosMoveis !== mapa.vistaDosMoveis) throw new Error('o recorte não levou a vista dos móveis')
  const explored = encodeExploration(createExploration(doArquivo))
  const snapshot = JSON.stringify({ type: 'snapshot', rev: 1, map: recorte, vision: [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)], explored, ownTokens: ['ficha-ana'], concealed: [], sceneName: doArquivo.name })
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(snapshot)
    })
  }
}

interface Abertura {
  readonly longas: number[]
  readonly p95: number
  readonly quadros: number
}

/** Abre o jogador, mede os quadros por 3 s a partir do Entrar e espera a tela parar. */
async function abrirJogador(page: Page, mapa: MapData): Promise<Abertura> {
  await observarTarefasLongas(page)
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(mapa))
  await page.goto('/player.html?obra=meio-termo')
  await page.getByLabel('Código da sala').fill('MT11JG')
  await page.getByLabel('Seu nome').fill('Ana')
  const noClique = await page.evaluate(() => performance.now())
  const quadros = page.evaluate(
    (janela) =>
      new Promise<number[]>((resolve) => {
        const deltas: number[] = []
        let antes = performance.now()
        const fim = antes + janela
        const passo = (agora: number): void => {
          deltas.push(agora - antes)
          antes = agora
          if (agora < fim) requestAnimationFrame(passo)
          else resolve(deltas)
        }
        requestAnimationFrame(passo)
      }),
    JANELA_DOS_QUADROS_MS,
  )
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  const deltas = (await quadros).slice(1).sort((a, b) => a - b)
  let anterior = ''
  await expect
    .poll(
      async () => {
        const atual = (await page.locator('canvas').first().screenshot({ animations: 'disabled' })).toString('base64')
        const parada = atual === anterior
        anterior = atual
        return parada
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true)
  return { longas: await tarefasLongas(page, noClique), p95: deltas[Math.floor(deltas.length * 0.95)] ?? Infinity, quadros: deltas.length }
}

function resumo(a: Abertura): string {
  return `${a.longas.length} tarefas longas (a maior ${Math.max(0, ...a.longas).toFixed(0)} ms), p95 do quadro ${a.p95.toFixed(1)} ms em ${a.quadros} quadros`
}

test('jogador com a sala mobiliada em 3/4 e a obra ligada: tarefa longa < 200 ms e p95 do quadro <= 20 ms (controle: a sala de cima)', async ({ browser }) => {
  test.setTimeout(120_000)
  const controle = await browser.newPage()
  const deCima = await abrirJogador(controle, salaMobiliada(undefined))
  await controle.close()
  const page = await browser.newPage()
  const tres = await abrirJogador(page, salaMobiliada('tres-quartos'))
  await page.close()
  console.log(`[medida] jogador 1440, obra ligada, 17 móveis. De cima: ${resumo(deCima)}. Em 3/4: ${resumo(tres)}`)
  expect(Math.max(0, ...tres.longas)).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
  expect(tres.p95).toBeLessThanOrEqual(TETO_DO_P95_DO_QUADRO_MS)
})

// ---------- o editor de verdade: o interruptor "Vista 3/4" ----------

const PASTA_DO_MESTRE = 'C:/appdata/maps/map_mt11'
/** Diferença de canal (0-255) a partir da qual o pixel "mudou". */
const MUDOU = 8
type Png = Awaited<ReturnType<Page['screenshot']>>

function discoDoMestre(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_mt11', name: 'Taverna', startSceneId: 'scene_mt11', scenes: [{ id: 'scene_mt11', name: 'Taverna', file: 'map.json' }] }
  return { [`${PASTA_DO_MESTRE}/map.json`]: serializeMap(salaMobiliada(undefined)), [`${PASTA_DO_MESTRE}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

async function fotoDoCanvas(page: Page): Promise<Png> {
  return page.locator('canvas').first().screenshot({ animations: 'disabled' })
}

async function fotoParada(page: Page): Promise<Png> {
  let anterior = await fotoDoCanvas(page)
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(150)
    const atual = await fotoDoCanvas(page)
    if (atual.equals(anterior)) return atual
    anterior = atual
  }
  return anterior
}

async function fracaoQueMuda(page: Page, a: Png, b: Png): Promise<number> {
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
      if (x.width !== y.width || x.height !== y.height) return 1
      let n = 0
      for (let i = 0; i < x.data.length; i += 4) {
        if (Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2])) >= mudou) n += 1
      }
      return n / (x.width * x.height)
    },
    [a.toString('base64'), b.toString('base64'), MUDOU] as const,
  )
}

async function vistaNaStore(page: Page): Promise<string | null> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.vistaDosMoveis ?? null)
}

test('editor com a obra: "Vista 3/4" no painel do móvel muda a tela, grava no mapa e volta com Ctrl+Z; nenhuma tarefa de 200 ms', async ({ page }) => {
  test.setTimeout(180_000)
  await observarTarefasLongas(page)
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Taverna', 'MT11A', '/?obra=meio-termo')
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'prop', id: 'mesa-9-7' }])
  })
  const interruptor = page.getByRole('checkbox', { name: 'Vista 3/4' })
  await expect(interruptor).toBeVisible()
  await expect(interruptor).not.toBeChecked()
  const antes = await fotoParada(page)
  const noClique = await page.evaluate(() => performance.now())
  await interruptor.check()
  await expect.poll(() => vistaNaStore(page)).toBe('tres-quartos')
  const depois = await fotoParada(page)
  const mudou = await fracaoQueMuda(page, antes, depois)
  await page.keyboard.press('Control+z')
  await expect.poll(() => vistaNaStore(page)).toBeNull()
  await expect(interruptor).not.toBeChecked()
  const desfeita = await fotoParada(page)
  const sobrou = await fracaoQueMuda(page, antes, desfeita)
  const longas = await tarefasLongas(page, noClique)
  console.log(`[medida] editor: a 3/4 muda ${(100 * mudou).toFixed(1)}% do canvas; depois do Ctrl+Z sobra ${(100 * sobrou).toFixed(2)}%; maior tarefa longa nos cliques ${Math.max(0, ...longas).toFixed(0)} ms`)
  expect(mudou).toBeGreaterThan(0.01)
  expect(sobrou).toBeLessThan(0.002)
  expect(Math.max(0, ...longas)).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
})

test('prova: o jogador a 1440 com a sala mobiliada em 3/4', async ({ browser }) => {
  test.skip(!GERAR_PROVAS, 'só com GERAR_PROVAS_MT11=1')
  test.setTimeout(120_000)
  const page = await browser.newPage()
  await abrirJogador(page, salaMobiliada('tres-quartos'))
  // O painel recolhido deixa a sala inteira à vista (aberto, a cama e o baú ficam por baixo dele).
  await page.getByRole('button', { name: 'Painel' }).first().click()
  await page.waitForTimeout(600)
  writeFileSync(DESTINO_DO_JOGADOR, await page.screenshot({ animations: 'disabled' }))
  await page.close()
})
