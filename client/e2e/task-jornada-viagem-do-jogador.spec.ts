// JORNADA DE USUÁRIO da VIAGEM DO JOGADOR (Entrega 3) — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (decisões do usuário):
//   - cada jogador vê a cena onde está o token DELE; o grupo pode se separar;
//   - o jogador toca o pino de viagem, o cartão de hoje abre com "Pedir para
//     passar"; confirma em "Pedir ao mestre para passar por aqui?" e passa a
//     ler "Aguardando o mestre…";
//   - o mestre recebe um aviso que ESPERA: "<jogador> quer passar por <pino> →
//     <cena>", com "Deixar ir" e "Não";
//   - "Deixar ir": o token sai da cena A e aparece no pino par da cena B; o
//     jogador passa a ver só B e lê "Você chegou"; quem ficou em A vê o token
//     sumir e não recebe nada de B; o mestre lê "<jogador> entrou em <cena>"
//     com "Ir lá" — e o editor dele NÃO troca de cena sozinho;
//   - "Não": o jogador lê "O mestre não deixou passar agora" e fica em A;
//   - o pino par leva de volta, e o que ele explorou em A continua lembrado;
//   - antes da aprovação o jogador nunca recebe o nome da cena de destino nem
//     o destino do pino.
//
// ONDE ISSO MORRE HOJE: o cartão do jogador (`player/PlayerPinCard.tsx`) só
// tem "Fechar"; o protocolo (`net/protocol.ts`) não tem pedido de passagem; o
// host (`net/hostSession.ts`) manda a TODO jogador o mapa aberto no editor e
// guarda UMA memória de exploração por jogador (`memoryFor`: mapa diferente
// começa do zero).
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   vira o evento `net:message` na página do mestre, e o `net_send` do mestre
//   vira frame no WebSocket do jogador. A sessão do host é a do app
//   (`net/hostBridge.ts`), sem estado injetado em lugar nenhum.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA. As duas cenas, os pinos e a
//   ligação em mão dupla vêm de um `adventure.json` gravado no disco falso do
//   Tauri — o mesmo formato que o app grava (`lib/adventure.ts`). O mestre a
//   abre pelo menu ("Carregar Mapa existente"), como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE. Clique, toque parado e arrasto pelo
//   ponteiro; teclado de verdade. Os únicos `evaluate` são: o do transporte
//   (entregar ao mestre o que o jogador mandou) e a LEITURA de pixel (decodifica
//   a foto da tela num canvas solto e pergunta `elementFromPoint`).
//   PROVA NA TELA. Texto visível; e a cena que cada jogador está vendo é lida
//   pela COR DO CHÃO nos pixels do canvas dele (cena A: chão verde-água, cena B:
//   chão magenta), e o token de cada um pela cor da ficha (Ana verde-limão,
//   Bruno laranja — o amarelo ficou de fora porque a cabeça dos pinos é
//   dourada). Isso não depende da câmera: pan, zoom ou recentrar ao chegar não
//   inventam chão magenta numa tela que só tem a cena A.
//   FRAMES. `routeWebSocket` troca o socket da página por um de mentira, e aí o
//   navegador não emite `page.on('websocket')` (medido: zero frames). O que a
//   página recebe é exatamente o que a rota entrega com `ws.send`, então é ali
//   que a régua escuta, só anotando (`Rede.enviados`).
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do usuário):
//   - o botão que CONFIRMA o pedido chama "Pedir", "Sim", "Confirmar", "Pedir ao
//     mestre", "Pedir passagem" ou "Enviar pedido" (`CONFIRMAR_PEDIDO`);
//   - "Aguardando o mestre…" aceita reticência de um caractere ou três pontos;
//   - na cena B o token chega EM CIMA do pino par ou a uma casa dele: a régua
//     procura a cabeça do pino tocando nesses pontos (toque em vão não faz nada).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Dois jogadores entram, cada um vê o
// próprio token e o do outro, e tocar no pino "!" abre o cartão. Sem ele, o
// vermelho dos testes 2 a 6 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'VIAG01'
const J1 = 'Ana'
const J2 = 'Bruno'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'
const ESTATUA = 'Estatua rachada no salao'
const ESCADA_A = 'Escada que desce'
const ESCADA_B = 'Escada que sobe'
/** Texto que só existe na cena B: se viajar para o jogador antes da hora, vazou. */
const ALTAR_B = 'Altar de ossos antigo'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

