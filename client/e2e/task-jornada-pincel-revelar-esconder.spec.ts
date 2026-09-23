// JORNADA DE USUÁRIO do PINCEL DE REVELAR E ESCONDER (item 11 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (pedido do usuário):
//   - uma ferramenta do mestre que, ARRASTANDO no mapa, revela para os
//     jogadores SÓ o pedaço pintado (o corredor recém-andado), e não a zona
//     oculta inteira;
//   - com Alt apertado (ou num modo "Esconder" da mesma ferramenta), o mesmo
//     gesto esconde de volta o que foi pintado;
//   - o jogador nunca recebe o que continua escondido: ficha e nome do que
//     está fora do pedaço pintado não saem no fio (decisão de produto em
//     HANDOFF.md/PEDIDOS.md: o jogador nunca recebe o que a névoa esconde).
//
// ONDE ISSO MORRE HOJE:
//   - `src/types/map.ts:352-358`: `ConcealZone.revealed` é UM booleano da
//     zona inteira — não há onde guardar "só este pedaço está revelado";
//   - `src/lib/fogFilter.ts:58-62` (`activeConcealRings`): a zona ou esconde
//     o polígono todo ou não esconde nada;
//   - `src/components/ConcealZoneControls.tsx:26`: o único gesto de revelar é
//     o interruptor "Revelar para jogadores", da zona toda;
//   - `src/types/tools.ts:1-33` e `src/components/labels.ts:14-40`: nenhuma
//     ferramenta de pintar revelação existe na barra.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-viagem-do-jogador.spec.ts):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   a jogadora Ana é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o WebSocket da jogadora vira o evento
//   `net:message` na página do mestre, e o `net_send` do mestre vira frame no
//   WebSocket dela. A sessão do host é a do app (`net/hostBridge.ts`).
//   DISCO DE MENTIRA COM A CENA PRONTA: uma sala de chão verde-água com uma
//   zona oculta ("Ala leste secreta") cobrindo a metade direita; dentro dela
//   a ficha laranja "Sentinela" (no corredor que será pintado) e a ficha azul
//   "Espiao" (longe do corredor). O mestre abre pelo menu "Carregar Mapa
//   existente", como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE: clique no botão da ferramenta; arrasto de
//   ponteiro no canvas do mestre, em passos, com PAUSA antes de soltar; Alt
//   segurado pelo teclado de verdade. Os únicos `evaluate` são o do transporte
//   (entregar ao mestre o que a jogadora mandou) e a LEITURA de pixel
//   (decodificar a foto num canvas solto e perguntar `elementFromPoint`).
//   PROVA NA TELA: na tela de Ana, a cor lida em caixinhas em pontos do mundo
//   (fora da zona: chão verde-água; dentro dela: preto = escondido, e
//   "revelado" = deixou de ser preto — o chão que cai na zona oculta nem sai
//   para o jogador hoje, `lib/fogFilter.ts:558-568`, e a régua não dita COMO o
//   builder devolve o pedaço pintado, só que ele aparece) e a contagem de pixels
//   laranja (Sentinela) e azul (Espiao) só onde o CANVAS está por cima. O
//   teste 4 também escuta o fio (o que a rota entregou à página de Ana), como
//   `vazamentos` da régua da viagem. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a ferramenta é um botão VISÍVEL no editor (barra de ferramentas) cujo
//     nome acessível contém "Pincel de revelar", "Revelar pintando" ou
//     "Revelar com pincel" (`FERRAMENTA`);
//   - o traço revela pelo menos a faixa por onde o ponteiro passou (±5 px de
//     mundo em volta da linha) e NÃO chega a 150 px de mundo dela: o pincel é
//     um pincel, não a zona inteira;
//   - uma ficha cujo CENTRO está no traço passa a aparecer para o jogador;
//   - esconder de volta = o mesmo arrasto com Alt segurado; OU, se a
//     ferramenta mostrar um controle "Esconder" / "Modo esconder" /
//     "Esconder pintando" / "Pincel de esconder" (botão ou rádio), clicar nele
//     e arrastar sem Alt (`MODO_ESCONDER`). O pedido diz "com Alt ou um modo".
//
// CONTROLE POSITIVO (verde hoje): teste 1. Prova que o disco falso, o
// transporte, as duas câmeras, o classificador de cor e a escuta do fio
// funcionam: Ana vê o chão fora da zona, preto dentro dela, a própria ficha,
// nenhuma das duas fichas escondidas, e o mestre vê a ficha de Ana onde a
// câmera dele diz. Sem ele, o vermelho dos testes 2 a 4 poderia ser a
// infraestrutura quebrada, e não a feature ausente.
//
// NÃO COBERTO DE PROPÓSITO: o que o MESTRE vê do pedaço pintado (o pedido não
// diz a cara, e a régua não dita design); pincel em mapa com névoa por
// visão sem zona oculta; fluidez do arrasto (medida no portão quando a
// ferramenta existir — hoje não há gesto para medir).
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { ConcealZone, MapData, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'PINC11'
const J1 = 'Ana'
const AVENTURA = 'Ala do Pincel'
const ID_CENA = 'scene_ala'
const PASTA = 'C:/appdata/maps/map_ala_pincel'

const TOKEN_J1 = 'Lanterna'
const SENTINELA = 'Sentinela'
const ESPIAO = 'Espiao'
const NOME_DA_ZONA = 'Ala leste secreta'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE // 1000
const ALTURA = LINHAS * GRADE // 600
const TELA = { width: 1280, height: 800 }
/** Margens do "encaixar" de cada tela (PlayerView.tsx:94, PixiCanvas.tsx:800). */
const FIT_MARGIN_JOGADOR = 24
const FIT_MARGIN_MESTRE = 40

const CHAO = '#1e8c8c'
const COR_J1 = '#3cff00'
const COR_SENTINELA = '#ff5a00'
const COR_ESPIAO = '#1e46ff'

type Ponto = { x: number; y: number }

/** Perto da borda da zona: a visão dela (raio 700, hostBridge.ts:137) cobre a zona inteira. */
const POS_J1: Ponto = { x: 420, y: 300 }
/** Zona oculta: metade direita da sala. */
const ZONA_X0 = 500
/** O corredor que o mestre pinta: horizontal, dentro da zona. */
const TRACO_DE: Ponto = { x: 560, y: 450 }
const TRACO_ATE: Ponto = { x: 940, y: 450 }
/** Sentinela com o centro EM CIMA do traço. */
const POS_SENTINELA: Ponto = { x: 800, y: 450 }
/** Espiao dentro da zona, 270 px de mundo acima do traço. */
const POS_ESPIAO: Ponto = { x: 600, y: 180 }

/** Sondas: fora da zona, no traço (longe das fichas), e na zona longe do traço. */
const FORA_DA_ZONA: Ponto = { x: 250, y: 450 }
const NO_TRACO: Ponto[] = [
  { x: 640, y: 450 },
  { x: 700, y: 450 },
  { x: 900, y: 450 },
]
const LONGE_DO_TRACO: Ponto[] = [
  { x: 760, y: 150 },
  { x: 900, y: 250 },
]

/** Botão parado antes de soltar o arrasto. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PASSOS_DO_ARRASTO = 25
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Meia largura da caixinha de cada sonda, em px de tela. */
const MEIA_SONDA = 8
/** Fração de pixels de chão para dizer "chão à vista", de preto para "escondido", e teto de preto para "visível". */
const FRACAO_REVELADO = 0.6
const FRACAO_ESCONDIDO = 0.8
const FRACAO_VISIVEL = 0.2
/** Pixels mínimos para dizer "esta ficha está na tela"; máximos para "não está". */
const PIXELS_DE_TOKEN = 60
const RESIDUO = 25

const FERRAMENTA = /pincel de revelar|revelar pintando|revelar com pincel/i
const MODO_ESCONDER = /^(esconder|modo esconder|esconder pintando|pincel de esconder)$/i

// ───────────────────────────────────────────────────────────────────────────
// A cena no disco: sala verde-água, zona oculta na metade direita
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function montarMapa(): MapData {
  const base = createEmptyMap('map_ala_pincel', AVENTURA, COLUNAS, LINHAS, GRADE)
  const zona: ConcealZone = {
    id: 'zona-ala-leste',
    name: NOME_DA_ZONA,
    revealed: false,
    points: [
      { x: ZONA_X0, y: 20 },
      { x: 980, y: 20 },
      { x: 980, y: 580 },
      { x: ZONA_X0, y: 580 },
    ],
  }
  return {
    ...base,
    // Duas peças de chão, uma de cada lado da borda da zona: peça com a maioria
    // das amostras na zona não sai para o jogador (fogFilter.ts:558-568), e uma
    // peça só cobrindo tudo sumia inteira — o controle ficava sem chão à vista.
    floor: [
      { id: 'chao-oeste', shape: { kind: 'rect', cx: (10 + ZONA_X0) / 2, cy: ALTURA / 2, w: ZONA_X0 - 10, h: ALTURA - 20 }, op: 'add', modifiers: {} },
      { id: 'chao-leste', shape: { kind: 'rect', cx: (ZONA_X0 + LARGURA - 10) / 2, cy: ALTURA / 2, w: LARGURA - 10 - ZONA_X0, h: ALTURA - 20 }, op: 'add', modifiers: {} },
    ],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    // Contorno do mundo: o enquadramento de abertura do editor vira o mundo inteiro (contentBounds não conta chão).
    walls: [
      parede('w-n', 10, 10, LARGURA - 10, 10),
      parede('w-l', LARGURA - 10, 10, LARGURA - 10, ALTURA - 10),
      parede('w-s', LARGURA - 10, ALTURA - 10, 10, ALTURA - 10),
      parede('w-o', 10, ALTURA - 10, 10, 10),
    ],
    tokens: [
      token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1),
      token('tok-sentinela', SENTINELA, POS_SENTINELA, COR_SENTINELA),
      token('tok-espiao', ESPIAO, POS_ESPIAO, COR_ESPIAO),
    ],
    concealZones: [zona],
  }
}

