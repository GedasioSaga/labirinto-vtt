// JORNADA DE USUÁRIO das CENAS COM GENTE (G3) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G3):
//   - na lista "Cenas" da aba Mapa, cada cena mostra uma bolinha por jogador
//     CONECTADO cuja ficha está nela, pintada com a cor da ficha (`token.color`)
//     e com o nome do jogador no nome acessível (aria-label ou title "Ana");
//   - quando um jogador que está numa cena pede para passar por um pino de
//     viagem e o pedido espera o mestre, essa cena mostra um selo de pedido
//     (texto visível ou nome acessível com "pedido", ex.: "1 pedido");
//   - tudo atualiza na hora: viagem aprovada tira a bolinha da cena A e põe na
//     cena B; aprovar ou recusar apaga o selo; jogador que sai some da lista.
//
// ONDE ISSO MORRE HOJE: `components/ScenesSection.tsx` só desenha o nome da
// cena e "N tokens"; a lista (`stores/adventureStore` → `SceneListItem`) não
// sabe quem está conectado nem quais pedidos esperam em `net/hostBridge.ts`.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-viagem-do-jogador.spec.ts):
//   TRÊS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado, e só nas duas obrigações do fio:
//     1. o que o jogador manda pelo WebSocket roteado vira `net:message` no
//        mestre (e o `net_send` do mestre volta ao socket por `exposeFunction`);
//     2. quando a PÁGINA do jogador fecha de verdade (`page.on('close')`), o fio
//        avisa o mestre com `net:peer {event: 'disconnected'}` — é o que o Rust
//        faz quando o socket cai (`desktop/src-tauri/src/net/commands.rs`). Não
//        há evento inventado: ele só sai quando o contexto do jogador é fechado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: duas cenas e um par de pinos de
//   viagem num `adventure.json`, aberto pelo menu como na mesa.
//   GESTO REAL NA AÇÃO SOB TESTE: toque no pino, cliques nos botões do cartão e
//   do aviso, fechar a página. Os únicos `evaluate` são o do transporte e a
//   LEITURA de pixel (decodificar a foto num canvas solto).
//   PROVA NA TELA: nome acessível e texto visível da lista "Cenas"; a COR da
//   bolinha lida em pixel na foto do próprio elemento; a ficha de cada jogador
//   lida em pixel na tela dele. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - cada cena da lista continua sendo um item de lista (`listitem`) que
//     contém o botão com o nome da cena — é o `<li>` de hoje;
//   - a bolinha é um elemento DENTRO desse item com aria-label ou title igual
//     ao nome do jogador (exato: "Ana", "Bruno"), pintado com a cor da ficha;
//   - o selo é texto visível, aria-label ou title contendo "pedido" (qualquer
//     caixa), dentro do item da cena onde está quem pediu;
//   - o aviso do mestre continua com "Deixar ir" e "Não" (régua da viagem).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 5 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'GENTE1'
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
/** Ana verde-limão, Bruno laranja: cores que nada mais no app usa (a cabeça dos pinos é dourada). */
const COR_J1 = '#3cff00'
const COR_J2 = '#ff5a00'

type Ponto = { x: number; y: number }
type Foto = Awaited<ReturnType<Page['screenshot']>>

const POS_J1: Ponto = { x: 700, y: 300 }
const POS_J2: Ponto = { x: 820, y: 300 }
const POS_ESCADA_A: Ponto = { x: 900, y: 440 }
const POS_ESCADA_B: Ponto = { x: 1000, y: 300 }

/** Botão parado antes de soltar: toque de dedo, abaixo dos 500 ms que viram sinal de mapa. */
const TOQUE_MS = 120
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Cabeça do pino: centro 23 px de mundo acima da ponta (`lib/pins.ts`); 31 acerta a cabeça e foge do token. */
const CABECA_DO_PINO = 31

