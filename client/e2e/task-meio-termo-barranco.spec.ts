// BARRANCO LISO (fatia MT8 do Meio-Termo, atrás da chave de obra). A parede
// do penhasco deixa as 6 faixas e vira preenchimento liso, com realce em
// cima, sombra embaixo e contorno fino no pé. Os testes de unidade medem na
// tela falsa (`relevoRaster.test.ts`); este spec mede no canvas de verdade do
// Chromium, com o antialias:
// 1. PIXELS: a textura que `rasterizarRelevo` gera para uma costa com as 3
//    alturas (Baixo, Médio, Alto), com `?obra=meio-termo` e sem ela. Com a
//    obra: energia de borda (Sobel) abaixo do teto, contorno nunca abaixo da
//    luminância 0,06 e visível contra a parede (OKLab), cor contida. Sem a
//    obra (o barranco antigo): reprova nos mesmos limites.
// 2. TEMPO: a mesma textura fria e morna, e na CPU 4x (CDP) a maior tarefa
//    longa da geração, com e sem a obra.
// 3. JOGADOR a 390 px na CPU 4x: o mapa com relevo e penhasco passa pelo
//    recorte REAL (`filterMapForPlayer`) e pela rede; com e sem a obra:
//    primeira textura do relevo pronta, p95 do quadro e tarefas longas.
// A folha de contato (antes e depois, 3 zooms, 3 alturas) só é regravada com
// GERAR_PROVAS_MT8=1.
import { writeFileSync } from 'node:fs'
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { addToken, createEmptyMap, setRelevo, setShowGrid } from '../src/lib/mapFactory'
import { comPenhascos } from '../src/lib/penhasco'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import { deserializeMap, serializeMap } from '../src/lib/mapFile'
import type { MapData, Region, RegionPoint, TracoDePenhasco } from '../src/types/map'

