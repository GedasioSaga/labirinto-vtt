// JORNADA DE USUÁRIO de SEGUIR JOGADOR (G7) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G7):
//   - na linha do jogador na seção "Grupo" (aba Jogo) há um botão "Seguir",
//     alternável (`aria-pressed`);
//   - seguindo, a câmera do editor mantém a ficha do jogador no centro quando
//     ela se move (o jogador anda na tela dele); se o jogador viaja para outra
//     cena, o editor troca para a cena nova e continua centrado na ficha;
//   - o mestre mexer no mapa (arrastar a vista, roda do mouse, "Ir lá" de outro
//     jogador) desliga o seguir: o botão volta a `aria-pressed=false`;
//   - um jogador seguido por vez: ligar "Seguir" em outro desliga o anterior.
//
// ONDE ISSO MORRE HOJE: a linha do Grupo (`components/PartySection.tsx`) só
// tem "Ir lá" (centra UMA vez, `adventureStore.goToPoint`) e "Mandar para…".
// Não há "Seguir", nem nada que mova a câmera do editor quando a ficha anda.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-painel-do-grupo.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana e Bruno são o `player.html` inteiro, cada um no próprio contexto de
//   navegador. Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo
//   WebSocket roteado vira `net:message` no mestre (com `JSON.parse` do que
//   chegou), e o `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA: Salão e Cripta num `adventure.json`, aberto pelo menu.
//   Ana e Bruno têm ficha no Salão, atribuída pelo gesto "Atribuir <ficha>".
//   GESTO REAL NA AÇÃO SOB TESTE: cliques em "Ir lá" e "Seguir"; Ana ARRASTA a
//   própria ficha na tela dela (desce, anda em passos, para, solta); a viagem
//   é o toque no pino + "Pedir para passar" + "Deixar ir" do mestre; a roda do
//   mouse é `mouse.wheel` sobre o canvas do editor. Os únicos `evaluate` são o
//   do transporte e a LEITURA de pixel.
//   PROVA NA TELA: `aria-pressed` e nome acessível; a ficha de Ana pela cor
//   (verde-limão) e a de Bruno (laranja) no canvas do mestre; a cena pela cor
//   do chão (Salão verde-água, Cripta magenta). Nada é lido da store.
//   "A FICHA ANDOU NO MESTRE" sem saber a escala da câmera: a razão entre a
//   distância Ana–Bruno na tela do mestre antes e depois do arrasto tem de
//   bater com a razão das distâncias de mundo (±20%). Assim a câmera que não
//   acompanha e a mensagem que não chegou não se confundem.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão da linha tem nome acessível começando por "Seguir" ("Seguir",
//     "Seguir Ana") e o mesmo nome ligado ou desligado; o estado vai em
//     `aria-pressed`;
//   - "perto do centro" = a ficha a menos de 15% do menor lado do canvas do
//     editor, a partir do centro do canvas inteiro OU do centro da parte que
//     o painel não cobre (mesma régua do "Ir lá" em painel-do-grupo);
//   - a roda do mouse sem Ctrl sobre o editor desloca a vista (hoje: PAN,
//     `pixi/wheelGesture.ts`), e isso conta como "mexer no mapa".
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 5 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'SEGUE1'
const J1 = 'Ana'
const J2 = 'Bruno'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'
const ESCADA_A = 'Escada que desce'
const ESCADA_B = 'Escada que sobe'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

// As duas cenas têm o MESMO tamanho: "encaixar a cena na tela" dá a mesma câmera nas duas.
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
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'

type Ponto = { x: number; y: number }

/**
 * Ana começa LONGE do meio do mundo (1000, 300): no enquadramento de abertura
 * (o editor encaixa o contorno de paredes = o mundo inteiro) ela fica a ~500
 * px de mundo do centro, e só um "Ir lá" (ou o seguir) a põe no meio da tela
 * do mestre. Colunas 0-8 ficam sob o painel do jogador.
 */
const POS_J1: Ponto = { x: 1500, y: 300 }
/**
 * Bruno fica PERTO de Ana (a régua mede a ficha de Ana contra a dele, e ele
 * tem de continuar na tela do mestre com a câmera centrada em Ana) e fora do
 * caminho dos arrastos.
 */