const PIXELS_DE_TOKEN = 60
const PIXELS_DE_CENA = 2000
/** Pixels da cor da ficha para dizer "esta bolinha é desta cor" (uma bolinha de 8 px tem ~50). */
const PIXELS_DE_BOLINHA = 12
/** Pixels máximos para dizer "esta cor NÃO está aqui" (antisserrilhado). */
const RESIDUO = 3

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/
const RECUSADO = 'O mestre não deixou passar agora'
const SELO = /pedido/i

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
    [pino('pin-a-escada', POS_ESCADA_A, 'viagem', ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
  )
  const cenaB = cena('map_cripta', CENA_B, CHAO_B, [], [
    pino('pin-b-escada', POS_ESCADA_B, 'viagem', ESCADA_B, { sceneId: ID_CENA_A, pinId: 'pin-a-escada' }),
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
  /** Segunda obrigação do fio Rust: a página do jogador fechou, o socket caiu. */
  __labSocketCaiu: (clientId: string) => void
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
      // O Rust emite `net:peer {clientId, event: 'disconnected'}` quando o socket do jogador cai.
      alvo.__labSocketCaiu = (clientId) => {
        const payload = { clientId, event: 'disconnected' }
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === 'net:peer') ouvinte.handler({ event: 'net:peer', id, payload })
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
  await expect(entradaDaCena(lista, CENA_A), `a lista de Cenas deveria ter "${CENA_A}"`).toBeVisible()
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

/** O item da lista "Cenas" que tem o botão com o nome da cena. */
function linhaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('listitem').filter({ has: lista.page().getByRole('button', { name: nome, exact: true }) })
}

/** A bolinha de um jogador dentro da linha de uma cena: nome acessível ou título igual ao nome dele. */
function bolinha(linha: Locator, jogador: string): Locator {
  return linha.getByLabel(jogador, { exact: true }).or(linha.getByTitle(jogador, { exact: true }))
}

/** O selo de pedido dentro da linha de uma cena: texto visível, nome acessível ou título com "pedido". */
function selo(linha: Locator): Locator {
  return linha.getByText(SELO).or(linha.getByLabel(SELO)).or(linha.getByTitle(SELO))
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
// Leitura de pixel (mestre e jogador)
// ───────────────────────────────────────────────────────────────────────────

interface Cores {
  limao: number
  laranja: number
  verdeAgua: number
  magenta: number
}

/**
 * Conta, numa foto PNG, os pixels de cada cor da régua. Decodifica a foto num
 * canvas solto da própria página — leitura pura, nada do app é tocado. Com
 * `soCanvas`, conta só onde o CANVAS do mapa está por cima (painéis e cartões
 * não contam); sem ele, conta a foto inteira (foto de um elemento da lista).
 */
async function contarCores(page: Page, foto: Foto, soCanvas: boolean): Promise<Cores> {
  return page.evaluate(
    async ({ b64, filtrar }) => {
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
        if (!filtrar) return true
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = noCanvas.get(chave)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
          noCanvas.set(chave, v)
        }
        return v
      }
      const r = { limao: 0, laranja: 0, verdeAgua: 0, magenta: 0 }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const limao = G > 200 && R > 20 && R < 120 && B < 60
          const laranja = R > 200 && G > 50 && G < 140 && B < 60
          const verdeAgua = G >= 110 && G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
          const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
          if (!limao && !laranja && !verdeAgua && !magenta) continue
          if (!canvasPorCima(x, y)) continue
          if (limao) r.limao += 1
          else if (laranja) r.laranja += 1
          else if (verdeAgua) r.verdeAgua += 1
          else r.magenta += 1
        }
      }
      return r
    },
    { b64: foto.toString('base64'), filtrar: soCanvas },
  )
}

async function foto(alvo: Page | Locator): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await alvo.screenshot()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('não consegui fotografar')
}

