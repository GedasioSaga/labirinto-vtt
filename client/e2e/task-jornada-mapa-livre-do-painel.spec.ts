// JORNADA DE USUÁRIO — mapa-livre-do-painel (defeito). Régua escrita para SAIR
// VERMELHA no código de hoje; é a prova do defeito, não o conserto.
//
// O ITEM: no notebook (1280x800) o painel do jogador fica fixo sobre a faixa
// esquerda, sem fechar, escondendo a ficha; na chegada a câmera enquadra o mapa
// inteiro. Pedido: painel recolhível em qualquer largura, câmera na área livre
// e centrada na própria ficha ao entrar ou trocar de cena, botão "Minha ficha"
// fixo, aro de dono de contraste (branco). O jogador nunca lê o nome da cena.
//
// ONDE ISSO MORRE HOJE:
//   - client/src/player/player.css:428 `.pp-toggle { display: none }` — o botão
//     "Painel" só existe abaixo de 700 px (player.css:682); no notebook o painel
//     (player.css:407, fixo em left 12, 248 px) não fecha;
//   - client/src/player/PlayerView.tsx:854 — mapa novo (entrar ou trocar de
//     cena) faz `fitCamera` do mapa INTEIRO: a ficha na borda esquerda cai
//     debaixo do painel;
//   - client/src/player/PlayerPanel.tsx:216 — centralizar só existe DENTRO do
//     painel ("Centralizar no meu personagem"); não há "Minha ficha" fixo;
//   - client/src/player/PlayerView.tsx:237 — o aro da ficha própria com cor
//     escolhida é AZUL (`OWN_TOKEN_COLOR`): numa ficha azul, some.
//
// COMO O ARQUIVO PROVA: o mestre é o app inteiro em modo Tauri (disco e
// transporte de mentira, iguais a task-jornada-viagem-do-jogador); o jogador é
// o player.html inteiro num contexto de navegador próprio, 1280x800. Gesto real
// (clique, arrasto com pausa antes de soltar). Prova na tela: a ficha de Fábio
// é AZUL e é contada nos pixels da foto SÓ onde o canvas está por cima
// (`elementFromPoint`) — ficha debaixo do painel conta zero. O único `evaluate`
// no jogador é LEITURA de pixel; no mestre, o do transporte.
//
// SUPOSIÇÕES (as únicas além do aceite):
//   - o botão de recolher chama "Painel", "Fechar painel", "Recolher painel",
//     "Abrir painel", "Mostrar painel" ou "Esconder painel" (`BOTAO_PAINEL`);
//     o painel é o `complementary` "Painel do jogador"; recolhido = escondido
//     ou fora da janela;
//   - "Minha ficha" é um botão com esse nome, visível sem abrir o painel;
//   - "centrada" = a ficha a menos de 15% do menor lado da tela do centro da
//     tela OU do centro da área que o painel não cobre;
//   - o aro branco fica na metade de CIMA da ficha, entre o raio dela e 1,8
//     raio (o nome da ficha fica embaixo e não conta); pulsar pode apagar o aro
//     por instantes, então a leitura repete até 15 s.
//
// CONTROLE POSITIVO (verde hoje): teste 1.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Pin, Token } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const CODIGO = 'LIVRE1'
const JOGADOR = 'Fábio'
const AVENTURA = 'Aventura do Moinho'
const CENA_VILA = 'Vila do Moinho'
const CENA_PORAO = 'Porão do Moinho'
const TOKEN = 'Capa azul'
const ESCADA = 'Escada da taverna'
const ALCAPAO = 'Alçapão'
const ID_VILA = 'scene_vila'
const ID_PORAO = 'scene_porao'
const PASTA = 'C:/appdata/maps/map_moinho'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }

type Ponto = { x: number; y: number }
/** Ficha e alçapão na BORDA ESQUERDA: no enquadramento do mapa inteiro caem em x≈85, y≈308 — sob o painel (12..260). */
const POS_FICHA: Ponto = { x: 100, y: 150 }
const POS_ESCADA: Ponto = { x: 1850, y: 450 }
const POS_ALCAPAO: Ponto = { x: 100, y: 150 }

const CHAO_VILA = '#1e8c8c'
const CHAO_PORAO = '#8c1e8c'
const COR_FICHA = '#2050ff'

