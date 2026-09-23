// JORNADA DE USUÁRIO do ZOOM NO CELULAR (item "zoom-no-celular" do backlog da
// simulação de 7 jogadores) — escrita para SAIR VERMELHA no código de hoje. É a
// régua do conserto, não o conserto.
//
// O ITEM: no celular não há zoom (só a roda do mouse; o zoom do navegador está
// bloqueado pelo `touch-action: none`). Pinça pelo ponto médio e botões + e −
// no canto. Aceite: 360x740 com toque. Pinça abrindo aproxima sem mover a ficha
// nem sinalizar; fechando afasta; '+' duas vezes aproxima em degraus. Um dedo
// na ficha arrasta a ficha, no chão a câmera; parado sinaliza.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/player/PlayerView.tsx:1177-1184 — o único caminho de zoom da
//     tela do jogador é `onWheel` (roda do mouse), que o celular não tem;
//   - client/src/player/PlayerView.tsx:1079 — `if (scene.drag) return`: o
//     SEGUNDO dedo é ignorado. O primeiro segue sozinho: no chão arrasta a
//     câmera (:1128), na ficha arrasta a ficha (:818) — a pinça vira arrasto;
//   - client/src/player/main.tsx — nenhum botão de zoom ('+'/'−') na tela.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo preparo de task-player-page e
// task-jornada-entrada-jogador):
//   A TELA DO JOGADOR É DE VERDADE: `player.html` inteiro num contexto de
//   celular (360x740, `hasTouch`, `isMobile`). Só o transporte é falsificado:
//   o WebSocket roteado entrega cada mensagem à sessão REAL do mestre
//   (`net/hostSession.ts`), que valida movimento e sinal e responde; movimento
//   aceito é aplicado no mapa e retransmitido, como o mestre faz.
//   GESTO REAL DE DEDO: `Input.dispatchTouchEvent` do DevTools, o mesmo canal
//   de entrada que o `page.touchscreen` do Playwright usa — o navegador gera
//   touch E pointer events de verdade (nada de `dispatchEvent` na página).
//   Dois dedos = dois pontos de toque ativos; pausa antes de soltar. Os botões
//   são tocados com `locator.tap()`.
//   PROVA NA TELA (pixel). A ficha do jogador é verde-limão; dois MARCOS (fichas
//   sem dono, laranja e magenta) ficam a uma distância conhecida no mundo. Da
//   posição dos dois marcos na foto sai a câmera: escala = distância na tela /
//   distância no mundo. Com ela: "aproximou" = escala maior; "não moveu a
//   ficha" = a ficha continua no mesmo ponto do MUNDO; "pelo ponto médio" = o
//   ponto do mundo sob o meio dos dedos continua sob o meio dos dedos. O sinal
//   é a cor do sinal do jogador na tela (`signalColor`, a mesma do mestre).
//   Único `evaluate`: decodificar a foto num canvas solto para LER pixel.
//
// SUPOSIÇÕES (as únicas que esta régua dita além do aceite):
//   - os botões de zoom são `button` com nome acessível '+' / '−' (ou '-') ou
//     "Aproximar"/"Afastar", "Mais zoom"/"Menos zoom", "Ampliar"/"Reduzir",
//     "Aumentar zoom"/"Diminuir zoom", "Zoom +"/"Zoom −" (`BOTAO_MAIS`,
//     `BOTAO_MENOS`), visíveis dentro da tela de 360x740 sem abrir o Painel;
//   - "degrau" = cada toque no '+' aumenta a escala em pelo menos 15%, e dois
//     degraus seguidos não passam de ~2,7x o enquadramento inicial (senão os
//     marcos saem da tela de 360 px — a régua avisa com mensagem própria);
//   - a pinça pode encostar um dedo na ficha: o aceite diz "sem mover a ficha";
//   - o mínimo do "afastar" pode parar no enquadramento inicial: por isso o
//     teste do "fechando afasta" primeiro abre a pinça e depois fecha;
//   - `deviceScaleFactor` 1 (máquina carregada; o item é zoom, não nitidez).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Um dedo na ficha arrasta a ficha; no
// chão, a câmera; parado no chão, sinaliza — e a leitura de pixel enxerga
// ficha, marcos e sinal (a régua não está cega). Os testes 2 a 4 cobram o item.
import { test, expect, type Page, type WebSocketRoute, type CDPSession } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { signalColor } from '../src/lib/signals'
import type { HostMessage } from '../src/net/protocol'
import type { MapData, Token } from '../src/types/map'

