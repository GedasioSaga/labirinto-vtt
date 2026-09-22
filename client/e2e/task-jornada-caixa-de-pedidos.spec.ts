// JORNADA DE USUÁRIO da CAIXA DE PEDIDOS (PEDIDOS.md, G4) — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (decisões do usuário):
//   - com 1 pedido de passagem esperando, o mestre vê o aviso de hoje:
//     "<jogador> quer passar por <pino> → <cena>", com "Deixar ir" e "Não";
//   - com 2 ou mais esperando, os avisos de pedido viram UMA caixa só, de
//     título (ou nome acessível) "Pedidos (N)", uma linha por pedido com
//     "Deixar ir" e "Não", e um botão "Deixar todos";
//   - responder uma linha tira só aquela linha e o N cai; quando sobra 1, a
//     caixa pode continuar ou voltar ao aviso simples — a régua aceita os dois,
//     mas o pedido que sobrou continua respondível;
//   - "Deixar todos" aprova todos: cada jogador lê "Você chegou" na própria tela.
//
// ONDE ISSO MORRE HOJE: `net/hostBridge.ts` (askTravel) empurra UM aviso por
// pedido em `stores/toastStore.ts`, e `components/Toast.tsx` empilha cada um
// com o próprio "Deixar ir" — três pedidos, três avisos soltos, nenhum título
// "Pedidos (N)" e nenhum "Deixar todos".
//
// COMO ESTE ARQUIVO PROVA (mesmo preparo de task-jornada-viagem-do-jogador):
//   QUATRO TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` na página do mestre (JSON.parse do que chegou),
//   e o `net_send` do mestre volta ao socket do jogador por `exposeFunction`.
//   A sessão do host é a do app (`net/hostBridge.ts`), sem estado injetado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: duas cenas ligadas por um par de
//   pinos de viagem, abertas pelo menu ("Carregar Mapa existente").
//   GESTO REAL NA AÇÃO SOB TESTE: toque no pino, clique nos botões do cartão e
//   da caixa. Os únicos `evaluate` são o do transporte e a LEITURA de pixel.
//   PROVA NA TELA: texto visível, nome acessível e a cor do chão nos pixels
//   de cada jogador (cena A verde-água, cena B magenta).
//   TRÊS JOGADORES NA MESMA CENA, perto do mesmo pino: o limite de pedido é por
//   jogador (`TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS`), então os três pedem juntos.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do usuário):
//   - a caixa se acha por um papel ARIA com nome "Pedidos (N)" (`PAPEIS_DA_CAIXA`)
//     OU pelo menor bloco que tem o texto "Pedidos (N)", uma linha de pedido e
//     "Deixar todos";
//   - a linha mantém a frase inteira de hoje ("<jogador> quer passar por <pino>
//     → <cena>") e os botões se chamam exatamente "Deixar ir", "Não" e
//     "Deixar todos";
//   - a caixa não repete "Deixar ir" fora das linhas (é o que prova que não
//     sobrou aviso solto: "Deixar ir" na página inteira = número de pedidos);
//   - o botão que confirma o pedido no jogador é o mesmo da régua da viagem.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Um pedido só vira o aviso de hoje.
// Sem ele, o vermelho dos testes 2 a 4 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'PEDI01'
const ANA = 'Ana'
const BRUNO = 'Bruno'
const CARLA = 'Carla'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

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
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
const COR_ANA = '#3cff00'
const COR_BRUNO = '#ff5a00'
/** Azul: não cai em nenhum filtro de cor da leitura (nem ficha, nem chão). */
const COR_CARLA = '#2050ff'

type Ponto = { x: number; y: number }

