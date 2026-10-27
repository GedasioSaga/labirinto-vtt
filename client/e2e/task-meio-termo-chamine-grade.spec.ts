// CHAMINÉ E GRADE DE PRISÃO (fatia MT10 do Meio-Termo). Prova a costura que
// os testes de unidade não veem:
// 1. EDITOR com `?obra=meio-termo` (1280): o interruptor "Chaminé" do painel
//    da Sala grava a chaminé e o telhado na tela muda na caixa dela; Ctrl+Z
//    tira e a tela volta. Na janela selecionada, "Grade de prisão" grava a
//    grade e a parede na tela muda; Ctrl+Z volta. Nenhuma tarefa longa de
//    200 ms na página inteira.
// 2. EDITOR SEM a obra: nem "Chaminé" nem "Grade de prisão" aparecem (a tela
//    de hoje não muda).
// 3. TEMPO a 3x no Chromium: a pintura com a chaminé (telha e palha com a
//    cumeeira amarrada), fria (a primeira da página) e mediana morna de 9,
//    intercalada com a mesma pintura sem os extras.
// 4. PROVAS (só com GERAR_PROVAS_MT10=1): a folha de contato e o jogador a 1440.
import { writeFileSync } from 'node:fs'
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap, setShowGrid } from '../src/lib/mapFactory'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import { serializeMap, deserializeMap } from '../src/lib/mapFile'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../src/lib/telhado/paletas'
import { caixaDaChamine, chamineDoPoligono } from '../src/texturas/meioTermo/chamine'
import type { MapData, Region, RegionPoint, Wall } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

const GRADE = 50
const OBRA = '?obra=meio-termo'
/** O desenho de antes, pedido pela URL: desde a MT12 a obra é o padrão e "sem ela" é `?obra=linhas`. */
const SEM_OBRA = '?obra=linhas'
const PASTA_DO_MESTRE = 'C:/appdata/maps/map_mt10'
const PROVAS = '../docs/design/objetos/provas'
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT10 === '1'
const TETO_MS = 50
const TETO_DA_TAREFA_LONGA_MS = 200
const MORNAS = 9
/** Diferença de canal (0-255) a partir da qual o pixel "mudou". */
const MUDOU = 8

const BARRO = PALETA_DO_TETO.telhas[0].hex
const PALHA = PALETA_DO_TETO.palha[0].hex

/** A foto que o Playwright devolve. */
type Png = Awaited<ReturnType<Page['screenshot']>>

type Caixa = { x0: number; y0: number; x1: number; y1: number }
const CASA: Caixa = { x0: 100, y0: 100, x1: 400, y1: 300 }
const CASA_DE_PALHA: Caixa = { x0: 500, y0: 400, x1: 800, y1: 600 }

function anel(c: Caixa): RegionPoint[] {
  return [{ x: c.x0, y: c.y0 }, { x: c.x1, y: c.y0 }, { x: c.x1, y: c.y1 }, { x: c.x0, y: c.y1 }]
}

function sala(id: string, c: Caixa, modelo: ModeloDoTeto, cor: string, chamine: boolean): Region {
  return {
    id,
    points: anel(c),
    tag: '',
    fillColor: '#6b5a48',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id, roof: true, modeloDoTeto: modelo, corDoTeto: cor, ...(chamine ? { chamine: true as const } : {}) },
  }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** A cela: três paredes e a frente de janela (com ou sem a grade). */
function cela(grade: boolean): Wall[] {
  return [
    parede('cela-cima', 900, 100, 1100, 100),
    parede('cela-baixo', 900, 300, 1100, 300),
    parede('cela-fundo', 1100, 100, 1100, 300),
    parede('janela', 900, 100, 900, 300, { janela: true, ...(grade ? { grade: true as const } : {}) }),
  ]
}

function mapaDoMestre(): MapData {
  const map = setShowGrid(createEmptyMap('mt10-mestre', 'Vila', 24, 14, GRADE), false)
  return { ...map, regions: [sala('casa', CASA, 'telhas', BARRO, false)], walls: cela(false) }
}

