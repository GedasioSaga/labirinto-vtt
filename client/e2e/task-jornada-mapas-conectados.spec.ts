// Jornada de usuário: "mapas conectados" — o mestre liga a rua à casa por uma
// passagem; o jogador que pisa nela ENTRA (a tela dele vira a casa) e quem
// ficou na rua vê o companheiro sumir; saindo da casa, a rua que ele já tinha
// explorado continua lembrada.
//
// As três provas SAEM VERMELHAS hoje, cada uma por um motivo diferente e já
// lido no código:
//
//  1. Ligar duas cenas só existe preso a uma PEÇA (`Prop.linkedMapPath`,
//     src/types/map.ts:255) e por CAMINHO ABSOLUTO; a UI de portal
//     (src/components/PortalControls.tsx) é montada só com `selectedProp`
//     (src/App.tsx:1412-1418). Uma parede/porta selecionada não oferece nada,
//     e não existe lista de cenas: `handleEnterLinkedMap` (src/App.tsx:896)
//     TROCA o mapa do único store (src/stores/mapStore.ts:1267 `loadMap`).
//  2. O host serve SEMPRE o mapa que o mestre está editando
//     (`getMap: () => useMapStore.getState().map`, src/App.tsx:217) e existe UM
//     mapa em memória. Token de jogador em cena diferente é impossível, e não
//     há `applyTransfer` em `HostResult` (src/net/hostSession.ts:44-49).
//  3. A memória de exploração é UMA por jogador, com a chave amarrada ao mapa
//     (`memoryKey`/`memoryFor`, src/net/hostSession.ts:123-166): mapa diferente
//     APAGA o explorado anterior. Sair da casa apagaria a rua toda.
//
// COMO ESTA JORNADA NÃO FABRICA A FEATURE
//
// Nos testes 2 e 3 o spec faz o papel da PONTE do mestre (src/net/hostBridge.ts),
// exatamente como `task-player-door.spec.ts` já faz ao aplicar `result.applyMove`
// no mapa e retransmitir. A ponte OBEDECE, nunca decide:
//   * a cena de cada cliente só muda quando o HOST manda (`applyTransfer` no
//     `HostResult`, campo novo previsto no plano §4, lido aqui por cast);
//   * a ponte nunca olha portal nenhum, nunca compara posição com portal e
//     nunca move token entre cenas por conta própria.
// Se o host não decidir, ninguém troca de cena — e é por isso que os testes 2 e
// 3 ficam vermelhos hoje.
//
// ASSERÇÃO SEMPRE NO QUE APARECE NA TELA. Cada cena tem uma MARCA de cor pura
// que só ela desenha (rua = círculo VERMELHO puro, casa = círculo VERDE puro);
// "estou na casa" é medido contando pixel verde na foto do canvas, não lendo
// store, mapa nem mensagem. O token do próprio jogador é #3b82f6 e o do
// companheiro #9ca3af (src/player/PlayerView.tsx:72-73): "o companheiro sumiu"
// é a contagem desses pixels indo a zero na tela de quem ficou.
//
// Nada do painel entra na conta: ele é `position: fixed` no canto superior
// esquerdo, 248 px (player.css:407), então toda medida fica em x > 300 px CSS.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession, type HostResult, type HostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { Drawing, MapData, Token } from '../src/types/map'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'CASA01'
const GRADE = 50
const CELULAS_X = 20
const CELULAS_Y = 12
const MUNDO_W = CELULAS_X * GRADE // 1000
const MUNDO_H = CELULAS_Y * GRADE // 600
const MARGEM_FIT = 24 // FIT_MARGIN de PlayerView.tsx
const JANELA = { width: 1280, height: 800 } // playwright.config.ts

/** Coluna do painel do jogador (player.css:407): nada é medido à esquerda disto. */
const BORDA_DO_PAINEL = 300

const CENA_RUA = 'cena-rua'
const CENA_CASA = 'cena-casa'

/** Onde se pisa para entrar na casa, na rua (centro da área do portal). */
const PORTAL_NA_RUA = { x: 675, y: 300 }
/** Onde quem chega da casa aparece na rua. */
const ENTRADA_DA_RUA = { x: 620, y: 300 }
/** Onde se pisa para sair, dentro da casa. */
const PORTAL_NA_CASA = { x: 325, y: 300 }
/** Onde quem chega da rua aparece na casa. */
const ENTRADA_DA_CASA = { x: 400, y: 300 }

