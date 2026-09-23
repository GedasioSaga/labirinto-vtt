// JORNADA DE USUÁRIO da PAUSA POR CENA (G12) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G12):
//   - na lista "Cenas" da aba Mapa, cada cena ganha o botão alternável
//     "Pausar" (`aria-pressed`; nome acessível contendo "Pausar");
//   - com a cena pausada, quem está nela não move a própria ficha (o host
//     recusa e a ficha volta ao lugar na tela do jogador), não pede porta nem
//     passagem pelo pino de viagem, e lê "O mestre está com o outro grupo";
//   - quem está em OUTRA cena continua jogando normal;
//   - despausar tira o aviso, e o movimento volta a funcionar.
//
// ONDE ISSO MORRE HOJE: a lista Cenas (`components/ScenesSection.tsx`) não tem
// "Pausar", e `net/hostSession.ts` (`handleMove`) aceita todo `token.move`
// válido — não existe estado de pausa por cena nem aviso na tela do jogador.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-recado-por-cena, task-jornada-viajar-junto e
// task-jornada-seguir-jogador):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   Ana e Bruno são o `player.html` inteiro, cada um no próprio contexto de
//   navegador. Só o TRANSPORTE Rust é falsificado: o que o jogador manda pelo
//   WebSocket roteado vira `net:message` no mestre (com `JSON.parse` do que
//   chegou), e o `net_send` do mestre volta ao socket por `exposeFunction`.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão e Cripta num
//   `adventure.json`, aberto pelo menu. A ficha de Ana está no Salão e a de
//   Bruno na Cripta; as duas são atribuídas pelo gesto "Atribuir <ficha>" da
//   aba Jogo — a de Bruno com o editor na Cripta, aberta pela lista Cenas.
//   GESTO REAL NA AÇÃO SOB TESTE: clique em "Pausar" na linha da cena; o
//   jogador ARRASTA a própria ficha na tela dele (desce no centro da ficha que
//   vê, anda em passos, para um instante e solta). Os únicos `evaluate` são o
//   do transporte e a LEITURA de pixel (decodificar a foto num canvas solto e
//   perguntar `elementFromPoint`).
//   PROVA NA TELA: `aria-pressed` do botão; texto visível na tela do jogador;
//   cada ficha pela cor (Ana verde-limão, Bruno laranja) no canvas do jogador e
//   no do mestre. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - cada cena da lista continua sendo um item de lista (`listitem`) com o
//     botão do nome da cena, e o "Pausar" fica DENTRO desse item, com o MESMO
//     nome acessível ligado ou desligado (o estado vai em `aria-pressed`);
//   - o aviso é texto visível na tela do jogador contendo "O mestre está com o
//     outro grupo";
//   - "a ficha volta ao lugar" = o centro da mancha da ficha a até 4 px de onde
//     estava antes do arrasto, na tela dela e na do mestre (a régua não obriga
//     a ficha a seguir o ponteiro durante o arrasto: travar já no cliente
//     também atende);
//   - o editor do mestre, ao voltar ao Salão depois de atribuir Bruno na
//     Cripta, mostra o Salão com o enquadramento de abertura (conteúdo, margem
//     40) — o teste 1 confere isso antes de qualquer outra coisa.
//   Porta (`door.toggle`) e pedido de passagem pelo pino com a cena pausada NÃO
//   são cobrados aqui (fora dos cinco casos pedidos).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 5 poderia ser a infraestrutura quebrada. O teste 4 depende do "Pausar" do
// teste 2: hoje cai no mesmo ponto.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Token, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'PAUSA1'
const ANA = 'Ana'
const BRUNO = 'Bruno'
const AVENTURA = 'Aventura do Vale'
const CENA_A = 'Salao Norte'
const CENA_B = 'Cripta Rubra'

const TOKEN_ANA = 'Lanterna'
const TOKEN_BRUNO = 'Machado'

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
/** Verde-limão e laranja: cores que nada mais no app usa. */
const COR_ANA = '#3cff00'
const COR_BRUNO = '#ff5a00'

type Ponto = { x: number; y: number }

/** Centro de uma casa da grade. */
const casa = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })

/**
 * As duas fichas moram à direita e embaixo do meio: as colunas 0-8 ficam sob o
 * painel do jogador, e um aviso centrado ou no topo da tela não cobre a ficha.
 * Cada arrasto anda 3 casas para a direita.
 */
const POS_ANA = casa(24, 8)
const POS_ANA_ANDOU = casa(27, 8)
const POS_BRUNO = casa(24, 8)
const POS_BRUNO_ANDOU = casa(27, 8)

/** Botão parado antes de soltar (a pausa do arrasto real). */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL na tela do jogador: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/**
 * Espera de quem lê pixel na tela do MESTRE: uma leitura sozinha já levou até
 * 25 s (medido em 22/09 na régua de viajar junto, a primeira depois de trocar
 * de cena levou 20,6 s). Folga maior só aqui.
 */
const ESPERA_TELA_MESTRE = 40_000
/** Depois do arrasto recusado: tempo para a mensagem cruzar o fio e o mestre pintar, se fosse pintar. */
const ASSENTAR_MS = 1500

const PIXELS_DE_TOKEN = 60
/** "Chegou onde soltou": centro da ficha a menos disto do alvo. */
const PERTO_PX = 15
/** "Ficou no mesmo lugar": centro da ficha a até isto de onde estava. */
const MESMO_LUGAR_PX = 4

const PAUSAR = /Pausar/
const AVISO_DA_PAUSA = /O mestre está com o outro grupo/

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Ana no Salão, Bruno na Cripta
// ───────────────────────────────────────────────────────────────────────────

function token(id: string, name: string, p: Ponto, color: string): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Quatro paredes no contorno do mundo: o enquadramento (mestre e jogador) vira o mundo inteiro, nas duas cenas. */
function contorno(prefixo: string): Wall[] {
  return [
    parede(`${prefixo}-n`, 0, 0, LARGURA, 0),
    parede(`${prefixo}-l`, LARGURA, 0, LARGURA, ALTURA),
    parede(`${prefixo}-s`, LARGURA, ALTURA, 0, ALTURA),
    parede(`${prefixo}-o`, 0, ALTURA, 0, 0),
  ]
}

function cena(id: string, nome: string, chao: string, tokens: Token[]): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    walls: contorno(id),
    tokens,
    pins: [],
  }
}

const MAPA_A = cena('map_vale', AVENTURA, CHAO_A, [token('tok-lanterna', TOKEN_ANA, POS_ANA, COR_ANA)])
const MAPA_B = cena('map_cripta', 'Planta de baixo', CHAO_B, [token('tok-machado', TOKEN_BRUNO, POS_BRUNO, COR_BRUNO)])

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

/** O item da lista "Cenas" que tem o botão com o nome da cena. */
function linhaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('listitem').filter({ has: lista.page().getByRole('button', { name: nome, exact: true }) })
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

/** Nomes dos botões da linha da cena — só para a mensagem de falha ajudar quem implementa. */
async function botoesDaLinha(linha: Locator): Promise<string> {
  const nomes = await linha.getByRole('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()))
  return nomes.join(' | ') || '(nenhum)'
}

/** O botão "Pausar" DENTRO da linha da cena. Falha dizendo o que a linha tem hoje. */
async function botaoPausar(mestre: Page, nomeDaCena: string): Promise<Locator> {
  const lista = await secaoCenas(mestre)
  const linha = linhaDaCena(lista, nomeDaCena)
  await expect(linha, `"${nomeDaCena}" deveria ser um item da lista Cenas`).toHaveCount(1)
  const botao = linha.getByRole('button', { name: PAUSAR })
  await expect(botao.first(), `a linha "${nomeDaCena}" da lista Cenas deveria ter o botão "Pausar". Botões da linha hoje: ${await botoesDaLinha(linha)}`).toBeVisible({ timeout: ESPERA })
  return botao.first()
}

/** O mestre aperta "Pausar" na linha da cena e o botão fica pressionado. */
async function mestrePausa(mestre: Page, nomeDaCena: string): Promise<Locator> {
  const botao = await botaoPausar(mestre, nomeDaCena)
  await expect(botao, `"Pausar" de "${nomeDaCena}" deveria começar solto`).toHaveAttribute('aria-pressed', 'false')
  await botao.click()
  await expect(botao, `"Pausar" de "${nomeDaCena}" deveria ficar pressionado depois do clique`).toHaveAttribute('aria-pressed', 'true', { timeout: ESPERA })
  return botao
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  clientId: string
  nome: string
  cor: CorDeFicha
}

/** Contextos de jogador abertos pelo teste que está rodando; o `page` do mestre o Playwright fecha sozinho. */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string, cor: CorDeFicha): Promise<Jogador> {
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
  return { page, clientId, nome, cor }
}