function discoDoMestre(): Record<string, string> {
  const aventura = { version: 1, id: 'adv_mt10', name: 'Vila', startSceneId: 'scene_mt10', scenes: [{ id: 'scene_mt10', name: 'Vila', file: 'map.json' }] }
  return { [`${PASTA_DO_MESTRE}/map.json`]: serializeMap(mapaDoMestre()), [`${PASTA_DO_MESTRE}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

/** Guarda a duração de toda tarefa longa da página desde o começo. */
async function vigiarTarefasLongas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const janela = window as unknown as { __longas: number[] }
    janela.__longas = []
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) janela.__longas.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  })
}

/** Esquece as tarefas longas de até agora (a abertura do app e da aventura não é desta fatia). */
async function zerarTarefasLongas(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __longas: number[] }).__longas.length = 0
  })
}

async function maiorTarefaLonga(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, ...(window as unknown as { __longas: number[] }).__longas))
}

/** Recorte da tela do canvas em volta de uma caixa do MUNDO, pela câmera de agora (com folga). */
async function fotoDoMundo(page: Page, c: Caixa, folga = 6): Promise<Png> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('canvas sem caixa')
  const camera = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  const x = caixa.x + camera.x + c.x0 * camera.scale - folga
  const y = caixa.y + camera.y + c.y0 * camera.scale - folga
  return page.screenshot({ clip: { x, y, width: (c.x1 - c.x0) * camera.scale + 2 * folga, height: (c.y1 - c.y0) * camera.scale + 2 * folga }, animations: 'disabled' })
}

/** Fração dos pixels que mudam (algum canal >= MUDOU) entre duas fotos do mesmo tamanho. */
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

/** Espera a tela parar (duas fotos iguais seguidas) e devolve a última. */
async function fotoParada(page: Page, c: Caixa): Promise<Png> {
  let anterior: Png | null = null
  let atual: Png = await fotoDoMundo(page, c)
  for (let i = 0; i < 40; i += 1) {
    if (anterior !== null && anterior.equals(atual)) return atual
    anterior = atual
    await page.waitForTimeout(150)
    atual = await fotoDoMundo(page, c)
  }
  return atual
}

async function selecionar(page: Page, kind: 'region' | 'wall', id: string): Promise<void> {
  await page.evaluate(
    async ([k, i]) => {
      const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
      store.setActiveTool('select')
      store.setSelection([{ kind: k, id: i }])
    },
    [kind, id] as const,
  )
}

/**
 * Põe o centro da caixa no meio do canvas, no zoom pedido: os painéis
 * flutuam sobre as bordas do canvas, e a foto tem de ser só do mapa.
 */
async function centrar(page: Page, c: Caixa, escala: number): Promise<void> {
  await page.evaluate(
    async ([cx, cy, s]) => {
      // A câmera mora no PixiCanvas e só é espelhada na store: o pedido passa pela aventura.
      const aventura = await import('/src/stores/adventureStore.ts')
      const canvas = document.querySelector('canvas')
      const largura = canvas?.clientWidth ?? 800
      const altura = canvas?.clientHeight ?? 600
      aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: largura / 2 - cx * s, y: altura / 2 - cy * s, scale: s } } })
    },
    [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, escala] as const,
  )
  await expect.poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera.scale)).toBeCloseTo(escala, 3)
}

/** Abre a ficha recolhida "O que a parede deixa" (ela nasce fechada). */
async function abrirOQueAParedeDeixa(page: Page): Promise<void> {
  const cabeca = page.getByRole('button', { name: /O que a parede deixa/ })
  if ((await cabeca.getAttribute('aria-expanded')) === 'false') await cabeca.click()
}

const CAIXA_DA_CHAMINE = (() => {
  const c = chamineDoPoligono(anel(CASA))
  if (c === null) throw new Error('a casa do teste não tem lugar para a chaminé')
  return caixaDaChamine(c)
})()
const CAIXA_DA_JANELA: Caixa = { x0: 890, y0: 110, x1: 910, y1: 290 }

test.use({ trace: 'off', video: 'off', viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: 'reduce' } })

test('editor com a obra: Chaminé e Grade de prisão gravam com Ctrl+Z e mudam a tela; nenhuma tarefa de 200 ms', async ({ page }) => {
  test.setTimeout(180_000)
  await vigiarTarefasLongas(page)
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Vila', 'MT10A', `/${OBRA}`)
  await selecionar(page, 'region', 'casa')
  const chamine = page.getByRole('checkbox', { name: 'Chaminé' })
  await expect(chamine).toBeVisible()
  await expect(chamine).not.toBeChecked()
  await centrar(page, CAIXA_DA_CHAMINE, 3)
  const antes = await fotoParada(page, CAIXA_DA_CHAMINE)
  // Daqui em diante, só os cliques da fatia (ligar, desfazer, a grade) contam.
  await zerarTarefasLongas(page)
  await chamine.check()
  await expect.poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.regions[0]?.room?.chamine)).toBe(true)
  await expect.poll(async () => fracaoQueMuda(page, antes, await fotoDoMundo(page, CAIXA_DA_CHAMINE)), { timeout: 15_000 }).toBeGreaterThan(0.5)
  const depois = await fotoParada(page, CAIXA_DA_CHAMINE)
  console.log(`[medida] editor: a chaminé muda ${(100 * (await fracaoQueMuda(page, antes, depois))).toFixed(1)}% da caixa dela na tela`)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.regions[0]?.room?.chamine)).toBeUndefined()
  await expect.poll(async () => fracaoQueMuda(page, antes, await fotoDoMundo(page, CAIXA_DA_CHAMINE)), { timeout: 15_000 }).toBeLessThan(0.02)

  await selecionar(page, 'wall', 'janela')
  await abrirOQueAParedeDeixa(page)
  const grade = page.getByRole('checkbox', { name: 'Grade de prisão (barras de ferro)' })
  await expect(grade).toBeVisible()
  await centrar(page, CAIXA_DA_JANELA, 2)
  const janelaAntes = await fotoParada(page, CAIXA_DA_JANELA)
  await grade.check()
  await expect.poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.walls.find((w) => w.id === 'janela')?.grade)).toBe(true)
  await expect.poll(async () => fracaoQueMuda(page, janelaAntes, await fotoDoMundo(page, CAIXA_DA_JANELA)), { timeout: 15_000 }).toBeGreaterThan(0.1)
  console.log(`[medida] editor: a grade muda ${(100 * (await fracaoQueMuda(page, janelaAntes, await fotoParada(page, CAIXA_DA_JANELA)))).toFixed(1)}% da faixa da janela na tela`)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.walls.find((w) => w.id === 'janela')?.grade)).toBeUndefined()
  await expect.poll(async () => fracaoQueMuda(page, janelaAntes, await fotoDoMundo(page, CAIXA_DA_JANELA)), { timeout: 15_000 }).toBeLessThan(0.02)

  const maior = await maiorTarefaLonga(page)
  console.log(`[medida] editor com a obra: maior tarefa longa da página ${maior.toFixed(0)} ms`)
  expect(maior).toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
})

test('editor SEM a obra: nem Chaminé nem Grade de prisão aparecem', async ({ page }) => {
  test.setTimeout(120_000)
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Vila', 'MT10B', `/${SEM_OBRA}`)
  await selecionar(page, 'region', 'casa')
  await expect(page.getByRole('radiogroup', { name: 'Modelo do telhado' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Chaminé' })).toHaveCount(0)
  await selecionar(page, 'wall', 'janela')
  await abrirOQueAParedeDeixa(page)
  await expect(page.getByRole('checkbox', { name: 'Janela (vê, não passa)' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Grade de prisão/ })).toHaveCount(0)
})

/** Teto folgado da FRIA na suíte (a convenção do plano, seção 7: a fria depende de JIT e da carga; o critério de 50 ms é lido no relatório). */
const TETO_FRIO_DA_SUITE_MS = 100

test('tempo a 3x no Chromium: com a chaminé (e a cumeeira amarrada na palha), fria (página nova) e mediana morna de 9', async ({ browser }) => {
  test.setTimeout(240_000)
  const casos = [
    { nome: 'telha com chaminé', modelo: 'telhas', cor: BARRO, extras: { chamine: true } },
    { nome: 'telha sem nada', modelo: 'telhas', cor: BARRO, extras: {} },
    { nome: 'palha com chaminé e cumeeira', modelo: 'palha', cor: PALHA, extras: { chamine: true, cumeeiraAmarrada: true } },
    { nome: 'palha sem nada', modelo: 'palha', cor: PALHA, extras: {} },
  ] as const
  type Caso = (typeof casos)[number]
  // A pintura de um caso, no navegador (fria: a primeira da página; mornas: intercaladas, a carga pesa igual em todos).
  const medirNaPagina = async (page: Page, lista: readonly Caso[], mornas: number) =>
    page.evaluate(
      async ({ caminho, grade, mornas, lista }) => {
        const t = (await import(/* @vite-ignore */ caminho)) as typeof import('../src/texturas/telhado') // cast seguro: o módulo do pintor servido pelo Vite
        const pontos = [{ x: 0, y: 0 }, { x: 6 * grade, y: 0 }, { x: 6 * grade, y: 4 * grade }, { x: 0, y: 4 * grade }]
        const medir = (c: (typeof lista)[number]): number => {
          const t0 = performance.now()
          t.pintarTelhado(pontos, c.modelo, c.cor, 3, c.extras)
          return performance.now() - t0
        }
        const frias = lista.map((c) => medir(c))
        const tempos = lista.map(() => [] as number[])
        for (let i = 0; i < mornas; i += 1) lista.forEach((c, j) => tempos[j].push(medir(c)))
        const mediana = (l: number[]) => (l.length === 0 ? 0 : [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)])
        return lista.map((_, j) => ({ fria: frias[j], morna: mediana(tempos[j]) }))
      },
      { caminho: '/src/texturas/telhado.ts', grade: 64, mornas, lista },
    )
  // FRIA: cada caso numa PÁGINA NOVA (o motor frio, a mesma condição para todos).
  const frias: number[] = []
  for (const caso of casos) {
    const contexto = await browser.newContext()
    const pagina = await contexto.newPage()
    await pagina.goto('/player.html')
    frias.push((await medirNaPagina(pagina, [caso], 0))[0].fria)
    await contexto.close()
  }
  // MORNA: os 4 intercalados numa página só (o acréscimo dos extras sem o ruído entre páginas).
  const contexto = await browser.newContext()
  const pagina = await contexto.newPage()
  await pagina.goto('/player.html')
  const mornas = await medirNaPagina(pagina, casos, MORNAS)
  await contexto.close()
  const r = casos.map((c, j) => ({ nome: c.nome, fria: frias[j], morna: mornas[j].morna }))
  console.log(`[medida] Chromium, 6x4 casas de 64 a 3x (fria em página nova; morna intercalada, mediana de ${MORNAS}): ${r.map((m) => `${m.nome} fria ${m.fria.toFixed(1)} / morna ${m.morna.toFixed(1)} ms`).join('; ')}`)
  const [telha, telhaSem, palha, palhaSem] = r
  for (const m of [telha, palha]) {
    expect(m.morna, `${m.nome}, morna`).toBeLessThanOrEqual(TETO_MS)
    expect(m.fria, `${m.nome}, fria`).toBeLessThanOrEqual(TETO_FRIO_DA_SUITE_MS)
  }
  // O acréscimo dos extras na morna: a chaminé e a faixa custam pouco perto do telhado.
  expect(telha.morna - telhaSem.morna).toBeLessThan(5)
  expect(palha.morna - palhaSem.morna).toBeLessThan(8)
})

// ---------- provas (só quando pedidas) ----------

function mapaDoJogador(): MapData {
  let map = setShowGrid(createEmptyMap('mt10-jogador', 'Vila', 24, 14, GRADE), false)
  map = { ...map, regions: [sala('casa', CASA, 'telhas', BARRO, true), sala('estabulo', CASA_DE_PALHA, 'palha', PALHA, true)], walls: cela(true) }
  return addToken(map, { id: 'ficha-ana', characterId: null, name: 'Ana', x: 650, y: 200, size: 1, image: null })
}

function hostDoJogador(): (ws: WebSocketRoute) => void {
  const doArquivo = deserializeMap(serializeMap(mapaDoJogador()))
  const recorte = filterMapForPlayer(doArquivo, 'p-ana', { 'p-ana': ['ficha-ana'] }, 24 * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(doArquivo)).map
  if (recorte.regions.some((r) => r.room?.chamine !== true)) throw new Error('o recorte perdeu a chaminé')
  if (recorte.walls.find((w) => w.id === 'janela')?.grade !== true) throw new Error('o recorte perdeu a grade')
  const explored = encodeExploration(createExploration(doArquivo))
  const snapshot = JSON.stringify({ type: 'snapshot', rev: 1, map: recorte, vision: [anel({ x0: 0, y0: 0, x1: 24 * GRADE, y1: 14 * GRADE })], explored, ownTokens: ['ficha-ana'], concealed: [], sceneName: doArquivo.name })
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(snapshot)
    })
  }
}

test('provas: jogador a 1440 com a obra (chaminé na telha e na palha, grade na cela)', async ({ browser }) => {
  test.skip(!GERAR_PROVAS, 'só com GERAR_PROVAS_MT10=1')
  test.setTimeout(120_000)
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await contexto.newPage()
  await page.routeWebSocket((url) => url.pathname === '/ws', hostDoJogador())
  await page.goto(`/player.html${OBRA}`)
  await page.getByLabel('Código da sala').fill('MT10JG')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
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
  await page.screenshot({ path: `${PROVAS}/mt10-jogador-1440.png` })
  await contexto.close()
})

test('provas: folha de contato da MT10 (telhados com e sem chaminé, a palha amarrada, a grade em 3 zooms, claro e escuro)', async ({ page }) => {
  test.skip(!GERAR_PROVAS, 'só com GERAR_PROVAS_MT10=1')
  test.setTimeout(240_000)
  // A grade de verdade (Pixi do editor), em 3 zooms, antes (janela) e depois (grade).
  await abrirAventuraDeMentira(page, discoDoMestre(), 'Vila', 'MT10F', `/${OBRA}`)
  const fotosDaGrade: { rotulo: string; png: string; ms: number }[] = []
  for (const [escala, grade] of [[1, false], [0.5, true], [1, true], [3, true]] as const) {
    const ms = await page.evaluate(
      async ([s, g]) => {
        const store = (await import('/src/stores/mapStore.ts')).useMapStore
        const walls = store.getState().map.walls.map((w) => (w.id === 'janela' ? { ...w, grade: g ? (true as const) : undefined } : w))
        store.getState().setSelection([])
        store.setState({ map: { ...store.getState().map, walls } })
        // O custo de montar o desenho das paredes, medido à parte com um Graphics de mentira
        // (cada método devolve ele mesmo): só o cálculo do desenho, sem a GPU.
        const { drawWalls } = await import('/src/pixi/drawWalls.ts')
        const falso: Record<string, unknown> = new Proxy({}, { get: () => () => falso })
        const t0 = performance.now()
        for (let i = 0; i < 20; i += 1) drawWalls(falso as unknown as Parameters<typeof drawWalls>[0], walls, null, s, 1) // cast seguro: drawWalls só chama métodos encadeáveis do Graphics
        return (performance.now() - t0) / 20
      },
      [escala, grade] as const,
    )
    const largura = 260
    const caixa = { x0: 900 - largura / 2 / escala, y0: 200 - largura / 2 / escala, x1: 900 + largura / 2 / escala, y1: 200 + largura / 2 / escala }
    await centrar(page, caixa, escala)
    const png = await fotoParada(page, caixa)
    fotosDaGrade.push({ rotulo: `${grade ? 'GRADE DEPOIS' : 'JANELA ANTES'} ZOOM ${Math.round(escala * 100)}%`, png: png.toString('base64'), ms })
  }
  const folha = await page.evaluate(
    async ({ grade, fotos, barro, palha, ardosia, musgo, casas }) => {
      const t = (await import('/src/texturas/telhado.ts')) as typeof import('../src/texturas/telhado') // cast seguro: o módulo do pintor servido pelo Vite
      const ch = (await import('/src/texturas/meioTermo/chamine.ts')) as typeof import('../src/texturas/meioTermo/chamine') // cast seguro: idem
      const GRAMA = '#56693f'
      const pontos = (c: number, l: number) => [{ x: 0, y: 0 }, { x: c * grade, y: 0 }, { x: c * grade, y: l * grade }, { x: 0, y: l * grade }]
      type Quadro = { rotulo: string; tempo: string; tela: HTMLCanvasElement }
      const quadros: Quadro[] = []
      const telaDe = (img: ReturnType<typeof t.pintarTelhado>, zoom: number, recorte: { x0: number; y0: number; x1: number; y1: number } | null): HTMLCanvasElement => {
        const fonte = document.createElement('canvas')
        fonte.width = img.largura
        fonte.height = img.altura
        fonte.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(img.pixels), img.largura, img.altura), 0, 0)
        const r = recorte ?? { x0: img.origemX, y0: img.origemY, x1: img.origemX + img.largura / img.escala, y1: img.origemY + img.altura / img.escala }
        const tela = document.createElement('canvas')
        tela.width = Math.round((r.x1 - r.x0) * zoom)
        tela.height = Math.round((r.y1 - r.y0) * zoom)
        const g = tela.getContext('2d')
        if (g === null) return tela
        g.fillStyle = GRAMA
        g.fillRect(0, 0, tela.width, tela.height)
        g.imageSmoothingEnabled = true
        g.imageSmoothingQuality = 'high'
        g.drawImage(fonte, (r.x0 - img.origemX) * img.escala, (r.y0 - img.origemY) * img.escala, (r.x1 - r.x0) * img.escala, (r.y1 - r.y0) * img.escala, 0, 0, tela.width, tela.height)
        return tela
      }
      const pintar = (rotulo: string, modelo: 'telhas' | 'palha', cor: string, extras: { chamine?: boolean; cumeeiraAmarrada?: boolean }, zoom: number, foco: 'chamine' | 'cume' | null) => {
        const p = pontos(casas.c, casas.l)
        t.pintarTelhado(p, modelo, cor, 1, extras)
        const t0 = performance.now()
        const img = t.pintarTelhado(p, modelo, cor, 1, extras)
        const ms = performance.now() - t0
        let recorte: { x0: number; y0: number; x1: number; y1: number } | null = null
        if (foco === 'chamine') {
          const c = ch.chamineDoPoligono(p)
          if (c !== null) recorte = { x0: c.x - 30, y0: c.y - 30, x1: c.x + 30, y1: c.y + 30 }
        } else if (foco === 'cume') {
          recorte = { x0: casas.c * grade * 0.5 - 30, y0: casas.l * grade * 0.5 - 30, x1: casas.c * grade * 0.5 + 30, y1: casas.l * grade * 0.5 + 30 }
        }
        quadros.push({ rotulo, tempo: `pintura a 1x ${ms.toFixed(1)} ms`, tela: telaDe(img, zoom, recorte) })
      }
      pintar('TELHA ANTES 1X', 'telhas', barro, {}, 1, null)
      pintar('TELHA DEPOIS 1X (CHAMINE)', 'telhas', barro, { chamine: true }, 1, null)
      pintar('TELHA DEPOIS ZOOM 300%', 'telhas', barro, { chamine: true }, 3, 'chamine')
      pintar('PALHA ANTES 1X', 'palha', palha, {}, 1, null)
      pintar('PALHA DEPOIS 1X (CHAMINE+CUME)', 'palha', palha, { chamine: true, cumeeiraAmarrada: true }, 1, null)
      pintar('PALHA ANTES ZOOM 300% (CUME)', 'palha', palha, {}, 3, 'cume')
      pintar('PALHA DEPOIS ZOOM 300% (CUME)', 'palha', palha, { chamine: true, cumeeiraAmarrada: true }, 3, 'cume')
      pintar('PALHA DEPOIS ZOOM 300% (CHAMINE)', 'palha', palha, { chamine: true, cumeeiraAmarrada: true }, 3, 'chamine')
      pintar('ESCURO: ARDOSIA DEPOIS 1X', 'telhas', ardosia, { chamine: true }, 1, null)
      pintar('ESCURO: ARDOSIA ZOOM 300%', 'telhas', ardosia, { chamine: true }, 3, 'chamine')
      pintar('ESCURO: PALHA MUSGO DEPOIS 1X', 'palha', musgo, { chamine: true, cumeeiraAmarrada: true }, 1, null)
      for (const f of fotos) {
        const imagem = new Image()
        imagem.src = `data:image/png;base64,${f.png}`
        await imagem.decode()
        const tela = document.createElement('canvas')
        tela.width = imagem.width
        tela.height = imagem.height
        tela.getContext('2d')?.drawImage(imagem, 0, 0)
        quadros.push({ rotulo: f.rotulo, tempo: `desenho da parede ${f.ms.toFixed(2)} ms`, tela })
      }
      const COLUNAS = 4
      const MARGEM = 24
      const LEGENDA = 44
      const larguraDoQuadro = Math.max(...quadros.map((q) => q.tela.width))
      const alturaDoQuadro = Math.max(...quadros.map((q) => q.tela.height))
      const linhas = Math.ceil(quadros.length / COLUNAS)
      const folha = document.createElement('canvas')
      folha.width = MARGEM + COLUNAS * (larguraDoQuadro + MARGEM)
      folha.height = MARGEM + 40 + linhas * (alturaDoQuadro + LEGENDA + MARGEM)
      const g = folha.getContext('2d')
      if (g === null) throw new Error('sem 2D')
      g.fillStyle = '#1d211b'
      g.fillRect(0, 0, folha.width, folha.height)
      g.fillStyle = '#f2ead8'
      g.font = 'bold 18px sans-serif'
      g.fillText('MT10 - chaminé, cumeeira amarrada e grade de prisão (obra do Meio-Termo ligada)', MARGEM, MARGEM + 14)
      quadros.forEach((q, i) => {
        const x = MARGEM + (i % COLUNAS) * (larguraDoQuadro + MARGEM)
        const y = MARGEM + 40 + Math.floor(i / COLUNAS) * (alturaDoQuadro + LEGENDA + MARGEM)
        g.drawImage(q.tela, x + (larguraDoQuadro - q.tela.width) / 2, y + (alturaDoQuadro - q.tela.height) / 2)
        g.fillStyle = '#f2ead8'
        g.font = 'bold 13px sans-serif'
        g.fillText(q.rotulo, x, y + alturaDoQuadro + 18)
        g.font = '12px sans-serif'
        g.fillStyle = '#c9c2b0'
        g.fillText(q.tempo, x, y + alturaDoQuadro + 36)
      })
      return { png: folha.toDataURL('image/png').split(',')[1], quadros: quadros.length }
    },
    { grade: GRADE, fotos: fotosDaGrade, barro: BARRO, palha: PALHA, ardosia: PALETA_DO_TETO.telhas.find((c) => /ard/i.test(c.id))?.hex ?? PALETA_DO_TETO.telhas[PALETA_DO_TETO.telhas.length - 1].hex, musgo: PALETA_DO_TETO.palha[5].hex, casas: { c: 6, l: 4 } },
  )
  expect(folha.quadros).toBeGreaterThanOrEqual(12)
  expect(folha.quadros).toBeLessThanOrEqual(16)
  writeFileSync(`${PROVAS}/mt10-folha-de-contato.png`, Buffer.from(folha.png, 'base64'))
})