// Mundo: as duas cenas têm o MESMO tamanho, então "encaixar a cena na tela" dá
// a mesma câmera nas duas.
const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24

/** Chão da cena A (verde-água) e da cena B (magenta): é por eles que a régua sabe qual cena está na tela. */
const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'

type Ponto = { x: number; y: number }

const POS_J1: Ponto = { x: 700, y: 300 }
const POS_J2: Ponto = { x: 820, y: 300 }
const POS_ESTATUA: Ponto = { x: 700, y: 160 }
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
const POS_ESCADA_B: Ponto = { x: 1000, y: 300 }
const POS_ALTAR: Ponto = { x: 1600, y: 200 }
/** Onde Ana vai explorar antes de viajar: longe da visão de quem está perto da escada. */
const POS_LONGE: Ponto = { x: 1750, y: 300 }
const POS_VOLTA: Ponto = { x: 760, y: 300 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31

/** Pixels mínimos para dizer "isto está na tela". */
const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/
const RECUSADO = 'O mestre não deixou passar agora'

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const AVISO_DE_CHEGADA = new RegExp(`${J1}[^]*entrou em[^]*${escapar(CENA_B)}`)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas ligadas por um par de pinos de viagem
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, kind: Pin['kind'], description: string, destino?: Pin['destino']): Pin {
  const base: Pin = { id, x: p.x, y: p.y, kind, description, image: null }
  return destino === undefined ? base : { ...base, destino }
}

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

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
  const cenaA = cena(
    'map_vale',
    AVENTURA,
    CHAO_A,
    [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1), token('tok-machado', TOKEN_J2, POS_J2, COR_J2)],
    [
      pino('pin-a-estatua', POS_ESTATUA, 'exclamacao', ESTATUA),
      pino('pin-a-escada', POS_ESCADA_A, 'viagem', ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' }),
    ],
  )
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [], [
    pino('pin-b-escada', POS_ESCADA_B, 'viagem', ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' }),
    pino('pin-b-altar', POS_ALTAR, 'exclamacao', ALTAR_B),
  ])
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
    [`${PASTA}/map.json`]: serializeMap(cenaA),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CENA_B}/map.json`]: serializeMap(cenaB),
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

async function mestreAbreAventura(mestre: Page): Promise<Rede> {
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
    { arquivos: discoDaAventura(), codigo: CODIGO },
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

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
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
  /**
   * Todo frame que a PÁGINA recebeu no WebSocket, desde antes de entrar. Com o
   * socket roteado, `page.on('websocket')`/`framereceived` fica mudo (medido:
   * zero frames), então a escuta é a própria rota — a régua só anota, nunca muda.
   */
  frames: string[]
}

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  const page = await contexto.newPage()
  const frames: string[] = []
  rede.enviados.set(clientId, frames)
  // Continua ligado: se um dia o Playwright emitir o evento para socket roteado, o frame também conta.
  page.on('websocket', (ws) => {
    ws.on('framereceived', (frame) => {
      frames.push(typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8'))
    })
  })
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
  return { page, clientId, frames }
}

/** Espera o mapa chegar: canvas na tela e a ficha dele pintada. */
async function esperaMapaNaTela(j: Jogador, oQue: string): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${oQue}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => {
      const tela = await lerTela(j.page)
      return tela.fichaAna + tela.fichaBruno
    }, { timeout: 10_000, message: `${oQue}: nenhuma ficha pintada na tela do jogador` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

/** Mestre abre a aventura e a sala; os jogadores pedidos entram e recebem o token de cada um. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string, quem: 'so-ana' | 'ana-e-bruno'): Promise<{ rede: Rede; ana: Jogador; bruno: Jogador | null }> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = quem === 'ana-e-bruno' ? await jogadorEntra(browser, baseURL, rede, 'c2', J2) : null
  await mestreAtribui(mestre, J1, TOKEN_J1)
  if (bruno) await mestreAtribui(mestre, J2, TOKEN_J2)
  // O mestre volta para o mapa: é onde ele fica na mesa, e onde o editor tem de continuar na cena A.
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await esperaMapaNaTela(ana, J1)
  if (bruno) await esperaMapaNaTela(bruno, J2)
  return { rede, ana, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos e leitura da tela do jogador
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

/** Ponto do mundo → ponto da tela do jogador, com a câmera de "encaixar a cena". */
function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

function cabecaDoPino(p: Ponto): Ponto {
  return naTela({ x: p.x, y: p.y - CABECA_DO_PINO })
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Arrasta a ficha: desce nela, anda em passos, para um instante e solta. */
async function arrastar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 20 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

interface Tela {
  fichaAna: number
  fichaBruno: number
  /** Chão da cena A iluminado (na visão) e lembrado (explorado, escurecido). */
  chaoAClaro: number
  chaoAEscuro: number
  /** Chão da cena B, qualquer brilho. */
  chaoB: number
  /** Centro da ficha verde-limão (Ana), em px de tela. */
  centroDaFichaDeAna: Ponto | null
}

/**
 * Fotografa a tela do jogador e conta pixels por cor, só onde o CANVAS está por
 * cima (painéis e cartões não contam). Leitura pura: decodifica a foto num
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
    const r: { fichaAna: number; fichaBruno: number; chaoAClaro: number; chaoAEscuro: number; chaoB: number; centroDaFichaDeAna: { x: number; y: number } | null } = {
      fichaAna: 0,
      fichaBruno: 0,
      chaoAClaro: 0,
      chaoAEscuro: 0,
      chaoB: 0,
      centroDaFichaDeAna: null,
    }
    let sx = 0
    let sy = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!limao && !laranja && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (limao) {
          r.fichaAna += 1
          sx += x
          sy += y
        } else if (laranja) r.fichaBruno += 1
        else if (verdeAgua) {
          if (G >= 110) r.chaoAClaro += 1
          else if (G >= 35) r.chaoAEscuro += 1
        } else r.chaoB += 1
      }
    }
    if (r.fichaAna > 0) r.centroDaFichaDeAna = { x: (sx / r.fichaAna) * escalaX, y: (sy / r.fichaAna) * escalaY }
    return r
  }, foto.toString('base64'))
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

/** Toca o pino e espera o cartão dele (o de hoje) com a descrição. */
async function abrirCartao(j: Jogador, ondeTocar: Ponto, descricao: string, oQue: string): Promise<Locator> {
  await tocar(j.page, ondeTocar)
  const cartao = j.page.getByRole('dialog').filter({ hasText: descricao })
  await expect(cartao, `${oQue}: tocar o pino deveria abrir o cartão com "${descricao}"`).toBeVisible({ timeout: ESPERA })
  return cartao
}

/**
 * O pedido inteiro, do lado do jogador: cartão do pino de viagem → "Pedir para
 * passar" → a pergunta → confirmar → "Aguardando o mestre…".
 */
async function pedirParaPassar(j: Jogador, ondeTocar: Ponto, descricao: string, oQue: string): Promise<void> {
  const cartao = await abrirCartao(j, ondeTocar, descricao, oQue)
  const pedir = j.page.getByRole('button', { name: PEDIR_PARA_PASSAR })
  await expect(pedir, `${oQue}: o cartão do pino de viagem deveria oferecer "${PEDIR_PARA_PASSAR}". Botões do cartão hoje: ${(await cartao.getByRole('button').allInnerTexts()).join(' | ')}`).toBeVisible({ timeout: ESPERA })
  await pedir.click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${oQue}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  const confirmar = j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR })
  await expect(confirmar.first(), `${oQue}: a pergunta deveria ter um botão de confirmar`).toBeVisible({ timeout: ESPERA })
  await confirmar.first().click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${oQue}: depois de confirmar o jogador deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** O aviso que espera, na tela do mestre, e os dois botões dele. */
async function avisoNoMestre(mestre: Page, pinoDoPedido = ESCADA_A, destino = CENA_B): Promise<{ deixar: Locator; nao: Locator }> {
  const aviso = new RegExp(`${J1}[^]*quer passar[^]*${escapar(pinoDoPedido)}[^]*${escapar(destino)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${J1} quer passar por ${pinoDoPedido} → ${destino}"`).toBeVisible({ timeout: ESPERA })
  const deixar = mestre.getByRole('button', { name: 'Deixar ir', exact: true })
  const nao = mestre.getByRole('button', { name: 'Não', exact: true })
  await expect(deixar, 'o aviso do pedido deveria ter o botão "Deixar ir"').toBeVisible({ timeout: ESPERA })
  await expect(nao, 'o aviso do pedido deveria ter o botão "Não"').toBeVisible({ timeout: ESPERA })
  return { deixar, nao }
}