const MAPA = montarMapa()

function discoDaCena(): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_ala_pincel',
    name: AVENTURA,
    startSceneId: ID_CENA,
    scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(MAPA),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// (cópia do preparo de task-jornada-viagem-do-jogador.spec.ts)
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

/** O "Rust" de mentira: liga o WebSocket da jogadora ao `net:*` do mestre, nos dois sentidos. */
interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Tudo que o mestre mandou para cada jogador, em ordem (o que o fio entregou). */
  enviados: Map<string, string[]>
  fila: Promise<void>
}

async function mestreAbreCena(mestre: Page): Promise<Rede> {
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
    { arquivos: discoDaCena(), codigo: CODIGO },
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
// A jogadora: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  /** Todo frame que a PÁGINA recebeu no WebSocket (a rota só anota, nunca muda). */
  frames: string[]
}

/** Contextos de jogador abertos pelo teste que está rodando: o Playwright não os fecha sozinho. */
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
  return { page, clientId, frames }
}

/** Mestre abre a cena e a sala; Ana entra, recebe a Lanterna e o mapa aparece na tela dela. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<{ rede: Rede; ana: Jogador }> {
  const rede = await mestreAbreCena(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await expect(ana.page.locator('canvas').first(), `${J1}: o mapa não apareceu`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(ana.page, [])).limao, { timeout: ESPERA_TELA, message: `${J1}: a própria ficha não foi pintada` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  return { rede, ana }
}

// ───────────────────────────────────────────────────────────────────────────
// Câmeras e leitura de tela
// ───────────────────────────────────────────────────────────────────────────

const CAMERA_JOGADOR = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN_JOGADOR)

function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.x), y: Math.round(p.y * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.y) }
}

/** Mundo → tela do mestre, com o enquadramento de abertura da cena (conteúdo, margem 40). */
async function cameraDoMestre(mestre: Page): Promise<(p: Ponto) => Ponto> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(MAPA)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return (p) => ({ x: Math.round(caixa.x + p.x * c.scale + c.x), y: Math.round(caixa.y + p.y * c.scale + c.y) })
}