/** Espera o mapa chegar: canvas na tela e a ficha do próprio jogador pintada. */
async function esperaFichaNaTela(j: Jogador): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await lerTela(j.page)).fichas[j.cor].pixels, { timeout: ESPERA_TELA, message: `${j.nome}: a própria ficha não foi pintada na tela` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

interface Mesa {
  rede: Rede
  ana: Jogador
  bruno: Jogador
}

/**
 * Mestre abre a aventura e a sala; Ana e Bruno entram; Ana ganha a ficha no
 * Salão, Bruno a dele com o editor na Cripta. O editor volta ao Salão.
 */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', ANA, 'limao')
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', BRUNO, 'laranja')
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await mestreAbreCena(mestre, CENA_B)
  await mestreAtribui(mestre, BRUNO, TOKEN_BRUNO)
  await mestreAbreCena(mestre, CENA_A)
  await esperaFichaNaTela(ana)
  await esperaFichaNaTela(bruno)
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
    const soma = { limao: { n: 0, x: 0, y: 0 }, laranja: { n: 0, x: 0, y: 0 } }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        if (!limao && !laranja) continue
        if (!canvasPorCima(x, y)) continue
        const s = limao ? soma.limao : soma.laranja
        s.n += 1
        s.x += x
        s.y += y
      }
    }
    const ficha = (s: { n: number; x: number; y: number }) => ({
      pixels: s.n,
      centro: s.n > 0 ? { x: (s.x / s.n) * escalaX, y: (s.y / s.n) * escalaY } : null,
    })
    return { fichas: { limao: ficha(soma.limao), laranja: ficha(soma.laranja) } }
  }, foto.toString('base64'))
}

async function telaParada(page: Page): Promise<Tela> {
  await page.waitForTimeout(PINTURA_MS)
  return lerTela(page)
}

const escrever = (p: Ponto | null): string => (p === null ? 'sem ficha' : `(${Math.round(p.x)}, ${Math.round(p.y)})`)
const distancia = (a: Ponto | null, b: Ponto): number => (a === null ? Number.POSITIVE_INFINITY : Math.hypot(a.x - b.x, a.y - b.y))

/** Câmera de "encaixar a cena" do jogador: mundo inteiro, a mesma nas duas cenas. */
const CAMERA_JOGADOR = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN_JOGADOR)

function naTelaDoJogador(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.x), y: Math.round(p.y * CAMERA_JOGADOR.scale + CAMERA_JOGADOR.y) }
}

/** Mundo → tela do mestre, com o enquadramento de abertura da cena (conteúdo, margem 40). */
async function cameraDoMestre(mestre: Page, mapa: MapData): Promise<(p: Ponto) => Ponto> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(mapa)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return (p) => ({ x: caixa.x + p.x * c.scale + c.x, y: caixa.y + p.y * c.scale + c.y })
}

/** A ficha de `quem` aparece em `alvo` (px da página) na tela do mestre. */
async function mestreVeFichaEm(mestre: Page, cor: CorDeFicha, alvo: Ponto, oQue: string): Promise<void> {
  let ultima: Ficha | null = null
  await expect
    .poll(
      async () => {
        ultima = (await telaParada(mestre)).fichas[cor]
        return ultima.pixels > PIXELS_DE_TOKEN ? distancia(ultima.centro, alvo) : Number.POSITIVE_INFINITY
      },
      { timeout: ESPERA_TELA_MESTRE, message: `${oQue} (alvo ${escrever(alvo)} na tela do mestre)` },
    )
    .toBeLessThan(PERTO_PX)
}

// ───────────────────────────────────────────────────────────────────────────
// O gesto: o jogador arrasta a própria ficha na tela dele
// ───────────────────────────────────────────────────────────────────────────