const TOQUE_MS = 120
const PINTURA_MS = 400
const ESPERA = 6000
const ESPERA_TELA = 15_000
const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
const PIXELS_DE_ARO = 12
const PERTO_DO_CENTRO = 0.15 * Math.min(TELA.width, TELA.height)
/** 150 s estourou com 3 vagas de Playwright ocupadas (medido em 23/09: o controle levou 2,6 min só montando a mesa). */
const TETO_DO_TESTE = 240_000

const BOTAO_PAINEL = /^(Painel|Fechar painel|Recolher painel|Abrir painel|Mostrar painel|Esconder painel)$/
const MINHA_FICHA = /^Minha ficha$/
const LEVADO = 'O mestre levou você para outro lugar'

// ─────────────────────────────────────────────── a aventura no disco de mentira

function cena(id: string, nome: string, chao: string, tokens: Token[], pins: Pin[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
    pins,
  }
}

function discoDaAventura(): Record<string, string> {
  const ficha: Token = { id: 'tok-fabio', characterId: null, name: TOKEN, x: POS_FICHA.x, y: POS_FICHA.y, size: 1, image: null, color: COR_FICHA }
  const vila = cena('map_moinho', AVENTURA, CHAO_VILA, [ficha], [
    { id: 'pin-escada', x: POS_ESCADA.x, y: POS_ESCADA.y, kind: 'viagem', description: ESCADA, image: null, destino: { sceneId: ID_PORAO, pinId: 'pin-alcapao' } },
  ])
  const porao = cena('map_porao', CENA_PORAO, CHAO_PORAO, [], [
    { id: 'pin-alcapao', x: POS_ALCAPAO.x, y: POS_ALCAPAO.y, kind: 'viagem', description: ALCAPAO, image: null, destino: { sceneId: ID_VILA, pinId: 'pin-escada' } },
  ])
  const aventura = {
    version: 1,
    id: 'adv_moinho',
    name: AVENTURA,
    startSceneId: ID_VILA,
    scenes: [
      { id: ID_VILA, name: CENA_VILA, file: 'map.json' },
      { id: ID_PORAO, name: CENA_PORAO, file: `scenes/${ID_PORAO}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(vila),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_PORAO}/map.json`]: serializeMap(porao),
  }
}

// ─────────────────────────────────── o mestre (cópia de task-jornada-viagem-do-jogador)

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
    convertFileSrc: (filePath: string) => string
  }
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  fila: Promise<void>
}