interface Caixa {
  nome: string
  centro: Ponto
}

interface Contagem {
  chao: number
  preto: number
  total: number
}

interface Tela {
  limao: number
  laranja: number
  azul: number
  /** Por caixinha (nome → contagem), só pixels onde o CANVAS está por cima. */
  caixas: Record<string, Contagem>
}

/**
 * Fotografa a página e conta pixels por cor, só onde o CANVAS está por cima
 * (painéis e cartões não contam): fichas na tela inteira, chão e preto em cada
 * caixinha. Leitura pura: decodifica a foto num canvas solto e pergunta
 * `elementFromPoint`.
 */
async function lerTela(page: Page, caixas: Caixa[]): Promise<Tela> {
  let foto: Awaited<ReturnType<Page['screenshot']>> | null = null
  for (let tentativa = 1; tentativa <= 3 && foto === null; tentativa += 1) {
    try {
      foto = await page.screenshot()
    } catch {
      await page.waitForTimeout(200)
    }
  }
  if (foto === null) throw new Error('não consegui fotografar a tela')
  return page.evaluate(
    async ({ b64, caixas, meia }) => {
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
      const cor = (x: number, y: number): [number, number, number] => {
        const i = (y * width + x) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      const r = { limao: 0, laranja: 0, azul: 0, caixas: {} as Record<string, { chao: number; preto: number; total: number }> }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const [R, G, B] = cor(x, y)
          const limao = G > 200 && R > 20 && R < 120 && B < 60
          const laranja = R > 200 && G > 50 && G < 140 && B < 60
          const azul = B > 200 && R < 80 && G < 120
          if (!limao && !laranja && !azul) continue
          if (!canvasPorCima(x, y)) continue
          if (limao) r.limao += 1
          else if (laranja) r.laranja += 1
          else r.azul += 1
        }
      }
      for (const caixa of caixas) {
        const c = { chao: 0, preto: 0, total: 0 }
        const cx = Math.round(caixa.centro.x / escalaX)
        const cy = Math.round(caixa.centro.y / escalaY)
        for (let y = Math.max(0, cy - meia); y <= Math.min(height - 1, cy + meia); y += 1) {
          for (let x = Math.max(0, cx - meia); x <= Math.min(width - 1, cx + meia); x += 1) {
            if (!canvasPorCima(x, y)) continue
            const [R, G, B] = cor(x, y)
            c.total += 1
            if (G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 60) c.chao += 1
            else if (R < 20 && G < 20 && B < 20) c.preto += 1
          }
        }
        r.caixas[caixa.nome] = c
      }
      return r
    },
    { b64: foto.toString('base64'), caixas, meia: MEIA_SONDA },
  )
}

