// E2E do "Andar até aqui" pelo motor de caminhamento (F1 de CAMINHOS). Mestre
// simulado com page.routeWebSocket + sessão REAL (src/net/hostSession.ts):
// cada trecho que o jogador manda passa pela validação de produção
// (`validateTokenMove`), e o passo aceito anda a ficha no mapa do mestre.
// Metas: a ficha chega ao destino contornando a cerca, nenhum trecho volta
// recusado, nenhuma tarefa longa >= 200 ms; destino no escuro não anda; num
// mapa grande (300 x 300 casas), a PRIMEIRA consulta não trava a tela.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { gerarMapaDoRobo } from '../src/lib/caminhamento/robo.fixture'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token, Wall } from '../src/types/map'

const CODE = 'ABC123'
const GRID = 50
const WORLD_W = 20 * GRID // 1000
const WORLD_H = 12 * GRID // 600
const CLIENT = 'c1'
/** Igual a FIT_MARGIN de PlayerView.tsx: a escala inicial é a do mapa inteiro com essa margem. */
const PLAYER_FIT_MARGIN = 24
const SEGURAR_MS = 800
const TAREFA_LONGA_MAXIMA_MS = 200
const ORIGEM = { x: 300, y: 150 }
/** Do outro lado da cerca: visível (a cerca não barra a visão), mas o caminho dá a volta pela ponta dela. */
const DESTINO = { x: 600, y: 150 }
/** Dentro do quarto fechado: o jogador nunca viu. */
const NO_ESCURO = { x: 125, y: 360 }
/** Botões do canto direito (som, mão, zoom): o toque fica à esquerda deles. */
const COLUNA_DE_BOTOES_PX = 70
const PINTURA_MS = 300
/** Mapa grande do robô, o mesmo do `knownPath.desempenho.test.ts`. */
const GRANDE_LADO = 300
const GRANDE_GRID = 64
/** Distância do toque ao centro da área livre no mapa grande, em px de tela. */
const DESVIO_DO_TOQUE_PX = 60

interface Ponto {
  x: number
  y: number
}

interface Area extends Ponto {
  width: number
  height: number
}

interface TarefaLonga {
  inicio: number
  duracao: number
}

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function mapaDaCerca(): MapData {
  return {
    ...createEmptyMap('m-andar', 'Andar até aqui', 20, 12, GRID),
    walls: [
      // Cerca: barra o passo, não a visão.
      parede('cerca', 450, 0, 450, 450, { blocksLight: false }),
      // Quarto fechado à esquerda: barra os dois.
      parede('q-n', 50, 300, 200, 300),
      parede('q-l', 200, 300, 200, 420),
      parede('q-s', 200, 420, 50, 420),
      parede('q-o', 50, 420, 50, 300),
    ],
    tokens: [token('tok-a', 'Heroi', ORIGEM.x, ORIGEM.y)],
  }
}

