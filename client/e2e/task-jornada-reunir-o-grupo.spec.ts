// JORNADA DE USUÁRIO de REUNIR O GRUPO AQUI (G5) — escrita para SAIR VERMELHA
// no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G5):
//   - no painel de um pino (qualquer tipo: "!", "?" ou viagem) o mestre tem o
//     botão "Reunir o grupo aqui";
//   - o botão abre uma lista com os jogadores que têm ficha, cada um com uma
//     caixa de marcar JÁ MARCADA, e um botão "Reunir";
//   - ao confirmar, a ficha de cada jogador marcado vem de QUALQUER cena para
//     uma casa LIVRE em volta do pino, na cena do pino: duas fichas nunca na
//     mesma casa, nenhuma dentro de parede, nenhuma fora do chão;
//   - quem vem de outra cena passa a ver a cena do pino e lê "O mestre reuniu o
//     grupo"; quem já estava na cena só vê a própria ficha andar;
//   - o nome da cena nunca vai ao jogador.
//
// ONDE ISSO MORRE HOJE: o painel do pino (`components/PinControls.tsx`) só tem
// tipo, descrição, "Travado" e imagem (e o destino, no de viagem); não há
// lista de reunião, e a troca de cena de uma ficha
// (`adventureStore.transferToken`) só é chamada pelo "Deixar ir"
// (`net/hostBridge.ts`, `applyTransfer`).
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-viagem-do-jogador.spec.ts):
//   QUATRO TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo WebSocket
//   roteado vira `net:message` no mestre (com `JSON.parse` do que chegou), e o
//   `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão e Cripta num
//   `adventure.json`, aberto pelo menu como na mesa. Ana e Bruno têm ficha no
//   Salão; Carla, na Cripta. As fichas são atribuídas pelo gesto "Atribuir
//   <ficha>" da aba Jogo — a de Carla com o editor na Cripta, aberta pela lista
//   Cenas, como o mestre faria.
//   A VOLTA DO PINO TEM ARMADILHA. O pino "!" do Salão fica com o chão
//   acabando uma casa abaixo dele, uma coluna de pedra (quatro paredes em volta
//   de uma casa) à esquerda e uma estátua (ficha sem jogador) à direita. Casa
//   livre é o que sobra.
//   GESTO REAL NA AÇÃO SOB TESTE: ferramenta Pino, clique na cabeça do pino,
//   cliques no botão, nas caixas e em "Reunir". Os únicos `evaluate` são o do
//   transporte e a LEITURA de pixel (decodificar a foto num canvas solto e
//   perguntar `elementFromPoint`).
//   PROVA NA TELA: texto visível; a cena que cada jogador vê pela COR DO CHÃO
//   (Salão verde-água, Cripta magenta); cada ficha pela cor dela (Ana
//   verde-limão, Bruno laranja, Carla azul), no canvas do jogador e no do
//   mestre. Nada é lido da store.
//   FRAMES. Com o socket roteado o navegador não emite `framereceived`; o que a
//   página recebe é o que a rota entrega com `ws.send`, e é ali que a régua
//   anota (`Rede.enviados`).
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão do painel tem nome acessível contendo "Reunir o grupo aqui";
//   - cada jogador da lista é um `checkbox` cujo nome acessível contém o nome
//     do jogador como palavra ("Ana", "Ana — Lanterna"...);
//   - quem confirma é um botão de nome exato "Reunir";
//   - "a no máximo 2 casas do pino" = centro da ficha a até 2,5 casas do centro
//     da casa do pino em x E em y (meia casa de folga para o desenho);
//   - "casas diferentes" = centros a pelo menos 0,7 casa um do outro.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 5 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { PIN_HEAD_OFFSET } from '../src/lib/pins'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'REUNE1'
const J1 = 'Ana'
const J2 = 'Bruno'
const J3 = 'Carla'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_J1 = 'Lanterna'
const TOKEN_J2 = 'Machado'
const TOKEN_J3 = 'Rocha'
const ESTATUA = 'Estatua'
const PINO_REUNIAO = 'Fogueira do acampamento'

const ID_CENA_A = 'scene_salao'
const ID_CENA_B = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_vale'

