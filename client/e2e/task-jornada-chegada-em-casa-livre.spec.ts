// JORNADA DE USUÁRIO do item CHEGADA-EM-CASA-LIVRE (backlog da simulação de 7
// jogadores, defeito P) — escrita para SAIR VERMELHA no código de hoje. É a
// régua do conserto, não o conserto.
//
// O ITEM: quem passa pelo MESMO pino de viagem chega em casas vizinhas, não
// empilhado. Hoje todos caem na mesma célula, em cima do pino: a ficha de
// baixo some e o dono não consegue arrastá-la. A chegada deve ir para a casa
// livre mais próxima (a mesma busca do "Reunir o grupo aqui"), sem cruzar
// parede, e o pino continua tocável. Vale para pedido, livre e "Mandar para…".
//
// ONDE ISSO MORRE HOJE:
//   - client/src/lib/pinTravel.ts:400 `arrivalSpot` devolve a PONTA do pino par
//     encaixada na grade, sem olhar quem já está lá (não recebe as fichas);
//   - client/src/net/hostSession.ts:793 (`transferResult`, pedido aprovado e
//     pino livre) e :902 (`sendPlayer`, "Mandar para…") usam esse ponto cru;
//   - a busca que já sabe achar casa livre em volta do pino é
//     client/src/lib/gatherParty.ts:85 `gatherSpots`, e só o "Reunir" a usa.
//
// COMO ESTE ARQUIVO PROVA (mesmo preparo de task-jornada-caixa-de-pedidos):
//   TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página; cada
//   jogador é o player.html inteiro no próprio contexto de navegador. Só o
//   TRANSPORTE Rust é falsificado (WebSocket roteado vira `net:message` no
//   mestre; `net_send` do mestre volta ao socket do jogador). A sessão do host
//   é a do app, sem estado injetado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão (chão verde-água) e Porão
//   (chão magenta) ligados por um par de pinos de viagem; o modo "livre" do
//   teste 4 vem gravado no pino, no formato do app (campo `passagem`).
//   GESTO REAL: toque no pino, clique nos botões do cartão e da caixa do
//   mestre, arrasto da ficha pelo ponteiro com pausa antes de soltar. Os únicos
//   `evaluate` são o do transporte e a LEITURA de pixel.
//   PROVA NA TELA: cada ficha tem uma cor (Ana verde-limão, Bruno laranja,
//   Carla azul) e a régua lê, na foto da tela do JOGADOR, quantos pixels de
//   cada cor aparecem e onde fica o centro de cada uma. Ficha empilhada = a de
//   baixo some da foto ou os centros coincidem.
//
// SUPOSIÇÕES (as únicas que esta régua dita além do aceite):
//   - "lado a lado" = centros a pelo menos 0,8 casa um do outro;
//   - "fora do pino" = centro da ficha a pelo menos 0,5 casa da ponta do pino;
//   - o pino par fica no MEIO de uma casa, para "chegar em cima dele" ser
//     inequívoco;
//   - o cartão do pino é o `dialog` que contém a descrição dele; os botões são
//     os de hoje ("Pedir para passar", "Pedir", "Passar", "Deixar todos");
//   - a câmera do jogador encaixa a cena na tela ao chegar (hoje é assim:
//     player/PlayerView.tsx:854), e as duas cenas têm o mesmo tamanho.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ana e Bruno pedem, o mestre usa
// "Deixar todos" e os dois chegam ao Porão. Sem ele, o vermelho dos testes 2 a
// 4 poderia ser a infraestrutura quebrada.
//
// FORA DESTA RÉGUA (de propósito): 7 jogadores pela mesma escada (8 páginas
// com Pixi numa máquina carregada; o teste 4 prova a mesma regra com 3 pelo
// pino livre, e o aceite pede o caso de 7 em teste de unidade) e o
// "Mandar para…" (mesmo `arrivalSpot`, caminho em hostSession.ts:902).
import { test, expect, type Browser, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'CASA01'
const ANA = 'Ana'
const BRUNO = 'Bruno'
const CARLA = 'Carla'
const AVENTURA = 'Aventura do Vale'
const CENA_B = 'Porao Fundo'

const TOKEN_ANA = 'Lanterna'
const TOKEN_BRUNO = 'Machado'
const TOKEN_CARLA = 'Cajado'
const ESCADA_A = 'Escada que desce'
const ESCADA_B = 'Escada que sobe'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_porao'
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
const COR_CARLA = '#2050ff'

type Ponto = { x: number; y: number }
type Passagem = 'pede' | 'livre'

const POS_ANA: Ponto = { x: 700, y: 300 }
const POS_BRUNO: Ponto = { x: 820, y: 300 }
const POS_CARLA: Ponto = { x: 760, y: 420 }
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
/** No MEIO de uma casa (casas de 50 começam em 0): chegar "em cima do pino" não tem ambiguidade. */
const POS_ESCADA_B: Ponto = { x: 1025, y: 325 }
/** Para onde cada um arrasta a própria ficha no Porão: três casas para cada lado do pino, chão livre. */
const DESTINO_ANA: Ponto = { x: 875, y: 325 }
const DESTINO_BRUNO: Ponto = { x: 1175, y: 325 }

const TOQUE_MS = 120
const PINTURA_MS = 400
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge da ficha. */
const CABECA_DO_PINO = 31

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const PASSAR = 'Passar'
const PERGUNTA_LIVRE = 'Passar por aqui?'
const CONFIRMAR_PASSAGEM = /^(passar|sim|confirmar|ir)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/
const DEIXAR_TODOS = 'Deixar todos'

const frasePedido = (jogador: string): RegExp => new RegExp(`${jogador}[^]*quer passar[^]*${ESCADA_A}[^]*${CENA_B}`)

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Salão e Porão ligados por um par de pinos de viagem
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, description: string, destino: NonNullable<Pin['destino']>, passagem: Passagem): Pin {
  const base: Pin = { id, x: p.x, y: p.y, kind: 'viagem', description, image: null, destino }
  return passagem === 'livre' ? { ...base, passagem: 'livre' } : base
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

function discoDaAventura(passagem: Passagem): Record<string, string> {
  const cenaA = cena(
    'map_vale',
    AVENTURA,
    CHAO_A,
    [
      token('tok-lanterna', TOKEN_ANA, POS_ANA, COR_ANA),
      token('tok-machado', TOKEN_BRUNO, POS_BRUNO, COR_BRUNO),
      token('tok-cajado', TOKEN_CARLA, POS_CARLA, COR_CARLA),
    ],
    [pino('pin-a-escada', POS_ESCADA_A, ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' }, passagem)],
  )
  const cenaB = cena('map_porao', CENA_B, CHAO_B, [], [pino('pin-b-escada', POS_ESCADA_B, ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' }, 'pede')])
  const aventura = {
    version: 1,
    id: 'adv_vale',
    name: AVENTURA,
    startSceneId: ID_CENA_A,
    scenes: [
      { id: ID_CENA_A, name: 'Salao Norte', file: 'map.json' },
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
// (copiado de task-jornada-caixa-de-pedidos.spec.ts, só com o modo do pino)
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

async function mestreAbreAventura(mestre: Page, passagem: Passagem): Promise<Rede> {
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
    { arquivos: discoDaAventura(passagem), codigo: CODIGO },
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

const TOKEN_DE: Record<string, string> = { [ANA]: TOKEN_ANA, [BRUNO]: TOKEN_BRUNO, [CARLA]: TOKEN_CARLA }

/** Mestre abre a aventura e a sala; os jogadores pedidos entram, cada um recebe o seu token e vê a própria ficha no Salão. */
async function mesa(browser: Browser, mestre: Page, baseURL: string, passagem: Passagem, nomes: readonly string[]): Promise<Jogador[]> {
  const rede = await mestreAbreAventura(mestre, passagem)
  const jogadores: Jogador[] = []
  for (let i = 0; i < nomes.length; i += 1) jogadores.push(await jogadorEntra(browser, baseURL, rede, `c${i + 1}`, nomes[i]))
  for (const nome of nomes) await mestreAtribui(mestre, nome, TOKEN_DE[nome])
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  for (const j of jogadores) {
    await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
    await expect
      .poll(async () => (await lerTela(j.page)).fichas[j.nome].pixels, { timeout: ESPERA_TELA, message: `${j.nome}: a própria ficha não apareceu no Salão` })
      .toBeGreaterThan(PIXELS_DE_TOKEN)
  }
  return jogadores
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos e leitura da tela do jogador
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)
/** Uma casa, em px de tela. */
const CASA_NA_TELA = GRADE * CAMERA.scale
const SEPARACAO_MINIMA = 0.8 * CASA_NA_TELA
const FOLGA_DO_PINO = 0.5 * CASA_NA_TELA

function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

function cabecaDoPino(p: Ponto): Ponto {
  return naTela({ x: p.x, y: p.y - CABECA_DO_PINO })
}

const distancia = (a: Ponto, b: Ponto): number => Math.hypot(a.x - b.x, a.y - b.y)

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
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.move(para.x, para.y, { steps: 20 })
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

interface Ficha {
  pixels: number
  /** Centro da cor na tela, em px CSS; `null` = a ficha não aparece. */
  centro: Ponto | null
}

interface Tela {
  fichas: Record<string, Ficha>
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
  const lido = await page.evaluate(async (b64) => {
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
    // [pixels, soma x, soma y] de cada ficha: limão (Ana), laranja (Bruno), azul (Carla).
    const somas = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    let chaoB = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        const azul = B > 200 && R < 80 && G > 40 && G < 130
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        const qual = limao ? 0 : laranja ? 1 : azul ? 2 : magenta ? 3 : -1
        if (qual === -1 || !canvasPorCima(x, y)) continue
        if (qual === 3) {
          chaoB += 1
          continue
        }
        somas[qual][0] += 1
        somas[qual][1] += x
        somas[qual][2] += y
      }
    }
    return { somas, chaoB, escalaX, escalaY }
  }, foto.toString('base64'))
  const ficha = ([n, sx, sy]: number[]): Ficha => ({ pixels: n, centro: n === 0 ? null : { x: (sx / n) * lido.escalaX, y: (sy / n) * lido.escalaY } })
  return { fichas: { [ANA]: ficha(lido.somas[0]), [BRUNO]: ficha(lido.somas[1]), [CARLA]: ficha(lido.somas[2]) }, chaoB: lido.chaoB }
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

/**
 * O que está errado na chegada, lido na tela: ficha que não aparece (debaixo
 * de outra), ficha em cima do pino, duas fichas na mesma casa. Vazio = certo.
 */
function problemasDaChegada(tela: Tela, nomes: readonly string[]): string[] {
  const problemas: string[] = []
  const pino = naTela(POS_ESCADA_B)
  for (const nome of nomes) {
    const { pixels, centro } = tela.fichas[nome]
    if (pixels < PIXELS_DE_TOKEN || centro === null) problemas.push(`a ficha de ${nome} não aparece (${pixels} px): está debaixo de outra`)
    else if (distancia(centro, pino) < FOLGA_DO_PINO) problemas.push(`a ficha de ${nome} está em cima do pino (${distancia(centro, pino).toFixed(1)} px da ponta)`)
  }
  for (let i = 0; i < nomes.length; i += 1) {
    for (let k = i + 1; k < nomes.length; k += 1) {
      const a = tela.fichas[nomes[i]].centro
      const b = tela.fichas[nomes[k]].centro
      if (a !== null && b !== null && distancia(a, b) < SEPARACAO_MINIMA) {
        problemas.push(`${nomes[i]} e ${nomes[k]} estão na mesma casa (centros a ${distancia(a, b).toFixed(1)} px)`)
      }
    }
  }
  return problemas
}

/** Do lado do jogador: toca a Escada que desce → "Pedir para passar" → "Pedir" → "Aguardando o mestre…". */
async function pedirParaPassar(j: Jogador): Promise<void> {
  await tocar(j.page, cabecaDoPino(POS_ESCADA_A))
  const cartao = j.page.getByRole('dialog').filter({ hasText: ESCADA_A })
  await expect(cartao, `${j.nome}: tocar a ${ESCADA_A} deveria abrir o cartão dela`).toBeVisible({ timeout: ESPERA })
  await cartao.getByRole('button', { name: PEDIR_PARA_PASSAR }).click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${j.nome}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR }).first().click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${j.nome}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** Do lado do jogador, pino livre: toca a Escada que desce → "Passar" → confirma. */
async function passarDireto(j: Jogador): Promise<void> {
  await tocar(j.page, cabecaDoPino(POS_ESCADA_A))
  const cartao = j.page.getByRole('dialog').filter({ hasText: ESCADA_A })
  await expect(cartao, `${j.nome}: tocar a ${ESCADA_A} deveria abrir o cartão dela`).toBeVisible({ timeout: ESPERA })
  await cartao.getByRole('button', { name: PASSAR, exact: true }).click()
  await expect(j.page.getByText(PERGUNTA_LIVRE), `${j.nome}: "${PASSAR}" deveria perguntar "${PERGUNTA_LIVRE}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('group', { name: PERGUNTA_LIVRE }).getByRole('button', { name: CONFIRMAR_PASSAGEM }).first().click()
}

/** O jogador lê "Você chegou" e a tela dele mostra o chão do Porão. */
async function chegaNoPorao(j: Jogador): Promise<void> {
  await expect(j.page.getByText(VOCE_CHEGOU).first(), `${j.nome} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaParada(j.page)).chaoB, { timeout: ESPERA_TELA, message: `${j.nome} deveria passar a ver o chão do ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

/** Ana e Bruno pedem o Porão; o mestre vê os dois pedidos e aperta "Deixar todos"; os dois chegam. */
async function doisPedemEDeixarTodos(mestre: Page, ana: Jogador, bruno: Jogador): Promise<void> {
  await pedirParaPassar(ana)
  await pedirParaPassar(bruno)
  for (const j of [ana, bruno]) {
    await expect(mestre.getByText(frasePedido(j.nome)).first(), `o mestre deveria ler "${j.nome} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  }
  await mestre.getByRole('button', { name: DEIXAR_TODOS, exact: true }).click()
  await chegaNoPorao(ana)
  await chegaNoPorao(bruno)
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana e Bruno pedem o Porão, o mestre aperta "Deixar todos" e os dois chegam', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const [ana, bruno] = await mesa(browser, page, baseURL ?? '', 'pede', [ANA, BRUNO])

  await doisPedemEDeixarTodos(page, ana, bruno)

  const tela = await telaParada(ana.page)
  expect(tela.fichas[ANA].pixels + tela.fichas[BRUNO].pixels, `${ANA} deveria ver ficha no ${CENA_B}`).toBeGreaterThan(PIXELS_DE_TOKEN)
})

test('2. "Deixar todos": as duas fichas chegam lado a lado, fora do pino, e o pino continua abrindo o cartão', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const [ana, bruno] = await mesa(browser, page, baseURL ?? '', 'pede', [ANA, BRUNO])
  await doisPedemEDeixarTodos(page, ana, bruno)

  await expect
    .poll(async () => problemasDaChegada(await telaParada(ana.page), [ANA, BRUNO]), {
      timeout: ESPERA_TELA,
      message: `na tela de ${ANA}, ${ANA} e ${BRUNO} deveriam chegar em casas vizinhas, fora do pino`,
    })
    .toEqual([])

  await tocar(ana.page, cabecaDoPino(POS_ESCADA_B))
  await expect(ana.page.getByRole('dialog').filter({ hasText: ESCADA_B }), `com o grupo em volta, tocar o pino deveria abrir o cartão da ${ESCADA_B}`).toBeVisible({ timeout: ESPERA })
})

test('3. cada um arrasta a sua: Ana e Bruno pegam a própria ficha ao mesmo tempo e cada uma vai para onde o dono soltou', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const [ana, bruno] = await mesa(browser, page, baseURL ?? '', 'pede', [ANA, BRUNO])
  await doisPedemEDeixarTodos(page, ana, bruno)

  // Cada um olha a PRÓPRIA tela e desce o dedo onde vê a sua ficha; se ela
  // não aparece, desce onde ela deveria estar — em cima da ficha que a cobre.
  const pegaDe = async (j: Jogador): Promise<Ponto> => {
    const tela = await telaParada(j.page)
    const minha = tela.fichas[j.nome].centro
    const qualquer = [ANA, BRUNO].map((n) => tela.fichas[n].centro).find((c): c is Ponto => c !== null)
    const onde = minha ?? qualquer
    if (onde === undefined) throw new Error(`${j.nome} não vê ficha nenhuma no ${CENA_B}`)
    return onde
  }
  const [deAna, deBruno] = await Promise.all([pegaDe(ana), pegaDe(bruno)])
  await Promise.all([arrastar(ana.page, deAna, naTela(DESTINO_ANA)), arrastar(bruno.page, deBruno, naTela(DESTINO_BRUNO))])

  for (const [j, destino] of [
    [ana, DESTINO_ANA],
    [bruno, DESTINO_BRUNO],
  ] as const) {
    await expect
      .poll(
        async () => {
          const centro = (await telaParada(j.page)).fichas[j.nome].centro
          return centro === null ? 'não aparece' : `${Math.round(distancia(centro, naTela(destino)))} px do ponto solto`
        },
        { timeout: ESPERA_TELA, message: `${j.nome} arrastou a própria ficha: ela deveria ficar onde ${j.nome} soltou` },
      )
      .toMatch(/^([0-9]|1[0-4]) px do ponto solto$/)
  }
})

test('4. pino livre: Ana, Bruno e Carla passam direto pela mesma escada e ocupam três casas diferentes em volta do pino', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const jogadores = await mesa(browser, page, baseURL ?? '', 'livre', [ANA, BRUNO, CARLA])

  for (const j of jogadores) await passarDireto(j)
  for (const j of jogadores) await chegaNoPorao(j)

  const carla = jogadores[2]
  await expect
    .poll(async () => problemasDaChegada(await telaParada(carla.page), [ANA, BRUNO, CARLA]), {
      timeout: ESPERA_TELA,
      message: `na tela de ${CARLA}, as três fichas deveriam ocupar três casas diferentes, fora do pino`,
    })
    .toEqual([])
})