const TOKEN_J1 = { id: 'tok-j1', x: 300, y: 300 }
const TOKEN_J2 = { id: 'tok-j2', x: 300, y: 480 }

/**
 * Pixels da marca de cena que precisam aparecer para a tela contar como "estou
 * nesta cena". O círculo tem raio 40 px de mundo e a câmera do jogador entra em
 * escala ~1,23 (fitCamera de pixi/world.ts:219 com o mapa 1000x600 na janela
 * 1280x800), ou seja ~7 500 px de área. 1 500 é um quinto disso: sobra folga
 * para névoa de borda e antisserrilhado, e não sobra para ruído.
 */
const PIXELS_DA_MARCA = 1500

/**
 * Teto de pixels do token do companheiro na tela de quem ficou, depois de ele
 * entrar na casa. Não é zero por causa da borda antisserrilhada do que mais
 * estiver na tela; o token inteiro pinta mais de 300 px (é o piso usado para
 * provar que ele ESTAVA lá, no mesmo teste).
 */
const TETO_DO_TOKEN_QUE_SUMIU = 40
/** Piso de pixels de um token presente na tela — mesmo valor da jornada da luz. */
const PISO_DE_TOKEN_PRESENTE = 300

/** #3b82f6 — OWN_TOKEN_COLOR de player/PlayerView.tsx:72. */
const COR_TOKEN_PROPRIO: Cor = [0x3b, 0x82, 0xf6]
/** #9ca3af — OTHER_TOKEN_COLOR de player/PlayerView.tsx:73. */
const COR_TOKEN_ALHEIO: Cor = [0x9c, 0xa3, 0xaf]

type Cor = [number, number, number]
/** O que `locator.screenshot()` devolve — sem @types/node no tsconfig dos e2e. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>
interface Ponto {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// O QUE AINDA NÃO EXISTE, escrito como o plano define (docs/plano-mapas-conectados.md
// §1 e §4). Os dois tipos moram aqui e entram no `MapData`/`HostResult` por cast:
// assim o spec compila hoje (o campo não existe) e continua compilando quando
// existir. É a forma de uma jornada nomear o futuro sem inventar API paralela.
// ---------------------------------------------------------------------------
interface PortalFuturo {
  id: string
  label: string
  anchor: { kind: 'area'; x: number; y: number; w: number; h: number }
  entry: Ponto
  target: { sceneId: string; portalId: string } | null
  mode: 'auto' | 'prompt' | 'master'
  locked: boolean
}

interface TransferenciaFutura {
  tokenId: string
  fromSceneId: string
  toSceneId: string
  x: number
  y: number
}

function comPortais(mapa: MapData, portais: PortalFuturo[]): MapData {
  return { ...mapa, portals: portais } as unknown as MapData
}

/** Só o host decide travessia; a ponte lê a decisão, nunca a toma. */
function transferenciaDe(resultado: HostResult): TransferenciaFutura | null {
  return (resultado as unknown as { applyTransfer?: TransferenciaFutura }).applyTransfer ?? null
}

// ---------------------------------------------------------------------------
// Cenas
// ---------------------------------------------------------------------------
function token(id: string, nome: string, x: number, y: number): Token {
  return { id, characterId: null, name: nome, x, y, size: 1, image: null }
}

function marca(id: string, cor: string, cx: number, cy: number): Drawing {
  return { id, kind: 'circle', cx, cy, radius: 40, color: cor, width: 2, filled: true, fillAlpha: 1 }
}

function chaoInteiro() {
  return [{ id: 'f-chao', shape: { kind: 'rect' as const, cx: MUNDO_W / 2, cy: MUNDO_H / 2, w: MUNDO_W - 20, h: MUNDO_H - 20 }, op: 'add' as const, modifiers: {} }]
}

const PORTAL_RUA: PortalFuturo = {
  id: 'p-rua-casa',
  label: 'Entrar na casa',
  anchor: { kind: 'area', x: PORTAL_NA_RUA.x - 25, y: PORTAL_NA_RUA.y - 25, w: GRADE, h: GRADE },
  entry: ENTRADA_DA_RUA,
  target: { sceneId: CENA_CASA, portalId: 'p-casa-rua' },
  mode: 'auto',
  locked: false,
}