/** Tela do jogador: pixels de cada cor sobre o canvas do mapa. */
async function telaDoJogador(page: Page): Promise<Cores> {
  await page.waitForTimeout(PINTURA_MS)
  return contarCores(page, await foto(page), true)
}

/** Cor de um elemento da lista do mestre (bolinha, linha), lida na foto do próprio elemento. */
async function coresDoElemento(mestre: Page, elemento: Locator): Promise<Cores> {
  return contarCores(mestre, await foto(elemento), false)
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  contexto: BrowserContext
  clientId: string
}

/** Contextos de jogador abertos pelo teste que está rodando; o do mestre o Playwright fecha sozinho. */
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
  // A página fechou de verdade: o socket dela caiu, e o fio avisa o mestre (como o Rust).
  page.on('close', () => {
    rede.sockets.delete(clientId)
    rede.fila = rede.fila
      .then(() => rede.mestre.evaluate((c) => (window as unknown as JanelaDoMestre).__labSocketCaiu(c), clientId))
      .catch(() => undefined)
  })
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(nome, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return { page, contexto, clientId }
}

/** Espera o mapa chegar à tela do jogador com a ficha DELE pintada. */
async function esperaFichaNaTela(j: Jogador, quem: string, cor: 'limao' | 'laranja'): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${quem}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await telaDoJogador(j.page))[cor], { timeout: ESPERA_TELA, message: `${quem}: a própria ficha não foi pintada na tela dele` })
    .toBeGreaterThan(PIXELS_DE_TOKEN)
}