test.use({ trace: 'off', video: 'off', viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

const PROVAS = '../docs/design/objetos/provas'
const GERAR_PROVAS = process.env.GERAR_PROVAS_MT8 === '1'
const OBRA = '?obra=meio-termo'

/** O mapa da medida: 60 x 40 casas de 50 px (3000 x 2000 de mundo), a ilha de 200 a 2800 por 200 a 1200. */
const GRADE = 50
const COLUNAS = 60
const LINHAS = 40
const COSTA_Y = 1200

/** Os limites do teste de unidade, agora no canvas de verdade (com antialias). */
const ENERGIA_MAXIMA = 0.02
const PISO_DO_CONTORNO = 0.06
const CONTRASTE_DO_CONTORNO = 0.06
const SATURACAO_MAXIMA = 0.62
/** Regra da casa: nenhuma tarefa de 200 ms ou mais. */
const TETO_DA_TAREFA_LONGA_MS = 200

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

const ILHA: Region = { id: 'ilha', points: anel(200, 200, 2800, COSTA_Y), tag: 'region', fillColor: '#8cbf80', fillPattern: 'solid', data: {} }

function risco(id: string, de: number, ate: number, altura: TracoDePenhasco['altura']): TracoDePenhasco {
  const pontos: RegionPoint[] = []
  for (let x = de; x <= ate; x += 20) pontos.push({ x, y: COSTA_Y })
  return { id, modo: 'riscar', raio: 40, pontos, ...(altura === undefined ? {} : { altura }) }
}

/** Baixo, Médio e Alto em sequência na costa de baixo (as emendas ganham a rampa). */
const RISCOS: TracoDePenhasco[] = [risco('b', 300, 1100, 'baixo'), risco('m', 1100, 1900, undefined), risco('a', 1900, 2700, 'alto')]
/** O miolo de cada altura (longe das rampas), em x de mundo. */
const TRECHOS = [
  { nome: 'Baixo', de: 520, ate: 880 },
  { nome: 'Médio', de: 1320, ate: 1680 },
  { nome: 'Alto', de: 2120, ate: 2480 },
] as const

interface MedidaDoTrecho {
  nome: string
  pixels: number
  energia: number
  contornoMinimo: number
  luzMinima: number
  contrasteDoPe: number
  saturacaoP95: number
}

interface MedidaDaTextura {
  ms: number
  largura: number
  altura: number
  trechos: MedidaDoTrecho[]
}

/**
 * Gera a textura do relevo NA PÁGINA (o módulo servido pelo Vite, com a chave
 * que a URL da página ligou ou não) e mede o miolo de cada altura. Parede =
 * alfa >= 242 (a sombra no mar não passa de 0,55 e a luz da terra de 0,5).
 */
async function medirTextura(page: Page): Promise<MedidaDaTextura> {
  return page.evaluate(
    async ({ mapa, ilha, riscos, trechos }) => {
      const relevo = (await import(/* @vite-ignore */ '/src/lib/relevo.ts')) as typeof import('../src/lib/relevo') // cast seguro: o caminho é este mesmo módulo servido pelo Vite
      const raster = (await import(/* @vite-ignore */ '/src/pixi/relevoRaster.ts')) as typeof import('../src/pixi/relevoRaster') // cast seguro: idem
      const plano = relevo.planoDoRelevo(mapa, [ilha], [], undefined, riscos)
      if (plano === null) throw new Error('sem terra')
      const t0 = performance.now()
      const tela = await raster.rasterizarRelevo(plano, () => false)
      const ms = performance.now() - t0
      if (tela === null) throw new Error('sem textura')
      const g = tela.getContext('2d')
      if (g === null) throw new Error('sem canvas 2D')
      const { width: w, height: h } = tela
      const d = g.getImageData(0, 0, w, h).data
      const parede = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] >= 242
      const cor = (i: number, j: number): [number, number, number] => {
        const k = (j * w + i) * 4
        const a = d[k + 3] / 255
        return [d[k] / a, d[k + 1] / a, d[k + 2] / a]
      }
      const linear = (c: number) => {
        const u = Math.min(1, c / 255)
        return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
      }
      const oklab = (c: [number, number, number]): [number, number, number] => {
        const [r, gg, b] = c.map(linear)
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * b)
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * b)
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * b)
        return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
      }
      const luma = (i: number, j: number) => {
        const [r, gg, b] = cor(i, j)
        return (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255
      }
      const coluna = (x: number) => Math.floor((x - plano.retangulo.x) * plano.escala)
      const medidas = trechos.map(({ nome, de, ate }) => {
        let pixels = 0
        let somaEnergia = 0
        let miolo = 0
        let contornoMinimo = Infinity
        let luzMinima = Infinity
        const saturacoes: number[] = []
        const pe: number[][] = []
        const acima: number[][] = []
        for (let i = coluna(de); i <= coluna(ate); i += 1) {
          for (let j = 0; j < h; j += 1) {
            if (!parede(i, j)) continue
            pixels += 1
            const c = cor(i, j)
            const lum = 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2])
            luzMinima = Math.min(luzMinima, lum)
            const mx = Math.max(...c)
            saturacoes.push(mx > 0 ? (mx - Math.min(...c)) / mx : 0)
            if (!parede(i - 1, j) || !parede(i + 1, j) || !parede(i, j - 1) || !parede(i, j + 1)) contornoMinimo = Math.min(contornoMinimo, lum)
            if (!parede(i, j + 1) && [1, 2, 3, 4].every((k) => parede(i, j - k))) {
              pe.push(oklab(c))
              acima.push(oklab(cor(i, j - 4)))
            }
            let todos = true
            for (let dj = -1; dj <= 1 && todos; dj += 1) for (let di = -1; di <= 1 && todos; di += 1) todos = parede(i + di, j + dj)
            if (!todos) continue
            const p = (di: number, dj: number) => luma(i + di, j + dj)
            const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1)
            const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1)
            somaEnergia += Math.hypot(gx, gy) / 8
            miolo += 1
          }
        }
        saturacoes.sort((a, b) => a - b)
        const media = (l: number[][]) => [0, 1, 2].map((k) => l.reduce((s, v) => s + v[k], 0) / Math.max(1, l.length))
        const [pa, pb] = [media(pe), media(acima)]
        return {
          nome,
          pixels,
          energia: miolo > 0 ? somaEnergia / miolo : 0,
          contornoMinimo,
          luzMinima,
          contrasteDoPe: Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]),
          saturacaoP95: saturacoes.length > 0 ? saturacoes[Math.floor(saturacoes.length * 0.95)] : 0,
        }
      })
      tela.width = 0
      tela.height = 0
      return { ms, largura: w, altura: h, trechos: medidas }
    },
    { mapa: { width: COLUNAS, height: LINHAS, grid: GRADE }, ilha: ILHA, riscos: RISCOS, trechos: [...TRECHOS] },
  )
}

