// JORNADA DE USUÁRIO de VIAJAR JUNTO (PEDIDOS.md, G10) — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G10):
//   - no aviso do pedido de passagem, além de "Deixar ir" e "Não", aparece
//     "Deixar ir com quem está perto (N)" quando há fichas de OUTROS jogadores
//     a até 2 casas da ficha de quem pediu, na mesma cena; N diz quantos;
//   - clicar leva quem pediu E esses jogadores próximos: cada um chega numa
//     casa livre em volta do pino de chegada e lê "Você chegou" na própria tela;
//   - quem está longe (mais de 2 casas) não vai;
//   - nenhum nome de cena vai a nenhum jogador.
//
// ONDE ISSO MORRE HOJE: `net/hostBridge.ts` (askTravel) monta o aviso do
// pedido só com "Deixar ir" e "Não", e o "Deixar ir" (`answerTravel`) leva uma
// ficha só — a de quem pediu (`net/hostSession.ts`, `transferResult`).
//
// COMO ESTE ARQUIVO PROVA (preparo herdado de task-jornada-viagem-do-jogador e
// de task-jornada-caixa-de-pedidos):
//   QUATRO TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` no mestre (`JSON.parse` do que chegou), e o
//   `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão e Cripta num
//   `adventure.json`, ligados por um par de pinos de viagem, abertos pelo menu
//   ("Carregar Mapa existente"). As três fichas começam no Salão.
//   AS DISTÂNCIAS (em casas, a maior entre coluna e linha):
//     grupo ....... Ana a 1 casa do pino; Bruno a 1 do pino e 1 de Ana; Carla a
//                   8 do pino (e 9 de Ana);
//     ana-sozinha . Ana igual; Bruno a 3 casas de Ana (e 2 do pino — a conta é
//                   da ficha de quem pediu, não do pino); Carla a 8 do pino.
//   GESTO REAL NA AÇÃO SOB TESTE: toque no pino, cliques no cartão, no aviso e
//   na lista Cenas. Os únicos `evaluate` são o do transporte e a LEITURA de
//   pixel (decodificar a foto num canvas solto e perguntar `elementFromPoint`).
//   PROVA NA TELA: texto visível; a cena que cada um vê pela COR DO CHÃO
//   (Salão verde-água, Cripta magenta); cada ficha pela cor dela (Ana
//   verde-limão, Bruno laranja, Carla azul), no canvas do jogador e no do
//   mestre. Nada é lido da store.
//   FRAMES. Com o socket roteado o navegador não emite `framereceived`; o que a
//   página recebe é o que a rota entrega com `ws.send`, e é ali que a régua
//   anota (`Rede.enviados`) — só para procurar nome de cena vazado.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão novo tem nome acessível EXATO "Deixar ir com quem está perto (N)";
//   - "em volta do pino de chegada" = centro da ficha a até 1,5 casa do centro
//     do pino em x E em y (em cima do pino ou na primeira volta, meia casa de
//     folga para o desenho); "casas diferentes" = centros a pelo menos 0,7 casa;
//   - o mestre vê a Cripta ao abri-la pela lista Cenas, enquadrada pelo
//     conteúdo (é a primeira vez que ele a abre — `PixiCanvas`, `fitToContent`).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 4 poderia ser a infraestrutura quebrada. O teste 5 pode passar hoje (não há
// botão nenhum); é a cerca do dia em que o botão existir.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { PIN_HEAD_OFFSET } from '../src/lib/pins'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'JUNT01'
const ANA = 'Ana'
const BRUNO = 'Bruno'
const CARLA = 'Carla'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'
/** Nome do MAPA da Cripta (não é nome de cena): assim só o `adventure.json` carrega "Cripta Rubra". */
const PLANTA_B = 'Planta de baixo'

const TOKEN_ANA = 'Lanterna'
const TOKEN_BRUNO = 'Machado'
const TOKEN_CARLA = 'Cajado'
const ESCADA_A = 'Escada que desce'
const ESCADA_B = 'Escada que sobe'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx. */
const FIT_MARGIN_JOGADOR = 24
/** Igual a `FIT_MARGIN` de pixi/PixiCanvas.tsx (enquadramento de abertura do editor). */
const FIT_MARGIN_MESTRE = 40

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
/** Verde-limão, laranja e azul: cores que nada mais no app usa (a cabeça dos pinos é dourada). */
const COR_ANA = '#3cff00'
const COR_BRUNO = '#ff5a00'
const COR_CARLA = '#1e3cff'