interface Arrasto {
  /** Onde a ficha estava na tela do jogador antes do arrasto (centro da mancha). */
  origem: Ponto
  /** Onde o ponteiro soltou, na tela do jogador. */
  destino: Ponto
}

/**
 * O jogador ARRASTA a própria ficha de `de` para `para` (mundo): desce no
 * centro da ficha que VÊ, anda em passos, para um instante e solta.
 */
async function jogadorArrasta(j: Jogador, de: Ponto, para: Ponto): Promise<Arrasto> {
  const vista = (await telaParada(j.page)).fichas[j.cor].centro
  expect(vista, `${j.nome} deveria ver a própria ficha antes de arrastar`).not.toBeNull()
  const origem = vista ?? naTelaDoJogador(de)
  expect(distancia(origem, naTelaDoJogador(de)), `régua: a ficha de ${j.nome} não está onde a câmera do jogador diz (${escrever(origem)})`).toBeLessThan(20)
  const destino = { x: origem.x + (para.x - de.x) * CAMERA_JOGADOR.scale, y: origem.y + (para.y - de.y) * CAMERA_JOGADOR.scale }
  const quem = await j.page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nada', destino)
  expect(quem, `régua: o destino do arrasto ${escrever(destino)} não está sobre o mapa de ${j.nome}, está sobre ${quem}`).toBe('CANVAS')
  await j.page.mouse.move(origem.x, origem.y)
  await j.page.mouse.down()
  await j.page.mouse.move(destino.x, destino.y, { steps: 20 })
  await j.page.waitForTimeout(TOQUE_MS)
  await j.page.mouse.up()
  return { origem, destino }
}

/** Na tela do jogador, a ficha fica onde ele soltou. */
async function fichaFicaOndeSoltou(j: Jogador, arrasto: Arrasto): Promise<void> {
  await expect
    .poll(async () => distancia((await lerTela(j.page)).fichas[j.cor].centro, arrasto.destino), {
      timeout: ESPERA_TELA,
      message: `${j.nome} arrastou a própria ficha e ela não ficou onde soltou, na tela dele(a)`,
    })
    .toBeLessThan(PERTO_PX)
}

/** Espera o que o jogador mandou cruzar o fio e o mestre ter tempo de pintar. */
async function assentar(rede: Rede, j: Jogador): Promise<void> {
  await j.page.waitForTimeout(ASSENTAR_MS)
  await rede.fila
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana arrasta a própria ficha 3 casas e ela anda na tela do mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const paraTela = await cameraDoMestre(page, MAPA_A)
  await mestreVeFichaEm(page, 'limao', paraTela(POS_ANA), `o mestre deveria ver a ficha de ${ANA} onde a câmera do Salão diz`)

  const arrasto = await jogadorArrasta(ana, POS_ANA, POS_ANA_ANDOU)
  await fichaFicaOndeSoltou(ana, arrasto)
  await mestreVeFichaEm(page, 'limao', paraTela(POS_ANA_ANDOU), `${ANA} arrastou 3 casas: a ficha dela deveria andar 3 casas na tela do mestre`)
})

test('2. o mestre aperta "Pausar" no Salão, o botão fica pressionado e Ana lê "O mestre está com o outro grupo"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await expect(ana.page.getByText(AVISO_DA_PAUSA), `sem pausa, ${ANA} não deveria ler o aviso`).toHaveCount(0)

  await mestrePausa(page, CENA_A)
  await expect(ana.page.getByText(AVISO_DA_PAUSA).first(), `com o ${CENA_A} pausado, ${ANA} deveria ler "O mestre está com o outro grupo"`).toBeVisible({ timeout: ESPERA })
})