const texto = (m: MedidaDoTrecho) =>
  `${m.nome}: energia ${m.energia.toFixed(4)}, contorno ${m.contornoMinimo.toFixed(4)}, luz mínima ${m.luzMinima.toFixed(4)}, ` +
  `contraste do pé ${m.contrasteDoPe.toFixed(3)}, saturação p95 ${m.saturacaoP95.toFixed(3)}, ${m.pixels} px`

test('pixels no Chromium: com ?obra o barranco é liso, de contorno legível e nunca preto; sem ela, o antigo reprova', async ({ browser }) => {
  test.setTimeout(120_000)
  const [ligada, desligada] = await Promise.all([browser.newPage(), browser.newPage()])
  await Promise.all([ligada.goto(`/player.html${OBRA}`), desligada.goto('/player.html')])
  const novo = await medirTextura(ligada)
  const antigo = await medirTextura(desligada)
  console.log(`[medida] Chromium, textura ${novo.largura}x${novo.altura}. Liso: ${novo.trechos.map(texto).join('; ')}`)
  console.log(`[medida] Chromium, antigo: ${antigo.trechos.map(texto).join('; ')}`)
  for (const m of novo.trechos) {
    expect(m.pixels, m.nome).toBeGreaterThan(2000)
    expect(m.energia, texto(m)).toBeLessThan(ENERGIA_MAXIMA)
    expect(m.contornoMinimo, texto(m)).toBeGreaterThanOrEqual(PISO_DO_CONTORNO)
    expect(m.luzMinima, texto(m)).toBeGreaterThanOrEqual(PISO_DO_CONTORNO)
    expect(m.contrasteDoPe, texto(m)).toBeGreaterThanOrEqual(CONTRASTE_DO_CONTORNO)
    expect(m.saturacaoP95, texto(m)).toBeLessThanOrEqual(SATURACAO_MAXIMA)
  }
  for (const m of antigo.trechos) {
    expect(m.energia, `antigo ${texto(m)}`).toBeGreaterThan(ENERGIA_MAXIMA)
    expect(m.luzMinima, `antigo ${texto(m)}`).toBeLessThan(PISO_DO_CONTORNO)
  }
  await Promise.all([ligada.close(), desligada.close()])
})

interface TempoDaTextura {
  fria: number
  morna: number
  maiorLonga: number
  longas: number
  parede: number
  total4x: number
}

/** Fria (a primeira da página), mediana morna de 5 e, na CPU 4x, as tarefas longas de uma geração e a etapa da parede. */
async function medirTempo(page: Page): Promise<TempoDaTextura> {
  const a1 = await page.evaluate(
    async ({ mapa, ilha, riscos }) => {
      const relevo = (await import(/* @vite-ignore */ '/src/lib/relevo.ts')) as typeof import('../src/lib/relevo') // cast seguro: o módulo servido pelo Vite
      const raster = (await import(/* @vite-ignore */ '/src/pixi/relevoRaster.ts')) as typeof import('../src/pixi/relevoRaster') // cast seguro: idem
      const plano = relevo.planoDoRelevo(mapa, [ilha], [], undefined, riscos)
      if (plano === null) throw new Error('sem terra')
      const uma = async () => {
        const t0 = performance.now()
        const tela = await raster.rasterizarRelevo(plano, () => false)
        const ms = performance.now() - t0
        if (tela !== null) tela.width = 0
        return ms
      }
      const fria = await uma()
      const mornas: number[] = []
      for (let i = 0; i < 5; i += 1) mornas.push(await uma())
      mornas.sort((x, y) => x - y)
      return { fria, morna: mornas[2] }
    },
    { mapa: { width: COLUNAS, height: LINHAS, grid: GRADE }, ilha: ILHA, riscos: RISCOS },
  )
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const a4 = await page.evaluate(
    async ({ mapa, ilha, riscos }) => {
      const relevo = (await import(/* @vite-ignore */ '/src/lib/relevo.ts')) as typeof import('../src/lib/relevo') // cast seguro: o módulo servido pelo Vite
      const raster = (await import(/* @vite-ignore */ '/src/pixi/relevoRaster.ts')) as typeof import('../src/pixi/relevoRaster') // cast seguro: idem
      const plano = relevo.planoDoRelevo(mapa, [ilha], [], undefined, riscos)
      if (plano === null) throw new Error('sem terra')
      const longas: number[] = []
      const observador = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push(e.duration)
      })
      observador.observe({ type: 'longtask' })
      const t0 = performance.now()
      const tela = await raster.rasterizarRelevo(plano, () => false)
      const total4x = performance.now() - t0
      if (tela !== null) tela.width = 0
      await new Promise((fim) => setTimeout(fim, 200))
      observador.disconnect()
      const parede = performance.getEntriesByName('relevo:parede', 'measure').at(-1)?.duration ?? -1
      return { maiorLonga: longas.length === 0 ? 0 : Math.max(...longas), longas: longas.length, parede, total4x }
    },
    { mapa: { width: COLUNAS, height: LINHAS, grid: GRADE }, ilha: ILHA, riscos: RISCOS },
  )
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return { ...a1, ...a4 }
}