const POS_J2: Ponto = { x: 1600, y: 150 }
/**
 * Dez casas para a ESQUERDA (testes 1 e 2). Para a esquerda porque o centro
 * da parte visível do canvas fica à direita do centro do canvas (o painel
 * cobre a esquerda): andar para a direita levaria a ficha, sem seguir, para
 * perto do centro visível (medido em 22/09: 57 px, limite 120). Dez e não
 * seis: desde a G6 o "Ir lá" centra na área LIVRE, e seis casas a partir de
 * lá deixavam a ficha a 64 px do centro do CANVAS — o controle do teste 1
 * lia "no centro" sem ninguém seguir (medido pelo builder da G7 em 22/09).
 */
const POS_J1_ANDOU: Ponto = { x: POS_J1.x - 10 * GRADE, y: POS_J1.y }
/** Dez casas para a esquerda (teste 4). */
const POS_J1_VOLTOU: Ponto = { x: POS_J1.x - 10 * GRADE, y: POS_J1.y }
const POS_ESCADA_A: Ponto = { x: 1300, y: 480 }
/**
 * Pino par LONGE do meio da Cripta e longe de onde Ana estava no Salão: o
 * editor que só troca de cena (encaixando ou mantendo a câmera velha) deixa a
 * ficha dela a centenas de px do centro, e não passa por acaso.
 */
const POS_ESCADA_B: Ponto = { x: 550, y: 450 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL na tela do jogador. */
const ESPERA_TELA = 15_000
/** A leitura da tela do MESTRE custa mais (foto ~2 s + contagem 5-7 s, medido em 22/09 em painel-do-grupo). */
const ESPERA_TELA_MESTRE = 25_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31
/** Roda do mouse (px de roda) sobre o mapa: pouca, e para cima, para as fichas não irem para baixo da barra de ferramentas. */
const RODA = -150

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** "Perto do centro": fração do menor lado da área visível do canvas. */
const PERTO_DO_CENTRO = 0.15
/** Folga da razão de distâncias Ana–Bruno (tela do mestre × mundo). */
const FOLGA_DA_RAZAO = 0.2

const GRUPO = 'Grupo'
const IR_LA = 'Ir lá'
const SEGUIR = /^Seguir\b/
const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

/**
 * Quatro paredes no contorno do mundo: o enquadramento de abertura do editor
 * (que encaixa o CONTEÚDO, não o chão) vira o mundo inteiro. Sem isso o
 * editor abre a Cripta com zoom no único pino dela — em cima de onde Ana
 * chega — e "só trocar de cena" passaria por seguir.
 */
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

function discoDaAventura(): Record<string, string> {
  const cenaA = cena(
    'map_vale',
    AVENTURA,
    CHAO_A,
    [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1), token('tok-machado', TOKEN_J2, POS_J2, COR_J2)],
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

function painelJogo(mestre: Page): Locator {
  return mestre.locator('#lb-rail-panel-room')
}

/** Card de hoje em "Jogadores" (o que existe antes do G1). */
function cardDeJogador(mestre: Page, jogador: string): Locator {
  return painelJogo(mestre).locator('.lb-field').filter({ hasText: `${jogador} —` })
}

/** Aba Jogo, card do jogador, "Atribuir <token>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page, jogador: string, nomeDoToken: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = cardDeJogador(mestre, jogador)
  await card.getByRole('button', { name: `Atribuir ${nomeDoToken}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${nomeDoToken}` }), `${jogador} deveria ficar com ${nomeDoToken}`).toBeVisible()
}

/**
 * A seção "Grupo" da aba Jogo. Aceita as duas formas que o app já usa: um
 * cabeçalho-botão com `aria-controls` (como "Cenas"), aberto se estiver
 * fechado, ou uma região/lista/grupo com nome acessível "Grupo".
 */
async function secaoGrupo(mestre: Page): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = painelJogo(mestre)
  await expect(painel.getByRole('button', { name: 'Fechar sala' }).or(painel.getByText(CODIGO)).first(), 'a aba Jogo deveria estar aberta, com a sala').toBeVisible({ timeout: ESPERA })
  const cabecalho = painel.getByRole('button', { name: GRUPO, exact: true })
  if ((await cabecalho.count()) > 0) {
    if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
    const corpo = await cabecalho.getAttribute('aria-controls')
    if (corpo) return mestre.locator(`[id="${corpo}"]`)
  }
  const secao = painel
    .getByRole('region', { name: GRUPO, exact: true })
    .or(painel.getByRole('list', { name: GRUPO, exact: true }))
    .or(painel.getByRole('group', { name: GRUPO, exact: true }))
    .or(painel.getByRole('table', { name: GRUPO, exact: true }))
    .first()
  await expect(secao, `a aba Jogo deveria ter uma seção "${GRUPO}" (cabeçalho "${GRUPO}" ou região/lista com esse nome)`).toBeVisible({ timeout: ESPERA })
  return secao
}

function linhasDoGrupo(secao: Locator): Locator {
  return secao.getByRole('listitem').or(secao.getByRole('row'))
}

/** A linha de um jogador na seção "Grupo". */
async function linhaDoGrupo(mestre: Page, jogador: string): Promise<Locator> {
  const secao = await secaoGrupo(mestre)
  const linha = linhasDoGrupo(secao).filter({ hasText: jogador })
  await expect(linha, `a seção "${GRUPO}" deveria ter UMA linha de ${jogador}`).toHaveCount(1, { timeout: ESPERA })
  return linha
}

/** Um botão da linha do jogador no Grupo, visível. */
async function botaoDaLinha(mestre: Page, jogador: string, nome: string | RegExp, rotulo: string): Promise<Locator> {
  const linha = await linhaDoGrupo(mestre, jogador)
  const botao = linha.getByRole('button', { name: nome })
  await expect(botao, `a linha de ${jogador} no "${GRUPO}" deveria ter o botão "${rotulo}"`).toBeVisible({ timeout: ESPERA })
  return botao
}
// ───────────────────────────────────────────────────────────────────────────
// Os jogadores: player.html inteiro, cada um no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  /** Todo frame que a PÁGINA recebeu no WebSocket, desde antes de entrar (a escuta é a própria rota). */
  frames: string[]
}