const PORTAL_CASA: PortalFuturo = {
  id: 'p-casa-rua',
  label: 'Sair',
  anchor: { kind: 'area', x: PORTAL_NA_CASA.x - 25, y: PORTAL_NA_CASA.y - 25, w: GRADE, h: GRADE },
  entry: ENTRADA_DA_CASA,
  target: { sceneId: CENA_RUA, portalId: 'p-rua-casa' },
  mode: 'auto',
  locked: false,
}

/** `marcaEm`: onde fica o círculo de cor pura da cena — perto do portal quando a visão é curta. */
function rua(marcaEm: Ponto, tokens: Token[]): MapData {
  return comPortais(
    {
      ...createEmptyMap(CENA_RUA, 'Rua', CELULAS_X, CELULAS_Y, GRADE),
      floor: chaoInteiro(),
      drawings: [marca('d-rua', '#ff0000', marcaEm.x, marcaEm.y)],
      tokens,
    },
    [PORTAL_RUA],
  )
}

function casa(marcaEm: Ponto): MapData {
  return comPortais(
    {
      ...createEmptyMap(CENA_CASA, 'Casa do Ferreiro', CELULAS_X, CELULAS_Y, GRADE),
      floor: chaoInteiro(),
      drawings: [marca('d-casa', '#00ff00', marcaEm.x, marcaEm.y)],
      tokens: [],
    },
    [PORTAL_CASA],
  )
}

// ---------------------------------------------------------------------------
// A ponte do mestre, feita pelo spec (mesmo papel de src/net/hostBridge.ts)
// ---------------------------------------------------------------------------
interface Ponte {
  sessao: HostSession
  /** Cena de cada cliente. Só muda por ordem do host. */
  cenaDe(clientId: string): string
  cena(sceneId: string): MapData
  transmitir(): void
  entrar(page: Page, clientId: string): Promise<void>
  idDoJogador(clientId: string): string | null
}