const TELA = { width: 360, height: 740 }
test.use({ trace: 'off', video: 'off', viewport: TELA, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })

const CODIGO = 'ZOOM01'
const CLIENTE = 'c1'
const GRADE = 50
const COLUNAS = 12
const LINHAS = 10
const LARGURA = COLUNAS * GRADE // 600
const ALTURA = LINHAS * GRADE // 500

type Ponto = { x: number; y: number }

/** Ficha do jogador no MEIO do mundo: enquadramento inicial e zoom pelo centro a mantêm no meio da tela. */
const FICHA_W: Ponto = { x: 300, y: 250 }
/** Marcos a 60 px de mundo da ficha em cada eixo: perto o bastante para seguir na tela depois do zoom. */
const MARCO1_W: Ponto = { x: 240, y: 190 }
const MARCO2_W: Ponto = { x: 360, y: 310 }
const DIST_MARCOS_W = Math.hypot(MARCO2_W.x - MARCO1_W.x, MARCO2_W.y - MARCO1_W.y)

const COR_CHAO = '#1e8c8c'
const COR_FICHA = '#3cff00'
const COR_MARCO1 = '#ff5a00'
const COR_MARCO2 = '#ff00ff'

/** Pixels mínimos de uma ficha (raio ~13 px na escala inicial) e do ponto do sinal (raio 5). */
const PIXELS_DE_FICHA = 150
const PIXELS_DE_SINAL = 20
/** Máximo de pixels da cor do sinal para dizer "não sinalizou" (serrilhado). */
const RESIDUO = 8
/** Dedo parado antes de soltar num arrasto (abaixo dos 500 ms do sinal). */
const PAUSA_ARRASTO_MS = 150
/** Pinça parada antes de soltar: ACIMA dos 500 ms do sinal — ficar parado na pinça não pode sinalizar. */
const PAUSA_PINCA_MS = 600
/** Segurar parado no chão para sinalizar (sinal dispara em 500 ms). */
const SEGURAR_MS = 800
const PASSOS = 12
/**
 * Um dedo anda em passos de ~10 px: um primeiro passo abaixo dos 6 px de
 * tolerância do sinal deixava o "segurar parado" vivo e, com a máquina
 * carregada, o sinal disparava no meio do arrasto (medido: câmera andou 4 px).
 */
const PASSOS_UM_DEDO = 5
const QUADRO_MS = 16
const ESPERA = 6000

const BOTAO_MAIS = /^(\+|＋|aproximar|mais zoom|ampliar|aumentar zoom|zoom \+|zoom \(\+\))$/i
const BOTAO_MENOS = /^(−|-|－|afastar|menos zoom|reduzir|diminuir zoom|zoom −|zoom -)$/i