/** Depois de "Deixar ir": Ana lê "Você chegou" e a tela dela mostra a cena B, e só ela. */
async function anaChegaNaCenaB(ana: Jogador): Promise<Tela> {
  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${J1} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(ana.page)).chaoB, { timeout: ESPERA, message: `${J1} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await telaParada(ana.page)
  expect(tela.chaoAClaro + tela.chaoAEscuro, `${J1} chegou à ${CENA_B} e continua vendo o chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.fichaAna, `${J1} deveria ver a própria ficha na ${CENA_B}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  return tela
}

/** Texto de frame que entrega a cena B ou o destino do pino. */
function vazamentos(frames: readonly string[]): string[] {
  return frames.filter((f) => f.includes(CENA_B) || f.includes(ALTAR_B) || f.includes('"destino"'))
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: dois jogadores na mesma cena veem a própria ficha e a do outro, e o pino "!" abre o cartão', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '', 'ana-e-bruno')
  if (bruno === null) throw new Error('Bruno não entrou')

  for (const j of [ana, bruno]) {
    const tela = await telaParada(j.page)
    const quem = j === ana ? J1 : J2
    expect(tela.fichaAna, `${quem} deveria ver a ficha de ${J1} (verde-limão)`).toBeGreaterThan(PIXELS_DE_TOKEN)
    expect(tela.fichaBruno, `${quem} deveria ver a ficha de ${J2} (laranja)`).toBeGreaterThan(PIXELS_DE_TOKEN)
    expect(tela.chaoAClaro, `${quem} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
    expect(tela.chaoB, `${quem} não deveria ver chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
    // A régua de câmera acerta a ficha: a verde-limão está onde o mundo diz.
    const esperado = naTela(POS_J1)
    expect(tela.centroDaFichaDeAna, `${quem}: ficha de ${J1} sem centro`).not.toBeNull()
    if (tela.centroDaFichaDeAna) expect(Math.hypot(tela.centroDaFichaDeAna.x - esperado.x, tela.centroDaFichaDeAna.y - esperado.y), `${quem}: a ficha de ${J1} não está onde a câmera de encaixe diz`).toBeLessThan(20)

    const cartao = await abrirCartao(j, cabecaDoPino(POS_ESTATUA), ESTATUA, `${quem} toca o pino "!"`)
    await j.page.keyboard.press('Escape')
    await expect(cartao, `${quem}: Escape deveria fechar o cartão`).toBeHidden({ timeout: ESPERA })
  }
})

test('2. pedido: Ana toca o pino de viagem, pede para passar e o mestre recebe o aviso com "Deixar ir" e "Não"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'so-ana')
  await pedirParaPassar(ana, cabecaDoPino(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  await avisoNoMestre(page)
})

test('3. aprovação: Ana vai para a Cripta e vê só ela; Bruno fica no Salão sem a ficha dela; o editor do mestre não troca de cena', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { rede, ana, bruno } = await mesaMontada(browser, page, baseURL ?? '', 'ana-e-bruno')
  if (bruno === null) throw new Error('Bruno não entrou')

  await pedirParaPassar(ana, cabecaDoPino(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  const { deixar } = await avisoNoMestre(page)
  const framesDeBrunoAntes = (rede.enviados.get(bruno.clientId) ?? []).length
  await deixar.click()

  await anaChegaNaCenaB(ana)

  // Bruno continua no Salão: a ficha de Ana some da tela dele, nada da Cripta aparece.
  await expect
    .poll(async () => (await telaParada(bruno.page)).fichaAna, { timeout: ESPERA, message: `a ficha de ${J1} deveria sumir da tela de ${J2}` })
    .toBeLessThanOrEqual(RESIDUO)
  const telaDeBruno = await telaParada(bruno.page)
  expect(telaDeBruno.chaoAClaro, `${J2} deveria continuar vendo o ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeBruno.fichaBruno, `${J2} deveria continuar vendo a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeBruno.chaoB, `${J2} não deveria ver nada da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  await expect(bruno.page.getByText(VOCE_CHEGOU), `${J2} não viajou e não deveria ler "Você chegou"`).toHaveCount(0)
  expect(vazamentos((rede.enviados.get(bruno.clientId) ?? []).slice(framesDeBrunoAntes)), `${J2} ficou no ${CENA_A} e recebeu dados da ${CENA_B}`).toEqual([])

  // O mestre fica sabendo, e o editor dele continua onde estava.
  await expect(page.getByText(AVISO_DE_CHEGADA).first(), `o mestre deveria ler "${J1} entrou em ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await expect(page.getByRole('button', { name: 'Ir lá', exact: true }), 'o aviso de chegada deveria ter "Ir lá"').toBeVisible({ timeout: ESPERA })
  const lista = await secaoCenas(page)
  expect(await estaDestacada(entradaDaCena(lista, CENA_A)), `o editor do mestre não deveria sair do ${CENA_A} sozinho`).toBe(true)
  expect(await estaDestacada(entradaDaCena(lista, CENA_B)), `o editor do mestre não deveria abrir a ${CENA_B} sozinho`).toBe(false)
})

test('4. recusa: o mestre diz "Não", Ana lê que não pode passar agora e continua no Salão', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'so-ana')

  await pedirParaPassar(ana, cabecaDoPino(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  const { nao } = await avisoNoMestre(page)
  await nao.click()

  await expect(ana.page.getByText(RECUSADO).first(), `${J1} deveria ler "${RECUSADO}"`).toBeVisible({ timeout: ESPERA })
  const tela = await telaParada(ana.page)
  expect(tela.chaoAClaro, `recusada, ${J1} deveria continuar vendo o ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(tela.fichaAna, `recusada, ${J1} deveria continuar vendo a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(tela.chaoB, `recusada, ${J1} não deveria ver nada da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  await expect(ana.page.getByText(VOCE_CHEGOU), `recusada, ${J1} não deveria ler "Você chegou"`).toHaveCount(0)
})

test('5. volta com memória: Ana explora o fundo do Salão, vai à Cripta, volta pelo pino par e o fundo continua lembrado', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'so-ana')

  // Ana anda até o fundo do Salão e volta: o fundo vira MEMÓRIA (chão escurecido), fora da visão dela.
  const antesDeAndar = await telaParada(ana.page)
  await arrastar(ana.page, naTela(POS_J1), naTela(POS_LONGE))
  await expect
    .poll(async () => (await telaParada(ana.page)).centroDaFichaDeAna?.x ?? 0, { timeout: ESPERA, message: `a ficha de ${J1} deveria ir para o fundo do ${CENA_A}` })
    .toBeGreaterThan(naTela(POS_LONGE).x - 20)
  await arrastar(ana.page, naTela(POS_LONGE), naTela(POS_VOLTA))
  await expect
    .poll(async () => (await telaParada(ana.page)).centroDaFichaDeAna?.x ?? 9999, { timeout: ESPERA, message: `a ficha de ${J1} deveria voltar para perto da escada` })
    .toBeLessThan(naTela(POS_VOLTA).x + 20)
  const lembrado = (await telaParada(ana.page)).chaoAEscuro
  // Controle (verde hoje): andar deixou memória a mais na tela.
  expect(lembrado, `andar até o fundo do ${CENA_A} deveria deixar o fundo lembrado (chão escurecido)`).toBeGreaterThan(antesDeAndar.chaoAEscuro + PIXELS_DE_CENA)

  // Vai à Cripta.
  await pedirParaPassar(ana, cabecaDoPino(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  const ida = await avisoNoMestre(page)
  await ida.deixar.click()
  const naCripta = await anaChegaNaCenaB(ana)

  // Volta pelo pino par. A ficha chega em cima do pino par (ou a uma casa dele):
  // toca a cabeça do pino nesses pontos até o cartão da Escada que sobe abrir.
  const ficha = naCripta.centroDaFichaDeAna
  if (ficha === null) throw new Error(`${J1} sem ficha na ${CENA_B}`)
  const s = CAMERA.scale
  const deslocamentos: Ponto[] = [{ x: 0, y: 0 }]
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx !== 0 || dy !== 0) deslocamentos.push({ x: dx * GRADE, y: dy * GRADE })
  let achou = false
  for (const d of deslocamentos) {
    await tocar(ana.page, { x: ficha.x - d.x * s, y: ficha.y - d.y * s - CABECA_DO_PINO * s })
    if (await ana.page.getByRole('dialog').filter({ hasText: ESCADA_B }).isVisible()) {
      achou = true
      await ana.page.keyboard.press('Escape')
      await expect(ana.page.getByRole('dialog')).toBeHidden({ timeout: ESPERA })
      await pedirParaPassar(ana, { x: ficha.x - d.x * s, y: ficha.y - d.y * s - CABECA_DO_PINO * s }, ESCADA_B, `${J1} toca a ${ESCADA_B}`)
      break
    }
  }
  expect(achou, `na ${CENA_B}, o pino par (${ESCADA_B}) deveria estar junto da ficha de ${J1}`).toBe(true)
  // O aviso da volta nomeia o caminho de volta: Escada que sobe → Salão.
  const volta = await avisoNoMestre(page, ESCADA_B, CENA_A)
  await volta.deixar.click()

  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${J1} deveria ler "Você chegou" de volta ao ${CENA_A}`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(ana.page)).chaoAClaro, { timeout: ESPERA, message: `de volta, ${J1} deveria ver o ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const deVolta = await telaParada(ana.page)
  expect(deVolta.chaoB, `de volta ao ${CENA_A}, ${J1} não deveria ver a ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  expect(
    deVolta.chaoAEscuro,
    `de volta ao ${CENA_A}, o fundo que ${J1} explorou antes da viagem deveria continuar lembrado (antes: ${lembrado} px de chão lembrado)`,
  ).toBeGreaterThan(lembrado * 0.4)
})

test('6. nada vaza antes da aprovação: nenhum frame recebido por Ana traz o nome da Cripta nem "destino"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '', 'so-ana')

  // Controle: o ouvido está ligado — a página já recebeu o mapa pelo WebSocket.
  expect(ana.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J1} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)
  expect(vazamentos(ana.frames), `antes de pedir, ${J1} já recebeu dados da ${CENA_B}`).toEqual([])

  await pedirParaPassar(ana, cabecaDoPino(POS_ESCADA_A), ESCADA_A, `${J1} toca a ${ESCADA_A}`)
  await avisoNoMestre(page)
  expect(vazamentos(ana.frames), `até o "Aguardando o mestre…", ${J1} recebeu o nome da ${CENA_B} ou o destino do pino`).toEqual([])
})