/** Mestre abre a aventura e a sala; Ana e Bruno entram e recebem cada um a sua ficha no Salão. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<{ rede: Rede; ana: Jogador; bruno: Jogador }> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', J1)
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', J2)
  await mestreAtribui(mestre, J1, TOKEN_J1)
  await mestreAtribui(mestre, J2, TOKEN_J2)
  await esperaFichaNaTela(ana, J1, 'limao')
  await esperaFichaNaTela(bruno, J2, 'laranja')
  return { rede, ana, bruno }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos do jogador (os da régua da viagem)
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

/** Cartão do pino de viagem → "Pedir para passar" → a pergunta → confirmar → "Aguardando o mestre…". */
async function pedirParaPassar(j: Jogador): Promise<void> {
  await tocar(j.page, cabecaDoPino(POS_ESCADA_A))
  const cartao = j.page.getByRole('dialog').filter({ hasText: ESCADA_A })
  await expect(cartao, `${J1}: tocar o pino deveria abrir o cartão com "${ESCADA_A}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: PEDIR_PARA_PASSAR }).click({ timeout: ESPERA })
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${J1}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR }).first().click({ timeout: ESPERA })
  await expect(j.page.getByText(AGUARDANDO).first(), `${J1}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** O aviso que espera, na tela do mestre, e os dois botões dele. */
async function avisoNoMestre(mestre: Page): Promise<{ deixar: Locator; nao: Locator }> {
  const aviso = new RegExp(`${J1}[^]*quer passar[^]*${escapar(ESCADA_A)}[^]*${escapar(CENA_B)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${J1} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  return {
    deixar: mestre.getByRole('button', { name: 'Deixar ir', exact: true }),
    nao: mestre.getByRole('button', { name: 'Não', exact: true }),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Asserções da lista "Cenas"
// ───────────────────────────────────────────────────────────────────────────

/** A bolinha do jogador está na linha, com a cor da ficha dele (pixel) e sem a cor do outro. */
async function bolinhaNaCena(mestre: Page, linha: Locator, jogador: string, cena: string): Promise<void> {
  const b = bolinha(linha, jogador)
  await expect(b.first(), `a linha "${cena}" da lista Cenas deveria mostrar a bolinha de ${jogador} (aria-label ou title "${jogador}")`).toBeVisible({ timeout: ESPERA })
  const cor = jogador === J1 ? 'limao' : 'laranja'
  const outra = jogador === J1 ? 'laranja' : 'limao'
  await expect
    .poll(async () => (await coresDoElemento(mestre, b.first()))[cor], {
      timeout: ESPERA_TELA,
      message: `a bolinha de ${jogador} em "${cena}" deveria ter a cor da ficha dele (${jogador === J1 ? COR_J1 : COR_J2})`,
    })
    .toBeGreaterThan(PIXELS_DE_BOLINHA)
  const cores = await coresDoElemento(mestre, b.first())
  expect(cores[outra], `a bolinha de ${jogador} em "${cena}" não deveria ter a cor da ficha do outro jogador`).toBeLessThanOrEqual(RESIDUO)
}

async function semBolinha(linha: Locator, jogador: string, cena: string): Promise<void> {
  await expect(bolinha(linha, jogador), `a linha "${cena}" não deveria mostrar a bolinha de ${jogador}`).toHaveCount(0, { timeout: ESPERA })
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: as duas cenas estão na lista Cenas, cada jogador vê a própria ficha e a saída de Bruno chega ao mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  const lista = await secaoCenas(page)
  await expect(entradaDaCena(lista, CENA_A), `a lista Cenas deveria mostrar "${CENA_A}"`).toBeVisible()
  await expect(entradaDaCena(lista, CENA_B), `a lista Cenas deveria mostrar "${CENA_B}"`).toBeVisible()
  // A linha que a régua usa existe: é nela que as bolinhas vão aparecer.
  await expect(linhaDaCena(lista, CENA_A), `"${CENA_A}" deveria ser um item da lista`).toHaveCount(1)
  await expect(linhaDaCena(lista, CENA_A)).toContainText('2 tokens')
  await expect(linhaDaCena(lista, CENA_B)).toContainText('0 tokens')

  const telaDeAna = await telaDoJogador(ana.page)
  expect(telaDeAna.limao, `${J1} deveria ver a própria ficha (verde-limão)`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeAna.verdeAgua, `${J1} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)
  const telaDeBruno = await telaDoJogador(bruno.page)
  expect(telaDeBruno.laranja, `${J2} deveria ver a própria ficha (laranja)`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeBruno.verdeAgua, `${J2} deveria ver o chão do ${CENA_A}`).toBeGreaterThan(PIXELS_DE_CENA)

  // O fio avisa a queda: fechar a página de Bruno chega ao mestre como
  // "desconectado" no painel Jogo (é o que o teste 5 usa; sem isto, o vermelho
  // dele poderia ser o fio de mentira, e não a lista Cenas).
  await bruno.contexto.close()
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const cards = page.locator('#lb-rail-panel-room .lb-field')
  await expect(cards.filter({ hasText: `${J2} —` }), `fechada a página, o painel Jogo deveria mostrar ${J2} desconectado`).toContainText('desconectado', { timeout: ESPERA })
  await expect(cards.filter({ hasText: `${J1} —` }), `${J1} continua na mesa`).toContainText(/· conectado/)
})

test('2. quem está onde: o Salão mostra as bolinhas de Ana e Bruno na cor da ficha; a Cripta não mostra nenhuma', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  await mesaMontada(browser, page, baseURL ?? '')
  const lista = await secaoCenas(page)
  const salao = linhaDaCena(lista, CENA_A)
  const cripta = linhaDaCena(lista, CENA_B)
  await expect(cripta, `"${CENA_B}" deveria ser um item da lista`).toHaveCount(1)

  await bolinhaNaCena(page, salao, J1, CENA_A)
  await bolinhaNaCena(page, salao, J2, CENA_A)

  await semBolinha(cripta, J1, CENA_B)
  await semBolinha(cripta, J2, CENA_B)
  const coresDaCripta = await coresDoElemento(page, cripta)
  expect(coresDaCripta.limao + coresDaCripta.laranja, `a linha "${CENA_B}" não deveria ter bolinha de cor de ficha nenhuma`).toBeLessThanOrEqual(RESIDUO)
})