function ficha(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function mapaDoTeste(): MapData {
  const base = createEmptyMap('m-zoom', 'Porto', COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: 'f-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: COR_CHAO },
    tokens: [ficha('tok-f', 'Ana', FICHA_W, COR_FICHA), ficha('tok-m1', 'Barril', MARCO1_W, COR_MARCO1), ficha('tok-m2', 'Caixa', MARCO2_W, COR_MARCO2)],
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Mesa: mestre = hostSession real atrás do WebSocket roteado; jogador = celular
// ───────────────────────────────────────────────────────────────────────────

interface Mesa {
  corDoSinal: string
  dedos: CDPSession
}

async function jogadorNoCelular(page: Page): Promise<Mesa> {
  let mapa = mapaDoTeste()
  const sessao = createHostSession({ code: CODIGO, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  let socket: WebSocketRoute | null = null
  let playerId: string | null = null
  const despachar = (saidas: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saidas) {
      if (clientId !== CLIENTE || socket === null) continue
      if (msg.type === 'welcome') playerId = msg.playerId
      socket.send(JSON.stringify(msg))
    }
  }
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((bruto) => {
      const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
      const r = sessao.handleMessage(CLIENTE, texto, mapa)
      despachar(r.outbound)
      if (r.applyMove) {
        const { tokenId, x, y } = r.applyMove
        mapa = { ...mapa, tokens: mapa.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
        despachar(sessao.broadcast(mapa).outbound)
      }
    })
  })

  await page.goto('/player.html')
  const campoCodigo = page.getByLabel('Código da sala')
  await campoCodigo.tap()
  await campoCodigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.tap()
  await campoNome.pressSequentially('Ana', { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).tap()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  expect(playerId, 'o mestre deveria ter dado boas-vindas ao jogador').not.toBeNull()

  // O mestre atribui a ficha e transmite (o painel do mestre faz o mesmo em um clique).
  despachar(sessao.assignToken(playerId ?? '', 'tok-f').outbound)
  despachar(sessao.broadcast(mapa).outbound)
  await expect(page.locator('canvas').first(), 'o mapa deveria aparecer no celular').toBeVisible({ timeout: 10_000 })

  const corDoSinal = signalColor(playerId ?? '')
  await expect
    .poll(async () => camera(await lerTela(page, corDoSinal)) !== null, { timeout: ESPERA, message: 'a ficha e os dois marcos deveriam aparecer na tela do celular' })
    .toBe(true)
  return { corDoSinal, dedos: await page.context().newCDPSession(page) }
}

// ───────────────────────────────────────────────────────────────────────────
// Dedos (entrada de toque do navegador) e leitura de pixel
// ───────────────────────────────────────────────────────────────────────────

type Toque = 'touchStart' | 'touchMove' | 'touchEnd'

async function toque(dedos: CDPSession, type: Toque, pontos: Ponto[]): Promise<void> {
  await dedos.send('Input.dispatchTouchEvent', { type, touchPoints: pontos.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id })) })
}

const entre = (a: Ponto, b: Ponto, t: number): Ponto => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Um dedo: encosta, anda em passos, fica parado `pausa` ms e solta. */
async function arrastarUmDedo(dedos: CDPSession, de: Ponto, para: Ponto, pausa: number): Promise<void> {
  await toque(dedos, 'touchStart', [de])
  for (let i = 1; i <= PASSOS_UM_DEDO; i += 1) {
    await toque(dedos, 'touchMove', [entre(de, para, i / PASSOS_UM_DEDO)])
    await esperar(QUADRO_MS)
  }
  await esperar(pausa)
  await toque(dedos, 'touchEnd', [])
}

/** Pinça: o primeiro dedo encosta, o segundo 40 ms depois, os dois andam juntos, param e soltam. */
async function pinca(dedos: CDPSession, a0: Ponto, b0: Ponto, a1: Ponto, b1: Ponto): Promise<void> {
  await toque(dedos, 'touchStart', [a0])
  await esperar(40)
  await toque(dedos, 'touchStart', [a0, b0])
  for (let i = 1; i <= PASSOS; i += 1) {
    const t = i / PASSOS
    await toque(dedos, 'touchMove', [entre(a0, a1, t), entre(b0, b1, t)])
    await esperar(QUADRO_MS)
  }
  await esperar(PAUSA_PINCA_MS)
  await toque(dedos, 'touchEnd', [])
}

interface Leitura {
  ficha: Ponto | null
  marco1: Ponto | null
  marco2: Ponto | null
  fichaPx: number
  sinalPx: number
}

/** Foto da tela → canvas solto → centro de cada cor e contagem do sinal. Só LÊ. */
async function lerTela(page: Page, corDoSinal: string): Promise<Leitura> {
  await page.waitForTimeout(250)
  const foto = await page.screenshot()
  return page.evaluate(
    async ({ b64, sinal }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const sR = parseInt(sinal.slice(1, 3), 16)
      const sG = parseInt(sinal.slice(3, 5), 16)
      const sB = parseInt(sinal.slice(5, 7), 16)
      const escalaX = window.innerWidth / width
      const escalaY = window.innerHeight / height
      const soma = { f: [0, 0, 0], m1: [0, 0, 0], m2: [0, 0, 0] }
      let sinalPx = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let alvo: number[] | null = null
          if (G > 200 && R > 20 && R < 120 && B < 60) alvo = soma.f
          else if (R > 200 && G > 50 && G < 140 && B < 60) alvo = soma.m1
          else if (R > 200 && B > 200 && G < 60) alvo = soma.m2
          if (alvo) {
            alvo[0] += x
            alvo[1] += y
            alvo[2] += 1
          }
          if (Math.abs(R - sR) <= 20 && Math.abs(G - sG) <= 20 && Math.abs(B - sB) <= 20) sinalPx += 1
        }
      }
      const centro = (s: number[]) => (s[2] < 40 ? null : { x: (s[0] / s[2]) * escalaX, y: (s[1] / s[2]) * escalaY })
      return { ficha: centro(soma.f), marco1: centro(soma.m1), marco2: centro(soma.m2), fichaPx: soma.f[2], sinalPx }
    },
    { b64: foto.toString('base64'), sinal: corDoSinal },
  )
}

interface Camera {
  escala: number
  /** Ponto do mundo sob um ponto da tela. */
  mundo: (p: Ponto) => Ponto
  /** Ponto do mundo em que a ficha está AGORA. */
  fichaW: Ponto
  fichaS: Ponto
}