type Ponto = { x: number; y: number }

/** Centro de uma casa da grade. */
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })

/** Pino de ida no Salão e de chegada na Cripta. As colunas 0-8 ficam sob o painel do jogador: tudo mora à direita. */
const POS_ESCADA_A = casa(18, 8)
const POS_ESCADA_B = casa(24, 5)

type Arranjo = 'grupo' | 'ana-sozinha'
const POSICOES: Record<Arranjo, { ana: Ponto; bruno: Ponto; carla: Ponto }> = {
  // Ana na diagonal de baixo-esquerda do pino; Bruno logo abaixo do pino, colado em Ana; Carla 8 casas à direita.
  grupo: { ana: casa(17, 9), bruno: casa(18, 9), carla: casa(26, 9) },
  // Bruno a 3 casas de Ana (mas a 2 do pino): longe de QUEM PEDIU.
  'ana-sozinha': { ana: casa(17, 9), bruno: casa(20, 9), carla: casa(26, 9) },
}

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/**
 * Espera de quem lê pixel na tela do MESTRE depois de trocar de cena: medido em
 * 22/09 (sonda descartada, com "Deixar ir" simples no lugar do botão novo), a
 * PRIMEIRA leitura depois de abrir a Cripta levou 20,6 s — com 15 s o poll
 * estourava sem ter voltado nenhuma leitura, com a ficha de Ana já no lugar.
 */
const ESPERA_TELA_MESTRE = 45_000

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/
const DEIXAR_IR = 'Deixar ir'
const NAO = 'Não'
const deixarIrComQuemEstaPerto = (n: number): string => `Deixar ir com quem está perto (${n})`
const QUALQUER_JUNTO = /com quem está perto/i

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FRASE_DO_PEDIDO = new RegExp(`${ANA}[^]*quer passar[^]*${escapar(ESCADA_A)}[^]*${escapar(CENA_B)}`)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas ligadas por um par de pinos de viagem
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, description: string, destino: NonNullable<Pin['destino']>): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description, image: null, destino }
}

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Quatro paredes no contorno do mundo: o enquadramento do editor vira o mundo inteiro, nas duas cenas. */
function contorno(prefixo: string): Wall[] {
  return [
    parede(`${prefixo}-n`, 0, 0, LARGURA, 0),
    parede(`${prefixo}-l`, LARGURA, 0, LARGURA, ALTURA),
    parede(`${prefixo}-s`, LARGURA, ALTURA, 0, ALTURA),
    parede(`${prefixo}-o`, 0, ALTURA, 0, 0),
  ]
}

function cena(id: string, nome: string, chao: string, tokens: Token[], pins: Pin[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    walls: contorno(id),
    tokens,
    pins,
  }
}

function mapaA(arranjo: Arranjo): MapData {
  const p = POSICOES[arranjo]
  return cena(
    'map_vale',
    AVENTURA,
    CHAO_A,
    [token('tok-lanterna', TOKEN_ANA, p.ana, COR_ANA), token('tok-machado', TOKEN_BRUNO, p.bruno, COR_BRUNO), token('tok-cajado', TOKEN_CARLA, p.carla, COR_CARLA)],
    [pino('pin-a-escada', POS_ESCADA_A, ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
  )
}

const MAPA_B = cena('map_cripta', PLANTA_B, CHAO_B, [], [pino('pin-b-escada', POS_ESCADA_B, ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' })])

function discoDaAventura(arranjo: Arranjo): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_vale',
    name: AVENTURA,
    startSceneId: ID_CENA_A,
    scenes: [
      { id: ID_CENA_A, name: CENA_A, file: 'map.json' },
      { id: ID_CENA_B, name: CENA_B, file: `scenes/${ID_CENA_B}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(mapaA(arranjo)),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CENA_B}/map.json`]: serializeMap(MAPA_B),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

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

/** O "Rust" de mentira: liga o WebSocket de cada jogador ao `net:*` do mestre, nos dois sentidos. */
interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Tudo que o mestre mandou para cada jogador, em ordem (o que o fio entregou). */
  enviados: Map<string, string[]>
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
}

async function mestreAbreAventura(mestre: Page, arranjo: Arranjo): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), enviados: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    rede.enviados.get(clientId)?.push(texto)
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
    { arquivos: discoDaAventura(arranjo), codigo: CODIGO },
  )

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
  const lista = await secaoCenas(mestre)
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_A)), { message: `a aventura deveria abrir na cena "${CENA_A}"` }).toBe(true)
  await expect(entradaDaCena(lista, CENA_B), `a lista de Cenas deveria ter "${CENA_B}"`).toBeVisible()

  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
  return rede
}