/** Contextos de jogador abertos pelo teste que está rodando: fechados no afterEach. */
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
  return { page, clientId, nome, frames }
}

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
}

/** Mestre abre a aventura e a sala; Ana e Bruno entram e recebem a ficha no Salão. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await esperaFichaPropria(ana, 'limao')
  await esperaFichaPropria(bruno, 'laranja')
  return { rede, ana, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela (jogador e mestre)
// ───────────────────────────────────────────────────────────────────────────

type CorDeFicha = 'limao' | 'laranja'

interface Ficha {
  pixels: number
  /** Centro da mancha da cor, em px CSS da página; `null` sem mancha. */
  centro: Ponto | null
}

interface Tela {
  fichas: Record<CorDeFicha, Ficha>
  chaoA: number
  chaoB: number
  /** Centro do retângulo do canvas principal, em px CSS. */
  centroDoCanvas: Ponto | null
  /** Centro da parte do canvas principal que nenhum painel cobre, em px CSS. */
  centroVisivel: Ponto | null
  /** Menor lado do retângulo do canvas principal, em px CSS. */
  ladoDoCanvas: number
}

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function fotografar(page: Page): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot()
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error('régua: não consegui fotografar a tela')
}

/**
 * Fotografa a página e conta pixels por cor, só onde o canvas PRINCIPAL (o
 * maior) está por cima — painéis, cartões e o minimapa não contam. Leitura
 * pura: decodifica a foto num canvas solto e pergunta `elementFromPoint`.
 */
