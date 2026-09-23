// JORNADA DE USUÁRIO de MEDIR DISTÂNCIA NA TELA DO JOGADOR — escrita para SAIR
// VERMELHA no código de hoje. É a régua da feature, não a feature.
//
// A DOR (levantamento): "O jogador não sabe se alcança o inimigo e pergunta ao
// mestre a cada turno." O mestre tem a ferramenta Medir (`components/labels.ts`,
// `lib/measurement.ts`, `pixi/drawMeasurementIndicator.ts`); o jogador
// (`player/`) não tem nada disso.
//
// A FEATURE que esta régua cobra (decisão da rodada):
//   - botão "Medir" na tela do jogador, que liga e desliga o modo de medir;
//   - modo ligado: pressionar num ponto, arrastar e ver uma linha do início ao
//     ponteiro, com o rótulo de distância no MESMO formato do mestre;
//   - ao soltar, a medida fica até o próximo toque ou até Escape; Escape
//     também desliga o modo;
//   - a medida é só do jogador: nada sai para o mestre nem para os outros, e a
//     tela do mestre não mostra a linha;
//   - modo desligado: tocar e segurar continua fazendo o sinal de hoje.
//
// O TEXTO DO RÓTULO, conferido no código: o mestre desenha
// `measureDistance(...).label` (`pixi/PixiCanvas.tsx:4255`), que é
// `"${número pt-BR com precision casas} ${scale.unit}"` (`lib/measurement.ts`).
// Mapa novo nasce com `scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 }`
// e `measurementMode: 'chessboard'` (`lib/mapFactory.ts`), então 3 quadrados na
// horizontal dão "4,5 m". A régua aceita esse texto com ou sem um prefixo de
// quadrados ("3 quadrados · 4,5 m" também passa).
//
// COMO ESTE ARQUIVO PROVA, sem mentir (mesmo par de `task-jornada-viagem-do-
// jogador.spec.ts`, aceito pela g5):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro (modo Tauri) numa página;
//   a jogadora é o `player.html` inteiro no próprio contexto de navegador. Só
//   o TRANSPORTE Rust é falsificado: o que a jogadora manda pelo WebSocket
//   vira `net:message` na página do mestre (tirado do socket com `JSON.parse`),
//   e o `net_send` do mestre volta ao socket por `exposeFunction`. A sessão do
//   host é a do app (`net/hostBridge.ts`).
//   GESTO REAL. Ponteiro que desce, PARA, anda em passos, PARA e solta;
//   Escape pelo teclado. Os únicos `evaluate` são o repasse do transporte e a
//   LEITURA de pixel (decodifica a foto num canvas solto e pergunta
//   `elementFromPoint`) — nenhum muda estado do app.
//   PROVA NA TELA. Rótulo por texto visível; linha, ficha, sinal e a tela do
//   mestre por pixel da foto, contando só onde o CANVAS está por cima.
//   ESCUTA DO FIO, só anotando: o que a página da jogadora MANDA pelo socket é
//   guardado em `Rede.doJogador` no mesmo `onMessage` que repassa ao mestre.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o botão chama exatamente "Medir" (nome acessível) e diz que está ligado
//     por `aria-pressed="true"`;
//   - o rótulo é TEXTO legível na página (DOM ou região `aria-live`), não só
//     letra pintada no canvas — senão ninguém, nem leitor de tela, o lê;
//   - clicar "Medir" de novo desliga o modo (`aria-pressed="false"`).
//
// CONTROLE POSITIVO (verde hoje): teste 1. A jogadora entra, vê o mapa e a
// própria ficha, e tocar e segurar no mapa faz o sinal aparecer na tela. Sem
// ele, o vermelho dos testes 2 a 6 poderia ser a infraestrutura quebrada.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { fitCamera } from '../src/pixi/world'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'MEDE01'
const JOGADORA = 'Ana'
const AVENTURA = 'Campo de Medir'
const NOME_DA_CENA = 'Patio'
const ID_CENA = 'scene_patio'
const PASTA = 'C:/appdata/maps/map_patio'
const FICHA = 'Lanterna'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
const TELA = { width: 1280, height: 800 }
/** Igual a `FIT_MARGIN` de player/PlayerView.tsx — a conta de câmera tem de ser a mesma. */
const FIT_MARGIN = 24