test('3. com o Salão pausado, Ana arrasta 3 casas: a ficha volta ao lugar na tela dela e não anda na tela do mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { rede, ana } = await mesaMontada(browser, page, baseURL ?? '')
  const paraTela = await cameraDoMestre(page, MAPA_A)
  await mestreVeFichaEm(page, 'limao', paraTela(POS_ANA), `o mestre deveria ver a ficha de ${ANA} onde a câmera do Salão diz`)
  const antesNoMestre = (await telaParada(page)).fichas.limao.centro
  expect(antesNoMestre, `o mestre deveria ver a ficha de ${ANA} antes da pausa`).not.toBeNull()

  await mestrePausa(page, CENA_A)
  const arrasto = await jogadorArrasta(ana, POS_ANA, POS_ANA_ANDOU)
  await expect
    .poll(async () => distancia((await lerTela(ana.page)).fichas.limao.centro, arrasto.origem), {
      timeout: ESPERA_TELA,
      message: `${CENA_A} pausado: a ficha de ${ANA} deveria voltar ao lugar na tela dela (estava em ${escrever(arrasto.origem)}, solta em ${escrever(arrasto.destino)})`,
    })
    .toBeLessThanOrEqual(MESMO_LUGAR_PX)

  await assentar(rede, ana)
  const depois = (await telaParada(page)).fichas.limao
  expect(depois.pixels, `o mestre deveria continuar vendo a ficha de ${ANA}`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(
    distancia(depois.centro, antesNoMestre ?? paraTela(POS_ANA)),
    `${CENA_A} pausado: a ficha de ${ANA} não deveria andar na tela do mestre (antes ${escrever(antesNoMestre)}, agora ${escrever(depois.centro)})`,
  ).toBeLessThanOrEqual(MESMO_LUGAR_PX)
})

test('4. com o Salão pausado, Bruno na Cripta arrasta a ficha e ela anda; Bruno não lê o aviso', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { rede, ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')
  await mestrePausa(page, CENA_A)
  await expect(ana.page.getByText(AVISO_DA_PAUSA).first(), `com o ${CENA_A} pausado, ${ANA} deveria ler o aviso`).toBeVisible({ timeout: ESPERA })

  await mestreAbreCena(page, CENA_B)
  const paraTela = await cameraDoMestre(page, MAPA_B)
  await mestreVeFichaEm(page, 'laranja', paraTela(POS_BRUNO), `o mestre deveria ver a ficha de ${BRUNO} onde a câmera da Cripta diz`)

  const arrasto = await jogadorArrasta(bruno, POS_BRUNO, POS_BRUNO_ANDOU)
  await fichaFicaOndeSoltou(bruno, arrasto)
  await assentar(rede, bruno)
  const naTelaDele = (await telaParada(bruno.page)).fichas.laranja.centro
  expect(distancia(naTelaDele, arrasto.destino), `a ${CENA_B} não está pausada: a ficha de ${BRUNO} não deveria voltar (${escrever(naTelaDele)})`).toBeLessThan(PERTO_PX)
  await mestreVeFichaEm(page, 'laranja', paraTela(POS_BRUNO_ANDOU), `a ${CENA_B} não está pausada: a ficha de ${BRUNO} deveria andar 3 casas na tela do mestre`)
  await expect(bruno.page.getByText(AVISO_DA_PAUSA), `${BRUNO} está na ${CENA_B}, que não foi pausada: não deveria ler o aviso`).toHaveCount(0)
})

test('5. o mestre despausa o Salão: o aviso some para Ana e o arrasto dela volta a andar a ficha na tela do mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const paraTela = await cameraDoMestre(page, MAPA_A)
  await mestreVeFichaEm(page, 'limao', paraTela(POS_ANA), `o mestre deveria ver a ficha de ${ANA} onde a câmera do Salão diz`)

  const pausar = await mestrePausa(page, CENA_A)
  await expect(ana.page.getByText(AVISO_DA_PAUSA).first(), `com o ${CENA_A} pausado, ${ANA} deveria ler o aviso`).toBeVisible({ timeout: ESPERA })

  await pausar.click()
  await expect(pausar, `depois do segundo clique, "Pausar" do ${CENA_A} deveria ficar solto`).toHaveAttribute('aria-pressed', 'false', { timeout: ESPERA })
  await expect(ana.page.getByText(AVISO_DA_PAUSA), `despausado, o aviso deveria sumir da tela de ${ANA}`).toHaveCount(0, { timeout: ESPERA })

  const arrasto = await jogadorArrasta(ana, POS_ANA, POS_ANA_ANDOU)
  await fichaFicaOndeSoltou(ana, arrasto)
  await mestreVeFichaEm(page, 'limao', paraTela(POS_ANA_ANDOU), `despausado, a ficha de ${ANA} deveria voltar a andar na tela do mestre`)
})