// Mundo: as duas cenas têm o MESMO tamanho e o mesmo contorno de paredes, então
// "encaixar a cena" dá a mesma câmera nas duas, no mestre e no jogador.
const GRADE = 50
const COLUNAS = 40
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx. */
const FIT_MARGIN_JOGADOR = 24
/** Igual a `FIT_MARGIN` do enquadramento de abertura em pixi/PixiCanvas.tsx. */
const FIT_MARGIN_MESTRE = 40

const CHAO_A = '#1e8c8c'
const CHAO_B = '#8c1e8c'
/** Verde-limão, laranja e azul: cores que nada mais no app usa (a cabeça dos pinos é dourada). */
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'
const COR_J3 = '#1e3cff'
const COR_ESTATUA = '#808080'

type Ponto = { x: number; y: number }

/** Centro de uma casa da grade. */
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })

// Ana e Bruno começam longe do pino (mais de 10 casas; a coluna 0-8 fica sob o painel do jogador): reunir tem de MOVER as fichas.
const POS_J1 = casa(11, 4)
const POS_J2 = casa(13, 4)
const POS_J3 = casa(20, 5)
/** O pino "!" da reunião, na casa (24, 7) do Salão. */
const POS_PINO = casa(24, 7)
/** Estátua sem jogador, colada à direita do pino: casa OCUPADA. */
const POS_ESTATUA = casa(25, 7)
/** Coluna de pedra: quatro paredes em volta da casa (23, 7), colada à esquerda do pino. */
const COLUNA_DE_PEDRA = { x1: 23 * GRADE, y1: 7 * GRADE, x2: 24 * GRADE, y2: 8 * GRADE }
/** O chão do Salão acaba em y = 450: a linha 9 (450-500), a duas casas do pino, é fora do chão. */
const CHAO_DO_SALAO = { x1: 10, y1: 10, x2: LARGURA - 10, y2: 9 * GRADE }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels máximos para dizer "isto NÃO está na tela" (antisserrilhado e sombra). */
const RESIDUO = 25
/** Quanto a ficha que não devia andar pode "andar" na foto (arredondamento do centroide). */
const PARADA_PX = 4

const FERRAMENTA_PINO = 'Pino'
const TITULO_DO_PAINEL = /ponto de interesse/i
const REUNIR_O_GRUPO = /Reunir o grupo aqui/i
const REUNIR = 'Reunir'
const REUNIU = /O mestre reuniu o grupo/

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco
// ───────────────────────────────────────────────────────────────────────────

function pino(id: string, p: Ponto, kind: Pin['kind'], description: string): Pin {
  return { id, x: p.x, y: p.y, kind, description, image: null }
}

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Quatro paredes no contorno do mundo: o enquadramento do editor vira o mundo inteiro. */
function contorno(prefixo: string): Wall[] {
  return [
    parede(`${prefixo}-n`, 0, 0, LARGURA, 0),
    parede(`${prefixo}-l`, LARGURA, 0, LARGURA, ALTURA),
    parede(`${prefixo}-s`, LARGURA, ALTURA, 0, ALTURA),
    parede(`${prefixo}-o`, 0, ALTURA, 0, 0),
  ]
}

function colunaDePedra(): Wall[] {
  const { x1, y1, x2, y2 } = COLUNA_DE_PEDRA
  return [parede('col-n', x1, y1, x2, y1), parede('col-l', x2, y1, x2, y2), parede('col-s', x2, y2, x1, y2), parede('col-o', x1, y2, x1, y1)]
}

function cena(id: string, nome: string, chao: string, retangulo: { x1: number; y1: number; x2: number; y2: number }, paredes: Wall[], tokens: Token[], pins: Pin[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  const w = retangulo.x2 - retangulo.x1
  const h = retangulo.y2 - retangulo.y1
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: retangulo.x1 + w / 2, cy: retangulo.y1 + h / 2, w, h }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    walls: contorno(id).concat(paredes),
    tokens,
    pins,
  }
}

