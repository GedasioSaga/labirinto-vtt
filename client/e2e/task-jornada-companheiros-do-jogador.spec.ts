// JORNADA DE USUÁRIO dos COMPANHEIROS NA TELA DO JOGADOR (G13) — escrita para
// SAIR VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A FEATURE (PEDIDOS.md, G13):
//   - na tela do jogador aparece uma lista "Grupo" (região ou lista com esse
//     nome acessível) com os OUTROS jogadores da mesa, um por linha, com o nome
//     e: "aqui" (mesma cena que ele), "em outro lugar" (outra cena) ou "fora"
//     (desconectado);
//   - nunca o nome da cena de ninguém: nem na tela, nem nos frames;
//   - a lista atualiza na hora quando alguém viaja, é levado ou cai.
//
// ONDE ISSO MORRE HOJE: a tela do jogador (`player/PlayerView.tsx`,
// `player/PlayerPanel.tsx`) não tem lista de companheiros, e o protocolo
// (`net/protocol.ts`) não manda ao jogador quem mais está na mesa. Quando um
// amigo vai para outra cena, a ficha dele só some.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-cenas-com-gente.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   QUATRO TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   cada jogador é o `player.html` inteiro no próprio contexto de navegador.
//   Só o TRANSPORTE Rust é falsificado, e só nas duas obrigações do fio:
//     1. o que o jogador manda pelo WebSocket roteado vira `net:message` no
//        mestre (com `JSON.parse` do que chegou), e o `net_send` do mestre
//        volta ao socket por `exposeFunction` — anotado em `Rede.enviados`;
//     2. quando a PÁGINA do jogador fecha de verdade (`page.on('close')`), o fio
//        avisa o mestre com `net:peer {event: 'disconnected'}` — é o que o Rust
//        faz quando o socket cai. Não há evento inventado.
//   DISCO DE MENTIRA COM A AVENTURA PRONTA: Salão (Ana e Bruno) e Cripta
//   (Carla), ligados por um par de pinos de viagem; as fichas são atribuídas
//   pelo gesto "Atribuir <ficha>" da aba Jogo — a de Carla com o editor na
//   Cripta, aberta pela lista Cenas.
//   GESTO REAL NA AÇÃO SOB TESTE: toque no pino, cliques no cartão e no aviso,
//   fechar a página. Os únicos `evaluate` são o do transporte e a LEITURA de
//   pixel e de texto da tela.
//   PROVA NA TELA: nome acessível da lista "Grupo" e texto visível de cada
//   linha; a ficha de cada jogador lida em pixel na tela dele. Nada é lido da
//   store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - a lista é um elemento com papel `region` ou `list` e nome acessível
//     "Grupo" (exato);
//   - cada companheiro é um `listitem` dentro dela cujo texto visível tem o
//     nome do jogador e o estado ("aqui", "em outro lugar" ou "fora"), e
//     nenhum dos outros dois estados;
//   - o aviso do mestre continua com "Deixar ir" (régua da viagem).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Sem ele, o vermelho dos testes 2 a
// 4 poderia ser a infraestrutura quebrada. O teste 5 pode passar hoje: a tela
// sem lista não vaza nada; ele existe para a feature não começar a vazar.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Pin, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'GRUPO1'
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
/** Ana verde-limão, Bruno laranja, Carla azul: cores que nada mais no app usa. */
const COR_ANA = '#3cff00'
const COR_BRUNO = '#ff5a00'
const COR_CARLA = '#0050ff'

type Ponto = { x: number; y: number }
type Foto = Awaited<ReturnType<Page['screenshot']>>
type CorDeFicha = 'limao' | 'laranja' | 'azul'

const POS_ANA: Ponto = { x: 700, y: 300 }
const POS_BRUNO: Ponto = { x: 820, y: 300 }
const POS_CARLA: Ponto = { x: 600, y: 300 }
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

const AQUI = 'aqui'
const EM_OUTRO_LUGAR = 'em outro lugar'
const FORA = 'fora'
type Estado = typeof AQUI | typeof EM_OUTRO_LUGAR | typeof FORA
const ESTADOS: Estado[] = [AQUI, EM_OUTRO_LUGAR, FORA]