const SONDAS: Caixa[] = [
  { nome: 'fora da zona', centro: naTelaDoJogador(FORA_DA_ZONA) },
  ...NO_TRACO.map((p, i) => ({ nome: `no traço ${i + 1} (${p.x},${p.y})`, centro: naTelaDoJogador(p) })),
  ...LONGE_DO_TRACO.map((p, i) => ({ nome: `longe do traço ${i + 1} (${p.x},${p.y})`, centro: naTelaDoJogador(p) })),
]
const NOMES_NO_TRACO = SONDAS.filter((s) => s.nome.startsWith('no traço')).map((s) => s.nome)
const NOMES_LONGE = SONDAS.filter((s) => s.nome.startsWith('longe do traço')).map((s) => s.nome)

const revelado = (c: Contagem | undefined): boolean => c !== undefined && c.total > 0 && c.chao / c.total >= FRACAO_REVELADO
const escondido = (c: Contagem | undefined): boolean => c !== undefined && c.total > 0 && c.preto / c.total >= FRACAO_ESCONDIDO
/** Dentro da zona: o pedaço deixou de ser preto na tela do jogador. */
const visivel = (c: Contagem | undefined): boolean => c !== undefined && c.total > 0 && c.preto / c.total <= FRACAO_VISIVEL

/** Descreve cada sonda como "chão à vista", "escondido", "visível" ou a contagem crua, para a mensagem de falha. */
function retrato(tela: Tela, nomes: string[]): string {
  return nomes
    .map((n) => {
      const c = tela.caixas[n]
      const cru = `chão ${c?.chao ?? 0}/preto ${c?.preto ?? 0}/total ${c?.total ?? 0}`
      const estado = revelado(c) ? 'chão à vista' : escondido(c) ? 'escondido' : visivel(c) ? `visível (${cru})` : cru
      return `${n}: ${estado}`
    })
    .join('; ')
}

async function telaDeAna(ana: Jogador): Promise<Tela> {
  await ana.page.waitForTimeout(PINTURA_MS)
  return lerTela(ana.page, SONDAS)
}

// ───────────────────────────────────────────────────────────────────────────
// O gesto do mestre: ferramenta na mão e arrasto pelo corredor
// ───────────────────────────────────────────────────────────────────────────