/** A seção "Cenas" da aba Mapa, aberta (mesmo gesto de task-jornada-pino-de-viagem). */
async function secaoCenas(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const painel = page.getByRole('tabpanel', { name: 'Mapa' })
  const cabecalho = painel.getByRole('button', { name: 'Cenas', exact: true })
  await expect(cabecalho, 'a aba Mapa do rail deveria ter uma seção "Cenas"').toBeVisible({ timeout: 10_000 })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
  const corpo = await cabecalho.getAttribute('aria-controls')
  return corpo ? page.locator(`[id="${corpo}"]`) : painel
}

function entradaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('button', { name: nome, exact: true })
}

async function estaDestacada(entrada: Locator): Promise<boolean> {
  for (const atributo of ['aria-current', 'aria-selected', 'aria-pressed']) {
    const valor = await entrada.getAttribute(atributo)
    if (valor !== null && valor !== 'false') return true
  }
  return false
}

/** Clique na cena da lista Cenas: o editor do mestre passa a mostrá-la. */
async function mestreAbreCena(mestre: Page, nome: string): Promise<void> {
  const lista = await secaoCenas(mestre)
  await entradaDaCena(lista, nome).click()
  await expect.poll(() => estaDestacada(entradaDaCena(lista, nome)), { message: `o editor deveria abrir a cena "${nome}"`, timeout: ESPERA }).toBe(true)
}

/** Aba Jogo, card do jogador, "Atribuir <ficha>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  /** Todo frame que a PÁGINA recebeu no WebSocket, desde antes de entrar (anotado na rota). */
  frames: string[]
}

/** Contextos de jogador abertos pelo teste que está rodando; o `page` do mestre o Playwright fecha sozinho. */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  const frames: string[] = []
  rede.enviados.set(clientId, frames)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }),
              { c: clientId, t: texto },
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
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return { page, clientId, nome, frames }
}

type CorDeFicha = 'limao' | 'laranja' | 'azul'

/** Espera o mapa chegar: canvas na tela e a ficha do próprio jogador pintada. */
async function esperaFichaNaTela(j: Jogador, cor: CorDeFicha): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(j.page)).fichas[cor].pixels, { timeout: ESPERA_TELA, message: `${j.nome}: a própria ficha não foi pintada na tela` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
  carla: Jogador
}

/** Mestre abre a aventura e a sala; os três entram e ganham a ficha, todas no Salão. O mestre volta ao mapa. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string, arranjo: Arranjo): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre, arranjo)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', ANA)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', BRUNO)
  const carla = await jogadorEntra(browser, baseURL, rede, 'c3', CARLA)
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await mestreAtribui(mestre, BRUNO, TOKEN_BRUNO)
  await mestreAtribui(mestre, CARLA, TOKEN_CARLA)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await esperaFichaNaTela(ana, 'limao')
  await esperaFichaNaTela(bruno, 'laranja')
  await esperaFichaNaTela(carla, 'azul')
  return { rede, ana, bruno, carla }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela (jogador e mestre)
// ───────────────────────────────────────────────────────────────────────────

interface Ficha {
  pixels: number
  /** Centro da mancha da cor, em px CSS da página; `null` sem mancha. */
  centro: Ponto | null
}

interface Tela {
  fichas: Record<CorDeFicha, Ficha>
  /** Chão do Salão iluminado (na visão) e lembrado (explorado, escurecido). */
  chaoAClaro: number
  chaoAEscuro: number
  /** Chão da Cripta, qualquer brilho. */
  chaoB: number
}

/**
 * Fotografa a página e conta pixels por cor, só onde o CANVAS está por cima
 * (painéis, cartões e avisos não contam). Leitura pura: decodifica a foto num
 * canvas solto e pergunta `elementFromPoint`.
 */