const CHAO = '#1e8c8c'
const COR_DA_FICHA = '#3cff00'

type Ponto = { x: number; y: number }

/** A ficha da jogadora: longe do corredor da medida e do ponto do sinal (e fora do painel da esquerda). */
const POS_FICHA: Ponto = { x: 700, y: 300 }
/** Três quadrados na horizontal, de vértice a vértice da grade (a régua do mestre gruda em vértice). */
const MEDIR_DE: Ponto = { x: 300, y: 300 }
const MEDIR_ATE: Ponto = { x: 450, y: 300 }
/** Onde o sinal é feito: fora do corredor da medida. */
const SINAL_EM: Ponto = { x: 300, y: 450 }

/** Rótulo do mestre para 3 quadrados neste mapa: "4,5 m" (ver o cabeçalho). */
const ROTULO = /4,5\s*m\b/
const BOTAO_MEDIR = 'Medir'

/** Toque parado abaixo de `SIGNAL_LONG_PRESS_MS` (500): pausa de pessoa antes de andar. */
const PAUSA_MS = 150
/**
 * Segurar parado bem acima de `SIGNAL_LONG_PRESS_MS` (500): é o sinal de hoje.
 * Com 800 ms o sinal não saiu em 2 de 3 rodadas (medido em 22/09: pointerdown e
 * pointerup chegaram ao canvas com 823 ms entre eles e nenhum `signal` no fio):
 * com mestre e jogadora desenhando Pixi na mesma máquina, o temporizador de
 * 500 ms atrasa. Segurar 1,5 s é o gesto de quem quer sinalizar, com folga.
 */
const SEGURAR_MS = 1500
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Espera curta por tela: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000

/** Soma |dR|+|dG|+|dB| acima disto = o pixel mudou. */
const LIMIAR_MUDOU = 60
/** Pixels mínimos para dizer "a ficha está na tela". */
const PIXELS_DE_FICHA = 60
/** Pixels mínimos de chão para dizer "o mapa está na tela". */
const PIXELS_DE_CENA = 2000
/** Pixels mudados mínimos para dizer "o sinal apareceu" em volta do ponto. */
const PIXELS_DE_SINAL = 40
/** Pixels máximos para dizer "nada mudou aqui" (antisserrilhado e sombra). */
const RESIDUO = 25
/** Fração mínima das colunas do meio do corredor com traço novo para dizer "há linha". */
const FRACAO_DE_LINHA = 0.7
/** Fração máxima para dizer "a linha sumiu". */
const FRACAO_SEM_LINHA = 0.1
/** Meia altura da faixa onde a linha é procurada, em px de tela. */
const MEIA_FAIXA = 8
/** Meio lado da caixa em volta da ficha e do sinal, em px de tela. */
const MEIA_CAIXA = 40

// ───────────────────────────────────────────────────────────────────────────
// A aventura no disco: uma cena, a ficha da jogadora, chão verde-água
// ───────────────────────────────────────────────────────────────────────────

function discoDaAventura(): Record<string, string> {
  const base = createEmptyMap('map_patio', AVENTURA, COLUNAS, LINHAS, GRADE)
  const ficha: Token = { id: 'tok-lanterna', characterId: null, name: FICHA, x: POS_FICHA.x, y: POS_FICHA.y, size: 1, image: null, color: COR_DA_FICHA }
  const cena: MapData = {
    ...base,
    floor: [{ id: 'patio-chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    tokens: [ficha],
  }
  const aventura = {
    version: 1,
    id: 'adv_patio',
    name: AVENTURA,
    startSceneId: ID_CENA,
    scenes: [{ id: ID_CENA, name: NOME_DA_CENA, file: 'map.json' }],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(cena),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
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

/** O "Rust" de mentira: liga o WebSocket da jogadora ao `net:*` do mestre, nos dois sentidos. */
interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  /** Tudo que a PÁGINA da jogadora mandou pelo socket, em ordem — só anotado. */
  doJogador: string[]
  /** Mensagens da jogadora entregues ao mestre uma de cada vez, na ordem em que chegaram. */
  fila: Promise<void>
}

async function mestreAbreAventura(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), doJogador: [], fila: Promise.resolve() }
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

/** Aba Jogo, card da jogadora, "Atribuir <ficha>" — o clique de um toque que o painel oferece. */
async function mestreAtribui(mestre: Page): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const painel = mestre.locator('#lb-rail-panel-room')
  const card = painel.locator('.lb-field').filter({ hasText: `${JOGADORA} —` })
  await card.getByRole('button', { name: `Atribuir ${FICHA}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${FICHA}` }), `${JOGADORA} deveria ficar com ${FICHA}`).toBeVisible()
}