async function mestrePegaOPincel(mestre: Page): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  const ferramenta = mestre.getByRole('button', { name: FERRAMENTA }).first()
  await expect(
    ferramenta,
    'o editor deveria ter uma ferramenta "Pincel de revelar" (ou "Revelar pintando") visível; hoje revelar é só o interruptor da zona inteira (ConcealZoneControls.tsx:26)',
  ).toBeVisible({ timeout: ESPERA })
  await ferramenta.click()
  return ferramenta
}

/** Desce no começo do corredor, anda em passos, PARA um instante e solta. Com `alt`, segura Alt no teclado o gesto todo. */
async function mestrePinta(mestre: Page, alt: boolean): Promise<void> {
  const paraTela = await cameraDoMestre(mestre)
  const de = paraTela(TRACO_DE)
  const ate = paraTela(TRACO_ATE)
  for (const p of [de, ate]) {
    const quem = await mestre.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', p)
    expect(quem, `régua: o ponto (${p.x}, ${p.y}) do arrasto não está sobre o mapa do mestre, está sobre ${quem}`).toBe('CANVAS')
  }
  await mestre.mouse.move(de.x, de.y)
  if (alt) await mestre.keyboard.down('Alt')
  await mestre.mouse.down()
  await mestre.mouse.move(ate.x, ate.y, { steps: PASSOS_DO_ARRASTO })
  await mestre.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await mestre.mouse.up()
  if (alt) await mestre.keyboard.up('Alt')
}

/** Esconder de volta: controle "Esconder" da ferramenta, se ela mostrar um; senão, o mesmo arrasto com Alt. */
async function mestreEscondeDeVolta(mestre: Page): Promise<void> {
  const modo = mestre.getByRole('button', { name: MODO_ESCONDER }).or(mestre.getByRole('radio', { name: MODO_ESCONDER })).first()
  const temModo = await modo.isVisible().catch(() => false)
  if (temModo) {
    await modo.click()
    await mestrePinta(mestre, false)
  } else {
    await mestrePinta(mestre, true)
  }
}

/** Espera Ana ver o corredor revelado e a Sentinela; devolve a última leitura. */
async function anaVeOCorredor(ana: Jogador, oQue: string): Promise<Tela> {
  let ultima: Tela | null = null
  await expect
    .poll(
      async () => {
        ultima = await telaDeAna(ana)
        return NOMES_NO_TRACO.every((n) => visivel(ultima?.caixas[n])) && ultima.laranja > PIXELS_DE_TOKEN
      },
      { timeout: ESPERA_TELA, message: `${oQue}` },
    )
    .toBe(true)
  if (ultima === null) throw new Error('régua: nenhuma leitura da tela de Ana')
  return ultima
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana vê o chão fora da zona, preto dentro dela, a própria ficha e nenhuma das escondidas; o mestre vê a ficha dela onde a câmera diz', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { rede, ana } = await mesaMontada(browser, page, baseURL ?? '')

  const tela = await telaDeAna(ana)
  for (const sonda of SONDAS) expect(tela.caixas[sonda.nome]?.total ?? 0, `régua: a sonda "${sonda.nome}" não caiu sobre o canvas de ${J1}`).toBeGreaterThan(0)
  expect(revelado(tela.caixas['fora da zona']), `fora da zona ${J1} deveria ver o chão: ${retrato(tela, ['fora da zona'])}`).toBe(true)
  const naZona = [...NOMES_NO_TRACO, ...NOMES_LONGE]
  expect(naZona.every((n) => escondido(tela.caixas[n])), `a zona oculta inteira deveria estar preta para ${J1}: ${retrato(tela, naZona)}`).toBe(true)
  expect(tela.limao, `${J1} deveria ver a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(tela.laranja, `${J1} não deveria ver a ${SENTINELA}, que está na zona oculta`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.azul, `${J1} não deveria ver o ${ESPIAO}, que está na zona oculta`).toBeLessThanOrEqual(RESIDUO)

  // A escuta do fio não é surda, e hoje nada escondido vaza.
  const frames = rede.enviados.get(ana.clientId) ?? []
  expect(frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J1} não viu nenhum snapshot`).toBe(true)
  expect(frames.filter((f) => f.includes(ESPIAO) || f.includes(SENTINELA) || f.includes(NOME_DA_ZONA)), 'com a zona inteira oculta, nada dela deveria ter ido a Ana').toEqual([])

  // Câmera do mestre: a Lanterna aparece onde o enquadramento de abertura diz.
  const paraTela = await cameraDoMestre(page)
  const alvo = paraTela(POS_J1)
  await page.waitForTimeout(PINTURA_MS)
  const quem = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', alvo)
  expect(quem, 'régua: a ficha de Ana na câmera do mestre não cai sobre o canvas').toBe('CANVAS')
  const pertoDaFicha = await lerTelaLimaoPerto(page, alvo)
  expect(pertoDaFicha, `a ficha de Ana deveria estar em (${alvo.x}, ${alvo.y}) na tela do mestre`).toBeGreaterThan(PIXELS_DE_TOKEN / 2)
})

