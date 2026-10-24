// E2E do CLICAR PARA ANDAR (F2 de CAMINHOS), só PC (1280 x 800, mouse). Mestre
// simulado com page.routeWebSocket + sessão REAL (src/net/hostSession.ts): cada
// trecho marcado (`caminhada: true`) passa pela validação de produção, e os
// pacotes forjados aqui entram pelo mesmo `handleMessage` que o jogador usa.
// Metas: clicou no chão, a ficha contorna a cerca (30+ casas) e chega, todo
// trecho marcado e aceito, a marca do destino aparece e some na chegada;
// p95 do quadro <= 20 ms e nenhuma tarefa >= 200 ms durante a caminhada. Chave
// desligada: nada sai, há aviso, e o host recusa o trecho marcado. O host
// recusa o trecho que sai do conhecido (`nevoa`) e a marca não afrouxa o passo.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token, Wall } from '../src/types/map'

const CODE = 'ABC123'
const GRID = 50
const LADO = 20
const WORLD = LADO * GRID // 1000 x 1000
const CLIENT = 'c1'
/** Igual a FIT_MARGIN de PlayerView.tsx: a escala inicial é a do mapa inteiro com essa margem. */
const PLAYER_FIT_MARGIN = 24
const PINTURA_MS = 300
const TAREFA_LONGA_MAXIMA_MS = 200
const QUADRO_P95_MAXIMO_MS = 20
const CASAS_MINIMAS = 30
const ORIGEM = { x: 325, y: 125 }
/** Do outro lado da cerca: à vista (a cerca não barra a visão), mas o caminho desce até a ponta dela e volta. */
const DESTINO = { x: 675, y: 125 }
/** Dentro da zona oculta do mestre (chão aberto, mas escuro para o jogador). */
const NO_OCULTO = { x: 175, y: 50 }
/** Sem nada desenhado aqui: espera curta para provar que nada saiu. */
const SILENCIO_MS = 1500

interface Ponto {
  x: number
  y: number
}

interface Area extends Ponto {
  width: number
  height: number
}

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: 'Heroi', x, y, size: 1, image: null }
}

function cerca(): Wall {
  // Barra o passo, não a visão; a ponta fica a 2 casas da borda de baixo.
  return { id: 'cerca', x1: 500, y1: 0, x2: 500, y2: 900, blocksLight: false, blocksMove: true, door: null }
}

function mapa(extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-clique', 'Clicar para andar', LADO, LADO, GRID),
    walls: [cerca()],
    concealZones: [{ id: 'z-oculta', name: 'Despensa', revealed: false, points: [{ x: 100, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 100 }, { x: 100, y: 100 }] }],
    tokens: [token('tok-a', ORIGEM.x, ORIGEM.y)],
    ...extra,
  }
}

/** Coletores na página: tarefas longas e o intervalo entre quadros (requestAnimationFrame). */
async function instalarColetores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as { __longas?: { inicio: number; duracao: number }[] } // as: campo nosso pendurado no window da página (sem tipo no DOM)
    const longas: { inicio: number; duracao: number }[] = []
    alvo.__longas = longas
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push({ inicio: e.startTime, duracao: e.duration })
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // Sem a API, a lista fica vazia (Chromium tem).
    }
  })
}

async function comecarQuadros(page: Page): Promise<number> {
  return page.evaluate(() => {
    const alvo = window as unknown as { __quadros?: number[]; __medindo?: boolean } // as: campos nossos no window da página
    const quadros: number[] = []
    alvo.__quadros = quadros
    alvo.__medindo = true
    let antes = performance.now()
    const quadro = (agora: number) => {
      quadros.push(agora - antes)
      antes = agora
      if (alvo.__medindo === true) requestAnimationFrame(quadro)
    }
    requestAnimationFrame(quadro)
    return performance.now()
  })
}

async function pararQuadros(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const alvo = window as unknown as { __quadros?: number[]; __medindo?: boolean } // as: os campos do comecarQuadros
    alvo.__medindo = false
    return alvo.__quadros ?? []
  })
}

async function tarefasLongas(page: Page): Promise<{ inicio: number; duracao: number }[]> {
  return page.evaluate(() => (window as unknown as { __longas?: { inicio: number; duracao: number }[] }).__longas ?? []) // as: o coletor do addInitScript
}

function percentil(valores: readonly number[], p: number): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.floor((ordenados.length - 1) * p))] ?? 0
}