// Os três perto da Escada que desce (900, 440), e nenhum em cima da cabeça dela.
const POS_ANA: Ponto = { x: 700, y: 300 }
const POS_BRUNO: Ponto = { x: 820, y: 300 }
const POS_CARLA: Ponto = { x: 760, y: 420 }
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
const POS_ESCADA_B: Ponto = { x: 1000, y: 300 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: foto + decodificação custam segundos por leitura. */
const ESPERA_TELA = 15_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31

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
const DEIXAR_IR = 'Deixar ir'
const NAO = 'Não'
const DEIXAR_TODOS = 'Deixar todos'
/** Papéis em que a caixa pode morar com nome acessível "Pedidos (N)". */
const PAPEIS_DA_CAIXA = ['dialog', 'alertdialog', 'region', 'group', 'alert', 'status', 'log', 'complementary', 'list'] as const

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A frase do pedido de um jogador: "<jogador> quer passar por <pino> → <cena>". */
const frasePedido = (jogador: string): RegExp => new RegExp(`${jogador}[^]*quer passar[^]*${escapar(ESCADA_A)}[^]*${escapar(CENA_B)}`)
const QUALQUER_PEDIDO = /quer passar/
const tituloDaCaixa = (n: number | null): RegExp => (n === null ? /^\s*Pedidos \(\d+\)\s*$/ : new RegExp(`^\\s*Pedidos \\(${n}\\)\\s*$`))

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: duas cenas ligadas por um par de pinos de viagem
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, description: string, destino: NonNullable<Pin['destino']>): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description, image: null, destino }
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
    [
      token('tok-lanterna', TOKEN_ANA, POS_ANA, COR_ANA),
      token('tok-machado', TOKEN_BRUNO, POS_BRUNO, COR_BRUNO),
      token('tok-cajado', TOKEN_CARLA, POS_CARLA, COR_CARLA),
    ],
    [pino('pin-a-escada', POS_ESCADA_A, ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
  )
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [], [pino('pin-b-escada', POS_ESCADA_B, ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' })])
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
  /** Mensagens do jogador entregues ao mestre uma de cada vez, na ordem em que chegaram. */
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

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// Os jogadores: player.html inteiro, cada um no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  nome: string
}

/** Contextos de jogador do teste que está rodando; o `page` do mestre o Playwright fecha sozinho. */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
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
  return { page, nome }
}

/** Espera o mapa chegar: canvas na tela e o chão do Salão pintado. */
async function esperaMapaNaTela(j: Jogador): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(j.page)).fichas, { timeout: ESPERA_TELA, message: `${j.nome}: nenhuma ficha pintada na tela do jogador` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

/** Mestre abre a aventura e a sala; Ana, Bruno e Carla entram e recebem cada um o seu token. */
async function mesaDeTres(browser: Browser, mestre: Page, baseURL: string): Promise<{ ana: Jogador; bruno: Jogador; carla: Jogador }> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', ANA)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', BRUNO)
  const carla = await jogadorEntra(browser, baseURL, rede, 'c3', CARLA)
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await mestreAtribui(mestre, BRUNO, TOKEN_BRUNO)
  await mestreAtribui(mestre, CARLA, TOKEN_CARLA)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  for (const j of [ana, bruno, carla]) await esperaMapaNaTela(j)
  return { ana, bruno, carla }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos e leitura da tela do jogador
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

function cabecaDoPino(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round((p.y - CABECA_DO_PINO) * CAMERA.scale + CAMERA.y) }
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

interface Tela {
  /** Fichas de Ana (verde-limão) e Bruno (laranja) somadas. */
  fichas: number
  chaoA: number
  chaoB: number
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
    const r = { fichas: 0, chaoA: 0, chaoB: 0 }
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
        if (limao || laranja) r.fichas += 1
        else if (verdeAgua) {
          if (G >= 35) r.chaoA += 1
        } else r.chaoB += 1
      }
    }
    return r
  }, foto.toString('base64'))
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

/** O pedido inteiro, do lado do jogador: toca a Escada que desce → "Pedir para passar" → confirma → "Aguardando o mestre…". */
async function pedirParaPassar(j: Jogador): Promise<void> {
  await tocar(j.page, cabecaDoPino(POS_ESCADA_A))
  const cartao = j.page.getByRole('dialog').filter({ hasText: ESCADA_A })
  await expect(cartao, `${j.nome}: tocar a ${ESCADA_A} deveria abrir o cartão dela`).toBeVisible({ timeout: ESPERA })
  const pedir = j.page.getByRole('button', { name: PEDIR_PARA_PASSAR })
  await expect(pedir, `${j.nome}: o cartão do pino de viagem deveria oferecer "${PEDIR_PARA_PASSAR}"`).toBeVisible({ timeout: ESPERA })
  await pedir.click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${j.nome}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  const confirmar = j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR })
  await confirmar.first().click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${j.nome}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** Os três pedem, um depois do outro, e o mestre recebe os três (cada frase na tela dele). */