// ───────────────────────────────────────────────────────────────────────────
// A jogadora: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

/**
 * Contextos de jogador abertos pelo teste que está rodando. O `page` do mestre
 * o Playwright fecha sozinho; estes não. Sem fechar, a tela da jogadora
 * continuava desenhando Pixi e pesava na leitura de pixel do teste seguinte.
 */
const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function jogadoraEntra(browser: Browser, baseURL: string, rede: Rede): Promise<Page> {
  const clientId = 'c1'
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.doJogador.push(texto)
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
  await campoNome.pressSequentially(JOGADORA, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return page
}

/** Mestre abre a aventura e a sala; Ana entra, recebe a ficha e a vê pintada. */
async function mesaMontada(browser: Browser, mestre: Page, baseURL: string): Promise<{ rede: Rede; ana: Page }> {
  const rede = await mestreAbreAventura(mestre)
  const ana = await jogadoraEntra(browser, baseURL, rede)
  await mestreAtribui(mestre)
  // O mestre volta para o mapa: é onde ele fica na mesa.
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
  await expect(ana.locator('canvas').first(), 'o mapa não apareceu na tela da jogadora').toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await ler(ana, null, await foto(ana))).ficha, { timeout: ESPERA_TELA, message: 'a ficha da jogadora não foi pintada' })
    .toBeGreaterThan(PIXELS_DE_FICHA)
  return { rede, ana }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos
// ───────────────────────────────────────────────────────────────────────────

const CAMERA = fitCamera({ minX: 0, minY: 0, maxX: LARGURA, maxY: ALTURA }, TELA, FIT_MARGIN)

/** Ponto do mundo → ponto da tela da jogadora, com a câmera de "encaixar a cena". */
function naTela(p: Ponto): Ponto {
  return { x: Math.round(p.x * CAMERA.scale + CAMERA.x), y: Math.round(p.y * CAMERA.scale + CAMERA.y) }
}

/** Tocar e segurar parado: o sinal de hoje. */
async function segurarParado(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(SEGURAR_MS)
  await page.mouse.up()
}

/** Desce, para um instante, anda em passos até o destino e PARA — sem soltar. */
async function arrastarSemSoltar(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.move((de.x + para.x) / 2, (de.y + para.y) / 2, { steps: 8 })
  await page.mouse.move(para.x, para.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS + PINTURA_MS)
}

async function soltar(page: Page): Promise<void> {
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

function botaoMedir(page: Page): Locator {
  return page.getByRole('button', { name: BOTAO_MEDIR, exact: true })
}

/** Clica "Medir" e confere que ele ficou pressionado. */
async function ligarMedir(page: Page): Promise<void> {
  const botao = botaoMedir(page)
  await expect(botao, `a tela da jogadora deveria ter o botão "${BOTAO_MEDIR}"`).toBeVisible({ timeout: ESPERA })
  await botao.click()
  await expect(botao, `"${BOTAO_MEDIR}" clicado deveria ficar pressionado (aria-pressed="true")`).toHaveAttribute('aria-pressed', 'true', { timeout: ESPERA })
}

/** Os três quadrados, medidos pela jogadora, com o botão ainda apertado. */
async function medirSemSoltar(page: Page): Promise<void> {
  await arrastarSemSoltar(page, naTela(MEDIR_DE), naTela(MEDIR_ATE))
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da tela (só leitura: foto decodificada num canvas solto)
// ───────────────────────────────────────────────────────────────────────────

async function foto(page: Page): Promise<string> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return (await page.screenshot()).toString('base64')
    } catch {
      await page.waitForTimeout(200)
    }
  }
  throw new Error('não consegui fotografar a tela')
}