const PEDIR_PARA_PASSAR = 'Pedir para passar'
const PERGUNTA_DO_PEDIDO = 'Pedir ao mestre para passar por aqui?'
const CONFIRMAR_PEDIDO = /^(pedir|sim|confirmar|pedir ao mestre|pedir passagem|enviar pedido)$/i
const AGUARDANDO = /Aguardando o mestre(…|\.\.\.)/
const VOCE_CHEGOU = /Você chegou/

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: Ana e Bruno no Salão, Carla na Cripta
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
    [token('tok-lanterna', TOKEN_ANA, POS_ANA, COR_ANA), token('tok-machado', TOKEN_BRUNO, POS_BRUNO, COR_BRUNO)],
    [pino('pin-a-escada', POS_ESCADA_A, 'viagem', ESCADA_A, { sceneId: ID_CENA_B, pinId: 'pin-b-escada' })],
  )
  // O nome do MAPA da Cripta não é o nome da cena: só o nome da cena ("Cripta
  // Rubra") é o que não pode vazar, e ele só existe no adventure.json.
  const cenaB = cena('map_cripta', 'Planta de baixo', CHAO_B, [token('tok-cajado', TOKEN_CARLA, POS_CARLA, COR_CARLA)], [
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
  /** Todo frame que o mestre mandou a cada jogador, na ordem — só anotado, para a régua do vazamento. */
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
// Leitura de pixel da tela do jogador
// ───────────────────────────────────────────────────────────────────────────

type Cores = Record<CorDeFicha | 'verdeAgua' | 'magenta', number>

/**
 * Conta, na foto da página, os pixels de cada cor da régua só onde o CANVAS do
 * mapa está por cima (painéis e cartões não contam). Decodifica a foto num
 * canvas solto da própria página — leitura pura, nada do app é tocado.
 */
async function contarCores(page: Page, foto: Foto): Promise<Cores> {
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
    const r = { limao: 0, laranja: 0, azul: 0, verdeAgua: 0, magenta: 0 }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        const limao = G > 200 && R > 20 && R < 120 && B < 60
        const laranja = R > 200 && G > 50 && G < 140 && B < 60
        const azul = B > 200 && R < 60 && G > 40 && G < 130
        const verdeAgua = G >= 110 && G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30
        const magenta = R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30
        if (!limao && !laranja && !azul && !verdeAgua && !magenta) continue
        if (!canvasPorCima(x, y)) continue
        if (limao) r.limao += 1
        else if (laranja) r.laranja += 1
        else if (azul) r.azul += 1
        else if (verdeAgua) r.verdeAgua += 1
        else r.magenta += 1
      }
    }
    return r
  }, foto.toString('base64'))
}

async function telaDoJogador(page: Page): Promise<Cores> {
  await page.waitForTimeout(PINTURA_MS)
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await contarCores(page, await page.screenshot())
    } catch {
      await page.waitForTimeout(200)
    }
  }
  throw new Error('régua: não consegui fotografar a tela do jogador')
}

// ───────────────────────────────────────────────────────────────────────────
// O jogador: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  contexto: BrowserContext
  clientId: string
  nome: string
  cor: CorDeFicha
}

/** Contextos de jogador abertos pelo teste que está rodando; o do mestre o Playwright fecha sozinho. */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadorEntra(browser: Browser, baseURL: string, rede: Rede, clientId: string, nome: string, cor: CorDeFicha): Promise<Jogador> {
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  rede.enviados.set(clientId, [])
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
  return { page, contexto, clientId, nome, cor }
}