async function lerTela(page: Page): Promise<Tela> {
  let foto: Awaited<ReturnType<Page['screenshot']>> | null = null
  for (let tentativa = 1; tentativa <= 3 && foto === null; tentativa += 1) {
    try {
      foto = await page.screenshot()
    } catch {
      await page.waitForTimeout(200)
    }
  }
  if (foto === null) throw new Error('régua: não consegui fotografar a tela')
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
    const soma = { limao: { n: 0, x: 0, y: 0 }, laranja: { n: 0, x: 0, y: 0 }, azul: { n: 0, x: 0, y: 0 } }
    let chaoAClaro = 0
    let chaoAEscuro = 0
    let chaoB = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        const azul = B > 200 && R < 90 && G < 120 && B > G * 1.8
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!limao && !laranja && !azul && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        const cor = limao ? 'limao' : laranja ? 'laranja' : azul ? 'azul' : null
        if (cor !== null) {
          soma[cor].n += 1
          soma[cor].x += x
          soma[cor].y += y
        } else if (verdeAgua) {
          if (G >= 110) chaoAClaro += 1
          else if (G >= 35) chaoAEscuro += 1
        } else chaoB += 1
      }
    }
    const ficha = (s: { n: number; x: number; y: number }) => ({
      pixels: s.n,
      centro: s.n > 0 ? { x: (s.x / s.n) * escalaX, y: (s.y / s.n) * escalaY } : null,
    })
    return { fichas: { limao: ficha(soma.limao), laranja: ficha(soma.laranja), azul: ficha(soma.azul) }, chaoAClaro, chaoAEscuro, chaoB }
  }, foto.toString('base64'))
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

/** Câmera de "encaixar a cena" do jogador: mundo inteiro, a mesma nas duas cenas. */
const CAMERA_JOGADOR = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN_JOGADOR)

function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.x), y: Math.round(p.y * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.y) }
}

/** Mundo ↔ tela do mestre, com o enquadramento de abertura da cena (conteúdo, margem 40). */
interface CameraDoMestre {
  paraTela: (p: Ponto) => Ponto
  paraMundo: (p: Ponto) => Ponto
}

async function cameraDoMestre(mestre: Page, mapa: MapData): Promise<CameraDoMestre> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(mapa)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return {
    paraTela: (p) => ({ x: caixa.x + p.x * c.scale + c.x, y: caixa.y + p.y * c.scale + c.y }),
    paraMundo: (p) => ({ x: (p.x - caixa.x - c.x) / c.scale, y: (p.y - caixa.y - c.y) / c.scale }),
  }
}

const escrever = (p: Ponto | null): string => (p === null ? 'sem ficha' : `(${Math.round(p.x)}, ${Math.round(p.y)})`)