async function fotoParada(page: Page): Promise<string> {
  await page.waitForTimeout(PINTURA_MS)
  return foto(page)
}

interface Caixa {
  x: number
  y: number
  w: number
  h: number
}

interface Leitura {
  /** Pixels (só sob o canvas) que mudaram entre `antes` e `depois` na caixa. */
  mudados: number
  /** Pixels verde-limão (a ficha) em `depois`, na caixa. */
  ficha: number
  /** Pixels de chão verde-água em `depois`, na caixa. */
  chao: number
  /** Centro dos pixels da ficha, em px de tela. */
  centroDaFicha: Ponto | null
  /** Colunas do corredor examinadas (sob o canvas) e quantas têm traço novo. */
  colunas: number
  colunasComTraco: number
}

function caixaEm(p: Ponto, meia: number): Caixa {
  return { x: p.x - meia, y: p.y - meia, w: meia * 2, h: meia * 2 }
}

/** O MEIO do corredor da medida (20% a 80%): longe do rótulo, que costuma nascer perto da ponta. */
function corredor(): { x0: number; x1: number; y: number } {
  const de = naTela(MEDIR_DE)
  const ate = naTela(MEDIR_ATE)
  return { x0: Math.round(de.x + (ate.x - de.x) * 0.2), x1: Math.round(de.x + (ate.x - de.x) * 0.8), y: de.y }
}

/**
 * Compara duas fotos (ou lê uma só, com `antes = null`). Conta só pixel com o
 * CANVAS por cima: painel, cartão e botão não contam.
 */
async function ler(page: Page, antes: string | null, depois: string, caixa?: Caixa): Promise<Leitura> {
  const faixa = corredor()
  return page.evaluate(
    async ({ a, d, cx, fx, limiar, meia }) => {
      const decodificar = async (b64: string) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
        const tela = document.createElement('canvas')
        tela.width = bmp.width
        tela.height = bmp.height
        const ctx = tela.getContext('2d')
        if (!ctx) throw new Error('sem contexto 2d')
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, bmp.width, bmp.height)
      }
      const img = await decodificar(d)
      const ref = a === null ? img : await decodificar(a)
      const { data, width, height } = img
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
      const mudou = (x: number, y: number): boolean => {
        const i = (y * width + x) * 4
        return Math.abs(data[i] - ref.data[i]) + Math.abs(data[i + 1] - ref.data[i + 1]) + Math.abs(data[i + 2] - ref.data[i + 2]) > limiar
      }
      const x0 = Math.max(0, Math.floor((cx ? cx.x : 0) / escalaX))
      const y0 = Math.max(0, Math.floor((cx ? cx.y : 0) / escalaY))
      const x1 = Math.min(width, Math.ceil((cx ? cx.x + cx.w : window.innerWidth) / escalaX))
      const y1 = Math.min(height, Math.ceil((cx ? cx.y + cx.h : window.innerHeight) / escalaY))
      const r = { mudados: 0, ficha: 0, chao: 0, centroDaFicha: null as { x: number; y: number } | null, colunas: 0, colunasComTraco: 0 }
      let sx = 0
      let sy = 0
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          const limao = G > 200 && R > 20 && R < 120 && B < 60
          const verdeAgua = G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30 && G >= 35
          const trocou = a !== null && mudou(x, y)
          if (!limao && !verdeAgua && !trocou) continue
          if (!canvasPorCima(x, y)) continue
          if (trocou) r.mudados += 1
          if (limao) {
            r.ficha += 1
            sx += x
            sy += y
          } else if (verdeAgua) r.chao += 1
        }
      }
      if (r.ficha > 0) r.centroDaFicha = { x: (sx / r.ficha) * escalaX, y: (sy / r.ficha) * escalaY }
      if (a !== null) {
        const yc = Math.round(fx.y / escalaY)
        const m = Math.ceil(meia / escalaY)
        for (let x = Math.round(fx.x0 / escalaX); x <= Math.round(fx.x1 / escalaX); x += 1) {
          if (!canvasPorCima(x, yc)) continue
          r.colunas += 1
          for (let y = Math.max(0, yc - m); y <= Math.min(height - 1, yc + m); y += 1) {
            if (mudou(x, y)) {
              r.colunasComTraco += 1
              break
            }
          }
        }
      }
      return r
    },
    { a: antes, d: depois, cx: caixa ?? null, fx: faixa, limiar: LIMIAR_MUDOU, meia: MEIA_FAIXA },
  )
}