/** Espera o mapa chegar à tela do jogador com a ficha DELE pintada. */
async function esperaFichaNaTela(j: Jogador): Promise<void> {
  await expect(j.page.locator('canvas').first(), `${j.nome}: o mapa não apareceu na tela do jogador`).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await telaDoJogador(j.page))[j.cor], { timeout: ESPERA_TELA, message: `${j.nome}: a própria ficha não foi pintada na tela dele` })
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
 * no Salão, Carla a dela com o editor na Cripta. O editor volta ao Salão.
 */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<Mesa> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadorEntra(browser, baseURL, rede, 'c1', ANA, 'limao')
  const bruno = await jogadorEntra(browser, baseURL, rede, 'c2', BRUNO, 'laranja')
  const carla = await jogadorEntra(browser, baseURL, rede, 'c3', CARLA, 'azul')
  await mestreAtribui(mestre, ANA, TOKEN_ANA)
  await mestreAtribui(mestre, BRUNO, TOKEN_BRUNO)
  await mestreAbreCena(mestre, CENA_B)
  await mestreAtribui(mestre, CARLA, TOKEN_CARLA)
  await mestreAbreCena(mestre, CENA_A)
  await esperaFichaNaTela(ana)
  await esperaFichaNaTela(bruno)
  await esperaFichaNaTela(carla)
  return { rede, ana, bruno, carla }
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
  await expect(cartao, `${j.nome}: tocar o pino deveria abrir o cartão com "${ESCADA_A}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: PEDIR_PARA_PASSAR }).click({ timeout: ESPERA })
  await expect(j.page.getByText(PERGUNTA_DO_PEDIDO), `${j.nome}: pedir deveria perguntar "${PERGUNTA_DO_PEDIDO}"`).toBeVisible({ timeout: ESPERA })
  await j.page.getByRole('button', { name: CONFIRMAR_PEDIDO }).filter({ hasNotText: PEDIR_PARA_PASSAR }).first().click({ timeout: ESPERA })
  await expect(j.page.getByText(AGUARDANDO).first(), `${j.nome}: depois de confirmar deveria ler "Aguardando o mestre…"`).toBeVisible({ timeout: ESPERA })
}

/** Bruno pede, o mestre clica "Deixar ir", Bruno lê "Você chegou" e vê o chão da Cripta. */
async function brunoViajaParaACripta(mestre: Page, bruno: Jogador): Promise<void> {
  await pedirParaPassar(bruno)
  const aviso = new RegExp(`${BRUNO}[^]*quer passar[^]*${escapar(ESCADA_A)}[^]*${escapar(CENA_B)}`)
  await expect(mestre.getByText(aviso).first(), `o mestre deveria ler "${BRUNO} quer passar por ${ESCADA_A} → ${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await mestre.getByRole('button', { name: 'Deixar ir', exact: true }).click()
  await expect(bruno.page.getByText(VOCE_CHEGOU).first(), `${BRUNO} deveria ler "Você chegou"`).toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => (await telaDoJogador(bruno.page)).magenta, { timeout: ESPERA_TELA, message: `${BRUNO} deveria passar a ver o chão da Cripta` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

// ───────────────────────────────────────────────────────────────────────────
// A lista "Grupo" na tela do jogador
// ───────────────────────────────────────────────────────────────────────────

/** A lista "Grupo": região ou lista com esse nome acessível. */
function grupo(page: Page): Locator {
  return page.getByRole('region', { name: 'Grupo', exact: true }).or(page.getByRole('list', { name: 'Grupo', exact: true }))
}

/** A linha de um companheiro: item da lista cujo texto visível tem o nome dele. */
function linhaDe(page: Page, companheiro: string): Locator {
  return grupo(page).getByRole('listitem').filter({ hasText: new RegExp(`\\b${escapar(companheiro)}\\b`) })
}

/** Na tela de `quem`, a lista "Grupo" está visível e a linha de `companheiro` diz `estado` — e só ele. */
async function companheiroEsta(quem: Jogador, companheiro: string, estado: Estado): Promise<void> {
  await expect(grupo(quem.page).first(), `a tela de ${quem.nome} deveria ter a lista "Grupo" (região ou lista com esse nome acessível)`).toBeVisible({ timeout: ESPERA })
  const linha = linhaDe(quem.page, companheiro)
  await expect(linha, `a lista "Grupo" de ${quem.nome} deveria ter UMA linha para ${companheiro}`).toHaveCount(1, { timeout: ESPERA })
  await expect(linha, `na tela de ${quem.nome}, ${companheiro} deveria estar "${estado}"`).toContainText(estado, { timeout: ESPERA })
  for (const outro of ESTADOS) {
    if (outro === estado || estado.includes(outro)) continue
    await expect(linha, `na tela de ${quem.nome}, ${companheiro} está "${estado}" e não deveria dizer também "${outro}"`).not.toContainText(outro)
  }
}

/** Tudo o que a tela do jogador mostra em texto: texto visível e nomes acessíveis (aria-label, title, alt). */
async function textoDaTela(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rotulos = Array.from(document.querySelectorAll('[aria-label], [title], [alt], [placeholder]')).map((el) =>
      ['aria-label', 'title', 'alt', 'placeholder'].map((a) => el.getAttribute(a) ?? '').join(' '),
    )
    return `${document.body.innerText}\n${rotulos.join('\n')}\n${document.title}`
  })
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: os três entram, cada um vê a própria ficha e a queda de Carla chega ao mestre', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, bruno, carla } = await mesaMontada(browser, page, baseURL ?? '')

  const telaDeAna = await telaDoJogador(ana.page)
  expect(telaDeAna.limao, `${ANA} deveria ver a própria ficha (verde-limão)`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeAna.verdeAgua, `${ANA} deveria ver o chão do Salão`).toBeGreaterThan(PIXELS_DE_CENA)
  const telaDeBruno = await telaDoJogador(bruno.page)
  expect(telaDeBruno.laranja, `${BRUNO} deveria ver a própria ficha (laranja)`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeBruno.verdeAgua, `${BRUNO} deveria ver o chão do Salão`).toBeGreaterThan(PIXELS_DE_CENA)
  const telaDeCarla = await telaDoJogador(carla.page)
  expect(telaDeCarla.azul, `${CARLA} deveria ver a própria ficha (azul)`).toBeGreaterThan(PIXELS_DE_TOKEN)
  expect(telaDeCarla.magenta, `${CARLA} deveria ver o chão da Cripta`).toBeGreaterThan(PIXELS_DE_CENA)

  // O fio avisa a queda: fechar a página de Carla chega ao mestre como
  // "desconectado" no painel Jogo (é o que o teste 4 usa; sem isto, o vermelho
  // dele poderia ser o fio de mentira, e não a lista Grupo).
  await carla.contexto.close()
  await page.getByRole('tab', { name: 'Jogo' }).click()
  const cards = page.locator('#lb-rail-panel-room .lb-field')
  await expect(cards.filter({ hasText: `${CARLA} —` }), `fechada a página, o painel Jogo deveria mostrar ${CARLA} desconectado`).toContainText('desconectado', { timeout: ESPERA })
  await expect(cards.filter({ hasText: `${ANA} —` }), `${ANA} continua na mesa`).toContainText(/· conectado/)
})