async function lerTela(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  const foto = await fotografar(page)
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
    let principal: Element | null = null
    let maiorArea = 0
    for (const c of Array.from(document.querySelectorAll('canvas'))) {
      const r = c.getBoundingClientRect()
      if (r.width * r.height > maiorArea) {
        maiorArea = r.width * r.height
        principal = c
      }
    }
    const BLOCO = 16
    const colunas = Math.ceil(window.innerWidth / BLOCO)
    const linhas = Math.ceil(window.innerHeight / BLOCO)
    const cobertura = new Uint8Array(colunas * linhas) // 0 = não perguntado, 1 = canvas, 2 = outra coisa
    const blocoNoCanvas = (bx: number, by: number): boolean => {
      const k = by * colunas + bx
      if (cobertura[k] === 0) {
        const topo = document.elementFromPoint(bx * BLOCO + BLOCO / 2, by * BLOCO + BLOCO / 2)
        cobertura[k] = principal !== null && topo === principal ? 1 : 2
      }
      return cobertura[k] === 1
    }
    const canvasPorCima = (x: number, y: number): boolean => {
      const bx = Math.min(colunas - 1, Math.floor((x * escalaX) / BLOCO))
      const by = Math.min(linhas - 1, Math.floor((y * escalaY) / BLOCO))
      return blocoNoCanvas(bx, by)
    }
    const soma = { limao: { n: 0, x: 0, y: 0 }, laranja: { n: 0, x: 0, y: 0 } }
    let chaoA = 0
    let chaoB = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!limao && !laranja && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (limao || laranja) {
          const s = limao ? soma.limao : soma.laranja
          s.n += 1
          s.x += x
          s.y += y
        } else if (verdeAgua) chaoA += 1
        else chaoB += 1
      }
    }
    const ficha = (s: { n: number; x: number; y: number }) => ({
      pixels: s.n,
      centro: s.n > 0 ? { x: (s.x / s.n) * escalaX, y: (s.y / s.n) * escalaY } : null,
    })
    let centroDoCanvas: { x: number; y: number } | null = null
    let centroVisivel: { x: number; y: number } | null = null
    let ladoDoCanvas = 0
    if (principal !== null) {
      const caixa = principal.getBoundingClientRect()
      centroDoCanvas = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 }
      ladoDoCanvas = Math.min(caixa.width, caixa.height)
      let sx = 0
      let sy = 0
      let n = 0
      for (let by = 0; by < linhas; by += 1) {
        for (let bx = 0; bx < colunas; bx += 1) {
          if (!blocoNoCanvas(bx, by)) continue
          sx += bx * BLOCO + BLOCO / 2
          sy += by * BLOCO + BLOCO / 2
          n += 1
        }
      }
      if (n > 0) centroVisivel = { x: sx / n, y: sy / n }
    }
    return { fichas: { limao: ficha(soma.limao), laranja: ficha(soma.laranja) }, chaoA, chaoB, centroDoCanvas, centroVisivel, ladoDoCanvas }
  }, foto.toString('base64'))
}