test('tempo: a textura com o barranco liso custa o mesmo que a antiga, e na CPU 4x nenhuma tarefa de 200 ms', async ({ browser }) => {
  test.setTimeout(180_000)
  const medidas: { nome: string; t: TempoDaTextura }[] = []
  // Intercaladas: a carga da máquina pesa igual nas duas.
  for (const [nome, busca] of [['antigo', ''], ['liso', OBRA], ['antigo', ''], ['liso', OBRA]] as const) {
    const page = await browser.newPage()
    await page.goto(`/player.html${busca}`)
    medidas.push({ nome, t: await medirTempo(page) })
    await page.close()
  }
  console.log(
    `[medida] textura 3000x2000 de mundo: ${medidas.map(({ nome, t }) => `${nome} fria ${t.fria.toFixed(0)} / morna ${t.morna.toFixed(0)} ms, CPU 4x total ${t.total4x.toFixed(0)} ms, parede ${t.parede.toFixed(0)} ms, maior longa ${t.maiorLonga.toFixed(0)} ms (${t.longas})`).join('; ')}`,
  )
  const lisos = medidas.filter((m) => m.nome === 'liso').map((m) => m.t)
  const antigos = medidas.filter((m) => m.nome === 'antigo').map((m) => m.t)
  for (const t of lisos) expect(t.maiorLonga, 'maior tarefa longa do liso na CPU 4x').toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
  // O liso pinta as mesmas faixas e só uma a mais (o contorno): a morna não passa de 1,15 vez a antiga + 5 ms.
  const melhor = (l: TempoDaTextura[], k: 'morna' | 'parede') => Math.min(...l.map((t) => t[k]))
  expect(melhor(lisos, 'morna')).toBeLessThanOrEqual(melhor(antigos, 'morna') * 1.15 + 5)
})

// ---------- jogador a 390 px ----------

const FICHA = 'ficha-ana'

function mapaDoJogador(): MapData {
  let map = setShowGrid(createEmptyMap('meio-termo-barranco', 'Costa', COLUNAS, LINHAS, GRADE), false)
  map = { ...map, regions: [ILHA] }
  map = comPenhascos(setRelevo(map, true), RISCOS)
  return addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 1500, y: 1100, size: 1, image: null })
}

function hostDoBarranco(): (ws: WebSocketRoute) => void {
  const doArquivo = deserializeMap(serializeMap(mapaDoJogador()))
  const recorte = filterMapForPlayer(doArquivo, 'p-ana', { 'p-ana': [FICHA] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(doArquivo)).map
  if ((recorte.penhascos?.length ?? 0) === 0) throw new Error('o recorte do jogador perdeu os penhascos')
  const explored = encodeExploration(createExploration(doArquivo))
  const snapshot = JSON.stringify({ type: 'snapshot', rev: 1, map: recorte, vision: [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)], explored, ownTokens: [FICHA], concealed: [], sceneName: doArquivo.name })
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(snapshot)
    })
  }
}

interface MedidaDoJogador {
  relevoPronto: number
  p95: number
  quadros: number
  maiorLonga: number
  longasNoRelevo: number
  maiorLongaNoRelevo: number
}