test('3. pedido esperando: Ana pede para passar, o Salão mostra o selo de pedido e ele some quando o mestre diz "Não"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const lista = await secaoCenas(page)
  const salao = linhaDaCena(lista, CENA_A)
  const cripta = linhaDaCena(lista, CENA_B)
  await expect(salao, `"${CENA_A}" deveria ser um item da lista`).toHaveCount(1)
  await expect(selo(salao), 'antes de qualquer pedido, o Salão não deveria ter selo de pedido').toHaveCount(0)

  await pedirParaPassar(ana)
  const { nao } = await avisoNoMestre(page)
  await expect(selo(salao).first(), `com o pedido de ${J1} esperando, a linha "${CENA_A}" deveria mostrar um selo com "pedido"`).toBeVisible({ timeout: ESPERA })
  await expect(selo(cripta), `o pedido é de quem está no ${CENA_A}; a "${CENA_B}" não deveria ter selo`).toHaveCount(0)

  await nao.click()
  await expect(ana.page.getByText(RECUSADO).first(), `${J1} deveria ler "${RECUSADO}"`).toBeVisible({ timeout: ESPERA })
  await expect(selo(salao), 'recusado o pedido, o selo do Salão deveria sumir').toHaveCount(0, { timeout: ESPERA })
  await bolinhaNaCena(page, salao, J1, CENA_A)
})

test('4. viagem aprovada: a bolinha de Ana sai do Salão e aparece na Cripta; a de Bruno fica no Salão', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  const lista = await secaoCenas(page)
  const salao = linhaDaCena(lista, CENA_A)
  const cripta = linhaDaCena(lista, CENA_B)

  // Primeiro pedido, recusado: é "pedir de novo" que vale.
  await pedirParaPassar(ana)
  const primeiro = await avisoNoMestre(page)
  await primeiro.nao.click()
  await expect(ana.page.getByText(RECUSADO).first(), `${J1} deveria ler "${RECUSADO}"`).toBeVisible({ timeout: ESPERA })
  await ana.page.keyboard.press('Escape')

  await pedirParaPassar(ana)
  const segundo = await avisoNoMestre(page)
  await segundo.deixar.click()
  await expect(ana.page.getByText(VOCE_CHEGOU).first(), `${J1} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaDoJogador(ana.page)).magenta, { timeout: ESPERA_TELA, message: `${J1} deveria passar a ver o chão da ${CENA_B}` })
    .toBeGreaterThan(PIXELS_DE_CENA)

  await bolinhaNaCena(page, cripta, J1, CENA_B)
  await semBolinha(salao, J1, CENA_A)
  await bolinhaNaCena(page, salao, J2, CENA_A)
  await semBolinha(cripta, J2, CENA_B)
  await expect(selo(salao), 'aprovado o pedido, o selo do Salão deveria sumir').toHaveCount(0, { timeout: ESPERA })
})

test('5. quem sai some: Bruno fecha a página e a bolinha dele sai da lista; a de Ana fica', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { bruno } = await mesaMontada(browser, page, baseURL ?? '')
  const lista = await secaoCenas(page)
  const salao = linhaDaCena(lista, CENA_A)

  await bolinhaNaCena(page, salao, J1, CENA_A)
  await bolinhaNaCena(page, salao, J2, CENA_A)

  await bruno.contexto.close()

  await semBolinha(salao, J2, CENA_A)
  await expect
    .poll(async () => (await coresDoElemento(page, salao)).laranja, { timeout: ESPERA_TELA, message: `sem ${J2} na mesa, a linha "${CENA_A}" não deveria ter mais a cor da ficha dele` })
    .toBeLessThanOrEqual(RESIDUO)
  await bolinhaNaCena(page, salao, J1, CENA_A)
  // A ficha de Bruno continua no mapa: é o JOGADOR que saiu, não o token.
  await expect(salao).toContainText('2 tokens')
})