/** A câmera do jogador, lida dos dois marcos: escala e origem (sem rotação). */
function camera(l: Leitura): Camera | null {
  if (!l.ficha || !l.marco1 || !l.marco2 || l.fichaPx < PIXELS_DE_FICHA) return null
  const m1 = l.marco1
  const escala = Math.hypot(l.marco2.x - m1.x, l.marco2.y - m1.y) / DIST_MARCOS_W
  const mundo = (p: Ponto): Ponto => ({ x: MARCO1_W.x + (p.x - m1.x) / escala, y: MARCO1_W.y + (p.y - m1.y) / escala })
  return { escala, mundo, fichaW: mundo(l.ficha), fichaS: l.ficha }
}

async function cameraAgora(page: Page, mesa: Mesa, oQue: string): Promise<Camera> {
  const c = camera(await lerTela(page, mesa.corDoSinal))
  expect(c, `${oQue}: a ficha e os dois marcos deveriam estar na tela (se saíram, o zoom foi além de ~2,7x)`).not.toBeNull()
  return c as Camera
}

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y)
const mais = (a: Ponto, dx: number, dy: number): Ponto => ({ x: a.x + dx, y: a.y + dy })

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: no celular, um dedo na ficha arrasta a ficha, no chão arrasta a câmera e parado no chão sinaliza', async ({ page }) => {
  test.setTimeout(90_000)
  const mesa = await jogadorNoCelular(page)
  const c0 = await cameraAgora(page, mesa, 'antes')
  expect(distancia(c0.fichaW, FICHA_W), 'a leitura de câmera pelos marcos deveria achar a ficha no lugar do mapa').toBeLessThan(10)
  expect((await lerTela(page, mesa.corDoSinal)).sinalPx, 'antes de sinalizar, a cor do sinal não deveria estar na tela').toBeLessThanOrEqual(RESIDUO)

  // Um dedo na ficha: arrasta 60 px para a direita → a ficha anda 60/escala no mundo.
  await arrastarUmDedo(mesa.dedos, c0.fichaS, mais(c0.fichaS, 60, 0), PAUSA_ARRASTO_MS)
  const esperadoW = { x: FICHA_W.x + 60 / c0.escala, y: FICHA_W.y }
  await expect
    .poll(async () => distancia((await cameraAgora(page, mesa, 'depois de arrastar a ficha')).fichaW, esperadoW), { timeout: ESPERA, message: 'um dedo na ficha deveria arrastar a ficha' })
    .toBeLessThan(15)
  const c1 = await cameraAgora(page, mesa, 'depois de arrastar a ficha')
  expect(Math.abs(c1.escala / c0.escala - 1), 'arrastar a ficha não muda o zoom').toBeLessThan(0.03)

  // Um dedo no chão (abaixo da ficha): arrasta 50 px para baixo → a câmera anda 50 px, o zoom fica.
  const chao = mais(c1.fichaS, 0, 90)
  const marcoAntes = (await lerTela(page, mesa.corDoSinal)).marco1 as Ponto
  await arrastarUmDedo(mesa.dedos, chao, mais(chao, 0, 50), PAUSA_ARRASTO_MS)
  const l2 = await lerTela(page, mesa.corDoSinal)
  expect(l2.marco1, 'o marco deveria continuar na tela').not.toBeNull()
  expect((l2.marco1 as Ponto).y - marcoAntes.y, 'um dedo no chão deveria arrastar a câmera 50 px').toBeGreaterThan(44)
  expect((l2.marco1 as Ponto).y - marcoAntes.y, 'um dedo no chão deveria arrastar a câmera 50 px').toBeLessThan(56)
  const c2 = camera(l2) as Camera
  expect(Math.abs(c2.escala / c0.escala - 1), 'arrastar a câmera não muda o zoom').toBeLessThan(0.03)

  // Um dedo parado no chão: sinaliza (a cor do sinal do jogador aparece na tela).
  const parado = mais(c2.fichaS, -90, 60)
  await toque(mesa.dedos, 'touchStart', [parado])
  await esperar(SEGURAR_MS)
  await toque(mesa.dedos, 'touchEnd', [])
  await expect
    .poll(async () => (await lerTela(page, mesa.corDoSinal)).sinalPx, { timeout: 2000, message: 'um dedo parado no chão deveria sinalizar' })
    .toBeGreaterThan(PIXELS_DE_SINAL)
})