/** O jogador a 390 px entra (CPU 4x desde antes do clique), espera a textura do relevo e mede 3 s de quadros. */
async function medirJogador(page: Page, busca: string): Promise<MedidaDoJogador> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longas: { inicio: number; duracao: number }[] } // cast seguro: campo de medida só deste spec
    w.__longas = []
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) w.__longas.push({ inicio: e.startTime, duracao: e.duration })
    }).observe({ type: 'longtask', buffered: true })
  })
  await page.routeWebSocket((url) => url.pathname === '/ws', hostDoBarranco())
  await page.goto(`/player.html${busca}`)
  await page.getByLabel('Código da sala').fill('PENHA8')
  await page.getByLabel('Seu nome').fill('Ana')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const clique = await page.evaluate(() => performance.now())
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName('relevo:juntar', 'measure').length), { timeout: 60_000 }).toBeGreaterThan(0)
  const r = await page.evaluate(async (inicio) => {
    const etapas = ['terra', 'juntar'].map((e) => performance.getEntriesByName(`relevo:${e}`, 'measure')[0])
    const de = etapas[0].startTime
    const ate = etapas[1].startTime + etapas[1].duration
    const intervalos: number[] = []
    let antes = performance.now()
    const fim = antes + 3000
    while (performance.now() < fim) {
      await new Promise((ok) => requestAnimationFrame(() => ok(undefined)))
      const agora = performance.now()
      intervalos.push(agora - antes)
      antes = agora
    }
    intervalos.sort((a, b) => a - b)
    const longas = (window as unknown as { __longas: { inicio: number; duracao: number }[] }).__longas // cast seguro: o campo do addInitScript
    const noRelevo = longas.filter((l) => l.inicio + l.duracao > de && l.inicio < ate)
    return {
      relevoPronto: ate - inicio,
      p95: intervalos[Math.floor(intervalos.length * 0.95)],
      quadros: intervalos.length,
      maiorLonga: longas.length === 0 ? 0 : Math.max(...longas.map((l) => l.duracao)),
      longasNoRelevo: noRelevo.length,
      maiorLongaNoRelevo: noRelevo.length === 0 ? 0 : Math.max(...noRelevo.map((l) => l.duracao)),
    }
  }, clique)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return r
}

test('jogador a 390 px na CPU 4x: o barranco liso chega pelo recorte e pela rede sem tarefa longa nova nem quadro pior', async ({ browser }) => {
  test.setTimeout(300_000)
  const viewport = { width: 390, height: 844 }
  const medidas: { nome: string; m: MedidaDoJogador }[] = []
  for (const [nome, busca] of [['antigo', ''], ['liso', OBRA], ['antigo', ''], ['liso', OBRA]] as const) {
    const page = await browser.newPage({ viewport })
    medidas.push({ nome, m: await medirJogador(page, busca) })
    if (GERAR_PROVAS && nome === 'liso' && medidas.length === 2) await page.screenshot({ path: `${PROVAS}/mt8-jogador-390.png` })
    const largura = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(largura).toBeLessThanOrEqual(390)
    await page.close()
  }
  console.log(
    `[medida] jogador 390 px, CPU 4x: ${medidas.map(({ nome, m }) => `${nome}: relevo pronto ${m.relevoPronto.toFixed(0)} ms depois do clique, p95 ${m.p95.toFixed(1)} ms (${m.quadros} quadros), maior longa ${m.maiorLonga.toFixed(0)} ms, no relevo ${m.longasNoRelevo} (maior ${m.maiorLongaNoRelevo.toFixed(0)} ms)`).join('; ')}`,
  )
  const lisos = medidas.filter((x) => x.nome === 'liso').map((x) => x.m)
  const antigos = medidas.filter((x) => x.nome === 'antigo').map((x) => x.m)
  const melhor = (l: MedidaDoJogador[], k: keyof MedidaDoJogador) => Math.min(...l.map((m) => m[k]))
  for (const m of lisos) expect(m.maiorLongaNoRelevo, 'tarefa longa durante a geração do relevo (liso)').toBeLessThan(TETO_DA_TAREFA_LONGA_MS)
  expect(melhor(lisos, 'p95'), 'p95 do quadro, liso contra antigo').toBeLessThanOrEqual(melhor(antigos, 'p95') * 1.1 + 2)
  expect(melhor(lisos, 'relevoPronto'), 'relevo pronto, liso contra antigo').toBeLessThanOrEqual(melhor(antigos, 'relevoPronto') * 1.1 + 50)
})

// ---------- folha de contato ----------