async function tresPedem(mestre: Page, jogadores: readonly Jogador[]): Promise<void> {
  for (const j of jogadores) await pedirParaPassar(j)
  for (const j of jogadores) {
    await expect(mestre.getByText(frasePedido(j.nome)).first(), `o mestre deveria ler "${j.nome} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A caixa de pedidos, na tela do mestre
// ───────────────────────────────────────────────────────────────────────────

/**
 * A caixa "Pedidos (N)": um papel ARIA com esse nome, ou o menor bloco que tem
 * o título escrito, uma linha de pedido e "Deixar todos". `n = null` casa com
 * qualquer N (para provar que a caixa sumiu).
 */
function caixaDePedidos(mestre: Page, n: number | null): Locator {
  const titulo = tituloDaCaixa(n)
  const porNome = PAPEIS_DA_CAIXA.map((papel) => mestre.getByRole(papel, { name: titulo })).reduce((a, b) => a.or(b))
  const porTitulo = mestre
    .locator('div, section, aside, dialog, ul, ol, [role]')
    .filter({ has: mestre.getByText(titulo) })
    .filter({ has: mestre.getByText(QUALQUER_PEDIDO) })
    .filter({ has: mestre.getByRole('button', { name: DEIXAR_TODOS, exact: true }) })
  return porNome.or(porTitulo).last()
}

/** A linha de um jogador dentro de `onde`: o menor bloco com a frase dele e um "Deixar ir". */
function linhaDe(onde: Page | Locator, jogador: string): Locator {
  // O `has` é procurado DENTRO de cada candidato. Vindo de `onde` quando
  // `onde` é a caixa, o seletor começava pela caixa e exigia uma caixa dentro
  // da linha — nunca casava (achado do builder em 22/09, conferido no
  // playwright-core). Ancorado na página, ele vira só "tem este botão dentro".
  const pagina: Page = 'goto' in onde ? onde : onde.page()
  return onde
    .locator('div, li, section, aside, [role]')
    .filter({ hasText: frasePedido(jogador) })
    .filter({ has: pagina.getByRole('button', { name: DEIXAR_IR, exact: true }) })
    .last()
}

/** O mestre tem UMA caixa "Pedidos (N)" com uma linha por jogador, e nenhum "Deixar ir" solto fora dela. */
async function caixaComLinhas(mestre: Page, jogadores: readonly string[]): Promise<Locator> {
  const n = jogadores.length
  const caixa = caixaDePedidos(mestre, n)
  const soltos = await mestre.getByText(QUALQUER_PEDIDO).count()
  await expect(
    caixa,
    `com ${n} pedidos esperando, o mestre deveria ver UMA caixa "Pedidos (${n})" — hoje há ${soltos} frase(s) "quer passar" e ${await mestre.getByRole('button', { name: DEIXAR_IR, exact: true }).count()} "Deixar ir" na tela, nenhum título "Pedidos (N)"`,
  ).toBeVisible({ timeout: ESPERA })
  await expect(mestre.getByText(tituloDaCaixa(null)), 'deveria haver UM título "Pedidos (N)" só').toHaveCount(1)
  for (const jogador of jogadores) {
    const linha = linhaDe(caixa, jogador)
    await expect(linha, `a caixa deveria ter a linha "${jogador} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
    await expect(linha.getByRole('button', { name: DEIXAR_IR, exact: true }), `a linha de ${jogador} deveria ter "${DEIXAR_IR}"`).toBeVisible()
    await expect(linha.getByRole('button', { name: NAO, exact: true }), `a linha de ${jogador} deveria ter "${NAO}"`).toBeVisible()
  }
  await expect(caixa.getByRole('button', { name: DEIXAR_IR, exact: true }), `a caixa deveria ter um "${DEIXAR_IR}" por pedido`).toHaveCount(n)
  await expect(
    mestre.getByRole('button', { name: DEIXAR_IR, exact: true }),
    `nenhum "${DEIXAR_IR}" deveria sobrar fora da caixa (aviso solto de pedido)`,
  ).toHaveCount(n)
  await expect(caixa.getByRole('button', { name: DEIXAR_TODOS, exact: true }), `a caixa deveria ter "${DEIXAR_TODOS}"`).toBeVisible()
  return caixa
}

/** Depois de aprovado: o jogador lê "Você chegou" e a tela dele mostra a Cripta, e só ela. */
async function chegaNaCripta(j: Jogador): Promise<void> {
  await expect(j.page.getByText(VOCE_CHEGOU).first(), `${j.nome} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(j.page)).chaoB, { timeout: ESPERA_TELA, message: `${j.nome} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  expect((await telaParada(j.page)).chaoA, `${j.nome} chegou à ${CENA_B} e continua vendo o chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: com um pedido só, o mestre vê o aviso de hoje com "Deixar ir" e "Não"', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaDeTres(browser, page, baseURL ?? '')

  await pedirParaPassar(ana)

  const aviso = linhaDe(page, ANA)
  await expect(aviso, `o mestre deveria ler "${ANA} quer passar por ${ESCADA_A} → ${CENA_B}" com "${DEIXAR_IR}"`).toBeVisible({ timeout: ESPERA })
  await expect(aviso.getByRole('button', { name: DEIXAR_IR, exact: true })).toBeVisible()
  await expect(aviso.getByRole('button', { name: NAO, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: DEIXAR_IR, exact: true }), 'um pedido, um "Deixar ir"').toHaveCount(1)
})

test('2. três pedidos viram UMA caixa "Pedidos (3)" com uma linha por jogador, sem aviso solto', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno, carla } = await mesaDeTres(browser, page, baseURL ?? '')

  await tresPedem(page, [ana, bruno, carla])

  await caixaComLinhas(page, [ANA, BRUNO, CARLA])
})

test('3. "Não" na linha de Bruno: Bruno lê a recusa, a caixa cai para "Pedidos (2)" e o pedido que sobrar continua respondível', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno, carla } = await mesaDeTres(browser, page, baseURL ?? '')
  await tresPedem(page, [ana, bruno, carla])
  const caixa = await caixaComLinhas(page, [ANA, BRUNO, CARLA])

  await linhaDe(caixa, BRUNO).getByRole('button', { name: NAO, exact: true }).click()

  await expect(bruno.page.getByText(RECUSADO).first(), `${BRUNO} deveria ler "${RECUSADO}"`).toBeVisible({ timeout: ESPERA })
  const caixaDeDois = await caixaComLinhas(page, [ANA, CARLA])
  await expect(page.getByText(frasePedido(BRUNO)), `a linha de ${BRUNO} deveria sair da tela do mestre`).toHaveCount(0)
  await expect(ana.page.getByText(RECUSADO), `só ${BRUNO} foi recusado; ${ANA} não deveria ler a recusa`).toHaveCount(0)
  await expect(carla.page.getByText(RECUSADO), `só ${BRUNO} foi recusado; ${CARLA} não deveria ler a recusa`).toHaveCount(0)

  // Sobra um: caixa "Pedidos (1)" ou o aviso de hoje — os dois valem, desde que Carla continue respondível.
  await linhaDe(caixaDeDois, ANA).getByRole('button', { name: NAO, exact: true }).click()
  await expect(ana.page.getByText(RECUSADO).first(), `${ANA} deveria ler "${RECUSADO}"`).toBeVisible({ timeout: ESPERA })
  const sobra = linhaDe(page, CARLA)
  await expect(sobra, `com um pedido sobrando, o de ${CARLA} deveria continuar na tela com "${DEIXAR_IR}"`).toBeVisible({ timeout: ESPERA })
  await expect(page.getByRole('button', { name: DEIXAR_IR, exact: true }), 'um pedido sobrando, um "Deixar ir"').toHaveCount(1)
  await sobra.getByRole('button', { name: DEIXAR_IR, exact: true }).click()
  await chegaNaCripta(carla)
})

test('4. "Deixar todos": Ana e Carla chegam na Cripta, Bruno (recusado antes) fica no Salão e a caixa some', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno, carla } = await mesaDeTres(browser, page, baseURL ?? '')
  await tresPedem(page, [ana, bruno, carla])
  const caixa = await caixaComLinhas(page, [ANA, BRUNO, CARLA])
  await linhaDe(caixa, BRUNO).getByRole('button', { name: NAO, exact: true }).click()
  await expect(bruno.page.getByText(RECUSADO).first(), `${BRUNO} deveria ler "${RECUSADO}"`).toBeVisible({ timeout: ESPERA })
  const caixaDeDois = await caixaComLinhas(page, [ANA, CARLA])

  await caixaDeDois.getByRole('button', { name: DEIXAR_TODOS, exact: true }).click()

  await chegaNaCripta(ana)
  await chegaNaCripta(carla)
  await expect(caixaDePedidos(page, null), `respondidos todos, a caixa "Pedidos (N)" deveria sumir`).toHaveCount(0)
  await expect(page.getByRole('button', { name: DEIXAR_IR, exact: true }), `respondidos todos, nenhum "${DEIXAR_IR}" deveria sobrar`).toHaveCount(0)
  await expect(page.getByText(QUALQUER_PEDIDO), 'respondidos todos, nenhuma frase "quer passar" deveria sobrar').toHaveCount(0)

  // Bruno foi recusado antes do "Deixar todos": continua no Salão.
  await expect(bruno.page.getByText(VOCE_CHEGOU), `${BRUNO} foi recusado e não deveria ler "Você chegou"`).toHaveCount(0)
  const telaDeBruno = await telaParada(bruno.page)
  expect(telaDeBruno.chaoA, `${BRUNO} deveria continuar vendo o ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeBruno.chaoB, `${BRUNO} não deveria ver nada da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
})