/** Mestre falso: sessão real; o passo aceito anda a ficha no mapa dele (e volta no snapshot). */
async function abrirJogador(page: Page, inicial: MapData) {
  let map = inicial
  const session = createHostSession({ code: CODE, visionRadius: 2000, now: () => 0, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const paraPagina: HostMessage[] = []
  const daPagina: Record<string, unknown>[] = []
  let playerId: string | null = null
  let socket: WebSocketRoute | null = null
  const despachar = (outbound: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of outbound) {
      if (clientId !== CLIENT || socket === null) continue
      paraPagina.push(msg)
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') playerId = msg.playerId
    }
  }
  const receber = (texto: string) => {
    const r = session.handleMessage(CLIENT, texto, map)
    despachar(r.outbound)
    if (r.applyMove) {
      const { tokenId, x, y } = r.applyMove
      map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
      despachar(session.broadcast(map).outbound)
    }
    return r.outbound.find((o) => o.clientId === CLIENT)?.msg
  }
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((bruto) => {
      const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
      const lido: unknown = JSON.parse(texto)
      if (typeof lido === 'object' && lido !== null) daPagina.push({ ...lido })
      receber(texto)
    })
  })
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const id: string | null = playerId
  if (id === null) throw new Error('sem welcome')
  session.assignToken(id, 'tok-a')
  despachar(session.broadcast(map).outbound)
  return {
    paraPagina,
    trechos: () => daPagina.filter((m) => m.type === 'token.move'),
    ficha: () => map.tokens.find((t) => t.id === 'tok-a'),
    /** Um pacote do jogador forjado aqui, pela mesma entrada da sessão: a resposta do host a ele. */
    forjar: (msg: Record<string, unknown>) => receber(JSON.stringify(msg)),
  }
}

/** A parte da tela que o painel do jogador deixa livre para o mapa. */
async function areaLivre(page: Page): Promise<Area> {
  const tela = page.viewportSize()
  if (tela === null) throw new Error('sem viewport')
  const painel = await page.locator('aside[aria-label="Painel do jogador"]').boundingBox()
  const esquerda = painel === null ? 0 : Math.ceil(painel.x + painel.width)
  return { x: esquerda, y: 0, width: tela.width - esquerda, height: tela.height }
}

/** Centro dos pixels azuis da ficha própria (0x3b82f6) na área livre, em px de tela. Só LÊ a foto. */
async function centroDaFicha(page: Page, area: Area): Promise<{ n: number; x: number; y: number }> {
  const foto = await page.screenshot({ clip: area })
  const r = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    ctx.drawImage(bmp, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
    let n = 0
    let sx = 0
    let sy = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const vermelho = data[i] ?? 0
        const verde = data[i + 1] ?? 0
        const azul = data[i + 2] ?? 0
        if (azul > 200 && vermelho < 110 && verde > 100 && verde < 170) {
          n += 1
          sx += x
          sy += y
        }
      }
    }
    return { n, x: n > 0 ? sx / n : -1, y: n > 0 ? sy / n : -1 }
  }, foto.toString('base64'))
  return { n: r.n, x: r.x + area.x, y: r.y + area.y }
}

/** Onde a ficha própria está na tela, depois de a câmera parar. */
async function fichaParada(page: Page, area: Area): Promise<Ponto> {
  let antes = await centroDaFicha(page, area)
  for (let volta = 0; volta < 10; volta += 1) {
    await page.waitForTimeout(PINTURA_MS)
    const agora = await centroDaFicha(page, area)
    if (agora.n > 20 && antes.n > 20 && Math.hypot(agora.x - antes.x, agora.y - antes.y) < 1) return { x: agora.x, y: agora.y }
    antes = agora
  }
  throw new Error(`a ficha não parou na tela (${JSON.stringify(antes)})`)
}

/** Converte px de mundo em px de tela, a partir de onde a ficha parada está. */
async function conversor(page: Page): Promise<(p: Ponto) => Ponto> {
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('sem viewport')
  const escala = Math.min((viewport.width - PLAYER_FIT_MARGIN * 2) / WORLD, (viewport.height - PLAYER_FIT_MARGIN * 2) / WORLD)
  const ficha = await fichaParada(page, await areaLivre(page))
  return (p) => ({ x: ficha.x + (p.x - ORIGEM.x) * escala, y: ficha.y + (p.y - ORIGEM.y) * escala })
}

function casasAndadas(trechos: readonly Record<string, unknown>[]): number {
  let antes = ORIGEM
  let soma = 0
  for (const t of trechos) {
    const x = typeof t.x === 'number' ? t.x : antes.x
    const y = typeof t.y === 'number' ? t.y : antes.y
    soma += Math.hypot(x - antes.x, y - antes.y)
    antes = { x, y }
  }
  return soma / GRID
}