test('folha de contato: barranco antes e depois, em 3 zooms e 3 alturas', async ({ page }) => {
  test.skip(!GERAR_PROVAS, 'só com GERAR_PROVAS_MT8=1')
  test.setTimeout(120_000)
  await page.goto('/player.html')
  const png = await page.evaluate(
    async ({ mapa, ilha, riscos, costa }) => {
      const relevo = (await import(/* @vite-ignore */ '/src/lib/relevo.ts')) as typeof import('../src/lib/relevo') // cast seguro: o módulo servido pelo Vite
      const raster = (await import(/* @vite-ignore */ '/src/pixi/relevoRaster.ts')) as typeof import('../src/pixi/relevoRaster') // cast seguro: idem
      const estilo = (await import(/* @vite-ignore */ '/src/lib/estiloDoMapa.ts')) as typeof import('../src/lib/estiloDoMapa') // cast seguro: idem
      const plano = relevo.planoDoRelevo(mapa, [ilha], [], undefined, riscos)
      if (plano === null) throw new Error('sem terra')
      const gerar = async (ligada: boolean) => {
        estilo.trocarObraNoTeste(ligada)
        const t0 = performance.now()
        const tela = await raster.rasterizarRelevo(plano, () => false)
        const ms = performance.now() - t0
        estilo.trocarObraNoTeste(false)
        if (tela === null) throw new Error('sem textura')
        return { tela, ms }
      }
      const versoes = [{ nome: 'antes', ...(await gerar(false)) }, { nome: 'depois', ...(await gerar(true)) }]
      // Quadro: [zoom, centro x, centro y, rótulo]. 100% = 1 px de tela por px de mundo.
      const QW = 420
      const QH = 240
      const quadros = (v: string): [number, number, number, string][] => [
        [0.5, 1900, costa + 40, `${v} · 50% · emenda Médio-Alto`],
        [1, 1900, costa + 40, `${v} · 100% · emenda Médio-Alto`],
        [3, 1100, costa + 16, `${v} · 300% · emenda Baixo-Médio`],
        [3, 700, costa + 16, `${v} · 300% · Baixo`],
        [3, 1500, costa + 24, `${v} · 300% · Médio`],
        [3, 2300, costa + 44, `${v} · 300% · Alto`],
      ]
      const COLS = 3
      const M = 16
      const ROTULO = 26
      const lista = versoes.flatMap((v) => quadros(v.nome).map((q) => ({ v, q })))
      // Antes em cima, depois embaixo, na mesma ordem: as linhas 1-2 são o antes, 3-4 o depois.
      const linhas = Math.ceil(lista.length / COLS)
      const folha = document.createElement('canvas')
      folha.width = COLS * QW + (COLS + 1) * M
      folha.height = linhas * (QH + ROTULO) + (linhas + 1) * M + 30
      const g = folha.getContext('2d')
      if (g === null) throw new Error('sem canvas 2D')
      g.fillStyle = '#f4efe6'
      g.fillRect(0, 0, folha.width, folha.height)
      g.fillStyle = '#3b3128'
      g.font = '600 15px system-ui, sans-serif'
      g.fillText('MT8 · barranco liso: antes (6 faixas) e depois (Meio-Termo), textura do app no Chromium; tempo = geração da textura inteira', M, 22)
      lista.forEach(({ v, q }, n) => {
        const [zoom, cx, cy, rotulo] = q
        const x0 = M + (n % COLS) * (QW + M)
        const y0 = 30 + M + Math.floor(n / COLS) * (QH + ROTULO + M)
        g.save()
        g.beginPath()
        g.rect(x0, y0, QW, QH)
        g.clip()
        // Mundo -> tela do quadro.
        g.setTransform(zoom, 0, 0, zoom, x0 + QW / 2 - cx * zoom, y0 + QH / 2 - cy * zoom)
        g.fillStyle = '#40707e'
        g.fillRect(cx - QW / zoom, cy - QH / zoom, (2 * QW) / zoom, (2 * QH) / zoom)
        g.fillStyle = ilha.fillColor
        g.fillRect(200, 200, 2600, costa - 200)
        g.imageSmoothingEnabled = true
        g.drawImage(v.tela, plano.retangulo.x, plano.retangulo.y, v.tela.width / plano.escala, v.tela.height / plano.escala)
        g.restore()
        g.strokeStyle = 'rgba(59, 49, 40, 0.35)'
        g.strokeRect(x0 + 0.5, y0 + 0.5, QW - 1, QH - 1)
        g.fillStyle = '#3b3128'
        g.font = '13px system-ui, sans-serif'
        g.fillText(`${rotulo} · ${v.ms.toFixed(0)} ms`, x0, y0 + QH + 18)
      })
      for (const v of versoes) v.tela.width = 0
      return folha.toDataURL('image/png').slice('data:image/png;base64,'.length)
    },
    { mapa: { width: COLUNAS, height: LINHAS, grid: GRADE }, ilha: ILHA, riscos: RISCOS, costa: COSTA_Y },
  )
  writeFileSync(`${PROVAS}/mt8-folha-de-contato.png`, Buffer.from(png, 'base64'))
})