/** Pixels verde-limão numa caixa de ±20 px em volta de `alvo`, só onde o canvas está por cima. */
async function lerTelaLimaoPerto(page: Page, alvo: Ponto): Promise<number> {
  const foto = await page.screenshot({ clip: { x: alvo.x - 20, y: alvo.y - 20, width: 40, height: 40 } })
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const tela = document.createElement('canvas')
    tela.width = bmp.width
    tela.height = bmp.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    ctx.drawImage(bmp, 0, 0)
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height)
    let n = 0
    for (let i = 0; i < data.length; i += 4) if (data[i + 1] > 200 && data[i] > 20 && data[i] < 120 && data[i + 2] < 60) n += 1
    return n
  }, foto.toString('base64'))
}

test('2. revelar pintando: o mestre arrasta o pincel pelo corredor e Ana passa a ver só o corredor e a Sentinela nele; o resto da zona continua preto', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await mestrePegaOPincel(page)
  await mestrePinta(page, false)

  const tela = await anaVeOCorredor(ana, `depois do arrasto do pincel pelo corredor, ${J1} deveria ver o chão do corredor e a ${SENTINELA} em cima dele`)
  expect(NOMES_LONGE.every((n) => escondido(tela.caixas[n])), `o pincel revela só o pedaço pintado, não a zona inteira: ${retrato(tela, NOMES_LONGE)}`).toBe(true)
  expect(tela.azul, `o ${ESPIAO} está longe do corredor e não deveria aparecer para ${J1}`).toBeLessThanOrEqual(RESIDUO)
})

test('3. esconder de volta: com Alt (ou o modo Esconder) o mesmo arrasto apaga o corredor da tela de Ana e a Sentinela some', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await mestrePegaOPincel(page)
  await mestrePinta(page, false)
  await anaVeOCorredor(ana, `antes de esconder, o pincel deveria ter revelado o corredor para ${J1}`)

  await mestreEscondeDeVolta(page)

  let ultima: Tela | null = null
  await expect
    .poll(
      async () => {
        ultima = await telaDeAna(ana)
        return NOMES_NO_TRACO.every((n) => escondido(ultima?.caixas[n])) && ultima.laranja <= RESIDUO
      },
      {
        timeout: ESPERA_TELA,
        message: `esconder de volta deveria deixar o corredor preto e tirar a ${SENTINELA} da tela de ${J1}`,
      },
    )
    .toBe(true)
  const tela = ultima as Tela | null
  if (tela !== null) expect(revelado(tela.caixas['fora da zona']), `esconder o corredor não pode apagar o chão fora da zona: ${retrato(tela, ['fora da zona'])}`).toBe(true)
})

test('4. nada vaza: depois de pintar o corredor, o fio de Ana traz a Sentinela mas nunca o Espiao nem o nome da zona', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { rede, ana } = await mesaMontada(browser, page, baseURL ?? '')
  const frames = rede.enviados.get(ana.clientId) ?? []

  await mestrePegaOPincel(page)
  const antes = frames.length
  await mestrePinta(page, false)
  await anaVeOCorredor(ana, `o pincel deveria ter revelado o corredor para ${J1}`)
  await rede.fila

  const depois = frames.slice(antes)
  expect(depois.some((f) => f.includes(SENTINELA)), `a ${SENTINELA} está no corredor pintado e deveria ter ido a ${J1}`).toBe(true)
  expect(
    frames.filter((f) => f.includes(ESPIAO) || f.includes('tok-espiao') || f.includes(NOME_DA_ZONA)),
    `o ${ESPIAO} e o nome da zona continuam escondidos e não podem sair no fio de ${J1}`,
  ).toEqual([])
})