test('2. pinça abrindo (um dedo na ficha) aproxima pelo ponto médio, sem mover a ficha e sem sinalizar', async ({ page }) => {
  test.setTimeout(90_000)
  const mesa = await jogadorNoCelular(page)
  const c0 = await cameraAgora(page, mesa, 'antes da pinça')
  const a0 = c0.fichaS
  const b0 = mais(a0, 50, 0)
  const meio = mais(a0, 25, 0)
  const meioW = c0.mundo(meio)

  // Dedos a 50 px → 130 px, abrindo em volta do mesmo ponto médio.
  await pinca(mesa.dedos, a0, b0, mais(a0, -40, 0), mais(a0, 90, 0))

  const c1 = await cameraAgora(page, mesa, 'depois da pinça abrindo')
  expect(c1.escala / c0.escala, 'a pinça abrindo deveria aproximar (escala pelo menos 1,5x maior)').toBeGreaterThan(1.5)
  expect(distancia(c1.mundo(meio), meioW), 'o ponto do mapa sob o meio dos dedos deveria continuar sob o meio dos dedos').toBeLessThan(GRADE / 2)
  expect(distancia(c1.fichaW, FICHA_W), 'a pinça não deveria mover a ficha no mapa').toBeLessThan(12)
  expect((await lerTela(page, mesa.corDoSinal)).sinalPx, 'a pinça (parada antes de soltar) não deveria sinalizar').toBeLessThanOrEqual(RESIDUO)
})

test('3. pinça no chão: abrindo aproxima e fechando afasta, sem sinalizar', async ({ page }) => {
  test.setTimeout(90_000)
  const mesa = await jogadorNoCelular(page)
  const c0 = await cameraAgora(page, mesa, 'antes da pinça')
  const meio = mais(c0.fichaS, 0, 100)

  await pinca(mesa.dedos, mais(meio, -30, 0), mais(meio, 30, 0), mais(meio, -90, 0), mais(meio, 90, 0))
  const c1 = await cameraAgora(page, mesa, 'depois de abrir')
  expect(c1.escala / c0.escala, 'a pinça abrindo no chão deveria aproximar').toBeGreaterThan(1.5)

  await pinca(mesa.dedos, mais(meio, -90, 0), mais(meio, 90, 0), mais(meio, -30, 0), mais(meio, 30, 0))
  const c2 = await cameraAgora(page, mesa, 'depois de fechar')
  expect(c2.escala / c1.escala, 'a pinça fechando deveria afastar').toBeLessThan(0.7)
  expect(distancia(c2.fichaW, FICHA_W), 'a pinça não deveria mover a ficha').toBeLessThan(12)
  expect((await lerTela(page, mesa.corDoSinal)).sinalPx, 'a pinça não deveria sinalizar').toBeLessThanOrEqual(RESIDUO)
})

test("4. botões no canto: '+' duas vezes aproxima em degraus e '−' afasta", async ({ page }) => {
  test.setTimeout(90_000)
  const mesa = await jogadorNoCelular(page)
  const c0 = await cameraAgora(page, mesa, 'antes do +')

  const botaoMais = page.getByRole('button', { name: BOTAO_MAIS })
  const botaoMenos = page.getByRole('button', { name: BOTAO_MENOS })
  await expect(botaoMais.first(), "a tela do jogador no celular deveria ter um botão '+' de zoom").toBeInViewport({ timeout: ESPERA })
  await expect(botaoMenos.first(), "a tela do jogador no celular deveria ter um botão '−' de zoom").toBeInViewport({ timeout: ESPERA })

  await botaoMais.first().tap()
  await expect.poll(async () => (await cameraAgora(page, mesa, "depois do 1º '+'")).escala / c0.escala, { timeout: ESPERA, message: "o 1º toque no '+' deveria aproximar um degrau" }).toBeGreaterThan(1.15)
  const c1 = await cameraAgora(page, mesa, "depois do 1º '+'")

  await botaoMais.first().tap()
  await expect.poll(async () => (await cameraAgora(page, mesa, "depois do 2º '+'")).escala / c1.escala, { timeout: ESPERA, message: "o 2º toque no '+' deveria aproximar mais um degrau" }).toBeGreaterThan(1.15)
  const c2 = await cameraAgora(page, mesa, "depois do 2º '+'")

  await botaoMenos.first().tap()
  await expect.poll(async () => (await cameraAgora(page, mesa, "depois do '−'")).escala / c2.escala, { timeout: ESPERA, message: "o toque no '−' deveria afastar" }).toBeLessThan(0.87)
  expect(distancia((await cameraAgora(page, mesa, 'no fim')).fichaW, FICHA_W), 'os botões de zoom não movem a ficha').toBeLessThan(12)
})