function fracaoDeLinha(l: Leitura): number {
  return l.colunas === 0 ? 0 : l.colunasComTraco / l.colunas
}

/** Tipos das mensagens que a página da jogadora mandou desde `desde`, sem o batimento (`ping`). */
function mandadasDesde(rede: Rede, desde: number): string[] {
  return rede.doJogador
    .slice(desde)
    .map((texto) => {
      try {
        return String((JSON.parse(texto) as { type?: unknown }).type)
      } catch {
        return `ilegível: ${texto.slice(0, 60)}`
      }
    })
    .filter((tipo) => tipo !== 'ping')
}

/** Toca e segura em `SINAL_EM` e espera o sinal aparecer em volta do ponto. */
async function sinalAparece(ana: Page, oQue: string): Promise<void> {
  const ponto = naTela(SINAL_EM)
  const antes = await fotoParada(ana)
  await segurarParado(ana, ponto)
  // O sinal vive 3 s (`SIGNAL_TTL_MS`): a primeira leitura já pega ele vivo.
  await expect
    .poll(async () => (await ler(ana, antes, await foto(ana), caixaEm(ponto, MEIA_CAIXA))).mudados, {
      timeout: ESPERA_TELA,
      message: `${oQue}: tocar e segurar no mapa deveria fazer o sinal aparecer em volta do ponto`,
    })
    .toBeGreaterThan(PIXELS_DE_SINAL)
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Ana entra, vê o mapa e a própria ficha, e tocar e segurar no mapa faz o sinal de hoje', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')

  await expect(ana.getByRole('button', { name: `Centralizar em ${FICHA}` }), `o painel deveria mostrar a ficha de ${JOGADORA}`).toBeVisible({ timeout: ESPERA })
  const tela = await ler(ana, null, await fotoParada(ana))
  expect(tela.chao, 'Ana deveria ver o chão do pátio').toBeGreaterThan(PIXELS_DE_CENA)
  expect(tela.ficha, 'Ana deveria ver a própria ficha (verde-limão)').toBeGreaterThan(PIXELS_DE_FICHA)
  const esperado = naTela(POS_FICHA)
  expect(tela.centroDaFicha, 'ficha sem centro').not.toBeNull()
  if (tela.centroDaFicha) {
    expect(Math.hypot(tela.centroDaFicha.x - esperado.x, tela.centroDaFicha.y - esperado.y), 'a ficha não está onde a câmera de encaixe diz: a conta de tela desta régua estaria errada').toBeLessThan(20)
  }

  await sinalAparece(ana, 'controle')
})

test('2. o botão "Medir" existe na tela da jogadora e, clicado, fica pressionado', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await ligarMedir(ana)
  await expect(ana.getByText(ROTULO), 'só ligar o modo não deveria desenhar medida nenhuma').toHaveCount(0)
})

test('3. arrastar 3 quadrados com o modo ligado mostra "4,5 m" e uma linha entre os dois pontos', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await ligarMedir(ana)
  const antes = await fotoParada(ana)

  await medirSemSoltar(ana)

  await expect(ana.getByText(ROTULO).first(), 'com o botão apertado sobre o terceiro quadrado, a tela deveria mostrar o rótulo "4,5 m"').toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => fracaoDeLinha(await ler(ana, antes, await foto(ana))), {
      timeout: ESPERA_TELA,
      message: 'deveria haver uma linha nova no canvas entre o ponto de início e o ponteiro',
    })
    .toBeGreaterThanOrEqual(FRACAO_DE_LINHA)
  // Medir não arrasta a câmera nem a ficha: em volta da ficha nada mudou.
  const perto = await ler(ana, antes, await foto(ana), caixaEm(naTela(POS_FICHA), MEIA_CAIXA))
  expect(perto.ficha, 'a ficha deveria continuar no lugar durante a medida').toBeGreaterThan(PIXELS_DE_FICHA)
  expect(perto.mudados, 'medir moveu a câmera ou a ficha').toBeLessThanOrEqual(RESIDUO)

  await soltar(ana)
})