test('clique no chão: a ficha contorna a cerca (30+ casas) e chega; a marca aparece e some; quadro p95 <= 20 ms', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (error) => erros.push(error.message))
  await instalarColetores(page)
  const mestre = await abrirJogador(page, mapa())
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-own-tokens', 'tok-a')
  const naTela = await conversor(page)

  const inicio = await comecarQuadros(page)
  const alvo = naTela(DESTINO)
  await page.mouse.click(alvo.x, alvo.y)
  // A marca vai no ponto do clique (o px de tela vira px de mundo inteiro: até 2 px do alvo).
  await expect(view).toHaveAttribute('data-destino-da-caminhada', /^\d+,\d+$/)
  const marcado = (await view.getAttribute('data-destino-da-caminhada'))?.split(',').map(Number) ?? []
  const destino = { x: marcado[0] ?? Number.NaN, y: marcado[1] ?? Number.NaN }
  expect(Math.hypot(destino.x - DESTINO.x, destino.y - DESTINO.y)).toBeLessThanOrEqual(2)
  await expect.poll(() => mestre.ficha(), { timeout: 30_000 }).toMatchObject(destino)
  await expect(view).toHaveAttribute('data-destino-da-caminhada', '')
  const quadros = await pararQuadros(page)

  const trechos = mestre.trechos()
  expect(trechos.length).toBeGreaterThanOrEqual(2)
  expect(trechos.every((t) => t.caminhada === true)).toBe(true)
  expect(mestre.paraPagina.filter((m) => m.type === 'token.move.rejected')).toEqual([])
  const casas = casasAndadas(trechos)
  const longas = (await tarefasLongas(page)).filter((l) => l.inicio + l.duracao >= inicio)
  const numeros = {
    trechos: trechos.length,
    casas: Math.round(casas * 10) / 10,
    quadros: quadros.length,
    quadroP50Ms: Math.round(percentil(quadros, 0.5) * 10) / 10,
    quadroP95Ms: Math.round(percentil(quadros, 0.95) * 10) / 10,
    quadroMaxMs: Math.round(Math.max(0, ...quadros) * 10) / 10,
    tarefaLongaMaxMs: Math.max(0, ...longas.map((l) => l.duracao)),
  }
  console.log(`CLIQUE-PARA-ANDAR ${JSON.stringify(numeros)}`)
  expect(casas).toBeGreaterThanOrEqual(CASAS_MINIMAS)
  expect(numeros.quadroP95Ms).toBeLessThanOrEqual(QUADRO_P95_MAXIMO_MS)
  expect(numeros.tarefaLongaMaxMs).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  expect(erros).toEqual([])
})

test('chave da cena desligada: o clique não manda nada e avisa; o host recusa o trecho marcado', async ({ page }) => {
  test.setTimeout(60_000)
  const mestre = await abrirJogador(page, mapa({ cliqueParaAndar: false }))
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-own-tokens', 'tok-a')
  const naTela = await conversor(page)
  const alvo = naTela(DESTINO)
  await page.mouse.click(alvo.x, alvo.y)
  await expect(page.getByText('O mestre desligou o clicar para andar nesta cena')).toBeVisible()
  await page.waitForTimeout(SILENCIO_MS)
  expect(mestre.trechos()).toEqual([])
  await expect(view).toHaveAttribute('data-destino-da-caminhada', '')
  // Pacote real com a marca, como um cliente que ignorasse a chave: o host recusa.
  expect(mestre.forjar({ type: 'token.move', reqId: 'forjado', tokenId: 'tok-a', x: 325, y: 225, caminhada: true })).toEqual({
    type: 'token.move.rejected',
    reqId: 'forjado',
    reason: 'caminhada_desligada',
  })
})

test('fora do conhecido: o clique na zona oculta não sai; o host recusa o trecho marcado (`nevoa`) e a marca não afrouxa o passo', async ({ page }) => {
  test.setTimeout(60_000)
  const mestre = await abrirJogador(page, mapa({ movement: { maxStepCells: 4 } }))
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-own-tokens', 'tok-a')
  const naTela = await conversor(page)
  const alvo = naTela(NO_OCULTO)
  await page.mouse.click(alvo.x, alvo.y)
  await expect(page.getByText('Você não conhece o caminho')).toBeVisible()
  await page.waitForTimeout(SILENCIO_MS)
  expect(mestre.trechos()).toEqual([])
  // Pacote real com a marca para dentro da zona oculta: o cliente nunca manda, o host confere mesmo assim.
  expect(mestre.forjar({ type: 'token.move', reqId: 'nevoa', tokenId: 'tok-a', x: NO_OCULTO.x, y: NO_OCULTO.y, caminhada: true })).toEqual({
    type: 'token.move.rejected',
    reqId: 'nevoa',
    reason: 'nevoa',
  })
  // A marca não afrouxa o passo máximo: 8 casas pedidas, 4 andadas.
  expect(mestre.forjar({ type: 'token.move', reqId: 'longe', tokenId: 'tok-a', x: ORIGEM.x, y: ORIGEM.y + 8 * GRID, caminhada: true })).toEqual({
    type: 'token.move.accepted',
    reqId: 'longe',
    x: ORIGEM.x,
    y: ORIGEM.y + 4 * GRID,
  })
})