async function mestreAbreAventura(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    rede.sockets.get(clientId)?.send(texto)
  })
  await mestre.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      const alvo = window as unknown as JanelaDoMestre
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      const callbacks = new Map<number, HandlerTauri>()
      const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
      let proximoId = 1
      alvo.isTauri = true
      alvo.__emitTauri = (event, payload) => {
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
      }
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: (cb: HandlerTauri) => {
          const id = proximoId
          proximoId += 1
          callbacks.set(id, cb)
          return id
        },
        invoke: async (cmd, args, options) => {
          const a = (args ?? {}) as Record<string, unknown>
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'net_send':
              alvo.__labParaJogador(String(a.clientId), JSON.stringify(a.msg))
              return null
            case 'net_kick':
            case 'net_stop_room':
              return null
            case 'plugin:event|listen': {
              const id = Number(a.handler)
              const cb = callbacks.get(id)
              if (cb) ouvintes.set(id, { event: String(a.event), handler: cb })
              return id
            }
            case 'plugin:event|unlisten':
              ouvintes.delete(Number(a.eventId))
              return null
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join':
              return (a.paths as string[]).join('/')
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists':
              return existe(String(a.path))
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array)
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|rename': {
              const de = String(a.oldPath)
              if (de in textos) {
                textos[String(a.newPath)] = textos[de]
                delete textos[de]
              }
              return null
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(a.path))}/`
              const filhos = new Map<string, boolean>()
              for (const p of todos()) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                if (resto.length === 0) continue
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              return null
          }
        },
      }
    },
    { arquivos: discoDaAventura(), codigo: CODIGO },
  )

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** Aba Jogo, card do jogador, "Atribuir <token>". */
async function mestreAtribui(mestre: Page): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = mestre.locator('#lb-rail-panel-room').locator('.lb-field').filter({ hasText: `${JOGADOR} —` })
  await card.getByRole('button', { name: `Atribuir ${TOKEN}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${TOKEN}` }), `${JOGADOR} deveria ficar com ${TOKEN}`).toBeVisible()
}

/** Grupo > linha de Fábio > "Mandar para…" > Cena Porão, Chegada Alçapão > Mandar. */
async function mestreMandaAoPorao(mestre: Page): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const grupo = mestre.locator('#lb-rail-panel-room').getByRole('region', { name: 'Grupo', exact: true })
  const linha = grupo.getByRole('listitem').filter({ hasText: JOGADOR })
  await linha.getByRole('button', { name: /^Mandar para(…|\.\.\.)$/ }).click()
  const envio = mestre.getByRole('form', { name: `Mandar ${JOGADOR} para outra cena` })
  await expect(envio, 'o "Mandar para…" deveria abrir o envio').toBeVisible({ timeout: ESPERA })
  await envio.getByLabel('Cena').selectOption({ label: CENA_PORAO })
  await envio.getByLabel('Chegada').selectOption({ label: ALCAPAO })
  await envio.getByRole('button', { name: 'Mandar', exact: true }).click()
}

// ─────────────────────────────────────────────── o jogador

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede): Promise<Page> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set('c1', ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }),
              { c: 'c1', t: texto },
            ),
          )
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(JOGADOR, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

/** Mestre abre a aventura e a sala; Fábio entra e recebe a ficha; espera o chão da Vila pintado. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Page> {
  const rede = await mestreAbreAventura(mestre)
  const fabio = await jogadorEntra(browser, baseURL, rede)
  await mestreAtribui(mestre)
  await expect(fabio.locator('canvas').first(), 'o mapa não apareceu na tela de Fábio').toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(fabio)).chaoVila, { timeout: ESPERA_TELA, message: 'Fábio deveria ver o chão da Vila' })
    .toBeGreaterThan(PIXELS_DE_CENA)
  return fabio
}

// ─────────────────────────────────────────────── gestos e leitura da tela

async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 20 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

function painelDoJogador(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Painel do jogador' })
}

/** O painel está na tela: visível e com alguma parte dentro da janela. */
async function painelNaTela(page: Page): Promise<boolean> {
  const painel = painelDoJogador(page)
  if (!(await painel.isVisible())) return false
  const caixa = await painel.boundingBox()
  return caixa !== null && caixa.x + caixa.width > 4 && caixa.x < TELA.width - 4 && caixa.width > 4
}

/** Centros aceitos para "centrada": o da tela e o da área que o painel (à esquerda) não cobre. */
async function centrosAceitos(page: Page): Promise<Ponto[]> {
  const centros: Ponto[] = [{ x: TELA.width / 2, y: TELA.height / 2 }]
  if (await painelNaTela(page)) {
    const caixa = await painelDoJogador(page).boundingBox()
    if (caixa && caixa.x < TELA.width / 3) centros.push({ x: (caixa.x + caixa.width + TELA.width) / 2, y: TELA.height / 2 })
  }
  return centros
}

interface Tela {
  /** Pixels da ficha azul de Fábio onde o CANVAS está por cima (debaixo do painel conta zero). */
  ficha: number
  centroDaFicha: Ponto | null
  /** Pixels brancos na metade de cima do anel em volta da ficha (entre o raio e 1,8 raio). */
  aroBranco: number
  chaoVila: number
  chaoPorao: number
}

/** Fotografa e conta cores só onde o canvas está por cima. Leitura pura. */
async function lerTela(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  let foto: Awaited<ReturnType<Page['screenshot']>> | null = null
  for (let tentativa = 1; tentativa <= 3 && foto === null; tentativa += 1) {
    try {
      foto = await page.screenshot()
    } catch {
      await page.waitForTimeout(200)
    }
  }
  if (foto === null) throw new Error('não consegui fotografar a tela do jogador')
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const tela = document.createElement('canvas')
    tela.width = bmp.width
    tela.height = bmp.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    ctx.drawImage(bmp, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
    const escalaX = window.innerWidth / width
    const escalaY = window.innerHeight / height
    const noCanvas = new Map<number, boolean>()
    const canvasPorCima = (x: number, y: number): boolean => {
      const chave = (y >> 3) * 65536 + (x >> 3)
      let v = noCanvas.get(chave)
      if (v === undefined) {
        v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
        noCanvas.set(chave, v)
      }
      return v
    }
    const r = { ficha: 0, centroDaFicha: null as { x: number; y: number } | null, aroBranco: 0, chaoVila: 0, chaoPorao: 0 }
    let sx = 0
    let sy = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const azul = B > 180 && R < 100 && G < 160
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!azul && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (azul) {
          r.ficha += 1
          sx += x
          sy += y
        } else if (verdeAgua) r.chaoVila += 1
        else r.chaoPorao += 1
      }
    }
    if (r.ficha > 0) {
      const cx = sx / r.ficha
      const cy = sy / r.ficha
      r.centroDaFicha = { x: cx * escalaX, y: cy * escalaY }
      const raio = Math.sqrt(r.ficha / Math.PI)
      const fora = Math.ceil(raio * 1.8)
      for (let y = Math.max(0, Math.floor(cy - fora)); y < Math.min(height, cy - raio * 0.2); y += 1) {
        for (let x = Math.max(0, Math.floor(cx - fora)); x < Math.min(width, cx + fora); x += 1) {
          const d = Math.hypot(x - cx, y - cy)
          if (d < raio - 1 || d > fora) continue
          const i = (y * width + x) * 4
          if (data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225 && canvasPorCima(x, y)) r.aroBranco += 1
        }
      }
    }
    return r
  }, foto.toString('base64'))
}

/** Distância da ficha ao centro aceito mais perto (Infinity se a ficha não está no canvas). */
async function distanciaAoCentro(page: Page, tela: Tela): Promise<number> {
  const ficha = tela.centroDaFicha
  if (ficha === null || tela.ficha <= PIXELS_DE_TOKEN) return Number.POSITIVE_INFINITY
  return Math.min(...(await centrosAceitos(page)).map((c) => Math.hypot(ficha.x - c.x, ficha.y - c.y)))
}

// ─────────────────────────────────────────────── as jornadas

test('1. controle: Fábio entra, o painel está na tela e "Centralizar no meu personagem" traz a ficha azul ao centro', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const fabio = await mesaMontada(browser, page, baseURL ?? '')

  await expect(painelDoJogador(fabio), 'o painel do jogador deveria estar na tela').toBeVisible()
  await fabio.getByRole('button', { name: 'Centralizar no meu personagem' }).click()
  await expect
    .poll(async () => distanciaAoCentro(fabio, await lerTela(fabio)), { timeout: ESPERA_TELA, message: 'centralizar deveria pôr a ficha azul de Fábio perto do centro, no canvas' })
    .toBeLessThan(PERTO_DO_CENTRO)
})

test('2. notebook 1280x800: o botão "Painel" recolhe o painel e abre de novo', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const fabio = await mesaMontada(browser, page, baseURL ?? '')

  const botao = fabio.getByRole('button', { name: BOTAO_PAINEL })
  await expect(botao, 'a 1280x800 deveria haver um botão "Painel" para recolher o painel (hoje ele só existe abaixo de 700 px)').toBeVisible({ timeout: ESPERA })
  const antes = await painelNaTela(fabio)
  await botao.click()
  await expect.poll(() => painelNaTela(fabio), { timeout: ESPERA, message: `o 1º clique no botão deveria ${antes ? 'recolher' : 'abrir'} o painel` }).toBe(!antes)
  await botao.click()
  await expect.poll(() => painelNaTela(fabio), { timeout: ESPERA, message: `o 2º clique no botão deveria ${antes ? 'abrir' : 'recolher'} o painel de novo` }).toBe(antes)
})

test('3. chegada com a ficha na borda esquerda: sem mexer na câmera, a ficha fica na área livre, centrada, e arrasta', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const fabio = await mesaMontada(browser, page, baseURL ?? '')

  const tela = await lerTela(fabio)
  const distancia = await distanciaAoCentro(fabio, tela)
  expect(
    distancia,
    `ao entrar, a ficha de Fábio deveria aparecer no canvas perto do centro da área livre (limite ${PERTO_DO_CENTRO} px); lida: ${tela.ficha} px de ficha no canvas, centro ${JSON.stringify(tela.centroDaFicha)} — ficha sob o painel conta zero`,
  ).toBeLessThan(PERTO_DO_CENTRO)

  // Arrasta a própria ficha uma casa e meia para a direita, com pausa antes de soltar.
  const de = tela.centroDaFicha ?? { x: 0, y: 0 }
  const passo = Math.max(40, Math.sqrt(tela.ficha / Math.PI) * 3)
  await arrastar(fabio, de, { x: de.x + passo, y: de.y })
  await expect
    .poll(async () => ((await lerTela(fabio)).centroDaFicha?.x ?? 0) - de.x, { timeout: ESPERA_TELA, message: 'arrastar a ficha deveria levá-la para a direita' })
    .toBeGreaterThan(passo / 2)
})

test('4. a própria ficha se acha: aro branco em volta da ficha azul e "Minha ficha" fixo traz a câmera de volta', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const fabio = await mesaMontada(browser, page, baseURL ?? '')

  // Põe a ficha à vista pelo caminho de hoje (verde), para o aro ser lido longe do painel.
  await fabio.getByRole('button', { name: 'Centralizar no meu personagem' }).click()
  await expect.poll(async () => distanciaAoCentro(fabio, await lerTela(fabio)), { timeout: ESPERA_TELA }).toBeLessThan(PERTO_DO_CENTRO)

  // O aro pode pulsar: guarda a MAIOR leitura em até 15 s. Suave, para o "Minha ficha" também ser julgado.
  let aro = 0
  const ate = Date.now() + ESPERA_TELA
  while (aro < PIXELS_DE_ARO && Date.now() < ate) aro = Math.max(aro, (await lerTela(fabio)).aroBranco)
  expect.soft(aro, `a ficha AZUL de Fábio deveria ter aro branco de dono (máximo lido: ${aro} px brancos em volta; hoje o aro é azul)`).toBeGreaterThanOrEqual(PIXELS_DE_ARO)

  // Arrasta o MAPA (chão vazio, longe da ficha): a ficha sai do centro.
  const antes = (await lerTela(fabio)).centroDaFicha ?? { x: TELA.width / 2, y: TELA.height / 2 }
  await arrastar(fabio, { x: 1000, y: 600 }, { x: 1150, y: 450 })
  const longe = await lerTela(fabio)
  expect(longe.centroDaFicha, 'depois de arrastar o mapa a ficha deveria continuar na tela').not.toBeNull()
  if (longe.centroDaFicha) expect(Math.hypot(longe.centroDaFicha.x - antes.x, longe.centroDaFicha.y - antes.y), 'arrastar o chão deveria mover a câmera (controle do gesto)').toBeGreaterThan(100)

  const minhaFicha = fabio.getByRole('button', { name: MINHA_FICHA })
  await expect(minhaFicha, 'deveria haver um botão "Minha ficha" fixo na tela, sem abrir painel nenhum').toBeVisible({ timeout: ESPERA })
  await minhaFicha.click()
  await expect
    .poll(async () => distanciaAoCentro(fabio, await lerTela(fabio)), { timeout: ESPERA_TELA, message: '"Minha ficha" deveria trazer a ficha de volta ao centro' })
    .toBeLessThan(PERTO_DO_CENTRO)
})

test('5. mandado ao Porão: Fábio chega com a ficha centrada na área livre e nada na tela diz o nome da cena', async ({ browser, page, baseURL }) => {
  test.setTimeout(TETO_DO_TESTE)
  const fabio = await mesaMontada(browser, page, baseURL ?? '')

  await mestreMandaAoPorao(page)
  await expect(fabio.getByText(LEVADO).first(), `Fábio deveria ler "${LEVADO}"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await lerTela(fabio)).chaoPorao, { timeout: ESPERA_TELA, message: 'Fábio deveria passar a ver o chão do Porão' })
    .toBeGreaterThan(PIXELS_DE_CENA)
  expect(await fabio.locator('body').innerText(), `a tela de Fábio não deveria escrever "${CENA_PORAO}"`).not.toContain(CENA_PORAO)

  const tela = await lerTela(fabio)
  expect(
    await distanciaAoCentro(fabio, tela),
    `ao chegar no Porão pelo ${ALCAPAO} (borda esquerda), a ficha deveria ficar no canvas perto do centro da área livre (limite ${PERTO_DO_CENTRO} px); lida: ${tela.ficha} px de ficha no canvas, centro ${JSON.stringify(tela.centroDaFicha)}`,
  ).toBeLessThan(PERTO_DO_CENTRO)
})