async function instalarColetor(page: Page): Promise<void> {
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

async function tarefasLongas(page: Page): Promise<TarefaLonga[]> {
  return page.evaluate(() => (window as unknown as { __longas?: { inicio: number; duracao: number }[] }).__longas ?? []) // as: o coletor do addInitScript
}

/** Mestre falso: sessão real, e o passo aceito anda a ficha no mapa dele (e volta no snapshot). */
async function abrirJogador(page: Page, inicial: MapData) {
  let map = inicial
  const session = createHostSession({ code: CODE, visionRadius: 2000, now: () => 0, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const paraPagina: HostMessage[] = []
  const passos: Ponto[] = []
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
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((bruto) => {
      const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
      const r = session.handleMessage(CLIENT, texto, map)
      despachar(r.outbound)
      if (r.applyMove) {
        const { tokenId, x, y } = r.applyMove
        passos.push({ x, y })
        map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
        despachar(session.broadcast(map).outbound)
      }
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
  return { paraPagina, passos, ficha: () => map.tokens.find((t) => t.id === 'tok-a') }
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

/**
 * Onde a ficha própria está na tela, depois de a câmera parar: o jogador
 * centra a câmera na ficha dele, no meio da área que o painel deixa livre.
 */
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

async function segurar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(SEGURAR_MS)
  await page.mouse.up()
}

function dentro(area: Area, p: Ponto): boolean {
  return p.x > area.x && p.x < area.x + area.width - COLUNA_DE_BOTOES_PX && p.y > area.y && p.y < area.y + area.height
}

test('toque longo > "Andar até aqui": a ficha contorna a cerca e chega, sem recusa nem tarefa longa; no escuro não anda', async ({ page }) => {
  test.setTimeout(90_000)
  const erros: string[] = []
  page.on('pageerror', (error) => erros.push(error.message))
  await instalarColetor(page)
  const mestre = await abrirJogador(page, mapaDaCerca())
  const view = page.locator('[data-explored-cells]')
  await expect(view).toHaveAttribute('data-own-tokens', 'tok-a')

  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('sem viewport')
  // A escala é a do enquadramento do mapa inteiro; a câmera só desliza para centrar a ficha.
  const escala = Math.min((viewport.width - PLAYER_FIT_MARGIN * 2) / WORLD_W, (viewport.height - PLAYER_FIT_MARGIN * 2) / WORLD_H)
  const livre = await areaLivre(page)
  const ficha = await fichaParada(page, livre)
  const naTela = (p: Ponto): Ponto => ({ x: ficha.x + (p.x - ORIGEM.x) * escala, y: ficha.y + (p.y - ORIGEM.y) * escala })
  for (const p of [NO_ESCURO, DESTINO]) expect(dentro(livre, naTela(p)), `o ponto ${JSON.stringify(p)} deveria caber na área livre`).toBe(true)

  // A janela medida começa no primeiro toque: a carga da página (Pixi, primeiro quadro) fica fora.
  const inicioDoGesto = await page.evaluate(() => performance.now())

  // 1. No escuro: o item aparece, mas diz que não conhece o caminho e não anda.
  await segurar(page, naTela(NO_ESCURO))
  const itemNoEscuro = page.getByRole('menuitem', { name: /^Andar até aqui/ })
  await expect(itemNoEscuro).toBeVisible()
  await expect(itemNoEscuro).toHaveAttribute('aria-disabled', 'true')
  await expect(itemNoEscuro).toContainText('Você não conhece o caminho')
  await page.keyboard.press('Escape')
  await expect(itemNoEscuro).toBeHidden()

  // 2. Do outro lado da cerca: anda, trecho a trecho, até o destino.
  await segurar(page, naTela(DESTINO))
  const item = page.getByRole('menuitem', { name: /^Andar até aqui/ })
  await expect(item).toBeVisible()
  await expect(item).not.toHaveAttribute('aria-disabled', 'true')
  await item.click()
  await expect.poll(() => mestre.ficha(), { timeout: 20_000 }).toMatchObject(DESTINO)

  // Contornou a cerca (um canto abaixo da ponta dela) e o host aceitou todos os trechos.
  expect(mestre.passos.length).toBeGreaterThanOrEqual(2)
  expect(Math.max(...mestre.passos.map((p) => p.y))).toBeGreaterThan(450)
  expect(mestre.paraPagina.filter((m) => m.type === 'token.move.rejected')).toEqual([])

  const longas = await tarefasLongas(page)
  const noGesto = Math.max(0, ...longas.filter((l) => l.inicio + l.duracao >= inicioDoGesto).map((l) => l.duracao))
  const naPagina = Math.max(0, ...longas.map((l) => l.duracao))
  console.log(`ANDAR-ATE-AQUI ${JSON.stringify({ passos: mestre.passos, tarefaLongaNoGestoMs: noGesto, tarefaLongaNaPaginaMs: naPagina })}`)
  expect(noGesto).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  expect(erros).toEqual([])
})

test('mapa grande (300 x 300 casas): a primeira consulta do "Andar até aqui", logo que a cena chega, não trava a tela', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (error) => erros.push(error.message))
  const gerado = gerarMapaDoRobo(4242, GRANDE_GRID, false, 1, { largura: GRANDE_LADO, altura: GRANDE_LADO })
  const sala = gerado.salas[0]
  if (sala === undefined) throw new Error('o gerador não fez salas')
  const origem = { x: (Math.floor((sala.x0 + sala.x1) / 2) + 0.5) * GRANDE_GRID, y: (Math.floor((sala.y0 + sala.y1) / 2) + 0.5) * GRANDE_GRID }
  const grande: MapData = {
    ...createEmptyMap('m-grande', 'Grande', GRANDE_LADO, GRANDE_LADO, GRANDE_GRID),
    walls: [...gerado.mapa.walls],
    tokens: [token('tok-a', 'Heroi', origem.x, origem.y)],
  }
  await instalarColetor(page)
  await abrirJogador(page, grande)
  await expect(page.locator('[data-explored-cells]')).toHaveAttribute('data-own-tokens', 'tok-a', { timeout: 60_000 })

  // Sem esperar a malha: o toque longo sai assim que a ficha é dele.
  const livre = await areaLivre(page)
  const alvo = { x: livre.x + livre.width / 2 + DESVIO_DO_TOQUE_PX, y: livre.y + livre.height / 2 }
  const inicio = await page.evaluate(() => performance.now())
  await segurar(page, alvo)
  const item = page.getByRole('menuitem', { name: /^Andar até aqui/ })
  await expect(item).toBeVisible()
  const fim = await page.evaluate(() => performance.now())

  const longas = await tarefasLongas(page)
  const naConsulta = longas.filter((l) => l.inicio + l.duracao >= inicio && l.inicio <= fim)
  const numeros = {
    paredes: grande.walls.length,
    tarefaLongaNaConsultaMs: Math.max(0, ...naConsulta.map((l) => l.duracao)),
    tarefaLongaNaPaginaMs: Math.max(0, ...longas.map((l) => l.duracao)),
    tarefasLongasNaConsulta: naConsulta.length,
    podeAndar: (await item.getAttribute('aria-disabled')) === null,
  }
  console.log(`ANDAR-ATE-AQUI-GRANDE ${JSON.stringify(numeros)}`)
  expect(numeros.tarefaLongaNaConsultaMs).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  expect(erros).toEqual([])
})