test('2. quem está onde: na tela de Ana, Bruno está "aqui" e Carla "em outro lugar"; Ana não está na própria lista', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await companheiroEsta(ana, BRUNO, AQUI)
  await companheiroEsta(ana, CARLA, EM_OUTRO_LUGAR)
  await expect(linhaDe(ana.page, ANA), `${ANA} não deveria aparecer na própria lista "Grupo"`).toHaveCount(0)
  await expect(grupo(ana.page).getByRole('listitem'), `a lista "Grupo" de ${ANA} deveria ter só os outros dois`).toHaveCount(2)
})

test('3. viagem: Bruno vai para a Cripta pelo pino; para Ana ele passa a "em outro lugar", para Carla a "aqui"', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { ana, bruno, carla } = await mesaMontada(browser, page, baseURL ?? '')

  await brunoViajaParaACripta(page, bruno)

  await companheiroEsta(ana, BRUNO, EM_OUTRO_LUGAR)
  await companheiroEsta(carla, BRUNO, AQUI)
  await companheiroEsta(ana, CARLA, EM_OUTRO_LUGAR)
  await companheiroEsta(carla, ANA, EM_OUTRO_LUGAR)
})

test('4. queda: Carla fecha a página e, na tela de Ana, Carla passa a "fora"; Bruno continua "aqui"', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana, carla } = await mesaMontada(browser, page, baseURL ?? '')

  await carla.contexto.close()

  await companheiroEsta(ana, CARLA, FORA)
  await companheiroEsta(ana, BRUNO, AQUI)
})

test('5. nada vaza: depois da viagem de Bruno, nem a tela de Ana nem os frames que ela recebeu têm o nome da Cripta', async ({ browser, page, baseURL }) => {
  test.setTimeout(180_000)
  const { rede, ana, bruno } = await mesaMontada(browser, page, baseURL ?? '')

  await brunoViajaParaACripta(page, bruno)
  // O mestre fala o nome da Cripta (é o controle de que ele existe no mundo desta régua).
  await expect(page.getByText(new RegExp(escapar(CENA_B))).first(), `o mestre deveria ler o nome "${CENA_B}"`).toBeVisible({ timeout: ESPERA })
  await esperaFichaNaTela(ana)

  const tela = await textoDaTela(ana.page)
  expect(tela.length, `a tela de ${ANA} deveria ter algum texto para ler`).toBeGreaterThan(0)
  expect(tela, `a tela de ${ANA} não deveria mostrar "${CENA_B}" (texto visível ou nome acessível)`).not.toContain(CENA_B)

  const frames = rede.enviados.get(ana.clientId) ?? []
  expect(frames.length, `${ANA} deveria ter recebido frames do mestre`).toBeGreaterThan(0)
  const vazados = frames.filter((f) => f.includes(CENA_B)).map((f) => f.slice(0, 160))
  expect(vazados, `nenhum frame recebido por ${ANA} deveria conter "${CENA_B}"`).toEqual([])
})