/** Em cima do pino de chegada ou na primeira volta dele (meia casa de folga para o desenho), em mundo. */
function emVoltaDoPinoDeChegada(p: Ponto): boolean {
  return Math.abs(p.x - POS_ESCADA_B.x) <= 1.5 * GRADE && Math.abs(p.y - POS_ESCADA_B.y) <= 1.5 * GRADE
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos: o pedido de Ana e o aviso na tela do mestre
// ───────────────────────────────────────────────────────────────────────────

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/**
 * O pedido inteiro, do lado de Ana: toque na cabeça da Escada que desce →
 * cartão → "Pedir para passar" → a pergunta → confirmar → "Aguardando o mestre…".
 */
async function anaPedeParaPassar(ana: Jogador): Promise<void> {
  await tocar(ana.page, naTelaDoJogador({ x: POS_ESCADA_A.x, y: POS_ESCADA_A.y - PIN_HEAD_OFFSET }))
  const cartao = ana.page.getByRole('dialog').filter({ hasText: ESCADA_A })
  await expect(cartao, `${ANA}: tocar o pino deveria abrir o cartão "${ESCADA_A}"`).toBeVisible({ timeout: ESPERA })
  await cartao.getByRole('button', { name: PEDIR_PARA_PASSAR }).click()
  await expect(ana.page.getByText(PERGUNTA_DO_PEDIDO), `${ANA}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  const confirmar = ana.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR })
  await expect(confirmar.first(), `${ANA}: a pergunta deveria ter um botão de confirmar`).toBeVisible({ timeout: ESPERA })
  await confirmar.first().click()
  await expect(ana.page.getByText(AGUARDANDO).first(), `${ANA}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** O aviso do pedido de Ana na tela do mestre, com "Deixar ir" e "Não" (o de hoje). */
async function avisoDoPedidoDeAna(mestre: Page): Promise<void> {
  await expect(mestre.getByText(FRASE_DO_PEDIDO).first(), `o mestre deveria ler "${ANA} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await expect(mestre.getByRole('button', { name: DEIXAR_IR, exact: true }), `o aviso do pedido deveria ter "${DEIXAR_IR}"`).toBeVisible({ timeout: ESPERA })
  await expect(mestre.getByRole('button', { name: NAO, exact: true }), `o aviso do pedido deveria ter "${NAO}"`).toBeVisible({ timeout: ESPERA })
}

/** Nomes dos botões "Deixar…" na tela do mestre — só para a mensagem de falha ajudar quem implementa. */
async function botoesDeDeixar(mestre: Page): Promise<string> {
  const nomes = await mestre.getByRole('button', { name: /Deixar/ }).allInnerTexts()
  return nomes.map((n) => n.trim()).join(' | ') || '(nenhum)'
}

/** O botão novo, exato, com a contagem. Falha dizendo o que o aviso tem hoje. */
async function botaoViajarJunto(mestre: Page, n: number): Promise<Locator> {
  const botao = mestre.getByRole('button', { name: deixarIrComQuemEstaPerto(n), exact: true })
  await expect(botao, `o aviso do pedido de ${ANA} deveria ter "${deixarIrComQuemEstaPerto(n)}". Botões "Deixar…" no mestre hoje: ${await botoesDeDeixar(mestre)}`).toBeVisible({ timeout: ESPERA })
  return botao
}

/** Quem viajou: lê "Você chegou" e passa a ver o chão da Cripta, e só ele. */
async function chegaNaCripta(j: Jogador): Promise<void> {
  await expect(j.page.getByText(VOCE_CHEGOU).first(), `${j.nome} viajou junto e deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(j.page)).chaoB, { timeout: ESPERA_TELA, message: `${j.nome} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await telaParada(j.page)
  expect(tela.chaoAClaro + tela.chaoAEscuro, `${j.nome} chegou à ${CENA_B} e continua vendo o chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
}

/** Frames que trazem um nome de cena (o jogador nunca lê nome de cena). */
function nomesDeCena(frames: readonly string[]): string[] {
  return frames.filter((f) => f.includes(CENA_A) || f.includes(CENA_B))
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana pede para passar e o mestre vê o aviso com "Deixar ir" e "Não"; a câmera do mestre acerta as fichas', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, carla } = await mesaMontada(browser, page, baseURL ?? '', 'grupo')

  // Controle das réguas de pixel que os testes 3 e 4 usam.
  const telaDeCarla = await telaParada(carla.page)
  expect(telaDeCarla.chaoAClaro, `${CARLA} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeCarla.fichas.limao.pixels, `${CARLA}, a 8 casas, deveria ver a ficha de ${ANA} antes da viagem`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeCarla.fichas.laranja.pixels, `${CARLA}, a 8 casas, deveria ver a ficha de ${BRUNO} antes da viagem`).toBeGreaterThan(PIXELS_DE_TOKEN)
  const camera = await cameraDoMestre(page, mapaA('grupo'))
  const telaDoMestre = await telaParada(page)
  const p = POSICOES.grupo
  for (const [cor, pos, quem] of [['limao', p.ana, ANA], ['laranja', p.bruno, BRUNO], ['azul', p.carla, CARLA]] as const) {
    const centro = telaDoMestre.fichas[cor].centro
    expect(centro, `o mestre deveria ver a ficha de ${quem}`).not.toBeNull()
    const esperado = camera.paraTela(pos)
    if (centro) expect(Math.hypot(centro.x - esperado.x, centro.y - esperado.y), `a ficha de ${quem} não está onde a câmera do mestre diz (centro ${escrever(centro)}, esperado ${escrever(esperado)})`).toBeLessThan(15)
  }

  await anaPedeParaPassar(ana)
  await avisoDoPedidoDeAna(page)
})

test('2. o aviso do pedido de Ana tem "Deixar ir com quem está perto (1)": só Bruno está perto, Carla longe não conta', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'grupo')
  await anaPedeParaPassar(ana)
  await avisoDoPedidoDeAna(page)

  await botaoViajarJunto(page, 1)
  await expect(page.getByRole('button', { name: deixarIrComQuemEstaPerto(2), exact: true }), `${CARLA} está a 8 casas: o botão não deveria contar dois`).toHaveCount(0)
})

test('3. viajar junto: Ana e Bruno leem "Você chegou" e veem a Cripta; Carla fica no Salão sem as fichas deles; nome de cena não vaza', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { rede, ana, bruno, carla } = await mesaMontada(browser, page, baseURL ?? '', 'grupo')

  // Antes: Carla vê as fichas dos dois (senão o "deixa de ver" lá embaixo não provaria nada).
  const antes = await telaParada(carla.page)
  expect(antes.fichas.limao.pixels, `antes da viagem ${CARLA} deveria ver a ficha de ${ANA}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(antes.fichas.laranja.pixels, `antes da viagem ${CARLA} deveria ver a ficha de ${BRUNO}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  for (const j of [ana, bruno, carla]) expect(j.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${j.nome} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)

  await anaPedeParaPassar(ana)
  await avisoDoPedidoDeAna(page)
  const junto = await botaoViajarJunto(page, 1)
  await junto.click()

  await chegaNaCripta(ana)
  await chegaNaCripta(bruno)

  // Carla, longe, fica no Salão: as fichas de Ana e Bruno somem da tela dela.
  await expect
    .poll(async () => {
      const t = await telaParada(carla.page)
      return t.fichas.limao.pixels + t.fichas.laranja.pixels
    }, { timeout: ESPERA_TELA, message: `as fichas de ${ANA} e ${BRUNO} deveriam sumir da tela de ${CARLA}` })
    .toBeLessThanOrEqual(RESIDUO)
  const telaDeCarla = await telaParada(carla.page)
  expect(telaDeCarla.chaoAClaro, `${CARLA} deveria continuar vendo o ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeCarla.chaoB, `${CARLA} não viajou e não deveria ver nada da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  expect(telaDeCarla.fichas.azul.pixels, `${CARLA} deveria continuar vendo a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
  await expect(carla.page.getByText(VOCE_CHEGOU), `${CARLA} não viajou e não deveria ler "Você chegou"`).toHaveCount(0)

  for (const j of [ana, bruno, carla]) expect(nomesDeCena(rede.enviados.get(j.clientId) ?? []), `${j.nome} recebeu um nome de cena ("${CENA_A}" ou "${CENA_B}")`).toEqual([])
})

test('4. na tela do mestre, as fichas de Ana e Bruno ficam em casas diferentes da Cripta, em volta do pino de chegada', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'grupo')
  await anaPedeParaPassar(ana)
  await avisoDoPedidoDeAna(page)
  const junto = await botaoViajarJunto(page, 1)
  await junto.click()
  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${ANA} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })

  await mestreAbreCena(page, CENA_B)
  const camera = await cameraDoMestre(page, MAPA_B)
  await expect
    .poll(async () => {
      const t = await telaParada(page)
      return Math.min(t.fichas.limao.pixels, t.fichas.laranja.pixels)
    }, { timeout: ESPERA_TELA_MESTRE, message: `o mestre deveria ver as fichas de ${ANA} e de ${BRUNO} na ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const tela = await telaParada(page)
  expect(tela.fichas.azul.pixels, `${CARLA} ficou longe: a ficha dela não deveria estar na ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  const centros: Array<{ quem: string; mundo: Ponto }> = []
  for (const [cor, quem] of [['limao', ANA], ['laranja', BRUNO]] as const) {
    const centro = tela.fichas[cor].centro
    if (centro === null) throw new Error(`ficha de ${quem} sem centro na tela do mestre`)
    const mundo = camera.paraMundo(centro)
    expect(emVoltaDoPinoDeChegada(mundo), `a ficha de ${quem} deveria chegar em volta de "${ESCADA_B}" (está em ${escrever(mundo)} de mundo, pino em ${escrever(POS_ESCADA_B)})`).toBe(true)
    centros.push({ quem, mundo })
  }
  const [a, b] = centros
  expect(Math.hypot(a.mundo.x - b.mundo.x, a.mundo.y - b.mundo.y), `as fichas de ${a.quem} ${escrever(a.mundo)} e ${b.quem} ${escrever(b.mundo)} ficaram na mesma casa`).toBeGreaterThan(0.7 * GRADE)
})

test('5. sem ninguém perto (Bruno a 3 casas de Ana, Carla a 9), o aviso não tem "com quem está perto"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'ana-sozinha')
  await anaPedeParaPassar(ana)
  await avisoDoPedidoDeAna(page)
  await expect(page.getByRole('button', { name: QUALQUER_JUNTO }), `ninguém está a até 2 casas de ${ANA}: o aviso não deveria oferecer "com quem está perto". Botões "Deixar…" hoje: ${await botoesDeDeixar(page)}`).toHaveCount(0)
})