test('4. ao soltar a medida fica na tela; Escape apaga a medida e desliga o modo', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await ligarMedir(ana)
  const antes = await fotoParada(ana)
  await medirSemSoltar(ana)
  await soltar(ana)
  await ana.waitForTimeout(1000)

  await expect(ana.getByText(ROTULO).first(), 'solta, a medida deveria continuar mostrando "4,5 m"').toBeVisible({ timeout: ESPERA })
  await expect
    .poll(async () => fracaoDeLinha(await ler(ana, antes, await foto(ana))), { timeout: ESPERA_TELA, message: 'solta, a linha deveria continuar na tela' })
    .toBeGreaterThanOrEqual(FRACAO_DE_LINHA)

  await ana.keyboard.press('Escape')
  await expect(ana.getByText(ROTULO), 'Escape deveria apagar o rótulo').toHaveCount(0, { timeout: ESPERA })
  await expect(botaoMedir(ana), 'Escape deveria desligar o modo de medir').toHaveAttribute('aria-pressed', 'false', { timeout: ESPERA })
  await expect
    .poll(async () => fracaoDeLinha(await ler(ana, antes, await foto(ana))), { timeout: ESPERA_TELA, message: 'Escape deveria apagar a linha' })
    .toBeLessThanOrEqual(FRACAO_SEM_LINHA)
})

test('5. a medida não vaza: a página da jogadora não manda nada de medida e a tela do mestre não mostra a linha', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { rede, ana } = await mesaMontada(browser, page, baseURL ?? '')
  const mestre = page

  // Calibração: a tela do mestre mostra o pátio e fica parada sozinha.
  const mestreAntes = await fotoParada(mestre)
  const mestreParado = await ler(mestre, mestreAntes, await fotoParada(mestre))
  expect(mestreParado.chao, 'o mestre deveria estar vendo o chão do pátio').toBeGreaterThan(PIXELS_DE_CENA)
  expect(mestreParado.mudados, 'a tela do mestre muda sozinha parada: a comparação abaixo não provaria nada').toBeLessThanOrEqual(RESIDUO)

  await ligarMedir(ana)
  const desde = rede.doJogador.length
  await medirSemSoltar(ana)
  await expect(ana.getByText(ROTULO).first(), 'a jogadora deveria estar vendo a própria medida').toBeVisible({ timeout: ESPERA })

  const mestreDurante = await ler(mestre, mestreAntes, await fotoParada(mestre))
  expect(mestreDurante.mudados, 'com a jogadora medindo, a tela do mestre mudou: a medida vazou').toBeLessThanOrEqual(RESIDUO)
  await soltar(ana)
  await ana.waitForTimeout(500)
  const mestreDepois = await ler(mestre, mestreAntes, await fotoParada(mestre))
  expect(mestreDepois.mudados, 'depois de soltar, a tela do mestre mostra algo novo: a medida vazou').toBeLessThanOrEqual(RESIDUO)
  await rede.fila
  expect(mandadasDesde(rede, desde), 'enquanto media, a página da jogadora mandou mensagem ao mestre').toEqual([])
})

test('6. com o modo desligado, tocar e segurar volta a fazer o sinal de hoje', async ({ browser, page, baseURL }) => {
  test.setTimeout(150_000)
  const { ana } = await mesaMontada(browser, page, baseURL ?? '')
  await ligarMedir(ana)
  await medirSemSoltar(ana)
  await soltar(ana)
  await expect(ana.getByText(ROTULO).first(), 'a medida deveria ter aparecido antes de desligar').toBeVisible({ timeout: ESPERA })

  await botaoMedir(ana).click()
  await expect(botaoMedir(ana), 'clicar "Medir" de novo deveria desligar o modo').toHaveAttribute('aria-pressed', 'false', { timeout: ESPERA })

  await sinalAparece(ana, 'depois de medir e desligar')
})