const MAPA_A = cena(
  'map_vale',
  AVENTURA,
  CHAO_A,
  CHAO_DO_SALAO,
  colunaDePedra(),
  [token('tok-lanterna', TOKEN_J1, POS_J1, COR_J1), token('tok-machado', TOKEN_J2, POS_J2, COR_J2), token('tok-estatua', ESTATUA, POS_ESTATUA, COR_ESTATUA)],
  [pino('pin-a-fogueira', POS_PINO, 'exclamacao', PINO_REUNIAO)],
)
const MAPA_B = cena('map_cripta', CENA_B, CHAO_B, { x1: 10, y1: 10, x2: LARGURA - 10, y2: ALTURA - 10 }, [], [token('tok-rocha', TOKEN_J3, POS_J3, COR_J3)], [])

function discoDaAventura(): Record<string, string> {
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
    [`${PASTA}/map.json`]: serializeMap(MAPA_A),
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

/** A seção "Cenas" da aba Mapa, aberta. */
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

/** O editor do mestre vai a outra cena pela lista de Cenas, como na mesa. */
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

/**
 * Mestre abre a aventura e a sala; os três entram; Ana e Bruno ganham a ficha
 * no Salão, e Carla a dela com o editor na Cripta. O editor volta ao Salão.
 */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  const carla = await jogadorEntra(browser, baseURL, rede, 'c3', J3)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await mestreAbreCena(mestre, CENA_B)
  await mestreAtribui(mestre, J3, TOKEN_J3)
  await mestreAbreCena(mestre, CENA_A)
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
 * (painéis e cartões não contam). Leitura pura: decodifica a foto num canvas
 * solto e pergunta `elementFromPoint`.
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
  return { x: p.x * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.x, y: p.y * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.y }
}

/** Mundo → tela do mestre, com o enquadramento de abertura da cena (conteúdo, margem 40). */
interface CameraDoMestre {
  paraTela: (p: Ponto) => Ponto
  paraMundo: (p: Ponto) => Ponto
  escala: number
}

async function cameraDoMestre(mestre: Page): Promise<CameraDoMestre> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(MAPA_A)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return {
    escala: c.scale,
    paraTela: (p) => ({ x: caixa.x + p.x * c.scale + c.x, y: caixa.y + p.y * c.scale + c.y }),
    paraMundo: (p) => ({ x: (p.x - caixa.x - c.x) / c.scale, y: (p.y - caixa.y - c.y) / c.scale }),
  }
}

/** Desce, fica parado um instante, sobe — sem mover. O toque tem de cair no MAPA, não num painel. */
async function tocarNoMapa(page: Page, p: Ponto): Promise<void> {
  const quem = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', p)
  expect(quem, `régua: o ponto (${Math.round(p.x)}, ${Math.round(p.y)}) não está sobre o mapa, está sobre ${quem}`).toBe('CANVAS')
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

// ───────────────────────────────────────────────────────────────────────────
// O gesto sob teste: painel do pino → "Reunir o grupo aqui" → lista → "Reunir"
// ───────────────────────────────────────────────────────────────────────────

/** Ferramenta Pino na mão e clique na cabeça do pino "!": o painel "Ponto de interesse" abre no rail. */
async function mestreAbrePainelDoPino(mestre: Page): Promise<Locator> {
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await mestre.getByRole('button', { name: FERRAMENTA_PINO, exact: true }).click()
  const camera = await cameraDoMestre(mestre)
  await tocarNoMapa(mestre, camera.paraTela({ x: POS_PINO.x, y: POS_PINO.y - PIN_HEAD_OFFSET }))
  const titulo = mestre.getByRole('heading', { name: TITULO_DO_PAINEL }).first()
  await expect(titulo, 'clicar no pino "!" com a ferramenta Pino deveria abrir o painel "Ponto de interesse"').toBeVisible({ timeout: ESPERA })
  return titulo.locator('xpath=ancestor::*[self::section or @role="region" or @role="dialog"][1]')
}

/** Nomes acessíveis dos botões do painel — só para a mensagem de falha ajudar quem implementa. */
async function botoesDoPainel(painel: Locator): Promise<string> {
  const nomes = await painel
    .locator('button, select, [role="checkbox"], [role="switch"], [role="radio"]')
    .evaluateAll((elementos) => elementos.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '').filter((n) => n !== ''))
  return nomes.join(' | ')
}

function caixaDoJogador(mestre: Page, jogador: string): Locator {
  return mestre.getByRole('checkbox', { name: new RegExp(`\\b${jogador}\\b`) })
}