/** Espera o mapa chegar e a ficha do próprio jogador aparecer pintada. */
async function esperaFichaPropria(j: Jogador, cor: CorDeFicha): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(j.page)).fichas[cor].pixels, { timeout: ESPERA_TELA, message: `${j.nome} deveria ver a própria ficha na tela` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

const escrever = (p: Ponto | null): string => (p === null ? 'sem ficha' : `(${Math.round(p.x)}, ${Math.round(p.y)})`)

/** Distância da ficha de Ana ao centro da tela do mestre (o menor dos dois centros); `Infinity` sem ficha. */
function distanciaAoCentro(tela: Tela): number {
  const ficha = tela.fichas.limao.centro
  const centros = [tela.centroDoCanvas, tela.centroVisivel].filter((c): c is Ponto => c !== null)
  if (ficha === null || centros.length === 0) return Number.POSITIVE_INFINITY
  return Math.min(...centros.map((c) => Math.hypot(ficha.x - c.x, ficha.y - c.y)))
}

function limiteDoCentro(tela: Tela): number {
  return tela.ladoDoCanvas * PERTO_DO_CENTRO
}

function pertoDoCentro(tela: Tela): boolean {
  return tela.fichas.limao.pixels > PIXELS_DE_TOKEN && distanciaAoCentro(tela) < limiteDoCentro(tela)
}

function descreverCentro(tela: Tela): string {
  return `ficha de ${J1} em ${escrever(tela.fichas.limao.centro)}, centro do canvas ${escrever(tela.centroDoCanvas)}, centro visível ${escrever(tela.centroVisivel)}, limite ${Math.round(limiteDoCentro(tela))} px`
}

/** Distância Ana–Bruno na tela do mestre; `null` se uma das duas não está pintada. */
function distanciaAnaBruno(tela: Tela): number | null {
  const a = tela.fichas.limao.centro
  const b = tela.fichas.laranja.centro
  if (a === null || b === null || tela.fichas.limao.pixels <= PIXELS_DE_TOKEN || tela.fichas.laranja.pixels <= PIXELS_DE_TOKEN) return null
  return Math.hypot(a.x - b.x, a.y - b.y)
}

const distanciaDeMundo = (a: Ponto, b: Ponto): number => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * A ficha de Ana chegou a `para` NA TELA DO MESTRE, qualquer que seja a
 * câmera: a razão das distâncias Ana–Bruno (tela depois / tela antes) bate
 * com a do mundo (ida / volta de Ana em relação a Bruno).
 */
function anaChegouNoMestre(antes: number, tela: Tela, de: Ponto, para: Ponto): boolean {
  const depois = distanciaAnaBruno(tela)
  if (depois === null) return false
  const esperada = distanciaDeMundo(para, POS_J2) / distanciaDeMundo(de, POS_J2)
  return Math.abs(depois / antes - esperada) <= esperada * FOLGA_DA_RAZAO
}

/** Câmera de "encaixar a cena" do jogador: mundo inteiro. */
const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

function cabecaDoPino(p: Ponto): Ponto {
  return naTelaDoJogador({ x: p.x, y: p.y - CABECA_DO_PINO })
}

async function tocar(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/**
 * Ana ARRASTA a própria ficha na tela dela, de `de` para `para` (mundo): desce
 * no centro da ficha que ela VÊ, anda em passos, para um instante e solta.
 * Controle: a ficha dela chega lá na tela dela.
 */
async function anaArrasta(ana: Jogador, de: Ponto, para: Ponto): Promise<void> {
  const vista = (await lerTela(ana.page)).fichas.limao.centro
  expect(vista, `${J1} deveria ver a própria ficha antes de arrastar`).not.toBeNull()
  const origem = vista ?? naTelaDoJogador(de)
  const esperadoOrigem = naTelaDoJogador(de)
  expect(Math.hypot(origem.x - esperadoOrigem.x, origem.y - esperadoOrigem.y), `régua: a ficha de ${J1} não está onde a câmera do jogador diz (${escrever(origem)})`).toBeLessThan(20)
  const destino = { x: origem.x + (para.x - de.x) * CAMERA.scale, y: origem.y + (para.y - de.y) * CAMERA.scale }
  const quem = await ana.page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', destino)
  expect(quem, `régua: o destino do arrasto ${escrever(destino)} não está sobre o mapa de ${J1}, está sobre ${quem}`).toBe('CANVAS')
  await ana.page.mouse.move(origem.x, origem.y)
  await ana.page.mouse.down()
  await ana.page.mouse.move(destino.x, destino.y, { steps: 20 })
  await ana.page.waitForTimeout(TOQUE_MS)
  await ana.page.mouse.up()
  await expect
    .poll(
      async () => {
        const c = (await lerTela(ana.page)).fichas.limao.centro
        return c === null ? Number.POSITIVE_INFINITY : Math.hypot(c.x - destino.x, c.y - destino.y)
      },
      { timeout: ESPERA_TELA, message: `${J1} arrastou a própria ficha e ela não ficou onde soltou, na tela dela` },
    )
    .toBeLessThan(20)
}

/** Pino de viagem → "Pedir para passar" → confirmar → o mestre "Deixar ir" → o jogador chega à Cripta. */
async function viagemAprovada(mestre: Page, j: Jogador): Promise<void> {
  await tocar(j.page, cabecaDoPino(POS_ESCADA_A))
  await expect(j.page.getByRole('dialog').filter({ hasText: ESCADA_A }), `${j.nome}: tocar o pino deveria abrir o cartão "${ESCADA_A}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: PEDIR_PARA_PASSAR }).click()
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${j.nome}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR }).first().click()
  await expect(j.page.getByText(AGUARDANDO).first(), `${j.nome}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
  const aviso = new RegExp(`${j.nome}[^]*quer passar[^]*${escapar(ESCADA_A)}[^]*${escapar(CENA_B)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${j.nome} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await mestre.getByRole('button', { name: 'Deixar ir', exact: true }).click()
  await expect(j.page.getByText(VOCE_CHEGOU).first(), `${j.nome} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await lerTela(j.page)).chaoB, { timeout: ESPERA_TELA, message: `${j.nome} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

// ───────────────────────────────────────────────────────────────────────────
// O gesto sob teste: "Seguir" na linha do Grupo
// ───────────────────────────────────────────────────────────────────────────

/** O botão "Seguir" da linha do jogador (visível; a aba Jogo fica aberta). */
async function botaoSeguir(mestre: Page, jogador: string): Promise<Locator> {
  return botaoDaLinha(mestre, jogador, SEGUIR, 'Seguir')
}

/** Clica "Seguir" na linha do jogador e confere que ficou pressionado. */
async function mestreSegue(mestre: Page, jogador: string): Promise<Locator> {
  const seguir = await botaoSeguir(mestre, jogador)
  await seguir.click()
  await expect(seguir, `clicar "Seguir" na linha de ${jogador} deveria deixá-lo pressionado (aria-pressed=true)`).toHaveAttribute('aria-pressed', 'true', { timeout: ESPERA })
  return seguir
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o Grupo mostra Ana e Bruno, "Ir lá" em Ana põe a ficha dela no centro, e sem seguir o arrasto dela a tira do centro', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await linhaDoGrupo(page, J1)
  await linhaDoGrupo(page, J2)
  const antes = await lerTela(page)
  expect(antes.fichas.limao.pixels, `o editor do mestre deveria mostrar a ficha de ${J1}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(pertoDoCentro(antes), `régua: antes do "Ir lá" a ficha de ${J1} já estava no centro (${descreverCentro(antes)}) — o controle não provaria nada`).toBe(false)

  const irLa = await botaoDaLinha(page, J1, IR_LA, IR_LA)
  await irLa.click()
  await expect
    .poll(async () => pertoDoCentro(await lerTela(page)), { timeout: ESPERA_TELA_MESTRE, message: `depois do "Ir lá", a ficha de ${J1} deveria ficar no centro da tela do mestre` })
    .toBe(true)

  // A régua dos testes 2 e 4 funciona hoje: Ana arrasta 10 casas na tela dela, a
  // razão Ana–Bruno na tela do mestre acusa a chegada, e o "Ir lá" (uma vez só)
  // não segue — a ficha sai do centro. É isto que o teste 2 tem de inverter.
  const antesDoArrasto = distanciaAnaBruno(await lerTela(page))
  expect(antesDoArrasto, `depois do "Ir lá", o editor deveria mostrar as fichas de ${J1} e ${J2}`).not.toBeNull()
  await anaArrasta(ana, POS_J1, POS_J1_ANDOU)
  let ultima: Tela | null = null
  await expect
    .poll(
      async () => {
        ultima = await lerTela(page)
        return anaChegouNoMestre(antesDoArrasto ?? 1, ultima, POS_J1, POS_J1_ANDOU)
      },
      { timeout: ESPERA_TELA_MESTRE, message: `a ficha de ${J1} deveria andar 10 casas na tela do mestre` },
    )
    .toBe(true)
  const tela = ultima ?? (await lerTela(page))
  expect(pertoDoCentro(tela), `sem "Seguir", o "Ir lá" não acompanha: a ficha de ${J1} deveria sair do centro (${descreverCentro(tela)})`).toBe(false)
})

test('2. "Seguir" em Ana fica pressionado; Ana arrasta a ficha 10 casas e ela continua no centro da tela do mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  const antes = distanciaAnaBruno(await lerTela(page))
  expect(antes, `o editor do mestre deveria mostrar as fichas de ${J1} e ${J2}`).not.toBeNull()
  await mestreSegue(page, J1)

  await anaArrasta(ana, POS_J1, POS_J1_ANDOU)
  let ultima: Tela | null = null
  await expect
    .poll(
      async () => {
        ultima = await lerTela(page)
        return anaChegouNoMestre(antes ?? 1, ultima, POS_J1, POS_J1_ANDOU) && pertoDoCentro(ultima)
      },
      { timeout: ESPERA_TELA_MESTRE, message: `seguindo ${J1}: a ficha dela andou 10 casas e deveria continuar no centro da tela do mestre` },
    )
    .toBe(true)
  const tela = ultima ?? (await lerTela(page))
  expect(pertoDoCentro(tela), descreverCentro(tela)).toBe(true)
})

test('3. seguindo Ana, ela viaja pelo pino: o editor passa para a Cripta e a ficha dela fica no centro', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await mestreSegue(page, J1)
  await viagemAprovada(page, ana)

  await expect
    .poll(
      async () => {
        const tela = await lerTela(page)
        return tela.chaoB > PIXELS_DE_CENA && pertoDoCentro(tela)
      },
      { timeout: ESPERA_TELA_MESTRE, message: `seguindo ${J1}: depois da viagem o editor deveria mostrar a ${CENA_B} com a ficha dela no centro` },
    )
    .toBe(true)
  const lista = await secaoCenas(page)
  await expect.poll(() => estaDestacada(entradaDaCena(lista, CENA_B)), { timeout: ESPERA, message: `seguindo ${J1}: a lista Cenas deveria marcar "${CENA_B}"` }).toBe(true)
  expect(await estaDestacada(entradaDaCena(lista, CENA_A)), `seguindo ${J1}: "${CENA_A}" não deveria continuar marcada`).toBe(false)
})

test('4. a roda do mouse sobre o mapa desliga o "Seguir", e a câmera para de acompanhar Ana', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  const seguir = await mestreSegue(page, J1)
  const telaAntes = await lerTela(page)
  const meio = telaAntes.centroVisivel ?? telaAntes.centroDoCanvas
  if (meio === null) throw new Error('régua: o canvas do editor não está visível')
  const quem = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', meio)
  expect(quem, `régua: o ponto da roda ${escrever(meio)} não está sobre o mapa, está sobre ${quem}`).toBe('CANVAS')
  await page.mouse.move(meio.x, meio.y)
  await page.mouse.wheel(0, RODA)
  await expect(seguir, 'girar a roda do mouse sobre o mapa deveria desligar o "Seguir" (aria-pressed=false)').toHaveAttribute('aria-pressed', 'false', { timeout: ESPERA })

  const antes = distanciaAnaBruno(await lerTela(page))
  expect(antes, `depois da roda, o editor deveria ainda mostrar as fichas de ${J1} e ${J2}`).not.toBeNull()
  await anaArrasta(ana, POS_J1, POS_J1_VOLTOU)
  let ultima: Tela | null = null
  await expect
    .poll(
      async () => {
        ultima = await lerTela(page)
        return anaChegouNoMestre(antes ?? 1, ultima, POS_J1, POS_J1_VOLTOU)
      },
      { timeout: ESPERA_TELA_MESTRE, message: `a ficha de ${J1} deveria andar 10 casas na tela do mestre` },
    )
    .toBe(true)
  const tela = ultima ?? (await lerTela(page))
  expect(pertoDoCentro(tela), `o "Seguir" foi desligado pela roda: a câmera não deveria acompanhar ${J1} (${descreverCentro(tela)})`).toBe(false)
})

test('5. "Seguir" em Ana e depois em Bruno: o de Ana desliga e o de Bruno fica ligado', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  await mesaMontada(browser, page, baseURL ?? '')

  const seguirAna = await mestreSegue(page, J1)
  const seguirBruno = await mestreSegue(page, J2)
  await expect(seguirAna, `ligar "Seguir" em ${J2} deveria desligar o de ${J1} (aria-pressed=false)`).toHaveAttribute('aria-pressed', 'false', { timeout: ESPERA })
  await expect(seguirBruno, `o "Seguir" de ${J2} deveria continuar ligado`).toHaveAttribute('aria-pressed', 'true')
})