function montarPonte(cenas: Record<string, MapData>, raioDeVisao: number): Ponte {
  const sessao = createHostSession({
    code: CODIGO,
    visionRadius: raioDeVisao,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  const sockets = new Map<string, WebSocketRoute>()
  const cenaPorCliente: Record<string, string> = {}
  const jogadorPorCliente: Record<string, string | null> = {}

  const despachar = (saidas: { clientId: string; msg: HostMessage }[], somenteDaCena: string | null) => {
    for (const { clientId, msg } of saidas) {
      const socket = sockets.get(clientId)
      if (socket === undefined) continue
      // Broadcast de cena: só chega a quem o HOST colocou nela.
      if (somenteDaCena !== null && (cenaPorCliente[clientId] ?? CENA_RUA) !== somenteDaCena) continue
      if (msg.type === 'welcome') jogadorPorCliente[clientId] = msg.playerId
      socket.send(JSON.stringify(msg))
    }
  }

  const transmitir = () => {
    // Uma transmissão por cena COM gente dentro (plano §3: o host resolve o mapa
    // por cena, não por "o que o mestre está vendo").
    const ocupadas = new Set(Object.values(cenaPorCliente))
    for (const sceneId of ocupadas) despachar(sessao.broadcast(cenas[sceneId]).outbound, sceneId)
  }

  const aoReceber = (clientId: string, texto: string) => {
    const cenaAtual = cenaPorCliente[clientId] ?? CENA_RUA
    const resultado = sessao.handleMessage(clientId, texto, cenas[cenaAtual])
    despachar(resultado.outbound, null)

    if (resultado.applyMove) {
      const { tokenId, x, y } = resultado.applyMove
      const mapa = cenas[cenaAtual]
      cenas[cenaAtual] = { ...mapa, tokens: mapa.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
    }
    if (resultado.applyDoor) {
      const { wallId, open } = resultado.applyDoor
      const mapa = cenas[cenaAtual]
      cenas[cenaAtual] = { ...mapa, walls: mapa.walls.map((w) => (w.id === wallId && w.door ? { ...w, door: { ...w.door, open } } : w)) }
    }
    // A ÚNICA porta por onde um cliente muda de cena: ordem explícita do host.
    const transferencia = transferenciaDe(resultado)
    if (transferencia) {
      const { tokenId, fromSceneId, toSceneId, x, y } = transferencia
      const origem = cenas[fromSceneId]
      const movido = origem.tokens.find((t) => t.id === tokenId)
      if (movido) {
        cenas[fromSceneId] = { ...origem, tokens: origem.tokens.filter((t) => t.id !== tokenId) }
        const destino = cenas[toSceneId]
        cenas[toSceneId] = { ...destino, tokens: [...destino.tokens, { ...movido, x, y }] }
      }
      for (const [outro, jogador] of Object.entries(jogadorPorCliente)) {
        if (jogador !== null && sessao.listPlayers().some((p) => p.playerId === jogador && p.tokenIds.includes(tokenId))) {
          cenaPorCliente[outro] = toSceneId
        }
      }
    }
    if (resultado.applyMove || resultado.applyDoor || transferencia) transmitir()
  }

  return {
    sessao,
    cenaDe: (clientId) => cenaPorCliente[clientId] ?? CENA_RUA,
    cena: (sceneId) => cenas[sceneId],
    transmitir,
    idDoJogador: (clientId) => jogadorPorCliente[clientId] ?? null,
    entrar: async (page, clientId) => {
      cenaPorCliente[clientId] = CENA_RUA
      jogadorPorCliente[clientId] = null
      await page.routeWebSocket(
        (url) => url.pathname === '/ws',
        (ws) => {
          sockets.set(clientId, ws)
          ws.onMessage((cru) => aoReceber(clientId, typeof cru === 'string' ? cru : cru.toString('utf8')))
        },
      )
    },
  }
}

// ---------------------------------------------------------------------------
// Tela: gesto e medida
// ---------------------------------------------------------------------------

/** Mesmo enquadramento que o PlayerView aplica no primeiro snapshot (fitCamera, pixi/world.ts:219). */
function naTela(p: Ponto): Ponto {
  const escala = Math.min((JANELA.width - MARGEM_FIT * 2) / MUNDO_W, (JANELA.height - MARGEM_FIT * 2) / MUNDO_H)
  return { x: JANELA.width / 2 + (p.x - MUNDO_W / 2) * escala, y: JANELA.height / 2 + (p.y - MUNDO_H / 2) * escala }
}

/** Arrasto de dedo: pousa, anda em passos e PARA antes de soltar. */
async function arrastarToken(page: Page, de: Ponto, para: Ponto): Promise<void> {
  const a = naTela(de)
  const b = naTela(para)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.waitForTimeout(180) // pausa de gente antes de soltar
  await page.mouse.up()
  await page.waitForTimeout(250)
}

/**
 * Entra na sala pelo formulário, tecla a tecla. O "selecionar tudo" antes de
 * digitar é gesto de gente e é NECESSÁRIO: o segundo jogador abre a página no
 * mesmo navegador do primeiro e o formulário já vem preenchido com o último
 * código lembrado (`rememberLastJoin`, player/main.tsx:174) — digitar por cima
 * produzia "CASCA0" e o mestre recusava, com razão.
 */
async function entrarComoJogador(page: Page, nome: string): Promise<void> {
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.press('ControlOrMeta+a')
  await codigo.pressSequentially(CODIGO, { delay: 15 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.press('ControlOrMeta+a')
  await campoNome.pressSequentially(nome, { delay: 15 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
}

interface Medida {
  /** Pixels da marca da RUA (vermelho puro). */
  vermelhos: number
  /** Pixels da marca da CASA (verde puro). */
  verdes: number
  /** Pixels do token do próprio jogador (#3b82f6). */
  proprios: number
  /** Pixels de token de companheiro (#9ca3af). */
  alheios: number
  /** Centro de massa do token próprio, em px CSS — prova que o arrasto pegou. */
  centroProprio: Ponto | null
  /** Luminância média numa janela de 11x11 px CSS em cada ponto pedido. */
  brilhos: number[]
}

/**
 * Fotografa o canvas e mede. A foto é decodificada pelo próprio navegador num
 * canvas 2D descartável: nada do app é lido nem tocado.
 */
async function medir(page: Page, pontos: Ponto[]): Promise<Medida> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const foto: Foto = await canvas.screenshot()
  return page.evaluate(
    async ({ b64, larguraCss, pontos, minX, proprio, alheio }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const el = document.createElement('canvas')
      el.width = bmp.width
      el.height = bmp.height
      const ctx = el.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const inicio = Math.round(minX * escala)
      const perto = (i: number, cor: number[], tol: number) =>
        Math.abs(data[i] - cor[0]) <= tol && Math.abs(data[i + 1] - cor[1]) <= tol && Math.abs(data[i + 2] - cor[2]) <= tol

      let vermelhos = 0
      let verdes = 0
      let proprios = 0
      let alheios = 0
      let somaX = 0
      let somaY = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = inicio; x < width; x += 1) {
          const i = (y * width + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (r > 150 && g < 80 && b < 80) vermelhos += 1
          else if (g > 150 && r < 80 && b < 80) verdes += 1
          if (perto(i, proprio, 12)) {
            proprios += 1
            somaX += x
            somaY += y
          } else if (perto(i, alheio, 12)) alheios += 1
        }
      }

      const em = (x: number, y: number): number[] => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(x)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(y)))
        const i = (cy * width + cx) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      const raio = Math.max(1, Math.round(5 * escala))
      const brilhos = pontos.map((p) => {
        let soma = 0
        let n = 0
        for (let dy = -raio; dy <= raio; dy += 1) {
          for (let dx = -raio; dx <= raio; dx += 1) {
            const [r, g, b] = em(p.x * escala + dx, p.y * escala + dy)
            soma += (r + g + b) / 3
            n += 1
          }
        }
        return Math.round((soma / n) * 10) / 10
      })

      return {
        vermelhos,
        verdes,
        proprios,
        alheios,
        centroProprio: proprios === 0 ? null : { x: somaX / proprios / escala, y: somaY / proprios / escala },
        brilhos,
      }
    },
    { b64: foto.toString('base64'), larguraCss: caixa.width, pontos, minX: BORDA_DO_PAINEL, proprio: COR_TOKEN_PROPRIO as number[], alheio: COR_TOKEN_ALHEIO as number[] },
  )
}

/** Rótulos brancos sujariam as janelas de amostragem; desligar é clique de verdade. */
async function desligarNomes(page: Page): Promise<void> {
  await page.getByLabel('Nomes').uncheck()
  await expect(page.getByLabel('Nomes')).not.toBeChecked()
  await page.waitForTimeout(400)
}

// ===========================================================================
// 1. O MESTRE LIGA DUAS CENAS POR UMA PASSAGEM — E CONSEGUE VOLTAR
// ===========================================================================
//
// Mapa novo do editor: 30x20 de grade 64, câmera nasce {x:0,y:0,scale:1}
// (mapStore.ts:747, nada dá fit), então px de mundo = px CSS dentro do canvas.
// Coordenadas com x >= 400 e y >= 200 de propósito: o painel esquerdo (~280 px)
// e a barra de cima são DOM por cima do canvas e engolem o clique.
const PAREDE_DE = { x: 700, y: 260 }
const PAREDE_ATE = { x: 700, y: 520 }
/** Meio da parede: onde o clique de Selecionar pega ela. */
const MEIO_DA_PAREDE = { x: 700, y: 390 }
/** Quanto do canvas é olhado: à direita do painel e abaixo da barra. */
const AREA_DO_MAPA = { x: 340, y: 180 }

async function pixelsClarosNoCanvas(page: Page): Promise<number> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const foto: Foto = await canvas.screenshot()
  return page.evaluate(
    async ({ b64, larguraCss, corte }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const el = document.createElement('canvas')
      el.width = bmp.width
      el.height = bmp.height
      const ctx = el.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      let claros = 0
      for (let y = Math.round(corte.y * escala); y < height; y += 1) {
        for (let x = Math.round(corte.x * escala); x < width; x += 1) {
          const i = (y * width + x) * 4
          if ((data[i] + data[i + 1] + data[i + 2]) / 3 > 170) claros += 1
        }
      }
      return claros
    },
    { b64: foto.toString('base64'), larguraCss: caixa.width, corte: AREA_DO_MAPA },
  )
}

test('1. o mestre liga a parede da casa a uma cena nova, entra nela e VOLTA pela lista de cenas', async ({ page }) => {
  test.setTimeout(120_000)
  await installTauriFsStub(page)
  await enterEditor(page)

  // A passagem que o usuário desenha é uma PAREDE (a porta da casa), não uma
  // peça de imagem: gesto de ponteiro de ponta a ponta.
  await pickTool(page, 'Parede')
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  await page.mouse.move(caixa.x + PAREDE_DE.x, caixa.y + PAREDE_DE.y)
  await page.mouse.down()
  await page.mouse.move(caixa.x + PAREDE_ATE.x, caixa.y + PAREDE_ATE.y, { steps: 10 })
  await page.waitForTimeout(180) // pausa antes de soltar
  await page.mouse.up()

  // A parede está na tela: é o controle positivo de tudo que vem depois.
  const comParede = await pixelsClarosNoCanvas(page)
  expect(comParede, 'a parede desenhada não apareceu no canvas do mestre').toBeGreaterThan(500)

  await pickTool(page, 'Selecionar')
  await page.mouse.click(caixa.x + MEIO_DA_PAREDE.x, caixa.y + MEIO_DA_PAREDE.y)

  // A DOR 1: com a passagem selecionada, o rail tem de oferecer ligar a cena.
  // Hoje "Andar" (PortalControls) só é montado com `selectedProp`
  // (App.tsx:1412) — uma parede selecionada não oferece destino nenhum.
  const ligar = page.getByRole('button', { name: /Leva a/i })
  await expect(ligar, 'parede selecionada não oferece "Leva a..." — ligar cena só existe preso a uma peça de imagem, por caminho ABSOLUTO (Prop.linkedMapPath)').toBeVisible({ timeout: 6000 })
  await ligar.click()
  await page.getByRole('button', { name: /Nova cena em branco/i }).click()

  // A DOR 2: tem de existir uma LISTA DE CENAS na tela, com as duas cenas.
  const cabecalhoCenas = page.locator('.lb-inspector').getByRole('button', { name: 'Cenas', exact: true })
  await expect(cabecalhoCenas, 'não existe seção "Cenas" no rail: hoje há um mapa só em memória (mapStore.ts:1267)').toBeVisible({ timeout: 6000 })
  const corpoId = await cabecalhoCenas.getAttribute('aria-controls')
  if (!corpoId) throw new Error('cabeçalho de Cenas sem aria-controls')
  const listaDeCenas = page.locator(`[id="${corpoId}"]`).getByRole('button')
  await expect(listaDeCenas).toHaveCount(2, { timeout: 6000 })

  // Entrar na cena nova: ela está em branco, então o canvas perde a parede.
  await listaDeCenas.nth(1).click()
  await page.waitForTimeout(500)
  const naCenaNova = await pixelsClarosNoCanvas(page)
  expect(naCenaNova, 'a cena nova não está em branco: o canvas continua com o mesmo desenho da primeira').toBeLessThan(comParede / 4)

  // E VOLTAR: a primeira cena volta inteira, com a parede onde estava.
  await listaDeCenas.nth(0).click()
  await page.waitForTimeout(500)
  const deVolta = await pixelsClarosNoCanvas(page)
  expect(deVolta, 'voltando para a primeira cena o desenho não voltou').toBeGreaterThan(comParede * 0.8)

  // E a ligação continua lá, visível na tela, com o nome do destino.
  await page.mouse.click(caixa.x + MEIO_DA_PAREDE.x, caixa.y + MEIO_DA_PAREDE.y)
  await expect(page.locator('.lb-inspector'), 'a parede voltou sem lembrar para onde ela leva').toContainText(/Leva a/i)
})

// ===========================================================================
// 2. O JOGADOR ENTRA NA CASA; QUEM FICOU NA RUA VÊ ELE SUMIR
// ===========================================================================
test('2. o jogador que pisa na passagem passa a VER a casa, e o companheiro que ficou continua na rua e vê o token sumir', async ({ page, context }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  const marcaLonge = { x: 500, y: 150 } // com visão de 2000 px tudo é visível
  const cenas: Record<string, MapData> = {
    [CENA_RUA]: rua(marcaLonge, [token(TOKEN_J1.id, 'Grog', TOKEN_J1.x, TOKEN_J1.y), token(TOKEN_J2.id, 'Bia', TOKEN_J2.x, TOKEN_J2.y)]),
    [CENA_CASA]: casa(marcaLonge),
  }
  const ponte = montarPonte(cenas, 2000)

  const telaJ1 = page
  const telaJ2 = await context.newPage()
  telaJ2.on('pageerror', (e) => erros.push(e.message))
  await ponte.entrar(telaJ1, 'c1')
  await ponte.entrar(telaJ2, 'c2')

  await entrarComoJogador(telaJ1, 'Grog')
  await entrarComoJogador(telaJ2, 'Bia')

  const j1 = ponte.idDoJogador('c1')
  const j2 = ponte.idDoJogador('c2')
  if (j1 === null || j2 === null) throw new Error('o mestre não mandou welcome para os dois jogadores')
  ponte.sessao.assignToken(j1, TOKEN_J1.id)
  ponte.sessao.assignToken(j2, TOKEN_J2.id)
  ponte.transmitir()

  await expect(telaJ1.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(telaJ2.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await desligarNomes(telaJ1)
  await desligarNomes(telaJ2)

  // PONTO DE PARTIDA, medido na tela: os dois estão na RUA (marca vermelha),
  // cada um vê o próprio token e o do outro, e nada de verde em lugar nenhum.
  const inicioJ1 = await medir(telaJ1, [])
  expect(inicioJ1.vermelhos, 'a marca vermelha da rua não aparece na tela do jogador 1').toBeGreaterThan(PIXELS_DA_MARCA)
  expect(inicioJ1.proprios, 'o token do jogador 1 não aparece na tela dele').toBeGreaterThan(PISO_DE_TOKEN_PRESENTE)
  expect(inicioJ1.alheios, 'o token do companheiro não aparece na tela do jogador 1').toBeGreaterThan(PISO_DE_TOKEN_PRESENTE)
  const inicioJ2 = await medir(telaJ2, [])
  expect(inicioJ2.vermelhos, 'a marca vermelha da rua não aparece na tela do jogador 2').toBeGreaterThan(PIXELS_DA_MARCA)
  expect(inicioJ2.alheios, 'o token do jogador 1 não aparece na tela do jogador 2').toBeGreaterThan(PISO_DE_TOKEN_PRESENTE)

  // CONTROLE DO GESTO: um passo curto dentro da própria rua. Se o arrasto não
  // pegasse o token, tudo abaixo seria vermelho por motivo errado.
  const antes = inicioJ1.centroProprio
  if (antes === null) throw new Error('sem token próprio na foto para ancorar o gesto')
  await arrastarToken(telaJ1, TOKEN_J1, { x: TOKEN_J1.x + 100, y: TOKEN_J1.y })
  const depoisDoPasso = await medir(telaJ1, [])
  const andou = Math.hypot((depoisDoPasso.centroProprio?.x ?? antes.x) - antes.x, (depoisDoPasso.centroProprio?.y ?? antes.y) - antes.y)
  expect(andou, 'o arrasto de ponteiro não moveu o token na tela: o gesto não chegou ao app').toBeGreaterThan(40)

  // O GESTO QUE IMPORTA: pisar na passagem.
  await arrastarToken(telaJ1, { x: TOKEN_J1.x + 100, y: TOKEN_J1.y }, PORTAL_NA_RUA)

  // A DOR: a tela do jogador 1 tem de virar a CASA (marca verde) e largar a rua.
  await expect
    .poll(async () => (await medir(telaJ1, [])).verdes, { timeout: 15_000, intervals: [500, 1000, 1000, 2000, 2000, 2000, 2000] })
    .toBeGreaterThan(PIXELS_DA_MARCA)
  const dentro = await medir(telaJ1, [])
  expect(dentro.vermelhos, 'a rua continua desenhada na tela de quem entrou na casa').toBeLessThan(PIXELS_DA_MARCA / 5)
  expect(dentro.proprios, 'o token de quem entrou sumiu da própria tela').toBeGreaterThan(PISO_DE_TOKEN_PRESENTE)

  // E a tela de quem FICOU: continua a rua, sem nada da casa, e sem o token do
  // companheiro — ele entrou, a ficção diz que ele não está mais ali.
  const fora = await medir(telaJ2, [])
  expect(fora.vermelhos, 'quem ficou na rua parou de ver a rua').toBeGreaterThan(PIXELS_DA_MARCA)
  expect(fora.proprios, 'quem ficou na rua perdeu o próprio token de vista').toBeGreaterThan(PISO_DE_TOKEN_PRESENTE)
  expect(fora.verdes, 'quem ficou na rua está vendo o interior da casa').toBeLessThan(PIXELS_DA_MARCA / 5)
  expect(fora.alheios, 'o token do companheiro que entrou na casa continua desenhado na rua').toBeLessThan(TETO_DO_TOKEN_QUE_SUMIU)

  expect(erros, 'erro de página durante a travessia').toEqual([])
})

// ===========================================================================
// 3. VOLTAR DA CASA NÃO APAGA A RUA QUE ELE JÁ TINHA EXPLORADO
// ===========================================================================
//
// Visão curta (180 px) para a exploração ser PARCIAL e mensurável. A névoa do
// jogador tem três estados na tela (PlayerView.tsx:310-314):
//   visível   = chão cheio            (~200 de luminância)
//   lembrado  = chão escurecido       (brilho padrão 0,55 → ~110)
//   nunca visto = preto de verdade    (alpha 1 → ~0)
// Três pontos na MESMA foto, então a régua é a própria tela.
const MARCA_DA_RUA = { x: 620, y: 170 }
const MARCA_DA_CASA = { x: 460, y: 170 }
/** Explorado no começo do passeio; longe demais do fim para ainda estar visível. */
const P_LEMBRADO = { x: 300, y: 300 }
/** Fora do caminho inteiro: o preto da régua. */
const P_NUNCA = { x: 350, y: 560 }
/** Ao lado de onde o jogador volta a pisar na rua: o claro da régua. */
const P_VISIVEL = { x: 620, y: 240 }

test('3. sair da casa e voltar para a rua não apaga o que o jogador já tinha explorado lá fora', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  const cenas: Record<string, MapData> = {
    [CENA_RUA]: rua(MARCA_DA_RUA, [token(TOKEN_J1.id, 'Grog', TOKEN_J1.x, TOKEN_J1.y)]),
    [CENA_CASA]: casa(MARCA_DA_CASA),
  }
  const ponte = montarPonte(cenas, 180)
  await ponte.entrar(page, 'c1')
  await entrarComoJogador(page, 'Grog')
  const jogador = ponte.idDoJogador('c1')
  if (jogador === null) throw new Error('o mestre não mandou welcome')
  ponte.sessao.assignToken(jogador, TOKEN_J1.id)
  ponte.transmitir()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await desligarNomes(page)

  const pontos = [P_LEMBRADO, P_NUNCA, P_VISIVEL].map(naTela)

  // O passeio pela rua, em passos de gente, explorando o caminho.
  await arrastarToken(page, TOKEN_J1, { x: 450, y: 300 })
  await arrastarToken(page, { x: 450, y: 300 }, { x: 560, y: 300 })

  // Controle: o começo da rua está EXPLORADO agora — nem visível, nem preto.
  const antesDeEntrar = await medir(page, pontos)
  const [lembradoAntes, nuncaAntes] = antesDeEntrar.brilhos
  expect(lembradoAntes, `onde o jogador começou tinha de estar lembrado na tela (lembrado=${lembradoAntes}, nunca=${nuncaAntes})`).toBeGreaterThan(nuncaAntes + 25)

  // Entra na casa.
  await arrastarToken(page, { x: 560, y: 300 }, PORTAL_NA_RUA)
  await expect
    .poll(async () => (await medir(page, [])).verdes, { timeout: 15_000, intervals: [500, 1000, 1000, 2000, 2000, 2000, 2000] })
    .toBeGreaterThan(PIXELS_DA_MARCA)

  // E sai pela mesma passagem.
  await arrastarToken(page, ENTRADA_DA_CASA, PORTAL_NA_CASA)
  await expect
    .poll(async () => (await medir(page, [])).vermelhos, { timeout: 15_000, intervals: [500, 1000, 1000, 2000, 2000, 2000, 2000] })
    .toBeGreaterThan(PIXELS_DA_MARCA)

  // A DOR: de volta à rua, o começo da rua tem de continuar LEMBRADO. Hoje a
  // memória é uma só por jogador, com a chave amarrada ao mapa
  // (hostSession.ts:123-166): passar pela casa apagaria a rua inteira.
  const deVolta = await medir(page, pontos)
  const [lembrado, nunca, visivel] = deVolta.brilhos
  const regua = `lembrado=${lembrado}, nunca visto=${nunca}, visível=${visivel}`
  expect(visivel, `o chão em volta do jogador não está iluminado — ${regua}`).toBeGreaterThan(nunca + 60)
  expect(lembrado, `a rua que o jogador já tinha explorado voltou a ser escuridão total depois da ida à casa — ${regua}`).toBeGreaterThan(nunca + 25)
  expect(nunca, `o canto onde o jogador nunca pisou não está escuro: a régua da névoa não vale — ${regua}`).toBeLessThan(35)

  expect(erros, 'erro de página durante a ida e a volta').toEqual([])
})