/** Abre a lista de reunião pelo botão do painel e confere os três marcados. Devolve o botão "Reunir". */
async function mestreAbreListaDeReuniao(mestre: Page): Promise<Locator> {
  const painel = await mestreAbrePainelDoPino(mestre)
  const botao = mestre.getByRole('button', { name: REUNIR_O_GRUPO })
  await expect(botao, `o painel do pino "!" deveria ter "Reunir o grupo aqui". Controles do painel hoje: ${await botoesDoPainel(painel)}`).toBeVisible({ timeout: ESPERA })
  await botao.click()
  for (const jogador of [J1, J2, J3]) {
    const caixa = caixaDoJogador(mestre, jogador)
    await expect(caixa, `a lista de reunião deveria ter ${jogador} com uma caixa de marcar`).toBeVisible({ timeout: ESPERA })
    await expect(caixa, `${jogador} deveria vir marcado na lista de reunião`).toBeChecked()
  }
  const reunir = mestre.getByRole('button', { name: REUNIR, exact: true })
  await expect(reunir, 'a lista de reunião deveria ter o botão "Reunir"').toBeVisible({ timeout: ESPERA })
  return reunir
}

/** Carla (trazida da Cripta) passa a ver o chão do Salão, e só ele. */
async function carlaChegaAoSalao(carla: Jogador): Promise<void> {
  await expect
    .poll(async () => (await telaParada(carla.page)).chaoAClaro, { timeout: ESPERA_TELA, message: `${J3} deveria passar a ver o chão do ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_CENA)
  const tela = await telaParada(carla.page)
  expect(tela.chaoB, `${J3} foi reunida no ${CENA_A} e continua vendo o chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  expect(tela.fichas.azul.pixels, `${J3} deveria ver a própria ficha no ${CENA_A}`).toBeGreaterThan(PIXELS_DE_TOKEN)
}

/** A ficha está a no máximo 2 casas do pino (meia casa de folga), em mundo. */
function pertoDoPino(p: Ponto): boolean {
  return Math.abs(p.x - POS_PINO.x) <= 2.5 * GRADE && Math.abs(p.y - POS_PINO.y) <= 2.5 * GRADE
}

function dentroDe(p: Ponto, r: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return p.x > r.x1 && p.x < r.x2 && p.y > r.y1 && p.y < r.y2
}

const escrever = (p: Ponto | null): string => (p === null ? 'sem ficha' : `(${Math.round(p.x)}, ${Math.round(p.y)})`)

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana e Bruno veem o Salão, Carla vê a Cripta, e o mestre vê as fichas do Salão onde o mundo diz', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno, carla } = await mesaMontada(browser, page, baseURL ?? '')

  for (const [j, cor] of [[ana, 'limao'], [bruno, 'laranja']] as const) {
    const tela = await telaParada(j.page)
    expect(tela.chaoAClaro, `${j.nome} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
    expect(tela.chaoB, `${j.nome} não deveria ver chão da ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
    expect(tela.fichas[cor].pixels, `${j.nome} deveria ver a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
    expect(tela.fichas.azul.pixels, `${j.nome} não deveria ver a ficha de ${J3}, que está na ${CENA_B}`).toBeLessThanOrEqual(RESIDUO)
  }
  const telaDeCarla = await telaParada(carla.page)
  expect(telaDeCarla.chaoB, `${J3} deveria ver o chão da ${CENA_B}`).toBeGreaterThan(PIXELS_DE_CENA)
  expect(telaDeCarla.chaoAClaro + telaDeCarla.chaoAEscuro, `${J3} não deveria ver chão do ${CENA_A}`).toBeLessThanOrEqual(RESIDUO)
  expect(telaDeCarla.fichas.azul.pixels, `${J3} deveria ver a própria ficha`).toBeGreaterThan(PIXELS_DE_TOKEN)
  // A régua de câmera do jogador acerta a ficha de Carla.
  const esperadoCarla = naTelaDoJogador(POS_J3)
  const centroCarla = telaDeCarla.fichas.azul.centro
  expect(centroCarla, `${J3}: ficha sem centro`).not.toBeNull()
  if (centroCarla) expect(Math.hypot(centroCarla.x - esperadoCarla.x, centroCarla.y - esperadoCarla.y), `${J3}: a ficha não está onde a câmera de encaixe diz`).toBeLessThan(20)

  // A régua de câmera do MESTRE acerta as fichas do Salão (é por ela que os testes 3 e 4 medem).
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const camera = await cameraDoMestre(page)
  const telaDoMestre = await telaParada(page)
  for (const [cor, pos, quem] of [['limao', POS_J1, J1], ['laranja', POS_J2, J2]] as const) {
    const centro = telaDoMestre.fichas[cor].centro
    expect(telaDoMestre.fichas[cor].pixels, `o mestre deveria ver a ficha de ${quem}`).toBeGreaterThan(PIXELS_DE_TOKEN)
    const esperado = camera.paraTela(pos)
    if (centro) expect(Math.hypot(centro.x - esperado.x, centro.y - esperado.y), `a ficha de ${quem} não está onde a câmera do mestre diz (centro ${escrever(centro)})`).toBeLessThan(15)
  }
  expect(telaDoMestre.fichas.azul.pixels, `o editor está no ${CENA_A}: a ficha de ${J3} não deveria aparecer`).toBeLessThanOrEqual(RESIDUO)
})

test('2. o painel do pino "!" tem "Reunir o grupo aqui", e a lista traz Ana, Bruno e Carla marcados', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  await mesaMontada(browser, page, baseURL ?? '')
  await mestreAbreListaDeReuniao(page)
})

test('3. reunir os três: Carla chega ao Salão e lê o aviso, as três fichas ficam em casas livres em volta do pino, e Ana vê Carla', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, carla } = await mesaMontada(browser, page, baseURL ?? '')
  const reunir = await mestreAbreListaDeReuniao(page)
  await reunir.click()

  // Carla, trazida da Cripta.
  await carlaChegaAoSalao(carla)
  await expect(carla.page.getByText(REUNIU).first(), `${J3} veio de outra cena e deveria ler "O mestre reuniu o grupo"`).toBeVisible({ timeout: ESPERA })

  // O mestre: as três fichas em volta do pino, em casas diferentes e livres.
  const camera = await cameraDoMestre(page)
  await expect
    .poll(async () => (await telaParada(page)).fichas.azul.pixels, { timeout: ESPERA_TELA, message: `a ficha de ${J3} deveria aparecer no ${CENA_A} na tela do mestre` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  await expect
    .poll(
      async () => {
        const tela = await telaParada(page)
        return [tela.fichas.limao.centro, tela.fichas.laranja.centro, tela.fichas.azul.centro].every((c) => c !== null && pertoDoPino(camera.paraMundo(c)))
      },
      { timeout: ESPERA_TELA, message: 'na tela do mestre as três fichas deveriam ficar a no máximo 2 casas do pino' },
    )
    .toBe(true)
  const tela = await telaParada(page)
  const centros: Array<{ quem: string; mundo: Ponto }> = []
  for (const [cor, quem] of [['limao', J1], ['laranja', J2], ['azul', J3]] as const) {
    const ficha = tela.fichas[cor]
    expect(ficha.pixels, `o mestre deveria ver a ficha de ${quem} no ${CENA_A}`).toBeGreaterThan(PIXELS_DE_TOKEN)
    if (ficha.centro === null) throw new Error(`ficha de ${quem} sem centro`)
    const mundo = camera.paraMundo(ficha.centro)
    expect(pertoDoPino(mundo), `a ficha de ${quem} deveria ficar a no máximo 2 casas do pino (está em ${escrever(mundo)} de mundo, pino em ${escrever(POS_PINO)})`).toBe(true)
    expect(dentroDe(mundo, COLUNA_DE_PEDRA), `a ficha de ${quem} ficou dentro da coluna de pedra (${escrever(mundo)})`).toBe(false)
    expect(dentroDe(mundo, CHAO_DO_SALAO), `a ficha de ${quem} ficou fora do chão (${escrever(mundo)}; o chão acaba em y = ${CHAO_DO_SALAO.y2})`).toBe(true)
    expect(Math.hypot(mundo.x - POS_ESTATUA.x, mundo.y - POS_ESTATUA.y), `a ficha de ${quem} ficou na casa da estátua (${escrever(mundo)})`).toBeGreaterThan(0.7 * GRADE)
    centros.push({ quem, mundo })
  }
  for (let i = 0; i < centros.length; i += 1) {
    for (let k = i + 1; k < centros.length; k += 1) {
      const a = centros[i]
      const b = centros[k]
      expect(Math.hypot(a.mundo.x - b.mundo.x, a.mundo.y - b.mundo.y), `as fichas de ${a.quem} ${escrever(a.mundo)} e ${b.quem} ${escrever(b.mundo)} ficaram na mesma casa`).toBeGreaterThan(0.7 * GRADE)
    }
  }

  // Ana, que já estava no Salão: vê a ficha de Carla chegar, e a própria ficha andar até o pino — sem aviso.
  await expect
    .poll(async () => (await telaParada(ana.page)).fichas.azul.pixels, { timeout: ESPERA_TELA, message: `${J1} deveria ver a ficha de ${J3} no ${CENA_A}` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
  const telaDeAna = await telaParada(ana.page)
  const fichaDeAna = telaDeAna.fichas.limao.centro
  expect(fichaDeAna, `${J1} deveria ver a própria ficha`).not.toBeNull()
  const pinoNaAna = naTelaDoJogador(POS_PINO)
  if (fichaDeAna) {
    expect(Math.abs(fichaDeAna.x - pinoNaAna.x), `na tela de ${J1} a ficha dela deveria ter andado até o pino`).toBeLessThanOrEqual(2.5 * GRADE * CAMERA_JOGADOR.scale)
  }
  await expect(ana.page.getByText(REUNIU), `${J1} já estava no ${CENA_A}: não deveria ler "O mestre reuniu o grupo"`).toHaveCount(0)
})

test('4. Bruno desmarcado não se mexe: Ana e Carla vêm ao pino, a ficha de Bruno fica onde estava', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { carla } = await mesaMontada(browser, page, baseURL ?? '')
  const reunir = await mestreAbreListaDeReuniao(page)
  const antes = (await telaParada(page)).fichas.laranja.centro
  expect(antes, `antes de reunir, o mestre deveria ver a ficha de ${J2}`).not.toBeNull()

  const caixaDeBruno = caixaDoJogador(page, J2)
  await caixaDeBruno.click()
  await expect(caixaDeBruno, `clicar na caixa de ${J2} deveria desmarcá-la`).not.toBeChecked()
  await reunir.click()

  // Controle: a reunião aconteceu (Carla chegou, e a ficha de Ana foi ao pino).
  await carlaChegaAoSalao(carla)
  const camera = await cameraDoMestre(page)
  await expect
    .poll(
      async () => {
        const c = (await telaParada(page)).fichas.limao.centro
        return c !== null && pertoDoPino(camera.paraMundo(c))
      },
      { timeout: ESPERA_TELA, message: `a ficha de ${J1}, marcada, deveria ir para perto do pino` },
    )
    .toBe(true)

  const depois = (await telaParada(page)).fichas.laranja.centro
  expect(depois, `o mestre deveria continuar vendo a ficha de ${J2}`).not.toBeNull()
  if (antes && depois) {
    expect(Math.hypot(depois.x - antes.x, depois.y - antes.y), `${J2} estava desmarcado e a ficha dele andou de ${escrever(antes)} para ${escrever(depois)}`).toBeLessThanOrEqual(PARADA_PX)
  }
})

test('5. nada vaza: nenhum frame recebido por Carla, do começo ao fim, traz o nome "Salao Norte"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { carla } = await mesaMontada(browser, page, baseURL ?? '')

  // Controle: o ouvido está ligado — a página já recebeu o mapa pelo WebSocket.
  expect(carla.frames.some((f) => f.includes('"snapshot"')), `a escuta de frames de ${J3} não viu nenhum snapshot: a régua de vazamento estaria surda`).toBe(true)

  const reunir = await mestreAbreListaDeReuniao(page)
  await reunir.click()
  await carlaChegaAoSalao(carla)
  await expect(carla.page.getByText(REUNIU).first(), `${J3} deveria ler "O mestre reuniu o grupo"`).toBeVisible({ timeout: ESPERA })

  expect(carla.frames.filter((f) => f.includes(CENA_A)), `${J3} recebeu o nome da cena "${CENA_A}"`).toEqual([])
})
